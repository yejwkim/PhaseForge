from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest

from app.services.chunking import TextChunk
from app.services.materials import insert_material_chunks


def test_insert_material_chunks_rejects_length_mismatch() -> None:
    material_id = uuid4()
    chunks = [TextChunk(chunk_index=0, content="Chunk", page_start=1, page_end=1)]

    with pytest.raises(ValueError, match="Expected 1 embeddings, received 0"):
        insert_material_chunks(material_id, chunks, [])


def test_insert_material_chunks_skips_empty_chunks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_get_supabase_client() -> None:
        raise AssertionError("Supabase should not be called when there are no chunks")

    monkeypatch.setattr("app.services.materials.get_supabase_client", fail_get_supabase_client)

    insert_material_chunks(uuid4(), [], [])


def test_insert_material_chunks_inserts_rows_with_embeddings(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    material_id = uuid4()
    inserted_rows: list[Any] = []

    class FakeRequestBuilder:
        def insert(self, rows: Any) -> "FakeRequestBuilder":
            inserted_rows.append(rows)
            return self

        def execute(self) -> SimpleNamespace:
            return SimpleNamespace(data=None)

    class FakeSupabase:
        def table(self, table_name: str) -> FakeRequestBuilder:
            assert table_name == "material_chunks"
            return FakeRequestBuilder()

    monkeypatch.setattr("app.services.materials.get_supabase_client", lambda: FakeSupabase())

    chunks = [
        TextChunk(chunk_index=0, content="[Page 1]\nChunk one", page_start=1, page_end=1),
        TextChunk(chunk_index=1, content="[Page 2]\nChunk two", page_start=2, page_end=2),
    ]
    embeddings = [[0.1, 0.2], [0.3, 0.4]]

    insert_material_chunks(material_id, chunks, embeddings)

    assert inserted_rows == [
        [
            {
                "material_id": str(material_id),
                "chunk_index": 0,
                "content": "[Page 1]\nChunk one",
                "embedding": [0.1, 0.2],
            },
            {
                "material_id": str(material_id),
                "chunk_index": 1,
                "content": "[Page 2]\nChunk two",
                "embedding": [0.3, 0.4],
            },
        ]
    ]
