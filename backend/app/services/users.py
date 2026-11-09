"""User management and credential verification."""

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import burn_password_check, hash_password, password_needs_rehash, verify_password
from app.db.types import utcnow
from app.models.user import Role, User


class UsernameTakenError(Exception):
    pass


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.scalar(select(User).where(User.username == username.strip().lower()))


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def create_user(db: Session, username: str, password: str, role: Role = Role.USER) -> User:
    user = User(username=username.strip().lower(), password_hash=hash_password(password), role=role)
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:  # unique constraint (also covers concurrent registrations)
        db.rollback()
        raise UsernameTakenError(username) from exc
    db.refresh(user)
    return user


def authenticate_user(db: Session, username: str, password: str) -> tuple[User | None, str]:
    """Verify credentials. Returns ``(user, "ok")`` or ``(None, reason)`` with reason in
    ``unknown_user`` | ``bad_password`` | ``inactive``. Callers must not reveal the reason to clients."""
    user = get_user_by_username(db, username)
    if user is None:
        burn_password_check(password)  # equalize timing so usernames cannot be enumerated
        return None, "unknown_user"
    if not verify_password(user.password_hash, password):
        return None, "bad_password"
    if not user.is_active:
        return None, "inactive"
    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
    user.last_login_at = utcnow()
    db.commit()
    return user, "ok"
