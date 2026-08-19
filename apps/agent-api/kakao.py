"""Kakao Local API client (트랙 D — 맛집 지도, IMPLEMENTATION_PLAN.md §8).

Keyword search: Kakao's own query parsing handles location text baked into
the query (e.g. "강남역 파스타"), no geocoding step needed for named
locations. For proximity search ("내 주변"), pass lat/lng/radius_m to bias
results toward the user's current coordinates.
"""

from __future__ import annotations

import os
from datetime import date

import aiohttp

KAKAO_REST_API_KEY = os.environ.get("KAKAO_REST_API_KEY", "")
KAKAO_KEYWORD_SEARCH_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
KAKAO_TIMEOUT_SECONDS = 5


class KakaoQuotaExceededError(RuntimeError):
    """Daily free-tier quota (100,000 req/day for keyword search) hit."""


class KakaoPlace(dict):
    """A single Kakao Local search result, shaped for both tool output and DB storage."""


# Kakao's quota resets daily; once we see it exceeded, stop calling out for
# the rest of the day instead of burning further requests that would 429
# anyway. Process-local like the rest of this app's state (DESIGN.md §1).
_quota_exceeded_date: date | None = None


def _mark_quota_exceeded() -> None:
    global _quota_exceeded_date
    _quota_exceeded_date = date.today()


def _build_search_params(
    query: str, size: int, lat: float | None, lng: float | None, radius_m: int | None
) -> dict[str, str]:
    params = {"query": query, "size": str(max(1, min(size, 15)))}
    if lat is not None and lng is not None:
        # Kakao keyword search: y=lat, x=lng, radius in meters (max 20000).
        # Default 2000m when the caller wants proximity but didn't pick a
        # radius — wide enough to be useful, narrow enough to stay "near me".
        params["y"] = str(lat)
        params["x"] = str(lng)
        params["radius"] = str(max(1, min(radius_m or 2000, 20000)))
    return params


async def search_places(
    query: str,
    size: int = 5,
    lat: float | None = None,
    lng: float | None = None,
    radius_m: int | None = None,
) -> list[KakaoPlace]:
    if not KAKAO_REST_API_KEY:
        raise RuntimeError("KAKAO_REST_API_KEY not set")
    if _quota_exceeded_date == date.today():
        raise KakaoQuotaExceededError("Kakao Local daily quota already hit today.")

    headers = {"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"}
    params = _build_search_params(query, size, lat, lng, radius_m)
    timeout = aiohttp.ClientTimeout(total=KAKAO_TIMEOUT_SECONDS)
    async with aiohttp.ClientSession(timeout=timeout) as session, session.get(
        KAKAO_KEYWORD_SEARCH_URL, headers=headers, params=params
    ) as resp:
        if resp.status == 429:
            _mark_quota_exceeded()
            raise KakaoQuotaExceededError("Kakao Local daily quota exceeded.")
        resp.raise_for_status()
        data = await resp.json()

    return [_to_place(doc) for doc in data.get("documents", [])]


def _to_place(doc: dict) -> KakaoPlace:
    """Map one Kakao document to our shape.

    Split out of search_places so the mapping is testable without a network
    round-trip against a daily-quota API.
    """
    return KakaoPlace(
        kakao_place_id=doc.get("id", ""),
        place_name=doc.get("place_name", ""),
        address=doc.get("road_address_name") or doc.get("address_name", ""),
        category=doc.get("category_name", ""),
        phone=doc.get("phone", ""),
        lat=float(doc.get("y", 0.0)),
        lng=float(doc.get("x", 0.0)),
        place_url=doc.get("place_url", ""),
    )
