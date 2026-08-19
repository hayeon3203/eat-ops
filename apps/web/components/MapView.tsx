"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCoAgent } from "@copilotkit/react-core";
import { useGeolocation } from "./useGeolocation";
import type { AgentState, CategoryAxis, SelectedPlace, SidebarTab } from "./types";

interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  address?: string;
  category?: string;
  kakaoId: string;
  phone?: string;
}

interface MapViewProps {
  activeTab: SidebarTab;
  recordMarkers: { lat: number; lng: number; place_name: string; address?: string; kakao_place_id: string; phone?: string | null; category?: string | null }[];
  recommendMarkers: { lat: number; lng: number; place_name: string; address?: string; kakao_place_id: string; phone?: string | null; category?: string | null }[];
  recommendColorAxis: CategoryAxis | null;
  /** 월급날 팝업이 고른 3곳을 보고 있는 동안은 핀 대신 아바타로 표시한다. */
  paydayMode?: boolean;
  onMarkerSelect?: (place: SelectedPlace) => void;
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

function buildAvatarMarkerImage() {
  // 원본 GIF는 256x256. offset을 명시해 사각 이미지의 아래 중앙이 좌표에 닿게 한다.
  return new window.kakao.maps.MarkerImage(
    "/food-picker-avatar-rice-pin-floating.gif",
    new window.kakao.maps.Size(48, 48),
    { offset: new window.kakao.maps.Point(24, 48) }
  );
}

function toSelectedPlace(place: MapMarker): SelectedPlace {
  return {
    place_name: place.label,
    address: place.address ?? "",
    category: place.category,
    phone: place.phone,
    kakao_place_id: place.kakaoId,
    lat: place.lat,
    lng: place.lng,
  };
}

export function MapView({
  activeTab,
  recordMarkers,
  recommendMarkers,
  recommendColorAxis,
  paydayMode,
  onMarkerSelect,
}: MapViewProps) {
  const center = useGeolocation();
  const { state } = useCoAgent<AgentState>({ name: "default", initialState: {} });
  const containerRef = useRef<HTMLDivElement>(null);
  const aiMarkerObjsRef = useRef<any[]>([]);
  const tabMarkerObjsRef = useRef<any[]>([]);
  const [sdkReady, setSdkReady] = useState(false);
  const [map, setMap] = useState<any>(null);

  // AI 검색 레이어 — 탭과 무관하게 항상 표시.
  const aiMarkers: MapMarker[] = useMemo(
    () =>
      (state.current_places ?? []).map((p) => ({
        lat: p.lat,
        lng: p.lng,
        label: p.place_name,
        address: p.address,
        category: p.category,
        kakaoId: p.kakao_place_id,
        phone: p.phone ?? undefined,
      })),
    [state.current_places]
  );

  // 탭별 레이어 — [추천]이면 recommendMarkers(카테고리 축 색), [기록]이면 recordMarkers(고정색).
  const tabMarkers: MapMarker[] = useMemo(
    () =>
      activeTab === "recommend"
        ? recommendMarkers.map((p) => ({
            lat: p.lat,
            lng: p.lng,
            label: p.place_name,
            address: p.address,
            category: p.category ?? undefined,
            kakaoId: p.kakao_place_id,
            phone: p.phone ?? undefined,
          }))
        : recordMarkers.map((p) => ({
            lat: p.lat,
            lng: p.lng,
            label: p.place_name,
            address: p.address,
            category: p.category ?? undefined,
            kakaoId: p.kakao_place_id,
            phone: p.phone ?? undefined,
          })),
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
    aiMarkerObjsRef.current = aiMarkers.map((place) => {
      const marker = new window.kakao.maps.Marker({
        position: new window.kakao.maps.LatLng(place.lat, place.lng),
        map,
        title: place.label,
        image,
      });
      window.kakao.maps.event.addListener(marker, "click", () =>
        onMarkerSelect?.(toSelectedPlace(place))
      );
      return marker;
    });
  }, [map, aiMarkers, onMarkerSelect]);

  useEffect(() => {
    if (!map) return;
    tabMarkerObjsRef.current.forEach((m) => m.setMap(null));
    const image = paydayMode ? buildAvatarMarkerImage() : buildMarkerImage(tabColor);
    tabMarkerObjsRef.current = tabMarkers.map((place) => {
      const marker = new window.kakao.maps.Marker({
        position: new window.kakao.maps.LatLng(place.lat, place.lng),
        map,
        title: place.label,
        image,
      });
      window.kakao.maps.event.addListener(marker, "click", () =>
        onMarkerSelect?.(toSelectedPlace(place))
      );
      return marker;
    });
  }, [map, tabMarkers, tabColor, paydayMode, onMarkerSelect]);

  // 탭 마커셋이 바뀌면(필터 적용, 월급날 팝업의 "지도에서 보기" 등) 그 마커들이
  // 다 보이게 지도를 재조정 — 위 effect와 별개로, geolocation 중심 이동과도 무관.
  useEffect(() => {
    if (!map || tabMarkers.length === 0) return;
    const bounds = new window.kakao.maps.LatLngBounds();
    tabMarkers.forEach((place) => bounds.extend(new window.kakao.maps.LatLng(place.lat, place.lng)));
    map.setBounds(bounds);
  }, [map, tabMarkers]);

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
