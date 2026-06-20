from pathlib import Path

import pymupdf
import pytest

from app.services.parsing import clean_extracted_text, extract_pdf_text


def create_pdf(path: Path, page_texts: list[str]) -> None:
    doc = pymupdf.open()
    try:
        for text in page_texts:
            page = doc.new_page()
            if text:
                page.insert_text((72, 72), text)
        doc.save(path)
    finally:
        doc.close()


def test_clean_extracted_text_normalizes_line_endings_and_blank_lines() -> None:
    assert clean_extracted_text("  Alpha\r\n\r\n Beta \r Gamma  ") == "Alpha\nBeta\nGamma"


def test_extract_pdf_text_extracts_digital_text_with_page_markers(tmp_path: Path) -> None:
    pdf_path = tmp_path / "digital.pdf"
    create_pdf(
        pdf_path,
        [
            "First page has enough selectable text for retrieval extraction.",
            "Second page also has useful searchable course material text.",
        ],
    )

    parsed = extract_pdf_text(pdf_path)

    assert parsed.page_count == 2
    assert parsed.parser == "pymupdf"
    assert "[Page 1]" in parsed.text
    assert "First page has enough selectable text" in parsed.text
    assert "[Page 2]" in parsed.text
    assert "Second page also has useful searchable" in parsed.text


def test_extract_pdf_text_rejects_scanned_or_empty_pdf(tmp_path: Path) -> None:
    pdf_path = tmp_path / "empty.pdf"
    create_pdf(pdf_path, [""])

    with pytest.raises(ValueError, match="OCR fallback not implemented yet"):
        extract_pdf_text(pdf_path)


def test_extract_pdf_text_rejects_invalid_pdf(tmp_path: Path) -> None:
    pdf_path = tmp_path / "invalid.pdf"
    pdf_path.write_bytes(b"not a real pdf")

    with pytest.raises(ValueError, match="Failed to open"):
        extract_pdf_text(pdf_path)
