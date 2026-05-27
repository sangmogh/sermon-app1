"""yt-dlp 공통 옵션 — YouTube 봇 차단 시 브라우저 쿠키."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from project_env import PROJECT_ROOT, load_project_env


def _cookie_browser_name() -> str | None:
    """
    .env / .env.local:
      YTDLP_COOKIES_FROM_BROWSER=chrome   (edge, firefox, brave 등)
      YTDLP_COOKIES_FROM_BROWSER=off      (쿠키 사용 안 함)
    """
    load_project_env()
    raw = (os.getenv("YTDLP_COOKIES_FROM_BROWSER") or "").strip().lower()
    if raw in ("", "0", "off", "false", "none", "no"):
        return None
    return raw


def _cookie_file_path() -> str | None:
    load_project_env()
    raw = (os.getenv("YTDLP_COOKIES_FILE") or "").strip()
    if not raw:
        return None
    path = Path(raw)
    if not path.is_absolute():
        path = PROJECT_ROOT / path
    return str(path) if path.is_file() else None


def merge_ytdlp_auth_opts(opts: dict) -> dict:
    """기존 ydl_opts에 쿠키 인증 옵션 병합."""
    merged = dict(opts)
    cookie_file = _cookie_file_path()
    if cookie_file:
        merged["cookiefile"] = cookie_file
        return merged

    browser = _cookie_browser_name()
    if browser:
        merged["cookiesfrombrowser"] = (browser,)
    return merged


def ytdlp_auth_status_line() -> str:
    """bulk 시작 시 한 줄 안내."""
    cookie_file = _cookie_file_path()
    if cookie_file:
        return f"yt-dlp 쿠키: 파일 ({cookie_file})"
    browser = _cookie_browser_name()
    if browser:
        return f"yt-dlp 쿠키: 브라우저 ({browser})"
    if sys.platform == "win32":
        return (
            "yt-dlp 쿠키: 없음 — 봇 차단 시 .env 에 "
            "YTDLP_COOKIES_FROM_BROWSER=chrome 추가"
        )
    return "yt-dlp 쿠키: 없음"


def is_youtube_bot_block_error(exc: BaseException) -> bool:
    text = str(exc).lower()
    return "not a bot" in text or "sign in to confirm" in text
