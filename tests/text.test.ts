import { describe, expect, it } from "vitest";
import { truncateLabelText } from "../src/text";

const measure = (value: string) => Array.from(value).length * 10;

describe("truncateLabelText", () => {
  it("keeps labels that already fit", () => {
    expect(truncateLabelText("Seam", 40, measure)).toBe("Seam");
  });

  it("uses an ellipsis without shrinking the requested type size", () => {
    expect(truncateLabelText("Seam Bricks", 50, measure)).toBe("Seam…");
  });

  it("does not split a Unicode glyph", () => {
    expect(truncateLabelText("A😀BC", 30, measure)).toBe("A😀…");
  });

  it("does not leave whitespace before the ellipsis", () => {
    expect(truncateLabelText("Seam Bricks", 60, measure)).toBe("Seam…");
  });
});
