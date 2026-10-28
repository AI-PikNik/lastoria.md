from __future__ import annotations

from typing import Any

from app.agents.base import AgentOutput, BaseAgent, Ctx, MissingData
from app.core.config import BASE_DIR
from app.core.models import Contract

TEMPLATES_DIR = BASE_DIR / "knowledge_base" / "legal" / "templates"

# Темы проверки → поисковый запрос по официальным текстам (ro/ru), юрисдикция
TOPICS: dict[str, dict[str, Any]] = {
    "services_contract": {
        "topic": "Договор оказания услуг: существенные условия, приёмка, ответственность",
        "query": "contract prestari servicii obligatii prestator beneficiar receptie",
        "basis": "Гражданский кодекс РМ — положения о договоре оказания услуг",
        "risks": ["неясный предмет/объём → споры о приёмке", "ограничение ответственности может быть недействительным"],
    },
    "work_contract": {
        "topic": "Договор подряда: этапы, приёмка, права на результат",
        "query": "contract antrepriza receptie lucrarii rezultat drept autor",
        "basis": "Гражданский кодекс РМ — подряд; законодательство об авторском праве",
        "risks": ["права на код не переданы явно", "приёмка по умолчанию не согласована"],
    },
    "personal_data": {
        "topic": "Обработка персональных данных по поручению (DPA)",
        "query": "date cu caracter personal operator persoana imputernicita prelucrare",
        "basis": "Действующий закон РМ о защите ПДн (проверить: №195/2024 вместо №133/2011)",
        "risks": ["неверная квалификация ролей оператор/обработчик", "трансграничная передача без основания"],
    },
    "e_signature": {
        "topic": "Электронный документ и электронная подпись",
        "query": "semnatura electronica document electronic servicii de incredere",
        "basis": "Закон РМ об электронной идентификации и доверительных услугах (номер подтвердить)",
        "risks": ["подпись неподходящего уровня не порождает нужной юридической силы"],
    },
    "gdpr_applicability": {
        "topic": "Применимость GDPR (ст. 3) к кейсу",
        "query": "territorial scope regulation applies processing personal data data subjects union",
        "basis": "Regulation (EU) 2016/679, Art. 3",
        "jurisdiction": "EU",
        "risks": ["предложение услуг субъектам в ЕС → GDPR применим экстерриториально"],
    },
}

TEMPLATE_TOPICS = {
    "it_services": ["services_contract", "e_signature"],
    "sla": ["services_contract"],
    "nda": ["services_contract"],
    "dpa": ["personal_data", "gdpr_applicability"],
    "contract_work": ["work_contract", "personal_data", "e_signature"],
}


class LegalAgent(BaseAgent):
    id = "LEGAL"
    title = "Юрист (право РМ)"
    result_contract = {"legal.contract_pack": ["contract_ids", "findings", "templates"]}

    def h_contract_pack(self, ctx: Ctx) -> AgentOutput:
        ctx.use("contract.draft")
        p = ctx.task.input_payload
        templates = list(p.get("templates") or [])
        if not templates:
            raise MissingData(["перечень документов (шаблонов)"])
        pd = p.get("processes_personal_data")
        if pd is None:
            ctx.ask("BDM", "Будет ли HQTeam обрабатывать ПДн по поручению клиента? От ответа зависит DPA",
                    "LEGAL_INPUT")
        elif pd and "dpa" not in templates:
            templates.append("dpa")
        if p.get("client_in_eu") is None and "dpa" in templates:
            ctx.ask("BDM", "Обслуживаются ли субъекты данных в ЕС? (применимость GDPR, ст. 3)", "LEGAL_INPUT")
        topics = list(dict.fromkeys(t for tpl in templates for t in TEMPLATE_TOPICS.get(tpl, [])))
        ctx.use("legal.sources")
        ctx.use("legal.cite")
        findings: list[dict[str, Any]] = []
        for key in topics:
            spec = TOPICS[key]
            finding = ctx.regulated(
                topic=spec["topic"], query=spec["query"], basis=spec["basis"],
                jurisdiction=spec.get("jurisdiction", "MD"),
                conclusion_if_sourced="Норма найдена в официальном источнике (фрагмент ниже). Интерпретация — "
                                      "проект, требует подтверждения юристом.",
                risks=spec["risks"], human_check=["Проверка формулировок живым юристом РМ"],
            )
            findings.append({"key": key, **finding.as_dict()})
        nv = [f for f in findings if f["status"] == "NEEDS_VERIFICATION"]
        for f in nv:
            ctx.ask("LEGAL_HUMAN", f"NEEDS_VERIFICATION: {f['topic']} — {f['conclusion']}", "NEEDS_VERIFICATION")
        contract_ids = []
        for tpl in templates:
            path = TEMPLATES_DIR / f"{tpl}.md"
            if not path.exists():
                raise MissingData([f"шаблон {tpl}"])
            body = path.read_text(encoding="utf-8")
            rel = [f for f in findings if f["key"] in TEMPLATE_TOPICS.get(tpl, [])]
            basis = "\n".join(
                f"| {f['topic']} | {f['basis']} | "
                f"{', '.join(s['url'] or '—' for s in f['sources']) or '—'} | {f['checked_at'] or '—'} | "
                f"{f['status']} | {f['conclusion']} | {'; '.join(f['risks'])} | {'; '.join(f['human_check'])} |"
                for f in rel)
            md = (f"{body}\n\n---\n## Правовые основания (LEGAL)\n"
                  "| Тема | Основание | Норма/источник | Дата проверки | Статус | Вывод | Риски | Проверить юристу |\n"
                  "|---|---|---|---|---|---|---|---|\n" + basis +
                  f"\n\n**Статус документа: DRAFT. Не готов к подписанию** (нет APPROVED_HUMAN).\n"
                  f"Клиент: {p.get('company', '—')}\n")
            art = ctx.artifact("contract_draft", f"contract_{tpl}_{p.get('lead_id') or 'project'}", md)
            c = ctx.add(Contract(project_id=ctx.task.project_id, template=tpl, artifact_id=art.id,
                                 legal_review={"findings": rel, "needs_verification": len(
                                     [f for f in rel if f['status'] == 'NEEDS_VERIFICATION'])}), "contracts")
            contract_ids.append(c.id)
        checklist = (BASE_DIR / "knowledge_base" / "legal" / "contract_checklist.md").read_text(encoding="utf-8")
        ctx.artifact("legal_checklist", f"legal_risks_{p.get('lead_id') or 'project'}",
                     checklist + "\n\n## Темы с NEEDS_VERIFICATION\n" +
                     ("\n".join(f"- {f['topic']}" for f in nv) or "—"))
        return AgentOutput(summary=f"Драфты: {', '.join(templates)}; NEEDS_VERIFICATION: {len(nv)}",
                           result={"contract_ids": contract_ids, "findings": findings, "templates": templates,
                                   "needs_verification": len(nv), "ready_to_sign": False},
                           needs_human=True, confidence="low" if nv else "medium")
