# Foundry Hybrid Agent 구현 계획

`DESIGN.md`와 `IMPLEMENTATION_QUESTIONS.md`의 결정을 바탕으로 작업 순서, 의존관계, 산출물, 완료 조건을 정리한다.

## 1. 확정된 결정 요약

| 항목 | 결정 | 비고 |
|---|---|---|
| 로컬 서빙 백엔드 | vLLM 신규 설치 | Ollama는 이미 떠 있지만 GGUF라 재사용 안 함 |
| 로컬 모델 | EXAONE-3.0-7.8B-Instruct, BF16 | 양자화 없음, 119GB 유니파이드 메모리로 충분 |
| Foundry 모델 | Phi-4 (serverless/MaaS) | 오픈소스, GPU 쿼터 불필요, pay-per-token |
| Phase 순서 | 병렬 진행 | Azure/Foundry 가입과 로컬+CopilotKit 스캐폴드 동시 진행 |
| 인증 | 생략 | 개인 데모, CopilotKit Runtime 경계에서 고정 user_id만 사용 |
| 세션/대화 상태 | 프로세스 내 메모리 | 재시작 시 세션 소실 허용, Postgres는 이후 단계 |
| Tool 1 (웹 검색) | 기존 SearXNG(8081) 재사용 | API 키 불필요 |
| Tool 2 (시스템 상태) | nvidia-smi/psutil 직접 호출 | Prometheus 연동은 보류 |
| 첫 MCP 서버 | metmuseum-mcp | API 키 불필요, npx로 바로 연결 |
| 기본 라우팅 | 일반 질의는 항상 Foundry(Phi-4) | 한국어라도 EXAONE으로 분기하지 않음, MVP는 일관성 우선 |
| 민감도 판정 | 명시적 등급 + 규칙, 애매할 때만 로컬 LLM | DESIGN.md 3.3, 7절 원안 유지 |
| 저장소 구조 | DESIGN.md 10절 원안 유지 | apps/web, apps/agent-api, services/model-gateway 등 |

## 2. 트랙 A — GB10 로컬 (즉시 시작 가능, 외부 의존성 없음)

1. vLLM 설치 (aarch64 + CUDA 13, torch 2.12.1+cu130 기존 확인됨)
2. EXAONE-3.0-7.8B-Instruct HF 원본(BF16) 다운로드
3. vLLM OpenAI 호환 서버 기동, 포트는 `11434`(ollama)·`8080`(open-webui)과 충돌하지 않게 선정
4. `services/model-gateway`에 로컬 provider adapter 작성 (OpenAI 호환 클라이언트)
5. tool calling / structured output 계약 테스트로 EXAONE 실제 지원 여부 검증

완료 조건: 로컬 vLLM endpoint에 OpenAI 호환 호출로 응답과 tool call이 온다.

## 3. 트랙 B — Azure / Foundry (병렬, 사람이 처리할 부분 있음)

1. Azure 구독 가입
2. Foundry 프로젝트 생성
3. Phi-4 serverless 배포, deployment name 확보
4. 개발 환경 인증 방식 결정 (Azure CLI 로그인 우선, 이후 Managed Identity는 운영 단계)
5. `services/model-gateway`에 Foundry provider adapter 작성

완료 조건: Foundry endpoint에 동일한 provider 인터페이스로 호출해 응답을 받는다.

## 4. 트랙 C — CopilotKit + Agent Framework 스캐폴드 (병렬, 외부 의존성 없음)

1. `apps/web`: Next.js + CopilotKit 채팅 UI 최소 구성
2. `apps/agent-api`: Python + Agent Framework, 단일 Agent + AG-UI endpoint
3. CopilotKit Runtime에서 `HttpAgent`로 agent-api 등록, 인증은 생략(고정 user_id)
4. 트랙 A/B의 provider adapter가 준비되는 대로 Main Agent에 연결

완료 조건: 브라우저에서 메시지를 보내면 AG-UI 스트리밍으로 응답이 온다 (이 시점에는 로컬/Foundry 둘 중 먼저 준비된 쪽으로).

## 5. 통합 단계 — Tool + MCP

1. `local_inference` 또는 직접 tool로 SearXNG 웹 검색 tool 추가
2. nvidia-smi/psutil 기반 시스템 상태 조회 tool 추가
3. metmuseum-mcp를 MCP 서버로 Agent Framework에 연결
4. 브라우저 UI에서 tool call 진행 상태 렌더링 확인

완료 조건: 웹 검색·시스템 상태 조회·MCP(미술관 검색) 세 가지가 채팅에서 각각 동작한다. (Q1 옵션 D 목표 달성)

## 6. 두 번째 마일스톤 — 민감 데이터 경계 증명

DESIGN.md 6절 "민감 문서 요청" 흐름대로 ModelRouter의 최소 버전 구현.

1. 요청에 `confidential` 명시 등급 지정 기능
2. ModelRouter가 해당 등급이면 Foundry 호출 차단, 로컬(EXAONE)로만 처리
3. 감사 로그에 원문 대신 해시 + 라우팅 이유 코드만 기록 확인

완료 조건: `confidential` 등급 요청 시 Foundry provider adapter가 호출되지 않았음을 테스트로 증명한다.

## 7. 보류 항목 (코딩 단계에서 결정)

- circuit breaker 임계값, timeout·retry 구체적 수치
- HITL 승인이 필요한 tool 범위 (현재 tool 3종은 전부 read-only라 당장 불필요)
- 모델별 계약 테스트의 구체적 통과 기준
- 패키지 관리자/모노레포 도구 (pnpm + uv + FastAPI, 모노레포 도구 없음으로 기본 진행, 필요시 변경)

## 8. 향후 아이디어 (스코프 아님, 기록만)

- 기본 tool calling + MCP 연결이 검증되면, 다음으로 **맛집 지도** 기능 시도
  - 별도 grilling 필요: 지도/장소 데이터 소스(MCP 또는 API), 방문 기록 저장 방식 등 미정
