"use client";

import { useState } from "react";
import { MapView } from "./MapView";
import { Sidebar } from "./Sidebar";
import { AskAvatar } from "./AskAvatar";
import { PaydayPopup } from "./PaydayPopup";
import type { CategoryAxis, Occasion, Place, Provider, Recommendation, SelectedPlace, SidebarTab, Visit } from "./types";

type MobileView = "map" | "list";

interface LayoutProps {
  provider: Provider;
  onProviderChange: (provider: Provider) => void;
}

export function Layout({ provider, onProviderChange }: LayoutProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>("recommend");
  // 모바일 첫 화면은 리스트. 지도는 SSR에 빈 div로만 나가고(카카오 SDK가 클라이언트에서
  // 그린다) 좁은 화면에서는 사이드바가 display:none이라, 첫 화면을 지도로 두면 JS가
  // 다 뜰 때까지 탭 바만 있는 빈 화면이 보인다. 리스트는 SSR로 이미 그려져 있다.
  const [mobileView, setMobileView] = useState<MobileView>("list");
  const [recordResults, setRecordResults] = useState<(Visit | Place)[]>([]);
  const [recommendResults, setRecommendResults] = useState<Recommendation[]>([]);
  const [recommendColorAxis, setRecommendColorAxis] = useState<CategoryAxis | null>(null);
  const [paydayFocus, setPaydayFocus] = useState<{ value: Occasion; token: number } | undefined>(undefined);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);

  function focusPaydayRecommendations() {
    setActiveTab("recommend");
    setPaydayFocus((prev) => ({ value: "수고한 나에게", token: (prev?.token ?? 0) + 1 }));
  }

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
          forcedRecommendOccasion={paydayFocus}
          selectedPlace={selectedPlace}
          onClearSelectedPlace={() => setSelectedPlace(null)}
        />
      </div>
      <div className="layout-map">
        <MapView
          activeTab={activeTab}
          recordMarkers={recordResults}
          recommendMarkers={recommendResults}
          recommendColorAxis={recommendColorAxis}
          onMarkerSelect={setSelectedPlace}
        />
      </div>
      <AskAvatar />
      <PaydayPopup onShowOnMap={focusPaydayRecommendations} />
    </div>
  );
}
