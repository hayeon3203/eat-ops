"""Provider adapter for the GB10 local vLLM OpenAI-compatible server.

Start the server first: infra/local/start-vllm.sh
"""

from __future__ import annotations

import os
from typing import Any

from openai import OpenAI

from .base import ChatResult

DEFAULT_BASE_URL = os.environ.get("LOCAL_VLLM_BASE_URL", "http://127.0.0.1:8000/v1")
DEFAULT_MODEL = os.environ.get("LOCAL_VLLM_MODEL", "exaone-3.0-7.8b")


class LocalGB10Provider:
    """Talks to the local vLLM server exactly like any other OpenAI-compatible backend."""

    name = "local_gb10"

    def __init__(self, base_url: str = DEFAULT_BASE_URL, model: str = DEFAULT_MODEL) -> None:
        self.model_id = model
        self._client = OpenAI(base_url=base_url, api_key="not-needed")

    def chat_completion(
        self,
        messages: list[dict[str, Any]],
        *,
        tools: list[dict[str, Any]] | None = None,
        response_format: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> ChatResult:
        completion = self._client.chat.completions.create(
            model=self.model_id,
            messages=messages,
            tools=tools,
            response_format=response_format,
            **kwargs,
        )
        choice = completion.choices[0]
        tool_calls = (
            [tc.model_dump() for tc in choice.message.tool_calls]
            if choice.message.tool_calls
            else None
        )
        return ChatResult(
            content=choice.message.content,
            tool_calls=tool_calls,
            finish_reason=choice.finish_reason,
            raw=completion,
        )

    def health_check(self) -> bool:
        try:
            self._client.models.list()
            return True
        except Exception:
            return False
