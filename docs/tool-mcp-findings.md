# 통합 단계 구현 기록 — Tool + MCP

IMPLEMENTATION_PLAN.md §5 완료 조건 충족: 웹 검색·시스템 상태 조회·MCP(미술관 검색) 세 가지가
채팅에서 각각 동작한다. (`tests/contract/test_tools.py` 통과, `/foundry` AG-UI 스트림으로
검색→상세→요약 시나리오 확인)

## 계획 문서와 다른 점

- **커스텀 MCP client adapter/registry를 만들지 않음.** `agent-framework-core`가
  `MCPStdioTool`/`MCPStreamableHTTPTool`을 이미 제공하고, `allowed_tools`(허용 tool 목록)와
  `env`(환경 변수 allowlist) 인자를 그대로 갖고 있어 Plans.md Milestone 3가 요구하는 보안 경계를
  프레임워크 기능만으로 충족한다. `env`를 지정하지 않으면 mcp SDK가 `HOME/LOGNAME/PATH/SHELL/TERM/USER`
  6개만 상속한 subprocess를 띄운다(`get_default_environment()`) — 호스트 환경 변수 전체 상속 안 됨.
- **HITL 승인 흐름 미구현.** IMPLEMENTATION_PLAN.md §7에서 이미 보류 결정됨: 현재 tool 3종(웹 검색,
  시스템 상태, Met Museum) 모두 read-only라 당장 불필요. Plans.md Milestone 3의 `ApprovalRequired`
  mock 데모는 실제 쓰기 도구가 추가될 때 `agent_framework.ToolApprovalMiddleware` +
  `ToolApprovalRule`(프레임워크 내장, `approval_mode="always_require"`)로 붙이면 됨 — 별도 인터페이스
  설계 불필요.

## 구성

- `apps/agent-api/tools.py`
  - `web_search`: SearXNG(`:8081`) `/search?format=json` 호출. query/count만 받고 count는 1–5로 clamp,
    timeout 5초, 결과 title/url/content(최대 400자)만 추출. "Untrusted..." 프리픽스로 신뢰 불가 데이터임을
    명시.
  - `system_status`: `psutil`(CPU%/메모리%) + `nvidia-smi --query-gpu=...`(name/util/mem/temp) 조합.
    allowlist 필드만 반환, GB10은 unified memory라 `memory.used/total`이 `[N/A]`로 나옴(정상).
  - `build_metmuseum_mcp()`: `npx -y metmuseum-mcp@1.0.0` stdio 서버, `allowed_tools`를
    `search-museum-objects`/`get-museum-object`/`list-departments` 3개로 제한(`open-met-explorer`는
    UI 앱을 여는 tool이라 텍스트 챗 데모에서는 제외).
- `apps/agent-api/main.py`
  - FastAPI `lifespan`에서 metmuseum MCP를 앱 시작 시 1회 `connect()`, 종료 시 `close()` — 요청마다
    subprocess를 새로 띄우지 않음.
  - `local_agent`/`foundry_agent` 둘 다 동일한 `TOOLS = [web_search, system_status, metmuseum_mcp]`를
    받음. EXAONE-3.0은 `tool_choice=auto`에서 자발적으로 tool을 호출하지 않는다는 게 이미
    `test_local_provider.py`로 확인돼 있어(트랙 A 계약 테스트), local 경로에 tool을 붙여도 실제로는
    Foundry(GPT-5-mini) 쪽에서만 자연스럽게 동작함 — 별도 분기 없이 동일 tools 리스트를 재사용.

## 검증

```bash
# 필요 서비스: SearXNG(:8081, 이미 떠 있음), nvidia-smi, node/npx
apps/agent-api/.venv/bin/python tests/contract/test_tools.py

# 실제 AG-UI 스트림으로 확인 (에이전트 서버 기동 후)
curl -N -X POST http://127.0.0.1:8787/foundry -H "Content-Type: application/json" -d '{
  "threadId":"t1","runId":"r1",
  "messages":[{"id":"m1","role":"user","content":"Search the Met Museum for Van Gogh paintings and summarize one."}],
  "tools":[],"context":[],"state":{}
}'
```

`TOOL_CALL_START` → `TOOL_CALL_RESULT` 이벤트가 AG-UI 스트림에 그대로 실려 오므로, CopilotKit
`CopilotChat`(`apps/web/app/page.tsx`)이 기본 제공하는 tool-call 진행 상태 UI로 별도 렌더링 코드 없이
표시된다.

## 버그: 멀티턴에서 다른 tool을 연속 호출하면 400

**증상.** CopilotChat에서 tool A를 쓰는 질문 후, 같은 스레드에서 tool B를 쓰는 질문을 연속으로
보내면 브라우저에 `ChatClientException` / `RUN_ERROR`가 뜬다. 서버 로그:

```
openai.BadRequestError: Error code: 400 - An assistant message with 'tool_calls' must be
followed by tool messages responding to each 'tool_call_id'. ...
```

**원인.** 브라우저가 아니라 클라이언트 라이브러리(`@ag-ui/client` 0.0.57 / `@copilotkit/runtime`
1.66.2, 둘 다 prerelease) 쪽 히스토리 재조립 버그. AG-UI 스트림에서 `TOOL_CALL_START/RESULT`가
그 tool을 호출한 assistant 메시지의 `TEXT_MESSAGE_START`~`TEXT_MESSAGE_END` 사이에 끼어 오는데
(이게 AG-UI 프로토콜 자체의 정상 이벤트 순서), 클라이언트가 이 인터리빙을 잘못 누적해서 다음 턴에
보내는 `messages` 배열에서 `toolCalls`를 가진 assistant 메시지가 **자기 tool 응답보다 뒤로,
심지어 그 다음 assistant 텍스트 메시지보다도 뒤로** 밀려 나온다:

```
실제로 온 순서: [user, tool(응답), assistant(text), assistant(toolCalls), user2]
있어야 할 순서: [user, assistant(toolCalls), tool(응답), assistant(text), user2]
```

OpenAI Chat Completions API는 배열 순서를 그대로 강제하므로 정의자가 늦게 오면 400을 낸다.
프론트 라이브러리 내부 버그라 이 저장소에서 직접 고칠 수 없음 — 얇은 adapter로 흡수(구현 원칙 6).

**고침.** `apps/agent-api/main.py`의 `_fix_tool_call_message_order()` + `_FixToolCallOrderMiddleware`
(순수 ASGI 미들웨어)가 `/local`·`/foundry`로 들어오는 요청 body를 파싱해서, `toolCalls`를 가진
assistant 메시지를 그 tool 응답 바로 앞으로 hoist한 뒤 downstream으로 넘긴다.

주의: 처음엔 `@app.middleware("http")`(`BaseHTTPMiddleware`)로 구현했는데, 이 방식은 SSE 응답의
disconnect 감지를 깨뜨린다(`RuntimeError: Unexpected message received: http.request` /
`INCOMPLETE_STREAM`) — starlette의 알려진 한계. `receive`만 감싸는 순수 ASGI 미들웨어로 바꿔서
해결. 그 다음엔 body를 재생(replay)하는 콜백이 첫 호출 이후에도 fake 메시지를 즉시 리턴해서
disconnect polling이 busy-loop를 돌며 이벤트 루프를 먹통으로 만드는 버그가 있었음 — 두 번째
호출부터는 실제 upstream `receive()`로 위임하도록 고쳐서 해결.

재현/회귀 테스트: `tests/unit/test_build_client.py`의 `check_fix_tool_call_message_order`.

## 남은 것 (범위 밖, 기록만)

- Plans.md Milestone 3의 나머지 보안 시나리오(MCP 서버 중단/잘못된 schema 처리, prompt injection성
  tool 결과 처리)는 아직 자동화 테스트 없음.
- ModelRouter 기반 자동 라우팅(Milestone 4)이 붙기 전까지는 tool 호출이 자연스럽게 동작하는 경로가
  Foundry뿐이라는 점을 사용자가 수동으로 인지해야 함.
