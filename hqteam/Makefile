PY ?= .venv/bin/python

.PHONY: install migrate seed scenarios demo test lint serve clean

install:
	python3.11 -m venv .venv && .venv/bin/pip install -e ".[dev]"

migrate:
	$(PY) -m app.cli db upgrade

seed:
	$(PY) -m app.cli db seed

# Одна команда: миграции + seed + оба сценария на синтетике (внешние действия остаются в очереди одобрений)
scenarios: migrate seed
	$(PY) -m app.cli scenarios run all

# То же, но с имитацией одобрения человеком и simulate-отправкой в outbox/
demo: migrate seed
	$(PY) -m app.cli scenarios run all --demo-approve

test:
	$(PY) -m pytest

lint:
	$(PY) -m ruff check . && $(PY) -m mypy app db scenarios

serve:
	$(PY) -m app.cli serve

clean:
	rm -rf artifacts outbox hqteam.db
