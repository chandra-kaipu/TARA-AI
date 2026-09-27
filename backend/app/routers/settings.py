import os
import json
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException
from app.config import (
    settings,
    ENV_FILE,
    WAKE_WORD,
    WAKE_WORD_IPA,
    WAKE_WORD_SYLLABLES,
    WAKE_WORD_ARPABET
)
from app.database import get_db
from app.models.schema import SaveKeyRequest, SaveSettingsRequest

router = APIRouter(prefix="/api/settings", tags=["Settings"])

def get_setting_from_db(key: str, default: str = "") -> str:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM app_settings WHERE key = ?", (key,))
        row = cursor.fetchone()
        return row["value"] if row else default

def set_setting_in_db(key: str, value: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO app_settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value
        """, (key, value))
        conn.commit()

@router.get("")
def get_system_settings():
    providers = settings.get_providers_status()
    
    # Check overrides in DB
    saved_provider = get_setting_from_db("default_provider", settings.DEFAULT_PROVIDER)
    saved_model = get_setting_from_db("default_model", settings.DEFAULT_MODEL)
    speech_rate = float(get_setting_from_db("speech_rate", "1.0"))
    speech_pitch = float(get_setting_from_db("speech_pitch", "1.0"))
    auto_tts = get_setting_from_db("auto_tts", "true").lower() == "true"
    wake_word_enabled = get_setting_from_db("wake_word_enabled", "true").lower() == "true"
    wake_word_sensitivity = float(get_setting_from_db("wake_word_sensitivity", "0.7"))

    for p in providers:
        p["is_active"] = (p["id"] == saved_provider)

    return {
        "providers": providers,
        "active_provider": saved_provider,
        "active_model": saved_model,
        "voice": {
            "speech_rate": speech_rate,
            "speech_pitch": speech_pitch,
            "auto_tts": auto_tts
        },
        "wake_word": {
            "enabled": wake_word_enabled,
            "sensitivity": wake_word_sensitivity,
            "phonetics": {
                "keyword": WAKE_WORD,
                "ipa": WAKE_WORD_IPA,
                "syllables": WAKE_WORD_SYLLABLES,
                "arpabet": WAKE_WORD_ARPABET
            },
            "porcupine_configured": bool(settings.PICOVOICE_ACCESS_KEY.strip()),
            "elevenlabs_configured": bool(settings.ELEVENLABS_API_KEY.strip())
        }
    }

@router.post("")
def update_system_settings(req: SaveSettingsRequest):
    if req.default_provider is not None:
        set_setting_in_db("default_provider", req.default_provider)
        settings.DEFAULT_PROVIDER = req.default_provider
    if req.default_model is not None:
        set_setting_in_db("default_model", req.default_model)
        settings.DEFAULT_MODEL = req.default_model
    if req.speech_rate is not None:
        set_setting_in_db("speech_rate", str(req.speech_rate))
    if req.speech_pitch is not None:
        set_setting_in_db("speech_pitch", str(req.speech_pitch))
    if req.auto_tts is not None:
        set_setting_in_db("auto_tts", "true" if req.auto_tts else "false")
    if req.wake_word_enabled is not None:
        set_setting_in_db("wake_word_enabled", "true" if req.wake_word_enabled else "false")

    return {"success": True, "message": "Settings updated successfully"}

@router.post("/keys")
def update_api_key(req: SaveKeyRequest):
    provider = req.provider.lower().strip()
    key_val = req.api_key.strip()
    
    key_env_map = {
        "gemini": "GEMINI_API_KEY",
        "openai": "OPENAI_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY",
        "groq": "GROQ_API_KEY",
        "picovoice": "PICOVOICE_ACCESS_KEY",
        "elevenlabs": "ELEVENLABS_API_KEY"
    }

    env_var_name = key_env_map.get(provider)
    if not env_var_name:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")

    # Update in runtime environment
    os.environ[env_var_name] = key_val

    # Update in .env file safely
    try:
        env_content = ""
        if ENV_FILE.exists():
            env_content = ENV_FILE.read_text(encoding="utf-8")
        
        pattern = f"{env_var_name}="
        if pattern in env_content:
            lines = env_content.splitlines()
            new_lines = []
            for line in lines:
                if line.startswith(pattern):
                    new_lines.append(f"{env_var_name}={key_val}")
                else:
                    new_lines.append(line)
            ENV_FILE.write_text("\n".join(new_lines), encoding="utf-8")
        else:
            with open(ENV_FILE, "a", encoding="utf-8") as f:
                f.write(f"\n{env_var_name}={key_val}")

        settings.reload_env()
    except Exception as e:
        pass

    return {
        "success": True,
        "provider": provider,
        "configured": bool(key_val),
        "masked_key": settings.mask_key(key_val),
        "message": f"Successfully updated API key for {provider}"
    }

@router.post("/test_connection")
async def test_provider_connection(payload: Dict[str, str]):
    provider = payload.get("provider", "gemini")
    from app.services.llm_provider import query_llm
    
    test_prompt = "Hello TARA! Confirm connection with a brief 1-sentence greeting."
    answer, prov_used, mod_used = await query_llm(
        prompt=test_prompt,
        system_prompt="You are TARA. Answer briefly.",
        provider=provider
    )

    if answer:
        return {
            "success": True,
            "provider": prov_used,
            "model": mod_used,
            "reply": answer
        }
    else:
        return {
            "success": False,
            "provider": provider,
            "reply": f"Could not establish connection to {provider}. Please check if an API key is set in .env or Settings."
        }
