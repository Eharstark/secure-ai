"""Small helpers shared by the authentication tests."""

from sqlalchemy import select

from app.models.user import User

STRONG_PASSWORD = "correct-Horse-battery-9"


def register(client, username: str, password: str = STRONG_PASSWORD):
    return client.post("/api/v1/auth/register", json={"username": username, "password": password})


def login_response(client, username: str, password: str = STRONG_PASSWORD):
    return client.post("/api/v1/auth/login", json={"username": username, "password": password})


def login(client, username: str, password: str = STRONG_PASSWORD) -> str:
    response = login_response(client, username, password)
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def session(client):
    return client.app.state.session_factory()


def get_user(client, username: str) -> User:
    with session(client) as db:
        return db.scalar(select(User).where(User.username == username))


def set_role(client, username: str, role: str) -> None:
    with session(client) as db:
        user = db.scalar(select(User).where(User.username == username))
        user.role = role
        db.commit()


def set_active(client, username: str, active: bool) -> None:
    with session(client) as db:
        user = db.scalar(select(User).where(User.username == username))
        user.is_active = active
        db.commit()


def create_key(client, headers, name: str = "ci", **extra):
    return client.post("/api/v1/api-keys", json={"name": name, **extra}, headers=headers)
