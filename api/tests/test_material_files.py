from pathlib import Path
from types import SimpleNamespace

import pytest

from app.services.material_files import (
    download_material_file,
    validate_material_file_metadata,
    write_temp_material_file,
)


def test_validate_material_file_metadata_accepts_valid_pdf() -> None:
    validate_material_file_metadata(
        {
            "storage_path": "course/test.pdf",
            "filename": "test.pdf",
            "type": "notes",
        }
    )


@pytest.mark.parametrize(
    "material, expected_message",
    [
        ({"filename": "test.pdf", "type": "notes"}, "storage_path"),
        ({"storage_path": "course/test.pdf", "type": "notes"}, "filename"),
        (
            {"storage_path": "course/test.pdf", "filename": "test.pdf", "type": "other"},
            "Unsupported material type",
        ),
        (
            {"storage_path": "course/test.txt", "filename": "test.txt", "type": "notes"},
            "Unsupported material file type",
        ),
    ],
)
def test_validate_material_file_metadata_rejects_invalid_metadata(
    material: dict[str, str],
    expected_message: str,
) -> None:
    with pytest.raises(ValueError, match=expected_message):
        validate_material_file_metadata(material)


def test_write_temp_material_file_writes_pdf_and_returns_path() -> None:
    temp_path = write_temp_material_file(b"pdf bytes", "lecture.pdf")

    try:
        assert temp_path.exists()
        assert temp_path.suffix == ".pdf"
        assert temp_path.read_bytes() == b"pdf bytes"
        assert temp_path.parent != Path.cwd()
    finally:
        temp_path.unlink(missing_ok=True)


def test_write_temp_material_file_rejects_oversized_file(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.material_files.get_settings",
        lambda: SimpleNamespace(max_material_file_bytes=3),
    )

    with pytest.raises(ValueError, match="exceeds maximum"):
        write_temp_material_file(b"too large", "lecture.pdf")


def test_write_temp_material_file_rejects_unsupported_suffix() -> None:
    with pytest.raises(ValueError, match="Unsupported material file type"):
        write_temp_material_file(b"not pdf", "lecture.txt")


def test_download_material_file_uses_configured_bucket(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[str, str]] = []

    class FakeStorageBucket:
        def __init__(self, bucket_name: str) -> None:
            self.bucket_name = bucket_name

        def download(self, storage_path: str) -> bytes:
            calls.append((self.bucket_name, storage_path))
            return b"pdf bytes"

    class FakeStorage:
        def from_(self, bucket_name: str) -> FakeStorageBucket:
            return FakeStorageBucket(bucket_name)

    class FakeSupabase:
        storage = FakeStorage()

    monkeypatch.setattr(
        "app.services.material_files.get_settings",
        lambda: SimpleNamespace(supabase_storage_bucket="materials"),
    )
    monkeypatch.setattr("app.services.material_files.get_supabase_client", lambda: FakeSupabase())

    result = download_material_file("course/test.pdf")

    assert result == b"pdf bytes"
    assert calls == [("materials", "course/test.pdf")]
