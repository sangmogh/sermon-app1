"""
재생목록 일괄 처리: 플랜 A(자막) → 실패 시 플랜 B(오디오) 자동 우회.
이미 분석된 JSON은 건너뛰며 짧은 sleep, API 호출 후에는 10~25초 sleep.
분석 품질(성경 참조·키워드 등)은 analyze_sermon.py 프롬프트·정규화를 따름.
"""

SKIP_SLEEP_SEC = 2.0
WORK_SLEEP_MIN_SEC = 10
WORK_SLEEP_MAX_SEC = 25

import os
import random
import sys
import time
from pathlib import Path

import yt_dlp

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from analyze_sermon import analyze_sermon, analyze_sermon_from_audio
from audio_downloader import download_audio_m4a
from extract_subtitles import extract_video_id, get_clean_transcript

from project_env import PROJECT_ROOT, load_ai_env

load_ai_env()


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


def process_single_video(
    video_url: str, video_id: str, index: int, total: int
) -> tuple[bool, bool]:
    """
    한 영상 처리. (성공 여부, 이미 분석됨 스킵 여부) 반환. 내부 예외는 모두 처리.
    """
    print(f"\n▶️ [{index}/{total}] 처리 시작: {video_id}")

    if _output_exists(video_id):
        print(f"⏭️ [{index}/{total}] 이미 분석됨, 건너뜀: output/result_transcript_{video_id}.json")
        return True, True

    # --- 플랜 A: 자막 추출 + 텍스트 분석 ---
    try:
        transcript_path = get_clean_transcript(video_url)
        if transcript_path:
            file_name = os.path.basename(transcript_path)
            if analyze_sermon(file_name):
                print(f"✅ [{index}/{total}] 플랜 A 완료: {video_id}")
                return True, False
            print(f"⚠️ [{index}/{total}] 플랜 A 분석 실패 → 플랜 B 시도: {video_id}")
        else:
            print(f"⚠️ [{index}/{total}] 자막 없음/추출 실패 → 플랜 B 시도: {video_id}")
    except Exception as e:
        print(f"⚠️ [{index}/{total}] 플랜 A 예외 ({video_id}): {e} → 플랜 B 시도")

    # --- 플랜 B: 오디오 다운로드 + 업로드 분석 ---
    try:
        audio_path = download_audio_m4a(video_url, video_id)
        if not audio_path:
            print(f"❌ [{index}/{total}] 플랜 B 오디오 다운로드 실패: {video_id}")
            return False, False

        if analyze_sermon_from_audio(video_id, audio_path):
            print(f"✅ [{index}/{total}] 플랜 B 완료: {video_id}")
            return True, False

        print(f"❌ [{index}/{total}] 플랜 B 분석 실패: {video_id}")
        return False, False

    except Exception as e:
        print(f"❌ [{index}/{total}] 플랜 B 예외 ({video_id}): {e}")
        return False, False


def process_playlist(playlist_url: str) -> None:
    print("👀 재생목록 정보를 가져오는 중입니다...")

    ydl_opts = {
        "extract_flat": True,
        "quiet": True,
    }

    try:
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
                video_url, video_id, index, total_videos
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
    target_playlist_url = (
        "https://www.youtube.com/playlist?list=PLGpyTA6CZTZ18XLynWXBUcHaeJM8nwmYw"
    )
    process_playlist(target_playlist_url)
