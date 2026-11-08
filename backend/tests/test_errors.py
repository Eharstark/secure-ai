from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import make_settings


def test_unknown_route_returns_consistent_404(client):
    r = client.get("/does-not-exist")
    assert r.status_code == 404
    assert r.json() == {"error": "Not Found", "message": "Not Found"}


def test_unhandled_exception_returns_generic_500():
    app = create_app(make_settings())

    @app.get("/boom")
    def boom():
        raise RuntimeError("secret-internal-detail")

    with TestClient(app, raise_server_exceptions=False) as c:
        r = c.get("/boom")
    assert r.status_code == 500
    assert r.json() == {"error": "Internal Server Error", "message": "An internal error occurred."}
    assert "secret-internal-detail" not in r.text


def test_validation_error_shape_and_no_input_echo():
    app = create_app(make_settings())

    @app.get("/items/{item_id}")
    def item(item_id: int):
        return {"id": item_id}

    with TestClient(app) as c:
        r = c.get("/items/not-a-number")
    assert r.status_code == 422
    body = r.json()
    # RFC 9110 renamed 422 to "Unprocessable Content"; Python < 3.13 still says "Unprocessable Entity".
    assert body["error"] in {"Unprocessable Entity", "Unprocessable Content"}
    assert body["message"] == "Request validation failed."
    assert body["details"][0]["loc"] == ["path", "item_id"]
    assert "not-a-number" not in r.text
