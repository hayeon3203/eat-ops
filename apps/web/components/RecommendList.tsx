"use client";

import { useCoAgent } from "@copilotkit/react-core";
import { RestaurantCard } from "./RestaurantCard";
import type { AgentState } from "./types";

export function RecommendList() {
  const { state } = useCoAgent<AgentState>({ name: "default", initialState: {} });
  const places = state.current_places ?? [];

  if (places.length === 0) {
    return <p className="sidebar-empty">우측 하단 채팅으로 맛집을 물어보세요.</p>;
  }

  return (
    <div>
      {places.map((p) => (
        <RestaurantCard key={p.kakao_place_id} name={p.place_name} address={p.address} category={p.category} />
      ))}
    </div>
  );
}
