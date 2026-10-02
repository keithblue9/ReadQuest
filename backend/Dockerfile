# syntax=docker/dockerfile:1.7
# Image backend ReadQuest (FastAPI + scheduler + WebSocket). Build dari root repo:
#   docker build -t readquest-backend backend
# Jaringan dengan proxy TLS korporat: tambahkan --secret id=ca,src=/path/ca.crt (tidak masuk image).

FROM python:3.12-slim AS builder
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_NATIVE_TLS=1
WORKDIR /app
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export PIP_CERT=/run/secrets/ca; fi; \
    pip install --no-cache-dir uv==0.8.17
COPY pyproject.toml uv.lock ./
RUN --mount=type=secret,id=ca,required=false \
    --mount=type=cache,target=/root/.cache/uv \
    if [ -f /run/secrets/ca ]; then export SSL_CERT_FILE=/run/secrets/ca; fi; \
    uv sync --locked --no-dev --no-install-project

FROM python:3.12-slim AS runtime
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    APP_ENV=production \
    PORT=8000
RUN useradd --create-home --uid 10001 readquest
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY app ./app
USER readquest
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["python", "-c", "import os, urllib.request; urllib.request.urlopen(f\"http://127.0.0.1:{os.environ['PORT']}/health\", timeout=4)"]
# Soket dual-stack IPv4+IPv6 di $PORT (app/serve.py). IP klien diambil dari X-Forwarded-For hanya
# bila peer ada di FORWARDED_ALLOW_IPS (jaringan internal), sehingga rate limit per IP akurat.
CMD ["python", "-m", "app.serve"]
