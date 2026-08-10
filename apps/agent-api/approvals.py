"""In-memory approval store for risky tools requiring human confirmation
(Plans.md M3 완료조건: "mock 위험 도구는 승인 전 실행되지 않고, 거절과 만료 시 부작용이 없다").

agent_framework ships a first-class `@tool(approval_mode="always_require")`
primitive, but it works by round-tripping a `function_approval_request`/
`function_approval_response` Content pair through the model conversation —
and `agent_framework.ag_ui` has no support for surfacing or answering that
content type, so a chat turn would just hang with no way for the user to
respond. A REST endpoint decoupled from the chat protocol is simpler and
matches how the rest of this app's write paths already work (e.g.
add_recommendation has both a chat tool and a direct REST route).

# ponytail: process-local dict, not persisted — fine for a single-process demo.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable

import audit_log

APPROVAL_TTL = timedelta(minutes=5)


@dataclass
class PendingApproval:
    id: str
    action: str
    execute: Callable[[], str]
    created_at: datetime
    expires_at: datetime


class ApprovalNotFound(Exception):
    pass


class ApprovalExpired(Exception):
    pass


_pending: dict[str, PendingApproval] = {}


def create(action: str, execute: Callable[[], str]) -> PendingApproval:
    now = datetime.now(timezone.utc)
    approval = PendingApproval(
        id=str(uuid.uuid4()),
        action=action,
        execute=execute,
        created_at=now,
        expires_at=now + APPROVAL_TTL,
    )
    _pending[approval.id] = approval
    return approval


def approve(approval_id: str) -> str:
    """Run the pending action and return its result. Raises ApprovalNotFound
    or ApprovalExpired without any side effect in either case."""
    approval = _pending.get(approval_id)
    if approval is None:
        audit_log.log_event("approval_decision", approval_id=approval_id, decision="not_found")
        raise ApprovalNotFound(approval_id)
    del _pending[approval_id]
    if datetime.now(timezone.utc) > approval.expires_at:
        audit_log.log_event(
            "approval_decision", approval_id=approval_id, action=approval.action, decision="expired"
        )
        raise ApprovalExpired(approval_id)
    result = approval.execute()
    audit_log.log_event("approval_decision", approval_id=approval_id, action=approval.action, decision="approved")
    return result


def reject(approval_id: str) -> None:
    approval = _pending.get(approval_id)
    if approval is None:
        audit_log.log_event("approval_decision", approval_id=approval_id, decision="not_found")
        raise ApprovalNotFound(approval_id)
    del _pending[approval_id]
    audit_log.log_event("approval_decision", approval_id=approval_id, action=approval.action, decision="rejected")
