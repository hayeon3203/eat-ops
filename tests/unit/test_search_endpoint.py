"""Unit self-check for main.py's GET /api/search route handler.

kakao.search_places is monkeypatched — no network needed. Run manually:

    apps/agent-api/.venv/bin/python tests/unit/test_search_endpoint.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "apps" / "agent-api"))

import kakao  # noqa: E402
import main  # noqa: E402
from fastapi import HTTPException  # noqa: E402


def check_search_ok() -> bool:
    async def fake_search_places(query, **kwargs):
        return [kakao.KakaoPlace(place_name="테스트식당", address="서울", lat=37.5, lng=127.0)]

    original = kakao.search_places
    kakao.search_places = fake_search_places
    try:
        result = asyncio.run(main.search_places_endpoint(q="테스트"))
        ok = len(result) == 1 and result[0]["place_name"] == "테스트식당"
        print(f"[search_ok] {'ok' if ok else 'FAILED'} result={result!r}")
        return ok
    finally:
        kakao.search_places = original


def check_search_quota_exceeded() -> bool:
    async def fake_search_places(query, **kwargs):
        raise kakao.KakaoQuotaExceededError("quota")

    original = kakao.search_places
    kakao.search_places = fake_search_places
    try:
        try:
            asyncio.run(main.search_places_endpoint(q="테스트"))
            ok = False
        except HTTPException as e:
            ok = e.status_code == 429
        print(f"[search_quota_exceeded] {'ok' if ok else 'FAILED'}")
        return ok
    finally:
        kakao.search_places = original


def demo() -> None:
    results = {
        "search_ok": check_search_ok(),
        "search_quota_exceeded": check_search_quota_exceeded(),
    }
    print("\n=== summary ===")
    for name, ok in results.items():
        print(f"{name}: {'PASS' if ok else 'FAIL'}")
    assert all(results.values()), "search endpoint self-check failed"


if __name__ == "__main__":
    demo()
