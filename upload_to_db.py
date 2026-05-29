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
SERVICE_META_MIGRATION_SQL = (
    PROJECT_ROOT
    / "supabase"
    / "migrations"
    / "20260529120000_add_service_type_preacher.sql"
)

# DB에 없을 수 있는 선택 컬럼들 (없으면 자동으로 제외하고 업로드)
OPTIONAL_COLUMNS = ("decision_prayer", "service_type", "preacher")


def _unwrap_list(raw: object) -> list:
    """Gemini가 배열을 dict로 감싸 줄 때 배열을 추출."""
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        for key in ("grace_notes", "notes", "quotes", "items", "list"):
            val = raw.get(key)
            if isinstance(val, list):
                return val
        for val in raw.values():
            if isinstance(val, list):
                return val
    return []


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

    data = _unwrap_list(data)

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
    available: set[str],
) -> dict:
    """
    upsert payload. JSON에 sermon_date가 비어 있으면 필드를 넣지 않아
    DB에 이미 채워 둔 날짜(fix_dates.py)가 null로 덮이지 않게 한다.
    available: DB에 실제로 존재하는 선택 컬럼 집합 (없는 컬럼은 payload에서 제외).
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

    if "decision_prayer" in available:
        decision_prayer = normalize_decision_prayer(data.get("decision_prayer"))
        if decision_prayer:
            row["decision_prayer"] = decision_prayer

    # service_type / preacher: 값이 있을 때만 넣어 기존 값을 빈 값으로 덮지 않는다.
    if "service_type" in available:
        service_type = str(data.get("service_type") or "").strip()
        if service_type:
            row["service_type"] = service_type

    if "preacher" in available:
        preacher = str(data.get("preacher") or "").strip()
        if preacher:
            row["preacher"] = preacher

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


def column_exists(column: str) -> bool:
    """업로드 전 sermons.<column> 컬럼 존재 여부 확인."""
    response = requests.get(
        db_url,
        headers={**headers, "Prefer": "return=minimal"},
        params={"select": f"id,{column}", "limit": "1"},
        timeout=30,
    )
    if response.status_code == 200:
        return True
    if is_missing_column_error(response, column):
        return False
    print(
        f"[WARN] {column} 컬럼 확인 중 예상치 못한 응답 "
        f"({response.status_code}): {response.text[:200]}"
    )
    return False


def probe_available_columns() -> set[str]:
    """존재하는 선택 컬럼만 모은다."""
    return {col for col in OPTIONAL_COLUMNS if column_exists(col)}


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


def print_service_meta_migration_hint(missing: set[str]) -> None:
    cols = ", ".join(sorted(missing))
    print(
        f"\n[HINT] Supabase에 {cols} 컬럼이 없습니다 (예배 종류/설교자).\n"
        "  Dashboard → SQL Editor 에서 아래 파일 내용을 실행하세요:\n"
        f"  {SERVICE_META_MIGRATION_SQL}\n"
        "  또는 한 줄씩:\n"
        "  alter table public.sermons add column if not exists service_type text;\n"
        "  alter table public.sermons add column if not exists preacher text;\n"
        "  실행 후 python upload_to_db.py 를 다시 돌리면 새벽/청년 메타데이터도 반영됩니다.\n"
    )


def main() -> None:
    if not output_dir.is_dir():
        raise SystemExit(f"[ERROR] output 폴더가 없습니다: {output_dir}")

    available = probe_available_columns()
    missing = set(OPTIONAL_COLUMNS) - available

    if "decision_prayer" in missing:
        print(
            "[WARN] sermons.decision_prayer 컬럼이 DB에 없습니다. "
            "결단의 기도 필드는 제외하고 나머지만 업로드합니다."
        )
        print_decision_prayer_migration_hint()

    service_meta_missing = missing & {"service_type", "preacher"}
    if service_meta_missing:
        print(
            f"[WARN] sermons.{', '.join(sorted(service_meta_missing))} 컬럼이 DB에 없습니다. "
            "예배 종류/설교자는 제외하고 나머지만 업로드합니다."
        )
        print_service_meta_migration_hint(service_meta_missing)

    ok_count = 0
    fail_count = 0
    skipped_meta_count = 0

    for filename in sorted(os.listdir(output_dir)):
        if not filename.endswith(".json"):
            continue

        video_id = filename.replace("result_transcript_", "").replace(".json", "")
        filepath = output_dir / filename

        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        row = build_row(video_id, data, available=available)
        note_count = len(row["grace_notes"])

        # JSON엔 있으나 DB 컬럼이 없어 빠진 메타데이터 추적
        json_has_meta = bool(
            normalize_decision_prayer(data.get("decision_prayer"))
            or str(data.get("service_type") or "").strip()
            or str(data.get("preacher") or "").strip()
        )
        row_has_meta = any(
            col in row for col in ("decision_prayer", "service_type", "preacher")
        )
        if json_has_meta and not row_has_meta and missing:
            skipped_meta_count += 1

        response = upsert_row(row)

        if response.status_code in (200, 201, 204):
            ok_count += 1
            extras = [c for c in OPTIONAL_COLUMNS if c in row]
            extra_note = f", {'+'.join(extras)}" if extras else ""
            print(f"[OK] {video_id} upsert (grace_notes: {note_count}개{extra_note})")
            continue

        fail_count += 1
        print(f"[FAIL] {video_id} ({response.status_code}): {response.text}")

    print(f"\n완료: 성공 {ok_count}건, 실패 {fail_count}건")
    if skipped_meta_count:
        print(
            f"  선택 메타데이터(JSON에 있으나 DB 컬럼 없어 제외): {skipped_meta_count}건 "
            "→ 위 SQL 실행 후 upload_to_db.py 재실행"
        )


if __name__ == "__main__":
    main()
