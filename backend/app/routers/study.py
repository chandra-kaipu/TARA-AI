import json
import uuid
import re
import random
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from app.database import get_db

logger = logging.getLogger(__name__)
from app.models.schema import (
    StudyQueryRequest,
    StudyQueryResponse,
    StudyMessageResponse,
    Citation,
    FeedbackRequest,
    QuizRequest,
    QuizResponse,
    QuizQuestion,
    Flashcard,
    FlashcardsResponse,
    SummaryRequest,
    SummaryResponse
)
from app.services.vector_store import CourseVectorStore
from app.services.llm_provider import (
    query_llm,
    extract_grounded_answer_from_chunks,
    STUDY_GROUNDED_SYSTEM_PROMPT
)

router = APIRouter(prefix="/api/study", tags=["Study Assistant"])

@router.post("/query", response_model=StudyQueryResponse)
async def query_course_study(req: StudyQueryRequest):
    course_id = req.course_id
    query_text = req.query.strip()
    if not query_text:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    # Verify course exists
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM courses WHERE id = ?", (course_id,))
        course_row = cursor.fetchone()
        if not course_row:
            raise HTTPException(status_code=404, detail="Course not found")
        course_name = course_row["name"]

    # 1. Retrieve top matching chunks from course's isolated index
    retrieved_chunks = CourseVectorStore.search(course_id, query_text, top_k=req.top_k or 4)

    # Format citations
    citations: List[Citation] = []
    for c in retrieved_chunks:
        citations.append(Citation(
            filename=c.get("filename", "Course Document"),
            page=c.get("page_number", 1),
            section=c.get("section_title", "Document Section"),
            snippet=c.get("content", "")[:320] + "...",
            relevance_score=c.get("relevance_score")
        ))

    # 2. Check if documents are ingested
    if not retrieved_chunks:
        answer_text = (
            f"I cannot find any relevant information for your question in '{course_name}'. "
            "As a strict course-grounded study assistant, I only answer from your uploaded course materials. "
            "Please ensure you have uploaded the syllabus, lecture notes, or textbook PDFs."
        )
        msg_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        with get_db() as conn:
            cursor = conn.cursor()
            # Save user message
            cursor.execute("""
            INSERT INTO study_messages (id, course_id, role, content, citations, timestamp)
            VALUES (?, ?, 'user', ?, '[]', ?)
            """, (str(uuid.uuid4()), course_id, query_text, now))
            # Save assistant message
            cursor.execute("""
            INSERT INTO study_messages (id, course_id, role, content, citations, timestamp)
            VALUES (?, ?, 'assistant', ?, '[]', ?)
            """, (msg_id, course_id, answer_text, now))
            conn.commit()

        return StudyQueryResponse(
            id=msg_id,
            answer=answer_text,
            citations=[],
            grounded=False,
            source_count=0,
            provider_used="TARA Guard",
            model_used="strict-grounding-filter"
        )

    # 3. Assemble Grounded Context Prompt
    context_blocks = []
    for idx, c in enumerate(retrieved_chunks):
        context_blocks.append(
            f"--- [SOURCE {idx+1}] File: {c.get('filename')}, Page: {c.get('page_number')}, Section: {c.get('section_title', 'General')} ---\n"
            f"{c.get('content')}"
        )
    formatted_context = "\n\n".join(context_blocks)

    full_prompt = (
        f"COURSE: {course_name}\n\n"
        f"GROUNDING CONTEXT FROM UPLOADED COURSE MATERIALS:\n"
        f"{formatted_context}\n\n"
        f"STUDENT QUESTION: {query_text}\n\n"
        f"Provide a clear, thorough, grounded explanation citing the sources."
    )

    # 4. Invoke LLM or Fallback Extractor
    llm_answer, provider_used, model_used = await query_llm(
        prompt=full_prompt,
        system_prompt=STUDY_GROUNDED_SYSTEM_PROMPT,
        provider=req.provider,
        model=req.model
    )

    grounded = True
    if not llm_answer or provider_used == "Offline Engine":
        fallback_res = extract_grounded_answer_from_chunks(query_text, retrieved_chunks)
        llm_answer = fallback_res["answer"]
        grounded = fallback_res["grounded"]
        provider_used = "Extractive Study Engine (Local)"
        model_used = "all-MiniLM-L6-v2"

    # 5. Persist into SQLite
    msg_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    citations_json = json.dumps([c.model_dump() for c in citations])

    with get_db() as conn:
        cursor = conn.cursor()
        # Save user message
        cursor.execute("""
        INSERT INTO study_messages (id, course_id, role, content, citations, timestamp)
        VALUES (?, ?, 'user', ?, '[]', ?)
        """, (str(uuid.uuid4()), course_id, query_text, now))
        # Save assistant message
        cursor.execute("""
        INSERT INTO study_messages (id, course_id, role, content, citations, timestamp)
        VALUES (?, ?, 'assistant', ?, ?, ?)
        """, (msg_id, course_id, llm_answer, citations_json, now))
        conn.commit()

    return StudyQueryResponse(
        id=msg_id,
        answer=llm_answer,
        citations=citations if grounded else [],
        grounded=grounded,
        source_count=len(retrieved_chunks),
        provider_used=provider_used,
        model_used=model_used
    )

@router.get("/{course_id}/messages", response_model=List[StudyMessageResponse])
def get_study_messages(course_id: str, limit: int = 50):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT * FROM study_messages
        WHERE course_id = ?
        ORDER BY timestamp ASC
        LIMIT ?
        """, (course_id, limit))
        rows = cursor.fetchall()
        
        results = []
        for r in rows:
            cits = []
            if r["citations"]:
                try:
                    cits_data = json.loads(r["citations"])
                    cits = [Citation(**c) for c in cits_data]
                except Exception:
                    cits = []
            results.append(StudyMessageResponse(
                id=r["id"],
                course_id=r["course_id"],
                role=r["role"],
                content=r["content"],
                citations=cits,
                feedback=r["feedback"],
                timestamp=r["timestamp"]
            ))
        return results

@router.post("/feedback")
def submit_feedback(req: FeedbackRequest):
    if req.feedback not in ["up", "down", "none"]:
        raise HTTPException(status_code=400, detail="Feedback must be 'up', 'down', or 'none'")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        UPDATE study_messages
        SET feedback = ?
        WHERE id = ?
        """, (req.feedback if req.feedback != "none" else None, req.message_id))
        conn.commit()

    return {"success": True, "message_id": req.message_id, "feedback": req.feedback}

@router.delete("/{course_id}/messages")
def clear_study_chat(course_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM study_messages WHERE course_id = ?", (course_id,))
        conn.commit()
    return {"message": "Chat history cleared"}

# ═══════════════════════════════════════════════════════════════
# INTERACTIVE EXAM PREPARATION & REVISION ENGINES
# ═══════════════════════════════════════════════════════════════

@router.post("/quiz", response_model=QuizResponse)
async def generate_quiz(req: QuizRequest):
    """
    Generates an interactive, grounded multiple-choice practice quiz
    directly from the course's ingested lecture notes and textbook PDFs.
    """
    course_id = req.course_id
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM courses WHERE id = ?", (course_id,))
        course_row = cursor.fetchone()
        if not course_row:
            raise HTTPException(status_code=404, detail="Course not found")
        course_name = course_row["name"]

        cursor.execute("""
        SELECT dc.*, d.filename FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE dc.course_id = ?
        ORDER BY dc.chunk_index ASC
        """, (course_id,))
        raw_chunks = cursor.fetchall()
        chunks = [dict(r) for r in raw_chunks]

    if not chunks:
        raise HTTPException(
            status_code=400,
            detail=f"No document chunks found for '{course_name}'. Please upload course PDFs first."
        )

    # Filter by topic if supplied
    if req.topic and req.topic.strip():
        search_res = CourseVectorStore.search(course_id, req.topic.strip(), top_k=6)
        if search_res:
            chunks = search_res

    # 1. Attempt LLM Generation if API Key Available
    llm_questions: List[QuizQuestion] = []
    try:
        context_snippets = "\n".join([
            f"[{c.get('filename')}, Page {c.get('page_number', 1)}]: {c.get('content', '')[:400]}"
            for c in chunks[:5]
        ])
        prompt = (
            f"Based STRICTLY on the following course lecture notes:\n{context_snippets}\n\n"
            f"Create {req.count} multiple-choice exam questions for students.\n"
            "Output ONLY a valid JSON array of objects. Do not include markdown codeblocks or conversational filler.\n"
            "Each object must have:\n"
            '  "question": string,\n'
            '  "options": array of 4 distinct strings,\n'
            '  "correct_index": integer from 0 to 3,\n'
            '  "explanation": concise explanation citing the fact,\n'
            '  "filename": source file name,\n'
            '  "page": source page number (integer)\n'
        )
        ans, provider, _ = await query_llm(
            prompt=prompt,
            system_prompt="You are an expert university professor creating an exam quiz strictly from course documents. Return ONLY a valid JSON array."
        )
        if ans and provider != "Offline Engine":
            clean_ans = re.search(r'\[[\s\S]*\]', ans)
            if clean_ans:
                raw_list = json.loads(clean_ans.group(0))
                for i, q in enumerate(raw_list):
                    if "question" in q and "options" in q and len(q["options"]) == 4:
                        llm_questions.append(QuizQuestion(
                            id=i + 1,
                            question=q["question"],
                            options=q["options"],
                            correct_index=int(q.get("correct_index", 0)),
                            explanation=q.get("explanation", "Grounded in course notes."),
                            citation={
                                "filename": q.get("filename", chunks[0].get("filename", "Course Document")),
                                "page": int(q.get("page", chunks[0].get("page_number", 1))),
                                "section": "Course Material"
                            }
                        ))
    except Exception as e:
        logger.warning(f"LLM quiz generation bypassed: {e}")

    if llm_questions:
        return QuizResponse(
            course_id=course_id,
            course_name=course_name,
            topic=req.topic or None,
            questions=llm_questions[:req.count]
        )

    # 2. Deterministic Grounded Offline Question Extractor
    # Extracts key facts, formulas, and definitions directly from the document chunks
    extracted_items = []
    for c in chunks:
        content = c.get("content", "")
        sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', content) if len(s.strip()) > 35]
        for s in sentences:
            extracted_items.append((
                s,
                c.get("filename", "Course Document"),
                c.get("page_number", 1),
                c.get("section_title", "Lecture Notes")
            ))

    keywords = [
        "formula", "mechanism", "attention", "quantization", "neural", "precision",
        "algorithm", "model", "objective", "weights", "linear", "loss", "dynamic",
        "layer", "transformer", "computes", "reduces", "minimizes", "shrink", "allows",
        "requires", "architecture", "dataset", "learning", "gradient"
    ]
    informative = [it for it in extracted_items if any(k in it[0].lower() for k in keywords)]
    if not informative:
        informative = extracted_items

    chosen = informative[:req.count]
    if len(chosen) < req.count and extracted_items:
        chosen = (chosen + extracted_items)[:req.count]

    questions: List[QuizQuestion] = []
    for idx, (sentence, fname, page, section) in enumerate(chosen):
        correct_option = sentence
        distractors = [
            f"It operates without linear projections and ignores long-range token dependencies.",
            f"It forces numerical precision up to FP64 requiring multi-GPU server clusters.",
            f"It was deprecated in modern architectures due to high perplexity degradation."
        ]
        
        all_options = [correct_option] + distractors
        random.seed(idx * 13 + 42)
        shuffled = list(all_options)
        random.shuffle(shuffled)
        c_idx = shuffled.index(correct_option)

        # Create informative question prompt
        if "formula is" in sentence.lower():
            q_text = f"According to {fname} (Page {page}), what formula is established for {section}?"
        elif "reduces" in sentence.lower() or "shrinking" in sentence.lower():
            q_text = f"Based on course notes in {fname} (Page {page}), how does the system optimize efficiency?"
        else:
            q_text = f"According to the ingested materials in {fname} (Page {page}), which statement is correct regarding {section}?"

        questions.append(QuizQuestion(
            id=idx + 1,
            question=q_text,
            options=shuffled,
            correct_index=c_idx,
            explanation=f"Directly verified from {fname}, Page {page} ({section}): '{sentence}'",
            citation={
                "filename": fname,
                "page": page,
                "section": section
            }
        ))

    return QuizResponse(
        course_id=course_id,
        course_name=course_name,
        topic=req.topic or None,
        questions=questions
    )

@router.post("/flashcards", response_model=FlashcardsResponse)
async def generate_flashcards(course_id: str, count: int = 6):
    """
    Generates interactive study flashcards (front: concept/question, back: verified answer + citation).
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM courses WHERE id = ?", (course_id,))
        course_row = cursor.fetchone()
        if not course_row:
            raise HTTPException(status_code=404, detail="Course not found")
        course_name = course_row["name"]

        cursor.execute("""
        SELECT dc.*, d.filename FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE dc.course_id = ?
        ORDER BY dc.chunk_index ASC
        """, (course_id,))
        chunks = [dict(r) for r in cursor.fetchall()]

    if not chunks:
        raise HTTPException(status_code=400, detail="No course documents found. Upload PDFs first.")

    flashcards: List[Flashcard] = []
    
    # Extract distinct concepts
    card_id = 1
    for c in chunks:
        content = c.get("content", "")
        section = c.get("section_title", "Core Concept")
        sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', content) if len(s.strip()) > 30]
        
        if sentences:
            front_text = section if section and section != "Document Section" else sentences[0][:60] + "..."
            back_text = " ".join(sentences[:2])
            
            flashcards.append(Flashcard(
                id=card_id,
                front=front_text,
                back=back_text,
                citation={
                    "filename": c.get("filename", "Course Doc"),
                    "page": c.get("page_number", 1),
                    "section": section
                }
            ))
            card_id += 1
            if len(flashcards) >= count:
                break

    return FlashcardsResponse(
        course_id=course_id,
        course_name=course_name,
        flashcards=flashcards
    )

@router.post("/summary", response_model=SummaryResponse)
async def generate_summary(req: SummaryRequest):
    """
    Generates a structured, high-yield exam cheat sheet / study guide
    derived strictly from the course's ingested documents with citations.
    """
    course_id = req.course_id
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name, code FROM courses WHERE id = ?", (course_id,))
        course_row = cursor.fetchone()
        if not course_row:
            raise HTTPException(status_code=404, detail="Course not found")
        course_name = course_row["name"]
        course_code = course_row["code"] or "CS 101"

        cursor.execute("""
        SELECT dc.*, d.filename FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE dc.course_id = ?
        ORDER BY dc.chunk_index ASC
        """, (course_id,))
        chunks = [dict(r) for r in cursor.fetchall()]

    if not chunks:
        raise HTTPException(status_code=400, detail="No course documents found. Upload PDFs first.")

    # Collect key concepts and citations
    key_concepts = []
    citations: List[Citation] = []
    summary_sections = []

    for c in chunks:
        fname = c.get("filename", "Document")
        page = c.get("page_number", 1)
        sec = c.get("section_title", "Core Material")
        content = c.get("content", "").strip()

        if sec and sec not in key_concepts and sec != "Document Section":
            key_concepts.append(sec)

        citations.append(Citation(
            filename=fname,
            page=page,
            section=sec,
            snippet=content[:240] + "..."
        ))

        summary_sections.append(
            f"### {sec} ({fname}, Page {page})\n\n"
            f"{content}\n"
        )

    full_summary = (
        f"# {course_name} ({course_code}) — Exam Revision Guide\n\n"
        f"> **Grounding Authority:** Extracted directly from {len(chunks)} verified document chunks across course materials.\n\n"
        f"## High-Yield Key Concepts\n"
        + "\n".join([f"- **{concept}**" for concept in key_concepts[:8]])
        + "\n\n## Detailed Study & Revision Notes\n\n"
        + "\n\n".join(summary_sections)
        + "\n\n---\n*Generated by TARA Course Grounded Study Engine (Lewis et al., NeurIPS 2020)*"
    )

    return SummaryResponse(
        course_id=course_id,
        course_name=course_name,
        summary_markdown=full_summary,
        key_concepts=key_concepts[:8],
        citations=citations[:6]
    )

