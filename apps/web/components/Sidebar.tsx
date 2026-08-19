"use client";

import { useEffect, useRef, useState } from "react";
import { RecommendationList } from "./RecommendationList";
import { RestaurantCard } from "./RestaurantCard";
import { ReviewSection } from "./ReviewSection";
import { categoryBadge, formatDistance, haversineMeters } from "./placeMeta";
import { useGeolocation } from "./useGeolocation";
import { VisitList } from "./VisitList";
import type {
  CategoryAxis,
  Occasion,
  Place,
  Provider,
  Recommendation,
  SelectedPlace,
  SidebarTab,
  Visit,
} from "./types";

interface SidebarProps {
  provider: Provider;
  onProviderChange: (provider: Provider) => void;
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onRecordResultsChange: (items: (Visit | Place)[]) => void;
  onRecommendResultsChange: (items: Recommendation[], activeColorAxis: CategoryAxis | null) => void;
  paydayPickIds?: number[] | null;
  onClearPaydayPicks?: () => void;
  selectedPlace?: SelectedPlace | null;
  onClearSelectedPlace?: () => void;
}

export function Sidebar({
  provider,
  onProviderChange,
  activeTab,
  onTabChange,
  onRecordResultsChange,
  onRecommendResultsChange,
  paydayPickIds,
  onClearPaydayPicks,
  selectedPlace,
  onClearSelectedPlace,
}: SidebarProps) {
  const myLocation = useGeolocation();
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeModelMenu(event: MouseEvent) {
      if (!modelMenuRef.current?.contains(event.target as Node)) setIsModelMenuOpen(false);
    }

    document.addEventListener("mousedown", closeModelMenu);
    return () => document.removeEventListener("mousedown", closeModelMenu);
  }, []);

  const selectedModel = provider === "local" ? "로컬 / EXAONE" : "Foundry / GPT-5 mini";
  const badge = categoryBadge(selectedPlace?.category);
  const distance = selectedPlace
    ? formatDistance(haversineMeters(myLocation, { lat: selectedPlace.lat, lng: selectedPlace.lng }))
    : "";

  function selectModel(nextProvider: Provider) {
    setIsModelMenuOpen(false);
    onProviderChange(nextProvider);
  }

  return (
    <div className="sidebar">
      <header className="sidebar-header">
        <img className="sidebar-brand-mark" src="/daol-fusion-tree.png" alt="Daol Fusion" />
        <div className="model-picker" ref={modelMenuRef}>
          <button
            type="button"
            className="model-picker-trigger"
            aria-haspopup="listbox"
            aria-expanded={isModelMenuOpen}
            onClick={() => setIsModelMenuOpen((open) => !open)}
          >
            <span>{selectedModel}</span>
            <svg className="model-picker-chevron" viewBox="0 0 16 16" aria-hidden="true">
              <path d="m4 6 4 4 4-4" />
            </svg>
          </button>
          <span
            className="info-icon"
            aria-label="모델 안내"
            title={
              "Foundry: Microsoft Foundry에 배포된 GPT-5 mini\n" +
              "로컬: GB10의 vLLM으로 서빙되는 EXAONE-3.0-7.8B"
            }
          >
            ⓘ
          </span>
          {isModelMenuOpen && (
            <div
              className="model-picker-menu"
              role="listbox"
              aria-label="모델 선택"
              onKeyDown={(event) => event.key === "Escape" && setIsModelMenuOpen(false)}
            >
              <button
                type="button"
                role="option"
                aria-selected={provider === "foundry"}
                onClick={() => selectModel("foundry")}
              >
                <span className="model-option-copy">
                  <strong>Foundry</strong>
                  <small>GPT-5 mini</small>
                </span>
                {provider === "foundry" && <span className="model-option-check">✓</span>}
              </button>
              <button
                type="button"
                role="option"
                aria-selected={provider === "local"}
                onClick={() => selectModel("local")}
              >
                <span className="model-option-copy">
                  <strong>로컬</strong>
                  <small>EXAONE · GB10 vLLM</small>
                </span>
                {provider === "local" && <span className="model-option-check">✓</span>}
              </button>
            </div>
          )}
        </div>
      </header>
      {selectedPlace && (
        <div className="sidebar-selected-place">
          <div className="sidebar-selected-place-header">
            <span>선택한 장소</span>
            <button type="button" onClick={onClearSelectedPlace} aria-label="선택 해제">
              ✕
            </button>
          </div>
          <RestaurantCard name={selectedPlace.place_name} address={selectedPlace.address} />
          <div className="sidebar-selected-place-meta">
            {badge && <span className="sidebar-selected-place-badge">{badge}</span>}
            {selectedPlace.phone && (
              <a className="sidebar-selected-place-phone" href={`tel:${selectedPlace.phone}`}>
                📞 {selectedPlace.phone}
              </a>
            )}
            <span className="sidebar-selected-place-distance">{distance}</span>
          </div>
          <a
            className="sidebar-selected-place-link"
            href={`https://place.map.kakao.com/${selectedPlace.kakao_place_id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            카카오맵에서 보기 ↗
          </a>
          <ReviewSection
            key={selectedPlace.kakao_place_id}
            defaultOpen
            place={{
              kakao_place_id: selectedPlace.kakao_place_id,
              place_name: selectedPlace.place_name,
              address: selectedPlace.address,
              lat: selectedPlace.lat,
              lng: selectedPlace.lng,
              // 패널은 목록의 join 요약을 못 받는다. defaultOpen이라 마운트 직후
              // fetch한 값이 이 자리를 덮어쓴다 (ReviewSection.tsx의 count/avg).
              rating_avg: null,
              review_count: 0,
            }}
          />
        </div>
      )}
      <div className="sidebar-tabs">
        <button className={activeTab === "recommend" ? "active" : ""} onClick={() => onTabChange("recommend")}>
          추천
        </button>
        <button className={activeTab === "record" ? "active" : ""} onClick={() => onTabChange("record")}>
          내 리뷰
        </button>
      </div>
      <div className="sidebar-content">
        {activeTab === "recommend" ? (
          <RecommendationList
            onResultsChange={onRecommendResultsChange}
            forcedPickIds={paydayPickIds}
            onClearForcedPicks={onClearPaydayPicks}
          />
        ) : (
          <VisitList onResultsChange={onRecordResultsChange} />
        )}
      </div>
    </div>
  );
}
