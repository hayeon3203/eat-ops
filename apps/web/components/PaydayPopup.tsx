"use client";

import { useEffect, useState } from "react";
import { pickPaydayRecommendations, type PaydayPick } from "./paydayPick";
import type { Recommendation } from "./types";

// Same-origin: app/api/agent/[...path] proxies to agent-api and attaches the
// passcode server-side. Never point this at agent-api's port directly —
// a cross-origin fetch carries no credentials and silently renders empty.
const AGENT_API_BASE = "/api/agent";

function isPaydayToday(): boolean {
  if (new URLSearchParams(window.location.search).get("forcePayday") === "1") return true;
  return new Date().getDate() === 25;
}

function dismissedKey(): string {
  const now = new Date();
  return `payday-popup-dismissed-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

interface PaydayPopupProps {
  onShowOnMap: (picks: PaydayPick[]) => void;
}

export function PaydayPopup({ onShowOnMap }: PaydayPopupProps) {
  const [picks, setPicks] = useState<PaydayPick[] | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!isPaydayToday() || window.localStorage.getItem(dismissedKey())) return;

    fetch(`${AGENT_API_BASE}/api/recommendations`)
      .then((res) => res.json())
      .then((data: Recommendation[]) => {
        const result = pickPaydayRecommendations(data);
        if (result.length > 0) setPicks(result);
      })
      .catch(() => {});
  }, []);

  if (!picks || closed) return null;

  function dismissForever() {
    window.localStorage.setItem(dismissedKey(), "1");
    setClosed(true);
  }

  function handleShowOnMap() {
    // 함수 선언은 위의 `if (!picks || closed) return null` 위로 호이스팅돼서
    // 그 가드의 좁히기가 여기까지 오지 않는다 — 다시 확인한다.
    if (!picks) return;
    setClosed(true);
    onShowOnMap(picks);
  }

  return (
    <div className="payday-popup-overlay">
      <div className="payday-popup-card">
        <button className="payday-popup-close" onClick={() => setClosed(true)} aria-label="닫기">
          ×
        </button>
        <img className="payday-popup-avatar" src="/food-picker-avatar-rice-pin-floating.gif" alt="" />
        <h2 className="payday-popup-title">월급날엔 나한테 잘 해주기</h2>
        <p className="payday-popup-subtitle">오늘 먹기 좋은 밥, 골라봤어요</p>
        <div className="payday-popup-picks">
          {picks.map(({ cuisine, place }) => (
            <div key={place.id} className="payday-popup-pick">
              <span className="payday-popup-pick-cuisine">{cuisine}</span>
              <span className="payday-popup-pick-name">{place.place_name}</span>
              {place.note && <span className="payday-popup-pick-note">{place.note}</span>}
            </div>
          ))}
        </div>
        <div className="payday-popup-actions">
          <button className="payday-popup-cta" onClick={handleShowOnMap}>
            지도에서 보기
          </button>
          <button className="payday-popup-dismiss" onClick={dismissForever}>
            더이상 보지 않기
          </button>
        </div>
      </div>
    </div>
  );
}
