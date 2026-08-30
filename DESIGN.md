# eat-ops 설계 문서

## 1. 문서 목적

GB10 장비를 에지 AI 노드로 사용하면서 Microsoft Foundry의 호스팅 모델과 로컬 LLM을 함께 사용하는 하이브리드 에이전트 애플리케이션을 설계한다.

사용자 인터페이스는 CopilotKit, 에이전트 실행 계층은 Microsoft Agent Framework, 기본 추론 모델은 Microsoft Foundry를 사용한다. GB10의 로컬 모델은 민감 데이터 처리, 저비용 보조 작업, 오프라인 동작 및 클라우드 장애 시 제한적 대체 경로를 담당한다.

## 2. 목표와 비목표

### 목표

- CopilotKit 기반 스트리밍 채팅 UI 제공
- Agent Framework 기반 도구 호출, 세션, 워크플로 및 승인 처리
- Microsoft Foundry 모델을 기본 추론 경로로 사용
- GB10 로컬 LLM을 정책에 따라 선택적으로 사용
- 모델 제공자가 바뀌어도 Agent와 Tool 코드를 최대한 재사용
- 민감 정보가 클라우드 모델로 전달되는 경로를 통제
- 각 요청의 모델 선택 이유, 지연시간, 비용 및 오류를 관찰 가능하게 기록

- 사내 동료 소수(5명 이하)가 LAN에서 접속해 방문 기록을 사진과 함께 공유·축적하는 것 (Plans.md Milestone 6/7)

### 비목표

- GB10을 다중 사용자용 대규모 추론 클러스터로 사용하는 것 — 위 목표의 "사내 소수 사용자"는 이 비목표와 다른 규모다. 동시 접속 5명 이하를 넘어서는 확장은 계속 비목표로 남는다.
- 초기 버전에서 자동 파인튜닝을 제공하는 것
- 모든 요청을 임의의 LLM이 자율적으로 라우팅하도록 하는 것
- 브라우저에서 Microsoft Foundry 또는 로컬 모델을 직접 호출하는 것

## 3. 핵심 설계 결정

### 3.1 기본 모델은 Microsoft Foundry

주 에이전트의 계획, 복잡한 추론, 최종 답변 생성은 Microsoft Foundry에 배포된 모델이 담당한다. 모델 품질과 안정성이 필요한 요청은 기본적으로 이 경로를 사용한다.

### 3.2 로컬 모델은 GB10의 vLLM으로 제공

로컬 모델은 GB10에서 vLLM의 OpenAI 호환 API로 제공한다. Agent Framework는 별도 Agent 또는 모델 클라이언트를 통해 이를 호출한다.

Foundry Local은 장기적으로 교체 가능한 로컬 공급자 후보로 유지하되 초기 추론 런타임으로 사용하지 않는다. 현재 평가한 Linux ARM64 배포판은 CPU 추론만 가능하고 GB10용 CUDA Execution Provider 및 GPU 모델 변형을 제공하지 않기 때문이다.

### 3.3 모델 라우팅은 서버 정책으로 결정

라우팅은 프롬프트만으로 결정하지 않는다. 백엔드의 `ModelRouter`가 데이터 민감도, 작업 종류, 가용성, 예상 비용 및 사용자 설정을 검사한다.

초기 정책은 다음과 같다.

| 조건 | 선택 모델 | 이유 |
|---|---|---|
| 일반 질의, 복잡한 추론, 최종 답변 | Microsoft Foundry | 품질 우선 |
| 민감 데이터가 포함된 요약·분류 | GB10 로컬 | 데이터 경계 유지 |
| 임베딩, 태깅, 단순 분류 | GB10 로컬 | 비용과 지연 절감 |
| 사용자가 명시적으로 로컬 모드 선택 | GB10 로컬 | 사용자 의도 준수 |
| Foundry 호출 실패 또는 한도 초과 | GB10 로컬 제한 모드 | 가용성 확보 |
| 로컬 모델이 처리할 수 없는 도구 계획 | Microsoft Foundry | 도구 호출 신뢰성 확보 |

클라우드 실패 시 로컬로 자동 전환하더라도, 로컬 모델의 기능이 부족하면 결과에 제한 모드임을 표시한다. 민감 요청은 반대로 로컬 실패 시 클라우드로 자동 전환하지 않는다.

## 4. 전체 아키텍처

```text
Browser
  │
  ▼
CopilotKit React UI
  │
  ▼
CopilotKit Runtime (Next.js)
  │  AG-UI / HTTP POST + SSE
  ▼
Agent API (Python + Agent Framework)
  ├─ AG-UI endpoint
  ├─ Session / Memory
  ├─ ModelRouter
  ├─ Main Agent
  ├─ Local Utility Agent
  ├─ Workflow / HITL
  └─ Tools / MCP
       │
       ├──────────────► Microsoft Foundry
       │                 hosted model
       │
       └──────────────► GB10 Model Server
                         vLLM OpenAI-compatible API

State and telemetry
  ├─ PostgreSQL: users, sessions, checkpoints, audit
  ├─ Redis: optional transient state/rate limiting
  └─ OpenTelemetry: traces, model route, latency, errors
```

## 5. 컴포넌트 설계

### 5.1 CopilotKit UI

담당 범위:

- 채팅 및 토큰 스트리밍
- tool call 진행 상태 표시
- 사람 승인 요청 렌더링
- 로컬/클라우드/자동 모드 선택
- 현재 응답이 사용한 모델 경로 표시
- 제한 모드 및 fallback 알림

UI는 모델 자격 증명을 보유하지 않는다. 모든 요청은 CopilotKit Runtime을 거쳐 Agent API로 전달한다.

### 5.2 CopilotKit Runtime

Agent Framework의 AG-UI endpoint를 `HttpAgent`로 등록한다. 브라우저 인증 정보를 검증하고 사용자 ID, 테넌트 ID 및 요청 상관관계 ID를 신뢰 가능한 서버 메타데이터로 변환한다.

### 5.3 Agent API

Python 기반 서비스로 시작한다.

- Agent Framework Agent 및 Workflow 호스팅
- AG-UI 이벤트를 SSE로 스트리밍
- 세션과 대화 상태 관리
- 모델 라우팅 정책 집행
- Tool 및 MCP 연결
- 승인 전 위험 작업 일시 중단
- 감사 로그 및 OpenTelemetry 이벤트 생성

### 5.4 Main Agent

Microsoft Foundry 모델을 기본으로 사용한다. 사용자 의도 파악, 계획, 도구 선택 및 최종 응답을 담당한다.

Main Agent가 로컬 모델을 직접 무제한 호출하게 하지 않는다. `local_inference` 도구 또는 Local Utility Agent를 통해서만 사용하도록 하여 입력 필터링과 감사가 가능하게 한다.

### 5.5 Local Utility Agent

GB10 로컬 모델을 사용하며 초기에는 다음과 같이 범위가 좁은 작업만 맡는다.

- 문서 요약
- 데이터 분류와 태깅
- 개인 식별 정보 탐지
- 검색 결과 reranking
- 코드나 문서의 민감 구간 추출
- 클라우드 장애 시 제한적인 질의응답

로컬 모델의 tool calling과 structured output 지원은 모델별 계약 테스트로 검증한다.

### 5.6 ModelRouter

입력:

- `requested_mode`: `auto | cloud | local`
- 데이터 분류 결과
- 작업 유형
- 필요한 기능: tool calling, JSON schema, vision 등
- Foundry 및 로컬 서버 상태
- 비용·지연 예산

출력:

- 선택한 공급자와 모델
- 선택 이유 코드
- fallback 허용 여부
- 적용할 데이터 변환 또는 마스킹 정책

예시 이유 코드는 `USER_FORCED_LOCAL`, `SENSITIVE_DATA`, `QUALITY_REQUIRED`, `CLOUD_UNAVAILABLE`로 표준화한다.

## 6. 주요 요청 흐름

### 일반 요청

1. CopilotKit이 사용자 메시지를 Agent API에 전송한다.
2. ModelRouter가 `auto` 요청을 평가한다.
3. Main Agent가 Microsoft Foundry 모델로 계획하고 도구를 호출한다.
4. Agent Framework가 실행 이벤트를 AG-UI로 스트리밍한다.
5. CopilotKit이 답변과 모델 경로를 표시한다.

### 민감 문서 요청

1. 요청 또는 선택된 데이터 소스에 `confidential` 등급이 부여된다.
2. ModelRouter가 클라우드 전송을 차단한다.
3. Local Utility Agent가 GB10에서 문서를 처리한다.
4. 정책상 허용되는 비민감 요약만 Main Agent로 전달하거나, 전체 응답을 로컬에서 완성한다.
5. 감사 로그에는 원문 대신 해시, 분류 결과 및 라우팅 이유만 기록한다.

### Foundry 장애

1. 타임아웃 또는 재시도 가능 오류를 감지한다.
2. circuit breaker가 Foundry 경로를 일시 중지한다.
3. fallback이 허용된 요청만 로컬 제한 모드로 전환한다.
4. UI에 로컬 fallback과 기능 제한을 표시한다.

## 7. 데이터 및 보안

- Microsoft Foundry 인증은 운영 환경에서 Managed Identity를 우선 사용한다.
- 개발 환경의 비밀은 `.env`가 아니라 로컬 secret store 또는 환경 변수로 주입한다.
- Foundry 자격 증명을 브라우저나 CopilotKit 클라이언트 번들에 포함하지 않는다.
- 로컬 vLLM endpoint는 기본적으로 GB10의 private network 또는 loopback에만 노출한다.
- Agent API와 vLLM 사이에 인증 또는 네트워크 접근 제어를 둔다.
- Tool은 기본 거부 정책을 적용하고 파일 쓰기, 셸 실행, 외부 변경에는 사용자 승인을 요구한다.
- 프롬프트와 응답 전문 저장은 opt-in으로 하고 민감 필드는 마스킹한다.
- 모델 라우팅 정책은 코드와 테스트로 버전 관리한다.
- 사내망 배포(Plans.md M6)에서는 LAN 접근 자체를 신뢰하지 않는다 — 최소 passcode/토큰 gate 없이 Agent API를 `0.0.0.0`으로 열어두지 않는다.
- 사용자 업로드 파일(방문 기록 사진, Plans.md M7)은 타입(jpg/png)과 크기(예: 5MB)를 서버에서 검증하고, 파일명은 서버가 생성해 경로 조작을 막는다.

## 8. 관찰 가능성

각 실행에서 다음 속성을 기록한다.

- `thread_id`, `run_id`, `user_id_hash`
- 선택한 모델 공급자와 모델 ID
- 라우팅 이유 코드
- fallback 발생 여부
- 입력·출력 토큰과 추정 비용
- 첫 토큰 및 전체 응답 지연시간
- tool call 이름, 결과 상태, 승인 여부
- 오류 유형과 재시도 횟수

민감한 프롬프트 본문과 tool 결과는 기본 trace 속성에 포함하지 않는다.

## 9. 배포 구조

### GB10

- vLLM model server
- 로컬 모델 파일과 캐시
- 선택적으로 Agent API 개발 인스턴스
- GPU 및 모델 서버 상태 exporter

### Azure 또는 일반 클라우드

- CopilotKit/Next.js 프런트엔드
- Agent Framework API
- PostgreSQL
- Microsoft Foundry 연결
- OpenTelemetry collector 및 모니터링

초기 개인 개발 단계에서는 UI, Agent API, PostgreSQL을 GB10에서 함께 실행할 수 있다. 운영 단계에서는 공개 웹 서비스와 Agent API를 클라우드로 옮기고 GB10은 private 로컬 추론 노드로 분리한다. 외부 클라우드의 Agent API가 가정이나 사무실의 GB10에 접근해야 한다면 공인 포트를 열기보다 VPN 또는 outbound tunnel을 사용한다.

### 사내망 배포 (소규모, Plans.md M6)

인터넷 공개나 Azure 이전 없이, 같은 사내 LAN 안의 동료 몇 명이 GB10 인스턴스에 직접 접속하는 중간 단계다. Agent API(`HOST=0.0.0.0`)와 웹(`NEXT_PUBLIC_AGENT_API_URL`)을 LAN IP 기준으로 맞추는 것만으로는 부족하다 — 인증이 전혀 없으므로 LAN에 있는 아무나 채팅, 도구 실행, 기록 삭제까지 할 수 있다. 최소한 공유 passcode/토큰 gate를 앞단에 두고 나서야 "배포"로 취급한다.

## 10. 저장소 구조

> 아래는 설계 시점의 목표 구조다. 실제로는 `packages/`와 `services/model-gateway`를 만들지
> 않았다 — provider 전환은 `apps/agent-api/main.py`가 Agent Framework로 직접 하고,
> 공유 타입은 `apps/web/components/types.ts`에 둔다.

```text
eat-ops/
├── apps/
│   ├── web/                 # Next.js + CopilotKit
│   └── agent-api/           # Python + Agent Framework + AG-UI
├── packages/
│   ├── contracts/           # AG-UI 상태 및 공통 스키마
│   └── ui/                  # 공유 React 컴포넌트
├── infra/
│   ├── local/               # GB10 compose와 vLLM 설정
│   └── azure/               # 클라우드 배포 정의
├── tests/
│   ├── contract/            # provider 기능 호환성
│   ├── routing/             # 민감도 및 fallback 정책
│   └── e2e/                 # CopilotKit부터 모델까지
├── docs/
│   ├── architecture.md
│   ├── threat-model.md
│   └── runbooks.md
└── README.md
```

## 11. 단계별 구현 계획

### Phase 1: 수직 슬라이스

- CopilotKit 채팅 UI
- Agent Framework 단일 Agent
- Microsoft Foundry 모델 연결
- AG-UI 스트리밍
- 간단한 read-only tool 하나

완료 조건: 브라우저에서 Foundry 응답과 tool 진행 상태가 스트리밍된다.

### Phase 2: GB10 로컬 모델

- vLLM OpenAI 호환 endpoint 구성
- Local Utility Agent 추가
- `cloud | local` 수동 선택
- 공급자 contract test 작성

완료 조건: 동일 UI에서 Foundry와 로컬 모델을 명시적으로 선택해 호출할 수 있다.

### Phase 3: 정책 기반 하이브리드

- ModelRouter 구현
- 민감도 분류와 클라우드 차단
- timeout, retry, circuit breaker 및 fallback
- 모델 경로 UI 표시

완료 조건: 테스트 케이스별로 예상 모델과 fallback 정책이 일관되게 선택된다.

### Phase 4: 운영 안전성

- PostgreSQL persistence와 checkpoint
- Managed Identity
- OpenTelemetry
- HITL 승인
- threat model 및 장애 runbook

완료 조건: 재시작 후 세션 복구, 승인 중단·재개 및 라우팅 감사가 가능하다.

## 12. 주요 위험과 대응

| 위험 | 대응 |
|---|---|
| AG-UI 또는 Agent Framework prerelease 변경 | adapter 계층과 버전 고정, contract test |
| 로컬 모델의 tool calling 불안정 | 로컬 역할 제한, structured output 검증 |
| 민감 데이터의 클라우드 유출 | 서버 정책 우선, fail-closed, egress audit |
| cloud fallback이 사용자 의도를 위반 | 민감 요청은 로컬 실패 시 오류 반환 |
| GB10 endpoint 외부 노출 | private network, 인증, VPN/outbound tunnel |
| 공급자별 응답 형식 차이 | 내부 공통 모델 응답 스키마 사용 |
| 비용과 지연 증가 | 요청별 telemetry와 routing budget |

## 13. 검증 전략

- ModelRouter는 LLM 없이 결정 가능한 순수 정책 테스트를 우선한다.
- Foundry와 vLLM에 동일한 contract suite를 실행한다.
- 민감 데이터 테스트는 클라우드 client가 호출되지 않았음을 검증한다.
- fallback 테스트는 정상, timeout, rate limit 및 연결 실패를 각각 주입한다.
- AG-UI 테스트는 텍스트, tool call, 승인, 상태 동기화 이벤트 순서를 검증한다.
- 운영 전 prompt injection과 tool 권한 경계 테스트를 수행한다.

## 14. 열린 결정 사항

- Microsoft Foundry의 최초 모델 배포 선택
- GB10 로컬 모델과 양자화 방식
- Agent API의 최종 배포 위치
- 장기 메모리 저장소와 보존 기간
- 민감도 분류를 규칙, 로컬 모델 또는 혼합 방식 중 무엇으로 구현할지
- Foundry Local이 Linux ARM64 CUDA를 지원할 경우 vLLM adapter와 병행할지 교체할지

## 15. 저장소 이름

권장 이름은 `eat-ops`이다.

- 기술 목적이 바로 드러난다.
- 특정 하드웨어 이름에 종속되지 않아 다른 에지 장비로 확장하기 쉽다.
- CopilotKit이나 vLLM을 교체해도 저장소 이름이 어색해지지 않는다.

대안:

- `gb10-foundry-agent`: GB10 실험 프로젝트임을 강조
- `foundry-edge-agent`: 클라우드와 에지 경계를 강조
- `hybrid-agent-workbench`: 여러 모델과 정책을 실험하는 성격을 강조
- `copilotkit-foundry-agent`: UI 통합 예제를 강조

