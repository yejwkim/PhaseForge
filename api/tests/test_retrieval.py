from collections.abc import Iterator
from types import SimpleNamespace
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.auth import AuthenticatedUser, get_current_user
from app.main import app
from app.services.retrieval import retrieve_top_chunks_for_material


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(autouse=True)
def clear_dependency_overrides() -> Iterator[None]:
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def override_current_user(user_id: str = "professor-123") -> None:
    async def fake_current_user() -> AuthenticatedUser:
        return AuthenticatedUser(
            id=user_id,
            role="authenticated",
            email="professor@example.com",
        )

    app.dependency_overrides[get_current_user] = fake_current_user


def test_retrieve_top_chunks_for_material_calls_match_rpc(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    material_id = uuid4()
    rpc_calls: list[tuple[str, dict[str, Any]]] = []
    response_data = [
        {
            "id": str(uuid4()),
            "material_id": str(material_id),
            "chunk_index": 0,
            "content": "Relevant chunk",
            "distance": 0.12,
        }
    ]

    class FakeRequestBuilder:
        def execute(self) -> SimpleNamespace:
            return SimpleNamespace(data=response_data)

    class FakeSupabase:
        def rpc(self, function_name: str, params: dict[str, Any]) -> FakeRequestBuilder:
            rpc_calls.append((function_name, params))
            return FakeRequestBuilder()

    monkeypatch.setattr(
        "app.services.retrieval.generate_embeddings",
        lambda texts: [[0.1, 0.2, 0.3]],
    )
    monkeypatch.setattr("app.services.retrieval.get_supabase_client", lambda: FakeSupabase())

    result = retrieve_top_chunks_for_material(material_id, "block header", top_k=3)

    assert result == response_data
    assert rpc_calls == [
        (
            "match_material_chunks_for_material",
            {
                "target_material_id": str(material_id),
                "query_embedding": [0.1, 0.2, 0.3],
                "match_count": 3,
            },
        )
    ]


def test_retrieve_top_chunks_for_material_returns_empty_list(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeRequestBuilder:
        def execute(self) -> SimpleNamespace:
            return SimpleNamespace(data=[])

    class FakeSupabase:
        def rpc(self, function_name: str, params: dict[str, Any]) -> FakeRequestBuilder:
            return FakeRequestBuilder()

    monkeypatch.setattr(
        "app.services.retrieval.generate_embeddings",
        lambda texts: [[0.1, 0.2, 0.3]],
    )
    monkeypatch.setattr("app.services.retrieval.get_supabase_client", lambda: FakeSupabase())

    result = retrieve_top_chunks_for_material(uuid4(), "unmatched topic", top_k=5)

    assert result == []


def test_debug_retrieve_requires_auth(client: TestClient) -> None:
    response = client.get(
        "/debug/retrieve",
        params={"material_id": str(uuid4()), "query": "block header", "top_k": 5},
    )

    assert response.status_code == 401


def test_debug_retrieve_returns_404_for_unowned_material(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    override_current_user(user_id="professor-123")
    monkeypatch.setattr("app.main.get_owned_material", lambda material_id, professor_id: None)

    response = client.get(
        "/debug/retrieve",
        params={"material_id": str(uuid4()), "query": "block header", "top_k": 5},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Material not found"}


def test_debug_retrieve_returns_chunks_for_owned_material(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    override_current_user(user_id="professor-123")
    material_id = uuid4()
    returned_chunks = [
        {
            "id": str(uuid4()),
            "material_id": str(material_id),
            "chunk_index": 7,
            "content": "mem_block_header_t stores block metadata",
            "distance": 0.62,
        }
    ]

    def fake_get_owned_material(material_id: UUID, professor_id: str) -> dict[str, str]:
        assert professor_id == "professor-123"
        return {
            "id": str(material_id),
            "course_id": str(uuid4()),
            "storage_path": "course/test.pdf",
            "filename": "test.pdf",
            "type": "notes",
        }

    def fake_retrieve_top_chunks_for_material(
        material_id: UUID,
        query: str,
        top_k: int,
    ) -> list[dict[str, Any]]:
        assert query == "block header"
        assert top_k == 5
        return returned_chunks

    monkeypatch.setattr("app.main.get_owned_material", fake_get_owned_material)
    monkeypatch.setattr(
        "app.main.retrieve_top_chunks_for_material",
        fake_retrieve_top_chunks_for_material,
    )

    response = client.get(
        "/debug/retrieve",
        params={"material_id": str(material_id), "query": "block header", "top_k": 5},
    )

    assert response.status_code == 200
    assert response.json() == {"chunks": returned_chunks}
