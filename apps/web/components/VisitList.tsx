"use client";

import { useEffect, useMemo, useState } from "react";
import { getIdentity } from "./nickname";
import { RestaurantCard } from "./RestaurantCard";
import type { Place, Visit } from "./types";

const AGENT_API_BASE = process.env.NEXT_PUBLIC_AGENT_API_URL ?? "http://127.0.0.1:8787";

interface VisitListProps {
  onResultsChange: (items: (Visit | Place)[]) => void;
}

/** This tab shows only the reviews written from this browser (matched on the
 *  localStorage identity). Everyone else's reviews live under their place's
 *  card in the 추천 tab. */
export function VisitList({ onResultsChange }: VisitListProps) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [nickname, setNickname] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const identity = getIdentity();
    setNickname(identity.nickname);
    fetch(`${AGENT_API_BASE}/api/visits?author_id=${encodeURIComponent(identity.id)}`)
      .then((res) => res.json())
      .then((data: Visit[]) => setVisits(data))
      .catch(() => setVisits([]));
  }, []);

  const filtered = useMemo(
    () => visits.filter((v) => v.place_name.includes(query) || v.address.includes(query)),
    [visits, query]
  );

  useEffect(() => {
    onResultsChange(filtered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  return (
    <div>
      <p className="visit-identity">
        내 닉네임 <strong>{nickname || "…"}</strong>
      </p>
      <div className="visit-search">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="내 리뷰 검색"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="sidebar-empty">
          {visits.length === 0 ? "아직 남긴 리뷰가 없습니다." : "검색 결과가 없습니다."}
        </p>
      ) : (
        filtered.map((visit) => (
          <RestaurantCard
            key={visit.id}
            name={visit.place_name}
            address={visit.address}
            rating={visit.rating}
            note={visit.note}
          />
        ))
      )}
    </div>
  );
}
