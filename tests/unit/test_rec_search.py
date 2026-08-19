"""Unit self-check for rec_search.py — axis filtering + distance ranking.

Pure function, no DB and no agent stack. Run manually:

    apps/agent-api/.venv/bin/python tests/unit/test_rec_search.py
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "apps" / "agent-api"))

import rec_search  # noqa: E402

# 서울지사(37.4990, 127.0323) 기준. 강남역이 약 400m, 판교가 약 12km 남쪽.
OFFICE = (37.4990536, 127.0323059)

ROWS = [
    {"place_name": "먼곳", "occasion": "점심장소", "food_type": "면", "cuisine": "일식", "lat": 37.3950, "lng": 127.1105},
    {"place_name": "가까운곳", "occasion": "점심장소", "food_type": "밥", "cuisine": "한식", "lat": 37.4979, "lng": 127.0276},
    {"place_name": "회식집", "occasion": "회식장소", "food_type": "밥", "cuisine": "한식", "lat": 37.5000, "lng": 127.0330},
    {"place_name": "좌표없음", "occasion": "점심장소", "food_type": "밥", "cuisine": "한식", "lat": None, "lng": None},
]


def check_axis_filter() -> bool:
    names = [r["place_name"] for r in rec_search.search(ROWS, occasion="점심장소")]
    ok_one = names == ["먼곳", "가까운곳", "좌표없음"]

    # 축은 AND로 겹친다.
    names_and = [r["place_name"] for r in rec_search.search(ROWS, occasion="점심장소", cuisine="한식")]
    ok_and = names_and == ["가까운곳", "좌표없음"]

    # 축을 안 주면 전부, 원래 순서 그대로.
    ok_all = [r["place_name"] for r in rec_search.search(ROWS)] == [r["place_name"] for r in ROWS]

    print(f"[axis_filter] {'ok' if ok_one and ok_and and ok_all else 'FAILED'} {names} {names_and}")
    return ok_one and ok_and and ok_all


def check_distance_rank() -> bool:
    ranked = rec_search.search(ROWS, lat=OFFICE[0], lng=OFFICE[1])
    names = [r["place_name"] for r in ranked]
    # 회식집이 지사 코앞, 가까운곳이 그 다음, 먼곳은 판교, 좌표 없는 행은 맨 뒤.
    ok_order = names == ["회식집", "가까운곳", "먼곳", "좌표없음"]
    ok_distance = 0 < ranked[0]["distance_m"] < 200 and ranked[2]["distance_m"] > 10_000
    ok_no_coords = "distance_m" not in ranked[3]
    print(f"[distance_rank] {'ok' if ok_order and ok_distance and ok_no_coords else 'FAILED'} {names} "
          f"d={[r.get('distance_m') for r in ranked]}")
    return ok_order and ok_distance and ok_no_coords


def check_limit() -> bool:
    ok_limit = len(rec_search.search(ROWS, limit=2)) == 2
    # 상한을 넘겨도 터지지 않고 잘린다, 0 이하도 최소 1건.
    ok_bounds = len(rec_search.search(ROWS, limit=9999)) == len(ROWS) and len(rec_search.search(ROWS, limit=0)) == 1
    print(f"[limit] {'ok' if ok_limit and ok_bounds else 'FAILED'}")
    return ok_limit and ok_bounds


def test_rec_search() -> None:
    assert check_axis_filter()
    assert check_distance_rank()
    assert check_limit()


if __name__ == "__main__":
    test_rec_search()
    print("all ok")
