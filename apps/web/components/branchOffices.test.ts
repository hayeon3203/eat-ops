import { describe, expect, it } from "vitest";
import { rectangleCorners } from "./branchOffices";
import type { BranchOffice } from "./branchOffices";

function office(overrides: Partial<BranchOffice>): BranchOffice {
  return {
    name: "테스트지사",
    lat: 37.5,
    lng: 127.0,
    widthM: 40,
    heightM: 30,
    rotationDeg: 0,
    ...overrides,
  };
}

// 위경도 차이를 대략적인 미터로 되돌려 거리를 비교하기 위한 헬퍼.
// branchOffices.ts의 환산 상수와 같은 근사(111,320m/도)를 그대로 쓴다.
const METERS_PER_DEG_LAT = 111_320;
function metersPerDegLng(lat: number) {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

function toMeters(center: { lat: number; lng: number }, corner: { lat: number; lng: number }) {
  const dLat = (corner.lat - center.lat) * METERS_PER_DEG_LAT;
  const dLng = (corner.lng - center.lng) * metersPerDegLng(center.lat);
  return { dx: dLng, dy: dLat };
}

describe("rectangleCorners", () => {
  it("returns 4 finite corners", () => {
    const corners = rectangleCorners(office({}));
    expect(corners).toHaveLength(4);
    for (const c of corners) {
      expect(Number.isFinite(c.lat)).toBe(true);
      expect(Number.isFinite(c.lng)).toBe(true);
    }
  });

  it("square, rotation 0: all four corners are equidistant from the center", () => {
    const o = office({ widthM: 40, heightM: 40, rotationDeg: 0 });
    const corners = rectangleCorners(o);
    const dists = corners.map((c) => {
      const { dx, dy } = toMeters(o, c);
      return Math.hypot(dx, dy);
    });
    const expected = (40 / 2) * Math.SQRT2;
    for (const d of dists) {
      expect(d).toBeCloseTo(expected, 0);
    }
  });

  it("width 100m, height 0m, rotation 0: spreads east-west only, ~no latitude difference", () => {
    const o = office({ widthM: 100, heightM: 0, rotationDeg: 0 });
    const corners = rectangleCorners(o);
    for (const c of corners) {
      const { dx, dy } = toMeters(o, c);
      expect(Math.abs(dy)).toBeLessThan(0.01);
      expect(Math.abs(dx)).toBeCloseTo(50, 0);
    }
    // 실제로 동서로 벌어져 있어야 한다 (전부 중심에 붙어있는 퇴화 케이스가 아님).
    const lngs = new Set(corners.map((c) => c.lng.toFixed(8)));
    expect(lngs.size).toBeGreaterThan(1);
  });

  it("rotation 90deg is the same rectangle as rotation 0deg with width/height swapped (clockwise convention)", () => {
    const rotated = office({ widthM: 40, heightM: 30, rotationDeg: 90 });
    const swapped = office({ widthM: 30, heightM: 40, rotationDeg: 0 });

    const rotatedMeters = rectangleCorners(rotated).map((c) => toMeters(rotated, c));
    const swappedMeters = rectangleCorners(swapped).map((c) => toMeters(swapped, c));

    // 두 꼭짓점 집합이 (순서 무관하게) 같아야 한다 — 시계방향 90도 회전은
    // 폭/길이를 맞바꾼 축정렬 사각형과 같은 도형이 되어야 하기 때문.
    const sortKey = (p: { dx: number; dy: number }) => Math.round(p.dx) + "," + Math.round(p.dy);
    const rotatedSorted = rotatedMeters.map(sortKey).sort();
    const swappedSorted = swappedMeters.map(sortKey).sort();
    expect(rotatedSorted).toEqual(swappedSorted);
  });
});
