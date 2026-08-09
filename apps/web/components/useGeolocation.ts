"use client";

import { useEffect, useState } from "react";

// 계획 §8: Geolocation 거부/실패 시 서울시청 좌표로 폴백.
const SEOUL_CITY_HALL = { lat: 37.5665, lng: 126.978 };

export function useGeolocation(): { lat: number; lng: number } {
  const [coords, setCoords] = useState(SEOUL_CITY_HALL);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setCoords(SEOUL_CITY_HALL)
    );
  }, []);

  return coords;
}
