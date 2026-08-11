"""Unit self-check for categories.py's fixed-axis validation.

Pure logic, no network needed — run manually:

    apps/agent-api/.venv/bin/python tests/unit/test_categories.py
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "apps" / "agent-api"))

import categories  # noqa: E402


def check_none_passes() -> bool:
    try:
        categories.validate_category(None, categories.OCCASIONS, "occasion")
        ok = True
    except ValueError:
        ok = False
    print(f"[none_passes] {'ok' if ok else 'FAILED'}")
    return ok


def check_valid_value_passes() -> bool:
    try:
        categories.validate_category("면", categories.FOOD_TYPES, "food_type")
        ok = True
    except ValueError:
        ok = False
    print(f"[valid_value_passes] {'ok' if ok else 'FAILED'}")
    return ok


def check_invalid_value_raises() -> bool:
    try:
        categories.validate_category("피자", categories.FOOD_TYPES, "food_type")
        ok = False
    except ValueError:
        ok = True
    print(f"[invalid_value_raises] {'ok' if ok else 'FAILED'}")
    return ok


def check_axis_constants() -> bool:
    ok = (
        categories.OCCASIONS == ("점심장소", "회식장소", "수고한 나에게")
        and categories.FOOD_TYPES == ("밥", "면", "빵")
        and categories.CUISINES == ("한식", "양식", "일식", "중식", "베트남식", "기타")
    )
    print(f"[axis_constants] {'ok' if ok else 'FAILED'}")
    return ok


def check_infer_occasion_from_price() -> bool:
    ok = (
        categories.infer_occasion_from_price(None) is None
        and categories.infer_occasion_from_price(12_999) == "점심장소"
        and categories.infer_occasion_from_price(13_000) == "수고한 나에게"
        and categories.infer_occasion_from_price(0) == "점심장소"
    )
    print(f"[infer_occasion_from_price] {'ok' if ok else 'FAILED'}")
    return ok


def demo() -> None:
    results = {
        "none_passes": check_none_passes(),
        "valid_value_passes": check_valid_value_passes(),
        "invalid_value_raises": check_invalid_value_raises(),
        "axis_constants": check_axis_constants(),
        "infer_occasion_from_price": check_infer_occasion_from_price(),
    }
    print("\n=== summary ===")
    for name, ok in results.items():
        print(f"{name}: {'PASS' if ok else 'FAIL'}")
    assert all(results.values()), "categories self-check failed"


if __name__ == "__main__":
    demo()
