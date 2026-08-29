import { describe, expect, it } from "vitest";
import { ASSET_MAX_PX, scaleDimensions } from "./upload";

describe("scaleDimensions", () => {
  it("shrinks the longest edge to the cap, preserving aspect", () => {
    expect(scaleDimensions(4000, 3000, 2560)).toEqual({ width: 2560, height: 1920 });
    expect(scaleDimensions(3000, 4000, 2560)).toEqual({ width: 1920, height: 2560 });
  });

  it("never upscales", () => {
    expect(scaleDimensions(800, 600, 2560)).toEqual({ width: 800, height: 600 });
  });

  it("never collapses a dimension to zero on extreme aspect ratios", () => {
    expect(scaleDimensions(10000, 10, 512).height).toBeGreaterThanOrEqual(1);
  });

  it("caps tokens/items tighter than maps", () => {
    expect(ASSET_MAX_PX.token).toBeLessThan(ASSET_MAX_PX.map);
    expect(scaleDimensions(2048, 2048, ASSET_MAX_PX.token)).toEqual({ width: 512, height: 512 });
  });
});
