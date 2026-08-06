# 트랙 B 구현 기록 — Azure / Foundry

IMPLEMENTATION_PLAN.md 트랙 B 완료 조건 충족: Foundry endpoint에 동일한 provider 인터페이스로 호출해 응답을 받는다. (`tests/contract/test_foundry_provider.py` 통과)

## 계획 문서와 다른 점

- **Phi-4 대신 GPT-5-mini.** 이 구독(동덕여대 테넌트, 초기 Azure 구독)의 서버리스(MaaS) 모델
  카탈로그 필터에 Phi-4가 뜨지 않음. gpt-oss-20b도 확인했으나 Managed Compute(GPU 필요)로만
  배포 가능해서 제외 — DESIGN.md 비목표("초기 버전에서 자동 파인튜닝 제공 안 함")와도 어긋남.
  Claude Sonnet 5는 Free Trial 구독에서 Global Standard RPM/ITPM이 정책상 0으로 막혀있어 배포
  자체가 안 됨 (리전 문제 아님 — Global Standard quota는 리전이 아니라 구독 단위로 공유되는
  풀이라 리전을 바꿔도 소용없음). 최종적으로 quota가 열려 있는 GPT-5-mini(serverless, deployment
  name `gpt-5-mini-1`)로 배포.
- **`max_tokens` 대신 `max_completion_tokens`.** gpt-5-mini는 reasoning 계열이라 구버전 파라미터
  `max_tokens`를 거부한다 (`400 unsupported_parameter`).
- **reasoning 토큰이 completion 예산을 먼저 먹는다.** `max_completion_tokens=20`으로 호출하면
  보이지 않는 reasoning에 전부 소모되어 `content`가 빈 문자열로 옴 (`usage.completion_tokens_details.reasoning_tokens`
  확인 결과 응답 하나에 ~64 토큰). 실사용 시 `max_completion_tokens`를 넉넉히(최소 200 이상)
  잡아야 함 — 짧은 답을 원해도 그대로.

## 인증

`az login` 기반 `DefaultAzureCredential`. API 키를 코드나 환경 변수에 저장하지 않음 (DESIGN.md 7절
원칙 유지). `azure-ai-projects`의 `AIProjectClient.get_openai_client()`가 project endpoint에
`/openai/v1`을 붙이고 bearer token provider를 자동으로 물려서 표준 `openai` 클라이언트를 반환 —
Track A의 `LocalGB10Provider`와 완전히 동일한 `ChatResult`/`ModelProvider` 인터페이스로 감쌀 수 있었음.

## 재현 방법

```bash
az login   # 최초 1회, 이후 토큰 캐시 재사용

FOUNDRY_PROJECT_ENDPOINT="https://u20211544-3006-resource.services.ai.azure.com/api/projects/u20211544-3006" \
FOUNDRY_MODEL="gpt-5-mini-1" \
infra/local/.venv/bin/python tests/contract/test_foundry_provider.py
```
