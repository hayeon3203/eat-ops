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
export type Provider = "local" | "foundry";

export type Occasion = "점심장소" | "회식장소" | "수고한 나에게";
export type FoodType = "밥" | "면" | "빵";
export type Cuisine = "한식" | "양식" | "일식" | "중식" | "베트남식" | "기타";
export type CategoryAxis = "occasion" | "food_type" | "cuisine";

export interface Recommendation {
  id: number;
  kakao_place_id: string;
  place_name: string;
  address: string;
  lat: number;
  lng: number;
  occasion: Occasion | null;
  food_type: FoodType | null;
  cuisine: Cuisine | null;
  note: string;
  created_at: string;
}
