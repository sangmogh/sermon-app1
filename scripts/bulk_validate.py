"""bulk 분석 직후: 유튜브 제목 6자리 날짜(260524) vs JSON sermon_date 검증."""

from __future__ import annotations

import json
import re

import yt_dlp

from project_env import PROJECT_ROOT
from ytdlp_auth import merge_ytdlp_auth_opts

OUTPUT_DIR = PROJECT_ROOT / "output"


def yyymmdd_to_iso(code: str) -> str:
    y = int(code[:2])
    year = 2000 + y if y < 50 else 1900 + y
    return f"{year}-{code[2:4]}-{code[4:6]}"


def parse_sermon_date_from_title(yt_title: str) -> str | None:
    """
    유튜브 제목 어디에 있든 YYMMDD(240412 등) → YYYY-MM-DD.
    제목 왼쪽·가운데·오른쪽 모두 re.findall로 처리.
    """
    if not yt_title:
        return None

    codes = re.findall(r"\d{6}", yt_title)
    sermon_code = None
    for code in codes:
        if code.startswith(("23", "24", "25", "26")):
            sermon_code = code
            break
    if not sermon_code and codes:
        sermon_code = codes[0]
    if not sermon_code:
        return None
    return yyymmdd_to_iso(sermon_code)


def fetch_youtube_title(video_id: str) -> str | None:
    url = f"https://www.youtube.com/watch?v={video_id}"
    try:
        with yt_dlp.YoutubeDL(
            merge_ytdlp_auth_opts({"quiet": True, "skip_download": True})
        ) as ydl:
            info = ydl.extract_info(url, download=False)
        title = (info.get("title") or "").strip()
        return title or None
    except Exception:
        return None


def output_json_path(video_id: str) -> Path:
    return OUTPUT_DIR / f"result_transcript_{video_id}.json"


def validate_saved_json(video_id: str) -> bool:
    """
    유튜브 제목의 YYMMDD(예: 260524)와 JSON sermon_date 일치 여부.
    불일치 시 JSON·audio 삭제 후 False (Gemini 비용 낭비 방지).
    sermon_date 비어 있으면 유튜브 기준으로 JSON만 보정.
    """
    path = output_json_path(video_id)
    if not path.is_file():
        return False

    yt_title = fetch_youtube_title(video_id)
    if not yt_title:
        print(f"⚠️ [{video_id}] 유튜브 제목 조회 실패 — 검증 생략")
        return True

    expected_date = parse_sermon_date_from_title(yt_title)
    if not expected_date:
        print(f"ℹ️ [{video_id}] 제목에 6자리 설교일 없음 — 검증 생략")
        return True
    data = json.loads(path.read_text(encoding="utf-8"))
    actual_date = (data.get("sermon_date") or "").strip()[:10]
    json_title = (data.get("title") or "").strip()

    if not actual_date:
        data["sermon_date"] = expected_date
        path.write_text(
            json.dumps(data, ensure_ascii=False, indent=4),
            encoding="utf-8",
        )
        print(
            f"ℹ️ [{video_id}] sermon_date 비어 있음 → 유튜브 기준 보정: {expected_date}",
        )
        return True

    if actual_date == expected_date:
        return True

    # 플랜 B 등: Gemini가 본문 속 다른 날짜를 sermon_date에 넣는 경우 → 제목 기준 보정
    data["sermon_date"] = expected_date
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=4),
        encoding="utf-8",
    )
    print(
        f"ℹ️ [{video_id}] sermon_date 보정: Gemini {actual_date} → "
        f"유튜브 제목 {expected_date} (JSON 유지)",
    )
    if json_title:
        print(f"   JSON title: {json_title[:75]}")
    return True
