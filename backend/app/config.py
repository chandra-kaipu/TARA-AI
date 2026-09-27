import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
INDEX_DIR = DATA_DIR / "indices"
SCREENSHOT_DIR = DATA_DIR / "screenshots"
DB_PATH = DATA_DIR / "tara.db"

# Create directories if they do not exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
INDEX_DIR.mkdir(parents=True, exist_ok=True)
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

# Load .env
ENV_FILE = BASE_DIR / ".env"
load_dotenv(ENV_FILE, override=True)

# Wake Word Constants & Phonetics
# TARA -> /ˈtɑːrə/ -> syllables "TAH-rah" -> ARPAbet: T AA1 R AH0
WAKE_WORD = "TARA"
WAKE_WORD_IPA = "/ˈtɑːrə/"
WAKE_WORD_SYLLABLES = "TAH-rah"
WAKE_WORD_ARPABET = "T AA1 R AH0"

class Settings:
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "127.0.0.1")
    CORS_ORIGINS: list[str] = [
        orig.strip() for orig in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    ]

    DEFAULT_PROVIDER: str = os.getenv("DEFAULT_PROVIDER", "gemini")
    DEFAULT_MODEL: str = os.getenv("DEFAULT_MODEL", "gemini-1.5-flash")

    # API Keys
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3.2")

    EMBEDDING_PROVIDER: str = os.getenv("EMBEDDING_PROVIDER", "local")
    LOCAL_EMBEDDING_MODEL: str = os.getenv("LOCAL_EMBEDDING_MODEL", "all-MiniLM-L6-v2")

    PICOVOICE_ACCESS_KEY: str = os.getenv("PICOVOICE_ACCESS_KEY", "")
    ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")
    ELEVENLABS_VOICE_ID: str = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")

    @classmethod
    def reload_env(cls):
        load_dotenv(ENV_FILE, override=True)
        cls.DEFAULT_PROVIDER = os.getenv("DEFAULT_PROVIDER", cls.DEFAULT_PROVIDER)
        cls.DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", cls.DEFAULT_MODEL)
        cls.GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
        cls.OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
        cls.ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
        cls.GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
        cls.OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        cls.OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
        cls.EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "local")
        cls.PICOVOICE_ACCESS_KEY = os.getenv("PICOVOICE_ACCESS_KEY", "")
        cls.ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")

    @classmethod
    def mask_key(cls, key: str) -> str:
        if not key or len(key.strip()) < 6:
            return ""
        k = key.strip()
        return f"{k[:3]}...{k[-4:]}"

    @classmethod
    def get_providers_status(cls):
        cls.reload_env()
        return [
            {
                "id": "gemini",
                "name": "Google Gemini",
                "configured": bool(cls.GEMINI_API_KEY.strip()),
                "masked_key": cls.mask_key(cls.GEMINI_API_KEY),
                "default_model": "gemini-1.5-flash",
                "available_models": ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"],
                "is_active": cls.DEFAULT_PROVIDER == "gemini",
                "docs_url": "https://aistudio.google.com/",
                "description": "Fast multimodal reasoning, generous free tier, ideal for document grounding and agentic tools."
            },
            {
                "id": "openai",
                "name": "OpenAI",
                "configured": bool(cls.OPENAI_API_KEY.strip()),
                "masked_key": cls.mask_key(cls.OPENAI_API_KEY),
                "default_model": "gpt-4o-mini",
                "available_models": ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"],
                "is_active": cls.DEFAULT_PROVIDER == "openai",
                "docs_url": "https://platform.openai.com/api-keys",
                "description": "Industry-standard GPT models with native tool-calling and Whisper transcription."
            },
            {
                "id": "anthropic",
                "name": "Anthropic (Claude)",
                "configured": bool(cls.ANTHROPIC_API_KEY.strip()),
                "masked_key": cls.mask_key(cls.ANTHROPIC_API_KEY),
                "default_model": "claude-3-5-sonnet-20241022",
                "available_models": ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"],
                "is_active": cls.DEFAULT_PROVIDER == "anthropic",
                "docs_url": "https://console.anthropic.com/",
                "description": "High-accuracy nuanced reasoning and comprehensive document comprehension."
            },
            {
                "id": "groq",
                "name": "Groq",
                "configured": bool(cls.GROQ_API_KEY.strip()),
                "masked_key": cls.mask_key(cls.GROQ_API_KEY),
                "default_model": "llama-3.3-70b-versatile",
                "available_models": ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
                "is_active": cls.DEFAULT_PROVIDER == "groq",
                "docs_url": "https://console.groq.com/",
                "description": "Ultra-low latency LPU inference with near-instantaneous token generation."
            },
            {
                "id": "ollama",
                "name": "Ollama (Local / Offline)",
                "configured": True,  # Accessible via local endpoint
                "masked_key": cls.OLLAMA_BASE_URL,
                "default_model": cls.OLLAMA_MODEL,
                "available_models": [cls.OLLAMA_MODEL, "llama3", "mistral", "phi3"],
                "is_active": cls.DEFAULT_PROVIDER == "ollama",
                "docs_url": "https://ollama.com/",
                "description": "100% private, self-hosted LLM running directly on your computer."
            }
        ]

settings = Settings()
