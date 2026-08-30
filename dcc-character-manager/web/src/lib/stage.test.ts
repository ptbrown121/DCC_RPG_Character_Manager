import { describe, expect, it } from "vitest";
import {
  aoeRadiusPx,
  clampZoom,
  fitTransform,
  mapToScreen,
  pan,
  penStrokeWidth,
  screenToMap,
  snapHalf,
  zoomAt,
  ZOOM_IN_LIMIT,
  ZOOM_OUT_LIMIT,
} from "./stage";

describe("fitTransform", () => {
  it("letterboxes a wide map in a square view", () => {
    const t = fitTransform(2000, 1000, 500, 500);
    expect(t.k).toBe(0.25); // width-bound
    expect(t.x).toBe(0);
    expect(t.y).toBe((500 - 1000 * 0.25) / 2); // vertically centered
  });

  it("scales small maps up to fill", () => {
    const t = fitTransform(100, 100, 400, 300);
    expect(t.k).toBe(3); // height-bound
    expect(t.x).toBe((400 - 300) / 2);
    expect(t.y).toBe(0);
  });

  it("degrades to identity on zero sizes", () => {
    expect(fitTransform(0, 100, 500, 500)).toEqual({ x: 0, y: 0, k: 1 });
  });
});

describe("zoomAt", () => {
  const fit = fitTransform(1000, 1000, 500, 500); // k = 0.5, centered

  it("keeps the map point under the cursor fixed", () => {
    const cursor: [number, number] = [120, 340];
    const before = screenToMap(fit, ...cursor);
    const after = screenToMap(zoomAt(fit, ...cursor, 1.7, fit.k), ...cursor);
    expect(after[0]).toBeCloseTo(before[0]);
    expect(after[1]).toBeCloseTo(before[1]);
  });

  it("clamps to the zoom limits relative to fit", () => {
    expect(zoomAt(fit, 0, 0, 1e9, fit.k).k).toBeCloseTo(fit.k * ZOOM_IN_LIMIT);
    expect(zoomAt(fit, 0, 0, 1e-9, fit.k).k).toBeCloseTo(fit.k * ZOOM_OUT_LIMIT);
    expect(clampZoom(fit.k, fit.k)).toBe(fit.k);
  });
});

describe("coordinate round-trips", () => {
  it("screenToMap inverts mapToScreen", () => {
    const t = { x: -37.5, y: 12, k: 1.75 };
    const [sx, sy] = mapToScreen(t, 640, 480);
    const [mx, my] = screenToMap(t, sx, sy);
    expect(mx).toBeCloseTo(640);
    expect(my).toBeCloseTo(480);
  });

  it("aoeRadiusPx converts feet through the grid calibration", () => {
    expect(aoeRadiusPx(20, 5, 100)).toBe(400); // 20 ft = 4 squares of 100 px
    expect(aoeRadiusPx(5, 5, 70)).toBe(70);
    expect(aoeRadiusPx(20, 0, 100)).toBe(0); // degenerate grid
  });

  it("penStrokeWidth scales with the grid within clamps", () => {
    expect(penStrokeWidth(100, false)).toBe(4);
    expect(penStrokeWidth(100, true)).toBe(10);
    expect(penStrokeWidth(10, false)).toBe(2); // floor
    expect(penStrokeWidth(500, false)).toBe(8); // ceiling
  });

  it("snapHalf snaps to half-square steps around the grid offset", () => {
    // 100px squares offset by 10 → half-square lattice at 10, 60, 110, …
    expect(snapHalf(112, 10, 100)).toBe(110);
    expect(snapHalf(140, 10, 100)).toBe(160);
    expect(snapHalf(10, 10, 100)).toBe(10);
    expect(snapHalf(-30, 10, 100)).toBe(-40);
    expect(snapHalf(123, 0, 0)).toBe(123); // degenerate grid: no snap
  });

  it("pan shifts screen positions, not map positions", () => {
    const t = { x: 10, y: 10, k: 2 };
    const moved = pan(t, 30, -15);
    expect(mapToScreen(moved, 5, 5)).toEqual([50, 5]);
    expect(moved.k).toBe(2);
  });
});
