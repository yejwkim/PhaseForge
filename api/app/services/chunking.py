from pydantic import BaseModel
import re

DEFAULT_CHUNK_SIZE = 1000
DEFAULT_CHUNK_OVERLAP = 150
MIN_CHUNK_SIZE = 50
PAGE_MARKER_PATTERN = re.compile(r"\[Page (?P<page>\d+)\]\n?")

class TextChunk(BaseModel):
    chunk_index: int
    content: str
    page_start: int | None = None
    page_end: int | None = None

def split_text_by_pages(text: str) -> list[tuple[int | None, str]]:
    parts = PAGE_MARKER_PATTERN.split(text)
    
    if len(parts) == 1:
        return [(None, text.strip())] if text.strip() else []
    
    pages: list[tuple[int | None, str]] = []
    
    for index in range(1, len(parts), 2):
        page_number = int(parts[index])
        page_text = parts[index + 1].strip()
        
        if page_text:
            pages.append((page_number, page_text))
    
    return pages

def split_into_blocks(text: str) -> list[str]:
    blocks = re.split(r"\n\s*\n", text)
    cleaned_blocks = [block.strip() for block in blocks if block.strip()]
    
    if len(cleaned_blocks) <= 1:
        cleaned_blocks = [line.strip() for line in text.splitlines() if line.strip()]
    
    return cleaned_blocks

def chunk_blocks(blocks: list[str], chunk_size: int) -> list[str]:
    chunks: list[str] = []
    current_parts: list[str] = []
    current_size = 0
    
    for block in blocks:
        block_size = len(block)
        
        if current_parts and current_size + block_size + 1 > chunk_size:
            chunks.append("\n".join(current_parts).strip())
            current_parts = [block]
            current_size = block_size
        else:
            current_parts.append(block)
            current_size += block_size + 1
    
    if current_parts:
        chunks.append("\n".join(current_parts).strip())
    
    return chunks

def apply_overlap(chunks: list[str], overlap: int) -> list[str]:
    if overlap <= 0 or len(chunks) <= 1:
        return chunks
    
    overlapped: list[str] = [chunks[0]]
    
    for prev, cur in zip(chunks, chunks[1:]):
        overlap_text = prev[-overlap:].strip()
        if overlap_text:
            overlapped.append(f"{overlap_text}\n{cur}".strip())
        else:
            overlapped.append(cur)
    
    return overlapped

def clean_chunk_content(content: str) -> str:
    lines = [line.strip() for line in content.splitlines()]
    lines = [line for line in lines if line]
    return "\n".join(lines)

def filter_chunks(chunks: list[str], min_chunk_size: int) -> list[str]:
    cleaned = [clean_chunk_content(chunk) for chunk in chunks]
    return [chunk for chunk in cleaned if len(chunk) >= min_chunk_size]

def chunk_document_text(
    text: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    overlap: int = DEFAULT_CHUNK_OVERLAP,
    min_chunk_size: int = MIN_CHUNK_SIZE) -> list[TextChunk]:
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    
    if overlap < 0:
        raise ValueError("overlap cannot be negative")

    if overlap >= chunk_size:
        raise ValueError("overlap must be smaller than chunk_size")

    pages = split_text_by_pages(text)
    output_chunks: list[TextChunk] = []
    
    for page_num, page_text in pages:
        blocks = split_into_blocks(page_text)
        raw_chunks = chunk_blocks(blocks, chunk_size)
        raw_chunks = apply_overlap(raw_chunks, overlap)
        raw_chunks = filter_chunks(raw_chunks, min_chunk_size)
        
        for raw_chunk in raw_chunks:
            content = raw_chunk
            if page_num is not None:
                content = f"[Page {page_num}]\n{content}"
            output_chunks.append(
                TextChunk(
                    chunk_index=len(output_chunks),
                    content=content,
                    page_start=page_num,
                    page_end=page_num
                )
            )
    
    return output_chunks