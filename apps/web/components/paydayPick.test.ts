import { describe, expect, it } from "vitest";
import { pickPaydayRecommendations } from "./paydayPick";
import type { Recommendation } from "./types";

function rec(overrides: Partial<Recommendation>): Recommendation {
  return {
    id: 0,
    kakao_place_id: "p",
    place_name: "테스트 식당",
    address: "",
    lat: 0,
    lng: 0,
    occasion: "수고한 나에게",
    food_type: null,
    cuisine: "한식",
    note: "",
    created_at: "",
    ...overrides,
  };
}

/** Deterministic stand-in for Math.random: cycles through fixed values. */
function fixedRandom(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("pickPaydayRecommendations", () => {
  it("returns nothing when there are no recommendations", () => {
    expect(pickPaydayRecommendations([])).toEqual([]);
  });

  it("ignores recommendations outside the '수고한 나에게' occasion", () => {
    const recs = [rec({ id: 1, occasion: "점심장소", cuisine: "한식" })];
    expect(pickPaydayRecommendations(recs)).toEqual([]);
  });

  it("ignores recommendations with no cuisine set", () => {
    const recs = [rec({ id: 1, cuisine: null })];
    expect(pickPaydayRecommendations(recs)).toEqual([]);
  });

  it("returns one pick per distinct cuisine when fewer than 3 are available", () => {
    const recs = [rec({ id: 1, cuisine: "한식" }), rec({ id: 2, cuisine: "일식" })];
    const picks = pickPaydayRecommendations(recs, fixedRandom([0, 0, 0]));
    expect(picks).toHaveLength(2);
    expect(new Set(picks.map((p) => p.cuisine))).toEqual(new Set(["한식", "일식"]));
  });

  it("caps at 3 picks when more than 3 cuisines are available", () => {
    const recs = [
      rec({ id: 1, cuisine: "한식" }),
      rec({ id: 2, cuisine: "일식" }),
      rec({ id: 3, cuisine: "중식" }),
      rec({ id: 4, cuisine: "양식" }),
    ];
    const picks = pickPaydayRecommendations(recs, fixedRandom([0, 0.5, 0.99, 0.1]));
    expect(picks).toHaveLength(3);
    expect(new Set(picks.map((p) => p.cuisine)).size).toBe(3);
  });

  it("only picks a place that actually matches its own cuisine", () => {
    const recs = [
      rec({ id: 1, cuisine: "한식", place_name: "A" }),
      rec({ id: 2, cuisine: "한식", place_name: "B" }),
    ];
    const picks = pickPaydayRecommendations(recs, fixedRandom([0, 1]));
    expect(picks).toHaveLength(1);
    expect(["A", "B"]).toContain(picks[0].place.place_name);
  });
});
