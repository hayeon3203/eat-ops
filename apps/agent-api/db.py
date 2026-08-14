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
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS recommendations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kakao_place_id TEXT,
                place_name TEXT NOT NULL,
                address TEXT,
                lat REAL,
                lng REAL,
                occasion TEXT,
                food_type TEXT,
                cuisine TEXT,
                note TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        # Added after the tables already shipped — CREATE TABLE IF NOT EXISTS
        # above doesn't retrofit existing DB files.
        for table, column, coltype in (
            ("recommendations", "price", "INTEGER"),
            # Review authorship. `author` is display-only; `author_id` (a
            # localStorage UUID) is the real key, so two browsers landing on
            # the same random nickname still keep their reviews apart.
            ("visits", "author", "TEXT"),
            ("visits", "author_id", "TEXT"),
        ):
            try:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {coltype}")
            except sqlite3.OperationalError:
                pass  # column already exists


def insert_visit(
    *,
    kakao_place_id: str,
    place_name: str,
    address: str,
    lat: float,
    lng: float,
    rating: int | None,
    note: str,
    author: str | None = None,
    author_id: str | None = None,
) -> dict[str, Any]:
    """A visit row is also a review: rating + note + author. Rows written by
    the chat `record_visit` tool leave author/author_id NULL and render as 익명.
    """
    with _connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO visits
                (kakao_place_id, place_name, address, lat, lng, rating, note, author, author_id, visited_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                kakao_place_id,
                place_name,
                address,
                lat,
                lng,
                rating,
                note,
                author,
                author_id,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        row = conn.execute("SELECT * FROM visits WHERE id = ?", (cur.lastrowid,)).fetchone()
        return dict(row)


def list_visits(*, place_id: str | None = None, author_id: str | None = None) -> list[dict[str, Any]]:
    where, params = [], []
    if place_id is not None:
        where.append("kakao_place_id = ?")
        params.append(place_id)
    if author_id is not None:
        where.append("author_id = ?")
        params.append(author_id)
    sql = "SELECT * FROM visits"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY visited_at DESC"
    with _connect() as conn:
        return [dict(row) for row in conn.execute(sql, params).fetchall()]


def delete_visit(visit_id: int, *, author_id: str) -> bool:
    """Returns False when the row doesn't exist or belongs to someone else.

    # ponytail: author_id is client-supplied and forgeable — there is no login
    # to bind it to. This is a UI-level guard for a ~10-person shared-passcode
    # deployment, not real ownership enforcement. See the spec's security note.
    """
    with _connect() as conn:
        cur = conn.execute("DELETE FROM visits WHERE id = ? AND author_id = ?", (visit_id, author_id))
        return cur.rowcount > 0


def insert_recommendation(
    *,
    kakao_place_id: str,
    place_name: str,
    address: str,
    lat: float,
    lng: float,
    occasion: str | None,
    food_type: str | None,
    cuisine: str | None,
    note: str,
    price: int | None = None,
) -> dict[str, Any]:
    with _connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO recommendations
                (kakao_place_id, place_name, address, lat, lng, occasion, food_type, cuisine, note, price, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                kakao_place_id,
                place_name,
                address,
                lat,
                lng,
                occasion,
                food_type,
                cuisine,
                note,
                price,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        row = conn.execute("SELECT * FROM recommendations WHERE id = ?", (cur.lastrowid,)).fetchone()
        return dict(row)


def list_recommendations() -> list[dict[str, Any]]:
    """Carries each place's review summary so the sidebar can render the
    `★ 4.3 · 리뷰 3` line without a per-card request. Review bodies are fetched
    separately (list_visits(place_id=...)) only when a card is expanded."""
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT r.*,
                   ROUND(AVG(v.rating), 1) AS rating_avg,
                   COUNT(v.rating) AS review_count
            FROM recommendations r
            LEFT JOIN visits v
                   ON v.kakao_place_id = r.kakao_place_id AND v.rating IS NOT NULL
            GROUP BY r.id
            ORDER BY r.created_at DESC
            """
        ).fetchall()
        return [dict(row) for row in rows]


def delete_recommendation(recommendation_id: int) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM recommendations WHERE id = ?", (recommendation_id,))
