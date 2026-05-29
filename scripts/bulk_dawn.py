"""새벽기도회 재생목록 일괄 처리 (service_type='새벽').

설교만 편집된 새벽 영상 재생목록을 통째로 분석한다.
주일과 동일한 플랜 A(자막) → 플랜 B(오디오) 파이프라인이며,
service_type='새벽' 이 JSON에 기록되어 → 요약벡터만 + 오늘의 말씀 제외로 흐른다.

사용법:
    python scripts/bulk_dawn.py
    python scripts/bulk_dawn.py --fresh   # 기존 output JSON·audio 전부 삭제 후 재분석

매일 새 영상 1개만 추가할 때는 재생목록 대신:
    python scripts/bulk_one.py --type dawn <영상ID>
"""

import argparse
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from bulk_processors import process_playlist
from sermon_sources import get_source


def main() -> None:
    parser = argparse.ArgumentParser(description="새벽기도회 재생목록 bulk 분석")
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

    source = get_source("dawn")
    process_playlist(
        source["playlist_url"],
        service_type=source["service_type"],
    )


if __name__ == "__main__":
    main()
