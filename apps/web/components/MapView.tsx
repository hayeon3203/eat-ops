"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
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
  const mapRef = useRef<any>(null);
  const markerObjsRef = useRef<any[]>([]);
  const [sdkReady, setSdkReady] = useState(false);

  const markers: MapMarker[] =
    activeTab === "recommend"
      ? (state.current_places ?? []).map((p) => ({ lat: p.lat, lng: p.lng, label: p.place_name }))
      : recordMarkers.map((p) => ({ lat: p.lat, lng: p.lng, label: p.place_name }));

  // 지도 생성은 SDK 준비 후 한 번만 — 재생성하면 사용자가 옮긴 중심/줌이 날아남.
  useEffect(() => {
    if (!sdkReady || !containerRef.current || mapRef.current) return;
    window.kakao.maps.load(() => {
      mapRef.current = new window.kakao.maps.Map(containerRef.current, {
        center: new window.kakao.maps.LatLng(center.lat, center.lng),
        level: 5,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkReady]);

  // Geolocation이 폴백값에서 실제 좌표로 바뀌면 지도 중심만 옮김 (재생성 아님).
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setCenter(new window.kakao.maps.LatLng(center.lat, center.lng));
  }, [center]);

  useEffect(() => {
    if (!mapRef.current) return;
    markerObjsRef.current.forEach((m) => m.setMap(null));
    markerObjsRef.current = markers.map(
      (place) =>
        new window.kakao.maps.Marker({
          position: new window.kakao.maps.LatLng(place.lat, place.lng),
          map: mapRef.current,
          title: place.label,
        })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]);

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
