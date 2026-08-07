"""Visit-record storage (트랙 D — 맛집 지도, IMPLEMENTATION_PLAN.md §8).

SQLite file, no per-user separation (10 concurrent users, shared log by
design — see plan). sqlite3 stdlib calls block the event loop briefly per
call; fine at this scale.
# ponytail: sync sqlite3 in an async app — fine under ~10 users doing
# occasional writes, switch to a thread pool / aiosqlite if that stops holding.
"""

from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DB_PATH = Path(os.environ.get("VISITS_DB_PATH", Path(__file__).parent / "data" / "visits.db"))


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS visits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kakao_place_id TEXT,
                place_name TEXT NOT NULL,
                address TEXT,
                lat REAL,
                lng REAL,
                rating INTEGER,
                note TEXT,
                visited_at TEXT NOT NULL
            )
            """
        )


def insert_visit(
    *,
    kakao_place_id: str,
    place_name: str,
    address: str,
    lat: float,
    lng: float,
    rating: int | None,
    note: str,
) -> int:
    with _connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO visits (kakao_place_id, place_name, address, lat, lng, rating, note, visited_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                kakao_place_id,
                place_name,
                address,
                lat,
                lng,
                rating,
                note,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        return cur.lastrowid


def list_visits() -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM visits ORDER BY visited_at DESC").fetchall()
        return [dict(row) for row in rows]
