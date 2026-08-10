"""Structured audit log (Plans.md §10 관찰성과 데이터 처리).

One JSON line per event to `data/audit.log` — never the raw prompt/response/
tool output, only a sha256 hash of user input. Hooks into agent_framework's
first-class AgentMiddleware/FunctionMiddleware (agent_framework/_middleware.py)
instead of hand-rolled instrumentation per endpoint or per tool.

# ponytail: stdlib logging + json, no OpenTelemetry/structlog — Plans.md §10
# already puts OTel in "MVP 이후 순서", not here.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from agent_framework import (
    AgentContext,
    AgentMiddleware,
    FunctionInvocationContext,
    FunctionMiddleware,
    MiddlewareTermination,
)

import cost_guard

AUDIT_LOG_PATH = Path(os.environ.get("AUDIT_LOG_PATH", Path(__file__).parent / "data" / "audit.log"))

_logger = logging.getLogger("audit")
_logger.setLevel(logging.INFO)
_logger.propagate = False
if not _logger.handlers:
    AUDIT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    _file_handler = logging.FileHandler(AUDIT_LOG_PATH)
    _file_handler.setFormatter(logging.Formatter("%(message)s"))
    _logger.addHandler(_file_handler)
    _stream_handler = logging.StreamHandler()
    _stream_handler.setFormatter(logging.Formatter("%(message)s"))
    _logger.addHandler(_stream_handler)


def hash_text(text: str | None) -> str | None:
    """Irreversible hash of raw input — the text itself must never be logged."""
    if not text:
        return None
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def log_event(event: str, **fields: Any) -> None:
    record = {"event": event, "timestamp": datetime.now(timezone.utc).isoformat(), **fields}
    _logger.info(json.dumps(record, ensure_ascii=False, default=str))


class AuditAgentMiddleware(AgentMiddleware):
    """One `agent_run` record per AG-UI request: provider, latency, input hash,
    token usage. provider/model are fixed per instance (one per Agent(...)) —
    simpler than re-deriving them from `context` for a two-provider app."""

    def __init__(self, provider: str, model: str) -> None:
        self.provider = provider
        self.model = model

    async def process(self, context: AgentContext, call_next) -> None:
        start = time.monotonic()
        last_user_text = None
        for message in reversed(context.messages):
            if getattr(message, "role", None) == "user":
                last_user_text = getattr(message, "text", None) or str(message)
                break

        error_code = None
        try:
            if self.provider == "foundry":
                cost_guard.check_within_cap()  # raises DailyCostCapExceeded if already over
            await call_next()
        except cost_guard.DailyCostCapExceeded as exc:
            error_code = type(exc).__name__
            raise MiddlewareTermination(str(exc)) from exc
        except Exception as exc:
            error_code = type(exc).__name__
            raise
        finally:
            latency_ms = round((time.monotonic() - start) * 1000, 1)
            run_id = None
            usage = None
            try:
                result = context.result
                if result is not None and not context.stream:
                    run_id = getattr(result, "response_id", None)
                    usage_details = getattr(result, "usage_details", None)
                    if usage_details:
                        usage = dict(usage_details)
            except Exception:
                pass  # best-effort — audit logging must never break the request

            daily_spend_usd = None
            if self.provider == "foundry" and usage:
                daily_spend_usd = round(
                    cost_guard.record_usage(usage.get("input_token_count"), usage.get("output_token_count")), 4
                )

            log_event(
                "agent_run",
                thread_id=getattr(context.session, "session_id", None) if context.session else None,
                run_id=run_id,
                provider=self.provider,
                model=self.model,
                route_reason="USER_SELECTED",
                fallback=False,
                limited_mode=False,
                error_code=error_code,
                latency_ms=latency_ms,
                token_usage=usage,
                daily_spend_usd=daily_spend_usd,
                input_hash=hash_text(last_user_text),
                sensitivity="unknown",
            )


class AuditFunctionMiddleware(FunctionMiddleware):
    """One `tool_call` record per tool/function invocation: name, success,
    latency, approval status. Covers every FunctionTool the agent calls,
    including MCP-backed tools (metmuseum) — they go through the same
    function-invocation pipeline as the plain @tool functions."""

    async def process(self, context: FunctionInvocationContext, call_next) -> None:
        start = time.monotonic()
        error_code = None
        try:
            await call_next()
        except Exception as exc:
            error_code = type(exc).__name__
            raise
        finally:
            name = getattr(context.function, "name", "unknown")
            latency_ms = round((time.monotonic() - start) * 1000, 1)
            log_event(
                "tool_call",
                tool_name=name,
                success=error_code is None,
                error_code=error_code,
                latency_ms=latency_ms,
                approval_status="requested" if name == "mock_risky_action" else "n/a",
            )
