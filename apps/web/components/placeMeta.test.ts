import { describe, expect, it } from "vitest";
import { categoryBadge, formatDistance, haversineMeters } from "./placeMeta";

const CITY_HALL = { lat: 37.5665, lng: 126.978 };
const GANGNAM_STN = { lat: 37.4979, lng: 127.0276 };

describe("haversineMeters", () => {
  it("서울시청 ↔ 강남역은 약 8.8km", () => {
    // 정확값 대신 범위 — 지구 반지름 상수나 공식 변형에 깨지지 않게.
    const d = haversineMeters(CITY_HALL, GANGNAM_STN);
    expect(d).toBeGreaterThan(8500);
    expect(d).toBeLessThan(9100);
  });

  it("같은 좌표는 0", () => {
    expect(haversineMeters(CITY_HALL, CITY_HALL)).toBe(0);
  });

  it("방향이 바뀌어도 같은 값", () => {
    expect(haversineMeters(CITY_HALL, GANGNAM_STN)).toBeCloseTo(
      haversineMeters(GANGNAM_STN, CITY_HALL),
      6
    );
  });
});

describe("formatDistance", () => {
  it("1km 미만은 미터, 정수로", () => {
    expect(formatDistance(340.7)).toBe("341m");
  });

  it("1km 이상은 소수 한 자리 km", () => {
    expect(formatDistance(8793)).toBe("8.8km");
  });
});

describe("categoryBadge", () => {
  it("첫 토막(대분류)을 떼고 › 로 잇는다", () => {
    expect(categoryBadge("음식점 > 한식 > 국밥")).toBe("한식 › 국밥");
  });

  it("카페 같은 다른 대분류도 똑같이 뗀다", () => {
    expect(categoryBadge("음식점 > 카페 > 커피전문점 > 스타벅스")).toBe(
      "카페 › 커피전문점 › 스타벅스"
    );
  });

  it("토막이 하나뿐이면 떼지 않는다", () => {
    expect(categoryBadge("음식점")).toBe("음식점");
  });

  it("빈 값·없는 값은 빈 문자열", () => {
    expect(categoryBadge("")).toBe("");
    expect(categoryBadge(undefined)).toBe("");
    expect(categoryBadge(null)).toBe("");
  });
});
