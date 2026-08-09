"use client";

import { RecommendList } from "./RecommendList";
import { VisitList } from "./VisitList";
import type { Place, SidebarTab, Visit } from "./types";

interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onRecordResultsChange: (items: (Visit | Place)[]) => void;
}

export function Sidebar({ activeTab, onTabChange, onRecordResultsChange }: SidebarProps) {
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
        {activeTab === "recommend" ? <RecommendList /> : <VisitList onResultsChange={onRecordResultsChange} />}
      </div>
    </div>
  );
}
