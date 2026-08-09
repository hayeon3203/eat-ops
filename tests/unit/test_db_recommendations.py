"""Unit self-check for db.py's recommendations table.

Uses a temp SQLite file (via db.DB_PATH monkeypatch) — no shared state
with the real data file. Run manually:

    apps/agent-api/.venv/bin/python tests/unit/test_db_recommendations.py
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "apps" / "agent-api"))

import db  # noqa: E402


def check_insert_and_list() -> bool:
    with tempfile.TemporaryDirectory() as tmpdir:
        db.DB_PATH = Path(tmpdir) / "test.db"
        db.init_db()
        row = db.insert_recommendation(
            kakao_place_id="123",
            place_name="테스트식당",
            address="서울",
            lat=37.5,
            lng=127.0,
            occasion="점심장소",
            food_type="면",
            cuisine="일식",
            note="맛있음",
        )
        ok_insert = row["place_name"] == "테스트식당" and row["occasion"] == "점심장소" and row["cuisine"] == "일식"
        listed = db.list_recommendations()
        ok_list = len(listed) == 1 and listed[0]["id"] == row["id"]
        print(f"[insert_and_list] {'ok' if ok_insert and ok_list else 'FAILED'} row={row!r}")
        return ok_insert and ok_list


def check_null_axes_allowed() -> bool:
    with tempfile.TemporaryDirectory() as tmpdir:
        db.DB_PATH = Path(tmpdir) / "test2.db"
        db.init_db()
        row = db.insert_recommendation(
            kakao_place_id="456",
            place_name="무분류식당",
            address="서울",
            lat=37.5,
            lng=127.0,
            occasion=None,
            food_type=None,
            cuisine=None,
            note="",
        )
        ok = row["occasion"] is None and row["food_type"] is None and row["cuisine"] is None
        print(f"[null_axes_allowed] {'ok' if ok else 'FAILED'} row={row!r}")
        return ok


def demo() -> None:
    results = {
        "insert_and_list": check_insert_and_list(),
        "null_axes_allowed": check_null_axes_allowed(),
    }
    print("\n=== summary ===")
    for name, ok in results.items():
        print(f"{name}: {'PASS' if ok else 'FAIL'}")
    assert all(results.values()), "db recommendations self-check failed"


if __name__ == "__main__":
    demo()
