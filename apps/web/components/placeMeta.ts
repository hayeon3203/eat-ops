/** 선택한 장소 패널이 쓰는 순수 표시용 계산. UI와 분리해 vitest로 검증한다. */

interface Coords {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6371008.8;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** 두 좌표 사이의 대권 거리(미터).
 *
 * 카카오 검색 응답의 `distance` 필드를 쓰지 않는 이유: 그건 검색 요청에 실은
 * 좌표 기준이라, 사용자가 지도를 옮긴 뒤의 현재 위치와 다를 수 있다. */
export function haversineMeters(a: Coords, b: Coords): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/** "음식점 > 한식 > 국밥" → "한식 › 국밥".
 *
 * 첫 토막은 항상 대분류(음식점/카페 등)라 배지에서 자리만 차지한다. 토막이
 * 하나뿐일 때는 뗄 것이 없으므로 그대로 쓴다. */
export function categoryBadge(categoryName: string | undefined | null): string {
  if (!categoryName) return "";
  const parts = categoryName
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return parts.slice(1).join(" › ");
}
