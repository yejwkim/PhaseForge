import pytest

from app.services.chunking import (
    apply_overlap,
    chunk_blocks,
    chunk_document_text,
    split_text_by_pages,
)


def test_split_text_by_pages_uses_page_markers() -> None:
    pages = split_text_by_pages("[Page 1]\nAlpha text\n\n[Page 2]\nBeta text")

    assert pages == [(1, "Alpha text"), (2, "Beta text")]


def test_split_text_by_pages_handles_text_without_markers() -> None:
    pages = split_text_by_pages("Standalone document text")

    assert pages == [(None, "Standalone document text")]


def test_chunk_blocks_groups_blocks_until_chunk_size_is_exceeded() -> None:
    blocks = ["alpha" * 10, "beta" * 10, "gamma" * 10]

    chunks = chunk_blocks(blocks, chunk_size=100)

    assert chunks == [
        "\n".join([blocks[0], blocks[1]]),
        blocks[2],
    ]


def test_chunk_blocks_keeps_oversized_block_as_its_own_chunk() -> None:
    oversized_block = "x" * 120

    chunks = chunk_blocks(["short", oversized_block], chunk_size=50)

    assert chunks == ["short", oversized_block]


def test_apply_overlap_adds_previous_chunk_tail_to_next_chunk() -> None:
    chunks = ["abcdefghij", "klmnopqrst"]

    overlapped = apply_overlap(chunks, overlap=4)

    assert overlapped == ["abcdefghij", "ghij\nklmnopqrst"]


def test_short_document_creates_one_page_aware_chunk() -> None:
    chunks = chunk_document_text(
        "[Page 1]\nThis is enough text to create one useful retrieval chunk.",
        chunk_size=1000,
        overlap=100,
        min_chunk_size=10,
    )

    assert len(chunks) == 1
    assert chunks[0].chunk_index == 0
    assert chunks[0].page_start == 1
    assert chunks[0].page_end == 1
    assert chunks[0].content.startswith("[Page 1]\n")


def test_long_page_creates_multiple_indexed_chunks() -> None:
    text = "[Page 1]\n" + "\n\n".join(
        f"Paragraph {index} " + ("x" * 100) for index in range(12)
    )

    chunks = chunk_document_text(text, chunk_size=350, overlap=50, min_chunk_size=10)

    assert len(chunks) > 1
    assert [chunk.chunk_index for chunk in chunks] == list(range(len(chunks)))
    assert all(chunk.page_start == 1 for chunk in chunks)


def test_multiple_pages_do_not_mix_page_numbers() -> None:
    text = (
        "[Page 1]\n"
        "First page has enough text to become a useful standalone chunk.\n\n"
        "[Page 2]\n"
        "Second page has enough text to become a useful standalone chunk."
    )

    chunks = chunk_document_text(text, chunk_size=1000, overlap=100, min_chunk_size=10)

    assert [chunk.page_start for chunk in chunks] == [1, 2]
    assert chunks[0].content.startswith("[Page 1]\n")
    assert chunks[1].content.startswith("[Page 2]\n")


def test_empty_text_returns_no_chunks() -> None:
    assert chunk_document_text("   ") == []


@pytest.mark.parametrize(
    ("chunk_size", "overlap", "expected_message"),
    [
        (0, 0, "chunk_size must be positive"),
        (100, -1, "overlap cannot be negative"),
        (100, 100, "overlap must be smaller than chunk_size"),
    ],
)
def test_chunk_document_text_validates_parameters(
    chunk_size: int,
    overlap: int,
    expected_message: str,
) -> None:
    with pytest.raises(ValueError, match=expected_message):
        chunk_document_text("Some text", chunk_size=chunk_size, overlap=overlap)
