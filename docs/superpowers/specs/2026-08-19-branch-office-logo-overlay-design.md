# 지사 표시를 사각형에서 로고 오버레이로 교체 — 설계

날짜: 2026-08-19
선행: `2026-08-19-branch-office-polygons-design.md` (좌표와 미터 치수는 그 문서가 정의함)

## 배경

지사 5곳을 반투명 사각형으로 그렸다. 실제로 보니 사각형은 "여기 뭔가 있다"는 것 외에 아무것도
말해주지 않는다. 대신 회사 로고를 얹는다.

**로고는 사각형과 똑같이 미터 단위로 동작한다** — 줌인하면 커지고 줌아웃하면 작아진다.
화면 고정 크기(마커 방식)가 아니다. 지사가 차지하는 실제 면적 감각을 유지하는 것이 목적이다.

## 카카오 API의 제약

카카오 지도에는 이미지로 채우는 지상 오버레이(ground overlay) API가 없다. `Polygon`은 색만
채우고, `Marker`와 `CustomOverlay`는 화면 고정 크기다.

그래서 `CustomOverlay` 안에 `<img>`를 넣고, **현재 줌에서의 미터/픽셀 비율을 구해 img의 px
크기를 직접 계산**한다. 줌이 바뀔 때마다 다시 계산한다.

비율은 지도의 projection에서 얻는다: 지사 중심과 거기서 동쪽으로 `widthM`만큼 떨어진 지점을
각각 컨테이너 좌표로 변환하면, 두 점의 x 차이가 곧 그 폭의 픽셀 값이다. 남북도 같은 방식이다.

회전은 CSS `transform: rotate()`로 준다. `rotationDeg`는 시계방향이고 CSS의 양수 회전도
시계방향이라 부호를 바꿀 필요가 없다.

## 파일

| 파일 | 책임 |
|---|---|
| `public/daol-icon.png` | 이미 복사됨 (141×141 RGBA, 2.4KB) |
| `components/branchOffices.ts` | `rectangleCorners` 삭제. 상수 테이블과 `METERS_PER_DEG_LAT` 유지. `metersToLatLngDelta()` 신규 |
| `components/branchOffices.test.ts` | `rectangleCorners` 테스트 4개 삭제, `metersToLatLngDelta` 테스트로 교체 |
| `components/MapView.tsx` | 폴리곤 effect를 로고 오버레이 effect로 교체 |
| `app/globals.css` | `.branch-office-logo` 스타일 |

### `branchOffices.ts`

`BranchOffice` 인터페이스와 `BRANCH_OFFICES` 테이블은 그대로다 — `widthM` / `heightM` /
`rotationDeg` 모두 계속 쓰인다. 다섯 숫자를 눈으로 보정한다는 성격도 그대로다.

`rectangleCorners`는 삭제한다. 꼭짓점 네 개가 더는 필요 없다.

```ts
export function metersToLatLngDelta(
  lat: number,
  eastM: number,
  northM: number
): { dLat: number; dLng: number };
```

위도 1도 ≈ 111,320m, 경도 1도 ≈ 111,320m × cos(위도). 코사인은 라디안으로 계산한다.
이 함수가 이 변경에서 유일한 순수 로직이고, 브라우저 없이 검증할 수 있는 유일한 부분이다.

### `MapView.tsx`

폴리곤과 그 라벨을 만들던 effect를 지운다. 대신 지사마다 `CustomOverlay` 하나를 만들어
`<img src="/daol-icon.png" class="branch-office-logo">`를 담는다.

크기 재계산은 effect 안의 함수 하나로 두고, 최초 1회와 지도의 `zoom_changed` 때 호출한다.
`zoom_changed` 리스너는 effect의 cleanup에서 `kakao.maps.event.removeListener`로 반드시
해제한다 — 기존 마커 effect들이 `setMap(null)`로 정리하는 것과 같은 규율이다.

지사명 라벨은 유지한다. 로고만으로는 어느 지사인지 알 수 없다.

**오버레이는 클릭할 수 없다.** 로고와 라벨 모두 `pointer-events: none`이라 지도 드래그와
맛집 마커 클릭을 가로채지 않는다. 이건 선행 스펙에서 이미 확인한 규칙이다.

### 스타일

로고 불투명도 50%. 크기는 JS가 px로 직접 지정하므로 CSS에서는 정하지 않는다.

## 검증

`metersToLatLngDelta`가 유일한 비자명 로직이다. `branchOffices.test.ts`에:

- 적도(위도 0)에서 동쪽 111,320m → `dLng`가 1도에 가깝고 `dLat`은 0
- 북쪽 111,320m → `dLat`이 1도에 가깝고 `dLng`은 0
- 위도가 높을수록 같은 동쪽 거리의 `dLng`이 커진다 (위도 0 < 37 < 60에서 단조 증가) —
  cos이 라디안으로 들어갔는지, 경도 축에만 적용됐는지를 이 단조성이 잡는다
- 0m 입력 → 두 델타 모두 0

기존 vitest가 그대로 통과해야 하고, `tsc --noEmit`과 `npm run build`가 깨끗해야 한다.

수동 확인:

1. 지사 5곳에 로고가 반투명하게 보이고 지사명 라벨이 붙는다
2. **줌인하면 로고가 커지고 줌아웃하면 작아진다** — 이게 이 변경의 핵심이다
3. 로고 위를 드래그해도 지도가 정상적으로 움직인다
4. 맛집 마커 클릭이 여전히 상세 컬럼을 연다
5. 줌을 여러 번 바꿔도 로고가 어긋나거나 잔상이 남지 않는다

## 하지 않는 것

- 화면 고정 크기 아이콘 (명시적으로 거부된 선택지)
- 로고 클릭·호버 상호작용
- 줌 레벨별 표시/숨김
- 지사 데이터를 DB나 API로 옮기기
