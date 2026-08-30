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
KAKAO_CATEGORY_SEARCH_URL = "https://dapi.kakao.com/v2/local/search/category.json"
# 카카오 카테고리 코드 FD6 = 음식점. 지도 탭 좌표 주변을 훑을 때 카페(CE7)·편의점까지
# 딸려오면 "누른 식당"이 안 잡히므로 음식점으로만 좁힌다.
KAKAO_RESTAURANT_CATEGORY = "FD6"
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


def _build_nearby_params(lat: float, lng: float, radius_m: int, size: int) -> dict[str, str]:
    return {
        "category_group_code": KAKAO_RESTAURANT_CATEGORY,
        "y": str(lat),
        "x": str(lng),
        "radius": str(max(1, min(radius_m, 20000))),
        "sort": "distance",
        "size": str(max(1, min(size, 15))),
    }


async def _get(url: str, params: dict[str, str]) -> dict:
    """키워드 검색과 카테고리 검색이 공유하는 요청 경로 — 키 확인, 일일 쿼터
    차단, 429 처리를 한 군데서만 한다."""
    if not KAKAO_REST_API_KEY:
        raise RuntimeError("KAKAO_REST_API_KEY not set")
    if _quota_exceeded_date == date.today():
        raise KakaoQuotaExceededError("Kakao Local daily quota already hit today.")

    headers = {"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"}
    timeout = aiohttp.ClientTimeout(total=KAKAO_TIMEOUT_SECONDS)
    async with aiohttp.ClientSession(timeout=timeout) as session, session.get(
        url, headers=headers, params=params
    ) as resp:
        if resp.status == 429:
            _mark_quota_exceeded()
            raise KakaoQuotaExceededError("Kakao Local daily quota exceeded.")
        resp.raise_for_status()
        return await resp.json()


async def search_places(
    query: str,
    size: int = 5,
    lat: float | None = None,
    lng: float | None = None,
    radius_m: int | None = None,
) -> list[KakaoPlace]:
    data = await _get(KAKAO_KEYWORD_SEARCH_URL, _build_search_params(query, size, lat, lng, radius_m))
    return [_to_place(doc) for doc in data.get("documents", [])]


async def search_nearby_restaurants(
    lat: float, lng: float, radius_m: int = 100, size: int = 5
) -> list[KakaoPlace]:
    """지도에서 누른 지점 주변 음식점을 가까운 순으로.

    카카오 지도 SDK는 기본 지도에 그려진 상점 라벨의 클릭 이벤트를 주지 않는다.
    그래서 "지도의 식당을 눌렀다"는 동작은 누른 좌표 주변을 카테고리 검색해
    가장 가까운 음식점을 고르는 것으로 대신한다.
    """
    data = await _get(KAKAO_CATEGORY_SEARCH_URL, _build_nearby_params(lat, lng, radius_m, size))
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
