"""Agent API — single Agent Framework agent exposed over AG-UI (Track C).

Wired to the Track A GB10 local vLLM endpoint (Foundry/Track B not built yet;
DESIGN.md 5.6 ModelRouter will pick between providers later).
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

app = FastAPI(title="Foundry Hybrid Agent API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAIChatCompletionClient(
    model=LOCAL_VLLM_MODEL,
    api_key="not-needed",
    base_url=LOCAL_VLLM_BASE_URL,
)

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
