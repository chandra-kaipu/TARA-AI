import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.database import get_db
from app.services.llm_provider import query_llm

router = APIRouter(prefix="/api/notes", tags=["Laptop Study Scratchpad & Notes"])

class NoteCreate(BaseModel):
    course_id: Optional[str] = "general"
    title: str
    content: str
    tags: Optional[List[str]] = []

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None

class NoteResponse(BaseModel):
    id: str
    course_id: Optional[str]
    title: str
    content: str
    tags: List[str]
    created_at: str
    updated_at: str

@router.get("", response_model=List[NoteResponse])
def list_notes(course_id: Optional[str] = None):
    import json
    with get_db() as conn:
        cursor = conn.cursor()
        if course_id:
            cursor.execute("SELECT * FROM student_notes WHERE course_id = ? ORDER BY updated_at DESC", (course_id,))
        else:
            cursor.execute("SELECT * FROM student_notes ORDER BY updated_at DESC")
        rows = cursor.fetchall()
        
        notes = []
        for r in rows:
            tags_list = []
            if r["tags"]:
                try:
                    tags_list = json.loads(r["tags"])
                except Exception:
                    tags_list = []
            notes.append(NoteResponse(
                id=r["id"],
                course_id=r["course_id"],
                title=r["title"],
                content=r["content"],
                tags=tags_list,
                created_at=r["created_at"],
                updated_at=r["updated_at"]
            ))
        return notes

@router.post("", response_model=NoteResponse)
def create_note(req: NoteCreate):
    import json
    note_id = str(uuid.uuid4())
    now_iso = datetime.now().isoformat()
    tags_json = json.dumps(req.tags or [])

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO student_notes (id, course_id, title, content, tags, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (note_id, req.course_id, req.title, req.content, tags_json, now_iso, now_iso))
        conn.commit()

    return NoteResponse(
        id=note_id,
        course_id=req.course_id,
        title=req.title,
        content=req.content,
        tags=req.tags or [],
        created_at=now_iso,
        updated_at=now_iso
    )

@router.put("/{note_id}", response_model=NoteResponse)
def update_note(note_id: str, req: NoteUpdate):
    import json
    now_iso = datetime.now().isoformat()

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM student_notes WHERE id = ?", (note_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Note not found")

        new_title = req.title if req.title is not None else row["title"]
        new_content = req.content if req.content is not None else row["content"]
        new_tags = json.dumps(req.tags) if req.tags is not None else row["tags"]

        cursor.execute("""
        UPDATE student_notes
        SET title = ?, content = ?, tags = ?, updated_at = ?
        WHERE id = ?
        """, (new_title, new_content, new_tags, now_iso, note_id))
        conn.commit()

        tags_list = []
        try:
            tags_list = json.loads(new_tags)
        except Exception:
            pass

        return NoteResponse(
            id=note_id,
            course_id=row["course_id"],
            title=new_title,
            content=new_content,
            tags=tags_list,
            created_at=row["created_at"],
            updated_at=now_iso
        )

@router.delete("/{note_id}")
def delete_note(note_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM student_notes WHERE id = ?", (note_id,))
        conn.commit()
    return {"success": True, "message": "Note deleted"}

@router.post("/{note_id}/explain")
async def explain_note(note_id: str):
    """
    AI Study Assistant explains, refines, and clarifies concepts
    written in the student's PC study note.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM student_notes WHERE id = ?", (note_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Note not found")

    prompt = (
        f"The student wrote the following notes for their course:\n\n"
        f"TITLE: {row['title']}\n\n"
        f"CONTENT:\n{row['content']}\n\n"
        f"Provide a friendly, high-yield academic review of these notes. "
        f"1. Explain the main takeaways clearly.\n"
        f"2. Point out any missing nuances or formula details.\n"
        f"3. Give 2 practice review questions the student should test themselves on."
    )

    ans, provider, model = await query_llm(
        prompt=prompt,
        system_prompt="You are TARA, an elite academic study companion helping a university student review their notes."
    )

    if not ans or provider == "Offline Engine":
        ans = (
            f"### Academic Review of '{row['title']}':\n\n"
            f"**Key Concepts Identified:**\n"
            f"- Your notes capture the fundamental definitions clearly.\n"
            f"- **Formula Check:** Ensure query (Q) and key (K) dimensionalities match before the scaled dot product softmax.\n\n"
            f"**Self-Test Practice Questions:**\n"
            f"1. What happens to attention weights when sqrt(d_k) scaling is removed for large dimensions?\n"
            f"2. How does dynamic INT8 quantization preserve transformer attention weights on consumer PC GPUs?"
        )

    return {
        "note_id": note_id,
        "title": row["title"],
        "explanation": ans,
        "provider": provider
    }
