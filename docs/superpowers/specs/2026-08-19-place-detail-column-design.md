# 장소 상세 컬럼 + 탭 제거 — 설계

날짜: 2026-08-19
선행: `2026-08-19-selected-place-panel-design.md` (패널 내용은 그 문서가 정의함)

## 배경

앞선 작업에서 "선택한 장소" 패널을 왼쪽 사이드바 안에 확장했다. 실제로 써 본 결과 원하는 형태가 아니었다.
사이드바 안에 얹으니 추천 목록과 상세가 같은 좁은 열을 두고 다투고, 패널이 길어지면 목록이 아래로 밀린다.

원하는 형태는 **사이드바 바로 오른쪽에 상세 바가 하나 더 생기는 것**이다. 선택했을 때만 나타나고, 그만큼 지도가 좁아진다.

동시에 [내 리뷰] 탭을 없앤다. 로그인이 없어서 "내" 것을 관리한다는 전제 자체가 성립하지 않는다
(`db.py`의 `delete_visit` 주석이 같은 이야기를 한다 — `author_id`는 localStorage UUID이고 위조 가능하다).

## 레이아웃

`.layout-root`는 grid가 아니라 flex다 (`globals.css:48-52`). 세 번째 컬럼은 flex 아이템 하나를 더하면 된다.

```
[사이드바 380px] [상세 340px] [지도 flex:1]
     추천 목록     선택 시에만      나머지
```

- 상세 컬럼은 `selectedPlace`가 있을 때만 렌더한다. 없으면 지도가 원래 폭을 되찾는다.
- 모바일(`data-mobile-view`)에서는 리스트 뷰 위에 전체 폭으로 덮는다.

## 컴포넌트

**`components/PlacePanel.tsx` (신규).** 지금 `Sidebar.tsx` 안에 있는 `sidebar-selected-place` 블록 —
헤더/닫기, `RestaurantCard`, 배지·전화·거리 메타줄, 카카오맵 링크, `ReviewSection` — 을 통째로 옮긴다.
`useGeolocation` 호출과 `badge`/`distance` 계산도 함께 옮긴다. 패널 내용의 규칙(값 없으면 줄 숨김,
거리 `resolved`일 때만, `rating_avg: null`/`review_count: 0`으로 넘기고 `defaultOpen`)은 선행 스펙 그대로다.

`Layout`이 세 번째 컬럼에서 `<PlacePanel place={selectedPlace} onClose={...} />`를 렌더한다.
`Sidebar`는 `selectedPlace` / `onClearSelectedPlace` prop을 잃는다.

## 탭 제거

| 대상 | 처리 |
|---|---|
| `components/VisitList.tsx` | 파일 삭제 |
| `types.ts`의 `SidebarTab` | 삭제 |
| `Sidebar` | 탭 JSX, `VisitList` import, `activeTab` / `onTabChange` / `onRecordResultsChange` prop 제거. `RecommendationList`만 렌더 |
| `Layout` | `activeTab` / `recordResults` 상태 제거. `focusPaydayRecommendations`의 `setActiveTab("recommend")` 한 줄 제거 |
| `MapView` | `activeTab` / `recordMarkers` prop 제거. `tabMarkers` 메모는 `recommendMarkers`만 매핑. `RECORD_MARKER_COLOR` 삭제. `tabColor` → `recommendColor`, `tabMarkerObjsRef` → `recommendMarkerObjsRef`로 개명 ("tab"이 더는 아무것도 가리키지 않는다) |

지도 마커는 두 겹으로 줄어든다: AI 검색 + 추천. 방문/리뷰 겹은 사라진다.

**데이터와 API는 그대로 둔다.** `visits` 테이블, `GET/POST /api/visits`, `record_visit` 툴 모두 유지 —
패널의 `ReviewSection`이 계속 읽고 쓴다. 없어지는 것은 그 데이터를 지도 위 별도 레이어로 보여주던 UI뿐이다.

## 목록 카드 클릭

`RecommendationList`에 `onSelect?: (place: SelectedPlace) => void`를 더한다. `Recommendation`은
`SelectedPlace`가 필요한 필드를 모두 갖고 있다 (`place_name`, `address`, `category`, `phone`,
`kakao_place_id`, `lat`, `lng`).

핸들러는 `RestaurantCard`를 감싼 영역에만 건다. `recommendation-item` 전체에 걸면 삭제 버튼과
`ReviewSection`의 별점·삭제 버튼 클릭까지 삼킨다.

카드 안의 `ReviewSection`은 그대로 둔다. 같은 장소의 리뷰가 목록과 패널 양쪽에 보일 수 있지만,
목록에서 바로 쓰던 흐름을 없애지 않는 쪽을 택했다.

## 하지 않는 것

- `visits` 데이터·API·챗 툴 제거 (UI 레이어만 걷어낸다)
- 목록 카드에서 `ReviewSection` 제거
- 패널 내용 변경 — 선행 스펙이 정의한 그대로 옮기기만 한다
- payday picks 기능 변경 — `setActiveTab` 한 줄 외에는 건드리지 않는다

## 검증

새로운 순수 로직이 없다. 기존 vitest 21개가 그대로 통과해야 하고(`placeMeta`, `nickname`,
`paydayPick` — 셋 다 이 변경과 무관), `npx tsc --noEmit`과 `npm run build`가 깨끗해야 한다.

`tsc`가 이 변경의 주 안전망이다: prop을 지우는 변경이라 빠뜨린 호출부는 전부 타입 에러로 드러난다.

수동 확인:

1. 마커 클릭 → 사이드바 오른쪽에 상세 바가 생기고 지도가 그만큼 좁아진다
2. 추천 목록의 카드 클릭 → 같은 상세 바가 뜬다
3. 카드의 삭제 버튼과 별점 버튼을 눌러도 상세 바가 뜨지 않는다
4. 닫기(✕) → 상세 바가 사라지고 지도가 원래 폭으로 돌아온다
5. 탭이 사라졌고 사이드바에 추천 목록만 보인다
6. 월급날 팝업의 "지도에서 보기"가 여전히 3곳으로 좁히고 아바타 마커로 바꾼다
