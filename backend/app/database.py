import sqlite3
import json
import uuid
from datetime import datetime
from typing import Any, Optional
from app.config import DB_PATH

def get_db():
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. Courses Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS courses (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            code TEXT,
            description TEXT,
            color TEXT DEFAULT '#DA7756',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """)

        # 2. Documents Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            course_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_size INTEGER DEFAULT 0,
            page_count INTEGER DEFAULT 0,
            chunk_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            error_message TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
        )
        """)

        # 3. Document Chunks Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS document_chunks (
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL,
            course_id TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            page_number INTEGER NOT NULL,
            section_title TEXT,
            content TEXT NOT NULL,
            char_count INTEGER NOT NULL,
            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
        )
        """)

        # 4. Study Messages (Course grounded chat + citations + feedback)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS study_messages (
            id TEXT PRIMARY KEY,
            course_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            citations TEXT DEFAULT '[]',
            feedback TEXT DEFAULT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
        )
        """)

        # 5. Agent Messages (General Assistant with memory)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS agent_messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            tool_call TEXT DEFAULT NULL,
            tool_result TEXT DEFAULT NULL,
            timestamp TEXT NOT NULL
        )
        """)

        # 6. Tool Permissions Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS tool_permissions (
            tool_name TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            auto_approve INTEGER DEFAULT 0,
            requires_confirmation INTEGER DEFAULT 1
        )
        """)

        # 7. Tool Execution Logs
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS tool_execution_logs (
            id TEXT PRIMARY KEY,
            tool_name TEXT NOT NULL,
            arguments TEXT NOT NULL,
            status TEXT NOT NULL,
            result TEXT,
            error TEXT,
            executed_at TEXT NOT NULL
        )
        """)

        # 8. User Settings Store
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        """)

        # 9. Study Sessions (Time Tracking for Students and Parents)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS study_sessions (
            id TEXT PRIMARY KEY,
            course_id TEXT,
            session_type TEXT NOT NULL,
            duration_minutes INTEGER NOT NULL,
            notes TEXT,
            timestamp TEXT NOT NULL
        )
        """)

        # 10. Student Laptop Scratchpad & Notes
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS student_notes (
            id TEXT PRIMARY KEY,
            course_id TEXT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            tags TEXT DEFAULT '[]',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """)

        # 11. Web Activity Logs (Parental Oversight & Safety Monitoring)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS web_activity_logs (
            id TEXT PRIMARY KEY,
            activity_type TEXT NOT NULL,
            query_or_url TEXT NOT NULL,
            summary TEXT,
            safety_flag TEXT DEFAULT 'safe',
            timestamp TEXT NOT NULL
        )
        """)

        # 12. Parental Settings (PIN Protection & Daily Time Limits)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS parental_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        """)

        # Seed default parental PIN if empty
        cursor.execute("SELECT COUNT(*) FROM parental_settings WHERE key = 'parent_pin'")
        if cursor.fetchone()[0] == 0:
            cursor.execute("INSERT INTO parental_settings (key, value) VALUES ('parent_pin', '1234')")
            cursor.execute("INSERT INTO parental_settings (key, value) VALUES ('daily_limit_minutes', '240')")

        # Seed initial study session sample if empty
        cursor.execute("SELECT COUNT(*) FROM study_sessions")
        if cursor.fetchone()[0] == 0:
            now_iso = datetime.now().isoformat()
            cursor.execute("""
            INSERT INTO study_sessions (id, course_id, session_type, duration_minutes, notes, timestamp)
            VALUES (?, 'sample-cs101', 'focus_timer', 25, 'Transformer Architecture & Attention Focus Session', ?)
            """, (str(uuid.uuid4()), now_iso))

        # Seed initial starter note
        cursor.execute("SELECT COUNT(*) FROM student_notes")
        if cursor.fetchone()[0] == 0:
            now_iso = datetime.now().isoformat()
            cursor.execute("""
            INSERT INTO student_notes (id, course_id, title, content, tags, created_at, updated_at)
            VALUES (?, 'sample-cs101', 'Lecture 1: Transformers & Quantization Notes', 
            '# Core Takeaways\n- Scaled dot-product attention computes queries, keys, and values.\n- Formula: Attention(Q, K, V) = softmax(Q * K^T / sqrt(d_k)) * V.\n- Quantization reduces FP32 to INT8/INT4 saving 75% memory on PC.',
            '[\"exam-prep\", \"ai\"]', ?, ?)
            """, (str(uuid.uuid4()), now_iso, now_iso))

        # Seed default tools if empty
        cursor.execute("SELECT COUNT(*) FROM tool_permissions")
        if cursor.fetchone()[0] == 0:
            default_tools = [
                ("open_url", "Open Browser URL", "Browser", "Opens a destination webpage in your default web browser.", 0, 1),
                ("web_search", "Search the Web", "Browser", "Queries search engines to retrieve live web results, snippets, and links.", 0, 1),
                ("extract_page_content", "Extract Web Page Content", "Browser", "Fetches clean readable text and article content from any given URL.", 0, 1),
                ("take_screenshot", "Capture Screen", "OS Action", "Takes an immediate full screenshot of your screen display.", 0, 1),
                ("open_application", "Launch OS Application", "OS Action", "Launches a desktop application or utility on your computer.", 0, 1),
                ("calculator", "Mathematical Solver", "Productivity", "Evaluates mathematical and statistical expressions.", 1, 0)
            ]
            cursor.executemany("""
            INSERT INTO tool_permissions (tool_name, display_name, category, description, auto_approve, requires_confirmation)
            VALUES (?, ?, ?, ?, ?, ?)
            """, default_tools)

        conn.commit()

# Run initialization at import
init_db()
