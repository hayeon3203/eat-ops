"""Unit self-check for cost_guard.py (Foundry daily cost hard cap). Run manually:

    apps/agent-api/.venv/bin/python tests/unit/test_cost_guard.py
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "apps" / "agent-api"))

import cost_guard  # noqa: E402


def check_under_cap_allows() -> bool:
    cost_guard._reset_for_tests()
    cost_guard.DAILY_CAP_USD = 50.0
    try:
        cost_guard.check_within_cap()
        ok = True
    except cost_guard.DailyCostCapExceeded:
        ok = False
    print(f"[under_cap_allows] {'ok' if ok else 'FAILED'}")
    return ok


def check_usage_accumulates() -> bool:
    cost_guard._reset_for_tests()
    cost_guard.INPUT_PRICE_PER_1K_USD = 0.00025
    cost_guard.OUTPUT_PRICE_PER_1K_USD = 0.002
    total = cost_guard.record_usage(input_tokens=1000, output_tokens=1000)
    expected = 0.00025 + 0.002
    ok = abs(total - expected) < 1e-9 and abs(cost_guard.current_spend() - expected) < 1e-9
    print(f"[usage_accumulates] {'ok' if ok else 'FAILED'} total={total}")
    return ok


def check_over_cap_blocks() -> bool:
    cost_guard._reset_for_tests()
    cost_guard.DAILY_CAP_USD = 0.01
    cost_guard.record_usage(input_tokens=1_000_000, output_tokens=0)  # way over cap
    try:
        cost_guard.check_within_cap()
        ok = False
    except cost_guard.DailyCostCapExceeded as exc:
        ok = exc.spent >= cost_guard.DAILY_CAP_USD
    print(f"[over_cap_blocks] {'ok' if ok else 'FAILED'}")
    return ok


def check_new_day_resets() -> bool:
    cost_guard._reset_for_tests()
    cost_guard.DAILY_CAP_USD = 0.01
    cost_guard.record_usage(input_tokens=1_000_000, output_tokens=0)
    try:
        cost_guard.check_within_cap()
        blocked_before_reset = False
    except cost_guard.DailyCostCapExceeded:
        blocked_before_reset = True

    cost_guard._state["date"] = "2000-01-01"  # force a stale date -> next check rolls over
    try:
        cost_guard.check_within_cap()
        allowed_after_reset = True
    except cost_guard.DailyCostCapExceeded:
        allowed_after_reset = False

    ok = blocked_before_reset and allowed_after_reset
    print(f"[new_day_resets] {'ok' if ok else 'FAILED'}")
    return ok


def demo() -> None:
    results = {
        "under_cap_allows": check_under_cap_allows(),
        "usage_accumulates": check_usage_accumulates(),
        "over_cap_blocks": check_over_cap_blocks(),
        "new_day_resets": check_new_day_resets(),
    }
    print("\n=== summary ===")
    for name, ok in results.items():
        print(f"{name}: {'PASS' if ok else 'FAIL'}")
    assert all(results.values()), "cost_guard self-check failed"


if __name__ == "__main__":
    demo()
