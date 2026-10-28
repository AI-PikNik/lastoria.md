"""Хранилище артефактов с версионированием и автором. Локально — artifacts/<project>/, опционально S3."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.config import get_settings
from app.core.models import Artifact
from app.core.security import check_tool


def _safe(name: str) -> str:
    return "".join(c if c.isalnum() or c in "-_." else "_" for c in name)


def write_artifact(
    db: Session,
    *,
    agent_id: str,
    project_id: str | None,
    task_id: str | None,
    type: str,
    name: str,
    content: str | dict[str, Any] | list[Any],
    ext: str = "md",
    meta: dict[str, Any] | None = None,
) -> Artifact:
    check_tool(agent_id, "artifact.write")
    body = content if isinstance(content, str) else json.dumps(content, ensure_ascii=False, indent=2, default=str)
    checksum = hashlib.sha256(body.encode()).hexdigest()
    prev = db.execute(
        select(func.max(Artifact.version)).where(Artifact.project_id == project_id, Artifact.name == name)
    ).scalar()
    latest = None
    if prev:
        latest = db.execute(
            select(Artifact).where(
                Artifact.project_id == project_id, Artifact.name == name, Artifact.version == prev
            )
        ).scalar_one()
        if latest.checksum == checksum:
            return latest  # идемпотентно: то же содержимое — новая версия не нужна
    version = (prev or 0) + 1
    s = get_settings()
    rel = Path(_safe(project_id or "_global")) / f"{_safe(name)}.v{version}.{ext}"
    if s.artifact_backend == "s3":  # pragma: no cover - требует облака
        import boto3

        boto3.client("s3").put_object(Bucket=s.s3_bucket, Key=str(rel), Body=body.encode())
        path = f"s3://{s.s3_bucket}/{rel}"
    else:
        full = Path(s.artifacts_dir) / rel
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_text(body, encoding="utf-8")
        path = str(rel)
    art = Artifact(
        project_id=project_id,
        task_id=task_id,
        agent_id=agent_id,
        type=type,
        name=name,
        path=path,
        version=version,
        checksum=checksum,
        meta=meta or {},
    )
    db.add(art)
    db.flush()
    audit(
        db,
        agent_id,
        "artifact.write",
        entity_type="artifact",
        entity_id=art.id,
        project_id=project_id,
        before={"version": latest.version} if latest else None,
        after={"name": name, "version": version, "checksum": checksum},
    )
    return art


def read_artifact(art: Artifact) -> str:
    s = get_settings()
    if art.path.startswith("s3://"):  # pragma: no cover
        import boto3

        key = art.path.split("/", 3)[3]
        return boto3.client("s3").get_object(Bucket=s.s3_bucket, Key=key)["Body"].read().decode()
    return (Path(s.artifacts_dir) / art.path).read_text(encoding="utf-8")
