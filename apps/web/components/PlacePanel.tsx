"use client";

import { useState } from "react";
import { RestaurantCard } from "./RestaurantCard";
import { ReviewSection } from "./ReviewSection";
import { categoryBadge, formatDistance, haversineMeters } from "./placeMeta";
import type { SelectedPlace } from "./types";

// Same-origin: app/api/agent/[...path]가 agent-api로 프록시하며 패스코드를 붙인다.
const AGENT_API_BASE = "/api/agent";

interface PlacePanelProps {
  place: SelectedPlace;
  onClose: () => void;
  /** 이 패널에서 장소를 추천 목록에 넣었을 때 — 사이드바 목록을 다시 불러오게 한다. */
  onAdded?: () => void;
  // 패널은 열고 닫힐 때마다 마운트/언마운트된다. useGeolocation을 여기서 직접 부르면
  // 열 때마다 위치를 새로 요청하게 되어, 항상 마운트 상태인 Layout에서 한 번만
  // 구하고 내려받는다.
  myLocation: { lat: number; lng: number };
  locationResolved: boolean;
}

export function PlacePanel({ place, onClose, onAdded, myLocation, locationResolved }: PlacePanelProps) {
  // 모바일 바텀시트의 두 단계(엿보기/전체). 데스크톱에서는 이 컴포넌트가 고정 폭
  // 컬럼이고 핸들이 display:none이라 이 값은 아무 효과가 없다.
  const [expanded, setExpanded] = useState(false);
  // "추가 중 / 추가됨 / 실패" 한 상태로. 성공하면 버튼이 잠겨 같은 곳을 두 번
  // 넣는 사고를 막는다 — DB에 kakao_place_id 유니크 제약이 없다.
  const [addState, setAddState] = useState<"idle" | "adding" | "added" | "error">("idle");

  async function addToRecommendations() {
    setAddState("adding");
    try {
      const res = await fetch(`${AGENT_API_BASE}/api/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 분류는 안 보낸다 — 여기서 고르게 하면 패널이 등록 폼이 된다.
        // 카테고리는 목록에서 나중에 붙이면 된다.
        body: JSON.stringify({ place_name: place.place_name, note: "" }),
      });
      if (!res.ok) throw new Error(`failed: ${res.status}`);
      setAddState("added");
      onAdded?.();
    } catch {
      setAddState("error");
    }
  }
  const badge = categoryBadge(place.category);
  const distance = locationResolved
    ? formatDistance(haversineMeters(myLocation, { lat: place.lat, lng: place.lng }))
    : "";

  // 레이아웃 래퍼(.layout-place-panel)를 여기서 그린다. 시트 높이가 expanded에
  // 따라 바뀌는데 그 값이 이 컴포넌트 안에만 있어서, 부모에 상태를 올리거나
  // :has()로 우회하는 것보다 래퍼를 같이 소유하는 쪽이 단순하다.
  return (
    <div className="layout-place-panel" data-expanded={expanded}>
      <button
        type="button"
        className="place-sheet-handle"
        aria-label={expanded ? "상세 접기" : "상세 펼치기"}
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      />
      <div className="sidebar-selected-place">
        <div className="sidebar-selected-place-header">
          <span>선택한 장소</span>
          <button type="button" onClick={onClose} aria-label="선택 해제">
            ✕
          </button>
        </div>
        <RestaurantCard name={place.place_name} address={place.address} />
        {(badge || place.phone || distance) && (
          <div className="sidebar-selected-place-meta">
            {badge && <span className="sidebar-selected-place-badge">{badge}</span>}
            {place.phone && (
              <a className="sidebar-selected-place-phone" href={`tel:${place.phone}`}>
                <span aria-hidden="true">📞</span> {place.phone}
              </a>
            )}
            {/* 배지·전화처럼 별도 색/배경이 없어 부모 .sidebar-selected-place-meta의
                기본 텍스트 스타일을 그대로 쓴다 — 전용 클래스를 붙일 이유가 없다. */}
            {distance && <span>{distance}</span>}
          </div>
        )}
        <button
          type="button"
          className="sidebar-selected-place-add"
          onClick={addToRecommendations}
          disabled={addState === "adding" || addState === "added"}
        >
          {addState === "added"
            ? "추천 목록에 추가됨"
            : addState === "adding"
              ? "추가하는 중…"
              : addState === "error"
                ? "추가 실패 — 다시 시도"
                : "장소로 추가"}
        </button>
        <a
          className="sidebar-selected-place-link"
          href={`https://place.map.kakao.com/${place.kakao_place_id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          카카오맵에서 보기 ↗
        </a>
        <ReviewSection
          key={place.kakao_place_id}
          defaultOpen
          place={{
            kakao_place_id: place.kakao_place_id,
            place_name: place.place_name,
            address: place.address,
            lat: place.lat,
            lng: place.lng,
            // 패널은 목록의 join 요약을 못 받는다. defaultOpen이라 마운트 직후
            // fetch한 값이 이 자리를 덮어쓴다 (ReviewSection.tsx의 count/avg).
            rating_avg: null,
            review_count: 0,
            phone: place.phone,
            category: place.category,
          }}
        />
      </div>
    </div>
  );
}
