import pytest
from fastapi.testclient import TestClient
from jwt import ExpiredSignatureError, InvalidTokenError
from app.main import app

client = TestClient(app)

def test_missing_authorization_header_returns_401() -> None:
    response = client.get("/debug/me")
    assert response.status_code == 401

@pytest.mark.parametrize("authorization", ["Bearer", "Bearer ", "not-a-bearer-token"])
def test_malformed_authorization_header_returns_401(authorization: str) -> None:
    response = client.get("/debug/me", headers={"Authorization": authorization})
    assert response.status_code == 401

def test_wrong_authorization_scheme_returns_401() -> None:
    response = client.get("/debug/me", headers={"Authorization": "Basic token"})
    assert response.status_code == 401

def test_valid_decoded_claims_returns_authenticated_user(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_decode_supabase_jwt(token: str) -> dict[str, str]:
        assert token == "valid-token"
        return {
            "sub": "professor-123",
            "role": "authenticated",
            "email": "professor@example.com",
        }

    monkeypatch.setattr("app.core.auth.decode_supabase_jwt", fake_decode_supabase_jwt)
    response = client.get("/debug/me", headers={"Authorization": "Bearer valid-token"})
    assert response.status_code == 200
    assert response.json() == {
        "id": "professor-123",
        "email": "professor@example.com",
        "role": "authenticated",
    }

@pytest.mark.parametrize("jwt_error", [ExpiredSignatureError, InvalidTokenError])
def test_expired_or_invalid_jwt_returns_401(
    monkeypatch: pytest.MonkeyPatch,
    jwt_error: type[Exception],
) -> None:
    def fake_decode_supabase_jwt(token: str) -> dict[str, str]:
        raise jwt_error()

    monkeypatch.setattr("app.core.auth.decode_supabase_jwt", fake_decode_supabase_jwt)

    response = client.get("/debug/me", headers={"Authorization": "Bearer invalid-token"})

    assert response.status_code == 401
