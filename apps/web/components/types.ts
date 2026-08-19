export interface SelectedPlace {
  place_name: string;
  address: string;
  category?: string;
  kakao_place_id: string;
}

export interface Place {
  kakao_place_id: string;
  place_name: string;
  address: string;
  category: string;
  lat: number;
  lng: number;
  place_url: string;
}

/** A visit row doubles as a review: rating + note + author. Rows written by
 *  the chat `record_visit` tool have no author and render as 익명. */
export interface Visit {
  id: number;
  kakao_place_id: string;
  place_name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  note: string;
  author: string | null;
  author_id: string | null;
  visited_at: string;
}

export interface AgentState {
  current_places?: Place[];
  kakao_quota_exceeded?: boolean;
}

export type SidebarTab = "recommend" | "record";
// agent-api still exposes /auto (Plans.md M4 ModelRouter); it's just not
// offered in the UI — with only two providers wired, "자동" always resolved to
// the same place as an explicit pick and read as a broken option.
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
  /** Review summary joined on by GET /api/recommendations; null when unrated. */
  rating_avg: number | null;
  review_count: number;
}
