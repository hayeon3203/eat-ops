"""Agent API — both Track A/B providers exposed over AG-UI (Track C).

Registers `/local` (GB10 vLLM) always, and `/foundry` (Foundry deployment)
whenever FOUNDRY_PROJECT_ENDPOINT is set, so the web UI can switch providers
per session (see apps/web/app/api/copilotkit/[provider]/route.ts) without
restarting this process. DESIGN.md 5.6 ModelRouter will pick automatically
later; this is still manual selection.
"""

from __future__ import annotations

import os

from agent_framework import Agent
from agent_framework.ag_ui import add_agent_framework_fastapi_endpoint
from agent_framework.openai import OpenAIChatCompletionClient
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

LOCAL_VLLM_BASE_URL = os.environ.get("LOCAL_VLLM_BASE_URL", "http://127.0.0.1:8000/v1")
LOCAL_VLLM_MODEL = os.environ.get("LOCAL_VLLM_MODEL", "exaone-3.0-7.8b")

FOUNDRY_PROJECT_ENDPOINT = os.environ.get("FOUNDRY_PROJECT_ENDPOINT")
FOUNDRY_MODEL = os.environ.get("FOUNDRY_MODEL", "gpt-5-mini-1")

INSTRUCTIONS = "You are a helpful assistant. Be concise and friendly."


def build_local_client() -> OpenAIChatCompletionClient:
    return OpenAIChatCompletionClient(
        model=LOCAL_VLLM_MODEL,
        api_key="not-needed",
        base_url=LOCAL_VLLM_BASE_URL,
    )


def build_foundry_client() -> OpenAIChatCompletionClient:
    """Foundry's project endpoint speaks the OpenAI API directly (see
    docs/track-b-findings.md), so this only needs an Entra ID bearer-token
    provider swapped in for the API key. Needs the *async* azure.identity
    variant — agent_framework builds an AsyncOpenAI client, which awaits its
    api_key callable; the sync provider raises `TypeError: object str can't
    be used in 'await' expression`.
    """
    if not FOUNDRY_PROJECT_ENDPOINT:
        raise ValueError("FOUNDRY_PROJECT_ENDPOINT not set")
    from azure.identity.aio import DefaultAzureCredential, get_bearer_token_provider

    token_provider = get_bearer_token_provider(DefaultAzureCredential(), "https://ai.azure.com/.default")
    return OpenAIChatCompletionClient(
        model=FOUNDRY_MODEL,
        api_key=token_provider,
        base_url=FOUNDRY_PROJECT_ENDPOINT.rstrip("/") + "/openai/v1",
    )


app = FastAPI(title="Foundry Hybrid Agent API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

local_agent = Agent(name="local_agent", instructions=INSTRUCTIONS, client=build_local_client())
add_agent_framework_fastapi_endpoint(app=app, agent=local_agent, path="/local")

if FOUNDRY_PROJECT_ENDPOINT:
    foundry_agent = Agent(name="foundry_agent", instructions=INSTRUCTIONS, client=build_foundry_client())
    add_agent_framework_fastapi_endpoint(app=app, agent=foundry_agent, path="/foundry")
else:
    print("[agent-api] FOUNDRY_PROJECT_ENDPOINT not set — /foundry endpoint disabled")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "8787")),
    )
