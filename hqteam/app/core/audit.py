from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.core.logging import log, mask_pii
from app.core.models import AuditLog


def audit(
    db: Session,
    actor: str,
    action: str,
    *,
    entity_type: str | None = None,
    entity_id: str | None = None,
    project_id: str | None = None,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
) -> AuditLog:
    """Пишет запись аудита. ПДн маскируются ещё до записи в БД."""
    row = AuditLog(
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        project_id=project_id,
        before=mask_pii(before) if before is not None else None,
        after=mask_pii(after) if after is not None else None,
    )
    db.add(row)
    db.flush()
    log.info("audit actor=%s action=%s entity=%s/%s", actor, action, entity_type, entity_id)
    return row
