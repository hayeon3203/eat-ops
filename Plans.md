# Foundry Hybrid Agent 구현 계획

## 1. 계획의 목적

이 문서는 `DESIGN.md`와 `IMPLEMENTATION_QUESTIONS.md`의 결정을 실행 가능한 작업으로 구체화한다. 첫 목표는 GB10 한 대에서 CopilotKit UI, Microsoft Agent Framework 기반 Agent API, Microsoft Foundry의 Phi-4, 로컬 모델을 연결하여 사용자가 `자동 | 클라우드 | 로컬` 경로를 선택할 수 있는 데모를 만드는 것이다.

두 번째 목표는 민감 정보가 Foundry로 전송되지 않는 정책을 자동화된 테스트로 증명하는 것이다. 이후 Met Museum MCP와 read-only 도구를 붙이고, 외부 변경을 일으키는 도구에는 사용자 승인(HITL)을 적용한다.

이 계획은 1인 개발·개인 데모를 전제로 한다. 일정은 날짜가 아니라 의존성과 완료 조건을 기준으로 관리한다.

## 2. 확정된 범위와 원칙

### MVP에 포함

- Next.js + CopilotKit 기반 스트리밍 채팅 UI
- Python + Microsoft Agent Framework + FastAPI 기반 Agent API
- Microsoft Foundry에 배포한 Phi-4 연결
- GB10의 vLLM OpenAI 호환 API와 EXAONE 계열 로컬 모델 연결
- 수동 모델 선택과 서버 정책 기반 자동 라우팅
- 명시적 민감도, 결정적 규칙, 로컬 분류기를 조합한 민감도 판정
- SearXNG 웹 검색과 시스템/GPU 상태 조회 도구
- Met Museum MCP를 이용한 MCP 연동 데모
- 모델 경로, 라우팅 이유, fallback 및 도구 실행 상태 표시
- 위험 도구 실행 전 사용자 승인 흐름의 최소 구현
- 라우팅·공급자·도구·스트리밍 경계의 자동화 테스트

### MVP에서 제외

- 사용자 로그인, 권한 관리 및 멀티테넌시
- PostgreSQL/Redis와 재시작 후 세션 복구
- 인터넷에 서비스 공개 또는 외부에서 GB10 접근
- Managed Identity와 운영용 Azure 인프라 자동화
- 장기 대화 저장, 전문(prompt/response) 로깅
- 다중 GPU/다중 사용자 성능 최적화와 자동 파인튜닝

### 구현 원칙

1. 브라우저는 Foundry나 vLLM을 직접 호출하지 않는다.
2. 공급자 SDK 응답은 adapter 안에서 공통 계약으로 변환한다.
3. 보안 정책은 사용자 모드 선택보다 우선하며 민감 요청은 fail-closed로 처리한다.
4. 라우팅 결정은 LLM 프롬프트가 아니라 테스트 가능한 서버 코드로 수행한다.
5. Main Agent가 로컬 모델을 임의 호출하지 못하게 하고 승인된 gateway/agent 경로만 사용한다.
6. 프레임워크의 prerelease 변경을 흡수하도록 CopilotKit, Agent Framework, AG-UI, MCP 경계를 얇은 adapter로 감싼다.
7. 각 단계는 실행 가능한 수직 슬라이스와 자동화된 완료 조건을 남긴다.

## 3. 현재 환경 기준선

2026-08-04 점검 기준이다.

| 항목 | 확인 결과 | 계획상 처리 |
|---|---|---|
| OS | Ubuntu 24.04.4 LTS, ARM64 | 모든 이미지와 패키지의 ARM64 지원 확인 |
| GPU | NVIDIA GB10, driver 580.142 | CUDA/PyTorch/vLLM 조합을 설치 전 고정 |
| 컨테이너 | Docker 29.2.1 | SearXNG 및 선택적 보조 서비스에 사용 |
| JavaScript | Node 24.14.1, pnpm 11.9.0 | 호환 문제가 있으면 프로젝트에서 Node LTS 버전 고정 |
| Python | Python 3.12.3, uv 0.11.15 | Agent API 환경 관리에 사용 |
| 로컬 모델 | Ollama 0.31.2 실행 흔적, endpoint `127.0.0.1:11434` | 기존 GGUF 모델은 참고용; vLLM용 모델은 별도 준비 |
| vLLM | 실행 파일 미확인 | Milestone 2의 선행 검증 항목 |
| 검색 | SearXNG `0.0.0.0:8081`, JSON 응답 확인 | Agent API에서는 `127.0.0.1:8081`로만 호출 |
| Azure | 구독 있음, Foundry 프로젝트/배포 없음 | Milestone 1과 병렬로 리소스 준비 |

환경 기준선은 `docs/environment.md`에 재현 가능한 명령과 함께 기록한다. 비밀 값, 토큰, 전체 환경 변수 출력은 문서나 로그에 남기지 않는다.

## 4. 기술 선택

| 영역 | 선택 | 이유 |
|---|---|---|
| 패키지 관리 | pnpm workspace + uv workspace | 현재 설치되어 있고 프런트/백엔드 의존성을 빠르게 고정 가능 |
| 웹 | Next.js + TypeScript + CopilotKit | 설계의 UI/Runtime 요구와 직접 부합 |
| Agent API | FastAPI + Python + Microsoft Agent Framework | SSE, 타입 모델, 비동기 provider 호출 구성에 적합 |
| 데이터 모델 | Pydantic + 생성된 JSON Schema | Python 계약을 기준으로 TS 타입과 테스트 fixture 공유 |
| 로컬 추론 | vLLM OpenAI-compatible server | provider 교체가 쉽고 Agent API와 표준 클라이언트 계약 사용 가능 |
| 로컬 모델 | EXAONE 3.0 7.8B Instruct BF16 우선 후보 | GB10에서 일반 채팅을 먼저 검증하되 tool calling은 계약 테스트로 판정 |
| 클라우드 모델 | Microsoft Foundry의 Phi-4 | 사전 질문에서 확정한 최초 배포 모델 |
| 테스트 | pytest, Vitest, Playwright | 정책/백엔드, 프런트 상태, 브라우저 흐름을 각각 검증 |
| 관찰성 | 구조화 JSON 로그 우선, OpenTelemetry는 후속 | MVP에서 경로 판별 근거를 먼저 확보하고 운영 연동은 연기 |

정확한 패키지 버전과 Agent Framework/AG-UI 연결 방식은 구현 착수 시 공식 문서의 현재 호환 조합을 확인한 후 lockfile에 고정한다. Phi-4가 선택한 Foundry 배포 유형에서 tool calling 또는 필요한 응답 형식을 지원하지 않으면, Phi-4는 채팅 경로에 유지하고 도구 계획용 지원 모델을 별도 배포하는 결정을 ADR로 남긴다.

## 5. 목표 저장소 구조

```text
foundry-hybrid-agent/
├── apps/
│   ├── web/                         # Next.js, CopilotKit UI/Runtime
│   └── agent-api/                   # FastAPI, Agent Framework, AG-UI endpoint
├── services/
│   └── model-gateway/               # router, sensitivity policy, provider adapters
├── packages/
│   └── contracts/                   # JSON Schema, generated TypeScript types
├── infra/
│   └── local/                       # vLLM 실행 설정과 환경 예시
├── tests/
│   ├── contract/                    # Foundry/vLLM/MCP 기능 계약
│   ├── routing/                     # 정책 결정표와 fallback
│   └── e2e/                         # 브라우저부터 agent까지
├── docs/
│   ├── architecture.md
│   ├── environment.md
│   ├── threat-model.md
│   ├── runbooks.md
│   └── adr/
├── pnpm-workspace.yaml
├── pyproject.toml
├── .env.example                     # 이름과 설명만, 실제 secret 금지
└── README.md
```

초기에는 독립 배포 서비스 수를 늘리지 않는다. `services/model-gateway`는 논리적 모듈로 시작해 Agent API 프로세스 안에서 실행하고, 독립 확장이 필요할 때만 별도 서비스로 분리한다.

## 6. 공통 계약

구현 전에 아래 타입을 Pydantic 모델과 JSON Schema로 확정한다.

- `RequestedMode`: `auto | cloud | local`
- `Provider`: `foundry | local`
- `TaskType`: `chat | web_search | system_status | mcp | classify`
- `Sensitivity`: `public | internal | confidential | restricted | unknown`
- `RouteReason`: `USER_FORCED_CLOUD | USER_FORCED_LOCAL | SENSITIVE_DATA | QUALITY_REQUIRED | CAPABILITY_REQUIRED | CLOUD_UNAVAILABLE | LOCAL_UNAVAILABLE | AUTO_DEFAULT`
- `RouteDecision`: provider, model ID, reason, fallback 허용 여부, 제한 모드 여부, 적용할 마스킹 정책
- `RunMetadata`: `thread_id`, `run_id`, 선택 경로, reason, fallback, latency, token usage, error code
- `ApprovalRequest`: tool 이름, 사람이 읽을 수 있는 작업 설명, 입력 요약, 위험 수준, 승인 만료 시각

내부 오류는 `INVALID_REQUEST`, `POLICY_BLOCKED`, `PROVIDER_TIMEOUT`, `PROVIDER_RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, `CAPABILITY_UNSUPPORTED`, `TOOL_FAILED`, `APPROVAL_REQUIRED`로 정규화한다. UI와 로그가 공급자별 예외 문자열에 의존하지 않게 한다.

## 7. 마일스톤별 구현 순서

### Milestone 0 — 프로젝트 골격과 재현 가능한 개발 환경

#### 작업

1. pnpm/uv workspace, lint, format, type-check, test 명령을 구성한다.
2. `apps/web`, `apps/agent-api`, `services/model-gateway`, `packages/contracts`의 최소 골격을 만든다.
3. `.env.example`에 변수 이름, 용도, 필수 여부를 기록한다.
4. `/health/live`, `/health/ready`와 프런트 상태 페이지를 만든다.
5. 구조화 로그에 `run_id`와 `thread_id`를 포함하고 원문을 기본 제외한다.
6. 개발 실행 절차와 실제 GB10 기준선을 문서화한다.

#### 산출물

- 한 명령으로 lint/type-check/test를 수행하는 루트 스크립트
- 웹과 API의 health check
- secret이 없는 환경 변수 템플릿과 개발 README

#### 완료 조건

- 새 셸에서 문서 절차만으로 양쪽 앱을 실행할 수 있다.
- API health 응답과 빈 CopilotKit 화면이 브라우저에서 열린다.
- CI와 동일한 정적 검사 및 단위 테스트가 로컬에서 통과한다.

### Milestone 1 — Foundry 수직 슬라이스

Azure 준비는 앱 골격과 병렬로 진행하되, 자격 증명 생성이나 과금 리소스 생성은 사용자가 직접 수행할 수 있도록 체크리스트를 제공한다.

#### Azure 준비

1. Foundry 프로젝트와 지원 리전을 선택한다.
2. Phi-4 배포를 만들고 deployment name, endpoint, API version을 기록한다.
3. 개발 인증은 Azure CLI 또는 최소 범위 API key 중 공식 SDK가 지원하는 가장 단순한 방식을 사용한다.
4. 샘플 호출로 streaming, tool calling, structured output 지원 여부를 기록한다.
5. 비용 한도와 삭제 절차를 `docs/runbooks.md`에 기록한다.

#### 애플리케이션 작업

1. `FoundryProvider` adapter와 fake provider를 구현한다.
2. Agent Framework 단일 Agent를 만들고 AG-UI/SSE endpoint로 노출한다.
3. CopilotKit Runtime이 Agent API를 서버 간 호출하도록 연결한다.
4. 채팅 입력, 토큰 스트리밍, 오류, 취소, 재시도 UI를 구현한다.
5. 첫 read-only 도구로 `system_status`를 추가한다. 허용된 `nvidia-smi` 필드와 psutil 지표만 반환하고 임의 셸 입력은 받지 않는다.
6. 응답 헤더/상태 이벤트로 provider와 route reason을 UI에 표시한다.

#### 완료 조건

- 브라우저 질문에 Phi-4 답변이 점진적으로 표시된다.
- `system_status` 호출 시작/완료 상태와 결과가 표시된다.
- 브라우저 번들 및 네트워크 응답에 Foundry secret이 없다.
- provider를 fake로 바꾼 통합 테스트에서 AG-UI 이벤트 순서가 안정적으로 검증된다.

### Milestone 2 — GB10 로컬 모델 수직 슬라이스

#### 사전 기술 게이트

1. GB10 ARM64에서 지원되는 NVIDIA PyTorch/CUDA/vLLM 버전 조합을 확인하고 고정한다.
2. 별도 uv 환경 또는 공식 지원 컨테이너로 vLLM smoke test를 수행한다.
3. EXAONE 모델의 라이선스, chat template, 필요 메모리와 tokenizer 동작을 확인한다.
4. BF16 로딩, 짧은 생성, streaming, 동시 요청 1건을 검증한다.
5. vLLM이 해당 조합에서 동작하지 않으면 기능 구현을 중단하지 않고 `LocalProvider` 계약을 Ollama 임시 adapter로 검증한다. 단, 이를 vLLM 완료로 간주하지 않는다.

#### 구현

1. loopback에 바인딩된 vLLM 실행 설정과 health check를 추가한다.
2. `LocalProvider` adapter를 Foundry와 같은 내부 인터페이스로 구현한다.
3. UI에 `cloud | local` 수동 선택을 추가한다.
4. local 모드에서는 Local Utility Agent가 최종 답변까지 생성하도록 한다.
5. provider contract suite를 두 adapter에 동일하게 실행한다.

#### 계약 테스트 항목

- 일반 대화와 한국어 입력
- streaming 및 취소
- 최대 context/error 형식
- structured JSON 유효성
- tool calling 표현과 인자 파싱
- timeout 및 연결 실패 정규화

#### 완료 조건

- 동일 UI에서 cloud와 local을 선택해 각각 답변을 받을 수 있다.
- UI와 감사 로그의 provider/model 표시가 실제 호출과 일치한다.
- EXAONE의 tool calling이 기준을 충족하지 못해도 일반 채팅 경로는 유지되고, router가 tool 요청을 로컬로 보내지 않는다.

### Milestone 3 — 도구 및 MCP 데모

#### 작업

1. SearXNG adapter를 구현한다. query, 결과 수, safe-search 등 허용 필드만 전달하고 timeout과 최대 응답 크기를 제한한다.
2. `system_status` 도구 출력에 allowlist schema와 단위 테스트를 적용한다.
3. MCP client adapter와 server registry를 구현한다. 서버별 실행 명령, 환경 변수 allowlist, 허용 tool 목록을 설정으로 관리한다.
4. 첫 MCP 서버로 `metmuseum-mcp`를 고정 버전으로 등록한다.
5. 작품 검색 → 작품 상세 조회 → 관람 후보 요약의 읽기 전용 데모 시나리오를 만든다.
6. MCP 서버 중단, 잘못된 schema, prompt injection성 tool 결과를 처리한다.
7. 쓰기/외부 변경 도구를 추가할 때 사용할 `ApprovalRequired` 인터페이스와 mock 도구를 구현하여 승인·거절·만료 흐름을 시연한다.

#### 보안 경계

- MCP 서버가 임의 환경 변수나 호스트 파일을 상속하지 않게 한다.
- UI가 보낸 tool 이름/인자를 그대로 실행하지 않고 Agent API registry에서 재검증한다.
- 웹/MCP 결과는 신뢰할 수 없는 데이터로 표시하며 system instruction으로 승격하지 않는다.
- MVP의 실제 SearXNG, 시스템 조회, Met Museum MCP는 read-only로 제한한다.

#### 완료 조건

- 자연어 요청으로 웹 검색과 시스템 상태 조회가 실행되고 진행 상태가 보인다.
- Met Museum 작품 검색 데모가 재현된다.
- 허용 목록 밖 MCP tool은 실행 전에 차단된다.
- mock 위험 도구는 승인 전 실행되지 않고, 거절과 만료 시 부작용이 없다.

### Milestone 4 — 정책 기반 자동 라우팅과 민감 데이터 차단

#### 민감도 판정 순서

1. 사용자가 지정한 문서/요청 등급을 읽는다.
2. 주민등록번호, 카드번호, 비밀 키 패턴과 메타데이터에 결정적 규칙을 적용한다.
3. 판단이 `unknown`인 경우에만 로컬 분류기를 호출한다.
4. 분류기가 실패하거나 결과가 불명확하면 민감한 것으로 간주한다.

#### 라우팅 우선순위

1. 보안 정책과 공급자 egress 허용 여부
2. 필수 기능(tool calling, structured output 등) 충족 여부
3. 사용자의 `cloud | local` 선택
4. provider 상태와 circuit breaker
5. 품질, 비용, 지연 기준
6. `auto` 기본값인 Foundry

`cloud` 요청이 민감 정책과 충돌하면 자동 전송하지 않는다. UI에 정책 차단을 알리고 로컬 처리 또는 취소를 선택하게 한다. 민감 요청에서 local이 실패하면 cloud로 fallback하지 않는다.

#### fallback 정책

| 최초 경로 | 실패 | fallback | 결과 |
|---|---|---|---|
| Foundry | timeout/일시 장애/한도 | 요청이 비민감하고 local capability 충족 시 local | `limited_mode=true` 표시 |
| Foundry | 인증/잘못된 요청 | 없음 | 명시적 오류 반환 |
| Local | timeout/장애, 비민감 요청 | 사용자 모드가 `auto`일 때만 Foundry | 경로 변경 표시 |
| Local | timeout/장애, 민감 요청 | 없음 | fail-closed 오류 |
| 어느 경로든 | capability 부족 | 정책상 허용되는 capability 보유 경로 | 이유 `CAPABILITY_REQUIRED` |

retry는 동일 provider의 재시도 가능한 오류에만 짧은 지수 backoff와 jitter를 적용한다. 전체 요청 deadline을 넘지 않게 하고, circuit breaker의 상태(`closed | open | half_open`)와 전이 기준은 설정값으로 둔다.

#### 완료 조건

- 결정표 기반 단위 테스트가 모든 모드·민감도·기능·상태 조합을 검증한다.
- 민감 fixture 테스트에서 spy Foundry client 호출 횟수가 0임을 증명한다.
- Foundry timeout/rate limit/연결 실패 주입 시 허용된 요청만 local 제한 모드로 전환된다.
- 사용자가 선택한 모드, 실제 경로, 경로 변경 이유가 UI에서 구분된다.

### Milestone 5 — 데모 안정화와 문서화

#### 작업

1. 브라우저 E2E에 cloud/local 수동 선택, auto routing, tool, MCP, 정책 충돌, fallback을 포함한다.
2. prompt injection, 과대 tool 결과, 잘못된 MCP payload, provider 지연을 시험한다.
3. 모델별 첫 토큰/전체 지연, 성공률, tool schema 준수율을 측정한다.
4. 로그 redaction 테스트와 의존성/secret 검사를 추가한다.
5. 정상 시작·종료, 모델 교체, Foundry 장애, vLLM OOM, SearXNG/MCP 장애 runbook을 작성한다.
6. 데모 초기화 및 smoke test 명령을 제공한다.

#### 완료 조건

- 깨끗한 프로세스 시작부터 세 가지 데모 시나리오를 README만 보고 재현할 수 있다.
- 자동화 테스트가 민감 원문 비저장과 cloud 미호출을 확인한다.
- provider 한쪽이 중단되어도 정책에 정의된 UI 메시지와 fallback이 일관된다.
- 알려진 제한, 비용 발생 지점, 서비스 종료 방법이 문서화되어 있다.

## 8. 핵심 데모 시나리오

### 시나리오 A — 수동 모델 비교

같은 일반 질문을 cloud와 local 모드로 각각 실행한다. Phi-4와 EXAONE의 응답, 첫 토큰 지연, 실제 provider 경로를 UI에서 비교한다.

### 시나리오 B — 민감 데이터 경계 증명

테스트용 가짜 민감 식별자가 포함된 문서를 `cloud`로 요청한다. 서버가 Foundry 호출 전에 차단하고 로컬 처리 또는 취소를 제시한다. 로컬 처리 후 감사 이벤트에는 원문 대신 입력 해시, 민감도와 `SENSITIVE_DATA`만 남는다.

### 시나리오 C — Met Museum 관람 계획

사용자가 관심 화풍이나 작가를 말하면 Agent가 Met Museum MCP로 작품을 검색하고 상세 정보를 조회해 관람 후보를 정리한다. 사용한 MCP 도구와 진행 상태가 UI에 표시된다.

### 시나리오 D — 장애 fallback

Foundry adapter에 timeout을 주입한 비민감 `auto` 요청은 local 제한 모드로 전환된다. 같은 장애를 민감 요청에 주입하면 cloud fallback 없이 안전하게 실패한다.

## 9. 테스트 전략과 품질 게이트

| 계층 | 주요 검증 | 외부 의존성 |
|---|---|---|
| 단위 | ModelRouter 결정표, 민감 규칙, redaction, tool validation | 없음 |
| 계약 | Foundry/vLLM stream, JSON, tool capability, 오류 정규화 | 실제 provider 또는 명시적 opt-in |
| 통합 | Agent Framework → adapter → AG-UI 이벤트, MCP registry | fake provider/MCP 우선 |
| E2E | CopilotKit 입력부터 응답·승인·경로 표시 | fake 기본, 실제 provider smoke 별도 |
| 보안 | cloud 미호출, secret 비노출, MCP/tool allowlist | spy/fake client |

모든 PR/작업 단위의 기본 게이트는 format, lint, type-check, unit/integration test다. 실제 Foundry와 vLLM 테스트는 비용과 모델 가용성 때문에 별도 marker로 분리하되, 각 마일스톤 종료 전 반드시 한 번 실행해 결과를 기록한다. flaky한 실서비스 테스트를 필수 CI 게이트로 삼지 않는다.

## 10. 관찰성과 데이터 처리

MVP는 프로세스 내 세션 상태만 사용한다. 재시작하면 대화가 사라지는 것을 UI와 README에 명시한다.

각 실행은 다음 메타데이터만 구조화 로그로 남긴다.

- `timestamp`, `thread_id`, `run_id`, `user_id_hash`(있는 경우)
- requested/selected mode, provider, model ID, route reason
- fallback/limited mode, 오류 코드, retry 수
- 첫 토큰/전체 지연, 입력·출력 token usage(제공되는 경우)
- tool/MCP 이름, 성공 여부, 승인 상태
- 입력 원문의 비가역 해시와 민감도 판정 결과

프롬프트, 응답 전문, tool 결과 전문, credential은 기본적으로 기록하지 않는다. 개발 디버그 옵션으로 전문 로깅을 추가해야 한다면 명시적 opt-in과 redaction을 함께 요구하고 기본값은 꺼 둔다.

## 11. 설정과 비밀 관리

설정 그룹은 다음처럼 분리한다.

- Foundry: endpoint, project/deployment name, API version, 인증 방식
- Local: base URL, model ID, request timeout, capability flags
- Router: 기본 모드, 민감 규칙 버전, retry/deadline/circuit breaker 값
- Tools: SearXNG URL, 결과/응답 크기 제한, system metric allowlist
- MCP: 서버 registry, 버전, 명령, tool allowlist
- UI: Agent API의 서버 측 URL과 공개 가능한 표시 설정만

실제 secret은 커밋하지 않으며 `.env.example`에는 placeholder만 둔다. 웹의 `NEXT_PUBLIC_*`에는 비밀을 넣지 않는다. secret 탐지 검사를 품질 게이트에 포함한다.

## 12. 주요 의존관계와 의사결정 게이트

```text
M0 골격
 ├─ M1 Foundry 수직 슬라이스 ─┐
 └─ M2 로컬 수직 슬라이스 ───┼─ M4 자동 라우팅 ─ M5 안정화
                 M3 Tool/MCP ─┘
```

- M1은 Foundry 프로젝트와 Phi-4 배포가 준비되어야 실제 smoke test를 완료할 수 있다.
- M2의 vLLM 호환성 확인은 로컬 경로의 핵심 게이트다. 실패 시 adapter와 UI 작업은 fake/Ollama로 진행하되 마일스톤은 미완료로 표시한다.
- M3는 M1의 tool event streaming이 안정된 뒤 통합한다.
- M4는 두 provider의 capability matrix와 오류 정규화가 완료된 뒤 시작한다.
- Phi-4 또는 EXAONE이 tool calling 계약을 충족하지 않으면 모델이 지원한다고 가정하지 않고 router capability로 명시한다.

## 13. 위험과 대응

| 위험 | 조기 확인 | 대응 |
|---|---|---|
| Agent Framework/AG-UI API 변경 | M0 최소 spike | 버전 고정, adapter와 event fixture 유지 |
| GB10 ARM64에서 vLLM 설치 실패 | M2 첫 작업 | 지원 이미지/소스 빌드 평가, 임시 Ollama adapter와 명확히 구분 |
| EXAONE tool calling 불안정 | provider contract suite | local은 chat/classification으로 제한하고 tool 계획은 Foundry 사용 |
| Phi-4 배포 기능 차이 | Azure 준비 smoke test | chat과 planner 모델 역할 분리 여부를 ADR로 결정 |
| 민감 데이터 cloud 유출 | spy client/egress 테스트 | router 이전 cloud 호출 금지, unknown은 sensitive로 처리 |
| MCP 공급망/과도한 권한 | 버전·도구 목록 검토 | 고정 버전, 최소 환경, allowlist, read-only 우선 |
| 로컬 OOM/응답 지연 | BF16 load/부하 smoke | context·동시성 제한, health 기반 circuit breaker |
| 데모 중 외부 서비스 장애 | 장애 주입 리허설 | fake fixture와 제한 모드, 명확한 UI 상태 제공 |

## 14. MVP 종료 기준

다음 항목이 모두 충족되면 MVP를 완료한 것으로 본다.

- 브라우저에서 Foundry Phi-4와 GB10 로컬 모델을 각각 선택해 스트리밍 대화할 수 있다.
- `auto` 모드가 코드로 정의된 정책과 capability에 따라 경로를 선택한다.
- 민감 요청은 Foundry 호출 전에 차단되며 자동화 테스트로 cloud 미호출이 증명된다.
- SearXNG, 시스템/GPU 상태, Met Museum MCP 데모가 read-only 경계에서 동작한다.
- mock 위험 도구의 승인·거절·만료 흐름이 동작한다.
- fallback과 제한 모드가 UI 및 감사 로그에 정확히 표시된다.
- secret과 대화 전문이 브라우저 번들 또는 기본 로그에 남지 않는다.
- README와 runbook만으로 시작, 데모, 장애 복구, 종료가 가능하다.

## 15. MVP 이후 순서

1. SQLite 또는 PostgreSQL checkpoint와 세션 복구
2. OpenTelemetry collector 및 대시보드
3. Azure 배포, Managed Identity, 실제 인증/권한
4. 네트워크 분리된 GB10 접근(VPN 또는 outbound tunnel)
5. 실제 write tool의 세밀한 HITL 정책과 승인 감사
6. 모델별 품질/비용 평가를 반영한 router budget
7. 추가 MCP 아이템과 서버별 sandbox 강화

이 후속 범위는 MVP의 provider/router/tool 계약을 변경하지 않고 교체하거나 확장할 수 있어야 한다.

## 16. Milestone 6 — 사내망 배포 (소규모 다중 사용자)

2026-08-11 추가. §15-3/4의 "Azure 배포/Managed Identity"와 "네트워크 분리된 GB10 접근"을 대체하는 게 아니라, 그 전 단계로 사내 LAN 안에서 동료 몇 명이 같은 GB10 인스턴스에 접속해 쓸 수 있게 하는 작업이다. §2의 비목표("GB10을 다중 사용자용 대규모 추론 클러스터로 사용하는 것")는 유지한다 — 여기서 말하는 다중 사용자는 동시 5명 이하의 캐주얼 사내 접근이지, 대규모 서빙이 아니다.

오늘(2026-08-11) SSH+LAN(`172.16.4.228`)으로 접속했을 때 사이드바 리스트/마커가 전부 비어 보이는 문제를 겪었다 — `apps/web`의 `NEXT_PUBLIC_AGENT_API_URL` 기본값이 `127.0.0.1:8787`이라 원격 브라우저 기준으로는 자기 자신을 가리켰고, `apps/agent-api`도 `HOST=127.0.0.1`로만 떠 있어서 LAN에서 접근 자체가 불가능했다. 임시로 `HOST=0.0.0.0` 재시작 + `.env.local`에 LAN IP 하드코딩으로 고쳤지만, 이 상태는 인증 없이 LAN 전체에 채팅/도구 실행/삭제 엔드포인트를 열어둔 것이라 그대로 "배포"로 볼 수 없다.

### 작업

1. [lane:gate] (완료, 2026-08-11) 접근 보호: 로그인 없이 LAN 전체에 열어두는 대신 최소한의 gate를 둔다 — 공유 passcode/토큰 기반 미들웨어(FastAPI) 또는 reverse proxy basic auth 중 더 단순한 쪽을 선택한다. → 네이티브 HTTP Basic Auth로 구현: `apps/agent-api/main.py`의 `_BasicAuthMiddleware`(8787), `apps/web/proxy.ts`(3000). 브라우저가 origin당 한 번 물어보고 캐싱하므로 프런트 fetch 코드 변경 없음(server-to-server 프록시인 `apps/web/app/api/copilotkit/[provider]/route.ts`만 `Authorization` 헤더 직접 첨부). `BASIC_AUTH_PASS` 미설정 시 게이트 꺼짐(로컬 개발 무영향). curl로 401/200 검증 완료.
2. [lane:gate] (조사 완료, 2026-08-11) `cost_guard.py`의 일일 비용 하드캡이 서버 전체 공용인지 확인 → **확인: 프로세스 전역(`_state` 모듈 변수), 사용자/세션 구분 없음.** 로컬 vLLM은 무료라 캡 대상이 아니고(현재 Foundry 미설정이라 지금 당장은 영향 없음), Foundry가 설정되면 동료 한 명이 하루치 $50을 다 쓰면 나머지 전원이 그날 Foundry 사용 불가. IP/세션별 쿼터로 확장할지, 이대로 문서화만 하고 넘어갈지 결정 필요(구현은 아직 안 함).
3. [lane:fast] (조사 완료, 2026-08-11) CopilotKit thread/agent state 격리 확인 → **확인: `AgentState`(`current_places` 등)는 Python 쪽에 전역 변수가 없고 AG-UI 프로토콜의 STATE_SNAPSHOT/DELTA로 SSE 연결(스레드)별로 흐른다 — 세션 간 안 섞임.** 단, `approvals.py`의 `_pending` dict는 `cost_guard`와 같은 패턴의 프로세스 전역 — approval_id를 아는(추측 가능한) 사람이면 누구 approval이든 승인/거절 가능. `mock_risky_action`은 데모 전용이라 지금은 낮은 리스크로 판단, 실제 위험 도구 붙일 때(§15-5) 재검토 필요.
4. [lane:gate] 오늘 겪은 `127.0.0.1` 하드코딩 문제를 재발 방지하도록 `.env.example`과 README에 "사내망 배포 시 설정값"(`HOST=0.0.0.0`, `NEXT_PUBLIC_AGENT_API_URL=http://<LAN-IP>:8787`) 섹션을 추가한다.
5. [lane:gate] [tdd:skip:manual-infra-verification] 동료 1~2명과 동시 접속 smoke test를 실행하고 지연/에러를 기록한다.

### 완료 조건

- 사내 LAN의 다른 기기에서 passcode/토큰 없이는 채팅·기록 삭제 등 어떤 엔드포인트도 실행할 수 없다.
- 동시 사용자 2명 이상이 서로의 대화나 기록이 섞이지 않고 사용할 수 있다.
- README에 사내망 배포 절차(바인딩, 환경변수, 접근 제한)가 문서화된다.
- 일일 비용 캡이 전체 서비스를 막는지, 사용자 단위인지가 명확히 문서화된다(고치지 않더라도 한계로 명시).

## 17. Milestone 7 — 방문 기록 사진 첨부

2026-08-11 추가. [기록] 탭(Visit)에 사진을 올려 팀원들이 방문한 곳을 사진과 함께 남기고 볼 수 있게 한다. Milestone 6(사내망 배포)와 별개로 구현 가능하지만, "여러 사람이 같이 쓴다"는 실사용 가치는 M6 완료 후에 실현된다.

현재 `visits` 테이블(`apps/agent-api/db.py`)에는 사진 컬럼이 없고, visit 생성은 채팅 tool(`tools.py`의 `record_visit`)로만 가능하다 — 파일 업로드는 채팅 tool-call로 못 하므로, 추천(Recommendation) 쪽처럼 REST 폼을 새로 만들어야 한다.

### 작업

1. [lane:gate] [tdd:required] DB: `visits` 테이블에 `photo_path`(nullable TEXT) 컬럼 추가 — `recommendations` 확장 때 쓴 `ALTER TABLE ... ADD COLUMN` 무중단 마이그레이션 패턴(`db.py` 기존 주석 "Added after the table already shipped" 참고)을 그대로 재사용한다.
2. [lane:gate] [tdd:required] `POST /api/visits`(신규, multipart/form-data) 엔드포인트 구현 — 장소 정보 + 사진 파일을 받아 로컬 디스크(`apps/agent-api/data/photos/{visit_id}.jpg`)에 저장하고 `photo_path`를 기록한다.
3. [lane:gate] 업로드 검증: 파일 타입(jpg/png만 허용), 크기 제한(예: 5MB), 파일명 sanitize — 경로 조작이나 임의 파일 저장을 막는다.
4. [lane:gate] 사진 서빙: `GET /api/visits/{id}/photo` 또는 static mount로 노출한다.
5. [lane:gate] 프런트: `RecommendationForm.tsx` 패턴을 재사용한 `VisitForm.tsx` 신규 — 장소명/별점/노트 + 사진 첨부 input. `VisitList.tsx`/`RestaurantCard.tsx`에 썸네일을 표시한다.
6. [lane:fast] 사이드바 [기록] 카드와 지도 마커 클릭 카드(`Sidebar.tsx`의 선택 장소 패널)에 썸네일을 표시하고, 클릭 시 원본을 새 탭으로 연다.

### 완료 조건

- REST 폼으로 사진과 함께 방문 기록을 등록할 수 있다(채팅 경유 없이).
- [기록] 리스트와 지도 마커 클릭 카드에 썸네일이 보인다.
- 5MB 초과 또는 이미지가 아닌 파일 업로드 시 서버가 400으로 거부한다.
- M6 완료 후 여러 명이 동시에 사진을 올려도 파일명 충돌이 없다.
