"use client";

import { useEffect, useMemo, useState } from "react";
import { RestaurantCard } from "./RestaurantCard";
import type { Place, Visit } from "./types";

const AGENT_API_BASE = process.env.NEXT_PUBLIC_AGENT_API_URL ?? "http://127.0.0.1:8787";

interface VisitListProps {
  onResultsChange: (items: (Visit | Place)[]) => void;
}

export function VisitList({ onResultsChange }: VisitListProps) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [query, setQuery] = useState("");
  const [liveResults, setLiveResults] = useState<Place[] | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    fetch(`${AGENT_API_BASE}/api/visits`)
      .then((res) => res.json())
      .then((data: Visit[]) => setVisits(data))
      .catch(() => setVisits([]));
  }, []);

  const filtered = useMemo(
    () => visits.filter((v) => v.place_name.includes(query) || v.address.includes(query)),
    [visits, query]
  );
  const displayed: (Visit | Place)[] = useMemo(() => liveResults ?? filtered, [liveResults, filtered]);

  useEffect(() => {
    onResultsChange(displayed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayed]);

  async function searchLive() {
    if (!query.trim()) return;
    setLiveLoading(true);
    setLiveError(null);
    setQuotaExceeded(false);
    try {
      const res = await fetch(`${AGENT_API_BASE}/api/search?q=${encodeURIComponent(query)}`);
      if (res.status === 429) {
        setLiveError("오늘 카카오 검색 한도를 초과했습니다.");
        setQuotaExceeded(true);
        return;
      }
      if (!res.ok) throw new Error(`search failed: ${res.status}`);
      const data: Place[] = await res.json();
      setLiveResults(data);
    } catch {
      setLiveError("검색에 실패했습니다.");
    } finally {
      setLiveLoading(false);
    }
  }

  return (
    <div>
      <div className="visit-search">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLiveResults(null);
          }}
          placeholder="방문한 맛집 검색"
        />
        <button onClick={searchLive} disabled={liveLoading || quotaExceeded}>
          카카오에서 더 찾기
        </button>
      </div>
      {liveError && <p className="visit-search-error">{liveError}</p>}
      {displayed.length === 0 ? (
        <p className="sidebar-empty">방문 기록이 없습니다.</p>
      ) : (
        displayed.map((item) => (
          <RestaurantCard
            key={"id" in item ? item.id : item.kakao_place_id}
            name={item.place_name}
            address={item.address}
            rating={"rating" in item ? item.rating : undefined}
          />
        ))
      )}
    </div>
  );
}
