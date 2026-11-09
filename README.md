# SecureAI Gateway

A security-first API gateway designed to sit between client applications and external AI services (such as Gnani AI).

- **Milestone 1:** Backend foundation — health checks, configuration, logging, error handling, and Docker.
- **Milestone 2:** Authentication and access control.
- **Milestone 3:** React-based security dashboard built on top of the Milestone 2 API.
- **Current hardening:** In-memory API rate limiting for authentication and API endpoints.

## Status: What Is and Is Not Implemented

### Implemented

- User registration and login using Argon2id password hashing and JWT access tokens.
- API key generation, listing, revocation, and authentication.
- SHA-256 API key digest storage — plaintext keys are returned only once.
- Role-based access control (`admin`, `user`) and protected admin endpoints.
- Admin account creation through the CLI.
- Configurable JWT settings and token expiry.
- Strong JWT secret validation at application startup.
- Authentication and authorization failure logging with sanitized, secret-free log entries.
- Per-IP in-memory rate limiting:
  - Login and registration: **10 requests per minute**.
  - Other API endpoints: **120 requests per minute**.
  - Excess requests receive HTTP `429 Too Many Requests` and a `Retry-After` header.
  - Rate-limit violations are sent to the security logger.
- Alembic database migration for users and API keys.
- Health endpoint, root endpoint, configurable API documentation, CORS allow-list, and consistent error handling.
- **React security dashboard:** login, registration, protected layout, account overview, API key management, and admin user management.

### Not Implemented Yet

- Distributed rate limiting and persistent login lockout. The current rate limiter uses in-memory tracking and is intended for a single application process.
- JWT revocation and refresh tokens. Issued tokens remain valid until expiry.
- Email verification, password reset, and multi-factor authentication (MFA).
- Gnani AI integration.
- Persistent security-event storage and a security-event retrieval API.
- AI request, usage, and traffic monitoring.

The dashboard's Rate Limits, Security Events, and AI Service sections are placeholders where backend data integration is not yet available.

## Project Structure

```text
secureai-gateway/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── cli.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   ├── security_logging.py
│   │   │   ├── rate_limit.py
│   │   │   ├── errors.py
│   │   │   └── logging.py
│   │   ├── api/
│   │   │   ├── deps.py
│   │   │   ├── root.py
│   │   │   └── v1/
│   │   │       ├── router.py
│   │   │       └── endpoints/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── db/
│   ├── alembic/
│   ├── tests/
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── context/
│   │   ├── components/
│   │   ├── pages/
│   │   └── lib/
│   ├── tests/
│   ├── scripts/
│   ├── package.json
│   ├── vite.config.js
│   └── .env.example
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

## API Overview

Base URL:

```text
http://127.0.0.1:8000/api/v1
```

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/` | Public | API identification |
| GET | `/api/v1/health` | Public | Application health |
| POST | `/api/v1/auth/register` | Public | Register a regular user |
| POST | `/api/v1/auth/login` | Public | Authenticate and receive JWT |
| GET | `/api/v1/users/me` | JWT or API key | Retrieve current user |
| GET | `/api/v1/api-keys` | JWT session | List own API keys |
| POST | `/api/v1/api-keys` | JWT session | Create an API key |
| DELETE | `/api/v1/api-keys/{id}` | JWT session | Revoke an API key |
| GET | `/api/v1/admin/users` | Admin JWT | List users |
| PATCH | `/api/v1/admin/users/{id}` | Admin JWT | Update user role or status |

### Authentication

Supported authentication methods:

```http
Authorization: Bearer <jwt>
```

or

```http
X-API-Key: <api_key>
```

A bearer token takes precedence when both credentials are supplied.

### HTTP Responses

- `200` — Successful request.
- `201` — Resource created.
- `204` — Resource successfully deleted or revoked.
- `401` — Missing, invalid, or expired credentials.
- `403` — Authenticated user does not have permission.
- `409` — Resource conflict, such as an existing username.
- `422` — Request validation error.
- `429` — Rate limit exceeded.

Login failures return the same generic `401` response whether the username is unknown, the password is incorrect, or the account is disabled.

## Rate Limiting

SecureAI Gateway implements custom ASGI middleware for per-IP request rate limiting.

| Endpoint category | Limit | Window |
|---|---:|---:|
| Login | 10 requests | 60 seconds |
| Registration | 10 requests | 60 seconds |
| Other API endpoints | 120 requests | 60 seconds |

When a client exceeds its limit, the gateway returns:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: application/json
```

Example response:

```json
{
  "detail": "Too many requests. Please try again later."
}
```

Rate-limit violations are also logged through the security logging system.

**Important limitations:**

- Rate-limit data is stored in memory.
- Counters reset when the application restarts.
- Limits are not shared across multiple workers or application instances.
- This implementation is not a distributed rate-limiting solution.

For multi-worker or production deployments, use a shared storage mechanism such as Redis.

## Frontend Dashboard

The frontend is built using:

- React 19
- Vite 8
- Tailwind CSS 4
- Axios
- React Router
- Recharts
- Lucide icons

The dashboard communicates with the documented FastAPI endpoints. It does not simulate backend functionality.

### Working Features

| Feature | Status |
|---|---|
| Login with validation and error handling | Working |
| User registration | Working |
| Protected routes and sidebar navigation | Working |
| Responsive dashboard layout | Working |
| Signed-in user information | Working |
| API reachability indicator | Working |
| API key creation, listing, and revocation | Working |
| One-time API key reveal and copy | Working |
| API key status and expiry charts | Working |
| Admin user management | Working |
| User search, role filtering, and pagination | Working |
| Session expiry and authentication error handling | Working |

### Dashboard Placeholders

| Feature | Status | Required backend work |
|---|---|---|
| Rate-limit monitoring | Placeholder | Monitoring API and stored metrics |
| Security events | Placeholder | Persistent event storage and retrieval API |
| AI service monitoring | Placeholder | Gnani AI integration and usage records |
| Traffic metrics | Placeholder | Request, failure, and latency recording |

Placeholders display empty states and do not use fabricated metrics.

## Frontend Prerequisites

Node.js **20.19+ or 22.12+** and npm are required for Vite 8.

Check your Node.js version:

```bash
node -v
npm -v
```

If Node.js is outdated, install a current Node.js 22 LTS version using nvm:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
exec $SHELL
nvm install 22
nvm use 22
```

## Run Backend and Frontend

### 1. Backend

From the project root:

```bash
cd backend
source .venv/bin/activate

alembic upgrade head

# Create an administrator if one does not already exist
python -m app.cli create-admin siteadmin

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend:

```text
http://127.0.0.1:8000
```

API documentation (development only):

```text
http://127.0.0.1:8000/docs
```

### 2. Frontend

Open a second terminal:

```bash
cd frontend

cp .env.example .env.local

npm install
npm run dev
```

Frontend:

```text
http://127.0.0.1:5173
```

### CORS Configuration

The frontend origin must be included in the backend's `CORS_ORIGINS` environment variable.

Example:

```env
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,http://localhost:3000,http://127.0.0.1:3000
```

`localhost` and `127.0.0.1` are different browser origins. Use the exact origin configured in the backend.

The CORS policy uses explicit origins, does not allow wildcard origins, and does not enable credentials.

Allowed methods:

```text
GET, POST, PATCH, DELETE
```

Allowed headers:

```text
Authorization, Content-Type, X-API-Key
```

Restart the backend after changing CORS configuration.

## Production Build

Build the frontend:

```bash
cd frontend

VITE_API_BASE_URL=https://api.example.com/api/v1 npm run build
```

Preview the production build locally:

```bash
npm run preview
```

The generated static files are stored in:

```text
frontend/dist/
```

Deploy the `dist/` directory to a static hosting provider with SPA fallback support and HTTPS.

Add the deployed frontend's exact HTTPS origin to the backend's `CORS_ORIGINS`.

**Security note:** Vite environment variables beginning with `VITE_` are included in the public frontend bundle. Never store passwords, API keys, JWT signing secrets, or other private backend credentials in them.

The dashboard is not currently included in `docker-compose.yml`.

## Frontend Tests

Run frontend unit tests:

```bash
cd frontend
npm test
```

The existing Vitest suite covers error mapping, validation, API key logic, session storage, and page behaviour. Page tests mock the API module and are UI tests, not backend integration tests.

### Live Integration Test

Start the backend first, then run:

```bash
SMOKE_ADMIN_USER=siteadmin SMOKE_ADMIN_PASSWORD='<admin password>' npm run smoke
```

The smoke test exercises the real API layer against a running backend.

It checks registration, validation, privilege-escalation rejection, login, authentication errors, API key creation/listing/revocation, API key authentication, and admin permissions.

**Run this only against a development database.** It creates temporary users and leaves some `smoke*` accounts in the database.

## Backend Tests

From the backend directory:

```bash
cd backend
source .venv/bin/activate

python -m pytest
```

To treat warnings as errors:

```bash
python -W error -m pytest
```

The existing backend test suite covers authentication, API key lifecycle, JWT validation, authorization, privilege escalation, database handling, logging, CLI behaviour, and migration/model consistency.

The rate-limiting middleware has also been manually exercised with repeated authentication requests. Add dedicated automated middleware tests before treating it as fully covered by the backend test suite.

## Frontend Security Model

### Token Storage

- JWT access tokens are stored in `sessionStorage`, not `localStorage`.
- The token is scoped to the browser tab and removed when the tab's session ends.
- The dashboard tracks the token's expiry.
- The application signs out when the token expires or an authenticated API request returns `401`.
- A page reload revalidates the session using `GET /users/me`.

### Residual XSS Risk

Any successful cross-site scripting vulnerability could potentially access a token stored in browser storage.

Mitigations include:

- React's standard output escaping.
- No `dangerouslySetInnerHTML`.
- No third-party scripts or fonts.
- No inline event handlers.
- `referrer: no-referrer`.
- Short-lived JWT access tokens.

When deploying, configure a strict Content Security Policy header on the static host. For example:

```text
default-src 'self'; connect-src 'self' <api-origin>
```

An HttpOnly and SameSite cookie-based session with CSRF protection is a possible future improvement, but requires backend changes.

### API Key Plaintext

- Plaintext API keys are shown only after creation.
- The frontend holds the key temporarily in React state.
- Keys are not stored in browser storage or logged.
- Copy the key before dismissing the creation banner.

### Server-Side Authorization

Hiding admin navigation and protecting admin pages in the frontend are usability features, not security boundaries.

The backend independently verifies roles and permissions.

API keys cannot be used to sign into the dashboard or perform session-only administrative actions.

## Known Dashboard Limitations

- Rate-limit enforcement exists, but there is no dashboard monitoring API or persistent rate-limit metrics.
- Security events are available through server logs; there is no event retrieval API yet.
- The Users page searches and paginates client-side because the backend does not currently provide server-side search or total counts.
- The Users page loads up to 5,000 users.
- API key and user lists do not receive live push updates; use Refresh.
- Logging out is client-side only. A copied JWT remains valid until it expires.
- Charts display only data exposed by the current API.

## Security Design

### Password Security

- Argon2id password hashing using `argon2-cffi`.
- Unique salts generated by the password-hashing library.
- Passwords are rehashed on login when hashing parameters change.
- Password policy: 12–128 characters.
- Passwords must not contain the username.
- Unknown-user login attempts still perform a hash computation to reduce timing-based username enumeration.

### JWT Security

- Supports HS256, HS384, and HS512 through an explicit algorithm allow-list.
- Rejects `alg: none` and algorithm-confusion attempts.
- Requires `exp`, `iat`, `sub`, and `iss` claims.
- Validates the configured issuer.
- Does not trust roles embedded in tokens.
- Loads user role and active status from the database on every authenticated request.

### JWT Secret Management

- No default signing secret is provided.
- Application startup fails if `JWT_SECRET_KEY` is missing, too short, or an obvious placeholder.
- The secret is held as a `SecretStr`.
- The secret is never logged or returned through the API.

Generate a strong secret:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

### API Key Security

API keys follow this format:

```text
sagw_<8-hex-prefix>_<43-character-secret>
```

Security controls:

- Generated using Python's `secrets` module.
- Contains 256 bits of random secret material.
- Only the SHA-256 digest is stored in the database.
- Constant-time comparison is used during verification.
- Plaintext keys are returned only in the creation response.
- Keys can expire or be revoked.
- Keys stop working when their owner is deactivated.
- Maximum of 10 active keys per user.
- API keys cannot create or revoke keys or call admin endpoints.

### Role-Based Access Control

- Public registration always creates a regular `user`.
- Registration rejects unexpected fields such as `role` and `is_active`.
- Administrators are created through the CLI or by an existing administrator.
- Admins can update other users' roles and active status.
- Administrators cannot modify their own account through the admin update endpoint.

### Security Logging

Security events are sent to the `secureai.security` logger.

Examples include:

```text
auth_failure
login_success
api_key_created
api_key_revoked
rate_limit_exceeded
```

Security logging follows these principles:

- Never log passwords.
- Never log JWTs.
- Never log complete API keys.
- Log only public API key prefixes where needed.
- Sanitize user-controlled values.
- Remove control characters and truncate logged values to reduce log-injection risk.
- Use the direct peer IP address; `X-Forwarded-For` is not trusted by default.

## Configuration

Create the environment file:

```bash
cp .env.example .env
```

Set at least `JWT_SECRET_KEY` before starting the backend.

| Variable | Description |
|---|---|
| `ENVIRONMENT` | `development`, `testing`, or `production` |
| `ENABLE_DOCS` | Controls `/docs`, `/redoc`, and `/openapi.json` |
| `LOG_LEVEL` | Logging level from `DEBUG` to `CRITICAL` |
| `CORS_ORIGINS` | Explicit allowed browser origins |
| `DATABASE_URL` | SQLAlchemy database URL |
| `JWT_SECRET_KEY` | Required JWT signing secret |
| `JWT_ALGORITHM` | JWT algorithm; default `HS256` |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | JWT expiry in minutes; default 30 |
| `JWT_ISSUER` | JWT issuer; default `secureai-gateway` |

Default database URL:

```env
DATABASE_URL=sqlite:///./data/secureai.db
```

Changing `JWT_SECRET_KEY` invalidates existing JWT access tokens. API keys are unaffected.

## Install and Run on Kali Linux

Install required packages:

```bash
sudo apt update
sudo apt install -y curl git
```

Create the project environment file:

```bash
cd secureai-gateway
cp .env.example .env
```

Generate a JWT secret:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

Paste the generated value into `.env`:

```env
JWT_SECRET_KEY=your_generated_secret
```

Create the Python virtual environment:

```bash
cd backend

python3 -m venv .venv
source .venv/bin/activate

pip install --only-binary=:all: -r requirements-dev.txt
```

Run migrations:

```bash
alembic upgrade head
```

Create an administrator:

```bash
python -m app.cli create-admin siteadmin
```

Start the backend:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Try It With cURL

Set the API base URL:

```bash
B=http://127.0.0.1:8000/api/v1
H='Content-Type: application/json'
```

### Register a User

```bash
curl -s -X POST "$B/auth/register" \
  -H "$H" \
  -d '{"username":"carol","password":"Zx9-Correct-Horse-Battery"}'
```

### Login

```bash
TOKEN=$(curl -s -X POST "$B/auth/login" \
  -H "$H" \
  -d '{"username":"carol","password":"Zx9-Correct-Horse-Battery"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
```

### Access the Current User

Without credentials:

```bash
curl -i "$B/users/me"
```

Expected: `401 Unauthorized`.

With JWT:

```bash
curl -s "$B/users/me" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: `200 OK`.

### Create an API Key

```bash
curl -s -X POST "$B/api-keys" \
  -H "$H" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"demo","expires_in_days":30}'
```

The plaintext `api_key` is shown only once.

Use it to authenticate:

```bash
curl -s "$B/users/me" \
  -H "X-API-Key: <paste-the-api-key>"
```

### Check Admin Permissions

A regular user cannot access admin endpoints:

```bash
curl -i "$B/admin/users" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: `403 Forbidden`.

Log in with the administrator account:

```bash
ADMIN=$(curl -s -X POST "$B/auth/login" \
  -H "$H" \
  -d '{"username":"siteadmin","password":"<admin-password>"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
```

Access the admin endpoint:

```bash
curl -s "$B/admin/users" \
  -H "Authorization: Bearer $ADMIN"
```

### Test Privilege Escalation Protection

Attempt to register with an admin role:

```bash
curl -i -X POST "$B/auth/register" \
  -H "$H" \
  -d '{"username":"eve","password":"Zx9-Correct-Horse-Battery","role":"admin"}'
```

Expected: `422 Unprocessable Entity`.

## Database Migrations

Apply migrations:

```bash
cd backend
alembic upgrade head
```

Roll back migrations:

```bash
alembic downgrade base
```

Generate a migration after changing database models:

```bash
alembic revision --autogenerate -m "describe change"
```

Always review autogenerated migrations before applying them.

## Docker

From the project root:

```bash
cp .env.example .env
nano .env
```

Set a valid `JWT_SECRET_KEY`.

Build and start the application:

```bash
sudo docker compose up --build -d
```

Check container status:

```bash
sudo docker compose ps
```

Create an administrator:

```bash
sudo docker compose exec api python -m app.cli create-admin siteadmin
```

Check application health:

```bash
curl -i http://127.0.0.1:8000/api/v1/health
```

View backend logs:

```bash
sudo docker compose logs -f api
```

Stop containers:

```bash
sudo docker compose down
```

To also delete the SQLite volume:

```bash
sudo docker compose down -v
```

The backend container runs as an unprivileged user with a read-only root filesystem. Only `/app/data`, a named volume, is writable.

## Deployment Notes and Limitations

- Deploy behind a TLS-terminating reverse proxy. Never transmit JWTs or API keys over plain HTTP.
- The built-in rate limiter is in-memory and single-process. For multiple workers or instances, use a shared rate-limiting store such as Redis.
- Configure trusted proxy handling carefully before relying on forwarded client IP addresses.
- Registration is open to anyone who can reach the API. Restrict network access until an onboarding policy is established.
- Registration reveals whether a username exists through `409`; login responses remain generic.
- SQLite is intended for development and small-scale testing. Use PostgreSQL for production deployments.
- Rotate `JWT_SECRET_KEY` immediately if it may have been exposed.
- Keep `.env` and all private credentials out of version control.
- The dashboard should be served over HTTPS with an appropriate Content Security Policy.
- The frontend is not currently included in the Docker Compose deployment.

## Future Improvements

- Redis-backed distributed rate limiting.
- Persistent security event storage and dashboard monitoring.
- Login lockout and additional authentication protections.
- JWT refresh and revocation mechanisms.
- Multi-factor authentication.
- Email verification and password reset.
- Gnani AI integration.
- AI request and usage analytics.
- Request traffic, latency, and failure monitoring.
- PostgreSQL production support.
- Automated security and middleware test coverage.

## Project Goal

SecureAI Gateway aims to provide a centralized security layer between client applications and external AI services, with authentication, API key management, role-based access control, rate limiting, and a security dashboard.

The long-term goal is to make AI service integrations more secure, manageable, and observable.
