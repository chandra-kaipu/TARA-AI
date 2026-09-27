import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.database import get_db

class AgentMemory:
    """Manages persistent conversational memory for the General Agent."""

    @staticmethod
    def add_message(
        session_id: str,
        role: str,
        content: str,
        tool_call: Optional[Dict[str, Any]] = None,
        tool_result: Optional[Dict[str, Any]] = None
    ) -> str:
        msg_id = str(uuid.uuid4())
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO agent_messages (id, session_id, role, content, tool_call, tool_result, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                msg_id,
                session_id,
                role,
                content,
                json.dumps(tool_call) if tool_call else None,
                json.dumps(tool_result) if tool_result else None,
                datetime.now().isoformat()
            ))
            conn.commit()
        return msg_id

    @staticmethod
    def get_history(session_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT id, session_id, role, content, tool_call, tool_result, timestamp
            FROM agent_messages
            WHERE session_id = ?
            ORDER BY timestamp ASC
            LIMIT ?
            """, (session_id, limit))
            rows = cursor.fetchall()
            
            history = []
            for r in rows:
                history.append({
                    "id": r["id"],
                    "session_id": r["session_id"],
                    "role": r["role"],
                    "content": r["content"],
                    "tool_call": json.loads(r["tool_call"]) if r["tool_call"] else None,
                    "tool_result": json.loads(r["tool_result"]) if r["tool_result"] else None,
                    "timestamp": r["timestamp"]
                })
            return history

    @staticmethod
    def clear_history(session_id: str):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM agent_messages WHERE session_id = ?", (session_id,))
            conn.commit()

    @staticmethod
    def format_history_for_prompt(session_id: str, limit: int = 10) -> str:
        history = AgentMemory.get_history(session_id, limit)
        if not history:
            return ""
        
        lines = []
        for msg in history:
            role_label = "User" if msg["role"] == "user" else "TARA"
            lines.append(f"{role_label}: {msg['content']}")
            if msg.get("tool_result"):
                lines.append(f"Tool Result: {msg['tool_result']}")
        return "\n".join(lines)
