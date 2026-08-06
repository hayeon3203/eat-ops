"""Unit self-check for Track C's provider selection in apps/agent-api/main.py.

Pure branching logic, no live endpoint needed — run manually:

    apps/agent-api/.venv/bin/python tests/unit/test_build_client.py
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "apps" / "agent-api"))

import main  # noqa: E402


def check_local_default() -> bool:
    client = main.build_client("local")
    ok = client.model == main.LOCAL_VLLM_MODEL
    print(f"[local_default] {'ok' if ok else 'FAILED'} model={client.model!r}")
    return ok


def check_foundry_needs_endpoint() -> bool:
    old = main.FOUNDRY_PROJECT_ENDPOINT
    main.FOUNDRY_PROJECT_ENDPOINT = None
    try:
        main.build_client("foundry")
        ok = False
    except ValueError:
        ok = True
    finally:
        main.FOUNDRY_PROJECT_ENDPOINT = old
    print(f"[foundry_needs_endpoint] {'ok' if ok else 'FAILED'}")
    return ok


def check_foundry_base_url() -> bool:
    old = main.FOUNDRY_PROJECT_ENDPOINT
    main.FOUNDRY_PROJECT_ENDPOINT = "https://example.services.ai.azure.com/api/projects/demo/"
    try:
        client = main.build_client("foundry")
        ok = client.base_url == "https://example.services.ai.azure.com/api/projects/demo/openai/v1"
    finally:
        main.FOUNDRY_PROJECT_ENDPOINT = old
    print(f"[foundry_base_url] {'ok' if ok else 'FAILED'} base_url={client.base_url!r}")
    return ok


def demo() -> None:
    results = {
        "local_default": check_local_default(),
        "foundry_needs_endpoint": check_foundry_needs_endpoint(),
        "foundry_base_url": check_foundry_base_url(),
    }
    print("\n=== summary ===")
    for name, ok in results.items():
        print(f"{name}: {'PASS' if ok else 'FAIL'}")

    assert all(results.values()), "provider selection self-check failed"


if __name__ == "__main__":
    demo()
