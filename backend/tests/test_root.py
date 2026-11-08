def test_root_identifies_api(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {
        "name": "SecureAI Gateway",
        "message": "SecureAI Gateway API is running.",
    }


def test_root_exposes_no_configuration(client):
    text = client.get("/").text.lower()
    for forbidden in ("database", "sqlite", "cors", "secret", "environment"):
        assert forbidden not in text
