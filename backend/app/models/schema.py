from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

# Course Models
class CourseCreate(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = "#DA7756"

class CourseResponse(BaseModel):
    id: str
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    color: str
    created_at: str
    updated_at: str
    doc_count: int = 0
    chunk_count: int = 0

# Document Models
class DocumentResponse(BaseModel):
    id: str
    course_id: str
    filename: str
    file_size: int
    page_count: int
    chunk_count: int
    status: str
    error_message: Optional[str] = None
    created_at: str

# Study / RAG Models
class Citation(BaseModel):
    filename: str
    page: int
    section: Optional[str] = "Document Section"
    snippet: str
    relevance_score: Optional[float] = None

class StudyQueryRequest(BaseModel):
    course_id: str
    query: str
    provider: Optional[str] = None
    model: Optional[str] = None
    top_k: Optional[int] = 4

class StudyQueryResponse(BaseModel):
    id: str
    answer: str
    citations: List[Citation]
    grounded: bool
    source_count: int
    provider_used: str
    model_used: str

class StudyMessageResponse(BaseModel):
    id: str
    course_id: str
    role: str
    content: str
    citations: List[Citation] = []
    feedback: Optional[str] = None
    timestamp: str

class FeedbackRequest(BaseModel):
    message_id: str
    feedback: str # "up" or "down" or "none"

# Agent Chat Models
class ToolProposal(BaseModel):
    tool_name: str
    display_name: str
    arguments: Dict[str, Any]
    reason: str
    requires_confirmation: bool
    execution_id: Optional[str] = None

class AgentQueryRequest(BaseModel):
    session_id: Optional[str] = "default"
    message: str
    provider: Optional[str] = None
    model: Optional[str] = None

class AgentQueryResponse(BaseModel):
    message_id: str
    session_id: str
    role: str
    content: str
    tool_proposal: Optional[ToolProposal] = None
    tool_executed: Optional[Dict[str, Any]] = None
    provider_used: str

class ToolConfirmationRequest(BaseModel):
    session_id: str
    tool_name: str
    arguments: Dict[str, Any]
    approved: bool

# Tool Permission Models
class ToolPermissionItem(BaseModel):
    tool_name: str
    display_name: str
    category: str
    description: str
    auto_approve: bool
    requires_confirmation: bool

class ToolPermissionUpdate(BaseModel):
    tool_name: str
    auto_approve: bool
    requires_confirmation: bool

class ToolExecutionLogItem(BaseModel):
    id: str
    tool_name: str
    arguments: Dict[str, Any]
    status: str
    result: Optional[str] = None
    error: Optional[str] = None
    executed_at: str

# Settings Models
class ProviderStatus(BaseModel):
    id: str
    name: str
    configured: bool
    masked_key: str
    default_model: str
    available_models: List[str]
    is_active: bool
    docs_url: str
    description: str

class AppSettings(BaseModel):
    default_provider: str
    default_model: str
    speech_rate: float = 1.0
    speech_pitch: float = 1.0
    auto_tts: bool = True
    wake_word_enabled: bool = True
    wake_word_sensitivity: float = 0.7
    wake_word_phonetics: Dict[str, str] = {
        "keyword": "TARA",
        "ipa": "/ˈtɑːrə/",
        "syllables": "TAH-rah",
        "arpabet": "T AA1 R AH0"
    }

class SaveKeyRequest(BaseModel):
    provider: str
    api_key: str

class SaveSettingsRequest(BaseModel):
    default_provider: Optional[str] = None
    default_model: Optional[str] = None
    speech_rate: Optional[float] = None
    speech_pitch: Optional[float] = None
    auto_tts: Optional[bool] = None
    wake_word_enabled: Optional[bool] = None

# Quiz & Flashcards & Summary Models
class QuizRequest(BaseModel):
    course_id: str
    count: Optional[int] = 5
    topic: Optional[str] = ""

class QuizQuestion(BaseModel):
    id: int
    question: str
    options: List[str]
    correct_index: int
    explanation: str
    citation: Dict[str, Any]

class QuizResponse(BaseModel):
    course_id: str
    course_name: str
    topic: Optional[str] = None
    questions: List[QuizQuestion]

class Flashcard(BaseModel):
    id: int
    front: str
    back: str
    citation: Dict[str, Any]

class FlashcardsResponse(BaseModel):
    course_id: str
    course_name: str
    flashcards: List[Flashcard]

class SummaryRequest(BaseModel):
    course_id: str
    topic: Optional[str] = None

class SummaryResponse(BaseModel):
    course_id: str
    course_name: str
    summary_markdown: str
    key_concepts: List[str]
    citations: List[Citation]

class DocumentChunkItem(BaseModel):
    id: str
    document_id: str
    course_id: str
    chunk_index: int
    page_number: int
    section_title: Optional[str] = None
    content: str
    char_count: int
