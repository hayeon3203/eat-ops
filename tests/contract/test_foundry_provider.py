"""Contract test for Track B completion condition:
"Foundry endpoint에 동일한 provider 인터페이스로 호출해 응답을 받는다."

Requires `az login` and FOUNDRY_PROJECT_ENDPOINT set. Not a unit test (needs
the live Foundry deployment) — run manually:

    infra/local/.venv/bin/python tests/contract/test_foundry_provider.py
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "services" / "model-gateway"))

from providers import FoundryProvider  # noqa: E402


def check_health(provider: FoundryProvider) -> bool:
    ok = provider.health_check()
    print(f"[health] {'ok' if ok else 'FAILED'}")
    return ok


def check_plain_chat(provider: FoundryProvider) -> bool:
    # gpt-5-mini rejects `max_tokens`; it wants `max_completion_tokens`, and
    # that budget is shared with invisible reasoning tokens (~60-70 typically
    # burned before any visible output), so it must stay generous.
    result = provider.chat_completion(
        [{"role": "user", "content": "Say the single word: ready"}],
        max_completion_tokens=200,
    )
    ok = bool(result.content and result.content.strip())
    print(f"[plain_chat] {'ok' if ok else 'FAILED'} content={result.content!r}")
    return ok


def demo() -> None:
    provider = FoundryProvider()
    results = {
        "health": check_health(provider),
        "plain_chat": check_plain_chat(provider),
    }
    print("\n=== summary ===")
    for name, ok in results.items():
        print(f"{name}: {'PASS' if ok else 'FAIL'}")

    assert results["health"], "Foundry endpoint not reachable"
    assert results["plain_chat"], "plain chat completion failed"


if __name__ == "__main__":
    demo()
