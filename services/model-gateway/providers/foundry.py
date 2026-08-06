"""Provider adapter for a Microsoft Foundry project (serverless deployment).

Auth via `az login` (DefaultAzureCredential) — no API key stored. Needs
FOUNDRY_PROJECT_ENDPOINT (Foundry project's "AI Foundry API" endpoint) and,
optionally, FOUNDRY_MODEL (deployment name).
"""

from __future__ import annotations

import os
from typing import Any

from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential

from .base import ChatResult

DEFAULT_PROJECT_ENDPOINT = os.environ.get("FOUNDRY_PROJECT_ENDPOINT")
DEFAULT_MODEL = os.environ.get("FOUNDRY_MODEL", "gpt-5-mini-1")


class FoundryProvider:
    """Talks to a Foundry project deployment through its OpenAI-compatible endpoint."""

    name = "foundry"

    def __init__(self, project_endpoint: str | None = None, model: str = DEFAULT_MODEL) -> None:
        endpoint = project_endpoint or DEFAULT_PROJECT_ENDPOINT
        if not endpoint:
            raise ValueError("FOUNDRY_PROJECT_ENDPOINT not set")
        self.model_id = model
        project_client = AIProjectClient(endpoint=endpoint, credential=DefaultAzureCredential())
        self._client = project_client.get_openai_client()

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
            # Just needs to not raise — reasoning-family models (gpt-5-mini)
            # reject `max_tokens` and require `max_completion_tokens`.
            self.chat_completion(
                [{"role": "user", "content": "ping"}],
                max_completion_tokens=5,
            )
            return True
        except Exception:
            return False
