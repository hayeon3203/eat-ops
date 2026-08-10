"use client";

import { RecommendationList } from "./RecommendationList";
import { VisitList } from "./VisitList";
import type { CategoryAxis, Place, Recommendation, SidebarTab, Visit } from "./types";

interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onRecordResultsChange: (items: (Visit | Place)[]) => void;
  onRecommendResultsChange: (items: Recommendation[], activeColorAxis: CategoryAxis | null) => void;
}

export function Sidebar({
  activeTab,
  onTabChange,
  onRecordResultsChange,
  onRecommendResultsChange,
}: SidebarProps) {
  return (
    <div className="sidebar">
      <div className="sidebar-tabs">
        <button className={activeTab === "recommend" ? "active" : ""} onClick={() => onTabChange("recommend")}>
          추천
        </button>
        <button className={activeTab === "record" ? "active" : ""} onClick={() => onTabChange("record")}>
          기록
        </button>
      </div>
      <div className="sidebar-content">
        {activeTab === "recommend" ? (
          <RecommendationList onResultsChange={onRecommendResultsChange} />
        ) : (
          <VisitList onResultsChange={onRecordResultsChange} />
        )}
      </div>
    </div>
  );
}
