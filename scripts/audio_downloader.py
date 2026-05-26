"""yt-dlp로 YouTube 영상에서 오디오(m4a 우선)만 다운로드."""

import yt_dlp

from project_env import PROJECT_ROOT
AUDIO_DIR = PROJECT_ROOT / "audio"


def download_audio_m4a(video_url: str, video_id: str) -> str | None:
    """
    [플랜 B] 오디오만 audio/{video_id}.m4a (또는 사용 가능한 오디오 확장자)로 저장.
    실패 시 None 반환.
    """
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    for ext in ("m4a", "webm", "opus", "mp3", "mp4"):
        existing = AUDIO_DIR / f"{video_id}.{ext}"
        if existing.is_file() and existing.stat().st_size > 0:
            print(f"ℹ️ [플랜 B] 기존 오디오 사용: {existing}")
            return str(existing)

    outtmpl = str(AUDIO_DIR / f"{video_id}.%(ext)s")
    ydl_opts = {
        "format": "bestaudio[ext=m4a]/bestaudio[ext=m4a]/bestaudio/best",
        "outtmpl": outtmpl,
        "noplaylist": True,
        "quiet": False,
        "no_warnings": False,
        "ignoreerrors": False,
        "retries": 3,
        "fragment_retries": 3,
    }

    try:
        print(f"⬇️ [플랜 B] 오디오 다운로드 시작: {video_id}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])

        for ext in ("m4a", "webm", "opus", "mp3", "mp4"):
            path = AUDIO_DIR / f"{video_id}.{ext}"
            if path.is_file() and path.stat().st_size > 0:
                print(f"✅ [플랜 B] 오디오 다운로드 완료: {path}")
                return str(path)

        print(f"❌ [플랜 B] 다운로드 후 파일을 찾을 수 없음: {video_id}")
        return None

    except Exception as e:
        print(f"❌ [플랜 B] 오디오 다운로드 실패 ({video_id}): {e}")
        return None
