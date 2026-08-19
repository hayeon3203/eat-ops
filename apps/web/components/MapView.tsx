"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCoAgent } from "@copilotkit/react-core";
import { useGeolocation } from "./useGeolocation";
import { BRANCH_OFFICES, metersToLatLngDelta } from "./branchOffices";
import type { AgentState, CategoryAxis, SelectedPlace } from "./types";

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
  recommendMarkers: { lat: number; lng: number; place_name: string; address?: string; kakao_place_id: string; phone?: string | null; category?: string | null }[];
  recommendColorAxis: CategoryAxis | null;
  /** 월급날 팝업이 고른 3곳을 보고 있는 동안은 핀 대신 아바타로 표시한다. */
  paydayMode?: boolean;
  onMarkerSelect?: (place: SelectedPlace) => void;
}

const AI_MARKER_COLOR = "#e0435c";
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
  // 배경을 살린 팝업용 GIF와 달리 마커에는 투명 배경본을 쓴다 — 지도 타일 위에
  // 흰 사각형이 얹히면 안 된다. 원본 256x256, offset을 명시해 사각 이미지의 아래
  // 중앙이 좌표에 닿게 한다.
  return new window.kakao.maps.MarkerImage(
    "/food-picker-avatar-rice-pin-floating-transparent-preserved.gif",
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
  recommendMarkers,
  recommendColorAxis,
  paydayMode,
  onMarkerSelect,
}: MapViewProps) {
  const center = useGeolocation();
  const { state } = useCoAgent<AgentState>({ name: "default", initialState: {} });
  const containerRef = useRef<HTMLDivElement>(null);
  const aiMarkerObjsRef = useRef<any[]>([]);
  const recommendMarkerObjsRef = useRef<any[]>([]);
  const branchOfficeObjsRef = useRef<any[]>([]);
  const [sdkReady, setSdkReady] = useState(false);
  const [map, setMap] = useState<any>(null);

  // AI 검색 레이어 — 항상 표시.
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

  // 추천 레이어.
  const tabMarkers: MapMarker[] = useMemo(
    () =>
      recommendMarkers.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        label: p.place_name,
        address: p.address,
        category: p.category ?? undefined,
        kakaoId: p.kakao_place_id,
        phone: p.phone ?? undefined,
      })),
    [recommendMarkers]
  );

  const recommendColor = recommendColorAxis ? AXIS_MARKER_COLOR[recommendColorAxis] : RECOMMEND_DEFAULT_COLOR;

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
    recommendMarkerObjsRef.current.forEach((m) => m.setMap(null));
    const image = paydayMode ? buildAvatarMarkerImage() : buildMarkerImage(recommendColor);
    recommendMarkerObjsRef.current = tabMarkers.map((place) => {
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
  }, [map, tabMarkers, recommendColor, paydayMode, onMarkerSelect]);

  // 지사 5곳 — 검색 결과도 추천도 아닌 고정 배경 정보라 상수 데이터([map] 하나에만) 의존.
  // 카카오에는 이미지 지상 오버레이 API가 없어 CustomOverlay에 <img>를 담고 px 크기를
  // 직접 계산한다: 중심과 그 동쪽으로 sizeM 떨어진 지점을 projection으로 컨테이너
  // 좌표로 변환하면 그 차이가 곧 한 변의 픽셀 값이다. 줌이 바뀌면 미터당
  // 픽셀 비율도 바뀌므로 zoom_changed 때마다 다시 계산 — 리스너는 지도 레벨이라
  // 이 effect가 직접 붙였고, 사이블링 마커 effect들과 달리 setMap(null)만으로는
  // 안 지워지므로 cleanup에서 removeListener로 반드시 뗀다.
  // 로고·라벨 모두 pointer-events: none이라 지도 드래그와 맛집 마커 클릭을 통과시킨다.
  useEffect(() => {
    if (!map) return;
    branchOfficeObjsRef.current.forEach((obj) => obj.setMap(null));

    const entries = BRANCH_OFFICES.map((office) => {
      const img = document.createElement("img");
      img.src = "/daol-icon.png";
      img.alt = "";
      img.className = "branch-office-logo";

      // xAnchor/yAnchor는 쓰지 않는다. 카카오는 오버레이를 만들 때 콘텐츠 크기를 재서
      // 앵커 오프셋을 잡는데, 우리는 그 뒤에 px 크기를 바꾼다 — 그러면 원본 141px 기준
      // 오프셋이 남아 (141-현재px)/2 만큼 왼쪽·위로 밀리고, 줌인해서 현재px가 141에
      // 가까워질수록 제자리로 수렴하는 것처럼 보인다. 앵커를 0,0으로 두고 CSS
      // translate(-50%,-50%)로 자기 크기 기준 중앙을 잡으면 크기가 언제 바뀌든 안 밀린다.
      const logo = new window.kakao.maps.CustomOverlay({
        map,
        position: new window.kakao.maps.LatLng(office.lat, office.lng),
        content: img,
        xAnchor: 0,
        yAnchor: 0,
      });
      const label = new window.kakao.maps.CustomOverlay({
        map,
        position: new window.kakao.maps.LatLng(office.lat, office.lng),
        content: `<div class="branch-office-label">${office.name}</div>`,
        yAnchor: 0.5,
      });
      return { office, img, logo, label };
    });

    branchOfficeObjsRef.current = entries.flatMap((e) => [e.logo, e.label]);

    function resizeLogos() {
      const projection = map.getProjection();
      entries.forEach(({ office, img }) => {
        const center = new window.kakao.maps.LatLng(office.lat, office.lng);
        const eastDelta = metersToLatLngDelta(office.lat, office.sizeM, 0);
        const eastPoint = new window.kakao.maps.LatLng(office.lat + eastDelta.dLat, office.lng + eastDelta.dLng);

        const centerPx = projection.pointFromCoords(center);
        const eastPx = projection.pointFromCoords(eastPoint);

        // 한 변만 재고 가로·세로에 같이 넣는다 — 원본이 141×141 정사각이라 두 축을
        // 따로 재면 투영 오차만큼 미세하게 찌그러진다.
        const sidePx = Math.abs(eastPx.x - centerPx.x);
        img.style.width = `${sidePx}px`;
        img.style.height = `${sidePx}px`;
        // translate가 먼저 와야 자기 중심으로 옮긴 뒤 그 중심을 축으로 회전한다.
        img.style.transform = `translate(-50%, -50%) rotate(${office.rotationDeg}deg)`;
      });
    }

    resizeLogos();
    window.kakao.maps.event.addListener(map, "zoom_changed", resizeLogos);

    return () => {
      window.kakao.maps.event.removeListener(map, "zoom_changed", resizeLogos);
    };
  }, [map]);

  // 추천 마커셋이 바뀌면(필터 적용, 월급날 팝업의 "지도에서 보기" 등) 그 마커들이
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
