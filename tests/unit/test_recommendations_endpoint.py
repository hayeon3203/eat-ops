"""Unit self-check for main.py's /api/recommendations routes.

kakao.search_places and db.DB_PATH are monkeypatched — no network needed.
Run manually:

    apps/agent-api/.venv/bin/python tests/unit/test_recommendations_endpoint.py
"""

from __future__ import annotations

import asyncio
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "apps" / "agent-api"))

import db  # noqa: E402
import kakao  # noqa: E402
import main  # noqa: E402
from fastapi import HTTPException  # noqa: E402


def check_add_ok() -> bool:
    async def fake_search_places(query, **kwargs):
        # phone/category present (even if empty) because real search_places
        # results always carry them via kakao._to_place — this fake mirrors
        # that shape rather than the pre-Task-1 partial dict.
        return [
            kakao.KakaoPlace(
                kakao_place_id="1", place_name="테스트식당", address="서울", lat=37.5, lng=127.0, phone="", category=""
            )
        ]

    original_search = kakao.search_places
    kakao.search_places = fake_search_places
    with tempfile.TemporaryDirectory() as tmpdir:
        db.DB_PATH = Path(tmpdir) / "test.db"
        db.init_db()
        try:
            body = main.RecommendationIn(place_name="테스트식당", occasion="점심장소", food_type="면", cuisine="일식")
            result = asyncio.run(main.add_recommendation_endpoint(body))
            ok = result["place_name"] == "테스트식당" and result["occasion"] == "점심장소"
            print(f"[add_ok] {'ok' if ok else 'FAILED'} result={result!r}")
            return ok
        finally:
            kakao.search_places = original_search


def check_add_invalid_category() -> bool:
    with tempfile.TemporaryDirectory() as tmpdir:
        db.DB_PATH = Path(tmpdir) / "test2.db"
        db.init_db()
        body = main.RecommendationIn(place_name="아무거나", food_type="피자")
        try:
            asyncio.run(main.add_recommendation_endpoint(body))
            ok = False
        except HTTPException as e:
            ok = e.status_code == 400
        print(f"[add_invalid_category] {'ok' if ok else 'FAILED'}")
        return ok


def check_get_recommendations_reads_db() -> bool:
    with tempfile.TemporaryDirectory() as tmpdir:
        db.DB_PATH = Path(tmpdir) / "test3.db"
        db.init_db()
        db.insert_recommendation(
            kakao_place_id="1",
            place_name="조회테스트",
            address="서울",
            lat=37.5,
            lng=127.0,
            occasion=None,
            food_type=None,
            cuisine=None,
            note="",
        )
        result = main.get_recommendations()
        ok = len(result) == 1 and result[0]["place_name"] == "조회테스트"
        print(f"[get_recommendations_reads_db] {'ok' if ok else 'FAILED'}")
        return ok


def check_delete_removes_row() -> bool:
    with tempfile.TemporaryDirectory() as tmpdir:
        db.DB_PATH = Path(tmpdir) / "test4.db"
        db.init_db()
        inserted = db.insert_recommendation(
            kakao_place_id="1",
            place_name="삭제테스트",
            address="서울",
            lat=37.5,
            lng=127.0,
            occasion=None,
            food_type=None,
            cuisine=None,
            note="테스트 이유",
        )
        result = main.delete_recommendation_endpoint(inserted["id"])
        ok = result["deleted"] == inserted["id"] and db.list_recommendations() == []
        print(f"[delete_removes_row] {'ok' if ok else 'FAILED'}")
        return ok


def demo() -> None:
    results = {
        "add_ok": check_add_ok(),
        "add_invalid_category": check_add_invalid_category(),
        "get_recommendations_reads_db": check_get_recommendations_reads_db(),
        "delete_removes_row": check_delete_removes_row(),
    }
    print("\n=== summary ===")
    for name, ok in results.items():
        print(f"{name}: {'PASS' if ok else 'FAIL'}")
    assert all(results.values()), "recommendations endpoint self-check failed"


if __name__ == "__main__":
    demo()
