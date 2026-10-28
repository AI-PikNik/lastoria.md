"""Базовый класс агента и контекст выполнения.

Агент не обращается к БД/файлам напрямую — только через Ctx, где каждое действие проходит
проверку whitelist инструментов (RBAC) и журналируется.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, ClassVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.approvals import service as approvals
from app.core.audit import audit
from app.core.llm import LlmClient
from app.core.models import Approval, Artifact, OpenQuestion, Project, Task
from app.core.security import check_tool, check_write
from app.knowledge.citations import SourcedFinding, regulated_finding
from app.knowledge.store import Hit, search
from app.orchestration import router
from app.orchestration.messages import AgentEvent, Confidence, MsgType, publish
from app.tools.artifacts import read_artifact, write_artifact

PROMPTS_DIR = Path(__file__).parent / "prompts"


class MissingData(Exception):
    """Нет данных для продолжения — агент останавливается, а не выдумывает."""

    def __init__(self, missing: list[str], questions: list[tuple[str, str]] | None = None):
        super().__init__("нет данных: " + ", ".join(missing))
        self.missing = missing
        self.questions = questions or []


class Escalate(Exception):
    """Агент сам эскалирует задачу к PM (противоречие, исчерпаны циклы, риск)."""

    def __init__(self, reason: str, needs_human: bool = False):
        super().__init__(reason)
        self.reason = reason
        self.needs_human = needs_human


@dataclass
class AgentOutput:
    summary: str
    result: dict[str, Any] = field(default_factory=dict)
    artifacts: list[str] = field(default_factory=list)
    confidence: Confidence = "medium"
    assumptions: list[str] = field(default_factory=list)
    needs_human: bool = False


class Ctx:
    def __init__(self, db: Session, llm: LlmClient, agent: BaseAgent, task: Task):
        self.db = db
        self.llm = llm
        self.agent = agent
        self.task = task
        self.project: Project | None = db.get(Project, task.project_id) if task.project_id else None
        self.created_artifacts: list[str] = []

    @property
    def aid(self) -> str:
        return self.agent.id

    # ------------------------------------------------------------------ tools
    def use(self, tool: str) -> None:
        check_tool(self.aid, tool)

    def can_write(self, entity: str) -> None:
        check_write(self.aid, entity)

    def add(self, obj: Any, entity: str) -> Any:
        self.can_write(entity)
        self.db.add(obj)
        self.db.flush()
        audit(self.db, self.aid, f"{entity}.write", entity_type=entity, entity_id=getattr(obj, "id", None),
              project_id=self.task.project_id)
        return obj

    def artifact(self, type: str, name: str, content: Any, ext: str = "md", meta: dict | None = None) -> Artifact:
        art = write_artifact(self.db, agent_id=self.aid, project_id=self.task.project_id, task_id=self.task.id,
                             type=type, name=name, content=content, ext=ext, meta=meta)
        self.created_artifacts.append(art.id)
        return art

    def read(self, artifact_id: str) -> str:
        art = self.db.get(Artifact, artifact_id)
        if art is None:
            raise MissingData([f"артефакт {artifact_id}"])
        return read_artifact(art)

    def latest_artifact(self, name: str, project_id: str | None = None) -> Artifact | None:
        return self.db.execute(
            select(Artifact).where(Artifact.project_id == (project_id or self.task.project_id), Artifact.name == name)
            .order_by(Artifact.version.desc())
        ).scalars().first()

    def kb(self, query: str, roles: list[str] | None = None, k: int = 5) -> list[Hit]:
        self.use("kb.search")
        return search(self.db, query, roles or [self.aid], k=k)

    def regulated(self, **kw: Any) -> SourcedFinding:
        return regulated_finding(self.db, role=kw.pop("role", self.aid), **kw)

    def handoff(self, to: str, kind: str, title: str, **kw: Any) -> Task:
        self.use("message.send")
        t, _ = router.handoff(self.db, from_agent=self.aid, to_agent=to, kind=kind, title=title,
                              project_id=kw.pop("project_id", self.task.project_id), parent_id=self.task.id, **kw)
        return t

    def tell(self, to: str, type: MsgType, payload: dict[str, Any], **kw: Any) -> None:
        self.use("message.send")
        publish(self.db, AgentEvent(from_agent=self.aid, to_agent=to, project_id=self.task.project_id,
                                    task_id=self.task.id, type=type, payload=payload, **kw))

    def ask(self, addressee: str, question: str, category: str = "GENERAL") -> OpenQuestion:
        self.use("question.raise")
        q = OpenQuestion(project_id=self.task.project_id, task_id=self.task.id, raised_by=self.aid,
                         addressee=addressee, question=question, category=category)
        return self.add(q, "open_questions")

    def request_approval(self, action_type: str, payload: dict[str, Any], *, entity_type: str | None = None,
                         entity_id: str | None = None, artifacts: list[Artifact] | None = None) -> Approval:
        self.use("approval.request")
        body = dict(payload)
        if artifacts:
            body["artifact_checksums"] = {a.id: a.checksum for a in artifacts}
        return approvals.request(self.db, agent=self.aid, action_type=action_type, payload=body,
                                 project_id=self.task.project_id, task_id=self.task.id,
                                 entity_type=entity_type, entity_id=entity_id)

    def narrate(self, prompt: str, max_tokens: int = 2000) -> str:
        """Пояснительный текст от LLM. Цифры и статусы в него не берутся — только из инструментов."""
        res = self.llm.complete(self.db, agent_id=self.aid, task_id=self.task.id, system=self.agent.system_prompt,
                                prompt=prompt, max_tokens=max_tokens)
        return res.text

    def dep_result(self, kind: str) -> dict[str, Any]:
        """Результат выполненной задачи заданного вида среди зависимостей (транзитивно, ближайшая первой)."""
        queue, seen = list(self.task.depends_on or []), set()
        while queue:
            tid = queue.pop(0)
            if tid in seen:
                continue
            seen.add(tid)
            t = self.db.get(Task, tid)
            if t is None:
                continue
            if t.kind == kind and t.status == "DONE":
                return t.result or {}
            queue.extend(t.depends_on or [])
        raise MissingData([f"результат зависимости {kind}"])


class BaseAgent:
    id: ClassVar[str]
    title: ClassVar[str]
    # kind → обязательные ключи результата для приёмки (review)
    result_contract: ClassVar[dict[str, list[str]]] = {}

    def __init__(self) -> None:
        self.system_prompt = (PROMPTS_DIR / f"{self.id.lower()}.md").read_text(encoding="utf-8")

    def handlers(self) -> dict[str, Any]:
        return {k: getattr(self, "h_" + k.split(".", 1)[1]) for k in self.result_contract}

    def supports(self, kind: str) -> bool:
        return kind in self.result_contract

    def execute(self, ctx: Ctx) -> AgentOutput:
        if not self.supports(ctx.task.kind):
            raise MissingData([f"{self.id} не обрабатывает задачи вида {ctx.task.kind}"])
        out: AgentOutput = self.handlers()[ctx.task.kind](ctx)
        out.artifacts = list(dict.fromkeys([*out.artifacts, *ctx.created_artifacts]))
        return out

    def review(self, kind: str, result: dict[str, Any]) -> list[str]:
        return [k for k in self.result_contract.get(kind, []) if result.get(k) in (None, "", [], {})]
