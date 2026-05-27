"""
재생목록 일괄 처리: 플랜 A(자막) → 실패 시 플랜 B(오디오) 자동 우회.
- 플랜 B: audio 캐시 재사용 금지 (매번 새로 다운로드)
- 스킵 전에도 기존 JSON 검증 (틀리면 삭제 후 재분석)
- 분석 전: 재생목록 제목 YYMMDD → Gemini에 sermon_date 고정
- 분석 후: 불일치 시 유튜브 제목 날짜로 JSON 보정 (삭제·재분석 없음)
- 분석 모델: .env BULK_GEMINI_MODEL (기본 gemini-2.5-flash-lite). 검색용 GEMINI_MODEL 과 분리.
이미 분석된 JSON은 건너뛰며 짧은 sleep, API 호출 후에는 25~45초 sleep.

전체 재시작: python scripts/reset_bulk_artifacts.py --yes
"""

SKIP_SLEEP_SEC = 4.0
WORK_SLEEP_MIN_SEC = 25
WORK_SLEEP_MAX_SEC = 45

import os
import random
import sys
import time
from pathlib import Path

import yt_dlp

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from analyze_sermon import analyze_sermon, analyze_sermon_from_audio
from audio_downloader import download_audio_m4a
from bulk_validate import parse_sermon_date_from_title, validate_saved_json
from extract_subtitles import extract_video_id, get_clean_transcript
from ytdlp_auth import merge_ytdlp_auth_opts, ytdlp_auth_status_line

from project_env import PROJECT_ROOT, load_ai_env

load_ai_env()


def _read_float_env(name: str, default: float) -> float:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    try:
        value = float(raw)
        return value if value >= 0 else default
    except ValueError:
        return default


WORK_SLEEP_MIN_SEC = _read_float_env("BULK_WORK_SLEEP_MIN_SEC", WORK_SLEEP_MIN_SEC)
WORK_SLEEP_MAX_SEC = _read_float_env("BULK_WORK_SLEEP_MAX_SEC", WORK_SLEEP_MAX_SEC)
if WORK_SLEEP_MAX_SEC < WORK_SLEEP_MIN_SEC:
    WORK_SLEEP_MAX_SEC = WORK_SLEEP_MIN_SEC
SKIP_SLEEP_SEC = _read_float_env("BULK_SKIP_SLEEP_SEC", SKIP_SLEEP_SEC)


def _resolve_entry(entry: dict) -> tuple[str, str]:
    """재생목록 entry에서 (watch_url, video_id) 반환."""
    video_id = entry.get("id")
    url = entry.get("url") or entry.get("webpage_url")

    if url and not str(url).startswith("http"):
        url = f"https://www.youtube.com/watch?v={url}"
        if not video_id:
            video_id = str(url).split("v=")[-1]

    if not video_id and url:
        video_id = extract_video_id(url)

    if video_id and not url:
        url = f"https://www.youtube.com/watch?v={video_id}"

    if not video_id or not url:
        raise ValueError(f"영상 ID/URL을 확인할 수 없습니다: {entry}")

    return url, video_id


def _output_exists(video_id: str) -> bool:
    path = PROJECT_ROOT / "output" / f"result_transcript_{video_id}.json"
    return path.is_file() and path.stat().st_size > 0


def _should_skip_video(video_id: str, index: int, total: int) -> bool:
    """
    JSON이 있어도 유튜브 제목 날짜(260524)와 안 맞으면 삭제 후 재분석.
    (--fresh 없이 bulk 돌려도 옛 잘못된 JSON이 스킵되지 않게)
    """
    if not _output_exists(video_id):
        return False
    if validate_saved_json(video_id):
        print(
            f"⏭️ [{index}/{total}] 이미 분석됨 (검증 통과), 건너뜀: "
            f"output/result_transcript_{video_id}.json",
        )
        return True
    print(
        f"🔄 [{index}/{total}] 기존 JSON 날짜 불일치 → 삭제됨, 다시 분석: {video_id}",
    )
    return False


def process_single_video(
    video_url: str,
    video_id: str,
    index: int,
    total: int,
    *,
    youtube_title: str | None = None,
) -> tuple[bool, bool]:
    """
    한 영상 처리. (성공 여부, 이미 분석됨 스킵 여부) 반환. 내부 예외는 모두 처리.
    """
    print(f"\n▶️ [{index}/{total}] 처리 시작: {video_id}")

    expected_date = parse_sermon_date_from_title(youtube_title or "")
    if expected_date:
        print(f"📅 [{index}/{total}] 유튜브 제목 설교일: {expected_date}")

    if _should_skip_video(video_id, index, total):
        return True, True

    # --- 플랜 A: 자막 추출 + 텍스트 분석 ---
    try:
        transcript_path = get_clean_transcript(video_url)
        if transcript_path:
            file_name = os.path.basename(transcript_path)
            if analyze_sermon(file_name, expected_sermon_date=expected_date):
                if validate_saved_json(video_id):
                    print(f"✅ [{index}/{total}] 플랜 A 완료: {video_id}")
                    return True, False
                print(
                    f"⚠️ [{index}/{total}] 플랜 A 검증 실패 → 플랜 B로 넘김: {video_id}",
                )
            else:
                print(f"⚠️ [{index}/{total}] 플랜 A 분석 실패 → 플랜 B 시도: {video_id}")
        else:
            print(f"⚠️ [{index}/{total}] 자막 없음/추출 실패 → 플랜 B 시도: {video_id}")
    except Exception as e:
        print(f"⚠️ [{index}/{total}] 플랜 A 예외 ({video_id}): {e} → 플랜 B 시도")

    # --- 플랜 B: 오디오 다운로드 + 업로드 분석 (검증 실패 시 1회 재시도) ---
    try:
        for attempt in range(2):
            if attempt > 0:
                print(f"🔁 [{index}/{total}] 플랜 B 재시도 ({attempt + 1}/2): {video_id}")

            audio_path = download_audio_m4a(video_url, video_id)
            if not audio_path:
                print(f"❌ [{index}/{total}] 플랜 B 오디오 다운로드 실패: {video_id}")
                return False, False

            if not analyze_sermon_from_audio(
                video_id, audio_path, expected_sermon_date=expected_date
            ):
                print(f"❌ [{index}/{total}] 플랜 B 분석 실패: {video_id}")
                return False, False

            if validate_saved_json(video_id):
                print(f"✅ [{index}/{total}] 플랜 B 완료: {video_id}")
                return True, False

            if attempt == 0:
                print(
                    f"⚠️ [{index}/{total}] 플랜 B 검증 실패 → 오디오·JSON 비우고 1회 재시도: {video_id}",
                )
                continue

            print(
                f"❌ [{index}/{total}] 플랜 B 검증 실패 (재시도 후에도 불일치): {video_id}",
            )
            return False, False

    except Exception as e:
        print(f"❌ [{index}/{total}] 플랜 B 예외 ({video_id}): {e}")
        return False, False

    return False, False


def process_playlist(playlist_url: str, *, limit: int | None = None) -> None:
    print("👀 재생목록 정보를 가져오는 중입니다...")

    ydl_opts = merge_ytdlp_auth_opts(
        {
            "extract_flat": True,
            "quiet": True,
        }
    )

    try:
        print(f"🔐 {ytdlp_auth_status_line()}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(playlist_url, download=False)
    except Exception as e:
        print(f"❌ 재생목록 조회 실패: {e}")
        return

    entries = info.get("entries") or []
    entries = [e for e in entries if e]

    if not entries:
        print("❌ 재생목록에서 영상을 찾을 수 없습니다.")
        return

    total_videos = len(entries)
    print(f"✅ 총 {total_videos}개 영상. 플랜 A → 플랜 B 자동 우회 파이프라인 시작.\n")

    success_count = 0
    fail_count = 0

    for index, entry in enumerate(entries, start=1):
        title = entry.get("title", "제목 없음")

        try:
            video_url, video_id = _resolve_entry(entry)
            print(f"📺 [{index}/{total_videos}] {title}")
            ok, skipped = process_single_video(
                video_url, video_id, index, total_videos, youtube_title=title
            )
            if ok:
                success_count += 1
            else:
                fail_count += 1
        except Exception as e:
            fail_count += 1
            skipped = False
            print(f"❌ [{index}/{total_videos}] 영상 처리 중단 없이 건너뜀: {e}")

        if skipped:
            sleep_sec = SKIP_SLEEP_SEC
            print(f"💤 건너뜀 — 짧은 대기 {sleep_sec:.1f}초...")
        else:
            sleep_sec = random.uniform(WORK_SLEEP_MIN_SEC, WORK_SLEEP_MAX_SEC)
            print(f"💤 서버 차단 방지 대기 {sleep_sec:.1f}초...")
        time.sleep(sleep_sec)
        print("-" * 50)

    print(
        f"\n🏁 전체 완료 — 성공: {success_count}, 실패: {fail_count}, "
        f"합계: {total_videos}"
    )


if __name__ == "__main__":
    import argparse

    from reset_bulk_artifacts import _delete_glob

    parser = argparse.ArgumentParser(description="재생목록 bulk 분석")
    parser.add_argument(
        "--fresh",
        action="store_true",
        help="시작 전 output JSON + audio 전부 삭제 (전체 재분석)",
    )
    args = parser.parse_args()

    if args.fresh:
        audio_dir = PROJECT_ROOT / "audio"
        n_json = _delete_glob(PROJECT_ROOT / "output", "result_transcript_*.json")
        n_audio = 0
        if audio_dir.is_dir():
            for p in audio_dir.iterdir():
                if p.is_file():
                    p.unlink()
                    n_audio += 1
        print(f"🗑️ --fresh: JSON {n_json}개, audio {n_audio}개 삭제 후 시작합니다.\n")

    target_playlist_url = (
        "https://www.youtube.com/playlist?list=PLGpyTA6CZTZ18XLynWXBUcHaeJM8nwmYw"
    )
    process_playlist(target_playlist_url)
