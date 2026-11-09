def test_allowed_origin_receives_cors_header(client):
    r = client.get("/api/v1/health", headers={"Origin": "http://localhost:3000"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_disallowed_origin_gets_no_cors_header(client):
    r = client.get("/api/v1/health", headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in r.headers


def test_cors_is_never_wildcard(client):
    r = client.get("/api/v1/health", headers={"Origin": "http://localhost:3000"})
    assert r.headers.get("access-control-allow-origin") != "*"


def test_preflight_allows_post_and_api_key_header(client):
    r = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization, x-api-key",
        },
    )
    assert r.status_code == 200
    assert "POST" in r.headers["access-control-allow-methods"]
    assert "x-api-key" in r.headers["access-control-allow-headers"].lower()
