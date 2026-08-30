"use client";

import { ModelPicker } from "./ModelPicker";
import { RecommendationList } from "./RecommendationList";
import type { CategoryAxis, Provider, Recommendation, SelectedPlace } from "./types";

interface SidebarProps {
  provider: Provider;
  onProviderChange: (provider: Provider) => void;
  onRecommendResultsChange: (items: Recommendation[], activeColorAxis: CategoryAxis | null) => void;
  paydayPickIds?: number[] | null;
  onClearPaydayPicks?: () => void;
  onSelectPlace?: (place: SelectedPlace) => void;
  /** 값이 바뀌면 추천 목록을 다시 불러온다 (상세 패널에서 장소를 추가했을 때). */
  refreshKey?: number;
}

export function Sidebar({
  provider,
  onProviderChange,
  onRecommendResultsChange,
  paydayPickIds,
  onClearPaydayPicks,
  onSelectPlace,
  refreshKey,
}: SidebarProps) {
  return (
    <div className="sidebar">
      <header className="sidebar-header">
        <img className="sidebar-brand-mark" src="/daol-fusion-tree.png" alt="Daol Fusion" />
        <ModelPicker provider={provider} onProviderChange={onProviderChange} />
      </header>
      <div className="sidebar-content">
        <RecommendationList
          onResultsChange={onRecommendResultsChange}
          forcedPickIds={paydayPickIds}
          onClearForcedPicks={onClearPaydayPicks}
          onSelect={onSelectPlace}
          refreshKey={refreshKey}
        />
      </div>
    </div>
  );
}
