"""
실패·재분석 대상 설교의 output JSON(및 선택적으로 transcript/audio) 삭제.

날짜는 YYYYMMDD 또는 YYYY-MM-DD. Supabase sermon_date + output JSON 내 sermon_date 로
video id를 찾습니다.

사용:
  # 목록만 (기본)
  python scripts/delete_output_for_reprocess.py --dates 20260517 20250126

  # 파일에서 (한 줄에 하나, # 주석 가능)
  python scripts/delete_output_for_reprocess.py --dates-file scripts/reprocess_dates.txt

  # video id 직접
  python scripts/delete_output_for_reprocess.py --ids PZOoiJw9sLs WMj9r2Psr7A

  # 실제 삭제 (+ 자막·오디오도)
  python scripts/delete_output_for_reprocess.py --dates-file scripts/reprocess_dates.txt --delete --transcripts --audio
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

import requests

# Windows 기본 콘솔(cp949)에서 한글·특수문자(—) 출력 시 크래시 방지
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

sys.path.insert(0, str(Path(__file__).resolve().parent))

from project_env import PROJECT_ROOT, load_supabase_env

OUTPUT_DIR = PROJECT_ROOT / "output"
TRANSCRIPTS_DIR = PROJECT_ROOT / "transcripts"
AUDIO_DIR = PROJECT_ROOT / "audio"


def normalize_date_token(raw: str) -> str | None:
    """YYYYMMDD 또는 YYYY-MM-DD → YYYY-MM-DD."""
    value = raw.strip()
    if not value or value.startswith("#"):
        return None
    if re.fullmatch(r"\d{8}", value):
        return f"{value[:4]}-{value[4:6]}-{value[6:8]}"
    if len(value) >= 10 and value[4] == "-" and value[7] == "-":
        return value[:10]
    return None


def load_dates_from_file(path: Path) -> list[str]:
    if not path.is_file():
        raise SystemExit(f"[ERROR] 파일 없음: {path}")
    dates: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        normalized = normalize_date_token(line)
        if normalized:
            dates.append(normalized)
    return dates


def resolve_ids_from_output_json(target_dates: set[str]) -> dict[str, str]:
    """sermon_date 일치하는 output JSON → {video_id: iso_date}."""
    found: dict[str, str] = {}
    if not OUTPUT_DIR.is_dir():
        return found

    for path in OUTPUT_DIR.glob("result_transcript_*.json"):
        video_id = path.stem.replace("result_transcript_", "")
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        sd = data.get("sermon_date")
        if not isinstance(sd, str):
            continue
        iso = normalize_date_token(sd) or (sd.strip()[:10] if sd.strip() else None)
        if iso and iso in target_dates:
            found[video_id] = iso
    return found


def resolve_ids_from_supabase(target_dates: set[str]) -> dict[str, str]:
    """DB sermon_date 일치 → {video_id: iso_date}."""
    load_supabase_env()
    base = (
        os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL") or ""
    ).rstrip("/")
    key = (
        os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY") or ""
    )
    if not base or not key:
        print("[WARN] Supabase env 없음 — DB 조회 생략")
        return {}

    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    found: dict[str, str] = {}

    for iso in sorted(target_dates):
        resp = requests.get(
            f"{base}/rest/v1/sermons",
            headers=headers,
            params={"select": "id,sermon_date", "sermon_date": f"eq.{iso}"},
            timeout=60,
        )
        if resp.status_code != 200:
            print(f"[WARN] DB 조회 실패 ({iso}): {resp.status_code} {resp.text[:120]}")
            continue
        for row in resp.json():
            vid = row.get("id")
            if isinstance(vid, str) and vid:
                found[vid] = iso

    return found


def collect_paths(video_id: str, *, transcripts: bool, audio: bool) -> list[Path]:
    paths = [OUTPUT_DIR / f"result_transcript_{video_id}.json"]
    if transcripts:
        paths.append(TRANSCRIPTS_DIR / f"transcript_{video_id}.txt")
    if audio:
        for ext in ("m4a", "webm", "opus", "mp3", "mp4"):
            paths.append(AUDIO_DIR / f"{video_id}.{ext}")
    return paths


def main() -> None:
    parser = argparse.ArgumentParser(
        description="재분석 대상 output JSON 등 삭제 (날짜 또는 video id)"
    )
    parser.add_argument(
        "--dates",
        nargs="*",
        default=[],
        help="날짜 (YYYYMMDD 또는 YYYY-MM-DD)",
    )
    parser.add_argument(
        "--dates-file",
        type=Path,
        help="날짜 목록 파일 (한 줄에 하나)",
    )
    parser.add_argument(
        "--ids",
        nargs="*",
        default=[],
        help="YouTube video id 직접 지정",
    )
    parser.add_argument(
        "--delete",
        action="store_true",
        help="실제 삭제 (없으면 목록만)",
    )
    parser.add_argument(
        "--transcripts",
        action="store_true",
        help="transcripts/transcript_{id}.txt 도 삭제",
    )
    parser.add_argument(
        "--audio",
        action="store_true",
        help="audio/{id}.* 도 삭제",
    )
    parser.add_argument(
        "--no-db",
        action="store_true",
        help="Supabase sermon_date 조회 생략",
    )
    parser.add_argument(
        "--no-scan-json",
        action="store_true",
        help="output JSON 내 sermon_date 스캔 생략",
    )
    args = parser.parse_args()

    target_dates: list[str] = []
    for token in args.dates:
        normalized = normalize_date_token(token)
        if normalized:
            target_dates.append(normalized)
    if args.dates_file:
        target_dates.extend(load_dates_from_file(args.dates_file))

    date_set = set(target_dates)
    id_to_date: dict[str, str] = {}

    for vid in args.ids:
        vid = vid.strip()
        if vid:
            id_to_date[vid] = id_to_date.get(vid, "(직접 지정)")

    if date_set:
        print(f"[날짜] {len(date_set)}개: {', '.join(sorted(date_set))}\n")
        if not args.no_scan_json:
            from_json = resolve_ids_from_output_json(date_set)
            id_to_date.update(from_json)
            print(f"  JSON sermon_date 매칭: {len(from_json)}개")
        if not args.no_db:
            from_db = resolve_ids_from_supabase(date_set)
            for vid, iso in from_db.items():
                id_to_date.setdefault(vid, iso)
            print(f"  DB sermon_date 매칭: {len(from_db)}개")

    if not id_to_date:
        raise SystemExit("[ERROR] 삭제할 video id를 찾지 못했습니다. 날짜·id를 확인하세요.")

    print(f"\n[대상] video id {len(id_to_date)}개\n")
    deleted = 0
    missing = 0

    for video_id in sorted(id_to_date):
        iso = id_to_date[video_id]
        print(f"  {video_id}  ({iso})")
        paths = collect_paths(
            video_id, transcripts=args.transcripts, audio=args.audio
        )
        for path in paths:
            if not path.is_file():
                missing += 1
                continue
            if args.delete:
                path.unlink()
                print(f"    삭제: {path.relative_to(PROJECT_ROOT)}")
                deleted += 1
            else:
                print(f"    있음: {path.relative_to(PROJECT_ROOT)}")

    print(
        f"\n{'삭제' if args.delete else '확인'} 완료: "
        f"id {len(id_to_date)}개, 파일 {'삭제 ' if args.delete else ''}{deleted}건, "
        f"없음 {missing}건"
    )
    if not args.delete:
        print("\n실제 삭제: ... --delete")
    else:
        print("\n다음: python scripts/bulk_processors.py → upload_to_db.py")


if __name__ == "__main__":
    main()
