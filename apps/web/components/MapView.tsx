"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCoAgent } from "@copilotkit/react-core";
import { useGeolocation } from "./useGeolocation";
import type { AgentState, CategoryAxis, SidebarTab } from "./types";

interface MapMarker {
  lat: number;
  lng: number;
  label: string;
}

interface MapViewProps {
  activeTab: SidebarTab;
  recordMarkers: { lat: number; lng: number; place_name: string }[];
  recommendMarkers: { lat: number; lng: number; place_name: string }[];
  recommendColorAxis: CategoryAxis | null;
}

const AI_MARKER_COLOR = "#e0435c";
const RECORD_MARKER_COLOR = "#7c5cbf";
const RECOMMEND_DEFAULT_COLOR = "#1a6fb0";
const AXIS_MARKER_COLOR: Record<CategoryAxis, string> = {
  occasion: "#d97706",
  food_type: "#16a34a",
  cuisine: "#2563eb",
};

function buildMarkerImage(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42"><path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 26 16 26s16-14 16-26C32 7.163 24.837 0 16 0z" fill="${color}" stroke="white" stroke-width="2"/><circle cx="16" cy="16" r="6" fill="white"/></svg>`;
  return new window.kakao.maps.MarkerImage(
    `data:image/svg+xml,${encodeURIComponent(svg)}`,
    new window.kakao.maps.Size(32, 42)
  );
}

export function MapView({ activeTab, recordMarkers, recommendMarkers, recommendColorAxis }: MapViewProps) {
  const center = useGeolocation();
  const { state } = useCoAgent<AgentState>({ name: "default", initialState: {} });
  const containerRef = useRef<HTMLDivElement>(null);
  const aiMarkerObjsRef = useRef<any[]>([]);
  const tabMarkerObjsRef = useRef<any[]>([]);
  const [sdkReady, setSdkReady] = useState(false);
  const [map, setMap] = useState<any>(null);

  // AI 검색 레이어 — 탭과 무관하게 항상 표시.
  const aiMarkers: MapMarker[] = useMemo(
    () => (state.current_places ?? []).map((p) => ({ lat: p.lat, lng: p.lng, label: p.place_name })),
    [state.current_places]
  );

  // 탭별 레이어 — [추천]이면 recommendMarkers(카테고리 축 색), [기록]이면 recordMarkers(고정색).
  const tabMarkers: MapMarker[] = useMemo(
    () =>
      activeTab === "recommend"
        ? recommendMarkers.map((p) => ({ lat: p.lat, lng: p.lng, label: p.place_name }))
        : recordMarkers.map((p) => ({ lat: p.lat, lng: p.lng, label: p.place_name })),
    [activeTab, recommendMarkers, recordMarkers]
  );

  const tabColor =
    activeTab === "recommend"
      ? recommendColorAxis
        ? AXIS_MARKER_COLOR[recommendColorAxis]
        : RECOMMEND_DEFAULT_COLOR
      : RECORD_MARKER_COLOR;

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
    aiMarkerObjsRef.current.forEach((m) => m.setMap(null));
    const image = buildMarkerImage(AI_MARKER_COLOR);
    aiMarkerObjsRef.current = aiMarkers.map(
      (place) =>
        new window.kakao.maps.Marker({
          position: new window.kakao.maps.LatLng(place.lat, place.lng),
          map,
          title: place.label,
          image,
        })
    );
  }, [map, aiMarkers]);

  useEffect(() => {
    if (!map) return;
    tabMarkerObjsRef.current.forEach((m) => m.setMap(null));
    const image = buildMarkerImage(tabColor);
    tabMarkerObjsRef.current = tabMarkers.map(
      (place) =>
        new window.kakao.maps.Marker({
          position: new window.kakao.maps.LatLng(place.lat, place.lng),
          map,
          title: place.label,
          image,
        })
    );
  }, [map, tabMarkers, tabColor]);

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
