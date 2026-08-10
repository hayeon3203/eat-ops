import type { Cuisine, Recommendation } from "./types";

export interface PaydayPick {
  cuisine: Cuisine;
  place: Recommendation;
}

const PAYDAY_OCCASION = "수고한 나에게";
const MAX_PICKS = 3;

/** Pure so it's testable without a DOM/network — see paydayPick.test.ts. */
export function pickPaydayRecommendations(
  recommendations: Recommendation[],
  randomFn: () => number = Math.random
): PaydayPick[] {
  const byCuisine = new Map<Cuisine, Recommendation[]>();
  for (const r of recommendations) {
    if (r.occasion !== PAYDAY_OCCASION || !r.cuisine) continue;
    const list = byCuisine.get(r.cuisine) ?? [];
    list.push(r);
    byCuisine.set(r.cuisine, list);
  }

  const cuisines = shuffle([...byCuisine.keys()], randomFn).slice(0, MAX_PICKS);
  return cuisines.map((cuisine) => {
    const places = byCuisine.get(cuisine)!;
    return { cuisine, place: places[Math.floor(randomFn() * places.length)] };
  });
}

function shuffle<T>(items: T[], randomFn: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
