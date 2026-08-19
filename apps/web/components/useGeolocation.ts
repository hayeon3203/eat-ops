"use client";

import { useEffect, useState } from "react";

// Geolocation 거부/실패 시 폴백 좌표: 서울 강남구 테헤란로 126 대공빌딩.
const DEFAULT_LOCATION = { lat: 37.499050198856736, lng: 127.03236697012197 };

// resolved: 브라우저가 실제 위치를 내려줬는지. 폴백 좌표(지도 중심 등)는 이 값이
// false여도 그대로 써도 되지만, "412m" 같은 라벨은 진짜 위치가 아니면 찍으면 안 된다.
export function useGeolocation(): { lat: number; lng: number; resolved: boolean } {
  const [coords, setCoords] = useState({ ...DEFAULT_LOCATION, resolved: false });

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, resolved: true }),
      () => setCoords({ ...DEFAULT_LOCATION, resolved: false })
    );
  }, []);

  return coords;
}
