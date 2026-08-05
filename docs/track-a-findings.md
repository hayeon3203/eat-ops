# 트랙 A 구현 기록 — GB10 로컬 (vLLM + EXAONE-3.0-7.8B)

IMPLEMENTATION_PLAN.md 트랙 A 완료 조건 충족: 로컬 vLLM endpoint에 OpenAI 호환 호출로 응답과 tool call이 온다. (`tests/contract/test_local_provider.py` 통과)

## 계획 문서와 다른 점

- **체크포인트가 BF16이 아니라 FP32였다.** `LGAI-EXAONE/EXAONE-3.0-7.8B-Instruct`의
  `config.json`은 `torch_dtype: float32`. 원본 그대로 받으면 약 30GB. `vllm serve`에
  `--dtype bfloat16`을 줘서 로드 시점에 캐스팅, 실제 GPU 메모리는 계획대로 ~15.6GB.
- **`max_position_embeddings`가 4096으로 고정.** `--max-model-len`을 이보다 크게 주면
  기동 실패.
- **GB10 통합 메모리가 다른 프로세스와 공유·변동된다.** 평가 시점에 ollama, huyuan-env
  등이 이미 GPU 메모리를 쓰고 있었고, 다른 작업이 중간에 메모리를 반납하면서
  `--gpu-memory-utilization 0.35` 기동이 두 번 실패:
  - 1차: 여유 메모리(30GB)가 요청량(42GB)보다 적어서 실패.
  - 2차: 프로파일링 도중 여유 메모리가 30GB→49GB로 변해서 vLLM이 안전장치로 기동 거부
    (`AssertionError: Error in memory profiling`).
  `--gpu-memory-utilization 0.2`로 낮추고 재시도해서 기동 성공. 다른 GPU 작업이 활발할
  때는 재시도가 필요할 수 있다.

## Tool calling 실측 (계획 5절이 요구한 검증)

- `tool_choice="auto"`: EXAONE-3.0은 tool-use 학습이 없어서 스스로 tool을 호출하지
  않는다. 매번 tool_calls가 빈다.
- `tool_choice="required"`: vLLM이 grammar-constrained decoding으로 스키마를 강제하므로
  모델 학습 여부와 무관하게 문법적으로 유효한 tool call이 나온다. 단, 모델이 멈출 줄
  몰라서 `max_tokens`를 넉넉히 주면 같은 tool call을 반복 생성한다 (`max_tokens=200`일 때
  6번 반복). `max_tokens=40` 정도로 좁히면 정확히 1개만 나온다.

**결론:** 로컬 유틸리티 에이전트(DESIGN.md 5.5)가 EXAONE에 tool 호출을 시키려면 항상
`tool_choice="required"`를 명시하고 `max_tokens`를 작게 잡아야 한다. `auto`에 맡기는
설계는 로컬 모델에서 동작하지 않는다.

## 재현 방법

```bash
# 1. 서버 기동 (infra/local/.venv에 vllm 0.26.0 설치됨)
infra/local/start-vllm.sh
# 필요시 튜닝: VLLM_GPU_MEM_UTIL=0.2 VLLM_MAX_MODEL_LEN=4096 infra/local/start-vllm.sh

# 2. contract test
infra/local/.venv/bin/python tests/contract/test_local_provider.py
```
