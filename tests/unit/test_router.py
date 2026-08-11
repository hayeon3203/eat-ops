"""Unit self-check for router.py (ModelRouter, Plans.md §6/§7). Run manually:

    apps/agent-api/.venv/bin/python tests/unit/test_router.py
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "apps" / "agent-api"))

import router  # noqa: E402


def check_decision_table() -> bool:
    # (mode, sensitivity, foundry_configured) -> (provider, reason, blocked)
    cases = [
        (("auto", "public", True), ("foundry", "AUTO_DEFAULT", False)),
        (("auto", "public", False), ("local", "CLOUD_UNAVAILABLE", False)),
        (("auto", "confidential", True), ("local", "SENSITIVE_DATA", False)),
        (("auto", "confidential", False), ("local", "SENSITIVE_DATA", False)),
        (("foundry", "public", True), ("foundry", "USER_FORCED_CLOUD", False)),
        (("foundry", "public", False), (None, None, True)),
        (("foundry", "confidential", True), (None, None, True)),
        (("local", "public", True), ("local", "USER_FORCED_LOCAL", False)),
        (("local", "confidential", True), ("local", "USER_FORCED_LOCAL", False)),
    ]
    ok = True
    for (mode, sens, foundry_up), (want_provider, want_reason, want_blocked) in cases:
        d = router.decide(mode=mode, sensitivity=sens, foundry_configured=foundry_up)
        got = (d.provider, d.reason, d.blocked)
        want = (want_provider, want_reason, want_blocked)
        if got != want:
            print(f"[decision_table] FAILED {(mode, sens, foundry_up)}: got {got}, want {want}")
            ok = False
    print(f"[decision_table] {'ok' if ok else 'FAILED'} ({len(cases)} cases)")
    return ok


def check_confidential_never_routes_to_foundry() -> bool:
    """Spy-equivalent: across every mode, a confidential request never
    resolves to provider="foundry" — Plans.md M4 완료조건."""
    ok = True
    for mode in ("auto", "foundry", "local"):
        for foundry_up in (True, False):
            d = router.decide(mode=mode, sensitivity="confidential", foundry_configured=foundry_up)
            if d.provider == "foundry":
                print(f"[never_foundry_for_confidential] FAILED mode={mode} foundry_up={foundry_up} -> {d}")
                ok = False
    print(f"[never_foundry_for_confidential] {'ok' if ok else 'FAILED'}")
    return ok


def demo() -> None:
    results = {
        "decision_table": check_decision_table(),
        "never_foundry_for_confidential": check_confidential_never_routes_to_foundry(),
    }
    print("\n=== summary ===")
    for name, ok in results.items():
        print(f"{name}: {'PASS' if ok else 'FAIL'}")
    assert all(results.values()), "router self-check failed"


if __name__ == "__main__":
    demo()
