"""Daily USD spend cap for Foundry calls — a hard cap: once today's estimated
spend crosses the cap, further Foundry calls are refused *before* hitting the
API (fail closed), not just logged after the fact. Local vLLM calls are
free/self-hosted and are never capped.

Cost is *estimated* from token counts x price-per-1K env vars — Azure's
actual invoice may differ (rounding, non-token fees, price changes). Check
the Foundry deployment's real pricing page and adjust
FOUNDRY_*_PRICE_PER_1K_USD if this drifts from the actual bill.

# ponytail: in-memory counter only, resets on process restart and at UTC
# midnight — no persistence across restarts. Upgrade to a DB row if restarts
# happen mid-day often enough for that to matter.
"""

from __future__ import annotations

import os
import threading
from datetime import datetime, timezone

DAILY_CAP_USD = float(os.environ.get("FOUNDRY_DAILY_COST_CAP_USD", "50"))
INPUT_PRICE_PER_1K_USD = float(os.environ.get("FOUNDRY_INPUT_PRICE_PER_1K_USD", "0.00025"))
OUTPUT_PRICE_PER_1K_USD = float(os.environ.get("FOUNDRY_OUTPUT_PRICE_PER_1K_USD", "0.002"))

_lock = threading.Lock()
_state = {"date": None, "spent_usd": 0.0}


class DailyCostCapExceeded(Exception):
    def __init__(self, spent: float, cap: float) -> None:
        self.spent = spent
        self.cap = cap
        super().__init__(f"Foundry daily cost cap exceeded: ${spent:.4f} spent, cap ${cap:.2f}")


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _reset_if_new_day() -> None:
    today = _today()
    if _state["date"] != today:
        _state["date"] = today
        _state["spent_usd"] = 0.0


def check_within_cap() -> None:
    """Call before issuing a Foundry request. Raises if already at/over cap."""
    with _lock:
        _reset_if_new_day()
        if _state["spent_usd"] >= DAILY_CAP_USD:
            raise DailyCostCapExceeded(_state["spent_usd"], DAILY_CAP_USD)


def record_usage(input_tokens: int | None, output_tokens: int | None) -> float:
    """Add estimated cost for a completed call. Returns the new running total."""
    cost = (input_tokens or 0) / 1000 * INPUT_PRICE_PER_1K_USD + (output_tokens or 0) / 1000 * OUTPUT_PRICE_PER_1K_USD
    with _lock:
        _reset_if_new_day()
        _state["spent_usd"] += cost
        return _state["spent_usd"]


def current_spend() -> float:
    with _lock:
        _reset_if_new_day()
        return _state["spent_usd"]


def _reset_for_tests() -> None:
    """Test-only escape hatch — module state is process-global otherwise."""
    with _lock:
        _state["date"] = None
        _state["spent_usd"] = 0.0
