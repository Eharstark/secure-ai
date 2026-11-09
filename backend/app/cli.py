"""Administrative command line interface.

Usage:
    python -m app.cli create-admin USERNAME

The first administrator cannot be created through the public API (self-registration always
creates regular users). The password is read interactively and never appears in shell history,
process listings or logs.
"""

import argparse
import getpass
import sys

from pydantic import ValidationError

from app.core.config import get_settings
from app.db.session import build_engine, build_session_factory
from app.models.user import Role
from app.schemas.user import UserCreate
from app.services import users as user_service


def create_admin(username: str, password: str) -> int:
    """Create an administrator. Returns a process exit code."""
    try:
        data = UserCreate(username=username, password=password)  # reuse the API's validation rules
    except ValidationError as exc:
        for error in exc.errors():
            print(f"Invalid {'.'.join(str(p) for p in error['loc'])}: {error['msg']}", file=sys.stderr)
        return 2

    engine = build_engine(get_settings().database_url)
    try:
        with build_session_factory(engine)() as db:
            try:
                user = user_service.create_user(db, data.username, data.password, role=Role.ADMIN)
            except user_service.UsernameTakenError:
                print(f"User '{data.username}' already exists; nothing changed.", file=sys.stderr)
                return 1
            print(f"Administrator '{user.username}' created (id={user.id}).")
            return 0
    finally:
        engine.dispose()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description="SecureAI Gateway administration")
    sub = parser.add_subparsers(dest="command", required=True)
    admin = sub.add_parser("create-admin", help="Create an administrator account (prompts for the password)")
    admin.add_argument("username")
    args = parser.parse_args(argv)

    if args.command == "create-admin":
        password = getpass.getpass("Password: ")
        if password != getpass.getpass("Confirm password: "):
            print("Passwords do not match.", file=sys.stderr)
            return 2
        return create_admin(args.username, password)
    return 2  # pragma: no cover


if __name__ == "__main__":
    sys.exit(main())
