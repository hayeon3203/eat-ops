"use client";

import { useEffect, useMemo, useState } from "react";
import { RecommendationForm } from "./RecommendationForm";
import { RestaurantCard } from "./RestaurantCard";
import { ReviewSection } from "./ReviewSection";
import type { CategoryAxis, Cuisine, FoodType, Occasion, Recommendation } from "./types";

const AGENT_API_BASE = process.env.NEXT_PUBLIC_AGENT_API_URL ?? "http://127.0.0.1:8787";

const OCCASIONS: Occasion[] = ["점심장소", "회식장소", "수고한 나에게"];
const FOOD_TYPES: FoodType[] = ["밥", "면", "빵"];
const CUISINES: Cuisine[] = ["한식", "양식", "일식", "중식", "베트남식", "기타"];

const AXIS_CSS_VAR: Record<CategoryAxis, string> = {
  occasion: "var(--tag-occasion)",
  food_type: "var(--tag-food-type)",
  cuisine: "var(--tag-cuisine)",
};

interface RecommendationListProps {
  onResultsChange: (items: Recommendation[], activeColorAxis: CategoryAxis | null) => void;
  /** Set (with a bumped token) to force the occasion filter open from outside, e.g. the payday popup's map CTA. */
  forcedOccasion?: { value: Occasion; token: number };
}

export function RecommendationList({ onResultsChange, forcedOccasion }: RecommendationListProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [occasionFilter, setOccasionFilter] = useState<Occasion | null>(null);
  const [foodTypeFilter, setFoodTypeFilter] = useState<FoodType | null>(null);
  const [cuisineFilter, setCuisineFilter] = useState<Cuisine | null>(null);
  const [activeAxis, setActiveAxis] = useState<CategoryAxis | null>(null);

  useEffect(() => {
    fetch(`${AGENT_API_BASE}/api/recommendations`)
      .then((res) => res.json())
      .then((data: Recommendation[]) => setRecommendations(data))
      .catch(() => setRecommendations([]));
  }, []);

  useEffect(() => {
    if (!forcedOccasion) return;
    setOccasionFilter(forcedOccasion.value);
    setActiveAxis("occasion");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forcedOccasion?.token]);

  const filtered = useMemo(
    () =>
      recommendations.filter(
        (r) =>
          (!occasionFilter || r.occasion === occasionFilter) &&
          (!foodTypeFilter || r.food_type === foodTypeFilter) &&
          (!cuisineFilter || r.cuisine === cuisineFilter)
      ),
    [recommendations, occasionFilter, foodTypeFilter, cuisineFilter]
  );

  useEffect(() => {
    onResultsChange(filtered, activeAxis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, activeAxis]);

  function toggleOccasion(value: Occasion) {
    if (occasionFilter === value) {
      setOccasionFilter(null);
      setActiveAxis(null);
    } else {
      setOccasionFilter(value);
      setActiveAxis("occasion");
    }
  }

  function toggleFoodType(value: FoodType) {
    if (foodTypeFilter === value) {
      setFoodTypeFilter(null);
      setActiveAxis(null);
    } else {
      setFoodTypeFilter(value);
      setActiveAxis("food_type");
    }
  }

  function toggleCuisine(value: Cuisine) {
    if (cuisineFilter === value) {
      setCuisineFilter(null);
      setActiveAxis(null);
    } else {
      setCuisineFilter(value);
      setActiveAxis("cuisine");
    }
  }

  async function handleDelete(rec: Recommendation) {
    if (!window.confirm(`"${rec.place_name}" (${rec.address}) 추천을 삭제할까요?`)) return;
    try {
      const res = await fetch(`${AGENT_API_BASE}/api/recommendations/${rec.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`delete failed: ${res.status}`);
      setRecommendations((prev) => prev.filter((r) => r.id !== rec.id));
    } catch {
      window.alert("삭제에 실패했습니다.");
    }
  }

  return (
    <div>
      <RecommendationForm onAdded={(rec) => setRecommendations((prev) => [rec, ...prev])} />
      <div className="category-filters">
        <div className="category-filter-group">
          <span className="category-filter-label">상황</span>
          <div className="category-filter-options">
            {OCCASIONS.map((o) => (
              <button
                key={o}
                className={occasionFilter === o ? "active" : ""}
                style={occasionFilter === o ? { backgroundColor: AXIS_CSS_VAR.occasion } : undefined}
                onClick={() => toggleOccasion(o)}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
        <div className="category-filter-group">
          <span className="category-filter-label">음식 형태</span>
          <div className="category-filter-options">
            {FOOD_TYPES.map((f) => (
              <button
                key={f}
                className={foodTypeFilter === f ? "active" : ""}
                style={foodTypeFilter === f ? { backgroundColor: AXIS_CSS_VAR.food_type } : undefined}
                onClick={() => toggleFoodType(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="category-filter-group">
          <span className="category-filter-label">요리 종류</span>
          <div className="category-filter-options">
            {CUISINES.map((c) => (
              <button
                key={c}
                className={cuisineFilter === c ? "active" : ""}
                style={cuisineFilter === c ? { backgroundColor: AXIS_CSS_VAR.cuisine } : undefined}
                onClick={() => toggleCuisine(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="sidebar-empty">등록된 추천이 없습니다.</p>
      ) : (
        filtered.map((r) => (
          <div key={r.id} className="recommendation-item">
            <div className="recommendation-item-body">
              <RestaurantCard
                name={r.place_name}
                address={r.address}
                occasion={r.occasion}
                foodType={r.food_type}
                cuisine={r.cuisine}
                note={r.note}
              />
              <ReviewSection place={r} />
            </div>
            <button className="recommendation-delete" onClick={() => handleDelete(r)}>
              삭제
            </button>
          </div>
        ))
      )}
    </div>
  );
}
