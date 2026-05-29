"""단일 영상 처리: 유튜브 영상 ID 또는 URL 하나만 분석 → JSON.

재생목록 전체(bulk_processors.py) 대신, 새로 올라온 설교 영상 1개만 빠르게 처리할 때 사용.
플랜 A(자막) → 실패 시 플랜 B(오디오) 우회는 bulk와 동일하게 동작한다.

사용법:
    python scripts/bulk_one.py YoITLVhxhb0
    python scripts/bulk_one.py https://www.youtube.com/watch?v=YoITLVhxhb0
    python scripts/bulk_one.py https://youtu.be/YoITLVhxhb0

예배 종류·설교자 지정 (새벽·청년 등 매일/매주 1개 추가용):
    python scripts/bulk_one.py --type dawn YoITLVhxhb0
    python scripts/bulk_one.py --type dawn --preacher "홍길동" YoITLVhxhb0

이후 배포:
    python scripts/weekly_deploy.py
"""

import argparse
import os
import sys

import yt_dlp

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from bulk_processors import process_single_video
from extract_subtitles import extract_video_id
from sermon_sources import SERVICE_TYPE_BY_KEY, resolve_service_type
from ytdlp_auth import merge_ytdlp_auth_opts, ytdlp_auth_status_line


def _fetch_title(video_url: str) -> str | None:
    """날짜 보정용 유튜브 제목 조회 (다운로드 없음). 실패해도 진행."""
    opts = merge_ytdlp_auth_opts(
        {"quiet": True, "skip_download": True, "noplaylist": True}
    )
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
        return info.get("title")
    except Exception as e:
        print(f"⚠️ 제목 조회 실패(날짜 보정 생략): {e}")
        return None


def process_one(
    raw: str,
    *,
    service_type: str | None = None,
    preacher: str | None = None,
) -> bool:
    video_id = extract_video_id(raw)
    video_url = f"https://www.youtube.com/watch?v={video_id}"

    print(f"🔐 {ytdlp_auth_status_line()}")
    if service_type:
        print(f"🏷️ 예배 종류(service_type) = {service_type}")
    if preacher:
        print(f"🎙️ 설교자(preacher) = {preacher}")
    title = _fetch_title(video_url)
    if title:
        print(f"📺 {title}")

    ok, _skipped = process_single_video(
        video_url,
        video_id,
        1,
        1,
        youtube_title=title,
        service_type=service_type,
        preacher=preacher,
    )
    return ok


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="단일 영상 분석 → JSON")
    parser.add_argument("video", help="유튜브 영상 ID 또는 URL")
    parser.add_argument(
        "--type",
        dest="service",
        default=None,
        help=f"예배 종류 키 또는 라벨 (예: {', '.join(SERVICE_TYPE_BY_KEY)}). 생략 시 주일 취급",
    )
    parser.add_argument(
        "--preacher",
        default=None,
        help="설교자 이름 (새벽·청년처럼 매번 다를 때 직접 지정). 생략 시 자동 추출/빈칸",
    )
    args = parser.parse_args()

    success = process_one(
        args.video,
        service_type=resolve_service_type(args.service),
        preacher=args.preacher,
    )
    print(
        "\n🏁 완료 — 이제 python scripts/weekly_deploy.py 로 배포하세요."
        if success
        else "\n❌ 실패"
    )
    raise SystemExit(0 if success else 1)
