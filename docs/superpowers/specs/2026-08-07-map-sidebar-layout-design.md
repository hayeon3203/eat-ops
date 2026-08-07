# apps/web 지도+사이드바 레이아웃 — 설계

날짜: 2026-08-07
관련: IMPLEMENTATION_PLAN.md §8 트랙 D (백엔드 완료, 프론트 작업 순서 4-6 남음)

## 목적

채팅으로 맛집 추천을 받고, 방문 기록을 남기고, 둘 다 지도 마커로 확인하는 `apps/web` 메인 화면을 지도+사이드바 레이아웃으로 재구성한다. PC/모바일 둘 다 대응. Rezervi 참고 UI(`Restaurant_Map_UI.png`)의 레이아웃을 가져오되 포인트 컬러는 Daol 브랜드 톤으로 교체하고, 검색은 사이드바 독립 검색창 + 우하단 LLM 아바타 두 경로로 나눈다.

이 설계는 IMPLEMENTATION_PLAN.md §8이 이미 확정한 항목(카카오맵 JS SDK, SQLite 방문기록, `useCoAgent` 공유 state, Geolocation 초기 중심)을 그대로 따르되, 아래 두 지점에서 원래 계획을 구체화/변경한다:
- 원래 계획: "사이드바 = CopilotChat 전체". 변경: 사이드바는 리스트+검색 UI, 채팅은 우하단 `CopilotPopup` 아바타로 분리.
- 추가: 사이드바 [기록] 탭에 독립 검색창(DB 우선, 라이브 카카오 검색은 명시적 트리거), "내 위치 기준 추천"을 위한 실제 반경 검색.

## 색상

Daol 로고(`/home/admin/DaolVision/DaolVision_white.png`, `/home/admin/daol-fascope/assets/daol_icon.png`)에서 추출한 톤을 레퍼런스 이미지의 핑크 포인트 컬러 자리에 그대로 대입한다.

- Primary (포인트/마커/활성 탭/버튼/아바타): `#1a6fb0` (Daol blue)
- Primary hover/active: `#14588c`
- Dark accent (로고 차콜, 텍스트/아이콘 보조): `#33363b`
- 배경/카드/보더는 레퍼런스 그대로 유지: 화이트 배경, `#e5e7eb` 계열 보더, 그레이 톤 텍스트

CSS 커스텀 프로퍼티로 `apps/web/app/globals.css`에 정의 (`--color-primary`, `--color-primary-active`, `--color-ink`), 모든 신규 컴포넌트가 하드코딩 대신 이 변수를 참조한다.

## 레이아웃

### PC
- 좌측 사이드바 (고정폭, 약 360px) + 우측 지도 (flex-1), 레퍼런스 이미지와 동일한 좌우 분할
- 사이드바 상단: 탭 `[추천 | 기록]`
- 우하단: `AskAvatar` (플로팅), 사이드바/지도 위에 겹쳐서 고정 위치 (`position: fixed`)

### 모바일
- 상단 세그먼트 탭 `[지도 | 리스트]` — 화면 전체를 지도 또는 리스트(사이드바 콘텐츠)로 전환. 드래그 시트 없음(구현 단순화).
- `AskAvatar`는 두 뷰 모두에서 우하단 고정 노출
- 브레이크포인트: `max-width: 768px`에서 모바일 레이아웃으로 전환 (CSS 미디어쿼리, JS 분기 없음)

## 컴포넌트 구성 (`apps/web/app/`)

- `page.tsx` — 기존 provider select(local/foundry) + `CopilotKit` 유지. 전체화면 `CopilotChat` 제거, `<Layout>` 하위에 지도+사이드바+아바타 배치
- `components/Layout.tsx` — PC/모바일 반응형 껍데기 (미디어쿼리 기반 사이드바/지도 배치, 모바일 탭 상태)
- `components/MapView.tsx` — 카카오맵 JS SDK 로드(`next/script`, `NEXT_PUBLIC_KAKAO_JS_KEY`), 활성 탭에 따라 `current_places`(추천) 또는 방문기록(기록) 마커 렌더링, Geolocation으로 초기 중심 설정 (실패시 서울시청 좌표 폴백)
- `components/Sidebar.tsx` — 탭 전환 `[추천|기록]`
- `components/RecommendList.tsx` — `useCoAgent`의 `current_places` state를 리스트로 표시 (read-only, 검색창 없음)
- `components/VisitList.tsx` — `/api/visits` 조회 + 로컬 텍스트 필터(이름/주소) + "카카오에서 더 찾기" 버튼(명시적 클릭시에만 1회 라이브 검색). 라이브 검색 결과는 화면에 임시로만 표시(리스트/지도 마커) — DB 저장 없음. 기록에 남기려면 계획 §8 정책대로 채팅으로 "OO 방문했어, 기록해줘"라고 말해야 함
- `components/RestaurantCard.tsx` — 리스트 아이템 공통 (이름/주소/카테고리, 기록 항목은 평점 추가 표시)
- `components/AskAvatar.tsx` — `CopilotPopup`(`@copilotkit/react-ui`) 래퍼, Daol 톤 `icons`/`labels`, 우하단 고정

## 데이터 흐름

- **추천**: 사용자가 아바타 채팅에 "강남역 파스타 추천해줘" → 에이전트가 `search_restaurants` 호출 → `state_update`로 `current_places` 갱신 → `useCoAgent` state 구독하는 `MapView`/`RecommendList`가 동시 반영 (기존 백엔드 그대로, 변경 없음)
- **내 위치 기준 추천**: 사용자가 "내 주변 맛집 추천해줘" → 프론트가 mount 시 획득한 Geolocation 좌표를 `useCopilotReadable`로 에이전트 컨텍스트에 노출해둔 상태 → 에이전트가 그 좌표를 `search_restaurants(query, lat, lng, radius_m)` 인자로 채워 호출 (백엔드 변경, 아래 참조)
- **기록 검색**: 사이드바 [기록] 탭 검색창 입력 → 기본은 `/api/visits` 결과를 클라이언트에서 필터링 (API 콜 없음) → "카카오에서 더 찾기" 클릭시에만 `kakao.search_places` 라이브 호출 (신규 REST 엔드포인트, 아래 참조)
- **방문 기록 추가**: 기존과 동일, 채팅으로만 (`record_visit`), 지도 마커 클릭 등 UI 조작 없음 (계획 §8 그대로)

## 백엔드 변경 (`apps/agent-api`)

1. **`kakao.py`**: `search_places`에 optional `lat: float | None`, `lng: float | None`, `radius_m: int | None` 인자 추가. 값이 있으면 Kakao API 요청에 `y`(=lat), `x`(=lng), `radius`(미터, Kakao 제한 최대 20000) 파라미터를 얹어 반경 검색. 기존 키워드 전용 호출은 그대로 하위 호환.
2. **`tools.py`**: `search_restaurants`에 optional `lat`, `lng`, `radius_m` 인자 추가, `kakao.search_places`로 전달. 독스트링에 "내 주변/내 위치" 요청시 컨텍스트에서 좌표를 찾아 채우라는 지침 추가.
3. **`main.py`**: `INSTRUCTIONS`에 한 줄 추가 — 사용자가 위치 기준 표현("내 주변", "내 위치")을 쓰면 프론트가 노출한 좌표 컨텍스트를 사용해 `search_restaurants`의 lat/lng/radius_m을 채우라는 지침.
4. **신규 엔드포인트** `GET /api/search?q=...`: `kakao.search_places`를 직접 호출해 반환 (사이드바 "카카오에서 더 찾기" 버튼 전용, 에이전트/채팅 경로와 무관). `kakao.KakaoQuotaExceededError` 발생시 429 반환.

## 프론트 신규 env var

- `NEXT_PUBLIC_KAKAO_JS_KEY` — 카카오맵 JS SDK 로드용 (기존 서버측 `KAKAO_REST_API_KEY`와 별개 키, 계획서 §8에서 "둘 다 지금 발급"이라고 이미 명시됨)

## 에러/엣지 케이스

- Geolocation 거부/실패: 서울시청 좌표(37.5665, 126.9780)로 폴백, "내 위치 기준" 요청이 오면 폴백 좌표를 그대로 사용 (별도 에러 메시지 없음 — 계획 §8과 동일한 폴백 정책)
- 카카오 일일 쿼터 초과: 기존 `kakao_quota_exceeded` state(에이전트 경로)와 신규 `/api/search` 429(사이드바 버튼 경로) 둘 다 처리 — 사이드바는 버튼 비활성화 + "오늘 카카오 검색 한도 초과" 문구
- `/api/visits` 결과 없음: 리스트 빈 상태 문구, 지도는 초기 중심만 표시
- 라디우스 검색인데 지오로케이션 실패: 서울시청 좌표 기준으로 반경 검색 수행 (사용자에게 별도 알림 없음, 폴백 정책과 일관)

## 테스트

- `kakao.search_places`에 lat/lng/radius 넘겼을 때 요청 파라미터에 x/y/radius가 올바르게 포함되는지 단위 테스트 (`tests/unit`)
- `/api/search` 엔드포인트: 정상 응답, 쿼터 초과시 429 확인
- 나머지는 수동 확인 (완료 조건 아래 참조) — 기존 프로젝트에 프론트 테스트 하네스 없음, 새로 안 만듦

## 완료 조건

1. PC: 좌측 사이드바(추천/기록 탭) + 우측 지도, 포인트 컬러 Daol blue
2. 모바일(≤768px): 상단 [지도|리스트] 탭 전환, 아바타 우하단 고정
3. 채팅으로 "강남역 파스타 추천해줘" → [추천] 탭 리스트 + 지도 마커 갱신
4. 채팅으로 "내 주변 맛집 추천해줘" → 실제 Geolocation 좌표 기준 반경 검색 결과
5. [기록] 탭 검색창에 타이핑 → DB 방문기록 필터링 (API 콜 없음), "카카오에서 더 찾기" 클릭시에만 라이브 검색 1회
6. "OO 식당 방문했어, 기록해줘 평점 4" → SQLite 저장 → [기록] 탭에 반영
