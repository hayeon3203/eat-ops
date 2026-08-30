#!/usr/bin/env bash
# Starts the GB10 local model server. apps/agent-api가 LOCAL_VLLM_BASE_URL로 붙는다.
# Port 8000: avoids ollama (11434) and open-webui (8080).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$HERE/.venv"

# 모델은 EXAONE-4.0. 3.0/3.5는 chat template에 tool 항목이 없어(339자, tools/
# tool_call 없음) --enable-auto-tool-choice가 그냥 무력이었다 — tool 정의가
# 모델에 렌더링조차 되지 않아 로컬 provider는 어떤 tool도 부르지 못했다.
# 4.0의 chat_template.jinja는 <tool>로 정의를 넣고 <tool_call>{"name",
# "arguments"}</tool_call>로 답하는 Hermes 형식이라 아래 파서와 맞는다.
# FP8은 bf16 64GB를 절반으로 줄이려는 것 — GB10 통합 메모리를 다른 텐넌트와
# 나눠 쓴다.
exec "$VENV/bin/vllm" serve LGAI-EXAONE/EXAONE-4.0-32B-FP8 \
  --served-model-name exaone-4.0-32b \
  --host 127.0.0.1 \
  --port 8000 \
  --trust-remote-code \
  --dtype "${VLLM_DTYPE:-auto}" \
  --gpu-memory-utilization "${VLLM_GPU_MEM_UTIL:-0.4}" \
  --max-model-len "${VLLM_MAX_MODEL_LEN:-16384}" \
  --enable-auto-tool-choice \
  --tool-call-parser hermes
