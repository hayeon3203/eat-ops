import { describe, expect, it } from "vitest";
import { METERS_PER_DEG_LAT, rectangleCorners } from "./branchOffices";
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

// 위경도 차이를 대략적인 미터로 되돌려 거리를 비교하기 위한 헬퍼. METERS_PER_DEG_LAT는
// branchOffices.ts에서 가져온다 — 여기서 재정의하면 그 상수가 나중에 바뀔 때 테스트가
// 조용히 드리프트한다.
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

  // 90도는 쓰지 않는다 — 사각형은 축 반전에 대해 대칭이라, 90도에서는 시계/반시계
  // 두 공식이 같은 꼭짓점 집합으로 수렴해 부호가 뒤집혀도 이 테스트가 못 잡는다.
  // 45도는 그 대칭이 전혀 없어 방향을 확실히 가른다.
  it("rotation 45deg matches hand-computed corner positions, in order (pins the clockwise sign)", () => {
    const o = office({ widthM: 40, heightM: 30, rotationDeg: 45 });
    const corners = rectangleCorners(o);
    const meters = corners.map((c) => toMeters(o, c));

    // 손으로 미리 계산한 값 — rectangleCorners와 같은 삼각함수 코드를 다시 돌려서
    // 얻은 게 아니다. 이게 같으면 구현이 스스로를 증명하는 순환 검증이 되어버린다.
    //
    // 회전 전 로컬 꼭짓점(x=동, y=북, 중심 기준): halfW=20, halfH=15
    //   좌상단(NW)=(-20,15) 우상단(NE)=(20,15) 우하단(SE)=(20,-15) 좌하단(SW)=(-20,-15)
    // 시계방향 회전 45도: cos45=sin45=0.7071067811865476
    //   x' = x·cos45 + y·sin45,  y' = -x·sin45 + y·cos45
    // NW: x'=(-20+15)·cos45=-5·cos45=-3.535533905932738   y'=(20+15)·cos45=35·cos45=24.748737341529166
    // NE: x'=(20+15)·cos45=35·cos45=24.748737341529166    y'=(-20+15)·cos45=-5·cos45=-3.535533905932738
    // SE: x'=(20-15)·cos45=5·cos45=3.535533905932738      y'=(-20-15)·cos45=-35·cos45=-24.748737341529166
    // SW: x'=(-20-15)·cos45=-35·cos45=-24.748737341529166 y'=(20-15)·cos45=5·cos45=3.535533905932738
    //
    // 검산: 부호가 반시계(x'=x·cos-y·sin, y'=x·sin+y·cos)였다면 NW는 (-24.75,-3.54)가 되어
    // 아래 기대값과 21m 이상 어긋난다 — 그 경우 이 테스트는 실패한다.
    const expected = [
      { dx: -3.535533905932738, dy: 24.748737341529166 }, // NW
      { dx: 24.748737341529166, dy: -3.535533905932738 }, // NE
      { dx: 3.535533905932738, dy: -24.748737341529166 }, // SE
      { dx: -24.748737341529166, dy: 3.535533905932738 }, // SW
    ];

    expect(meters).toHaveLength(expected.length);
    meters.forEach((m, i) => {
      expect(m.dx).toBeCloseTo(expected[i].dx, 3);
      expect(m.dy).toBeCloseTo(expected[i].dy, 3);
    });

    // 부가 확인: 신발끈 공식(shoelace)의 부호는 감김 방향을 나타낸다 — 이 좌표계
    // (x=동, y=북)에서 음수면 시계방향이다. 회전 부호가 뒤집히거나 꼭짓점 감김
    // 순서가 바뀌는 회귀 둘 다 이 부호를 뒤집으므로 잡아낸다. 넓이는 40m×30m=1200㎡로
    // 회전으로 바뀌지 않는다.
    let signedArea = 0;
    for (let i = 0; i < meters.length; i++) {
      const a = meters[i];
      const b = meters[(i + 1) % meters.length];
      signedArea += a.dx * b.dy - b.dx * a.dy;
    }
    signedArea /= 2;
    expect(signedArea).toBeLessThan(0);
    expect(signedArea).toBeCloseTo(-1200, 1);
  });
});
