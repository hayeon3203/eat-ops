# Agent Framework 사용 정리

백엔드(`apps/agent-api`)에서 Microsoft `agent_framework`를 어떻게 쓰고 있는지,
직접 짰다면 필요했을 작업 대비 무엇을 아꼈는지 정리한 문서.

## 1. 사용 중인 구성 요소 (파일 기준)

| 구성 요소 | 위치 | 역할 |
|---|---|---|
| `Agent` (`agent_framework`) | `apps/agent-api/main.py:213`, `:217` | 모델 client + tools + instructions 묶어서 하나의 에이전트로 정의 |
| `OpenAIChatCompletionClient` | `apps/agent-api/main.py:50`, `:58` | local(vLLM) / Foundry(Azure) 두 백엔드를 같은 인터페이스로 감싼 client |
| `@tool` 데코레이터 | `apps/agent-api/tools.py:30`, `:66`, `:120`, `:165` | 평범한 Python 함수를 LLM이 호출 가능한 tool로 등록 |
| `MCPStdioTool` | `apps/agent-api/tools.py:110` | 외부 MCP 서버(`metmuseum-mcp`)를 tool 목록에 그대로 편입 |
| `state_update()` (`agent_framework.ag_ui`) | `apps/agent-api/tools.py:152`, `157`, `162` | tool 결과를 AG-UI 공유 state로 push (프론트 `useCoAgent`가 구독) |
| `add_agent_framework_fastapi_endpoint` | `apps/agent-api/main.py:214`, `:220` | Agent를 AG-UI 프로토콜 위 FastAPI 엔드포인트로 노출 |

## 2. 체감한 장점

### 2.1 tool 정의가 Python 함수 하나로 끝남
`tools.py:120` `search_restaurants` 함수를 보면 `@tool` 데코레이터 + 타입 힌트 +
docstring만 작성했다. LLM이 tool을 호출하려면 OpenAI API 쪽에 아래 같은 JSON
스펙(함수명, 파라미터 타입, 각 설명)이 있어야 하는데:

```json
{
  "name": "search_restaurants",
  "description": "Search for restaurants/places via Kakao Local...",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Free-text search, e.g. \"홍대 라멘\"..." },
      "lat": { "type": "number", "description": "User's current latitude..." }
    },
    "required": ["query"]
  }
}
```

이 JSON을 손으로 안 썼다. 대신 `@tool`이 함수에서 세 가지를 읽어 자동으로
만든다.

- **파라미터 타입/필수여부** — 시그니처의 타입 힌트(`query: str`, `lat: float | None = None`)에서. `str`은 필수, `| None = None` 붙은 건 선택.
- **파라미터별 설명** — docstring의 `Args:` 섹션 각 줄에서 (`query: Free-text search, e.g. "홍대 라멘"...`).
- **tool 전체 설명** — docstring 첫 줄(`"""Search for restaurants/places via Kakao Local..."""`)에서.

그래서 파라미터가 하나 늘거나 타입이 바뀌면 함수 시그니처만 고치면 되고,
JSON 스펙과 실제 함수가 따로 놀아서 어긋나는 문제(예: JSON은 `lat`을
optional이라 하는데 함수는 필수로 받는 식의 불일치)가 애초에 생기지 않는다
— 스펙과 구현이 같은 소스(함수 하나)에서 나오기 때문이다.

### 2.2 외부 MCP 서버를 tool처럼 그대로 꽂아 씀
Met 미술관 검색 기능(`search-museum-objects` 등)은 우리가 만든 게 아니라
`metmuseum-mcp`라는 남이 만든 MCP 서버다. MCP(Model Context Protocol)는
"별도 프로세스로 뜬 서버랑 표준 프로토콜로 통신해서 그 서버의 tool 목록을
가져다 쓰는" 규격인데, 이걸 직접 붙이려면 원래 이런 게 다 필요하다.

- `npx metmuseum-mcp` 프로세스를 자식 프로세스로 띄우고 관리 (죽으면 재시작 등)
- stdin/stdout으로 JSON-RPC 메시지 주고받는 통신 코드
- 서버가 제공하는 tool 목록 조회, 그중 우리가 쓸 tool만 필터링
- 우리 Agent의 tool 형식으로 다시 변환

`tools.py:110` `build_metmuseum_mcp()`는 이 전부를 `MCPStdioTool(command="npx", args=[...], allowed_tools=(...))`
한 번 호출로 끝낸다. `main.py:79` `TOOLS = [..., metmuseum_mcp, ...]`처럼
우리가 직접 만든 `search_restaurants` 같은 일반 tool이랑 똑같이 리스트에
섞여 들어간다 — Agent 입장에서는 "MCP tool"과 "내 Python 함수"가 구분이
안 된다. JSON-RPC 파싱 코드, 프로세스 관리 코드 둘 다 우리가 짠 게 없다.

### 2.3 모델 provider 교체가 client 객체 하나만 바꾸면 됨
`main.py:213`~`220`을 보면 로컬용 agent와 Foundry용 agent가 이렇게 정의돼
있다.

```python
local_agent   = Agent(name="local_agent",   instructions=INSTRUCTIONS, client=build_local_client(),   tools=TOOLS)
foundry_agent = Agent(name="foundry_agent", instructions=INSTRUCTIONS, client=build_foundry_client(), tools=TOOLS)
```

`instructions`, `tools` 완전히 동일한 값 그대로 재사용. 다른 건 `client`
하나뿐이고, 그 차이도 `build_local_client()`(`main.py:50`)와
`build_foundry_client()`(`main.py:58`) 안에서 `base_url`이랑 인증 방식만
다르다 — vLLM도 Azure Foundry도 결국 OpenAI 호환 API라서 둘 다
`OpenAIChatCompletionClient`로 감싸진다.

이 구조가 없었다면 "로컬 모델용 대화 로직"과 "Foundry용 대화 로직"을 따로
만들거나, 최소한 코드 곳곳에 `if provider == "foundry": ... else: ...`
분기를 흩뿌려야 했을 것이다. 여기선 그런 분기가 client 생성 함수 두 개 안에만
갇혀 있다 — [`copilotkit-ui-kit.md`](./copilotkit-ui-kit.md)에서 설명한 프론트
쪽 provider 스위칭(URL만 바뀌고 컴포넌트는 그대로)과 정확히 같은 모양이다.

### 2.4 tool 호출 루프(function calling)를 직접 안 짬
사용자가 "강남역 파스타 찾아줘"라고 치면, 실제로는 LLM과 여러 번 왕복해야
답이 나온다.

1. LLM에 "강남역 파스타 찾아줘" + 쓸 수 있는 tool 목록 전달
2. LLM이 "search_restaurants(query='강남역 파스타') 불러줘" 라고 응답 (아직 최종 답 아님)
3. 그 요청 받아서 실제 `search_restaurants` 함수 실행
4. 실행 결과를 다시 LLM에 "이게 tool 실행 결과야" 라고 넣어서 재요청
5. LLM이 이번엔 결과 보고 진짜 텍스트 답변 생성

이 5단계(요청 → tool 호출 감지 → 실행 → 결과 재주입 → 재요청, 필요하면
반복)를 만약 직접 짠다면 매 tool마다, 매 provider마다 이 루프 코드를
관리해야 한다. `main.py`에는 이 루프가 안 보인다 — `Agent(...)`로 만들고
tool 리스트만 넘기면, 저 왕복은 `Agent`가 내부에서 알아서 돈다.

### 2.5 tool 결과 → 프론트 state 갱신이 return 값 하나로 처리됨
`state_update()`가 없다면 `search_restaurants`는 그냥 문자열 답변만
리턴할 수 있었을 것이고, 프론트는 "강남역에 이런 파스타집들이 있어요:
1. OO파스타 (주소...) 2. ..." 같은 자연어 문장에서 지도에 찍을 좌표를
정규식이나 재파싱으로 뽑아내야 했을 것이다 — LLM 문장 표현이 바뀌면
파싱이 깨지는 취약한 방식.

`tools.py:162`

```python
return state_update(text="\n".join(lines), state={"current_places": places})
```

여기선 `text`(사람이 읽을 대화용 요약)와 `state`(지도가 쓸 구조화된
`lat`/`lng`/`place_name` 리스트)를 한 번에 같이 리턴한다. `state` 쪽은
AG-UI 스트림을 통해 프론트 `useCoAgent`의 `state.current_places`로 그대로
꽂힌다 (`copilotkit-ui-kit.md` 3.2절). 텍스트 답변용 채널이랑 화면 갱신용
데이터 채널이 자동으로 분리돼서 나간다 — LLM 답변 문장을 되짚어 파싱하는
코드가 필요 없다.

### 2.6 AG-UI 엔드포인트 노출이 한 줄
프론트 `CopilotKit`은 백엔드가 AG-UI라는 특정 SSE(Server-Sent Events)
이벤트 포맷(메시지가 생성되는 중이라는 이벤트, tool을 호출했다는 이벤트,
state가 바뀌었다는 이벤트 등)으로 응답해줄 거라고 기대한다. 이 포맷을
직접 구현하려면 FastAPI 엔드포인트 안에서 이벤트 종류별 JSON 구조를
정확히 맞춰 스트리밍하는 코드를 짜야 한다.

`main.py:214`

```python
add_agent_framework_fastapi_endpoint(app=app, agent=local_agent, path="/local")
```

이 한 줄이 `local_agent`를 그 이벤트 포맷으로 통째로 감싸서 `/local`
경로에 노출한다. 프론트 쪽 `HttpAgent`(`apps/web/app/api/copilotkit/[provider]/route.ts:18`)도
같은 AG-UI 표준을 구현한 라이브러리라서, 이벤트 포맷을 한 글자도 안
맞춰봐도 그냥 연결된다 — 양쪽 다 표준 규격 라이브러리를 쓰기 때문에
"우리끼리 프로토콜 협의"가 필요 없었다.

## 3. 요약

Agent Framework가 대신 해준 일 크게 여섯 가지.

1. **tool 호출 요청 스펙 자동 생성** — LLM이 tool 부를 때 쓸 입력 파라미터 스펙(이름/타입/필수여부/설명)을, 우리가 짠 함수의 시그니처+docstring에서 자동 추출. (출력 형식까지 강제하는 건 아님 — 리턴값은 우리가 원하는 대로.)
2. **외부 MCP 서버를 tool 목록에 편입** — 서버 프로세스 스폰/JSON-RPC 파싱은 `MCPStdioTool`이 처리, 우리는 `connect()`/`close()` 호출과 `TOOLS` 리스트에 넣는 것만 함.
3. **모델 provider 교체 = client 객체 하나 스왑** — `Agent`가 어느 provider인지 모르게, `OpenAIChatCompletionClient` 뒤에서 base_url/인증만 갈아끼움.
4. **tool 호출 반복 로직(function calling loop) 내장** — `tools=[...]`만 넘기면, "LLM이 정해진 JSON으로 tool 호출 요청 → 실제 실행 → 결과 다시 LLM에 전달 → LLM이 최종 답변 생성"까지 이미 구현된 루프가 돎.
5. **"텍스트 답변 채널"과 "state 채널" 분리 전송 수단 제공** — `state_update(text=..., state=...)`로 우리가 직접 나눠 리턴하면, 그걸 각각의 정해진 채널로 실어 보내주는 건 프레임워크 몫.
6. **AG-UI 이벤트 포맷이 이미 구조화됨** — tool 호출/응답을 LLM에 전달하는 메시지 형식, 백엔드-프론트 간 스트리밍 이벤트 포맷을 우리가 새로 정의할 필요 없이 표준으로 이미 맞춰져 있음(4번의 반복 로직과 5번의 채널 분리가 이 표준 위에서 오간다).

이 여섯 가지를 직접 구현했다면 tool 스키마 생성기, MCP 클라이언트, 대화-도구
반복 루프, provider별 분기 코드, 이벤트 스트리밍 포맷을 각각 만들어야 했을
부분이다. 우리가 실제로 짠 코드는 tool 함수 본문(`tools.py`)과 두 client
생성 함수(`main.py:50-75`) 정도다.
