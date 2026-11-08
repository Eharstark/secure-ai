from datetime import datetime


def test_health_ok(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["version"] == "9.9.9-test"
    datetime.fromisoformat(body["timestamp"])  # valid ISO-8601


def test_health_only_exposes_expected_fields(client):
    body = client.get("/api/v1/health").json()
    assert set(body) == {"status", "version", "timestamp"}


def test_health_does_not_leak_infrastructure(client):
    text = client.get("/api/v1/health").text.lower()
    for forbidden in ("sqlite", "database", "environment", "password", "secret", "localhost"):
        assert forbidden not in text


def test_health_rejects_unsupported_method(client):
    response = client.post("/api/v1/health")
    assert response.status_code == 405
    assert response.json()["error"] == "Method Not Allowed"
