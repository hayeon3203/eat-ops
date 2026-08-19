"use client";

import { useState } from "react";
import { MapView } from "./MapView";
import { Sidebar } from "./Sidebar";
import { AskAvatar } from "./AskAvatar";
import { PaydayPopup } from "./PaydayPopup";
import type { PaydayPick } from "./paydayPick";
import type { CategoryAxis, Place, Provider, Recommendation, SelectedPlace, SidebarTab, Visit } from "./types";

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
  const [paydayPickIds, setPaydayPickIds] = useState<number[] | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);

  // 팝업이 고른 3곳만 지도에 남긴다. 상황 필터(7곳)로 넓히면 팝업이 뽑아준 의미가
  // 사라져서, 리스트도 지도도 그 3곳으로 좁힌다.
  function focusPaydayRecommendations(picks: PaydayPick[]) {
    setActiveTab("recommend");
    setPaydayPickIds(picks.map((p) => p.place.id));
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
          paydayPickIds={paydayPickIds}
          onClearPaydayPicks={() => setPaydayPickIds(null)}
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
          paydayMode={paydayPickIds !== null}
          onMarkerSelect={setSelectedPlace}
        />
      </div>
      <AskAvatar />
      <PaydayPopup onShowOnMap={focusPaydayRecommendations} />
    </div>
  );
}
