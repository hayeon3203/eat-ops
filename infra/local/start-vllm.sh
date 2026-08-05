#!/usr/bin/env bash
# Starts the GB10 local model server for Track A (services/model-gateway/providers/local_gb10.py).
# Port 8000: avoids ollama (11434) and open-webui (8080).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$HERE/.venv"

exec "$VENV/bin/vllm" serve LGAI-EXAONE/EXAONE-3.0-7.8B-Instruct \
  --served-model-name exaone-3.0-7.8b \
  --host 127.0.0.1 \
  --port 8000 \
  --trust-remote-code \
  --dtype "${VLLM_DTYPE:-bfloat16}" \
  --gpu-memory-utilization "${VLLM_GPU_MEM_UTIL:-0.2}" \
  --max-model-len "${VLLM_MAX_MODEL_LEN:-4096}" \
  --enable-auto-tool-choice \
  --tool-call-parser hermes
