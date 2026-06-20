from collections.abc import Iterator
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.auth import AuthenticatedUser, get_current_user
from app.main import app
from app.services.chunking import TextChunk
from app.services.parsing import ParsedDocument


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


def post_ingest(client: TestClient, material_id: str) -> Any:
    return client.post("/ingest", json={"material_id": material_id})


def test_missing_auth_returns_401(client: TestClient) -> None:
    response = post_ingest(client, str(uuid4()))

    assert response.status_code == 401


def test_invalid_material_id_shape_returns_422(client: TestClient) -> None:
    override_current_user()

    response = post_ingest(client, "not-a-uuid")

    assert response.status_code == 422


def test_material_not_found_returns_404(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    override_current_user()
    monkeypatch.setattr("app.main.get_owned_material", lambda material_id, professor_id: None)

    response = post_ingest(client, str(uuid4()))

    assert response.status_code == 404
    assert response.json() == {"detail": "Material not found"}


def test_material_owned_by_another_professor_returns_404(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    override_current_user(user_id="professor-123")

    def fake_get_owned_material(material_id: UUID, professor_id: str) -> None:
        assert professor_id == "professor-123"
        return None

    monkeypatch.setattr("app.main.get_owned_material", fake_get_owned_material)

    response = post_ingest(client, str(uuid4()))

    assert response.status_code == 404
    assert response.json() == {"detail": "Material not found"}


def test_owned_material_returns_202(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    override_current_user(user_id="professor-123")
    material_id = uuid4()
    background_materials: list[UUID] = []

    def fake_get_owned_material(material_id: UUID, professor_id: str) -> dict[str, str]:
        assert professor_id == "professor-123"
        return {
            "id": str(material_id),
            "course_id": str(uuid4()),
            "storage_path": "course/test.pdf",
            "filename": "test.pdf",
            "type": "notes",
        }

    def fake_update_material_status(
        material_id: UUID,
        status: str,
        error_message: str | None = None,
    ) -> None:
        return None

    def fake_run_ingestion(material_id: UUID, material: dict[str, Any]) -> None:
        background_materials.append(material_id)

    monkeypatch.setattr("app.main.get_owned_material", fake_get_owned_material)
    monkeypatch.setattr("app.main.update_material_status", fake_update_material_status)
    monkeypatch.setattr("app.main.run_ingestion", fake_run_ingestion)

    response = post_ingest(client, str(material_id))

    assert response.status_code == 202
    assert response.json() == {
        "material_id": str(material_id),
        "status": "processing",
    }
    assert background_materials == [material_id]


def test_owned_material_updates_status_to_processing(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    override_current_user(user_id="professor-123")
    material_id = uuid4()
    status_updates: list[tuple[UUID, str, str | None]] = []

    def fake_get_owned_material(material_id: UUID, professor_id: str) -> dict[str, str]:
        return {
            "id": str(material_id),
            "course_id": str(uuid4()),
            "storage_path": "course/test.pdf",
            "filename": "test.pdf",
            "type": "notes",
        }

    def fake_update_material_status(
        material_id: UUID,
        status: str,
        error_message: str | None = None,
    ) -> None:
        status_updates.append((material_id, status, error_message))

    def fake_run_ingestion(material_id: UUID, material: dict[str, Any]) -> None:
        return None

    monkeypatch.setattr("app.main.get_owned_material", fake_get_owned_material)
    monkeypatch.setattr("app.main.update_material_status", fake_update_material_status)
    monkeypatch.setattr("app.main.run_ingestion", fake_run_ingestion)

    response = post_ingest(client, str(material_id))

    assert response.status_code == 202
    assert status_updates == [(material_id, "processing", None)]


def test_ingestion_marks_done_after_success(monkeypatch: pytest.MonkeyPatch) -> None:
    material_id = uuid4()
    material = {
        "id": str(material_id),
        "course_id": str(uuid4()),
        "storage_path": "course/test.pdf",
        "filename": "test.pdf",
        "type": "notes",
    }
    status_updates: list[tuple[UUID, str, str | None]] = []
    chunk_calls: list[tuple[str, UUID | list[TextChunk] | list[list[float]]]] = []

    monkeypatch.setattr("app.main.sleep", lambda seconds: None)
    monkeypatch.setattr("app.main.validate_material_file_metadata", lambda material: None)
    monkeypatch.setattr("app.main.download_material_file", lambda storage_path: b"pdf bytes")
    monkeypatch.setattr("app.main.write_temp_material_file", lambda file_bytes, filename: Path("test.pdf"))
    monkeypatch.setattr(
        "app.main.extract_pdf_text",
        lambda path: ParsedDocument(
            text="[Page 1]\nThis parsed document has enough text for chunking.",
            page_count=1,
            parser="pymupdf",
        ),
    )
    monkeypatch.setattr(
        "app.main.chunk_document_text",
        lambda text: [
            TextChunk(chunk_index=0, content="[Page 1]\nChunk one", page_start=1, page_end=1),
            TextChunk(chunk_index=1, content="[Page 1]\nChunk two", page_start=1, page_end=1),
        ],
    )

    def fake_delete_material_chunks(material_id: UUID) -> None:
        chunk_calls.append(("delete", material_id))

    def fake_generate_embeddings(texts: list[str]) -> list[list[float]]:
        assert texts == ["[Page 1]\nChunk one", "[Page 1]\nChunk two"]
        return [[0.1, 0.2], [0.3, 0.4]]

    def fake_insert_material_chunks(
        material_id: UUID,
        chunks: list[TextChunk],
        embeddings: list[list[float]],
    ) -> None:
        chunk_calls.append(("insert", chunks))
        chunk_calls.append(("embeddings", embeddings))

    monkeypatch.setattr("app.main.delete_material_chunks", fake_delete_material_chunks)
    monkeypatch.setattr("app.main.generate_embeddings", fake_generate_embeddings)
    monkeypatch.setattr("app.main.insert_material_chunks", fake_insert_material_chunks)

    def fake_update_material_status(
        material_id: UUID,
        status: str,
        error_message: str | None = None,
    ) -> None:
        status_updates.append((material_id, status, error_message))

    monkeypatch.setattr("app.main.update_material_status", fake_update_material_status)

    from app.main import run_ingestion

    run_ingestion(material_id, material)

    assert chunk_calls == [
        ("delete", material_id),
        (
            "insert",
            [
                TextChunk(chunk_index=0, content="[Page 1]\nChunk one", page_start=1, page_end=1),
                TextChunk(chunk_index=1, content="[Page 1]\nChunk two", page_start=1, page_end=1),
            ],
        ),
        ("embeddings", [[0.1, 0.2], [0.3, 0.4]]),
    ]
    assert status_updates == [(material_id, "done", None)]


def test_ingestion_marks_error_after_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    material_id = uuid4()
    material = {
        "id": str(material_id),
        "course_id": str(uuid4()),
        "storage_path": "course/test.pdf",
        "filename": "test.pdf",
        "type": "notes",
    }
    status_updates: list[tuple[UUID, str, str | None]] = []

    monkeypatch.setattr("app.main.sleep", lambda seconds: None)

    def fake_download_material_file(storage_path: str) -> bytes:
        raise RuntimeError("storage download failed")

    def fake_update_material_status(
        material_id: UUID,
        status: str,
        error_message: str | None = None,
    ) -> None:
        status_updates.append((material_id, status, error_message))

    monkeypatch.setattr("app.main.download_material_file", fake_download_material_file)
    monkeypatch.setattr("app.main.update_material_status", fake_update_material_status)

    from app.main import run_ingestion

    run_ingestion(material_id, material)

    assert status_updates == [(material_id, "error", "storage download failed")]


def test_ingestion_removes_temp_file(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    material_id = uuid4()
    material = {
        "id": str(material_id),
        "course_id": str(uuid4()),
        "storage_path": "course/test.pdf",
        "filename": "test.pdf",
        "type": "notes",
    }
    temp_file = tmp_path / "downloaded.pdf"

    monkeypatch.setattr("app.main.sleep", lambda seconds: None)
    monkeypatch.setattr("app.main.validate_material_file_metadata", lambda material: None)
    monkeypatch.setattr("app.main.download_material_file", lambda storage_path: b"pdf bytes")

    def fake_write_temp_material_file(file_bytes: bytes, filename: str) -> Path:
        temp_file.write_bytes(file_bytes)
        return temp_file

    monkeypatch.setattr("app.main.write_temp_material_file", fake_write_temp_material_file)
    monkeypatch.setattr(
        "app.main.extract_pdf_text",
        lambda path: ParsedDocument(text="parsed text", page_count=1, parser="pymupdf"),
    )
    monkeypatch.setattr(
        "app.main.chunk_document_text",
        lambda text: [
            TextChunk(chunk_index=0, content="[Page 1]\nChunk", page_start=1, page_end=1)
        ],
    )
    monkeypatch.setattr("app.main.generate_embeddings", lambda texts: [[0.1, 0.2]])
    monkeypatch.setattr("app.main.delete_material_chunks", lambda material_id: None)
    monkeypatch.setattr(
        "app.main.insert_material_chunks",
        lambda material_id, chunks, embeddings: None,
    )
    monkeypatch.setattr("app.main.update_material_status", lambda *args, **kwargs: None)

    from app.main import run_ingestion

    run_ingestion(material_id, material)

    assert not temp_file.exists()


def test_ingestion_marks_error_after_chunking_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    material_id = uuid4()
    material = {
        "id": str(material_id),
        "course_id": str(uuid4()),
        "storage_path": "course/test.pdf",
        "filename": "test.pdf",
        "type": "notes",
    }
    status_updates: list[tuple[UUID, str, str | None]] = []

    monkeypatch.setattr("app.main.sleep", lambda seconds: None)
    monkeypatch.setattr("app.main.validate_material_file_metadata", lambda material: None)
    monkeypatch.setattr("app.main.download_material_file", lambda storage_path: b"pdf bytes")
    monkeypatch.setattr("app.main.write_temp_material_file", lambda file_bytes, filename: Path("test.pdf"))
    monkeypatch.setattr(
        "app.main.extract_pdf_text",
        lambda path: ParsedDocument(
            text="[Page 1]\nThis parsed document has enough text for chunking.",
            page_count=1,
            parser="pymupdf",
        ),
    )

    def fake_chunk_document_text(text: str) -> list[TextChunk]:
        raise ValueError("chunking failed")

    def fake_update_material_status(
        material_id: UUID,
        status: str,
        error_message: str | None = None,
    ) -> None:
        status_updates.append((material_id, status, error_message))

    monkeypatch.setattr("app.main.chunk_document_text", fake_chunk_document_text)
    monkeypatch.setattr("app.main.update_material_status", fake_update_material_status)

    from app.main import run_ingestion

    run_ingestion(material_id, material)

    assert status_updates == [(material_id, "error", "chunking failed")]


def test_ingestion_marks_error_after_embedding_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    material_id = uuid4()
    material = {
        "id": str(material_id),
        "course_id": str(uuid4()),
        "storage_path": "course/test.pdf",
        "filename": "test.pdf",
        "type": "notes",
    }
    status_updates: list[tuple[UUID, str, str | None]] = []

    monkeypatch.setattr("app.main.sleep", lambda seconds: None)
    monkeypatch.setattr("app.main.validate_material_file_metadata", lambda material: None)
    monkeypatch.setattr("app.main.download_material_file", lambda storage_path: b"pdf bytes")
    monkeypatch.setattr("app.main.write_temp_material_file", lambda file_bytes, filename: Path("test.pdf"))
    monkeypatch.setattr(
        "app.main.extract_pdf_text",
        lambda path: ParsedDocument(
            text="[Page 1]\nThis parsed document has enough text for chunking.",
            page_count=1,
            parser="pymupdf",
        ),
    )
    monkeypatch.setattr(
        "app.main.chunk_document_text",
        lambda text: [
            TextChunk(chunk_index=0, content="[Page 1]\nChunk", page_start=1, page_end=1)
        ],
    )

    def fake_generate_embeddings(texts: list[str]) -> list[list[float]]:
        raise RuntimeError("embedding failed")

    def fake_update_material_status(
        material_id: UUID,
        status: str,
        error_message: str | None = None,
    ) -> None:
        status_updates.append((material_id, status, error_message))

    monkeypatch.setattr("app.main.generate_embeddings", fake_generate_embeddings)
    monkeypatch.setattr("app.main.update_material_status", fake_update_material_status)

    from app.main import run_ingestion

    run_ingestion(material_id, material)

    assert status_updates == [(material_id, "error", "embedding failed")]
