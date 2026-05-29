"""
bulk 전체 재시작: output JSON + audio 캐시 삭제.

  python scripts/reset_bulk_artifacts.py
  python scripts/reset_bulk_artifacts.py --yes
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from project_env import PROJECT_ROOT

OUTPUT_DIR = PROJECT_ROOT / "output"
AUDIO_DIR = PROJECT_ROOT / "audio"
TRANSCRIPTS_DIR = PROJECT_ROOT / "transcripts"


def _count_glob(directory: Path, pattern: str) -> int:
    if not directory.is_dir():
        return 0
    return sum(1 for p in directory.glob(pattern) if p.is_file())


def _delete_glob(directory: Path, pattern: str) -> int:
    if not directory.is_dir():
        return 0
    count = 0
    for path in directory.glob(pattern):
        if path.is_file():
            path.unlink()
            count += 1
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description="bulk용 output/audio/transcripts 삭제")
    parser.add_argument(
        "--yes",
        "-y",
        action="store_true",
        help="확인 없이 삭제",
    )
    parser.add_argument(
        "--keep-transcripts",
        action="store_true",
        help="transcripts/ 는 유지",
    )
    args = parser.parse_args()

    json_n = _count_glob(OUTPUT_DIR, "result_transcript_*.json")
    audio_n = (
        sum(1 for p in AUDIO_DIR.iterdir() if p.is_file()) if AUDIO_DIR.is_dir() else 0
    )
    tr_n = (
        0
        if args.keep_transcripts
        else _count_glob(TRANSCRIPTS_DIR, "transcript_*.txt")
    )

    print(f"[대상] JSON {json_n}개, audio {audio_n}개, transcript {tr_n}개")
    print(f"  output: {OUTPUT_DIR}")
    print(f"  audio:  {AUDIO_DIR}")

    if not args.yes:
        answer = input("삭제할까요? [y/N]: ").strip().lower()
        if answer not in ("y", "yes"):
            print("취소")
            return

    deleted_json = _delete_glob(OUTPUT_DIR, "result_transcript_*.json")
    deleted_audio = 0
    if AUDIO_DIR.is_dir():
        for path in AUDIO_DIR.iterdir():
            if path.is_file():
                path.unlink()
                deleted_audio += 1
    deleted_tr = (
        0
        if args.keep_transcripts
        else _delete_glob(TRANSCRIPTS_DIR, "transcript_*.txt")
    )

    print(f"[완료] JSON {deleted_json}개, audio {deleted_audio}개, transcript {deleted_tr}개 삭제")
    print("이제: python scripts/bulk_processors.py")


if __name__ == "__main__":
    main()
