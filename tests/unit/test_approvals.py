"""Unit self-check for approvals.py + main.py's /api/approvals routes
(Plans.md M3: mock 위험 도구 승인/거절/만료 흐름). Run manually:

    apps/agent-api/.venv/bin/python tests/unit/test_approvals.py
"""

from __future__ import annotations

import sys
from datetime import timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "apps" / "agent-api"))

import approvals  # noqa: E402
import main  # noqa: E402
from fastapi import HTTPException  # noqa: E402


def check_pending_not_executed() -> bool:
    executed = False

    def do_it() -> str:
        nonlocal executed
        executed = True
        return "done"

    approvals.create("test action", do_it)
    ok = not executed
    print(f"[pending_not_executed] {'ok' if ok else 'FAILED'}")
    return ok


def check_approve_executes() -> bool:
    calls = []
    approval = approvals.create("reboot", lambda: calls.append(1) or "rebooted")
    result = main.approve_approval_endpoint(approval.id)
    ok = result["result"] == "rebooted" and calls == [1]
    print(f"[approve_executes] {'ok' if ok else 'FAILED'} result={result!r}")
    return ok


def check_approve_twice_fails() -> bool:
    approval = approvals.create("once only", lambda: "ran")
    main.approve_approval_endpoint(approval.id)
    try:
        main.approve_approval_endpoint(approval.id)
        ok = False
    except HTTPException as e:
        ok = e.status_code == 404
    print(f"[approve_twice_fails] {'ok' if ok else 'FAILED'}")
    return ok


def check_reject_does_not_execute() -> bool:
    executed = False

    def do_it() -> str:
        nonlocal executed
        executed = True
        return "done"

    approval = approvals.create("test action", do_it)
    main.reject_approval_endpoint(approval.id)
    try:
        main.approve_approval_endpoint(approval.id)
        ok = False
    except HTTPException as e:
        ok = e.status_code == 404 and not executed
    print(f"[reject_does_not_execute] {'ok' if ok else 'FAILED'}")
    return ok


def check_expired_does_not_execute() -> bool:
    executed = False

    def do_it() -> str:
        nonlocal executed
        executed = True
        return "done"

    approval = approvals.create("test action", do_it)
    approval.expires_at -= timedelta(minutes=10)  # backdate past the 5-min TTL
    try:
        main.approve_approval_endpoint(approval.id)
        ok = False
    except HTTPException as e:
        ok = e.status_code == 410 and not executed
    print(f"[expired_does_not_execute] {'ok' if ok else 'FAILED'}")
    # Expiry also removes the pending entry — re-approving must 404, not re-run it.
    try:
        main.approve_approval_endpoint(approval.id)
        ok = ok and False
    except HTTPException as e:
        ok = ok and e.status_code == 404 and not executed
    return ok


def check_unknown_id_404s() -> bool:
    try:
        main.approve_approval_endpoint("does-not-exist")
        ok = False
    except HTTPException as e:
        ok = e.status_code == 404
    try:
        main.reject_approval_endpoint("does-not-exist")
        ok = ok and False
    except HTTPException as e:
        ok = ok and e.status_code == 404
    print(f"[unknown_id_404s] {'ok' if ok else 'FAILED'}")
    return ok


def check_mock_risky_action_tool_registers_pending() -> bool:
    from tools import mock_risky_action

    before = len(approvals._pending)
    text = mock_risky_action.func("테스트 액션") if hasattr(mock_risky_action, "func") else mock_risky_action("테스트 액션")
    ok = len(approvals._pending) == before + 1 and "approval_id=" in text
    print(f"[mock_risky_action_tool_registers_pending] {'ok' if ok else 'FAILED'} text={text!r}")
    return ok


def demo() -> None:
    results = {
        "pending_not_executed": check_pending_not_executed(),
        "approve_executes": check_approve_executes(),
        "approve_twice_fails": check_approve_twice_fails(),
        "reject_does_not_execute": check_reject_does_not_execute(),
        "expired_does_not_execute": check_expired_does_not_execute(),
        "unknown_id_404s": check_unknown_id_404s(),
        "mock_risky_action_tool_registers_pending": check_mock_risky_action_tool_registers_pending(),
    }
    print("\n=== summary ===")
    for name, ok in results.items():
        print(f"{name}: {'PASS' if ok else 'FAIL'}")
    assert all(results.values()), "approvals self-check failed"


if __name__ == "__main__":
    demo()
