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

# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE 1: CONCEPT MIND MAP & KNOWLEDGE GRAPH VISUALIZER
# ═══════════════════════════════════════════════════════════════════════════════

from pydantic import BaseModel

class MindMapNode(BaseModel):
    id: str
    label: str
    category: str # "core", "concept", "formula", "application"
    description: str
    page_ref: Optional[int] = 1
    doc_ref: Optional[str] = "Document"

class MindMapEdge(BaseModel):
    source: str
    target: str
    relation: str

class MindMapResponse(BaseModel):
    course_id: str
    course_name: str
    nodes: List[MindMapNode]
    edges: List[MindMapEdge]
    concept_count: int

@router.post("/mindmap", response_model=MindMapResponse)
async def generate_course_mindmap(payload: Dict[str, Any]):
    """
    Generates a structured knowledge graph / mind map linking core concepts,
    formulas, and topics grounded in the ingested course materials.
    """
    course_id = payload.get("course_id")
    if not course_id:
        raise HTTPException(status_code=400, detail="Missing course_id")

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
        LIMIT 15
        """, (course_id,))
        chunks = [dict(r) for r in cursor.fetchall()]

    if not chunks:
        # Starter fallback node
        return MindMapResponse(
            course_id=course_id,
            course_name=course_name,
            nodes=[
                MindMapNode(id="n1", label=course_name, category="core", description="Course Root Knowledge Base", page_ref=1, doc_ref="Course Overview")
            ],
            edges=[],
            concept_count=1
        )

    # Offline Resilient Knowledge Graph Constructor
    # Extracts distinct concepts from section titles & key sentences
    nodes: List[MindMapNode] = []
    edges: List[MindMapEdge] = []
    seen_labels = set()

    # Root node
    root_id = "node_root"
    nodes.append(MindMapNode(
        id=root_id,
        label=course_name[:28],
        category="core",
        description=f"Primary foundational curriculum for {course_name}",
        page_ref=1,
        doc_ref=chunks[0].get("filename", "Course Syllabus")
    ))
    seen_labels.add(course_name[:28].lower())

    for idx, c in enumerate(chunks[:10]):
        sec = c.get("section_title", f"Concept {idx+1}")
        content = c.get("content", "")
        fname = c.get("filename", "Document")
        page = c.get("page_number", 1)

        # Clean section name
        clean_label = sec.replace("#", "").strip()
        if len(clean_label) > 26:
            clean_label = clean_label[:24] + ".."
        if clean_label.lower() in seen_labels or not clean_label:
            clean_label = f"Topic {idx+1}: {fname.split('.')[0][:12]}"

        seen_labels.add(clean_label.lower())
        node_id = f"node_{idx+1}"

        category = "concept"
        if "formula" in content.lower() or "=" in content or "attention" in content.lower():
            category = "formula"
        elif "quantization" in content.lower() or "inference" in content.lower() or "application" in content.lower():
            category = "application"

        nodes.append(MindMapNode(
            id=node_id,
            label=clean_label,
            category=category,
            description=content[:160] + "...",
            page_ref=page,
            doc_ref=fname
        ))

        # Edge to root
        edges.append(MindMapEdge(
            source=root_id,
            target=node_id,
            relation="covers" if idx % 2 == 0 else "teaches"
        ))

        # Cross edges between sequential concepts
        if idx > 0 and idx < len(chunks):
            prev_id = f"node_{idx}"
            rel_type = "prerequisite for" if idx % 2 == 0 else "optimizes"
            edges.append(MindMapEdge(
                source=prev_id,
                target=node_id,
                relation=rel_type
            ))

    return MindMapResponse(
        course_id=course_id,
        course_name=course_name,
        nodes=nodes,
        edges=edges,
        concept_count=len(nodes)
    )

# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE 2: EXAM READINESS & WEAKNESS DIAGNOSTIC
# ═══════════════════════════════════════════════════════════════════════════════

class QuizSubmitRequest(BaseModel):
    course_id: str
    topic: Optional[str] = "Comprehensive Exam Practice"
    total_questions: int
    correct_count: int
    answers_json: Optional[str] = "{}"

@router.post("/quiz/submit")
def submit_quiz_results(req: QuizSubmitRequest):
    """
    Records quiz attempt, computes score percentage, and logs into readiness tracker.
    """
    attempt_id = str(uuid.uuid4())
    pct = round((req.correct_count / req.total_questions) * 100, 1) if req.total_questions > 0 else 0
    now_iso = datetime.now().isoformat()

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO quiz_attempts (id, course_id, topic, total_questions, correct_count, score_percentage, answers_json, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (attempt_id, req.course_id, req.topic or "General", req.total_questions, req.correct_count, pct, req.answers_json or "{}", now_iso))
        conn.commit()

    return {
        "success": True,
        "attempt_id": attempt_id,
        "score_percentage": pct,
        "correct_count": req.correct_count,
        "total_questions": req.total_questions
    }

@router.get("/readiness/{course_id}")
def get_exam_readiness(course_id: str):
    """
    Evaluates exam readiness score (0-100%) and topic mastery heatmap based on quiz attempts.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT * FROM quiz_attempts
        WHERE course_id = ?
        ORDER BY timestamp DESC
        """, (course_id,))
        attempts = [dict(r) for r in cursor.fetchall()]

        cursor.execute("SELECT name FROM courses WHERE id = ?", (course_id,))
        course_row = cursor.fetchone()
        course_name = course_row["name"] if course_row else "Course"

    if not attempts:
        # Default baseline readiness before tests
        return {
            "course_id": course_id,
            "course_name": course_name,
            "readiness_score": 70.0,
            "readiness_status": "Ready for Initial Diagnostic",
            "total_attempts": 0,
            "total_questions_answered": 0,
            "topic_heatmap": [
                {"topic": "Foundations & Architecture", "mastery": 75, "status": "needs_review", "questions": 0},
                {"topic": "Formulas & Calculations", "mastery": 65, "status": "needs_review", "questions": 0},
                {"topic": "Inference & Optimization", "mastery": 70, "status": "needs_review", "questions": 0}
            ],
            "recommended_focus": [
                "Attempt a 5-question practice quiz to establish your baseline readiness.",
                "Review verified citations in Study Chat for scaled dot-product attention.",
                "Create a dual-pane study note summarizing model quantization."
            ]
        }

    total_q = sum(a["total_questions"] for a in attempts)
    total_correct = sum(a["correct_count"] for a in attempts)
    overall_readiness = round((total_correct / total_q) * 100, 1) if total_q > 0 else 0

    # Topic breakdown
    topics_map = {}
    for a in attempts:
        t = a["topic"]
        if t not in topics_map:
            topics_map[t] = {"correct": 0, "total": 0}
        topics_map[t]["correct"] += a["correct_count"]
        topics_map[t]["total"] += a["total_questions"]

    topic_heatmap = []
    weak_topics = []
    for t_name, data in topics_map.items():
        score = round((data["correct"] / data["total"]) * 100, 1) if data["total"] > 0 else 0
        status = "mastered" if score >= 80 else ("needs_review" if score >= 50 else "critical_gap")
        if score < 75:
            weak_topics.append(t_name)
        topic_heatmap.append({
            "topic": t_name,
            "mastery": score,
            "status": status,
            "questions": data["total"]
        })

    status_str = "High Exam Preparedness" if overall_readiness >= 80 else ("Moderate Preparation" if overall_readiness >= 60 else "Requires Priority Review")

    recommended = []
    if weak_topics:
        recommended.append(f"Focus revision on your lowest-scoring topic: '{weak_topics[0]}'.")
    else:
        recommended.append("Excellent mastery! Practice high-speed timed flashcards to maintain retention.")
    recommended.append("Check the Exam Revision Guide for formula proofs and key definitions.")
    recommended.append("Use hands-free voice drill with TARA to practice vocal articulation of concepts.")

    return {
        "course_id": course_id,
        "course_name": course_name,
        "readiness_score": overall_readiness,
        "readiness_status": status_str,
        "total_attempts": len(attempts),
        "total_questions_answered": total_q,
        "topic_heatmap": topic_heatmap,
        "recommended_focus": recommended
    }

# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE 3: FLASHCARD SPACED REPETITION (LEITNER BOX SYSTEM)
# ═══════════════════════════════════════════════════════════════════════════════

class FlashcardDrillRequest(BaseModel):
    course_id: str
    card_front: str
    card_back: str
    result: str # "got_it" | "need_review"

@router.post("/flashcards/drill")
def drill_flashcard(req: FlashcardDrillRequest):
    """
    Updates Leitner Box level: 'got_it' advances card towards Box 3 (Mastered),
    'need_review' resets to Box 1 (Learning).
    """
    now_iso = datetime.now().isoformat()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT id, box_level, review_count FROM flashcard_mastery
        WHERE course_id = ? AND card_front = ?
        """, (req.course_id, req.card_front.strip()))
        row = cursor.fetchone()

        if row:
            card_id = row["id"]
            curr_box = row["box_level"]
            new_box = min(3, curr_box + 1) if req.result == "got_it" else 1
            rev_count = row["review_count"] + 1

            cursor.execute("""
            UPDATE flashcard_mastery
            SET box_level = ?, review_count = ?, last_result = ?, updated_at = ?
            WHERE id = ?
            """, (new_box, rev_count, req.result, now_iso, card_id))
        else:
            card_id = str(uuid.uuid4())
            new_box = 2 if req.result == "got_it" else 1
            cursor.execute("""
            INSERT INTO flashcard_mastery (id, course_id, card_front, card_back, box_level, review_count, last_result, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, ?, ?)
            """, (card_id, req.course_id, req.card_front.strip(), req.card_back.strip(), new_box, req.result, now_iso))

        conn.commit()

    return {
        "success": True,
        "card_front": req.card_front,
        "box_level": new_box,
        "status": "Mastered (Box 3)" if new_box == 3 else ("Familiar (Box 2)" if new_box == 2 else "Learning (Box 1)")
    }

@router.get("/flashcards/mastery")
def get_flashcards_mastery(course_id: str):
    """
    Returns deck mastery statistics: Box 1 (Learning), Box 2 (Familiar), Box 3 (Mastered).
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT box_level, COUNT(*) as count
        FROM flashcard_mastery
        WHERE course_id = ?
        GROUP BY box_level
        """, (course_id,))
        rows = cursor.fetchall()

    box_counts = {1: 0, 2: 0, 3: 0}
    for r in rows:
        box_counts[r["box_level"]] = r["count"]

    total = sum(box_counts.values())
    mastery_pct = round(((box_counts[3] * 1.0 + box_counts[2] * 0.5) / total) * 100, 1) if total > 0 else 0

    return {
        "course_id": course_id,
        "total_drilled": total,
        "mastery_percentage": mastery_pct,
        "box_1_learning": box_counts[1],
        "box_2_familiar": box_counts[2],
        "box_3_mastered": box_counts[3]
    }

