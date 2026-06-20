from types import SimpleNamespace
from typing import Any, cast

import pytest

from app.services import embeddings


def test_batch_items_splits_input_into_fixed_size_batches() -> None:
    assert embeddings.batch_items(["a", "b", "c", "d", "e"], 2) == [
        ["a", "b"],
        ["c", "d"],
        ["e"],
    ]


def test_batch_items_rejects_non_positive_batch_size() -> None:
    with pytest.raises(ValueError, match="batch_size must be positive"):
        embeddings.batch_items(["a"], 0)


def test_validate_embeddings_accepts_matching_count_and_dimension() -> None:
    embeddings.validate_embeddings(["a", "b"], [[0.1, 0.2], [0.3, 0.4]], exp_dim=2)


def test_validate_embeddings_rejects_count_mismatch() -> None:
    with pytest.raises(ValueError, match="Expected 2 embeddings, received 1"):
        embeddings.validate_embeddings(["a", "b"], [[0.1, 0.2]], exp_dim=2)


def test_validate_embeddings_rejects_dimension_mismatch() -> None:
    with pytest.raises(ValueError, match="Embedding 1 has dimension 1, expected 2"):
        embeddings.validate_embeddings(["a", "b"], [[0.1, 0.2], [0.3]], exp_dim=2)


def test_generate_embeddings_returns_empty_list_without_openai_call(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_get_openai_client() -> None:
        raise AssertionError("OpenAI client should not be created for empty input")

    monkeypatch.setattr(embeddings, "get_openai_client", fail_get_openai_client)

    assert embeddings.generate_embeddings([]) == []


def test_embed_batch_with_retries_succeeds_after_transient_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    attempts: list[tuple[str, list[str]]] = []

    class FakeEmbeddingsResource:
        def create(self, model: str, input: list[str]) -> Any:
            attempts.append((model, input))
            if len(attempts) == 1:
                raise RuntimeError("temporary failure")
            return SimpleNamespace(
                data=[
                    SimpleNamespace(embedding=[0.1, 0.2]),
                    SimpleNamespace(embedding=[0.3, 0.4]),
                ]
            )

    class FakeClient:
        embeddings = FakeEmbeddingsResource()

    monkeypatch.setattr(embeddings, "sleep", lambda seconds: None)

    result = embeddings.embed_batch_with_retries(
        cast(Any, FakeClient()),
        ["chunk one", "chunk two"],
        "embedding-model",
        max_retries=2,
    )

    assert result == [[0.1, 0.2], [0.3, 0.4]]
    assert attempts == [
        ("embedding-model", ["chunk one", "chunk two"]),
        ("embedding-model", ["chunk one", "chunk two"]),
    ]


def test_embed_batch_with_retries_raises_after_permanent_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    attempts: list[int] = []

    class FakeEmbeddingsResource:
        def create(self, model: str, input: list[str]) -> Any:
            attempts.append(1)
            raise RuntimeError("permanent failure")

    class FakeClient:
        embeddings = FakeEmbeddingsResource()

    monkeypatch.setattr(embeddings, "sleep", lambda seconds: None)

    with pytest.raises(RuntimeError, match="Embedding request failed after retries"):
        embeddings.embed_batch_with_retries(
            cast(Any, FakeClient()),
            ["chunk one"],
            "embedding-model",
            max_retries=2,
        )

    assert len(attempts) == 3


def test_generate_embeddings_batches_requests_and_validates_results(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[list[str]] = []

    monkeypatch.setattr(
        embeddings,
        "get_settings",
        lambda: SimpleNamespace(
            embedding_batch_size=2,
            embedding_model="embedding-model",
            embedding_max_retries=1,
            embedding_dimension=2,
        ),
    )
    monkeypatch.setattr(embeddings, "get_openai_client", lambda: object())

    def fake_embed_batch_with_retries(
        client: object,
        batch: list[str],
        model: str,
        max_retries: int,
    ) -> list[list[float]]:
        calls.append(batch)
        assert model == "embedding-model"
        assert max_retries == 1
        return [[float(len(text)), float(index)] for index, text in enumerate(batch)]

    monkeypatch.setattr(embeddings, "embed_batch_with_retries", fake_embed_batch_with_retries)

    result = embeddings.generate_embeddings(["one", "two", "three"])

    assert calls == [["one", "two"], ["three"]]
    assert result == [[3.0, 0.0], [3.0, 1.0], [5.0, 0.0]]
