"""
Supabase sermons.sermon_date 가 비어 있을 때,
YouTube upload_date(yt-dlp)로 YYYY-MM-DD 를 채웁니다.
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import requests
import yt_dlp

sys.path.insert(0, str(Path(__file__).resolve().parent))

from project_env import PROJECT_ROOT, load_supabase_env

load_supabase_env()

SUPABASE_URL = (
    os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    or os.getenv("SUPABASE_URL")
    or ""
).rstrip("/")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    or os.getenv("SUPABASE_ANON_KEY")
    or ""
)

if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit(
        "[ERROR] .env.local 에 NEXT_PUBLIC_SUPABASE_URL 과 "
        "NEXT_PUBLIC_SUPABASE_ANON_KEY (또는 SUPABASE_SERVICE_ROLE_KEY) 가 필요합니다."
    )

REST_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}


def upload_date_to_iso(upload_date: str | None) -> str | None:
    """yt-dlp upload_date (YYYYMMDD) → YYYY-MM-DD."""
    if not upload_date or len(upload_date) != 8 or not upload_date.isdigit():
        return None
    return f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:8]}"


def fetch_youtube_upload_date(video_id: str) -> str | None:
    url = f"https://www.youtube.com/watch?v={video_id}"
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": False,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
    return upload_date_to_iso(info.get("upload_date"))


def fetch_sermons_missing_date() -> list[dict]:
    """sermon_date 가 null 이거나 빈 문자열인 행."""
    rows: list[dict] = []
    offset = 0
    page_size = 100

    while True:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/sermons",
            headers={**REST_HEADERS, "Range": f"{offset}-{offset + page_size - 1}"},
            params={
                "select": "id,sermon_date",
                "order": "id.asc",
            },
            timeout=60,
        )
        resp.raise_for_status()
        batch = resp.json()
        if not batch:
            break

        for row in batch:
            sd = row.get("sermon_date")
            if sd is None or (isinstance(sd, str) and not sd.strip()):
                rows.append(row)

        if len(batch) < page_size:
            break
        offset += page_size

    return rows


def patch_sermon_date(video_id: str, sermon_date: str) -> bool:
    resp = requests.patch(
        f"{SUPABASE_URL}/rest/v1/sermons",
        headers=REST_HEADERS,
        params={"id": f"eq.{video_id}"},
        json={"sermon_date": sermon_date},
        timeout=60,
    )
    if resp.status_code in (200, 204):
        return True
    print(f"  [FAIL] PATCH ({resp.status_code}): {resp.text}")
    return False


def main() -> None:
    print(f"[ROOT] {PROJECT_ROOT}")
    print(f"[SUPABASE] {SUPABASE_URL}")

    missing = fetch_sermons_missing_date()
    if not missing:
        print("[OK] sermon_date 가 비어 있는 설교가 없습니다.")
        return

    print(f"[TARGET] 날짜 보정 대상: {len(missing)}건\n")

    ok = 0
    fail = 0

    for i, row in enumerate(missing, start=1):
        video_id = row["id"]
        print(f"[{i}/{len(missing)}] {video_id}")

        try:
            iso_date = fetch_youtube_upload_date(video_id)
        except Exception as exc:
            print(f"  [FAIL] yt-dlp 오류: {exc}")
            fail += 1
            time.sleep(1)
            continue

        if not iso_date:
            print("  [WARN] upload_date 를 가져오지 못했습니다.")
            fail += 1
            continue

        if patch_sermon_date(video_id, iso_date):
            print(f"  [OK] sermon_date -> {iso_date}")
            ok += 1
        else:
            fail += 1

        time.sleep(0.5)

    print(f"\n완료: 성공 {ok}건, 실패 {fail}건")


if __name__ == "__main__":
    main()
