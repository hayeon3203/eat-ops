"""Unit self-check for the place-review routes (/api/visits + the review
summary joined onto /api/recommendations).

db.DB_PATH is monkeypatched to a temp file — no network, no shared state.
Run manually:

    apps/agent-api/.venv/bin/python tests/unit/test_reviews.py
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "apps" / "agent-api"))

import db  # noqa: E402
import main  # noqa: E402
from fastapi import HTTPException  # noqa: E402

ALICE = "author-alice"
BOB = "author-bob"


def _review(place_id: str, rating: int, author_id: str, author: str, note: str = "") -> main.VisitIn:
    return main.VisitIn(
        kakao_place_id=place_id,
        place_name="테스트식당",
        address="서울",
        lat=37.5,
        lng=127.0,
        rating=rating,
        note=note,
        author=author,
        author_id=author_id,
    )


def _seed(tmpdir: str, name: str) -> None:
    db.DB_PATH = Path(tmpdir) / name
    db.init_db()


def check_two_authors_average() -> bool:
    """Two people rate the same place: both rows survive, average is theirs."""
    with tempfile.TemporaryDirectory() as tmpdir:
        _seed(tmpdir, "avg.db")
        db.insert_recommendation(
            kakao_place_id="p1",
            place_name="테스트식당",
            address="서울",
            lat=37.5,
            lng=127.0,
            occasion=None,
            food_type=None,
            cuisine=None,
            note="",
        )
        main.add_visit_endpoint(_review("p1", 5, ALICE, "곱빼기 시키는 감별사"))
        main.add_visit_endpoint(_review("p1", 4, BOB, "별점 짠 해장러"))
        # A different place must not bleed into p1's average.
        main.add_visit_endpoint(_review("p2", 1, ALICE, "곱빼기 시키는 감별사"))

        rec = main.get_recommendations()[0]
        ok = rec["review_count"] == 2 and rec["rating_avg"] == 4.5
        print(f"[two_authors_average] {'ok' if ok else 'FAILED'} count={rec['review_count']} avg={rec['rating_avg']}")
        return ok


def check_no_reviews_is_zero() -> bool:
    """A place nobody reviewed reports 0 / null, not a crash or a phantom row."""
    with tempfile.TemporaryDirectory() as tmpdir:
        _seed(tmpdir, "empty.db")
        db.insert_recommendation(
            kakao_place_id="p1",
            place_name="리뷰없음",
            address="서울",
            lat=37.5,
            lng=127.0,
            occasion=None,
            food_type=None,
            cuisine=None,
            note="",
        )
        rec = main.get_recommendations()[0]
        ok = rec["review_count"] == 0 and rec["rating_avg"] is None
        print(f"[no_reviews_is_zero] {'ok' if ok else 'FAILED'} count={rec['review_count']} avg={rec['rating_avg']}")
        return ok


def check_place_and_author_filters() -> bool:
    with tempfile.TemporaryDirectory() as tmpdir:
        _seed(tmpdir, "filter.db")
        main.add_visit_endpoint(_review("p1", 5, ALICE, "곱빼기 시키는 감별사"))
        main.add_visit_endpoint(_review("p1", 4, BOB, "별점 짠 해장러"))
        main.add_visit_endpoint(_review("p2", 3, ALICE, "곱빼기 시키는 감별사"))

        by_place = main.get_visits(place_id="p1")
        by_author = main.get_visits(author_id=ALICE)
        unfiltered = main.get_visits()
        ok = (
            len(by_place) == 2
            and len(by_author) == 2
            and {v["kakao_place_id"] for v in by_author} == {"p1", "p2"}
            and len(unfiltered) == 3
        )
        print(f"[place_and_author_filters] {'ok' if ok else 'FAILED'} place={len(by_place)} author={len(by_author)} all={len(unfiltered)}")
        return ok


def check_delete_only_own() -> bool:
    """Bob must not be able to delete Alice's review by guessing its id."""
    with tempfile.TemporaryDirectory() as tmpdir:
        _seed(tmpdir, "delete.db")
        row = main.add_visit_endpoint(_review("p1", 5, ALICE, "곱빼기 시키는 감별사"))

        try:
            main.delete_visit_endpoint(row["id"], author_id=BOB)
            stolen = True
        except HTTPException as e:
            stolen = e.status_code != 404
        survived = len(main.get_visits()) == 1

        main.delete_visit_endpoint(row["id"], author_id=ALICE)
        removed = main.get_visits() == []

        ok = not stolen and survived and removed
        print(f"[delete_only_own] {'ok' if ok else 'FAILED'} stolen={stolen} survived={survived} removed={removed}")
        return ok


def check_rating_range_rejected() -> bool:
    with tempfile.TemporaryDirectory() as tmpdir:
        _seed(tmpdir, "range.db")
        codes = []
        for bad in (0, 6, -1):
            try:
                main.add_visit_endpoint(_review("p1", bad, ALICE, "곱빼기 시키는 감별사"))
                codes.append(None)
            except HTTPException as e:
                codes.append(e.status_code)
        ok = codes == [400, 400, 400] and main.get_visits() == []
        print(f"[rating_range_rejected] {'ok' if ok else 'FAILED'} codes={codes}")
        return ok


def check_chat_visit_has_no_author() -> bool:
    """record_visit (chat tool) writes without author fields; it must still
    count toward the average and read back as an anonymous review."""
    with tempfile.TemporaryDirectory() as tmpdir:
        _seed(tmpdir, "anon.db")
        db.insert_visit(
            kakao_place_id="p1",
            place_name="테스트식당",
            address="서울",
            lat=37.5,
            lng=127.0,
            rating=3,
            note="에이전트가 남김",
        )
        rows = main.get_visits(place_id="p1")
        ok = len(rows) == 1 and rows[0]["author"] is None and rows[0]["author_id"] is None
        print(f"[chat_visit_has_no_author] {'ok' if ok else 'FAILED'} rows={len(rows)}")
        return ok


def demo() -> None:
    results = {
        "two_authors_average": check_two_authors_average(),
        "no_reviews_is_zero": check_no_reviews_is_zero(),
        "place_and_author_filters": check_place_and_author_filters(),
        "delete_only_own": check_delete_only_own(),
        "rating_range_rejected": check_rating_range_rejected(),
        "chat_visit_has_no_author": check_chat_visit_has_no_author(),
    }
    print("\n=== summary ===")
    for name, ok in results.items():
        print(f"{name}: {'PASS' if ok else 'FAIL'}")
    assert all(results.values()), "review endpoint self-check failed"


if __name__ == "__main__":
    demo()
