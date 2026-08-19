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
  // 챗 열림 상태는 page.tsx가 <CopilotKit> 바깥에서 들고 있다 — 모델을 바꾸면
  // key={provider}가 이 서브트리를 통째로 remount시켜 팝업이 닫혀버리기 때문.
  chatOpen: boolean;
  onChatOpenChange: (open: boolean) => void;
}

export function Layout({ provider, onProviderChange, chatOpen, onChatOpenChange }: LayoutProps) {
  // 모바일 첫 화면은 리스트. 지도는 SSR에 빈 div로만 나가고(카카오 SDK가 클라이언트에서
  // 그린다) 좁은 화면에서는 사이드바가 display:none이라, 첫 화면을 지도로 두면 JS가
  // 다 뜰 때까지 탭 바만 있는 빈 화면이 보인다. 리스트는 SSR로 이미 그려져 있다.
  const [mobileView, setMobileView] = useState<MobileView>("list");
  const [recommendResults, setRecommendResults] = useState<Recommendation[]>([]);
  const [recommendColorAxis, setRecommendColorAxis] = useState<CategoryAxis | null>(null);
  const [paydayPickIds, setPaydayPickIds] = useState<number[] | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  // Layout은 항상 마운트돼 있으므로 여기서 한 번만 요청한다. PlacePanel은 열고
  // 닫힐 때마다 마운트/언마운트되어, 거기서 직접 부르면 열 때마다 위치를 재요청했다.
  const { resolved: locationResolved, ...myLocation } = useGeolocation();

  // 팝업이 고른 3곳만 지도에 남긴다. 상황 필터(7곳)로 넓히면 팝업이 뽑아준 의미가
  // 사라져서, 리스트도 지도도 그 3곳으로 좁힌다. 좁은 화면은 지도와 리스트 중
  // 하나만 보이므로 "지도에서 보기"가 지도로 전환까지 해야 한다 — 안 그러면
  // 리스트에 남은 채로 버튼만 먹는다.
  function focusPaydayRecommendations(picks: PaydayPick[]) {
    setPaydayPickIds(picks.map((p) => p.place.id));
    setMobileView("map");
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
        // key: 다른 마커로 갈아타면 시트를 다시 엿보기 높이로 되돌린다.
        <PlacePanel
          key={selectedPlace.kakao_place_id}
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
          myLocation={myLocation}
          locationResolved={locationResolved}
        />
      )}
      <div className="layout-map">
        <MapView
          recommendMarkers={recommendResults}
          recommendColorAxis={recommendColorAxis}
          paydayMode={paydayPickIds !== null}
          onMarkerSelect={setSelectedPlace}
          focusPlace={selectedPlace}
        />
      </div>
      <AskAvatar
        provider={provider}
        onProviderChange={onProviderChange}
        open={chatOpen}
        onOpenChange={onChatOpenChange}
      />
      <PaydayPopup onShowOnMap={focusPaydayRecommendations} />
    </div>
  );
}
