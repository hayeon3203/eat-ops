# CopilotKit UI Kit 사용 정리

프론트엔드(`apps/web`)에서 CopilotKit을 어떻게 쓰고 있는지, 그리고 직접 코드로
짰다면 필요했을 작업 대비 무엇을 아꼈는지 정리한 문서.

## 1. 사용 중인 구성 요소 (파일 기준)

| 구성 요소 | 위치 | 역할 |
|---|---|---|
| `CopilotKit` (`@copilotkit/react-core`) | `apps/web/app/page.tsx:24` | 앱 전체를 감싸는 provider. `runtimeUrl` prop으로 로컬/Foundry 백엔드를 스위칭 |
| `CopilotRuntime` / `HttpAgent` (`@copilotkit/runtime`, `@ag-ui/client`) | `apps/web/app/api/copilotkit/[provider]/route.ts` | Next.js API 라우트가 AG-UI 프로토콜로 `agent-api`를 브릿지 |
| `useCoAgent` (`@copilotkit/react-core`) | `apps/web/components/MapView.tsx:22`, `apps/web/components/RecommendList.tsx:8` | 백엔드 tool 결과(`current_places`)를 프론트 state로 실시간 동기화 |
| `useCopilotReadable` (`@copilotkit/react-core`) | `apps/web/components/AskAvatar.tsx:10` | 브라우저 위치를 에이전트 컨텍스트에 노출 |
| `CopilotPopup` (`@copilotkit/react-ui`) | `apps/web/components/AskAvatar.tsx:18` | 우하단 채팅 버블 UI. CSS 변수(`--copilot-kit-primary-color`)로 톤만 오버라이드 |

## 2. 데이터 흐름

```
page.tsx (provider select: local | foundry)
   └─ CopilotKit runtimeUrl="/api/copilotkit/{provider}"
        └─ route.ts: HttpAgent(agent-api/{provider}) 를 agents.default 로 등록
             └─ agent-api 가 tool(search_restaurants) 실행 → current_places 채움
                  ├─ MapView.tsx: useCoAgent({ name: "default" }) 로 구독 → 지도 마커 렌더
                  └─ RecommendList.tsx: useCoAgent({ name: "default" }) 로 구독 → 카드 리스트 렌더
        AskAvatar.tsx
          ├─ useCopilotReadable({ value: { lat, lng } }) → 에이전트가 "내 주변" 요청 처리 가능
          └─ CopilotPopup → 채팅 UI 렌더
```

`route.ts`에서 등록한 이름표 `agents: { default: ... }`와, `MapView.tsx` /
`RecommendList.tsx`의 `useCoAgent({ name: "default" })`가 문자열로 매칭되는 지점이
핵심 연결고리다. 두 컴포넌트가 같은 이름으로 구독하기 때문에 지도와 리스트가
항상 같은 데이터를 본다.

## 3. 체감한 장점

### 3.1 채팅 UI를 직접 짜지 않아도 됨
메시지 리스트, 스트리밍 렌더링, 로딩 상태 표시가 `CopilotPopup` 하나에 내장되어
있음. `AskAvatar.tsx`에서 한 일은 `labels`(title/initial/placeholder) 텍스트와
CSS 변수 오버라이드뿐이고, 채팅 버블 렌더링 로직은 전혀 작성하지 않았다.

### 3.2 백엔드 tool 결과 → 프론트 반영을 직접 배선하지 않아도 됨
`search_restaurants` tool이 끝나면 그 결과가 AG-UI state로 스트리밍되어
`useCoAgent`의 `state.current_places`에 자동 반영된다. 웹소켓 연결 관리나
폴링 로직을 직접 작성할 필요 없이, 훅이 결과를 받으면 리렌더까지 알아서
처리한다.

### 3.3 프론트 → 에이전트 컨텍스트 주입도 프롬프트 문자열 조작 없이 처리
`useCopilotReadable`에 `{ lat, lng }`와 설명 텍스트만 등록하면, 시스템
프롬프트를 직접 이어붙이는 코드 없이도 LLM이 "내 주변" 같은 요청에서 이
좌표를 tool 인자로 사용한다.

### 3.4 UI 코드가 모델 provider와 분리됨
provider 선택 로직은 `page.tsx`의 `runtimeUrl` 문자열과 `route.ts`의
`HttpAgent` URL, 이 두 곳에만 존재한다. `MapView.tsx`, `RecommendList.tsx`,
`AskAvatar.tsx` 어디에도 "GPT-5-mini"나 "EXAONE" 같은 모델 이름이 등장하지
않는다 — provider를 바꿔도 UI 컴포넌트 코드는 건드릴 필요가 없다.

## 4. 요약

CopilotKit이 대신 해준 일 세 가지.

1. **채팅창** (`CopilotPopup`) — 말풍선, 타이핑 표시, 스크롤까지 완성품을 그대로 가져다 씀.
2. **실시간 화면 갱신** (`useCoAgent`) — 에이전트가 맛집 찾으면 새로고침 없이 지도·리스트가 저절로 바뀜.
3. **위치 자동 전달** (`useCopilotReadable`) — "내 주변" 이라고만 말해도 GPS 좌표가 에이전트한테 알아서 전달됨.

이 세 가지를 직접 만들었다면 채팅 UI, 실시간 동기화, 프롬프트에 위치
끼워넣는 로직을 각각 따로 개발해야 했을 것이다. 우리가 실제로 짠 코드는
"어느 모델 쓸지 고르는 부분"(`route.ts`)과 "색깔 입히는 부분"(CSS)뿐이다.
