"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCoAgent } from "@copilotkit/react-core";
import { useGeolocation } from "./useGeolocation";
import type { AgentState, SidebarTab } from "./types";

interface MapMarker {
  lat: number;
  lng: number;
  label: string;
}

interface MapViewProps {
  activeTab: SidebarTab;
  recordMarkers: { lat: number; lng: number; place_name: string }[];
}

export function MapView({ activeTab, recordMarkers }: MapViewProps) {
  const center = useGeolocation();
  const { state } = useCoAgent<AgentState>({ name: "default", initialState: {} });
  const containerRef = useRef<HTMLDivElement>(null);
  const markerObjsRef = useRef<any[]>([]);
  const [sdkReady, setSdkReady] = useState(false);
  const [map, setMap] = useState<any>(null);

  const markers: MapMarker[] = useMemo(
    () =>
      activeTab === "recommend"
        ? (state.current_places ?? []).map((p) => ({ lat: p.lat, lng: p.lng, label: p.place_name }))
        : recordMarkers.map((p) => ({ lat: p.lat, lng: p.lng, label: p.place_name })),
    [activeTab, state.current_places, recordMarkers]
  );

  // 지도 생성은 SDK 준비 후 한 번만 — 재생성하면 사용자가 옮긴 중심/줌이 날아남.
  useEffect(() => {
    if (!sdkReady || !containerRef.current || map) return;
    window.kakao.maps.load(() => {
      const instance = new window.kakao.maps.Map(containerRef.current, {
        center: new window.kakao.maps.LatLng(center.lat, center.lng),
        level: 5,
      });
      setMap(instance);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkReady]);

  // Geolocation이 폴백값에서 실제 좌표로 바뀌면 지도 중심만 옮김 (재생성 아님).
  useEffect(() => {
    if (!map) return;
    map.setCenter(new window.kakao.maps.LatLng(center.lat, center.lng));
  }, [map, center]);

  useEffect(() => {
    if (!map) return;
    markerObjsRef.current.forEach((m) => m.setMap(null));
    markerObjsRef.current = markers.map(
      (place) =>
        new window.kakao.maps.Marker({
          position: new window.kakao.maps.LatLng(place.lat, place.lng),
          map,
          title: place.label,
        })
    );
  }, [map, markers]);

  // 모바일에서 .layout-map이 display:none → flex로 전환될 때 컨테이너가 0×0에서
  // 실제 크기로 바뀌는데, Kakao는 window resize에만 자동 relayout하므로 CSS 토글은
  // 놓친다. ResizeObserver로 컨테이너 크기 변화를 직접 감지해 relayout을 호출한다.
  useEffect(() => {
    if (!map || !containerRef.current) return;
    const observer = new ResizeObserver(() => {
      map.relayout();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [map]);

  return (
    <>
      <Script
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_JS_KEY}&autoload=false`}
        strategy="afterInteractive"
        onReady={() => setSdkReady(true)}
      />
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </>
  );
}
