# SecureAI Gateway

Security-first API gateway that will sit between client applications and external AI services (such as Gnani AI).
This repository currently contains **Task 1: the backend foundation only**.

## Status: what is and is not implemented

Implemented and tested:

- FastAPI application factory, environment-based configuration (Pydantic Settings)
- `GET /`, `GET /api/v1/health`, `GET /docs` (docs disabled automatically in production)
- Centralized logging and consistent JSON error responses (404/405/422/500)
- CORS with explicit origins only (wildcards rejected at startup; https required in production)
- SQLAlchemy + Alembic wiring (no tables yet), SQLite for development
- Pytest suite, hardened Dockerfile (non-root user, health check), Docker Compose

**Not implemented yet:** authentication, authorization, API keys, rate limiting, request validation for real
features, security event logging, usage monitoring, AI provider integration, infrastructure auditing, frontend.
Nothing in this project claims those controls exist.

## Structure

```
secureai-gateway/
├── backend/
│   ├── app/
│   │   ├── main.py                 # app factory + CORS + routers
│   │   ├── core/                   # config.py, logging.py, errors.py
│   │   ├── api/
│   │   │   ├── deps.py             # shared dependencies
│   │   │   ├── root.py             # GET /
│   │   │   └── v1/ (router.py, endpoints/health.py)
│   │   ├── models/                 # ORM models (empty for now)
│   │   ├── schemas/                # Pydantic schemas
│   │   ├── services/               # business logic (empty for now)
│   │   └── db/                     # base.py, session.py
│   ├── alembic/ + alembic.ini      # migrations
│   ├── tests/
│   ├── requirements.txt            # runtime deps
│   ├── requirements-dev.txt        # + pytest, httpx
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

Deviations from the suggested layout (and why):

- `core/errors.py` added: exception handling is centralized in one place.
- `api/root.py` and `api/deps.py` added: `GET /` lives outside the `/api/v1` prefix; dependencies are shared.
- `requirements-dev.txt` added: keeps pytest/httpx out of the production image.
- `alembic/` and `alembic.ini` added under `backend/`: migrations live next to the app.

## Architecture

- **Application factory** (`create_app(settings)`): all wiring happens in one function, so tests build isolated apps
  with their own settings and production is configured purely by environment.
- **Layers**: `api` (HTTP) -> `services` (logic, later) -> `db`/`models` (persistence). Schemas define every response.
- **Configuration**: `core/config.py` reads environment variables or a repository-root `.env`. Settings live in
  `app.state` and are never returned by any endpoint.
- **Database**: the engine is created lazily from `DATABASE_URL`; moving to PostgreSQL later is a URL change plus a
  driver dependency. Redis can later be added as another Compose service and a module under `services/`.
- **Errors**: all errors share `{"error", "message", "details?"}`; 500s log the traceback server-side and return a
  generic message; validation errors never echo submitted values.
- **Docker**: unprivileged UID 10001, loopback-only port binding, read-only root filesystem, all capabilities
  dropped, `no-new-privileges`, health check calling `/api/v1/health`.

## Configuration

Copy the template (the real `.env` is git-ignored; never commit it):

```bash
cp .env.example .env
```

| Variable | Meaning |
|---|---|
| `ENVIRONMENT` | `development`, `testing` or `production` |
| `ENABLE_DOCS` | Enables `/docs`, `/redoc`, `/openapi.json`. Always off when `ENVIRONMENT=production` |
| `LOG_LEVEL` | `DEBUG` to `CRITICAL` |
| `CORS_ORIGINS` | Comma-separated explicit origins. `*` is rejected; production requires `https://` |
| `DATABASE_URL` | SQLAlchemy URL (default `sqlite:///./data/secureai.db`) |

## Local setup on Kali Linux

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip curl git

cd secureai-gateway
cp .env.example .env

cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Developed and verified on Python 3.14 (`python3 --version`). Docker image: `python:3.14-slim`.

## Verify with curl

```bash
curl -i http://127.0.0.1:8000/
curl -i http://127.0.0.1:8000/api/v1/health
curl -i http://127.0.0.1:8000/does-not-exist                                       # consistent 404 JSON
curl -i -H "Origin: http://localhost:3000" http://127.0.0.1:8000/api/v1/health     # CORS header present
curl -i -H "Origin: http://evil.example"   http://127.0.0.1:8000/api/v1/health     # no CORS header
```

Open <http://127.0.0.1:8000/docs> for Swagger UI (development only).

Expected health response:

```json
{"status":"ok","version":"0.1.0","timestamp":"2026-01-01T12:00:00.000000Z"}
```

## Run the tests

```bash
cd backend
source .venv/bin/activate
python -m pytest
```

The tests ignore your real `.env` and environment, so results are reproducible.

## Database migrations

No models exist yet, so there is nothing to migrate. The tooling is ready:

```bash
cd backend
alembic upgrade head                              # no-op for now
alembic revision --autogenerate -m "add table"    # after adding models
```

## Run with Docker

```bash
sudo apt install -y docker.io docker-compose      # or the Compose v2 plugin, depending on your Kali repos
sudo systemctl enable --now docker

cd secureai-gateway
cp .env.example .env
sudo docker compose up --build -d                 # use `docker-compose` if you installed v1
sudo docker compose ps                            # STATUS should become "healthy"
curl -i http://127.0.0.1:8000/api/v1/health
sudo docker compose logs -f api
sudo docker compose down                          # add -v to also delete the SQLite volume
```

The port is published on `127.0.0.1` only. To simulate production, set `ENVIRONMENT=production` and
`CORS_ORIGINS=https://your-frontend.example` in `.env`; `/docs` will then return 404.

## Security notes

- Secrets belong in `.env` or a secret manager, never in code. `.env`, `*.db`, virtualenvs and caches are git-ignored.
- Root and health endpoints return no configuration, environment or infrastructure details (covered by tests).
- Serve behind TLS (reverse proxy) in any real deployment; this project does not terminate TLS.
- Until authentication and rate limiting exist (later tasks), do not expose this service to untrusted networks.
