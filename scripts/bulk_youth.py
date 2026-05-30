"""청년예배 재생목록 일괄 처리 (service_type='청년').

풀영상(찬양·기도·봉독 포함) 재생목록을 통째로 분석한다.
Gemini가 설교 본문 구간을 알아서 찾아 요약·포인트를 만든다.

- service_type='청년' → 요약벡터만 (멀티벡터 미생성) + 오늘의 말씀 제외
- 설교자 이름은 유튜브 제목에서 자동 추출 (OOO 목사 패턴)
- 결과는 /archive/youth 보관함에 표시

사용법:
    python scripts/bulk_youth.py
    python scripts/bulk_youth.py --fresh   # 기존 output JSON·audio 전부 삭제 후 재분석

매주 새 영상 1개만 추가할 때:
    python scripts/bulk_one.py --type youth <영상ID>
"""

import argparse
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from bulk_processors import process_playlist
from sermon_sources import get_source


def main() -> None:
    parser = argparse.ArgumentParser(description="청년예배 재생목록 bulk 분석")
    parser.add_argument(
        "--fresh",
        action="store_true",
        help="시작 전 output JSON + audio 전부 삭제 (전체 재분석)",
    )
    args = parser.parse_args()

    if args.fresh:
        from reset_bulk_artifacts import _delete_glob

        from project_env import PROJECT_ROOT

        audio_dir = PROJECT_ROOT / "audio"
        n_json = _delete_glob(PROJECT_ROOT / "output", "result_transcript_*.json")
        n_audio = 0
        if audio_dir.is_dir():
            for p in audio_dir.iterdir():
                if p.is_file():
                    p.unlink()
                    n_audio += 1
        print(f"🗑️ --fresh: JSON {n_json}개, audio {n_audio}개 삭제 후 시작합니다.\n")

    source = get_source("youth")
    process_playlist(
        source["playlist_url"],
        service_type=source["service_type"],
        full_video=source["full_video"],
    )


if __name__ == "__main__":
    main()
