"""하위 호환: bulk_processors.py를 실행하세요."""
from bulk_processors import process_playlist

if __name__ == "__main__":
    target_playlist_url = (
        "https://www.youtube.com/playlist?list=PLGpyTA6CZTZ18XLynWXBUcHaeJM8nwmYw"
    )
    process_playlist(target_playlist_url)
