"""ModelRouter (Plans.md §6/§7) — pure decision function, no I/O.

Priority order per Plans.md §7: security policy > user's cloud|local
selection > provider availability > auto default (Foundry).

# ponytail: capability matching (QUALITY_REQUIRED/CAPABILITY_REQUIRED) and
# circuit-breaker state (half_open, cost/latency scoring) are skipped —
# nothing in this app yet needs a tool Foundry/local disagree on
# supporting. Add when a real capability gap shows up.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from sensitivity import Sensitivity

RequestedMode = Literal["auto", "foundry", "local"]
Provider = Literal["foundry", "local"]
RouteReason = Literal[
    "USER_FORCED_CLOUD",
    "USER_FORCED_LOCAL",
    "SENSITIVE_DATA",
    "CLOUD_UNAVAILABLE",
    "AUTO_DEFAULT",
]


@dataclass(frozen=True)
class RouteDecision:
    provider: Provider | None
    reason: RouteReason | None
    blocked: bool = False
    error: str | None = None  # POLICY_BLOCKED | PROVIDER_UNAVAILABLE


def decide(mode: RequestedMode, sensitivity: Sensitivity, foundry_configured: bool) -> RouteDecision:
    sensitive = sensitivity == "confidential"

    if mode == "foundry":
        if sensitive:
            # Fail-closed: explicit cloud request never overrides policy.
            return RouteDecision(provider=None, reason=None, blocked=True, error="POLICY_BLOCKED")
        if not foundry_configured:
            return RouteDecision(provider=None, reason=None, blocked=True, error="PROVIDER_UNAVAILABLE")
        return RouteDecision(provider="foundry", reason="USER_FORCED_CLOUD")

    if mode == "local":
        return RouteDecision(provider="local", reason="USER_FORCED_LOCAL")

    # auto
    if sensitive:
        return RouteDecision(provider="local", reason="SENSITIVE_DATA")
    if foundry_configured:
        return RouteDecision(provider="foundry", reason="AUTO_DEFAULT")
    return RouteDecision(provider="local", reason="CLOUD_UNAVAILABLE")
