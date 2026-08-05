"""Contract test for Track A completion condition:
"로컬 vLLM endpoint에 OpenAI 호환 호출로 응답과 tool call이 온다."

Requires infra/local/start-vllm.sh running first. Not a unit test (needs the
live server + loaded model) — run manually:

    infra/local/.venv/bin/python tests/contract/test_local_provider.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "services" / "model-gateway"))

from providers import LocalGB10Provider  # noqa: E402

WEATHER_TOOL = {
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get current weather for a city",
        "parameters": {
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
    },
}

PERSON_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "person",
        "schema": {
            "type": "object",
            "properties": {"name": {"type": "string"}, "age": {"type": "integer"}},
            "required": ["name", "age"],
        },
    },
}


def check_health(provider: LocalGB10Provider) -> bool:
    ok = provider.health_check()
    print(f"[health] {'ok' if ok else 'FAILED'}")
    return ok


def check_plain_chat(provider: LocalGB10Provider) -> bool:
    result = provider.chat_completion(
        [{"role": "user", "content": "Say the single word: ready"}],
        max_tokens=20,
    )
    ok = bool(result.content and result.content.strip())
    print(f"[plain_chat] {'ok' if ok else 'FAILED'} content={result.content!r}")
    return ok


def check_structured_output(provider: LocalGB10Provider) -> bool:
    result = provider.chat_completion(
        [{"role": "user", "content": "Generate a person named Alice, age 30, as JSON."}],
        response_format=PERSON_SCHEMA,
        max_tokens=100,
        temperature=0,
    )
    try:
        parsed = json.loads(result.content or "")
        ok = "name" in parsed and "age" in parsed
    except json.JSONDecodeError:
        ok = False
    print(f"[structured_output] {'ok' if ok else 'FAILED'} content={result.content!r}")
    return ok


def check_tool_calling_auto(provider: LocalGB10Provider) -> bool:
    """EXAONE-3.0 has no tool-use training: with tool_choice=auto (the model
    deciding on its own whether to call a tool) it never emits a tool call."""
    result = provider.chat_completion(
        [{"role": "user", "content": "What is the weather in Seoul? Use the get_weather tool."}],
        tools=[WEATHER_TOOL],
        max_tokens=200,
    )
    ok = bool(result.tool_calls)
    print(f"[tool_calling_auto] {'ok' if ok else 'expected-fail (no spontaneous tool use)'} "
          f"tool_calls={result.tool_calls!r}")
    return ok


def check_tool_calling_forced(provider: LocalGB10Provider) -> bool:
    """tool_choice=required makes vLLM grammar-constrain decoding into the
    tool-call schema regardless of model training, so it works mechanically.
    EXAONE doesn't know to stop afterwards, so max_tokens must stay tight
    (~40) or it repeats the same call until the budget runs out."""
    result = provider.chat_completion(
        [{"role": "user", "content": "What is the weather in Seoul?"}],
        tools=[WEATHER_TOOL],
        tool_choice="required",
        max_tokens=40,
        temperature=0,
    )
    ok = bool(result.tool_calls) and any(
        tc["function"]["name"] == "get_weather" for tc in (result.tool_calls or [])
    )
    print(f"[tool_calling_forced] {'ok' if ok else 'FAILED'} tool_calls={result.tool_calls!r}")
    return ok


def demo() -> None:
    provider = LocalGB10Provider()
    results = {
        "health": check_health(provider),
        "plain_chat": check_plain_chat(provider),
        "structured_output": check_structured_output(provider),
        "tool_calling_auto": check_tool_calling_auto(provider),
        "tool_calling_forced": check_tool_calling_forced(provider),
    }
    print("\n=== summary ===")
    for name, ok in results.items():
        print(f"{name}: {'PASS' if ok else 'FAIL'}")

    assert results["health"], "server not reachable"
    assert results["plain_chat"], "plain chat completion failed"
    assert results["structured_output"], "guided JSON structured output failed"
    assert results["tool_calling_forced"], (
        "tool_choice=required must still produce a schema-valid call "
        "(grammar-constrained, independent of model training)"
    )
    # tool_calling_auto is recorded, not asserted: EXAONE-3.0 has no tool-use
    # training, so the model never calls tools on its own initiative. Callers
    # (Main/Local Utility Agent) must pass tool_choice="required" and keep
    # max_tokens tight (~40) when they need a tool call from this model.


if __name__ == "__main__":
    demo()
