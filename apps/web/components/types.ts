export interface Place {
  kakao_place_id: string;
  place_name: string;
  address: string;
  category: string;
  lat: number;
  lng: number;
  place_url: string;
}

export interface Visit {
  id: number;
  kakao_place_id: string;
  place_name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  note: string;
  visited_at: string;
}

export interface AgentState {
  current_places?: Place[];
  kakao_quota_exceeded?: boolean;
}

export type SidebarTab = "recommend" | "record";
