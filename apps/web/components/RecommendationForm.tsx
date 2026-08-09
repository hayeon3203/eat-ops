"use client";

import { useState } from "react";
import type { Cuisine, FoodType, Occasion, Recommendation } from "./types";

const AGENT_API_BASE = process.env.NEXT_PUBLIC_AGENT_API_URL ?? "http://127.0.0.1:8787";

const OCCASIONS: Occasion[] = ["점심장소", "회식장소", "수고한 나에게"];
const FOOD_TYPES: FoodType[] = ["밥", "면", "빵"];
const CUISINES: Cuisine[] = ["한식", "양식", "일식", "중식", "베트남식", "기타"];

interface RecommendationFormProps {
  onAdded: (rec: Recommendation) => void;
}

export function RecommendationForm({ onAdded }: RecommendationFormProps) {
  const [placeName, setPlaceName] = useState("");
  const [occasion, setOccasion] = useState<Occasion | "">("");
  const [foodType, setFoodType] = useState<FoodType | "">("");
  const [cuisine, setCuisine] = useState<Cuisine | "">("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!placeName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${AGENT_API_BASE}/api/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          place_name: placeName,
          occasion: occasion || null,
          food_type: foodType || null,
          cuisine: cuisine || null,
          note,
        }),
      });
      if (!res.ok) throw new Error(`failed: ${res.status}`);
      const rec: Recommendation = await res.json();
      onAdded(rec);
      setPlaceName("");
      setOccasion("");
      setFoodType("");
      setCuisine("");
      setNote("");
    } catch {
      setError("등록에 실패했습니다. 장소명을 확인해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="recommendation-form">
      <input type="text" value={placeName} onChange={(e) => setPlaceName(e.target.value)} placeholder="장소명" />
      <select value={occasion} onChange={(e) => setOccasion(e.target.value as Occasion | "")}>
        <option value="">상황 선택 안 함</option>
        {OCCASIONS.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <select value={foodType} onChange={(e) => setFoodType(e.target.value as FoodType | "")}>
        <option value="">음식형태 선택 안 함</option>
        {FOOD_TYPES.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <select value={cuisine} onChange={(e) => setCuisine(e.target.value as Cuisine | "")}>
        <option value="">요리종류 선택 안 함</option>
        {CUISINES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="추천 이유 (선택)" />
      {error && <p className="visit-search-error">{error}</p>}
      <button onClick={submit} disabled={submitting || !placeName.trim()}>
        추천 등록
      </button>
    </div>
  );
}
