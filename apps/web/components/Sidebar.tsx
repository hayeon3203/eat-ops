"use client";

import { useEffect, useRef, useState } from "react";
import { RecommendationList } from "./RecommendationList";
import { RestaurantCard } from "./RestaurantCard";
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
  forcedRecommendOccasion?: { value: Occasion; token: number };
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
  forcedRecommendOccasion,
  selectedPlace,
  onClearSelectedPlace,
}: SidebarProps) {
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeModelMenu(event: MouseEvent) {
      if (!modelMenuRef.current?.contains(event.target as Node)) setIsModelMenuOpen(false);
    }

    document.addEventListener("mousedown", closeModelMenu);
    return () => document.removeEventListener("mousedown", closeModelMenu);
  }, []);

  const selectedModel =
    provider === "local" ? "로컬 / EXAONE" : provider === "auto" ? "자동" : "Foundry / GPT-5 mini";

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
              "로컬: GB10의 vLLM으로 서빙되는 EXAONE-3.0-7.8B\n" +
              "자동: 주민번호·카드번호·API 키 등 민감 정보가 감지되면 로컬로, 그 외는 Foundry로 전송"
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
                aria-selected={provider === "auto"}
                onClick={() => selectModel("auto")}
              >
                <span className="model-option-copy">
                  <strong>자동</strong>
                  <small>민감 정보는 로컬로, 그 외는 Foundry로</small>
                </span>
                {provider === "auto" && <span className="model-option-check">✓</span>}
              </button>
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
          <RestaurantCard name={selectedPlace.place_name} address={selectedPlace.address} category={selectedPlace.category} />
          <a
            className="sidebar-selected-place-link"
            href={`https://place.map.kakao.com/${selectedPlace.kakao_place_id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            카카오맵에서 평점·리뷰 보기 ↗
          </a>
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
          <RecommendationList onResultsChange={onRecommendResultsChange} forcedOccasion={forcedRecommendOccasion} />
        ) : (
          <VisitList onResultsChange={onRecordResultsChange} />
        )}
      </div>
    </div>
  );
}
