// 지사 5곳 — 지도 위에 고정으로 얹는 배경 정보다. 검색 결과도 추천도 아니라서
// fetch 없이 상수로 박아둔다 (카카오 주소 검색 API로 한 번만 조회한 값).
//
// 카카오에는 건물 외곽선 API가 없어 좌표는 점 하나뿐이다. 그래서 중심점 + 한 변 길이 +
// 회전각으로 근사한다. 가로세로를 따로 두지 않는 이유: 로고 원본(daol-icon.png)이
// 141×141 정사각이라 두 값이 다르면 이미지가 찌그러진다. sizeM 하나로 두면 비율이
// 구조적으로 보장된다. sizeM/rotationDeg는 위성뷰를 보며 눈으로 보정하는 값이다.
export interface BranchOffice {
  name: string; // "서울지사"
  lat: number;
  lng: number;
  sizeM: number; // 한 변 길이(회전 전), 미터. 로고가 정사각이라 가로=세로.
  rotationDeg: number; // 시계방향 회전, 0이면 정북 정렬
}

// 참고: 서울지사 좌표는 useGeolocation.ts의 폴백 좌표(대공빌딩)와 사실상 같은 지점이다.
// 우연이 아니므로 한쪽을 고칠 때 다른 쪽도 같이 본다.
export const BRANCH_OFFICES: BranchOffice[] = [
  { name: "서울지사", lat: 37.4990536, lng: 127.0323059, sizeM: 60, rotationDeg: 0 },
  { name: "광주지사", lat: 35.154555, lng: 126.849474, sizeM: 60, rotationDeg: 0 },
  { name: "대전지사", lat: 36.3594186, lng: 127.3789057, sizeM: 60, rotationDeg: 0 },
  { name: "부산지사", lat: 35.1720592, lng: 129.1284326, sizeM: 60, rotationDeg: 0 },
  { name: "대구지사", lat: 35.8343778, lng: 128.680734, sizeM: 60, rotationDeg: 0 },
];

// 위도 1도 ≈ 111,320m. 경도 1도는 위도에 따라 좁아지므로 cos(위도)를 곱한다.
// 건물 한 채 크기(수십 미터)에서는 지구 곡률을 무시하는 이 근사로 충분하다.
// export: 테스트가 이 값을 재정의하지 않고 그대로 가져다 쓰게 하기 위함 — 여기서
// 튜닝하면 테스트가 조용히 드리프트하지 않고 같이 바뀐다.
export const METERS_PER_DEG_LAT = 111_320;

/**
 * 위도 lat 지점에서 동쪽으로 eastM, 북쪽으로 northM 떨어진 지점의 위경도 차이를 구한다.
 * Kakao 타입을 전혀 참조하지 않는 순수 함수 — 브라우저 없이 테스트하기 위함.
 * MapView가 지사 중심과 이 함수로 구한 점을 각각 projection에 넣어 픽셀 크기를 계산한다.
 */
export function metersToLatLngDelta(
  lat: number,
  eastM: number,
  northM: number
): { dLat: number; dLng: number } {
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  return {
    dLat: northM / METERS_PER_DEG_LAT,
    dLng: eastM / metersPerDegLng,
  };
}
