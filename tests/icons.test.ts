import { describe, expect, it } from "vitest";
import {
  createSeamBricksPreset,
  resolveSeamBricksConfig,
  SEAM_BRICKS_ICON_NAMES,
  SEAM_BRICKS_ICON_PIXELS,
} from "../src";

describe("built-in pixel icons", () => {
  it("ships ten compact geometric icons", () => {
    expect(SEAM_BRICKS_ICON_NAMES).toHaveLength(10);
    for (const name of SEAM_BRICKS_ICON_NAMES) {
      const pixels = SEAM_BRICKS_ICON_PIXELS[name];
      expect(pixels.length).toBeGreaterThanOrEqual(5);
      expect(new Set(pixels.map(([x, y]) => `${x}:${y}`)).size).toBe(
        pixels.length,
      );
    }
  });

  it("resolves every built-in name to its own pixel geometry", () => {
    for (const name of SEAM_BRICKS_ICON_NAMES) {
      const resolved = resolveSeamBricksConfig({
        pieces: [{ id: name, icon: name }],
      });
      expect(resolved.pieces[0]?.icon?.name).toBe(name);
      expect(resolved.pieces[0]?.icon?.pixels).toEqual(
        SEAM_BRICKS_ICON_PIXELS[name],
      );
    }
  });

  it("starts the classic preset with Mint and Azure", () => {
    expect(createSeamBricksPreset("classic").pieces.map(({ palette }) => palette)).toEqual([
      "mint",
      "blue",
    ]);
  });
});
