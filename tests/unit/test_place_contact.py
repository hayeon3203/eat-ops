"""Unit self-check for phone/category plumbing (선택한 장소 패널).

Temp SQLite file via db.DB_PATH monkeypatch — no shared state with the real
data file. Run manually:

    apps/agent-api/.venv/bin/python tests/unit/test_place_contact.py
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "apps" / "agent-api"))

import db  # noqa: E402
import kakao  # noqa: E402


def check_kakao_maps_phone() -> bool:
    """Kakao's document keeps phone and the full category path."""
    doc = {
        "id": "26338954",
        "place_name": "역전우동0410 강남점",
        "road_address_name": "서울 강남구 테헤란로 123",
        "address_name": "서울 강남구 역삼동 1-1",
        "category_name": "음식점 > 일식 > 우동",
        "phone": "02-123-4567",
        "x": "127.0276",
        "y": "37.4979",
        "place_url": "http://place.map.kakao.com/26338954",
    }
    place = kakao._to_place(doc)
    ok = (
        place["phone"] == "02-123-4567"
        and place["category"] == "음식점 > 일식 > 우동"
        and place["address"] == "서울 강남구 테헤란로 123"
    )
    print(f"[kakao_maps_phone] {'ok' if ok else 'FAILED'} place={place!r}")
    return ok


def check_kakao_missing_phone() -> bool:
    """Places with no registered phone must map to empty string, not KeyError."""
    place = kakao._to_place({"id": "1", "place_name": "무전화식당", "x": "127.0", "y": "37.5"})
    ok = place["phone"] == "" and place["category"] == ""
    print(f"[kakao_missing_phone] {'ok' if ok else 'FAILED'} place={place!r}")
    return ok


def check_visit_roundtrip() -> bool:
    with tempfile.TemporaryDirectory() as tmpdir:
        db.DB_PATH = Path(tmpdir) / "test.db"
        db.init_db()
        row = db.insert_visit(
            kakao_place_id="26338954",
            place_name="역전우동0410 강남점",
            address="서울 강남구 테헤란로 123",
            lat=37.4979,
            lng=127.0276,
            rating=4,
            note="",
            phone="02-123-4567",
            category="음식점 > 일식 > 우동",
        )
        listed = db.list_visits(place_id="26338954")
        ok = (
            row["phone"] == "02-123-4567"
            and row["category"] == "음식점 > 일식 > 우동"
            and len(listed) == 1
            and listed[0]["phone"] == "02-123-4567"
        )
        print(f"[visit_roundtrip] {'ok' if ok else 'FAILED'} row={row!r}")
        return ok


def check_visit_defaults_null() -> bool:
    """Existing callers that don't pass phone/category still work — the old
    rows in the shipped DB stay NULL and the UI hides those lines."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db.DB_PATH = Path(tmpdir) / "test.db"
        db.init_db()
        row = db.insert_visit(
            kakao_place_id="1",
            place_name="옛날식당",
            address="서울",
            lat=37.5,
            lng=127.0,
            rating=3,
            note="",
        )
        ok = row["phone"] is None and row["category"] is None
        print(f"[visit_defaults_null] {'ok' if ok else 'FAILED'} row={row!r}")
        return ok


def check_recommendation_roundtrip() -> bool:
    with tempfile.TemporaryDirectory() as tmpdir:
        db.DB_PATH = Path(tmpdir) / "test.db"
        db.init_db()
        row = db.insert_recommendation(
            kakao_place_id="26338954",
            place_name="역전우동0410 강남점",
            address="서울 강남구 테헤란로 123",
            lat=37.4979,
            lng=127.0276,
            occasion="점심장소",
            food_type="면",
            cuisine="일식",
            note="",
            phone="02-123-4567",
            category="음식점 > 일식 > 우동",
        )
        listed = db.list_recommendations()
        ok = (
            row["phone"] == "02-123-4567"
            and len(listed) == 1
            and listed[0]["category"] == "음식점 > 일식 > 우동"
        )
        print(f"[recommendation_roundtrip] {'ok' if ok else 'FAILED'} row={row!r}")
        return ok


def demo() -> None:
    results = {
        "kakao_maps_phone": check_kakao_maps_phone(),
        "kakao_missing_phone": check_kakao_missing_phone(),
        "visit_roundtrip": check_visit_roundtrip(),
        "visit_defaults_null": check_visit_defaults_null(),
        "recommendation_roundtrip": check_recommendation_roundtrip(),
    }
    print("\n=== summary ===")
    for name, ok in results.items():
        print(f"{name}: {'PASS' if ok else 'FAIL'}")
    assert all(results.values()), "place contact self-check failed"


if __name__ == "__main__":
    demo()
