import json
import os
import sys
from pathlib import Path

import requests

SCRIPTS_DIR = Path(__file__).resolve().parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

from project_env import PROJECT_ROOT, load_supabase_env

load_supabase_env()

url = (os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL") or "").rstrip(
    "/"
)
key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY") or ""

if not url or not key:
    raise SystemExit(
        "[ERROR] .env.local 에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY 가 필요합니다."
    )

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates,return=minimal",
}

db_url = f"{url}/rest/v1/sermons"
output_dir = PROJECT_ROOT / "output"
MIGRATION_SQL = (
    PROJECT_ROOT / "supabase" / "migrations" / "20260526000000_add_decision_prayer.sql"
)


def normalize_grace_notes(raw: object) -> list[dict]:
    """JSON grace_notes → Supabase jsonb 컬럼용 배열."""
    if raw is None:
        return []

    data = raw
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except json.JSONDecodeError:
            return []

    if not isinstance(data, list):
        return []

    notes: list[dict] = []
    for item in data:
        if not isinstance(item, dict):
            continue

        quote = (
            item.get("quote")
            or item.get("text")
            or item.get("content")
            or item.get("note")
        )
        if not quote or not str(quote).strip():
            continue

        seconds = item.get("start_time_seconds") or item.get("startTimeSeconds")
        if isinstance(seconds, str) and seconds.isdigit():
            seconds = int(seconds)
        if not isinstance(seconds, (int, float)) or seconds != seconds:
            seconds = 0
        else:
            seconds = max(0, int(seconds))

        time_text = (
            item.get("start_time_text")
            or item.get("start_time")
            or item.get("startTimeText")
            or item.get("startTime")
            or item.get("timestamp")
            or ""
        )
        time_text = str(time_text).strip()

        notes.append(
            {
                "quote": str(quote).strip(),
                "start_time_text": time_text,
                "start_time_seconds": seconds,
            }
        )

    return notes


def normalize_decision_prayer(raw: object) -> dict | None:
    """JSON decision_prayer → Supabase jsonb 객체."""
    if raw is None:
        return None

    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return None

    if not isinstance(raw, dict):
        return None

    text = (
        raw.get("prayer_text")
        or raw.get("prayer")
        or raw.get("text")
        or raw.get("quote")
    )
    if not text or not str(text).strip():
        return None

    seconds = raw.get("start_time_seconds") or raw.get("startTimeSeconds")
    if isinstance(seconds, str) and seconds.isdigit():
        seconds = int(seconds)
    if not isinstance(seconds, (int, float)) or seconds != seconds:
        seconds = 0
    else:
        seconds = max(0, int(seconds))

    time_text = (
        raw.get("start_time_text")
        or raw.get("start_time")
        or raw.get("startTimeText")
        or raw.get("startTime")
        or ""
    )

    return {
        "prayer_text": str(text).strip(),
        "start_time_text": str(time_text).strip(),
        "start_time_seconds": seconds,
    }


def normalize_sermon_date(raw: object) -> str | None:
    """JSON sermon_date → YYYY-MM-DD. 비어 있으면 None (DB 기존값 유지용)."""
    if raw is None:
        return None
    if not isinstance(raw, str):
        return None
    value = raw.strip()
    if not value:
        return None
    if len(value) >= 10 and value[4] == "-" and value[7] == "-":
        return value[:10]
    return None


def build_row(
    video_id: str,
    data: dict,
    *,
    include_decision_prayer: bool,
) -> dict:
    """
    upsert payload. JSON에 sermon_date가 비어 있으면 필드를 넣지 않아
    DB에 이미 채워 둔 날짜(fix_dates.py)가 null로 덮이지 않게 한다.
    """
    row: dict = {
        "id": video_id,
        "title": data.get("title", ""),
        "core_bible_verse": data.get("core_bible_verse", ""),
        "keywords": data.get("keywords", []),
        "summary": data.get("summary", ""),
        "points": data.get("points", []),
        "grace_notes": normalize_grace_notes(data.get("grace_notes")),
    }

    if include_decision_prayer:
        decision_prayer = normalize_decision_prayer(data.get("decision_prayer"))
        if decision_prayer:
            row["decision_prayer"] = decision_prayer

    sermon_date = normalize_sermon_date(data.get("sermon_date"))
    if sermon_date:
        row["sermon_date"] = sermon_date

    return row


def _parse_error_body(response: requests.Response) -> dict:
    try:
        payload = response.json()
        if isinstance(payload, dict):
            return payload
    except (json.JSONDecodeError, ValueError):
        pass
    return {}


def is_missing_column_error(response: requests.Response, column: str) -> bool:
    """스키마에 컬럼이 없을 때 (PostgREST PGRST204 또는 Postgres 42703)."""
    if response.status_code != 400:
        return False
    body = _parse_error_body(response)
    message = str(body.get("message", ""))
    if column not in message:
        return False
    code = str(body.get("code", ""))
    if code == "PGRST204":
        return True
    if code == "42703" or "does not exist" in message.lower():
        return True
    return False


def decision_prayer_column_exists() -> bool:
    """업로드 전 sermons.decision_prayer 컬럼 존재 여부 확인."""
    response = requests.get(
        db_url,
        headers={**headers, "Prefer": "return=minimal"},
        params={"select": "id,decision_prayer", "limit": "1"},
        timeout=30,
    )
    if response.status_code == 200:
        return True
    if is_missing_column_error(response, "decision_prayer"):
        return False
    print(
        f"[WARN] decision_prayer 컬럼 확인 중 예상치 못한 응답 "
        f"({response.status_code}): {response.text[:200]}"
    )
    return False


def upsert_row(row: dict) -> requests.Response:
    return requests.post(
        db_url,
        headers=headers,
        params={"on_conflict": "id"},
        json=row,
        timeout=60,
    )


def print_decision_prayer_migration_hint() -> None:
    print(
        "\n[HINT] Supabase에 decision_prayer 컬럼이 없습니다.\n"
        "  Dashboard → SQL Editor 에서 아래 파일 내용을 실행하세요:\n"
        f"  {MIGRATION_SQL}\n"
        "  또는 한 줄:\n"
        "  alter table public.sermons add column if not exists decision_prayer jsonb;\n"
        "  실행 후 python upload_to_db.py 를 다시 돌리면 결단의 기도도 반영됩니다.\n"
    )


def main() -> None:
    if not output_dir.is_dir():
        raise SystemExit(f"[ERROR] output 폴더가 없습니다: {output_dir}")

    include_decision_prayer = decision_prayer_column_exists()
    if not include_decision_prayer:
        print(
            "[WARN] sermons.decision_prayer 컬럼이 DB에 없습니다. "
            "결단의 기도 필드는 제외하고 나머지만 업로드합니다."
        )
        print_decision_prayer_migration_hint()

    ok_count = 0
    fail_count = 0
    skipped_prayer_count = 0
    retried_without_prayer = False

    for filename in sorted(os.listdir(output_dir)):
        if not filename.endswith(".json"):
            continue

        video_id = filename.replace("result_transcript_", "").replace(".json", "")
        filepath = output_dir / filename

        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        row = build_row(
            video_id,
            data,
            include_decision_prayer=include_decision_prayer,
        )
        note_count = len(row["grace_notes"])
        had_prayer_in_json = normalize_decision_prayer(data.get("decision_prayer")) is not None

        if not include_decision_prayer and had_prayer_in_json:
            skipped_prayer_count += 1

        response = upsert_row(row)

        if response.status_code in (200, 201, 204):
            ok_count += 1
            prayer_note = ""
            if "decision_prayer" in row:
                prayer_note = ", decision_prayer: 1"
            print(f"[OK] {video_id} upsert (grace_notes: {note_count}개{prayer_note})")
            continue

        if (
            include_decision_prayer
            and "decision_prayer" in row
            and is_missing_column_error(response, "decision_prayer")
        ):
            include_decision_prayer = False
            if not retried_without_prayer:
                print_decision_prayer_migration_hint()
            row = build_row(video_id, data, include_decision_prayer=False)
            if had_prayer_in_json:
                skipped_prayer_count += 1
            response = upsert_row(row)
            retried_without_prayer = True
            if response.status_code in (200, 201, 204):
                ok_count += 1
                print(
                    f"[OK] {video_id} upsert (grace_notes: {note_count}개, "
                    "decision_prayer: DB 컬럼 없음 → 제외)"
                )
                continue

        fail_count += 1
        print(f"[FAIL] {video_id} ({response.status_code}): {response.text}")

    print(f"\n완료: 성공 {ok_count}건, 실패 {fail_count}건")
    if skipped_prayer_count:
        print(
            f"  결단의 기도(JSON에 있으나 DB 컬럼 없어 제외): {skipped_prayer_count}건 "
            "→ SQL 실행 후 upload_to_db.py 재실행"
        )


if __name__ == "__main__":
    main()
