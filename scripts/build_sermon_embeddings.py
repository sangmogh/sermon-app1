"""
Supabase 설교 → Gemini 임베딩 인덱스 (고민 검색용).

  python scripts/build_sermon_embeddings.py

upload_to_db.py 이후, 설교가 추가·갱신될 때마다 다시 실행하세요.
"""

from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))

from project_env import PROJECT_ROOT, load_project_env

load_project_env()

EMBEDDING_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001").strip()
INDEX_PATH = PROJECT_ROOT / "data" / "sermon-embeddings.json"
BATCH_SIZE = 100
SLEEP_SEC = 0.3


def _api_key() -> str:
    key = (os.getenv("GEMINI_API_KEY") or os.getenv("NEXT_PUBLIC_GEMINI_API_KEY") or "").strip()
    if not key:
        raise SystemExit("[ERROR] GEMINI_API_KEY 가 필요합니다.")
    return key


def _supabase_rows() -> list[dict]:
    url = (os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL") or "").rstrip("/")
    key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY") or ""
    if not url or not key:
        raise SystemExit("[ERROR] Supabase URL/KEY 가 필요합니다.")

    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    response = requests.get(
        f"{url}/rest/v1/sermons",
        headers=headers,
        params={
            "select": "id,title,core_bible_verse,summary,keywords",
            "order": "sermon_date.desc",
        },
        timeout=60,
    )
    if response.status_code != 200:
        raise SystemExit(f"[ERROR] Supabase 조회 실패: {response.status_code} {response.text[:200]}")
    return response.json()


def _parse_keywords(raw: object) -> list[str]:
    if isinstance(raw, list):
        return [str(x).strip() for x in raw if str(x).strip()]
    if isinstance(raw, str):
        try:
            data = json.loads(raw)
            if isinstance(data, list):
                return [str(x).strip() for x in data if str(x).strip()]
        except json.JSONDecodeError:
            pass
    return []


def _embedding_text(row: dict) -> str:
    title = (row.get("title") or "").strip() or "제목 없음"
    lines = [f"제목: {title}"]
    verse = (row.get("core_bible_verse") or "").strip()
    if verse:
        lines.append(f"핵심말씀: {verse}")
    summary = (row.get("summary") or "").strip()
    if summary:
        lines.append(f"요약: {summary}")
    kws = _parse_keywords(row.get("keywords"))
    if kws:
        lines.append(f"키워드: {', '.join(kws)}")
    return "\n".join(lines)


def _embed_batch(texts: list[str], api_key: str) -> list[list[float]]:
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{EMBEDDING_MODEL}:batchEmbedContents?key={api_key}"
    )
    body = {
        "requests": [
            {
                "model": f"models/{EMBEDDING_MODEL}",
                "content": {"parts": [{"text": text}]},
            }
            for text in texts
        ]
    }
    response = requests.post(url, json=body, timeout=120)
    if response.status_code != 200:
        raise RuntimeError(f"batchEmbed {response.status_code}: {response.text[:300]}")

    payload = response.json()
    embeddings = payload.get("embeddings") or []
    out: list[list[float]] = []
    for item in embeddings:
        values = (item.get("values") or item.get("embedding", {}).get("values") or [])
        if not values:
            raise RuntimeError("배치 임베딩 응답에 벡터가 없습니다.")
        out.append(values)
    if len(out) != len(texts):
        raise RuntimeError(f"배치 크기 불일치: sent={len(texts)} got={len(out)}")
    return out


def main() -> None:
    api_key = _api_key()
    rows = _supabase_rows()
    if not rows:
        print("[WARN] 설교가 없습니다.")
        return

    print(f"[INFO] 설교 {len(rows)}개 임베딩 시작 (model={EMBEDDING_MODEL})")

    entries: list[dict] = []
    for start in range(0, len(rows), BATCH_SIZE):
        chunk = rows[start : start + BATCH_SIZE]
        texts = [_embedding_text(r) for r in chunk]
        vectors = _embed_batch(texts, api_key)
        for row, vector in zip(chunk, vectors):
            vid = str(row.get("id") or "").strip()
            if not vid:
                continue
            entries.append({"id": vid, "embedding": vector})
        print(f"  … {min(start + len(chunk), len(rows))}/{len(rows)}")
        time.sleep(SLEEP_SEC)

    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    index = {
        "version": 1,
        "model": EMBEDDING_MODEL,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "entries": entries,
    }
    INDEX_PATH.write_text(
        json.dumps(index, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"[OK] 저장: {INDEX_PATH} ({len(entries)}개)")


if __name__ == "__main__":
    main()
