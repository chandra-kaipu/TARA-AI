import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings, SCREENSHOT_DIR, UPLOAD_DIR
from app.database import init_db, get_db
from app.routers import (
    courses,
    study,
    agent,
    tools,
    settings as settings_router,
    dashboard,
    voice,
    analytics
)

# Initialize Database
init_db()

app = FastAPI(
    title="TARA — AI Study & Productivity Agent API (KPRIT Major Project)",
    description="High-performance backend for TARA voice agent, RAG course grounding, and desktop tool automation.",
    version="1.0.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow Vite dev server and local clients
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file mounts
app.mount("/api/screenshots", StaticFiles(directory=str(SCREENSHOT_DIR)), name="screenshots")
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Include API Routers
app.include_router(dashboard.router)
app.include_router(courses.router)
app.include_router(study.router)
app.include_router(agent.router)
app.include_router(tools.router)
app.include_router(settings_router.router)
app.include_router(voice.router)
app.include_router(analytics.router)


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "agent": "TARA",
        "version": "1.0.0",
        "wake_word": "TARA (/ˈtɑːrə/)",
        "active_provider": settings.DEFAULT_PROVIDER
    }

# Seed starter sample course and document if database has no courses
def seed_starter_course():
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM courses")
            count = cursor.fetchone()[0]
            if count == 0:
                import uuid
                from datetime import datetime
                from app.services.ingestion import process_document_file
                from app.services.vector_store import CourseVectorStore

                course_id = "sample-cs101"
                now = datetime.now().isoformat()
                cursor.execute("""
                INSERT INTO courses (id, name, code, description, color, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    course_id,
                    "CS 101: Artificial Intelligence & Machine Learning",
                    "CS-101",
                    "Core foundations of modern AI, neural networks, retrieval-augmented generation (RAG), and agentic systems.",
                    "#DA7756",
                    now,
                    now
                ))

                # Create sample course guide
                sample_file = UPLOAD_DIR / "cs101_syllabus_and_guide.md"
                sample_content = """# CS 101: Foundations of Artificial Intelligence & Retrieval Systems
Course Instructor: Dr. Katherine Vance | Term: Fall 2026 | Department of Computer Science

## Course Overview & Prerequisites
This course provides a rigorous, hands-on introduction to modern computational intelligence. Prerequisites include single-variable calculus, linear algebra, and basic proficiency in Python. Grading is weighted: 40% hands-on laboratory assignments, 25% midterm examination, 25% final project, and 10% classroom participation.

## Module 1: Vector Spaces and Dense Embeddings
Traditional symbolic retrieval models such as BM25 and TF-IDF rely on lexical surface matching, making them vulnerable to vocabulary mismatch and synonymy. Modern vector retrieval addresses this limitation by mapping discrete textual units (words, sentences, or paragraphs) into continuous multi-dimensional geometric spaces (typically 384 to 1536 dimensions). 
In dense vector spaces, semantically similar concepts cluster together. Distance metrics such as Cosine Similarity (the cosine of the angle between two unit-normalized vectors) and Inner Product are computed to measure relevance. High-dimensional vector indexing is accelerated using approximate nearest neighbor (ANN) graph algorithms, such as Hierarchical Navigable Small World (HNSW) and inverted file indexing (IVF-Flat) implemented in libraries like FAISS.

## Module 2: Retrieval-Augmented Generation (RAG) Architecture
Retrieval-Augmented Generation (RAG) combines dense semantic retrieval with parametric language models. Rather than relying solely on the static, potentially outdated parameters of a foundation model, a RAG pipeline dynamically fetches relevant context chunks from an external knowledge base and injects them into the prompt.
A standard RAG pipeline operates in three discrete stages:
1. Ingestion and Indexing: Source documents are parsed, stripped of formatting noise, and segmented into overlapping text chunks (typically 500 to 1000 characters with 10% to 20% overlap). Overlap preserves syntactic context across segment boundaries.
2. Retrieval: When a user query arrives, it is embedded using the same vector model, and the top-k most similar chunks are retrieved via vector search.
3. Grounded Synthesis: The retrieved chunks are assembled into a context prompt with explicit instructions requiring the model to cite sources and reject hallucination when information is absent.

## Module 3: Autonomous AI Agents and Tool Orchestration
An AI agent differs from a passive conversational model in its ability to perceive external environments and execute actions. Agents operate via a continuous perception-cognition-action loop:
1. Perception: Ingesting multimodal inputs including text, audio, and visual displays.
2. Cognition & Planning: Decomposing high-level goals into sequential sub-tasks.
3. Tool Execution: Generating structured function calls (e.g., JSON schemas) to trigger external APIs, database transactions, web search, or OS-level commands.
Crucially, production agent architectures enforce a Human-in-the-Loop (HITL) permission gate before executing privileged operations, such as modifying file systems, launching applications, or initiating web browsing sessions.

## Examination Policies and Office Hours
The midterm examination will take place during Week 7, covering Modules 1 through 3. All students are permitted one double-sided A4 handwritten reference sheet. Office hours are held Tuesdays and Thursdays from 2:00 PM to 4:00 PM in Alan Turing Hall, Room 304, or via the interactive study portal.
"""
                sample_file.write_text(sample_content, encoding="utf-8")
                
                doc_id = str(uuid.uuid4())
                page_count, chunks = process_document_file(sample_file)
                for c in chunks:
                    c["document_id"] = doc_id
                    c["course_id"] = course_id
                    c["filename"] = "cs101_syllabus_and_guide.md"

                cursor.execute("""
                INSERT INTO documents (id, course_id, filename, file_path, file_size, page_count, chunk_count, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', ?)
                """, (
                    doc_id, course_id, "cs101_syllabus_and_guide.md", str(sample_file), sample_file.stat().st_size, page_count, len(chunks), now
                ))

                for c in chunks:
                    cursor.execute("""
                    INSERT INTO document_chunks (id, document_id, course_id, chunk_index, page_number, section_title, content, char_count)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        c["id"], doc_id, course_id, c["chunk_index"], c["page_number"], c.get("section_title", ""), c["content"], c["char_count"]
                    ))

                conn.commit()
                CourseVectorStore.add_chunks(course_id, chunks)
                print("Seeded starter CS 101 course and guide document successfully.")
    except Exception as e:
        print(f"Starter course seeding notice: {e}")

# Run seed
seed_starter_course()
