"""
output/result_transcript_*.json 중 결단의 기도가 비어 있는 파일만 골라 삭제(또는 목록만 출력).

사용:
  python scripts/prune_output_json.py              # 목록만 (dry-run)
  python scripts/prune_output_json.py --delete   # 실제 삭제
  python scripts/prune_output_json.py --keep     # 기도 있는 파일만 목록
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from project_env import PROJECT_ROOT

OUTPUT_DIR = PROJECT_ROOT / "output"


def has_decision_prayer(data: dict) -> bool:
    """upload_to_db.normalize_decision_prayer 와 동일 기준."""
    raw = data.get("decision_prayer")
    if raw is None:
        return False
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return False
    if not isinstance(raw, dict):
        return False
    text = (
        raw.get("prayer_text")
        or raw.get("prayer")
        or raw.get("text")
        or raw.get("quote")
    )
    return bool(text and str(text).strip())


def main() -> None:
    parser = argparse.ArgumentParser(description="output JSON 결단의 기도 유무로 정리")
    parser.add_argument(
        "--delete",
        action="store_true",
        help="기도 없는 JSON 파일 삭제",
    )
    parser.add_argument(
        "--keep",
        action="store_true",
        help="기도 있는 파일만 출력",
    )
    args = parser.parse_args()

    if not OUTPUT_DIR.is_dir():
        raise SystemExit(f"[ERROR] 폴더 없음: {OUTPUT_DIR}")

    files = sorted(OUTPUT_DIR.glob("result_transcript_*.json"))
    with_prayer: list[Path] = []
    without_prayer: list[Path] = []

    for path in files:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            print(f"[WARN] 읽기 실패 {path.name}: {exc}")
            without_prayer.append(path)
            continue

        if has_decision_prayer(data):
            with_prayer.append(path)
        else:
            without_prayer.append(path)

    show = with_prayer if args.keep else without_prayer
    label = "기도 있음 (유지)" if args.keep else "기도 없음 (재분석 대상)"

    print(f"[{label}] {len(show)}건 / 전체 {len(files)}건\n")
    for path in show:
        print(f"  {path.name}")

    print(
        f"\n요약: 기도 있음 {len(with_prayer)}건, 없음 {len(without_prayer)}건"
    )

    if args.delete:
        if not without_prayer:
            print("\n삭제할 파일 없음.")
            return
        print(f"\n삭제 중 ({len(without_prayer)}건)...")
        for path in without_prayer:
            path.unlink()
            print(f"  삭제: {path.name}")
        print("완료. 이어서: python scripts/bulk_processors.py")
    elif not args.keep:
        print("\n실제 삭제: python scripts/prune_output_json.py --delete")


if __name__ == "__main__":
    main()
