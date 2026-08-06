"""Contract test for IMPLEMENTATION_PLAN.md #5 completion condition:
"웹 검색·시스템 상태 조회·MCP(미술관 검색) 세 가지가 채팅에서 각각 동작한다."

Requires SearXNG on :8081, nvidia-smi on PATH, and network access for `npx
metmuseum-mcp` (first run downloads the package). Not a unit test — run
manually:

    apps/agent-api/.venv/bin/python tests/contract/test_tools.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "apps" / "agent-api"))

import tools  # noqa: E402


def _text(content_list: object) -> str:
    return "\n".join(getattr(c, "text", str(c)) for c in content_list)  # type: ignore[union-attr]


async def check_web_search() -> bool:
    result = _text(await tools.web_search.invoke(query="NVIDIA GB10", count=2))
    ok = "Untrusted web search results" in result
    print(f"[web_search] {'ok' if ok else 'FAILED'} {result[:120]!r}")
    return ok


async def check_system_status() -> bool:
    result = _text(await tools.system_status.invoke())
    ok = '"cpu_percent"' in result and '"gpus"' in result
    print(f"[system_status] {'ok' if ok else 'FAILED'} {result[:200]!r}")
    return ok


async def check_metmuseum_mcp() -> bool:
    mcp = tools.build_metmuseum_mcp()
    await mcp.connect()
    try:
        names = {f.name for f in mcp.functions}
        allowlisted_ok = names == set(tools.METMUSEUM_ALLOWED_TOOLS)
        search = next(f for f in mcp.functions if f.name == "search-museum-objects")
        search_result = _text(await search.invoke(q="Van Gogh"))
        search_ok = "objectIDs" in search_result
        print(f"[metmuseum_allowlist] {'ok' if allowlisted_ok else 'FAILED'} names={names!r}")
        print(f"[metmuseum_search] {'ok' if search_ok else 'FAILED'} {search_result[:150]!r}")
        return allowlisted_ok and search_ok
    finally:
        await mcp.close()


async def demo() -> None:
    results = {
        "web_search": await check_web_search(),
        "system_status": await check_system_status(),
        "metmuseum_mcp": await check_metmuseum_mcp(),
    }
    print("\n=== summary ===")
    for name, ok in results.items():
        print(f"{name}: {'PASS' if ok else 'FAIL'}")

    assert results["web_search"], "SearXNG web_search tool failed"
    assert results["system_status"], "system_status tool failed"
    assert results["metmuseum_mcp"], "metmuseum-mcp allowlist or search failed"


if __name__ == "__main__":
    asyncio.run(demo())
