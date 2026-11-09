from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core import security
from app.core.security import TokenError, TokenExpiredError
from tests.conftest import TEST_JWT_SECRET, make_settings

PASSWORD = "correct-Horse-battery-9"


# ---- passwords ----------------------------------------------------------------------------

def test_password_hash_is_argon2id_and_not_plaintext():
    h = security.hash_password(PASSWORD)
    assert h.startswith("$argon2id$")
    assert PASSWORD not in h


def test_password_hash_is_salted():
    assert security.hash_password(PASSWORD) != security.hash_password(PASSWORD)


def test_verify_password_accepts_correct_and_rejects_wrong():
    h = security.hash_password(PASSWORD)
    assert security.verify_password(h, PASSWORD) is True
    assert security.verify_password(h, PASSWORD + "x") is False


def test_verify_password_rejects_garbage_hash():
    assert security.verify_password("not-a-hash", PASSWORD) is False


# ---- JWT ----------------------------------------------------------------------------------

def test_token_roundtrip_and_claims():
    s = make_settings(jwt_access_token_expire_minutes=15)
    token, expires_in = security.create_access_token("42", s)
    claims = security.decode_access_token(token, s)
    assert claims["sub"] == "42"
    assert claims["iss"] == "secureai-gateway"
    assert claims["exp"] - claims["iat"] == 15 * 60 == expires_in
    assert claims["jti"]


def test_tokens_have_unique_ids():
    s = make_settings()
    a = security.decode_access_token(security.create_access_token("1", s)[0], s)
    b = security.decode_access_token(security.create_access_token("1", s)[0], s)
    assert a["jti"] != b["jti"]


def test_expired_token_raises_expired():
    s = make_settings()
    token, _ = security.create_access_token("1", s, now=datetime.now(UTC) - timedelta(hours=2), expires_delta=timedelta(minutes=5))
    with pytest.raises(TokenExpiredError):
        security.decode_access_token(token, s)


def test_wrong_secret_is_rejected():
    s = make_settings()
    other = make_settings(jwt_secret_key="z" * 64)
    token, _ = security.create_access_token("1", other)
    with pytest.raises(TokenError) as exc:
        security.decode_access_token(token, s)
    assert exc.value.reason == "bad_signature"


def test_tampered_token_is_rejected():
    s = make_settings()
    token, _ = security.create_access_token("1", s)
    header, payload, sig = token.split(".")
    forged = jwt.encode({"sub": "2", "iss": s.jwt_issuer, "iat": 1, "exp": 9999999999}, "x" * 64, algorithm="HS256").split(".")[1]
    with pytest.raises(TokenError):
        security.decode_access_token(f"{header}.{forged}.{sig}", s)


def test_alg_none_token_is_rejected():
    s = make_settings()
    now = datetime.now(UTC)
    token = jwt.encode({"sub": "1", "iss": s.jwt_issuer, "iat": now, "exp": now + timedelta(minutes=5)}, key=None, algorithm="none")
    with pytest.raises(TokenError) as exc:
        security.decode_access_token(token, s)
    assert exc.value.reason == "bad_algorithm"


def test_other_hmac_algorithm_is_rejected():
    s = make_settings()
    now = datetime.now(UTC)
    token = jwt.encode(
        {"sub": "1", "iss": s.jwt_issuer, "iat": now, "exp": now + timedelta(minutes=5)}, TEST_JWT_SECRET, algorithm="HS512"
    )
    with pytest.raises(TokenError) as exc:
        security.decode_access_token(token, s)
    assert exc.value.reason == "bad_algorithm"


def test_wrong_issuer_is_rejected():
    s = make_settings()
    token, _ = security.create_access_token("1", make_settings(jwt_issuer="someone-else"))
    with pytest.raises(TokenError) as exc:
        security.decode_access_token(token, s)
    assert exc.value.reason == "invalid_claims"


@pytest.mark.parametrize("missing", ["exp", "iat", "sub", "iss"])
def test_missing_required_claim_is_rejected(missing):
    s = make_settings()
    now = datetime.now(UTC)
    claims = {"sub": "1", "iss": s.jwt_issuer, "iat": now, "exp": now + timedelta(minutes=5)}
    claims.pop(missing)
    token = jwt.encode(claims, TEST_JWT_SECRET, algorithm="HS256")
    with pytest.raises(TokenError):
        security.decode_access_token(token, s)


def test_garbage_token_is_rejected():
    with pytest.raises(TokenError) as exc:
        security.decode_access_token("definitely.not.ajwt", make_settings())
    assert exc.value.reason == "malformed_token"


# ---- API keys -----------------------------------------------------------------------------

def test_api_key_format_and_hash():
    key, prefix, digest = security.generate_api_key()
    assert key.startswith(f"sagw_{prefix}_")
    assert security.parse_api_key_prefix(key) == prefix
    assert digest == security.hash_api_key(key) and len(digest) == 64
    assert key not in digest and security.api_key_matches(key, digest)
    assert not security.api_key_matches(key + "x", digest)


def test_api_keys_are_unique_and_high_entropy():
    keys = {security.generate_api_key()[0] for _ in range(200)}
    assert len(keys) == 200
    assert all(len(k) == len("sagw_") + 8 + 1 + 43 for k in keys)


@pytest.mark.parametrize(
    "bad",
    ["", "sagw", "sagw_zzzzzzzz_" + "a" * 43, "sagw_12345678_short", "x_12345678_" + "a" * 43, "sagw_12345678_" + "a" * 43 + "\n", "a" * 5000],
)
def test_malformed_api_keys_have_no_prefix(bad):
    assert security.parse_api_key_prefix(bad) is None
