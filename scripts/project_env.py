"""프로젝트 루트 기준 경로·환경변수 로드.

- .env.local : Supabase (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
- .env       : Gemini (GEMINI_API_KEY, GEMINI_MODEL, BULK_GEMINI_MODEL)
"""

import os
from pathlib import Path

from dotenv import load_dotenv

DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite"
DEFAULT_BULK_GEMINI_MODEL = "gemini-2.5-flash-lite"

# sermon-app1 루트 (scripts/ 의 상위)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_LOCAL = PROJECT_ROOT / ".env.local"
ENV_AI = PROJECT_ROOT / ".env"


def load_supabase_env() -> Path:
    """DB/Supabase 스크립트용 — .env.local 만 로드."""
    if ENV_LOCAL.is_file():
        load_dotenv(ENV_LOCAL, override=True, encoding="utf-8-sig")
    return PROJECT_ROOT


def load_ai_env() -> Path:
    """AI 분석 스크립트용 — .env.local 후 .env (Gemini 키)."""
    if ENV_LOCAL.is_file():
        load_dotenv(ENV_LOCAL, override=False, encoding="utf-8-sig")
    if ENV_AI.is_file():
        load_dotenv(ENV_AI, override=True, encoding="utf-8-sig")
    return PROJECT_ROOT


def load_project_env() -> Path:
    """하위 호환: Supabase + AI 모두 로드."""
    return load_ai_env()


def get_gemini_model() -> str:
    """Gemini API 모델 ID (.env 의 GEMINI_MODEL, 기본 flash-lite)."""
    load_ai_env()
    value = (os.getenv("GEMINI_MODEL") or "").strip()
    return value or DEFAULT_GEMINI_MODEL


def get_bulk_gemini_model() -> str:
    """bulk / analyze_sermon 전용 (.env BULK_GEMINI_MODEL, 기본 2.5 flash-lite)."""
    load_ai_env()
    value = (os.getenv("BULK_GEMINI_MODEL") or "").strip()
    return value or DEFAULT_BULK_GEMINI_MODEL
