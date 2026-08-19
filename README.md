# Foundry Hybrid Agent (Daol Fusion)

CopilotKit + Microsoft Agent Framework 기반 채팅 UI에서 Microsoft Foundry(클라우드)와 GB10 로컬 vLLM 모델을 골라 쓰면서, 채팅으로 맛집을 검색·기록·추천하고 지도에서 확인하는 개인 데모 프로젝트.

## 아키텍처

`apps/web`(Next.js + CopilotKit)이 `apps/agent-api`(FastAPI + Microsoft Agent Framework)를 AG-UI(SSE) 프로토콜로 호출한다. `agent-api`는 provider별로 `/local`, `/foundry` 두 엔드포인트를 노출하고, 프런트는 사용자가 고른 provider에 맞는 엔드포인트로 붙는다(자동 라우팅 없음, 수동 선택만). 도구(web 검색, 시스템 상태, Met Museum MCP, 카카오 장소 검색/기록/추천)는 두 provider가 공유한다. 설계 배경과 마일스톤 전체 계획은 [`DESIGN.md`](./DESIGN.md), [`Plans.md`](./Plans.md)에 있다 — 여기서는 중복 서술하지 않는다.

## 실행 방법

사전 조건: SearXNG가 `8081` 포트에 떠 있어야 `web_search` 도구가 동작한다(Docker 등으로 별도 기동, 이 레포 범위 밖).

### apps/agent-api (FastAPI)

```bash
cd apps/agent-api
python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python main.py   # 기본 127.0.0.1:8787
```

필요한 환경변수(`.env` 또는 셸에 설정, 실제 값은 커밋 금지):

| 변수 | 설명 | 기본값 |
|---|---|---|
| `LOCAL_VLLM_BASE_URL` | GB10 vLLM OpenAI 호환 endpoint | `http://127.0.0.1:8000/v1` |
| `LOCAL_VLLM_MODEL` | 로컬 모델 ID | `exaone-3.0-7.8b` |
| `FOUNDRY_PROJECT_ENDPOINT` | Foundry 프로젝트 endpoint. 없으면 `/foundry` 비활성화 | (없음) |
| `FOUNDRY_MODEL` | Foundry 배포 모델 이름 | `gpt-5-mini-1` |
| `SEARXNG_BASE_URL` | SearXNG 인스턴스 | `http://127.0.0.1:8081` |
| `KAKAO_REST_API_KEY` | 카카오 로컬 검색용 REST 키 | (없음, 없으면 장소 검색 실패) |
| `VISITS_DB_PATH` | SQLite 파일 경로 | `apps/agent-api/data/visits.db` |
| `HOST` / `PORT` | 서버 바인딩 | `127.0.0.1` / `8787` |
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` | 사내망 배포용 HTTP Basic Auth (Plans.md M6). `BASIC_AUTH_PASS` 미설정 시 게이트 없음(로컬 개발 영향 없음) | `daol` / (없음) |

Foundry는 API 키가 아니라 Entra ID 인증(`azure.identity`)을 쓰므로, `FOUNDRY_PROJECT_ENDPOINT`를 설정했다면 `az login` 등으로 해당 환경에 인증된 Azure CLI 세션이 있어야 한다.

### apps/web (Next.js)

```bash
cd apps/web
npm install
npm run dev   # 기본 127.0.0.1:3000
```

필요한 환경변수(`apps/web/.env.local`):

| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_AGENT_API_URL` | 브라우저에서 agent-api를 호출할 URL (기본 `http://127.0.0.1:8787`) |
| `AGENT_API_URL` | Next.js 서버(라우트 핸들러)에서 agent-api를 호출할 URL — CopilotKit runtime 프록시용 |
| `NEXT_PUBLIC_KAKAO_JS_KEY` | 카카오맵 JavaScript SDK 키 (지도 렌더링용, REST 키와 별개) |
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` | `middleware.ts`의 HTTP Basic Auth 게이트 (Plans.md M6) — agent-api와 같은 값으로 맞춘다 | (없음) |

## 사내망(LAN) 배포

같은 사내 네트워크의 동료가 접속하게 하려면 (Plans.md Milestone 6):

1. `apps/agent-api`를 `HOST=0.0.0.0`으로 띄운다.
2. `apps/web/.env.local`의 `NEXT_PUBLIC_AGENT_API_URL`을 `http://127.0.0.1:8787`이 아니라 실제 접근 가능한 LAN IP(예: `http://172.16.4.228:8787`)로 바꾼다 — 브라우저가 원격 기기에서 열리면 `127.0.0.1`은 접속자 자신의 컴퓨터를 가리켜서 아무것도 못 찾는다. `AGENT_API_URL`(서버용, `NEXT_PUBLIC_` 없는 쪽)은 Next.js 서버와 agent-api가 같은 GB10 위에서 돈다면 `127.0.0.1`로 그대로 둔다.
3. `apps/web`과 `apps/agent-api` 양쪽에 같은 값으로 `BASIC_AUTH_USER`/`BASIC_AUTH_PASS`를 설정한다 — 인증 없이 LAN에 열어두지 않는다. 미설정 시 게이트가 꺼져 있어 위 두 항목만 바꾸면 인증 없는 상태로 노출되니 주의.
4. `.env.local`을 바꿨다면 `next dev`를 재시작한다 (env 파일은 부팅 시에만 읽는다).

## 현재 구현된 기능

- Foundry / 로컬(vLLM+EXAONE) provider 수동 전환 채팅 (스트리밍, AG-UI)
- 도구: 웹 검색(SearXNG), 시스템/GPU 상태 조회, Met Museum 소장품 검색(MCP)
- 카카오 로컬 기반 맛집 검색 → 지도 마커 표시
- 방문 기록 등록([기록] 탭, 평점+메모, 지도 마커)
- 맛집 추천 등록/삭제 — 채팅 또는 사이드바 폼, 상황/음식형태/요리종류 3축 카테고리, 필터+지도 마커 색상 연동

## 알려진 제한사항

- 멀티테넌시 없음 — 방문기록·추천은 전체 공유(SQLite, 사용자 구분 없음). `BASIC_AUTH_PASS` 설정 시 공유 passcode 게이트는 있지만(Plans.md M6) 사용자별 세션 분리는 아님
- `auto` 모드/`ModelRouter` 자동 라우팅 없음 — provider는 항상 수동 선택
- 민감도 판정, cloud 차단 정책 미구현 — 어떤 요청이든 사용자가 고른 provider로 그대로 감
- 대화 세션은 프로세스 메모리에만 존재, 재시작하면 사라짐(전문 로깅도 안 함)
- 위험 도구 승인(HITL) 흐름은 진행 중

## 장애 대응

**`web_search` 호출이 실패/타임아웃한다**
SearXNG(`8081`)가 안 떠 있거나 `SEARXNG_BASE_URL`이 잘못됐을 가능성이 높다. `curl http://127.0.0.1:8081/search?q=test&format=json`으로 직접 확인.

**장소 검색/등록/기록이 전부 실패한다**
`KAKAO_REST_API_KEY` 미설정이거나 카카오 로컬 API 일일 쿼터 초과(응답 429, 프런트에 "카카오맵 일일 검색 한도를 초과했습니다" 메시지로 노출됨). 다음날 재시도하거나 키 확인.

**Foundry provider(`/foundry`)가 응답 안 하거나 401/403**
`FOUNDRY_PROJECT_ENDPOINT`가 비어 있으면 애초에 `/foundry` 라우트 자체가 등록 안 됨(agent-api 시작 로그에 `FOUNDRY_PROJECT_ENDPOINT not set` 출력). 값이 있다면 Entra ID 인증(`az login`) 세션 만료 여부 확인.

**로컬 provider(`/local`)가 응답 안 함**
GB10의 vLLM 서버가 `LOCAL_VLLM_BASE_URL`에 떠 있는지 확인(`curl $LOCAL_VLLM_BASE_URL/models`).

**서비스 종료**
`agent-api`/`web` 둘 다 포그라운드 프로세스면 Ctrl+C. 백그라운드로 띄웠다면 `main.py`/`next dev`가 바인딩한 포트(`8787`/`3000`) 기준으로 `lsof -i :PORT` 후 kill.
