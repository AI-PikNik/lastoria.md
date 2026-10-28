FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY pyproject.toml ./
COPY app ./app
COPY db ./db
COPY scenarios ./scenarios
COPY knowledge_base ./knowledge_base
COPY alembic.ini ./
# editable: код и knowledge_base остаются в /app (BASE_DIR вычисляется от исходников)
RUN pip install --no-cache-dir -e ".[postgres]"
RUN useradd -m hq && mkdir -p /app/artifacts /app/outbox && chown -R hq /app
USER hq
EXPOSE 8000
CMD ["sh", "-c", "hqteam db upgrade && uvicorn app.api.main:app --host 0.0.0.0 --port 8000"]
