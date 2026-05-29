"""
Supabase 설교 → Gemini 멀티 벡터 임베딩 인덱스 (고민 검색용).

  python scripts/build_sermon_embeddings.py

설교 1편당:
  - 요약 벡터 1개  (제목 + 요약 + 키워드)
  - 포인트 벡터 N개 (설교제목 + 포인트제목 + 포인트내용)
검색 시 한 설교의 벡터들 중 가장 높은 유사도(MAX)를 그 설교 점수로 사용합니다.

문서(설교) 임베딩은 taskType=RETRIEVAL_DOCUMENT, 출력 차원은 GEMINI_EMBEDDING_DIM(기본 768).
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
EMBEDDING_DIM = int((os.getenv("GEMINI_EMBEDDING_DIM") or "768").strip())
INDEX_PATH = PROJECT_ROOT / "data" / "sermon-embeddings.json"
BATCH_SIZE = 100
SLEEP_SEC = 0.3
DOCUMENT_TASK_TYPE = "RETRIEVAL_DOCUMENT"


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

    def _query(select: str) -> requests.Response:
        return requests.get(
            f"{url}/rest/v1/sermons",
            headers=headers,
            params={"select": select, "order": "sermon_date.desc"},
            timeout=60,
        )

    # service_type 포함 조회. 컬럼 미존재(마이그레이션 전)면 빼고 재조회 → 전부 주일 취급.
    response = _query("id,title,core_bible_verse,summary,keywords,points,service_type")
    if response.status_code != 200 and "service_type" in response.text:
        print("[INFO] service_type 컬럼 없음 → 모든 설교를 멀티벡터(주일)로 처리합니다.")
        response = _query("id,title,core_bible_verse,summary,keywords,points")

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


def _parse_points(raw: object) -> list[dict]:
    data = raw
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except json.JSONDecodeError:
            return []
    if not isinstance(data, list):
        return []
    points: list[dict] = []
    for item in data:
        if isinstance(item, dict):
            points.append(item)
    return points


def _summary_text(row: dict) -> str:
    title = (row.get("title") or "").strip() or "제목 없음"
    lines = [f"제목: {title}"]
    summary = (row.get("summary") or "").strip()
    if summary:
        lines.append(f"요약: {summary}")
    kws = _parse_keywords(row.get("keywords"))
    if kws:
        lines.append(f"키워드: {', '.join(kws)}")
    return "\n".join(lines)


def _point_title(point: dict) -> str:
    for key in ("point_title", "pointTitle", "title", "name"):
        value = point.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _point_text(row: dict, point: dict) -> str:
    title = (row.get("title") or "").strip() or "제목 없음"
    point_title = _point_title(point)
    description = ""
    for key in ("description", "desc", "summary", "content", "text"):
        value = point.get(key)
        if isinstance(value, str) and value.strip():
            description = value.strip()
            break

    lines = [f"제목: {title}"]
    if point_title:
        lines.append(f"포인트: {point_title}")
    if description:
        lines.append(f"내용: {description}")
    return "\n".join(lines)


MAIN_SERVICE_TYPE = "주일"


def _is_main_service(row: dict) -> bool:
    """주일(메인) 설교 여부. service_type 비어 있으면(기존 데이터) 주일로 취급."""
    service_type = str(row.get("service_type") or "").strip()
    return service_type == "" or service_type == MAIN_SERVICE_TYPE


def _build_units(rows: list[dict]) -> list[dict]:
    """
    플랫한 임베딩 단위 목록: {id, kind, text}.
    - 주일(메인): 요약 벡터 + 포인트 벡터들 (멀티벡터)
    - 그 외(새벽·청년 등): 요약 벡터 1개만 (인덱스 폭증 방지 + 주제 매칭 위주)
    """
    units: list[dict] = []
    for row in rows:
        vid = str(row.get("id") or "").strip()
        if not vid:
            continue

        units.append({"id": vid, "kind": "summary", "text": _summary_text(row)})

        if not _is_main_service(row):
            # 새벽·청년 등은 요약벡터만 — 포인트 벡터 생성 생략
            continue

        for point in _parse_points(row.get("points")):
            text = _point_text(row, point)
            # 제목만 있고 포인트/내용이 비면 요약과 중복이라 건너뜀
            if "\n" not in text:
                continue
            units.append(
                {
                    "id": vid,
                    "kind": "point",
                    "text": text,
                    "label": _point_title(point),
                }
            )
    return units


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
                "taskType": DOCUMENT_TASK_TYPE,
                "outputDimensionality": EMBEDDING_DIM,
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

    units = _build_units(rows)
    summary_count = sum(1 for u in units if u["kind"] == "summary")
    point_count = sum(1 for u in units if u["kind"] == "point")
    print(
        f"[INFO] 설교 {len(rows)}개 → 벡터 {len(units)}개 "
        f"(요약 {summary_count} + 포인트 {point_count}), "
        f"model={EMBEDDING_MODEL}, dim={EMBEDDING_DIM}"
    )

    entries: list[dict] = []
    for start in range(0, len(units), BATCH_SIZE):
        chunk = units[start : start + BATCH_SIZE]
        texts = [u["text"] for u in chunk]
        vectors = _embed_batch(texts, api_key)
        for unit, vector in zip(chunk, vectors):
            entry = {"id": unit["id"], "kind": unit["kind"], "embedding": vector}
            label = unit.get("label")
            if label:
                entry["label"] = label
            entries.append(entry)
        print(f"  … {min(start + len(chunk), len(units))}/{len(units)}")
        time.sleep(SLEEP_SEC)

    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    index = {
        "version": 2,
        "model": EMBEDDING_MODEL,
        "dim": EMBEDDING_DIM,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "entries": entries,
    }
    INDEX_PATH.write_text(
        json.dumps(index, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"[OK] 저장: {INDEX_PATH} ({len(entries)}개 벡터)")


if __name__ == "__main__":
    main()
