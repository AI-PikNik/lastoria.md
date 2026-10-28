"""CLI HQTeam: `hqteam --help` или `python -m app.cli --help`."""

from __future__ import annotations

import json
import secrets
from pathlib import Path

import typer
from sqlalchemy import select

from app.core.config import BASE_DIR, get_settings
from app.core.db import session_scope
from app.core.logging import mask_pii, setup_logging
from app.core.models import AuditLog, Principal
from app.core.security import HUMAN_ROLES, Caller, hash_key

cli = typer.Typer(help="HQTeam AI company OS", no_args_is_help=True)
db_cli = typer.Typer(help="БД: миграции и seed")
sc_cli = typer.Typer(help="Сценарии на синтетических данных")
ap_cli = typer.Typer(help="Очередь одобрений (human-in-the-loop)")
kb_cli = typer.Typer(help="База знаний")
pr_cli = typer.Typer(help="Принципалы API (люди/сервисы)")
for name, sub in (("db", db_cli), ("scenarios", sc_cli), ("approvals", ap_cli), ("kb", kb_cli),
                  ("principals", pr_cli)):
    cli.add_typer(sub, name=name)


def _print(obj: object) -> None:
    typer.echo(json.dumps(obj, ensure_ascii=False, indent=2, default=str))


def _human(db, api_key: str) -> Caller:
    p = db.execute(select(Principal).where(Principal.api_key_hash == hash_key(api_key),
                                           Principal.active.is_(True))).scalar_one_or_none()
    if p is None:
        raise typer.BadParameter("неверный API-ключ")
    return Caller(id=p.id, kind=p.kind, roles=frozenset(p.roles))


# --------------------------------------------------------------------------- db
@db_cli.command("upgrade")
def db_upgrade() -> None:
    """Применить миграции Alembic (head)."""
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(BASE_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BASE_DIR / "db" / "migrations"))
    cfg.set_main_option("sqlalchemy.url", get_settings().database_url)
    command.upgrade(cfg, "head")
    typer.echo("migrations: OK")


@db_cli.command("seed")
def db_seed() -> None:
    """Загрузить внутренние материалы KB и демо-принципалов (не в prod). Ключи печатаются один раз."""
    from db.seed import run

    with session_scope() as s:
        _print(run(s))


# --------------------------------------------------------------------------- scenarios
@sc_cli.command("run")
def scenarios_run(name: str = typer.Argument("all", help="leads_to_offer | autoparts | all"),
                  demo_approve: bool = typer.Option(False, help="ДЕМО: имитировать одобрение человеком"),
                  verbose: bool = False) -> None:
    """Проиграть сценарий(и). Без --demo-approve внешние действия остаются в очереди одобрений."""
    from scenarios.runner import SCENARIOS

    setup_logging() if verbose else None
    names = list(SCENARIOS) if name == "all" else [name]
    for n in names:
        if n not in SCENARIOS:
            raise typer.BadParameter(f"нет сценария {n}")
        with session_scope() as s:
            rep = SCENARIOS[n](s, demo_approve=demo_approve)
        if not verbose:
            rep.pop("steps", None)
        _print(rep)


# --------------------------------------------------------------------------- approvals
@ap_cli.command("list")
def approvals_list(project_id: str | None = None) -> None:
    from app.approvals.service import pending

    with session_scope() as s:
        _print([{"id": a.id, "action": a.action_type, "role": a.required_role, "requested_by": a.requested_by,
                 "project_id": a.project_id, "payload": mask_pii(a.payload)} for a in pending(s, project_id)])


@ap_cli.command("decide")
def approvals_decide(approval_id: str, approve: bool = typer.Option(..., "--approve/--reject"),
                     api_key: str = typer.Option(..., envvar="HQ_API_KEY", help="ключ человека с нужной ролью"),
                     comment: str | None = None, execute: bool = False) -> None:
    from app.approvals import service

    with session_scope() as s:
        c = _human(s, api_key)
        a = service.decide(s, approval_id, caller=c, approve=approve, comment=comment)
        out: dict[str, object] = {"id": a.id, "status": a.status, "decided_by": a.decided_by}
        if execute and approve:
            op = service.execute(s, a.id, executor=f"human:{c.id}")
            out["execution"] = op.result
            out["status"] = a.status
        _print(out)


@ap_cli.command("execute")
def approvals_execute(approval_id: str, api_key: str = typer.Option(..., envvar="HQ_API_KEY"),
                      idempotency_key: str | None = None) -> None:
    from app.approvals import service

    with session_scope() as s:
        c = _human(s, api_key)
        op = service.execute(s, approval_id, executor=f"human:{c.id}", idempotency_key=idempotency_key)
        _print({"id": op.id, "mode": op.mode, "result": op.result})


# --------------------------------------------------------------------------- kb
@kb_cli.command("ingest")
def kb_ingest(path: Path, role: str = typer.Option(...), title: str | None = None, source_url: str | None = None,
              source_kind: str = typer.Option("user", help="internal|user|template"),
              jurisdiction: str | None = None, version_date: str | None = None) -> None:
    """Добавить материал (md/txt) в базу знаний роли."""
    from app.knowledge.store import ingest

    if source_kind == "official":
        raise typer.BadParameter("official загружается только через `kb fetch-legal` (allowlist хостов)")
    with session_scope() as s:
        d = ingest(s, role=role.upper(), title=title or path.stem, text=path.read_text(encoding="utf-8"),
                   source_url=source_url or f"file://{path.name}", source_kind=source_kind,
                   jurisdiction=jurisdiction, version_date=version_date, actor="human:cli")
        _print({"id": d.id, "checksum": d.checksum})


@kb_cli.command("fetch-legal")
def kb_fetch_legal(role: str | None = None) -> None:
    """Загрузить актуальные тексты актов из реестра knowledge_base/legal/sources.json."""
    from app.knowledge.legal_sources import fetch_all

    with session_scope() as s:
        _print(fetch_all(s, role))


@kb_cli.command("search")
def kb_search(query: str, role: str = typer.Option(...)) -> None:
    from app.knowledge.store import search

    with session_scope() as s:
        _print([{**h.citation(), "score": round(h.score, 3), "text": h.text[:200]}
                for h in search(s, query, [role.upper()])])


# --------------------------------------------------------------------------- principals
@pr_cli.command("add")
def principals_add(pid: str, roles: str = typer.Option(..., help="через запятую"),
                   kind: str = typer.Option("human", help="human|service")) -> None:
    """Создать принципала и вывести API-ключ (один раз; хранится только хэш)."""
    rs = [r.strip().upper() for r in roles.split(",") if r.strip()]
    bad = [r for r in rs if r not in HUMAN_ROLES]
    if bad:
        raise typer.BadParameter(f"неизвестные роли {bad}; допустимы {sorted(HUMAN_ROLES)}")
    raw = secrets.token_urlsafe(24)
    with session_scope() as s:
        s.add(Principal(id=pid, kind=kind, roles=rs, api_key_hash=hash_key(raw)))
    _print({"id": pid, "roles": rs, "api_key": raw})


# --------------------------------------------------------------------------- audit / serve
@cli.command("audit")
def audit_show(project_id: str | None = None, limit: int = 100) -> None:
    with session_scope() as s:
        q = select(AuditLog).order_by(AuditLog.id.desc()).limit(limit)
        if project_id:
            q = q.where(AuditLog.project_id == project_id)
        _print([{"ts": r.timestamp, "actor": r.actor, "action": r.action, "entity": f"{r.entity_type}/{r.entity_id}",
                 "after": r.after} for r in s.execute(q).scalars()])


@cli.command("check-stale")
def check_stale_cmd() -> None:
    """Эскалировать к PM задачи, не движущиеся дольше HQ_TASK_STALE_MINUTES (запускать по расписанию)."""
    from app.orchestration.escalation import check_stale

    with session_scope() as s:
        _print([{"task_id": t.id, "title": t.title, "assignee": t.assignee_agent} for t in check_stale(s)])


@cli.command("serve")
def serve(host: str = "127.0.0.1", port: int = 8000) -> None:
    import uvicorn

    uvicorn.run("app.api.main:app", host=host, port=port)


def main() -> None:
    cli()


if __name__ == "__main__":
    main()
