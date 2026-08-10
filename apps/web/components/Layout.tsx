"use client";

import { useState } from "react";
import { MapView } from "./MapView";
import { Sidebar } from "./Sidebar";
import { AskAvatar } from "./AskAvatar";
import type { CategoryAxis, Place, Provider, Recommendation, SidebarTab, Visit } from "./types";

type MobileView = "map" | "list";

interface LayoutProps {
  provider: Provider;
  onProviderChange: (provider: Provider) => void;
}

export function Layout({ provider, onProviderChange }: LayoutProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>("recommend");
  const [mobileView, setMobileView] = useState<MobileView>("map");
  const [recordResults, setRecordResults] = useState<(Visit | Place)[]>([]);
  const [recommendResults, setRecommendResults] = useState<Recommendation[]>([]);
  const [recommendColorAxis, setRecommendColorAxis] = useState<CategoryAxis | null>(null);

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
        <Sidebar
          provider={provider}
          onProviderChange={onProviderChange}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onRecordResultsChange={setRecordResults}
          onRecommendResultsChange={(items, axis) => {
            setRecommendResults(items);
            setRecommendColorAxis(axis);
          }}
        />
      </div>
      <div className="layout-map">
        <MapView
          activeTab={activeTab}
          recordMarkers={recordResults}
          recommendMarkers={recommendResults}
          recommendColorAxis={recommendColorAxis}
        />
      </div>
      <AskAvatar />
    </div>
  );
}
