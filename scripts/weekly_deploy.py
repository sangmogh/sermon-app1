"""
매주 설교 추가 후 한 번에 배포.

  python scripts/weekly_deploy.py

전제: 먼저 bulk(영상 → JSON 생성)를 끝낸 상태.
이 스크립트가 순서대로 실행:
  1) upload_to_db.py            (JSON → Supabase)
  2) build_sermon_embeddings.py (고민검색 임베딩 인덱스 재생성)
  3) git add/commit/push        (data/sermon-embeddings.json 배포 → Vercel 자동 반영)

옵션:
  --skip-upload     1단계(업로드) 건너뛰기
  --skip-embeddings 2단계(임베딩) 건너뛰기
  --no-push         커밋만 하고 push 안 함
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
EMBEDDING_INDEX = "data/sermon-embeddings.json"


def run(cmd: list[str], *, label: str) -> None:
    print(f"\n{'=' * 60}\n[STEP] {label}\n{'=' * 60}")
    print(f"$ {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=PROJECT_ROOT)
    if result.returncode != 0:
        raise SystemExit(f"[중단] '{label}' 실패 (exit {result.returncode}).")


def git_output(args: list[str]) -> str:
    return subprocess.run(
        ["git", *args],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
    ).stdout.strip()


def main() -> None:
    parser = argparse.ArgumentParser(description="주간 설교 배포 자동화")
    parser.add_argument("--skip-upload", action="store_true")
    parser.add_argument("--skip-embeddings", action="store_true")
    parser.add_argument("--no-push", action="store_true")
    args = parser.parse_args()

    py = sys.executable

    if not args.skip_upload:
        run([py, "upload_to_db.py"], label="1/3 Supabase 업로드 (upload_to_db.py)")
    else:
        print("[SKIP] 1단계 업로드 건너뜀")

    if not args.skip_embeddings:
        run(
            [py, "scripts/build_sermon_embeddings.py"],
            label="2/3 임베딩 인덱스 재생성 (build_sermon_embeddings.py)",
        )
    else:
        print("[SKIP] 2단계 임베딩 건너뜀")

    print(f"\n{'=' * 60}\n[STEP] 3/3 git 커밋 & 푸시\n{'=' * 60}")

    run(["git", "add", EMBEDDING_INDEX], label="git add")

    staged = git_output(["diff", "--cached", "--name-only"])
    if not staged:
        print("[INFO] 변경된 임베딩 인덱스가 없어 커밋할 게 없습니다. (새 설교 없음?)")
        print("[DONE] 배포 단계 종료 (DB 업로드는 위에서 이미 반영됨).")
        return

    stamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    message = f"Rebuild sermon embeddings index ({stamp})"
    run(["git", "commit", "-m", message], label="git commit")

    if args.no_push:
        print("[SKIP] push 생략(--no-push). 나중에 'git push' 하세요.")
        return

    run(["git", "push"], label="git push")
    print("\n[DONE] 배포 완료 — Vercel이 자동으로 새 인덱스를 반영합니다.")


if __name__ == "__main__":
    main()
