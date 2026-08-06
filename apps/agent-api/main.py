"""Agent API — single Agent Framework agent exposed over AG-UI (Track C).

Wired to both the Track A GB10 local vLLM endpoint and the Track B Foundry
deployment; `AGENT_PROVIDER` (local|foundry, default local) picks which one
backs the Main Agent. DESIGN.md 5.6 ModelRouter will pick automatically later.
"""

from __future__ import annotations

import os

from agent_framework import Agent
from agent_framework.ag_ui import add_agent_framework_fastapi_endpoint
from agent_framework.openai import OpenAIChatCompletionClient
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

AGENT_PROVIDER = os.environ.get("AGENT_PROVIDER", "local")

LOCAL_VLLM_BASE_URL = os.environ.get("LOCAL_VLLM_BASE_URL", "http://127.0.0.1:8000/v1")
LOCAL_VLLM_MODEL = os.environ.get("LOCAL_VLLM_MODEL", "exaone-3.0-7.8b")

FOUNDRY_PROJECT_ENDPOINT = os.environ.get("FOUNDRY_PROJECT_ENDPOINT")
FOUNDRY_MODEL = os.environ.get("FOUNDRY_MODEL", "gpt-5-mini-1")


def build_client(provider: str = AGENT_PROVIDER) -> OpenAIChatCompletionClient:
    """Same OpenAI-compatible client either way — Foundry's project endpoint
    speaks the OpenAI API directly (see docs/track-b-findings.md), so this
    only needs an Entra ID bearer-token provider swapped in for the API key.
    """
    if provider == "foundry":
        if not FOUNDRY_PROJECT_ENDPOINT:
            raise ValueError("FOUNDRY_PROJECT_ENDPOINT not set (required for AGENT_PROVIDER=foundry)")
        from azure.identity.aio import DefaultAzureCredential, get_bearer_token_provider

        token_provider = get_bearer_token_provider(DefaultAzureCredential(), "https://ai.azure.com/.default")
        return OpenAIChatCompletionClient(
            model=FOUNDRY_MODEL,
            api_key=token_provider,
            base_url=FOUNDRY_PROJECT_ENDPOINT.rstrip("/") + "/openai/v1",
        )
    return OpenAIChatCompletionClient(
        model=LOCAL_VLLM_MODEL,
        api_key="not-needed",
        base_url=LOCAL_VLLM_BASE_URL,
    )


app = FastAPI(title="Foundry Hybrid Agent API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = build_client()

main_agent = Agent(
    name="main_agent",
    instructions="You are a helpful assistant. Be concise and friendly.",
    client=client,
)

# Registered as "default" so the web app's CopilotChat can omit an explicit
# agent id (CopilotKit falls back to the "default" runtime agent key).
add_agent_framework_fastapi_endpoint(app=app, agent=main_agent, path="/default")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "8787")),
    )
