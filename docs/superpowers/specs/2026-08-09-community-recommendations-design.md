# 사용자 추천 등록 + 카테고리 — 설계

날짜: 2026-08-09
관련: `docs/superpowers/specs/2026-08-07-map-sidebar-layout-design.md` (지도+사이드바 레이아웃, 완료), `docs/superpowers/plans/2026-08-07-map-sidebar-layout.md`

## 목적

방문 여부와 무관하게 "이 집 괜찮아요" 식으로 여러 사람이 맛집을 등록·공유하는 기능. 폼 입력과 채팅 둘 다로 등록 가능하고, 상황/음식형태/요리종류 세 축으로 분류해 지도·사이드바에서 필터링할 수 있게 한다.

이 설계는 기존 지도+사이드바 레이아웃(위 관련 문서, 완료됨) 위에 얹는 확장이다 — `MapView`/`Sidebar`/`Layout`/`RestaurantCard`/`types.ts` 등 기존 컴포넌트를 재사용·수정하고, `VisitList`/기록 흐름은 건드리지 않는다.

## 범위 밖 (별도 설계)

**건물 영역(반투명 폴리곤) 표시** — 이 설계와 무관, 나중에 별도 브레인스토밍.

## 기존 동작 변경 사항 (중요)

- **사이드바 [추천] 탭이 완전히 새 의미로 바뀐다.** 지금은 AI 채팅 검색 결과(`current_places`)를 보여주던 탭인데, 앞으로는 **사용자가 등록한 추천 목록**(DB, 영속)을 보여주는 탭이 된다.
- **AI 채팅 검색 결과는 사이드바에서 빠진다.** 채팅 UI(CopilotPopup) 안에서만 텍스트로 보여준다 — 별도 프론트 컴포넌트 불필요, 기존 채팅 UI가 이미 하는 일.
- **지도는 AI 검색 결과를 계속 표시한다** — 단, 탭과 무관하게 항상 켜져 있는 레이어로.
- 기존 `RecommendList.tsx`(Task 6)는 더 이상 쓰이지 않음 — 삭제하고 새 컴포넌트로 교체한다 (죽은 코드 남기지 않음).

## 데이터 모델

새 SQLite 테이블 `recommendations` (`apps/agent-api/db.py`, `visits`와 같은 DB 파일):

```sql
CREATE TABLE recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kakao_place_id TEXT,
    place_name TEXT NOT NULL,
    address TEXT,
    lat REAL,
    lng REAL,
    occasion TEXT,    -- 점심장소 | 회식장소 | 수고한 나에게 | NULL
    food_type TEXT,   -- 밥 | 면 | 빵 | NULL
    cuisine TEXT,     -- 한식 | 양식 | 일식 | 중식 | 베트남식 | 기타 | NULL
    note TEXT,
    created_at TEXT NOT NULL
)
```

- 세 축(`occasion`/`food_type`/`cuisine`) 다 선택 안 해도 등록 가능 (전부 NULL 허용) — 필터에서는 "미분류"로 취급.
- 축마다 값 하나만 선택(단일 선택), 세 축은 서로 독립 — 계층 아님, AND 조건으로만 결합.
- `cuisine`은 자유 텍스트 아니고 고정 목록(위 6개, "기타" 포함) — 필터 칩 UX 유지 위해.
- 작성자 식별 필드 없음 — 앱 전체가 인증 없는 공유 로그 방식(`visits`와 동일 패턴), 필요하면 `note`에 자유롭게 적음.
- `visits` 테이블은 변경 없음.

## 백엔드 (`apps/agent-api`)

### 등록 경로 — 폼과 채팅 둘 다

**1. REST — 폼 UI용, LLM 안 거침**

`POST /api/recommendations` — body: `{ place_name, occasion?, food_type?, cuisine?, note? }`. 카카오로 좌표/주소 조회(`kakao.search_places(place_name, size=1)`, `record_visit`과 동일 패턴) 후 `recommendations`에 저장, 저장된 행 반환. 장소를 카카오에서 못 찾으면 400.

**2. 채팅 tool — `tools.py`에 신규 `add_recommendation`**

```python
@tool
async def add_recommendation(
    place_name: str,
    occasion: str | None = None,
    food_type: str | None = None,
    cuisine: str | None = None,
    note: str = "",
):
    """다른 사람들과 공유할 맛집 추천 등록 (방문 여부 무관, record_visit과 별개).

    Args:
        place_name: 정확한 장소명 — 생략 금지, 대화 맥락에서 추론 금지.
        occasion: "점심장소" | "회식장소" | "수고한 나에게" 중 하나, 없으면 생략.
        food_type: "밥" | "면" | "빵" 중 하나, 없으면 생략.
        cuisine: "한식" | "양식" | "일식" | "중식" | "베트남식" | "기타" 중 하나, 없으면 생략.
        note: 추천 이유 한줄, 선택.
    """
```

`record_visit`처럼 카카오 조회 실패시 에러 문자열 반환, 성공시 확인 텍스트. `main.py`의 `TOOLS` 리스트에 추가, `INSTRUCTIONS`에 "방문 안 해도 추천 등록 가능(add_recommendation), 방문 기록은 record_visit으로 별개" 한 줄 추가 — 두 tool을 헷갈리지 않게.

**3. 조회 — REST**

`GET /api/recommendations` — 전체 목록 반환 (`GET /api/visits`와 동일 패턴, `db.list_recommendations()`). 카테고리 필터는 프론트에서 클라이언트 필터링(방문기록 검색과 동일 정책 — 서버 API 콜 없이 즉시 필터).

### `db.py` 추가

`init_db()`에 `recommendations` 테이블 생성 추가. `insert_recommendation(...)`, `list_recommendations() -> list[dict]` 함수 추가 — `insert_visit`/`list_visits`와 동일 패턴.

## 프론트 (`apps/web`)

### 타입 (`components/types.ts`)

```typescript
export type Occasion = "점심장소" | "회식장소" | "수고한 나에게";
export type FoodType = "밥" | "면" | "빵";
export type Cuisine = "한식" | "양식" | "일식" | "중식" | "베트남식" | "기타";

export interface Recommendation {
  id: number;
  kakao_place_id: string;
  place_name: string;
  address: string;
  lat: number;
  lng: number;
  occasion: Occasion | null;
  food_type: FoodType | null;
  cuisine: Cuisine | null;
  note: string;
  created_at: string;
}
```

### 컴포넌트 변경

- **삭제**: `components/RecommendList.tsx` (더 이상 안 씀)
- **신규 `components/RecommendationForm.tsx`**: 장소명 입력 + 세 축 선택(드롭다운 또는 칩, 각 "선택 안 함" 옵션 포함) + 이유 입력 + 등록 버튼 → `POST /api/recommendations` 호출, 성공시 목록 갱신 콜백 호출.
- **신규 `components/RecommendationList.tsx`**: `GET /api/recommendations` 조회(마운트시 1회, `VisitList` 패턴과 동일) + 카테고리 필터 칩(축별 단일 선택 + "전체", 기본값 전체) + `RestaurantCard`로 렌더링(카테고리 뱃지 추가 표시) + `onResultsChange(items, activeColorAxis)` 콜백으로 필터링된 목록과 "마지막으로 건드린 축"을 상위에 전달(지도 마커 색 결정용). 축 필터 클릭할 때마다 그 축을 `activeColorAxis`로 기록, 전체 필터 해제시 `null`.
- **`RestaurantCard.tsx` 확장**: `occasion`/`food_type`/`cuisine` optional prop 추가, 있는 것만 뱃지로 표시. 뱃지 배경색은 축별 대표색(아래 색상 시스템).
- **`Sidebar.tsx` 수정**: `activeTab === "recommend"`일 때 `RecommendationForm` + `RecommendationList` 렌더링(기존 `RecommendList` 자리 교체). `onRecommendResultsChange(items, activeColorAxis)` prop 추가(기존 `onRecordResultsChange`와 나란히).
- **`Layout.tsx` 수정**: `recommendResults`/`recommendColorAxis` state 추가(`recordResults`와 나란히), `MapView`에 새 prop으로 전달.
- **`MapView.tsx` 수정**: 마커 레이어를 탭 종속 단일 세트에서 **AI 레이어(항상 켜짐) + 탭별 레이어**로 분리.

### 지도 마커 레이어링

세 가지 레이어, 동시에 최대 2개 표시(AI는 항상 + 탭 하나):

| 레이어 | 데이터 소스 | 노출 조건 | 마커 색 |
|---|---|---|---|
| AI 검색 | `current_places` (useCoAgent) | 항상 | 고정색 A (카테고리 축 없는 데이터라 축 색 적용 불가) |
| 추천 | `recommendResults` (필터링된 recommendations) | `activeTab === "recommend"` | **카테고리 축 색** (아래) |
| 기록 | `recordResults` (필터링된 visits) | `activeTab === "record"` | 고정색 C (카테고리 축 없는 데이터라 축 색 적용 불가) |

`kakao.maps.Marker`의 `image` 옵션으로 레이어별 다른 마커 아이콘(단색 핀 SVG data URI 정도로 충분, 이미지 파일 추가 안 함) 지정. 기존 마커 clear/rebuild 로직(레이어 2세트로 확장, 각각 별도 ref 배열로 관리)은 최종 리뷰에서 고친 `useMemo`/`ResizeObserver` 패턴 그대로 유지.

기본 탭이 `"recommend"`이므로 사이트를 열면 AI 레이어(빈 상태) + 추천 레이어(전체 카테고리, 기본색)가 바로 보인다 — 요구사항("사이트 열면 보임") 별도 처리 불필요.

### 색상 시스템 — 카테고리 축 색이 칩/뱃지와 추천 레이어 마커 둘 다에 쓰임

세 축 각각 대표색 하나:
- 상황(occasion) 축 — 노랑 계열
- 음식형태(food_type) 축 — 초록 계열
- 요리종류(cuisine) 축 — 파랑 계열

같은 축 안의 값들(예: 한식/양식/일식)은 전부 같은 색(세부 shade 구분 안 함, 축 단위로만 색 구분) — `globals.css`에 `--tag-occasion`, `--tag-food-type`, `--tag-cuisine` 세 변수로 정의.

- **칩/뱃지 UI**: `RestaurantCard`/필터 칩이 해당 축 색 그대로 참조 — 여기는 문제 없음(뱃지 여러 개 동시 표시 가능하니까).
- **추천 레이어 마커**: 마커는 한 핀에 색 하나뿐이라 3축을 동시에 못 담음 — **현재 필터 중인 축의 색**을 씀. `RecommendationList`가 필터 상태에서 "마지막으로 건드린 축"(`activeColorAxis: "occasion" | "food_type" | "cuisine" | null`)을 추적해 `onResultsChange`와 함께 상위로 전달(`Layout` → `MapView`). 여러 축을 동시에 필터해도(AND 결합) 마커 색은 마지막 건드린 축 하나만 반영. 필터가 아무것도 없으면("전체") 축 색 대신 카테고리-무관 기본색 하나.

정확한 hex 값은 Daol 톤(§`2026-08-07` 설계의 `--color-primary` 계열)과 안 겹치게 구현 단계에서 확정.

## 에러/엣지 케이스

- `add_recommendation`/`POST /api/recommendations`에서 카카오가 장소를 못 찾으면: tool은 에러 문자열 반환("장소를 찾을 수 없습니다"), REST는 400.
- 카카오 일일 쿼터 초과: 기존 `KakaoQuotaExceededError` 패턴 그대로 재사용 (tool은 `state_update`로 `kakao_quota_exceeded`, REST는 429) — `search_restaurants`/`/api/search`와 동일 처리.
- 세 축 다 미선택 등록: 허용, 리스트/지도엔 "미분류"로 뜸, 필터 칩엔 안 걸림("전체"에서만 보임).
- `RecommendationForm`에서 장소명 미입력: 클라이언트단에서 등록 버튼 비활성화(필수 필드).

## 테스트

- `db.py`: `insert_recommendation`/`list_recommendations` — 기존 `test_build_client.py` 스타일 `demo()` 자기점검으로 최소 1개.
- `POST /api/recommendations`, `add_recommendation` tool: `kakao.search_places` 몽키패치해서 성공/장소못찾음 케이스 — `test_search_endpoint.py` 패턴 재사용.
- 프론트: 테스트 하네스 없음(기존 컨벤션), `npx tsc --noEmit` + 수동 브라우저 검증.

## 완료 조건

1. 사이드바 [추천] 탭 열면 등록 폼 + 등록된 추천 리스트(카테고리 뱃지 포함) 보임, AI 검색결과는 안 보임
2. 폼으로 "OO 식당, 점심장소/면/일식으로 등록" → 리스트+지도에 바로 반영
3. 채팅으로 "OO 라멘집 점심 먹기 좋아, 면/일식으로 추천 등록해줘" → 등록되고 [추천] 탭 전환시(또는 재조회시) 리스트에 뜸
4. 카테고리 필터 칩으로 축별 필터링 시 리스트+지도 마커 둘 다 갱신
5. 채팅에 "강남역 파스타 추천해줘" → 지도에 AI 레이어 마커(추천 레이어와 별개 색)로 뜨고, 사이드바 [추천] 탭 리스트는 안 바뀜
6. 사이트 처음 열면(기본 탭=추천) 등록된 추천 마커들이 카테고리 구분 없이 지도에 다 보임
