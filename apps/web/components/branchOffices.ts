// 지사 5곳 — 지도 위에 고정으로 얹는 배경 정보다. 검색 결과도 추천도 아니라서
// fetch 없이 상수로 박아둔다 (카카오 주소 검색 API로 한 번만 조회한 값).
//
// 카카오에는 건물 외곽선 API가 없어 좌표는 점 하나뿐이다. 그래서 중심점 +
// 폭/길이(회전 전 기준) + 회전각으로 사각형을 근사한다. widthM/heightM/rotationDeg는
// 위성뷰를 보며 건물에 맞게 눈으로 보정하는 값 — 지금은 기본값(40m×30m×0°)이고,
// 실제 건물과 어긋나면 이 표의 숫자만 고치면 된다.
export interface BranchOffice {
  name: string; // "서울지사"
  lat: number;
  lng: number;
  widthM: number; // 동서 방향 폭(회전 전), 미터
  heightM: number; // 남북 방향 길이(회전 전), 미터
  rotationDeg: number; // 시계방향 회전, 0이면 정북 정렬
}

// 참고: 서울지사 좌표는 useGeolocation.ts의 폴백 좌표(대공빌딩)와 사실상 같은 지점이다.
// 우연이 아니므로 한쪽을 고칠 때 다른 쪽도 같이 본다.
export const BRANCH_OFFICES: BranchOffice[] = [
  { name: "서울지사", lat: 37.4990536, lng: 127.0323059, widthM: 40, heightM: 30, rotationDeg: 0 },
  { name: "광주지사", lat: 35.154555, lng: 126.849474, widthM: 40, heightM: 30, rotationDeg: 0 },
  { name: "대전지사", lat: 36.3594186, lng: 127.3789057, widthM: 40, heightM: 30, rotationDeg: 0 },
  { name: "부산지사", lat: 35.1720592, lng: 129.1284326, widthM: 40, heightM: 30, rotationDeg: 0 },
  { name: "대구지사", lat: 35.8343778, lng: 128.680734, widthM: 40, heightM: 30, rotationDeg: 0 },
];

// 위도 1도 ≈ 111,320m. 경도 1도는 위도에 따라 좁아지므로 cos(위도)를 곱한다.
// 건물 한 채 크기(수십 미터)에서는 지구 곡률을 무시하는 이 근사로 충분하다.
// export: 테스트가 이 값을 재정의하지 않고 그대로 가져다 쓰게 하기 위함 — 여기서
// 튜닝하면 테스트가 조용히 드리프트하지 않고 같이 바뀐다.
export const METERS_PER_DEG_LAT = 111_320;

/**
 * 지사 하나를 중심 + 폭/길이/회전각으로부터 사각형 네 꼭짓점(위경도)으로 편다.
 * Kakao 타입을 전혀 참조하지 않는 순수 함수 — 브라우저 없이 테스트하기 위함.
 * MapView가 반환값을 kakao.maps.LatLng로 변환해 그린다.
 *
 * 반환 순서는 좌상단→우상단→우하단→좌하단(시계방향)으로 고정한다 — 폴리곤이
 * 자기 자신과 교차하지 않게 하려면 꼭짓점이 한 방향으로만 감겨야 한다.
 */
export function rectangleCorners(office: BranchOffice): { lat: number; lng: number }[] {
  const halfW = office.widthM / 2;
  const halfH = office.heightM / 2;

  // 회전 전 로컬 좌표(x=동쪽, y=북쪽), 중심 기준 좌상단→우상단→우하단→좌하단.
  const localCorners = [
    { x: -halfW, y: halfH },
    { x: halfW, y: halfH },
    { x: halfW, y: -halfH },
    { x: -halfW, y: -halfH },
  ];

  const rad = (office.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // 시계방향 회전(x=동, y=북인 좌표계에서 각도가 커질수록 시계 방향으로 돈다):
  // 표준 반시계 회전행렬의 부호를 뒤집은 형태. x' = x·cosθ + y·sinθ, y' = -x·sinθ + y·cosθ.
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((office.lat * Math.PI) / 180);

  return localCorners.map(({ x, y }) => {
    const rx = x * cos + y * sin;
    const ry = -x * sin + y * cos;
    return {
      lat: office.lat + ry / METERS_PER_DEG_LAT,
      lng: office.lng + rx / metersPerDegLng,
    };
  });
}
