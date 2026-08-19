"""Filtering/ranking over the registered recommendations (등록된 추천 목록).

Split out of tools.py for the same reason kakao._to_place is: the rules are
worth a self-check that needs neither a DB file nor the agent stack.

Deliberately has no free-text search. The three category axes are the only
structured facets the data actually has, and there are a few dozen rows —
substring matching Korean menu words ("파스타" against "양식 > 이탈리안")
would drop good rows, while handing the whole shortlist to the model and
letting it pick does not. Filter on what's structured, rank by distance,
give the model the rest.
"""

from __future__ import annotations

import math
from typing import Any

EARTH_RADIUS_M = 6_371_000

# 등록 추천은 수십 건 규모라 전부 넘겨도 컨텍스트가 감당한다. 상한은 데이터가
# 몇 백 건으로 늘었을 때 프롬프트가 조용히 부풀지 않게 두는 것.
DEFAULT_LIMIT = 40
MAX_LIMIT = 60


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in meters."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def search(
    rows: list[dict[str, Any]],
    *,
    occasion: str | None = None,
    food_type: str | None = None,
    cuisine: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    limit: int = DEFAULT_LIMIT,
) -> list[dict[str, Any]]:
    """Filter rows on the three axes (AND, an unset axis matches everything)
    and rank them.

    With lat/lng, rows are sorted nearest-first and each gets a
    `distance_m` key. Without, the caller's order is kept — db.list_recommendations
    already returns newest-first. Rows missing coordinates sort last rather
    than being dropped: a recommendation with no lat/lng is still a real
    recommendation, just not a rankable one.
    """
    matched = [
        row
        for row in rows
        if (occasion is None or row.get("occasion") == occasion)
        and (food_type is None or row.get("food_type") == food_type)
        and (cuisine is None or row.get("cuisine") == cuisine)
    ]

    if lat is not None and lng is not None:
        for row in matched:
            if row.get("lat") is not None and row.get("lng") is not None:
                row["distance_m"] = round(haversine_m(lat, lng, row["lat"], row["lng"]))
        matched.sort(key=lambda r: r.get("distance_m", math.inf))

    return matched[: max(1, min(limit, MAX_LIMIT))]
