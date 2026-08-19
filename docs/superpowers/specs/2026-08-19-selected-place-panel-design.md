# 선택한 장소 패널 확장 — 설계

날짜: 2026-08-19

## 배경

지도 마커를 클릭하면 왼쪽 사이드바에 "선택한 장소" 블록이 뜬다
(`apps/web/components/Sidebar.tsx:122-140`). 지금 보여주는 것은 상호명·주소·카테고리와
카카오맵 외부 링크뿐이다. 사용자는 이 패널을 더 쓸모 있게 만들고 싶어 한다.

### 카카오 Local API가 실제로 주는 것

`GET /v2/local/search/keyword.json`의 document 필드 — 이게 전부다.

| 필드 | 내용 | 현재 |
|---|---|---|
| `id` | 장소 ID | 사용 중 (`kakao_place_id`) |
| `place_name` | 상호명 | 사용 중 |
| `road_address_name` / `address_name` | 도로명 / 지번 | 도로명 우선, 지번 버림 (`kakao.py:84`) |
| `category_name` | `음식점 > 한식 > 국밥` | 사용 중 |
| `category_group_code` / `_name` | `FD6 음식점` 등 | 버림 |
| `phone` | 전화번호 | 버림 |
| `x` / `y` | 경도 / 위도 | 사용 중 |
| `place_url` | 카카오맵 상세 링크 | `Place`엔 있고 `SelectedPlace`엔 없음 |
| `distance` | 검색 좌표 기준 미터 | 버림 |

**평점·리뷰·사진·영업시간·메뉴는 API에 없다.** `place.map.kakao.com` 웹페이지에만 있고
공개 API가 없다. place_id로 단건 조회하는 엔드포인트도 없어서(키워드 검색뿐) 마커 클릭
시점에 카카오로 되물어 정보를 보강하는 경로 자체가 불가능하다.

### 제약: 마커 3종의 출처가 다르다

- **AI 검색 마커** (`state.current_places`) — 카카오 응답 그대로. 원본 필드를 다 갖고 있다.
- **추천 마커 / 기록 마커** — DB 출신. `visits`/`recommendations` 테이블(`db.py:33-62`)에
  `phone`도 `category`도 없어서 지금은 채울 방법이 없다.

`lat`/`lng`는 세 마커 모두 이미 갖고 있는데 `SelectedPlace`로 넘길 때 버려진다
(`MapView.tsx:131-136, 154`). 리뷰와 거리 계산이 이 두 값만으로 열린다.

## 결정

패널은 **왼쪽 사이드바에 그대로 두고 내용만 확장**한다. 오른쪽 열을 새로 만들거나 지도
오버레이로 띄우는 안은 채택하지 않는다 — grid·모바일 CSS를 다 손봐야 하는데 얻는 게 배치뿐이다.

패널이 담을 것: 카테고리 배지, 전화번호(tap-to-call), 내 위치에서의 거리, 카카오맵 링크,
그리고 별점·리뷰(`ReviewSection` 재사용).

## 1. 패널 UI

`sidebar-selected-place` 블록을 확장한다. 내용이 길어지므로 `max-height: 45vh;
overflow-y: auto`를 준다 — 없으면 아래의 탭과 목록이 화면 밖으로 밀린다.

```
선택한 장소                    ✕
─────────────────────────────
국밥집 상호명
[한식 › 국밥]                  ← 카테고리 배지
서울 강남구 테헤란로 12
📞 02-123-4567   · 340m        ← tel: 링크 / 거리
카카오맵에서 보기 ↗
─────────────────────────────
★★★★☆ 4.2 (3)                 ← ReviewSection
  [리뷰 목록 / 작성 폼]
```

배지·전화·거리는 값이 없으면 그 줄을 통째로 숨긴다. 리뷰는 패널에서 기본 펼침 상태로 연다.

카테고리 배지는 `category_name`의 `>` 경로에서 **첫 토막을 무조건 떼고**(대분류 — "음식점",
"카페" 등) 나머지를 `›`로 이어 붙인다. 토막이 하나뿐이면 떼지 않고 그대로 쓴다.

## 2. 데이터 배관

| 파일 | 변경 |
|---|---|
| `apps/agent-api/kakao.py:80-89` | `phone=doc.get("phone", "")` 추가 |
| `apps/agent-api/db.py:65-72` ALTER 루프 | `visits.phone`, `visits.category`, `recommendations.phone`, `recommendations.category` 4줄 추가 |
| `apps/agent-api/db.py:79`, `:146` | `insert_visit` / `insert_recommendation`에 `phone`·`category` 키워드 인자 (기본값 `None`) + INSERT 컬럼 |
| `apps/agent-api/main.py:300` | `VisitIn`에 `phone`·`category` 옵션 필드 추가 후 `insert_visit`로 전달 |
| `apps/agent-api/main.py:390` | `POST /api/recommendations`는 서버가 직접 카카오를 조회하므로(`main.py:384`) 조회 결과의 phone·category를 그대로 넘김 — 프론트 payload 변경 불필요 |
| `apps/agent-api/tools.py:196`, `:283` | `record_visit`·`add_recommendation` 둘 다 `KakaoPlace`를 들고 있으므로 insert에 phone·category 같이 넘김 |

`GET /api/visits`·`GET /api/recommendations`는 손댈 것이 없다 — `db.list_*`가 `SELECT *`라
(`db.py:126`, `:191`) 새 컬럼이 자동으로 응답에 실린다.
| `components/types.ts` | `SelectedPlace`에 `lat`, `lng`, `phone?` 추가 (`category?`는 이미 있음) / `Visit`·`Recommendation`·`Place`에 `phone?`, `category?` |
| `components/MapView.tsx:131-136, 154` | 마커 payload에 `lat`, `lng`, `phone`, `category` 실음 |
| `components/ReviewSection.tsx:24-26` | prop 타입을 `Recommendation`에서 실제로 쓰는 7필드만 가진 좁은 타입으로 완화 (`kakao_place_id`, `place_name`, `address`, `lat`, `lng`, `rating_avg`, `review_count`). 기존 호출부(`RecommendationList.tsx:172`)는 그대로 통과 |
| `components/Sidebar.tsx` | 패널 렌더 + `useGeolocation()` 호출 + 거리 표시 |
| `components/placeMeta.ts` (신규) | `haversineMeters(a, b)`, `categoryBadge(categoryName)` |
| `app/globals.css` | 패널 스크롤·배지·메타줄 스타일 |

### 리뷰 요약값의 출처

`SelectedPlace`에는 `rating_avg`/`review_count`가 없다. `ReviewSection`에
`rating_avg: null, review_count: 0`으로 넘긴다 — `ReviewSection.tsx:38-39`가 이미
"펼쳐서 fetch한 값이 있으면 그게 진짜 값, 없으면 prop"으로 처리하므로, 패널이 기본 펼침이면
첫 렌더 직후 실제 값으로 대체된다.

### 거리

`useGeolocation`은 훅이고 `MapView`·`AskAvatar`가 각자 호출하고 있다. `Sidebar`도 그냥
호출한다. 카카오의 `distance` 필드는 쓰지 않는다 — 그건 검색 시점 좌표 기준이라 사용자의
현재 위치와 다를 수 있다.

### 기존 DB 행 백필

**하지 않는다.** place_id 단건 조회 API가 없어서 상호명+주소로 키워드 재검색을 해야 하는데,
동명 점포 오매칭이 나고 quota를 태운다. 기존 행의 phone·category는 영구히 빈칸으로 두고,
패널은 그 줄을 숨긴다. 새로 저장되는 행부터 채워진다.

## 3. 검증

비자명한 로직은 `haversineMeters`와 카테고리 배지 파싱 둘뿐이다. 둘 다
`components/placeMeta.ts`에 두고, 기존 `nickname.test.ts` / `paydayPick.test.ts` 패턴대로
vitest 파일 `components/placeMeta.test.ts` 하나에 assert를 둔다:

- 서울시청(37.5665, 126.9780) ↔ 강남역(37.4979, 127.0276) ≈ 8.8km — 8500~9100m 범위 assert
  (구현 변형에 안 깨지도록 정확값 대신 범위)
- 같은 좌표 두 개 → 0
- `"음식점 > 한식 > 국밥"` → `"한식 › 국밥"`, 한 토막 입력은 그대로 통과

백엔드 쪽은 pytest가 아니라 기존 `tests/unit/*.py`의 수동 `demo()` 자기점검 패턴을 따른다
(`check_*()`가 bool 반환, `demo()`가 전부 assert).

수동 확인: AI 검색 마커 클릭(전화·배지 뜸) / 기록 마커 클릭(빈칸 줄 숨김) / 리뷰 작성 후
목록 갱신.

## 하지 않는 것

- 오른쪽 사이드바 또는 3컬럼 레이아웃
- 지번 주소 병기 (`kakao.py`가 도로명 우선으로 하나만 담는 구조를 건드릴 값어치 없음)
- 카카오맵 평점·사진·영업시간 스크래핑 — API 없음, 외부 링크로 대체
- 기존 DB 행 백필
