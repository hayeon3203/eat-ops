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
}

export function Sidebar({
  provider,
  onProviderChange,
  onRecommendResultsChange,
  paydayPickIds,
  onClearPaydayPicks,
  onSelectPlace,
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
        />
      </div>
    </div>
  );
}
