import { describe, expect, it } from "vitest";
import { METERS_PER_DEG_LAT, metersToLatLngDelta } from "./branchOffices";

describe("metersToLatLngDelta", () => {
  it("equator, 111,320m east: dLng close to 1 degree, dLat is 0", () => {
    const { dLat, dLng } = metersToLatLngDelta(0, METERS_PER_DEG_LAT, 0);
    expect(dLng).toBeCloseTo(1, 6);
    expect(dLat).toBe(0);
  });

  it("111,320m north: dLat close to 1 degree, dLng is 0", () => {
    const { dLat, dLng } = metersToLatLngDelta(0, 0, METERS_PER_DEG_LAT);
    expect(dLat).toBeCloseTo(1, 6);
    expect(dLng).toBe(0);
  });

  it("higher latitude gives a larger dLng for the same eastward distance (monotonic 0 < 37 < 60)", () => {
    const eastM = 1000;
    const dLngAt = (lat: number) => metersToLatLngDelta(lat, eastM, 0).dLng;
    const at0 = dLngAt(0);
    const at37 = dLngAt(37);
    const at60 = dLngAt(60);
    expect(at37).toBeGreaterThan(at0);
    expect(at60).toBeGreaterThan(at37);
  });

  it("0m input yields both deltas 0", () => {
    const { dLat, dLng } = metersToLatLngDelta(37.5, 0, 0);
    expect(dLat).toBe(0);
    expect(dLng).toBe(0);
  });
});
