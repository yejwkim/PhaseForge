from pydantic import BaseModel
from pathlib import Path
import pymupdf

class ParsedDocument(BaseModel):
    text: str
    page_count: int
    parser: str

def clean_extracted_text(text: str) -> str:
    lines = [line.strip() for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    non_empty_lines = [line for line in lines if line]
    return "\n".join(non_empty_lines)

def extract_pdf_text(file_path: Path) -> ParsedDocument:
    try:
        doc = pymupdf.open(file_path)
    except Exception as exc:
        raise ValueError(f"Failed to open file: {exc}") from exc
    
    try:
        page_texts: list[str] = []
        for page_index in range(doc.page_count):
            page = doc.load_page(page_index)
            raw_text = page.get_text("text")
            cleaned_text = clean_extracted_text(raw_text)
            
            if cleaned_text:
                page_texts.append(f"[Page {page_index + 1}]\n{cleaned_text}")
        full_text = "\n\n".join(page_texts).strip()
        page_count = doc.page_count
    finally:
        doc.close()
    
    if page_count > 0 and len(full_text) < 50:
        raise ValueError("PDF appears scanned or text is not extractable; OCR fallback not implemented yet")
    
    return ParsedDocument(text=full_text, page_count=page_count, parser="pymupdf")
