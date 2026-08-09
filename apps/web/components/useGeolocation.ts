"use client";

import { useEffect, useState } from "react";

// Geolocation 거부/실패 시 폴백 좌표: 서울 강남구 테헤란로 126 대공빌딩.
const DEFAULT_LOCATION = { lat: 37.499050198856736, lng: 127.03236697012197 };

export function useGeolocation(): { lat: number; lng: number } {
  const [coords, setCoords] = useState(DEFAULT_LOCATION);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setCoords(DEFAULT_LOCATION)
    );
  }, []);

  return coords;
}
