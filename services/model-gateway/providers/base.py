"""Common provider interface so Main Agent code can call any backend
(local vLLM, Foundry serverless, ...) the same way. See DESIGN.md section 5.6/9.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass
class ChatResult:
    """Normalized subset of an OpenAI-style chat completion response."""

    content: str | None
    tool_calls: list[dict[str, Any]] | None
    finish_reason: str | None
    raw: Any


class ModelProvider(Protocol):
    """Every provider adapter (local, Foundry, ...) implements this shape."""

    name: str
    model_id: str

    def chat_completion(
        self,
        messages: list[dict[str, Any]],
        *,
        tools: list[dict[str, Any]] | None = None,
        response_format: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> ChatResult: ...

    def health_check(self) -> bool: ...
