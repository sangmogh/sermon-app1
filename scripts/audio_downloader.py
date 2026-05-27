"""yt-dlp로 YouTube 영상에서 오디오(m4a 우선)만 다운로드."""

import yt_dlp

from project_env import PROJECT_ROOT
from ytdlp_auth import is_youtube_bot_block_error, merge_ytdlp_auth_opts, ytdlp_auth_status_line

AUDIO_DIR = PROJECT_ROOT / "audio"
AUDIO_EXTENSIONS = ("m4a", "webm", "opus", "mp3", "mp4")


def delete_audio_files(video_id: str) -> int:
    """해당 영상 ID의 로컬 오디오 캐시 삭제."""
    deleted = 0
    for ext in AUDIO_EXTENSIONS:
        path = AUDIO_DIR / f"{video_id}.{ext}"
        if path.is_file():
            path.unlink()
            deleted += 1
    return deleted


def download_audio_m4a(video_url: str, video_id: str) -> str | None:
    """
    [플랜 B] 오디오만 audio/{video_id}.* 로 저장.
    기존 파일은 항상 삭제 후 새로 받음 (예전 오디오 재사용 금지).
    """
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    removed = delete_audio_files(video_id)
    if removed:
        print(f"🗑️ [플랜 B] 기존 오디오 {removed}개 삭제 후 재다운로드: {video_id}")

    outtmpl = str(AUDIO_DIR / f"{video_id}.%(ext)s")
    ydl_opts = merge_ytdlp_auth_opts(
        {
            "format": "bestaudio[ext=m4a]/bestaudio[ext=m4a]/bestaudio/best",
            "outtmpl": outtmpl,
            "noplaylist": True,
            "quiet": False,
            "no_warnings": False,
            "ignoreerrors": False,
            "retries": 3,
            "fragment_retries": 3,
            "sleep_interval": 1,
            "max_sleep_interval": 5,
        }
    )

    try:
        print(f"⬇️ [플랜 B] 오디오 다운로드 시작: {video_id}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])

        for ext in AUDIO_EXTENSIONS:
            path = AUDIO_DIR / f"{video_id}.{ext}"
            if path.is_file() and path.stat().st_size > 0:
                print(f"✅ [플랜 B] 오디오 다운로드 완료: {path}")
                return str(path)

        print(f"❌ [플랜 B] 다운로드 후 파일을 찾을 수 없음: {video_id}")
        return None

    except Exception as e:
        print(f"❌ [플랜 B] 오디오 다운로드 실패 ({video_id}): {e}")
        if is_youtube_bot_block_error(e):
            print(f"   ℹ️ {ytdlp_auth_status_line()}")
        return None
