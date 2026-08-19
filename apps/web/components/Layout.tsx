"use client";

import { useState } from "react";
import { MapView } from "./MapView";
import { Sidebar } from "./Sidebar";
import { PlacePanel } from "./PlacePanel";
import { AskAvatar } from "./AskAvatar";
import { PaydayPopup } from "./PaydayPopup";
import { useGeolocation } from "./useGeolocation";
import type { PaydayPick } from "./paydayPick";
import type { CategoryAxis, Provider, Recommendation, SelectedPlace } from "./types";

type MobileView = "map" | "list";

interface LayoutProps {
  provider: Provider;
  onProviderChange: (provider: Provider) => void;
}

export function Layout({ provider, onProviderChange }: LayoutProps) {
  const [mobileView, setMobileView] = useState<MobileView>("map");
  const [recommendResults, setRecommendResults] = useState<Recommendation[]>([]);
  const [recommendColorAxis, setRecommendColorAxis] = useState<CategoryAxis | null>(null);
  const [paydayPickIds, setPaydayPickIds] = useState<number[] | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  // Layout은 항상 마운트돼 있으므로 여기서 한 번만 요청한다. PlacePanel은 열고
  // 닫힐 때마다 마운트/언마운트되어, 거기서 직접 부르면 열 때마다 위치를 재요청했다.
  const { resolved: locationResolved, ...myLocation } = useGeolocation();

  // 팝업이 고른 3곳만 지도에 남긴다. 상황 필터(7곳)로 넓히면 팝업이 뽑아준 의미가
  // 사라져서, 리스트도 지도도 그 3곳으로 좁힌다.
  function focusPaydayRecommendations(picks: PaydayPick[]) {
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
          onRecommendResultsChange={(items, axis) => {
            setRecommendResults(items);
            setRecommendColorAxis(axis);
          }}
          paydayPickIds={paydayPickIds}
          onClearPaydayPicks={() => setPaydayPickIds(null)}
          onSelectPlace={setSelectedPlace}
        />
      </div>
      {selectedPlace && (
        <div className="layout-place-panel">
          <PlacePanel
            place={selectedPlace}
            onClose={() => setSelectedPlace(null)}
            myLocation={myLocation}
            locationResolved={locationResolved}
          />
        </div>
      )}
      <div className="layout-map">
        <MapView
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
