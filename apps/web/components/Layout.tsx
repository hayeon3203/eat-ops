"use client";

import { useState } from "react";
import { MapView } from "./MapView";
import { Sidebar } from "./Sidebar";
import { AskAvatar } from "./AskAvatar";
import type { Place, SidebarTab, Visit } from "./types";

type MobileView = "map" | "list";

export function Layout() {
  const [activeTab, setActiveTab] = useState<SidebarTab>("recommend");
  const [mobileView, setMobileView] = useState<MobileView>("map");
  const [recordResults, setRecordResults] = useState<(Visit | Place)[]>([]);

  return (
    <div className="layout-root" data-mobile-view={mobileView}>
      <div className="mobile-view-tabs">
        <button className={mobileView === "map" ? "active" : ""} onClick={() => setMobileView("map")}>
          지도
        </button>
        <button className={mobileView === "list" ? "active" : ""} onClick={() => setMobileView("list")}>
          리스트
        </button>
      </div>
      <div className="layout-sidebar">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} onRecordResultsChange={setRecordResults} />
      </div>
      <div className="layout-map">
        <MapView activeTab={activeTab} recordMarkers={recordResults} />
      </div>
      <AskAvatar />
    </div>
  );
}
