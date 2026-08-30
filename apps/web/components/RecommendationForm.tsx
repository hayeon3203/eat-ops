"use client";

import { useEffect, useState } from "react";
import type { Cuisine, FoodType, Occasion, Place, Recommendation } from "./types";

// Same-origin: app/api/agent/[...path] proxies to agent-api and attaches the
// passcode server-side. Never point this at agent-api's port directly —
// a cross-origin fetch carries no credentials and silently renders empty.
const AGENT_API_BASE = "/api/agent";

const OCCASIONS: Occasion[] = ["점심장소", "회식장소", "수고한 나에게"];
const FOOD_TYPES: FoodType[] = ["밥", "면", "빵"];
const CUISINES: Cuisine[] = ["한식", "양식", "일식", "중식", "베트남식", "기타"];

interface RecommendationFormProps {
  onAdded: (rec: Recommendation) => void;
}

export function RecommendationForm({ onAdded }: RecommendationFormProps) {
  const [placeName, setPlaceName] = useState("");
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  // 목록에서 하나 고른 직후에는 그 이름으로 다시 검색하지 않는다 —
  // setPlaceName이 다시 이 effect를 돌려 방금 닫은 목록이 그대로 다시 열린다.
  const [picked, setPicked] = useState(false);
  const [occasion, setOccasion] = useState<Occasion | "">("");
  const [foodType, setFoodType] = useState<FoodType | "">("");
  const [cuisine, setCuisine] = useState<Cuisine | "">("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedCategoryCount = [occasion, foodType, cuisine].filter(Boolean).length;

  // 입력 중 카카오 키워드 검색을 미리 돌려 후보를 보여준다. 목록에서 고르면
  // 이름이 카카오 정식 명칭이 되므로 등록 시 재검색이 반드시 그 장소를 집는다 —
  // "검색되지 않는 장소" 에러가 나던 자리가 이 목록이다.
  useEffect(() => {
    const q = placeName.trim();
    if (picked || q.length < 2) {
      setSuggestions([]);
      return;
    }
    let stale = false;
    const timer = setTimeout(() => {
      fetch(`${AGENT_API_BASE}/api/search?q=${encodeURIComponent(q)}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((places: Place[]) => {
          // 디바운스가 타이머는 지워도 이미 떠난 요청은 못 지운다. 늦게 도착한
          // 옛 질의가 새 목록을 덮지 않게 이 회차가 낡았는지 본다.
          if (!stale) setSuggestions(places);
        })
        .catch(() => {
          if (!stale) setSuggestions([]);
        });
    }, 250);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [placeName, picked]);

  function pickSuggestion(place: Place) {
    setPlaceName(place.place_name);
    setPicked(true);
    setSuggestions([]);
  }

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
          price: price ? Number(price) : null,
        }),
      });
      if (!res.ok) throw new Error(`failed: ${res.status}`);
      const rec: Recommendation = await res.json();
      onAdded(rec);
      setPlaceName("");
      setOccasion("");
      setFoodType("");
      setCuisine("");
      setPrice("");
      setNote("");
      setCategoriesOpen(false);
    } catch {
      setError("등록에 실패했습니다. 장소명을 확인해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="recommendation-form">
      <div className="place-autocomplete">
        <input
          type="text"
          value={placeName}
          onChange={(e) => {
            setPlaceName(e.target.value);
            setPicked(false);
          }}
          // 목록 밖을 눌러도 닫히게 한다. 항목 클릭보다 blur가 먼저 오므로
          // 바로 지우면 클릭이 사라진 요소 위에서 죽는다 — 한 틱 늦춘다.
          onBlur={() => setTimeout(() => setSuggestions([]), 150)}
          placeholder="장소명"
        />
        {suggestions.length > 0 && (
          <ul className="place-suggestions">
            {suggestions.map((place) => (
              <li key={place.kakao_place_id}>
                <button type="button" onClick={() => pickSuggestion(place)}>
                  <strong>{place.place_name}</strong>
                  <small>{place.address}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        className="category-disclosure"
        aria-expanded={categoriesOpen}
        onClick={() => setCategoriesOpen((open) => !open)}
      >
        <span>
          분류 추가
          {selectedCategoryCount > 0 && <small>{selectedCategoryCount}개 선택</small>}
        </span>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {categoriesOpen && (
        <div className="category-selector-panel">
          <div className="category-selector-group">
            <span className="category-selector-label">
              상황
              <span
                className="info-icon"
                aria-label="상황 분류 기준 안내"
                title={
                  "점심장소: 메뉴 가격 13,000원 미만\n" +
                  "수고한 나에게: 메뉴 가격 13,000원 이상\n" +
                  "가격을 입력하면 자동으로 분류되고, 직접 선택하면 그 값이 우선합니다.\n" +
                  "회식장소는 가격 기준이 없어 직접 선택해야 합니다."
                }
              >
                ⓘ
              </span>
            </span>
            <div className="category-selector-column">
              <input
                type="number"
                className="category-price-input"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="메뉴 가격 (선택, 원)"
                min={0}
              />
              <div className="category-selector-options">
                {OCCASIONS.map((value) => (
                  <button
                    type="button"
                    key={value}
                    className={occasion === value ? "selected" : ""}
                    aria-pressed={occasion === value}
                    onClick={() => setOccasion(occasion === value ? "" : value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="category-selector-group">
            <span className="category-selector-label">음식 형태</span>
            <div className="category-selector-options">
              {FOOD_TYPES.map((value) => (
                <button
                  type="button"
                  key={value}
                  className={foodType === value ? "selected" : ""}
                  aria-pressed={foodType === value}
                  onClick={() => setFoodType(foodType === value ? "" : value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div className="category-selector-group">
            <span className="category-selector-label">요리 종류</span>
            <div className="category-selector-options">
              {CUISINES.map((value) => (
                <button
                  type="button"
                  key={value}
                  className={cuisine === value ? "selected" : ""}
                  aria-pressed={cuisine === value}
                  onClick={() => setCuisine(cuisine === value ? "" : value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="추천 이유 (선택)" />
      {error && <p className="visit-search-error">{error}</p>}
      <button className="recommendation-submit" onClick={submit} disabled={submitting || !placeName.trim()}>
        추천 등록
      </button>
    </div>
  );
}
