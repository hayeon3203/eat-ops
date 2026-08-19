"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCoAgent } from "@copilotkit/react-core";
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
  /** 선택된 장소. 모바일 바텀시트가 아래를 덮으므로 그만큼 지도를 밀어준다. */
  focusPlace?: SelectedPlace | null;
}

// 지도 첫 화면은 항상 서울지사. 예전에는 useGeolocation 값을 중심으로 썼는데,
// 사용자가 어디에 있든 서울지사가 기준이어야 한다는 요구라 상수로 고정한다.
// (거리 라벨과 챗의 "내 주변"은 여전히 실제 좌표를 쓴다 — Layout/AskAvatar 참고.)
const DEFAULT_CENTER = BRANCH_OFFICES[0];

// globals.css의 모바일 .layout-place-panel 높이(58vh)와 같은 값. 시트가 가린 만큼
// 마커를 위로 올리는 데 쓴다 — 한쪽만 고치면 선택한 마커가 시트 뒤로 숨는다.
const SHEET_PEEK_RATIO = 0.58;
const MOBILE_QUERY = "(max-width: 768px)";

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
  focusPlace,
}: MapViewProps) {
  const { state } = useCoAgent<AgentState>({ name: "default", initialState: {} });
  const containerRef = useRef<HTMLDivElement>(null);
  const aiMarkerObjsRef = useRef<any[]>([]);
  const recommendMarkerObjsRef = useRef<any[]>([]);
  const branchOfficeObjsRef = useRef<any[]>([]);
  const didInitialFitRef = useRef(false);
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
        center: new window.kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
        level: 5,
      });
      setMap(instance);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkReady]);

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
        // 순서 바꾸지 말 것. CSS transform 목록은 오른쪽부터 적용된다 — rotate가 먼저
        // 자기 중심을 축으로 돌고, 그 다음 translate가 자기 크기의 절반만큼 밀어 중심을
        // 앵커에 맞춘다. 뒤집어서 rotate(...) translate(...)로 쓰면 회전이 이동에도
        // 걸려서, 각도를 준 로고가 제자리에서 도는 대신 앵커 주위를 돈다.
        // 지금은 다섯 지사 모두 rotationDeg가 0이라 뒤집어도 티가 안 난다.
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
  // 다 보이게 지도를 재조정.
  //
  // 단, 첫 번째로 마커가 채워지는 회차는 건너뛴다. RecommendationList가 마운트하자마자
  // 추천 전체를 fetch하므로 그 회차를 그대로 fit하면 전국 추천의 bounds가 잡혀
  // 서울지사 초기 중심이 즉시 덮인다. 사용자가 좁힌 결과에만 반응해야 한다.
  // (빈 배열 회차는 위 early return에 걸려 ref를 소비하지 않는다.)
  useEffect(() => {
    if (!map || tabMarkers.length === 0) return;
    if (!didInitialFitRef.current) {
      didInitialFitRef.current = true;
      return;
    }
    const bounds = new window.kakao.maps.LatLngBounds();
    tabMarkers.forEach((place) => bounds.extend(new window.kakao.maps.LatLng(place.lat, place.lng)));
    map.setBounds(bounds);
  }, [map, tabMarkers]);

  // 모바일에서 상세 바텀시트가 화면 아래 58%를 덮는다. 방금 누른 마커가 그 뒤로
  // 숨지 않게 지도 중심을 시트 높이의 절반만큼 "아래" 좌표로 옮긴다 — 화면상
  // 마커는 그만큼 위로 올라간다. panBy의 부호를 추측하는 대신, 지사 로고와 같은
  // projection 왕복(좌표→픽셀→좌표)으로 목표 중심을 직접 계산한다.
  // 데스크톱에서는 상세가 별도 컬럼이라 세로로 가리는 게 없어 아무것도 안 한다.
  useEffect(() => {
    if (!map || !focusPlace) return;
    if (!window.matchMedia(MOBILE_QUERY).matches) return;
    const projection = map.getProjection();
    const point = projection.pointFromCoords(
      new window.kakao.maps.LatLng(focusPlace.lat, focusPlace.lng)
    );
    const sheetPx = window.innerHeight * SHEET_PEEK_RATIO;
    map.panTo(
      projection.coordsFromPoint(new window.kakao.maps.Point(point.x, point.y + sheetPx / 2))
    );
  }, [map, focusPlace]);

  // 모바일에서 .layout-map이 display:none → flex로 전환될 때 컨테이너가 0×0에서
  // 실제 크기로 바뀌는데, Kakao는 window resize에만 자동 relayout하므로 CSS 토글은
  // 놓친다. ResizeObserver로 컨테이너 크기 변화를 직접 감지해 relayout을 호출한다.
  //
  // relayout은 중심이 아니라 좌상단을 붙들고 크기를 다시 잰다. 모바일 첫 화면이
  // 리스트라 지도는 0×0으로 만들어지고, 지도 탭을 누르는 순간 중심이 화면
  // 왼쪽 위 모서리로 밀려난다 — 서울지사 초기 중심이 그대로 사라진다.
  // 그래서 크기를 재기 전 중심을 들고 있다가 다시 넣어준다.
  useEffect(() => {
    if (!map || !containerRef.current) return;
    const observer = new ResizeObserver(() => {
      const center = map.getCenter();
      map.relayout();
      map.setCenter(center);
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
