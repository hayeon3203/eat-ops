"""Unit self-check for audit_log.py (Plans.md §10 관찰성과 데이터 처리). Run manually:

    apps/agent-api/.venv/bin/python tests/unit/test_audit_log.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "apps" / "agent-api"))

import audit_log  # noqa: E402


def _last_record() -> dict:
    with open(audit_log.AUDIT_LOG_PATH, encoding="utf-8") as f:
        lines = f.readlines()
    return json.loads(lines[-1])


def check_log_event_writes_required_fields() -> bool:
    audit_log.log_event("test_event", tool_name="dummy", success=True)
    record = _last_record()
    ok = (
        record["event"] == "test_event"
        and "timestamp" in record
        and record["tool_name"] == "dummy"
        and record["success"] is True
    )
    print(f"[log_event_writes_required_fields] {'ok' if ok else 'FAILED'}")
    return ok


def check_hash_text_never_leaks_plaintext() -> bool:
    secret = "이건 절대 로그에 평문으로 남으면 안 됨 12345"
    audit_log.log_event("test_event", input_hash=audit_log.hash_text(secret))
    record = _last_record()
    dumped = json.dumps(record, ensure_ascii=False)
    ok = (
        secret not in dumped
        and record["input_hash"] == audit_log.hash_text(secret)
        and record["input_hash"] != secret
    )
    print(f"[hash_text_never_leaks_plaintext] {'ok' if ok else 'FAILED'}")
    return ok


def check_hash_text_none_for_empty() -> bool:
    ok = audit_log.hash_text(None) is None and audit_log.hash_text("") is None
    print(f"[hash_text_none_for_empty] {'ok' if ok else 'FAILED'}")
    return ok


def check_approval_decision_logged() -> bool:
    import approvals

    approval = approvals.create("test action", lambda: "done")
    approvals.approve(approval.id)
    record = _last_record()
    ok = (
        record["event"] == "approval_decision"
        and record["decision"] == "approved"
        and record["approval_id"] == approval.id
    )
    print(f"[approval_decision_logged] {'ok' if ok else 'FAILED'}")
    return ok


def demo() -> None:
    results = {
        "log_event_writes_required_fields": check_log_event_writes_required_fields(),
        "hash_text_never_leaks_plaintext": check_hash_text_never_leaks_plaintext(),
        "hash_text_none_for_empty": check_hash_text_none_for_empty(),
        "approval_decision_logged": check_approval_decision_logged(),
    }
    print("\n=== summary ===")
    for name, ok in results.items():
        print(f"{name}: {'PASS' if ok else 'FAIL'}")
    assert all(results.values()), "audit_log self-check failed"


if __name__ == "__main__":
    demo()
