"""Unit self-check for kakao.py's radius-search parameter building.

Pure branching logic, no network needed — run manually:

    apps/agent-api/.venv/bin/python tests/unit/test_kakao_params.py
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "apps" / "agent-api"))

import kakao  # noqa: E402


def check_keyword_only() -> bool:
    params = kakao._build_search_params("강남역 파스타", 5, None, None, None)
    ok = params == {"query": "강남역 파스타", "size": "5"}
    print(f"[keyword_only] {'ok' if ok else 'FAILED'} params={params!r}")
    return ok


def check_radius_search() -> bool:
    params = kakao._build_search_params("파스타", 5, 37.5, 127.0, 500)
    ok = params == {"query": "파스타", "size": "5", "y": "37.5", "x": "127.0", "radius": "500"}
    print(f"[radius_search] {'ok' if ok else 'FAILED'} params={params!r}")
    return ok


def check_radius_defaults_2km() -> bool:
    params = kakao._build_search_params("파스타", 5, 37.5, 127.0, None)
    ok = params["radius"] == "2000"
    print(f"[radius_defaults_2km] {'ok' if ok else 'FAILED'} radius={params.get('radius')!r}")
    return ok


def check_radius_clamped() -> bool:
    params = kakao._build_search_params("파스타", 5, 37.5, 127.0, 999999)
    ok = params["radius"] == "20000"
    print(f"[radius_clamped] {'ok' if ok else 'FAILED'} radius={params.get('radius')!r}")
    return ok


def demo() -> None:
    results = {
        "keyword_only": check_keyword_only(),
        "radius_search": check_radius_search(),
        "radius_defaults_2km": check_radius_defaults_2km(),
        "radius_clamped": check_radius_clamped(),
    }
    print("\n=== summary ===")
    for name, ok in results.items():
        print(f"{name}: {'PASS' if ok else 'FAIL'}")
    assert all(results.values()), "kakao params self-check failed"


if __name__ == "__main__":
    demo()
