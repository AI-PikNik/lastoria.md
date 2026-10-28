import json
from datetime import timedelta

import httpx
import pytest

from app.core.models import utcnow
from app.knowledge.citations import NEEDS_VERIFICATION, SOURCED, regulated_finding
from app.knowledge.legal_sources import LegalSource, fetch, load_registry
from app.knowledge.store import ingest, search
from app.tools.tax import vat_basis

# Тестовая фикстура — НЕ текст закона, только проверка механики цитирования
FIXTURE = ("TEST FIXTURE. Articolul X. Contract de prestari servicii: prestatorul se obliga sa presteze "
           "servicii, iar beneficiarul se obliga sa plateasca. Receptie servicii. ") * 5


def _finding(db, role="LEGAL", jurisdiction="MD"):
    return regulated_finding(db, topic="услуги", query="contract prestari servicii receptie", role=role,
                             basis="тест", conclusion_if_sourced="найдено", risks=[], human_check=[],
                             jurisdiction=jurisdiction)


def test_no_source_gives_needs_verification(seeded):
    f = _finding(seeded)
    assert f.status == NEEDS_VERIFICATION and "не найден" in f.conclusion
    assert any("fetch-legal" in h for h in f.human_check)


def test_internal_material_is_not_a_legal_source(db):
    ingest(db, role="LEGAL", title="наш шаблон", text=FIXTURE, source_url="kb://x", source_kind="template")
    assert _finding(db).status == NEEDS_VERIFICATION


def test_fresh_official_source_is_cited_with_url_and_date(db):
    ingest(db, role="LEGAL", title="Fixture act", text=FIXTURE, source_url="https://www.legis.md/fixture",
           source_kind="official", jurisdiction="MD", verified=True)
    f = _finding(db)
    assert f.status == SOURCED
    src = f.sources[0]
    assert src["url"] == "https://www.legis.md/fixture" and src["checked_at"] == utcnow().date().isoformat()
    assert f.as_dict()["checked_at"] and f.excerpt


def test_stale_source_older_than_90_days_needs_verification(db):
    ingest(db, role="LEGAL", title="Old act", text=FIXTURE, source_url="https://www.legis.md/old",
           source_kind="official", jurisdiction="MD", verified=True, fetched_at=utcnow() - timedelta(days=91))
    f = _finding(db)
    assert f.status == NEEDS_VERIFICATION and "устарел" in f.conclusion
    assert f.sources and f.sources[0]["stale"] is True


def test_wrong_jurisdiction_not_used(db):
    ingest(db, role="LEGAL", title="EU act", text=FIXTURE, source_url="https://eur-lex.europa.eu/x",
           source_kind="official", jurisdiction="EU", verified=True)
    assert _finding(db, jurisdiction="MD").status == NEEDS_VERIFICATION
    assert _finding(db, jurisdiction="EU").status == SOURCED


def test_chunks_carry_metadata(db):
    ingest(db, role="ARCH", title="doc", text="vSphere HA cluster\n\n" + "backup restore " * 200,
           source_url="https://docs.example/ha", source_kind="user", version_date="2026-01")
    hits = search(db, "backup restore", ["ARCH"])
    assert hits and hits[0].source_url == "https://docs.example/ha" and hits[0].version_date == "2026-01"


def test_registry_has_no_law_text_and_empty_urls_refused(db):
    reg = load_registry()
    keys = {s.key for s in reg}
    assert {"md_civil_code", "md_fiscal_code", "md_personal_data_195_2024", "eu_gdpr"} <= keys
    src = next(s for s in reg if s.key == "md_civil_code")
    with pytest.raises(ValueError, match="URL акта не задан"):
        fetch(db, src)


def test_fetch_only_from_allowlisted_hosts(db):
    with pytest.raises(ValueError, match="не в списке"):
        fetch(db, LegalSource("x", "LEGAL", "x", "https://random-blog.example/law", "MD", ""))


def test_fetch_ingests_official_with_check_date(db):
    html = "<html><body><h1>Fixture</h1><p>" + FIXTURE + "</p><script>x()</script></body></html>"
    transport = httpx.MockTransport(lambda req: httpx.Response(200, text=html,
                                                               headers={"content-type": "text/html"}))
    with httpx.Client(transport=transport) as c:
        doc = fetch(db, LegalSource("fx", "LEGAL", "Fixture", "https://www.legis.md/cautare/fx", "MD", ""),
                    client=c)
    assert doc.source_kind == "official" and doc.verified and doc.fetched_at.date() == utcnow().date()
    assert _finding(db).status == SOURCED


def test_vat_needs_source_and_human_confirmed_fact(db, tmp_path):
    assert vat_basis(db)["status"] == NEEDS_VERIFICATION
    doc = ingest(db, role="FIN", title="Fixture tax", text=("TEST FIXTURE TVA taxa pe valoarea adaugata cota "
                                                           "servicii livrare. ") * 10,
                 source_url="https://www.legis.md/fx-tax", source_kind="official", jurisdiction="MD", verified=True)
    facts = tmp_path / "facts.json"
    facts.write_text(json.dumps({"facts": []}))
    v = vat_basis(db, facts_path=facts)
    assert v["status"] == NEEDS_VERIFICATION and v["rate"] is None  # источник есть, ставку не подтвердил человек
    facts.write_text(json.dumps({"facts": [{"service_kind": "it_services", "rate": "0.99",
                                            "source_checksum": doc.checksum, "confirmed_by": "fin-human-test",
                                            "confirmed_at": utcnow().isoformat()}]}))
    v = vat_basis(db, facts_path=facts)
    assert v["status"] == SOURCED and v["rate"] == "0.99" and v["sources"][0]["url"].endswith("fx-tax")
