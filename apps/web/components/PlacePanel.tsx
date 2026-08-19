"use client";

import { RestaurantCard } from "./RestaurantCard";
import { ReviewSection } from "./ReviewSection";
import { categoryBadge, formatDistance, haversineMeters } from "./placeMeta";
import { useGeolocation } from "./useGeolocation";
import type { SelectedPlace } from "./types";

interface PlacePanelProps {
  place: SelectedPlace;
  onClose: () => void;
}

export function PlacePanel({ place, onClose }: PlacePanelProps) {
  const { resolved: locationResolved, ...myLocation } = useGeolocation();
  const badge = categoryBadge(place.category);
  const distance = locationResolved
    ? formatDistance(haversineMeters(myLocation, { lat: place.lat, lng: place.lng }))
    : "";

  return (
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
  );
}
