import { describe, expect, it } from "vitest";
import {
  cloneSeamBricksConfig,
  createSeamBricksPreset,
  DEFAULT_SEAM_BRICKS_OPTIONS,
  resolveSeamBricksConfig,
  resolveSeamBricksTheme,
  SEAM_BRICKS_FONT_FAMILY,
  SEAM_BRICKS_LENGTHS,
  SEAM_BRICKS_MATERIAL_PALETTES,
  SEAM_BRICKS_SCENE_THEMES,
} from "../src";
import {
  cubicBezier,
  SEAM_BRICKS_CLOSE_EASE,
} from "../src/easing";

describe("renderer contract", () => {
  it("keeps the reference prism dimensions and on-demand default", () => {
    expect(DEFAULT_SEAM_BRICKS_OPTIONS.mainWidth).toBe(6.89);
    expect(DEFAULT_SEAM_BRICKS_OPTIONS.yellowWidth).toBe(1.48);
    expect(DEFAULT_SEAM_BRICKS_OPTIONS.height).toBe(1.51);
    expect(DEFAULT_SEAM_BRICKS_OPTIONS.depth).toBe(1.48);
    expect(DEFAULT_SEAM_BRICKS_OPTIONS.continuous).toBe(false);
  });

  it("retains material gradients for every visible face", () => {
    expect(Object.keys(SEAM_BRICKS_MATERIAL_PALETTES)).toEqual([
      "blue",
      "yellow",
      "coral",
      "violet",
      "mint",
      "rose",
    ]);
    expect(SEAM_BRICKS_MATERIAL_PALETTES.blue.frontClosed).toHaveLength(4);
    expect(SEAM_BRICKS_MATERIAL_PALETTES.blue.bottom).toHaveLength(2);
    expect(SEAM_BRICKS_MATERIAL_PALETTES.yellow.frontOpen.at(-1)?.[1]).toBe(
      "#fff287",
    );
    expect(SEAM_BRICKS_MATERIAL_PALETTES.violet.glowIntensity).toBeGreaterThan(0);
    expect(SEAM_BRICKS_MATERIAL_PALETTES.mint.underLight).toBe("#10bda1");
  });

  it("resolves named and partial scene themes without mutating presets", () => {
    const custom = resolveSeamBricksTheme({ background: "#010203" });
    expect(custom.background).toBe("#010203");
    expect(custom.keyLight).toBe(SEAM_BRICKS_SCENE_THEMES.paper.keyLight);
    expect(SEAM_BRICKS_SCENE_THEMES.paper.background).toBe("#f0f0f0");
    expect(
      SEAM_BRICKS_SCENE_THEMES.nocturne.shadowOpacityMultiplier,
    ).toBeLessThan(
      SEAM_BRICKS_SCENE_THEMES.paper.shadowOpacityMultiplier,
    );
    expect(SEAM_BRICKS_SCENE_THEMES.nocturne.materialExposure).toBeLessThan(
      SEAM_BRICKS_SCENE_THEMES.paper.materialExposure,
    );
    expect(SEAM_BRICKS_SCENE_THEMES.nocturne.bloomMultiplier).toBeLessThan(
      SEAM_BRICKS_SCENE_THEMES.paper.bloomMultiplier,
    );
    expect(
      SEAM_BRICKS_SCENE_THEMES.nocturne.underLightIntensityMultiplier,
    ).toBeLessThan(
      SEAM_BRICKS_SCENE_THEMES.paper.underLightIntensityMultiplier,
    );
  });

  it("uses bounded cubic-bezier timing", () => {
    const easing = cubicBezier(0.25, 0.1, 0.25, 1);
    expect(easing(0)).toBe(0);
    expect(easing(1)).toBe(1);
    expect(easing(0.5)).toBeGreaterThan(0.5);

    const closeSamples = Array.from({ length: 101 }, (_, index) =>
      SEAM_BRICKS_CLOSE_EASE(index / 100),
    );
    expect(Math.min(...closeSamples)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...closeSamples)).toBeLessThanOrEqual(1);
  });

  it("normalises editable length tokens into a stable classic assembly", () => {
    const source = createSeamBricksPreset("classic", "Editable");
    const resolved = resolveSeamBricksConfig(source);
    expect(resolved.pieces).toHaveLength(2);
    expect(resolved.pieces[0]?.width).toBe(SEAM_BRICKS_LENGTHS.long);
    expect(resolved.pieces[1]?.width).toBe(SEAM_BRICKS_LENGTHS.short);
    expect(resolved.pieces[0]?.label?.text).toBe("Editable");
    expect(resolved.pieces[0]?.label?.fontFamily).toBe(SEAM_BRICKS_FONT_FAMILY);
    expect(resolved.pieces[0]?.open.x).toBeCloseTo(-0.1495, 4);
    expect(resolved.pieces[1]?.open.x).toBe(1.15);
  });

  it("keeps every built-in assembly flush while closed", () => {
    (["classic", "compact", "trio"] as const).forEach((preset) => {
      const resolved = resolveSeamBricksConfig(createSeamBricksPreset(preset));
      expect(resolved.gap).toBe(0);
    });
  });

  it("clones nested user configuration before imperative updates", () => {
    const source = createSeamBricksPreset("trio");
    const clone = cloneSeamBricksConfig(source);
    (clone.pieces[0] as { label?: string }).label = "Changed";
    expect(source.pieces[0]?.label).toBe("Seam");
    expect(resolveSeamBricksConfig(clone).pieces).toHaveLength(3);
  });

  it("assigns unique stable ids to reusable anonymous or duplicated pieces", () => {
    const resolved = resolveSeamBricksConfig({
      pieces: [
        { id: "brick", length: "long" },
        { id: "brick", length: "medium" },
        { length: "short" },
      ],
    });
    expect(resolved.pieces.map((piece) => piece.id)).toEqual([
      "brick",
      "brick-2",
      "piece-3",
    ]);
  });

  it("preserves arbitrary numeric brick widths without token snapping", () => {
    const resolved = resolveSeamBricksConfig({
      pieces: [{ id: "free-width", width: 5.15 }],
    });
    expect(resolved.pieces[0]?.width).toBe(5.15);
  });
});
