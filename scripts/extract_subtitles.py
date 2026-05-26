import os
import re
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable,
)

from project_env import PROJECT_ROOT


def extract_video_id(video_url: str) -> str:
    """YouTube URL 또는 ID에서 video_id 추출."""
    if not video_url:
        raise ValueError("video_url이 비어 있습니다.")

    if re.fullmatch(r"[\w-]{11}", video_url):
        return video_url

    if "youtu.be/" in video_url:
        return video_url.split("youtu.be/")[-1].split("?")[0].split("/")[0]

    if "v=" in video_url:
        return video_url.split("v=")[-1].split("&")[0].split("#")[0]

    if "/shorts/" in video_url:
        return video_url.split("/shorts/")[-1].split("?")[0].split("/")[0]

    raise ValueError(f"video_id를 추출할 수 없습니다: {video_url}")


def get_clean_transcript(video_url: str) -> str | None:
    """
    [플랜 A] youtube-transcript-api로 자막 추출.
    실패 시 None 반환 (예외를 밖으로 던지지 않음).
    """
    try:
        video_id = extract_video_id(video_url)
    except ValueError as e:
        print(f"❌ [플랜 A] URL 파싱 실패: {e}")
        return None

    try:
        ytt_api = YouTubeTranscriptApi()
        transcript = ytt_api.fetch(video_id, languages=["ko", "ko-KR"])

        transcripts_dir = PROJECT_ROOT / "transcripts"
        transcripts_dir.mkdir(parents=True, exist_ok=True)
        file_path = transcripts_dir / f"transcript_{video_id}.txt"

        with open(file_path, "w", encoding="utf-8") as f:
            for item in transcript:
                start_time = item.start
                text = item.text
                minutes = int(start_time // 60)
                seconds = int(start_time % 60)
                time_str = f"[{minutes:02d}:{seconds:02d}]"
                f.write(f"{time_str} {text}\n")

        print(f"✅ [플랜 A] 자막 추출 성공: {file_path}")
        return str(file_path)

    except (NoTranscriptFound, TranscriptsDisabled) as e:
        print(f"⚠️ [플랜 A] 자막 없음 ({video_id}): {e}")
        return None
    except VideoUnavailable as e:
        print(f"⚠️ [플랜 A] 영상 이용 불가 ({video_id}): {e}")
        return None
    except Exception as e:
        print(f"⚠️ [플랜 A] 자막 추출 실패 ({video_id}, 플랜 B로 우회): {e}")
        return None


if __name__ == "__main__":
    test_url = "https://www.youtube.com/watch?v=YHYBSmX6fHI"
    get_clean_transcript(test_url)
