from __future__ import annotations

import math
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.base import AgentOutput, BaseAgent, Ctx, MissingData
from app.core.audit import audit
from app.core.models import (
    Approval,
    ApprovalStatus,
    Artifact,
    Decision,
    OpenQuestion,
    Task,
    TaskStatus,
)
from app.orchestration.messages import AgentEvent, publish
from app.orchestration.router import ESCALATION_FLAGS
from app.orchestration.state_machine import transition
from app.tools import diagram
from app.tools.planning import critical_path

# Эскалации, которые PM может принять сам: внешнее действие всё равно закрыто approval-гейтом
SELF_RESOLVABLE = {"client_document", "external_send"}


def pm_triage(db: Session) -> list[str]:
    """PM разбирает очередь: назначает BACKLOG-задачи, принимает безопасные эскалации,
    остальные эскалации передаёт людям (open question MANAGEMENT)."""
    from app.agents.registry import get_agent

    handled = []
    rows = db.execute(select(Task).where(Task.status.in_([TaskStatus.BACKLOG.value, TaskStatus.ESCALATED.value]))
                      ).scalars().all()
    for t in rows:
        flags = t.flags or {}
        if flags.get("pm_triaged"):
            continue
        if t.status == TaskStatus.BACKLOG.value:
            if get_agent(t.assignee_agent).supports(t.kind):
                transition(db, t, TaskStatus.ASSIGNED, actor="PM", reason="назначено PM")
                _decision(db, t, f"Назначить {t.kind} → {t.assignee_agent}", "задача в зоне ответственности роли")
            else:
                _to_humans(db, t, f"нет агента для задачи вида {t.kind}")
            t.flags = {**flags, "pm_triaged": True}
            handled.append(t.id)
            continue
        raised = {k for k in ESCALATION_FLAGS if flags.get(k)}
        reason = flags.get("escalation_reason")
        if raised and raised <= SELF_RESOLVABLE and not reason:
            transition(db, t, TaskStatus.ASSIGNED, actor="PM",
                       reason="принято PM: внешнее действие возможно только через approval")
            _decision(db, t, f"Принять эскалацию {sorted(raised)}", "документ/контакт клиента закрыт approval-гейтом")
        else:
            _to_humans(db, t, reason or f"признаки: {sorted(raised)}")
        t.flags = {**(t.flags or {}), "pm_triaged": True}
        handled.append(t.id)
    return handled


def _decision(db: Session, t: Task, title: str, rationale: str) -> None:
    if t.project_id:
        db.add(Decision(project_id=t.project_id, title=title, rationale=rationale, decided_by="PM",
                        status="ACCEPTED"))
        db.flush()


def _to_humans(db: Session, t: Task, reason: str) -> None:
    db.add(OpenQuestion(project_id=t.project_id, task_id=t.id, raised_by="PM", addressee="MANAGEMENT",
                        question=f"Эскалация задачи «{t.title}»: {reason}", category="ESCALATION"))
    publish(db, AgentEvent(from_agent="PM", to_agent="MANAGEMENT", project_id=t.project_id, task_id=t.id,
                           type="ESCALATION", payload={"reason": reason}, needs_human=True))
    audit(db, "PM", "escalation.to_human", entity_type="task", entity_id=t.id, project_id=t.project_id,
          after={"reason": reason})


class PmAgent(BaseAgent):
    id = "PM"
    title = "Project Manager"
    result_contract = {
        "pm.sales_review": ["checklist", "artifact_id", "human_actions"],
        "pm.plan": ["wbs", "risks", "task_ids", "artifact_id"],
        "pm.schedule": ["critical_path", "duration_days", "artifact_id"],
        "pm.acceptance": ["acceptance_artifact_id", "approval_id", "not_verified"],
    }

    # ------------------------------------------------------------------ общие помощники
    def _project_overview(self, ctx: Ctx) -> dict[str, Any]:
        db = ctx.db
        pid = ctx.task.project_id
        apr = list(db.execute(select(Approval).where(Approval.project_id == pid)).scalars())
        oq = list(db.execute(select(OpenQuestion).where(OpenQuestion.project_id == pid,
                                                        OpenQuestion.status == "OPEN")).scalars())
        arts = list(db.execute(select(Artifact).where(Artifact.project_id == pid)).scalars())
        return {"approvals": apr, "questions": oq, "artifacts": arts}

    def _register(self, ctx: Ctx, title: str, rationale: str, status: str = "PROPOSED") -> None:
        ctx.use("decision.record")
        ctx.add(Decision(project_id=ctx.task.project_id, title=title, rationale=rationale, decided_by="PM",
                         status=status), "decisions")

    @staticmethod
    def _human_actions(ov: dict[str, Any]) -> list[dict[str, Any]]:
        return [{"approval_id": a.id, "action": a.action_type, "role": a.required_role, "status": a.status}
                for a in ov["approvals"] if a.status in (ApprovalStatus.PENDING.value, ApprovalStatus.APPROVED.value)]

    # ------------------------------------------------------------------ сценарий 1
    def h_sales_review(self, ctx: Ctx) -> AgentOutput:
        ctx.use("task.review")
        ov = self._project_overview(ctx)
        lead_id = ctx.task.input_payload["lead_id"]
        types = {a.type for a in ov["artifacts"]}
        required = {"icp": "ICP/сегменты (MKT)", "leads": "лиды и квалификация (BDM)",
                    "arch_hypothesis": "гипотеза решения (ARCH)", "arch_spec": "спецификация (ARCH)",
                    "estimate": "смета (FIN)", "contract_draft": "драфт договора (LEGAL)",
                    "legal_checklist": "чек-лист рисков (LEGAL)", "quote": "КП (BDM)", "email_draft": "черновик письма"}
        checklist = [{"item": v, "present": k in types} for k, v in required.items()]
        missing = [v for k, v in required.items() if k not in types]
        human = self._human_actions(ov)
        cats: dict[str, int] = {}
        for q in ov["questions"]:
            cats[q.category] = cats.get(q.category, 0) + 1
        self._register(ctx, f"КП для лида {lead_id}: отправка только после approval send_quote",
                       "внешний документ клиенту (уровень 2)")
        self._register(ctx, "Цены лицензий не включены в КП", "нет предложений поставщиков (NEEDS_VENDOR_QUOTE)")
        if any(q.category == "NEEDS_VERIFICATION" for q in ov["questions"]):
            self._register(ctx, "Юр./налоговые темы с NEEDS_VERIFICATION вынесены людям",
                           "нет свежего официального источника в базе знаний")
        md = "# PM: проверка полноты КП\n\n## Чек-лист\n" + "\n".join(
            f"- [{'x' if c['present'] else ' '}] {c['item']}" for c in checklist)
        md += "\n\n## Требует одобрения человека\n" + ("\n".join(
            f"- {h['action']} → роль {h['role']} (approval `{h['approval_id']}`, {h['status']})" for h in human) or "—")
        md += "\n\n## Открытые вопросы по категориям\n" + "\n".join(f"- {k}: {v}" for k, v in sorted(cats.items()))
        md += "\n\n## Реестр решений\nсм. таблицу decisions проекта\n"
        art = ctx.artifact("pm_review", f"pm_review_{lead_id}", md)
        if missing:
            raise MissingData(missing)
        return AgentOutput(summary=f"КП полное; действий человека: {len(human)}; вопросов: {len(ov['questions'])}",
                           result={"checklist": checklist, "missing": missing, "human_actions": human,
                                   "open_questions": cats, "artifact_id": art.id}, needs_human=bool(human))

    # ------------------------------------------------------------------ сценарий 2: планирование
    def h_plan(self, ctx: Ctx) -> AgentOutput:
        ctx.use("task.create")
        card = ctx.dep_result("bdm.client_card")
        pr = ctx.project
        if pr is None:
            raise MissingData(["проект"])
        wbs = [
            {"id": "1", "name": "Инициация: устав, ТЗ, обследование", "owner": "PM/ARCH"},
            {"id": "2", "name": "Архитектура HLD/LLD", "owner": "ARCH"},
            {"id": "3", "name": "Договор подряда, DPA, SLA", "owner": "LEGAL"},
            {"id": "4", "name": "Смета по этапам и график платежей", "owner": "FIN"},
            {"id": "5", "name": "Стенд: репозиторий, миграции, конфиги", "owner": "ARCH"},
            {"id": "6", "name": "Тестирование на стенде и исправления", "owner": "SUPPORT/ARCH"},
            {"id": "7", "name": "Приёмка, документация, передача в поддержку", "owner": "PM"},
        ]
        risks = [
            {"id": "R1", "risk": "Нет доступа/API учётной системы", "p": "высокая", "impact": "высокое",
             "owner": "ARCH", "response": "требования к клиенту; интеграция NOT_VERIFIED до доступа"},
            {"id": "R2", "risk": f"Качество данных каталога ~{card['sku_count']} SKU", "p": "средняя",
             "impact": "высокое", "owner": "PM", "response": "пилотная выгрузка, сверка"},
            {"id": "R3", "risk": "ПДн покупателей", "p": "средняя", "impact": "высокое", "owner": "LEGAL",
             "response": "DPA, проверка действующего закона о ПДн"},
            {"id": "R4", "risk": "Бюджетные ограничения клиента", "p": "средняя", "impact": "среднее",
             "owner": "FIN", "response": "поэтапная оплата, приоритизация scope"},
        ]
        sla_proposal = {"support_window": "8x5 (предложение)", "severity_matrix": "knowledge_base/support/sla_matrix.json"}
        ctx.request_approval("commit_sla", {"project_id": pr.id, "sla": sla_proposal})
        pr.sla = {"proposal": sla_proposal, "status": "PENDING_APPROVAL"}
        pr.tech_lead = "ARCH"
        self._register(ctx, "Tech lead проекта — ARCH", "проект инфраструктурно-интеграционный", "ACCEPTED")
        me = ctx.task.id
        h = ctx.handoff("ARCH", "arch.hld", "HLD/LLD сайта и CRM", depends_on=[me])
        legal = ctx.handoff("LEGAL", "legal.contract_pack", "Договор подряда, DPA, SLA",
                            payload={"templates": ["contract_work", "sla", "dpa"], "processes_personal_data": True,
                                     "client_in_eu": None, "company": pr.name}, depends_on=[h.id])
        fin = ctx.handoff("FIN", "fin.stage_estimate", "Смета по этапам, график платежей, draft-счета",
                          payload={"advance_pct": "0.30"}, depends_on=[h.id])
        sch = ctx.handoff("PM", "pm.schedule", "План-график и критический путь", depends_on=[h.id, fin.id])
        sc = ctx.handoff("ARCH", "arch.scaffold", "Заготовка репозитория и стенда", payload={"revision": 1},
                         depends_on=[h.id])
        tr = ctx.handoff("SUPPORT", "support.test_run", "Тест-план и прогон на стенде",
                         payload={"stores": card["stores"]}, depends_on=[sc.id])
        acc = ctx.handoff("PM", "pm.acceptance", "Акт приёмки, документация, runbook, передача в поддержку",
                          depends_on=[tr.id, sch.id, legal.id, fin.id], flags={"wait_for_project": True})
        ids = [h.id, legal.id, fin.id, sch.id, sc.id, tr.id, acc.id]
        md = "# План проекта (PM)\n\n## Устав (кратко)\n" + \
             f"- Цель: сайт ro/ru + CRM для {card['stores']} точек; интеграция с учётной системой\n" + \
             f"- Бюджетные ограничения клиента: {card['budget_constraints']}\n\n## WBS\n" + \
             "\n".join(f"- {w['id']}. {w['name']} — {w['owner']}" for w in wbs) + \
             "\n\n## Реестр рисков\n| ID | Риск | Вероятность | Влияние | Владелец | Меры |\n|---|---|---|---|---|---|\n" + \
             "\n".join(f"| {r['id']} | {r['risk']} | {r['p']} | {r['impact']} | {r['owner']} | {r['response']} |"
                       for r in risks) + \
             f"\n\n## SLA\nПредложение: {sla_proposal['support_window']} — ожидает approval commit_sla (MANAGEMENT)\n"
        art = ctx.artifact("project_plan", "project_charter_wbs", md)
        return AgentOutput(summary=f"Проект спланирован, задач: {len(ids)}",
                           result={"wbs": wbs, "risks": risks, "task_ids": ids, "artifact_id": art.id})

    def h_schedule(self, ctx: Ctx) -> AgentOutput:
        ctx.use("plan.critical_path")
        hld = ctx.dep_result("arch.hld")
        team = int(ctx.task.input_payload.get("team_size", 2))
        acts: list[dict[str, Any]] = []
        prev: str | None = None
        # S3–S5 идут параллельно после инфраструктуры; приёмка — после всех трёх
        deps = {"S1": [], "S2": ["S1"], "S3": ["S2"], "S4": ["S2"], "S5": ["S2"], "S6": ["S3", "S4", "S5"]}
        for st in hld["stages"]:
            hours = sum(b for _, _, b in st["labor"])
            acts.append({"id": st["id"], "name": st["name"], "duration": math.ceil(hours / (8 * team)),
                         "deps": deps.get(st["id"], [prev] if prev else [])})
            prev = st["id"]
        cp = critical_path(acts)
        crit = {a["id"] for a in cp["activities"] if a["critical"]}
        g = diagram.gantt("AutoParts: план-график (рабочие дни, оценка)",
                          [{**a, "critical": a["id"] in crit} for a in acts], start="2026-11-02")
        md = (f"# План-график и критический путь\n\nДопущение: команда {team} чел. на этап, 8 ч/день, верхняя "
              f"оценка трудоёмкости ARCH. Сроки — не обязательство до approval commit_deadline.\n\n"
              f"```mermaid\n{g}\n```\n\n| Этап | Дн. | ES | EF | Резерв | Крит. |\n|---|---|---|---|---|---|\n" +
              "\n".join(f"| {a['id']} {a['name']} | {a['duration']} | {a['es']} | {a['ef']} | {a['slack']} | "
                        f"{'да' if a['critical'] else ''} |" for a in cp["activities"]) +
              f"\n\n**Критический путь:** {' → '.join(cp['critical_path'])}; длительность {cp['duration_days']} дн.")
        art = ctx.artifact("schedule", "schedule_cpm", md)
        ctx.request_approval("commit_deadline", {"duration_days": cp["duration_days"],
                                                 "critical_path": cp["critical_path"]}, artifacts=[art])
        return AgentOutput(summary=f"Критический путь {' → '.join(cp['critical_path'])}, {cp['duration_days']} дн.",
                           result={**cp, "artifact_id": art.id})

    def h_acceptance(self, ctx: Ctx) -> AgentOutput:
        ov = self._project_overview(ctx)
        tasks = list(ctx.db.execute(select(Task).where(Task.project_id == ctx.task.project_id)).scalars())
        tests = [t for t in tasks if t.kind in ("support.test_run", "support.retest") and t.status == "DONE"]
        if not tests:
            raise MissingData(["результаты тестирования"])
        last = max(tests, key=lambda t: int(t.input_payload.get("cycle", 1)))
        checks = last.result.get("checks", [])
        fails = [c for c in checks if c["status"] == "FAIL"]
        nv = [c for c in checks if c["status"] == "NOT_VERIFIED"]
        hld = next((t.result for t in tasks if t.kind == "arch.hld"), {})
        not_verified = list(hld.get("not_verified", [])) + [f"{c['check']}: {c['evidence']}" for c in nv]
        runbook = ctx.latest_artifact("scaffold/RUNBOOK.md")
        md = f"""# Акт приёмки этапа «Стенд» (ПРОЕКТ, DRAFT)

> Не является подписанным документом. Передача клиенту — только после approval deliver_client_document.

## Результаты тестирования (цикл {last.input_payload.get('cycle', 1)})
- Проверено статически: {len([c for c in checks if c['status'] == 'VERIFIED_STATIC'])}
- Дефекты (FAIL): {len(fails)}
- Не проверено (NOT_VERIFIED): {len(nv)}

## Не проверено / требования к клиенту
{chr(10).join('- ' + x for x in not_verified)}

## Документация для заказчика
- HLD/LLD: hld_lld; Runbook: {runbook.name if runbook else 'нет'}; тест-отчёт: test_report_cycle{last.input_payload.get('cycle', 1)}

## Передача в поддержку
- SUPPORT получает runbook, SLA-матрицу (после approval commit_sla) и доступ к мониторингу стенда.

## План сопровождения
- Ежемесячный отчёт по SLA, ежеквартальный тест восстановления, пересмотр рисков R1–R4.
"""
        art = ctx.artifact("acceptance", "acceptance_act_draft", md)
        apr = ctx.request_approval("deliver_client_document", {"document": "acceptance_act_draft"}, artifacts=[art])
        ctx.tell("SUPPORT", "REQUEST", {"handover": True, "runbook": runbook.id if runbook else None})
        self._register(ctx, "Интеграция с учётной системой не принимается до получения доступа",
                       "NOT_VERIFIED; нельзя заявлять выполненной", "ACCEPTED")
        return AgentOutput(summary=f"Акт приёмки (DRAFT), FAIL {len(fails)}, NOT_VERIFIED {len(not_verified)}",
                           result={"acceptance_artifact_id": art.id, "approval_id": apr.id, "fails": len(fails),
                                   "not_verified": not_verified, "human_actions": self._human_actions(ov)},
                           needs_human=True)
