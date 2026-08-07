"""Kakao Local API client (트랙 D — 맛집 지도, IMPLEMENTATION_PLAN.md §8).

Keyword search only: Kakao's own query parsing handles location text baked
into the query (e.g. "강남역 파스타"), so no separate geocoding step or
lat/lng bias parameter is needed for the MVP.
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


async def search_places(query: str, size: int = 5) -> list[KakaoPlace]:
    if not KAKAO_REST_API_KEY:
        raise RuntimeError("KAKAO_REST_API_KEY not set")
    if _quota_exceeded_date == date.today():
        raise KakaoQuotaExceededError("Kakao Local daily quota already hit today.")

    headers = {"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"}
    params = {"query": query, "size": str(max(1, min(size, 15)))}
    timeout = aiohttp.ClientTimeout(total=KAKAO_TIMEOUT_SECONDS)
    async with aiohttp.ClientSession(timeout=timeout) as session, session.get(
        KAKAO_KEYWORD_SEARCH_URL, headers=headers, params=params
    ) as resp:
        if resp.status == 429:
            _mark_quota_exceeded()
            raise KakaoQuotaExceededError("Kakao Local daily quota exceeded.")
        resp.raise_for_status()
        data = await resp.json()

    places = []
    for doc in data.get("documents", []):
        places.append(
            KakaoPlace(
                kakao_place_id=doc.get("id", ""),
                place_name=doc.get("place_name", ""),
                address=doc.get("road_address_name") or doc.get("address_name", ""),
                category=doc.get("category_name", ""),
                lat=float(doc.get("y", 0.0)),
                lng=float(doc.get("x", 0.0)),
                place_url=doc.get("place_url", ""),
            )
        )
    return places
