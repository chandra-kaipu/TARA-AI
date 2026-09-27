import re
import uuid
from pathlib import Path
from typing import List, Dict, Any
import fitz  # PyMuPDF

def extract_text_from_pdf(file_path: Path) -> List[Dict[str, Any]]:
    """Extracts text page-by-page from a PDF file."""
    pages = []
    doc = fitz.open(str(file_path))
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        text = page.get_text("text")
        clean_text = clean_extracted_text(text)
        if clean_text:
            pages.append({
                "page_number": page_num + 1,
                "text": clean_text
            })
    doc.close()
    return pages

def extract_text_from_txt(file_path: Path) -> List[Dict[str, Any]]:
    """Extracts text from a plain text or markdown file, simulating pages."""
    text = file_path.read_text(encoding="utf-8", errors="ignore")
    clean_text = clean_extracted_text(text)
    # Split into ~1500 char pages for consistent page referencing
    page_size = 1500
    pages = []
    if not clean_text:
        return []
    
    parts = [clean_text[i:i + page_size] for i in range(0, len(clean_text), page_size)]
    for idx, part in enumerate(parts):
        pages.append({
            "page_number": idx + 1,
            "text": part
        })
    return pages

def clean_extracted_text(text: str) -> str:
    """Normalizes whitespace and removes unreadable characters."""
    if not text:
        return ""
    # Normalize newline sequences
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # Collapse 3+ newlines to 2
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Remove null bytes or non-printable controls
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    return text.strip()

def chunk_text(
    pages: List[Dict[str, Any]],
    chunk_size: int = 700,
    chunk_overlap: int = 120
) -> List[Dict[str, Any]]:
    """
    Chunks page text with overlap while preserving exact page number and section headings.
    """
    chunks = []
    chunk_global_idx = 0

    for p in pages:
        page_num = p["page_number"]
        page_text = p["text"]
        
        # Split page text into sentences/paragraphs
        paragraphs = [para.strip() for para in page_text.split("\n\n") if para.strip()]
        
        current_chunk_words = []
        current_len = 0
        section_heading = f"Page {page_num}"

        for para in paragraphs:
            # Check if this paragraph looks like a title/heading (short, upper/title case)
            if len(para) < 80 and not para.endswith("."):
                section_heading = para

            words = para.split()
            for word in words:
                current_chunk_words.append(word)
                current_len += len(word) + 1

                if current_len >= chunk_size:
                    chunk_str = " ".join(current_chunk_words)
                    chunks.append({
                        "id": str(uuid.uuid4()),
                        "chunk_index": chunk_global_idx,
                        "page_number": page_num,
                        "section_title": section_heading,
                        "content": chunk_str,
                        "char_count": len(chunk_str)
                    })
                    chunk_global_idx += 1
                    
                    # Apply overlap by keeping last N words
                    overlap_words = int(chunk_overlap / 6)  # average word length ~6
                    current_chunk_words = current_chunk_words[-overlap_words:] if len(current_chunk_words) > overlap_words else []
                    current_len = sum(len(w) + 1 for w in current_chunk_words)

        if current_chunk_words:
            chunk_str = " ".join(current_chunk_words)
            if len(chunk_str) > 30:  # Ignore trivial trailing snippets
                chunks.append({
                    "id": str(uuid.uuid4()),
                    "chunk_index": chunk_global_idx,
                    "page_number": page_num,
                    "section_title": section_heading,
                    "content": chunk_str,
                    "char_count": len(chunk_str)
                })
                chunk_global_idx += 1

    return chunks

def process_document_file(file_path: Path) -> (int, List[Dict[str, Any]]):
    """
    Determines document format, extracts pages, chunks text, and returns (page_count, chunks).
    """
    suffix = file_path.suffix.lower()
    if suffix == ".pdf":
        pages = extract_text_from_pdf(file_path)
    elif suffix in [".txt", ".md", ".csv", ".json"]:
        pages = extract_text_from_txt(file_path)
    else:
        # Default try pdf then text
        try:
            pages = extract_text_from_pdf(file_path)
        except Exception:
            pages = extract_text_from_txt(file_path)

    page_count = len(pages)
    chunks = chunk_text(pages)
    return page_count, chunks
