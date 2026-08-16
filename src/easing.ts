function calcBezier(t: number, a1: number, a2: number): number {
  return (
    ((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t * t +
    3 * a1 * t
  );
}

function getSlope(t: number, a1: number, a2: number): number {
  return (
    3 * (1 - 3 * a2 + 3 * a1) * t * t +
    2 * (3 * a2 - 6 * a1) * t +
    3 * a1
  );
}

export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (value: number) => number {
  return (value) => {
    if (value === 0 || value === 1) return value;

    let guess = value;
    for (let index = 0; index < 6; index += 1) {
      const slope = getSlope(guess, x1, x2);
      if (Math.abs(slope) < 0.0001) break;
      guess -= (calcBezier(guess, x1, x2) - value) / slope;
    }

    return calcBezier(Math.min(1, Math.max(0, guess)), y1, y2);
  };
}

export const SEAM_BRICKS_OPEN_EASE = cubicBezier(0.25, 0.1, 0.25, 1);
export const SEAM_BRICKS_CLOSE_EASE = cubicBezier(0.33, 1, 0.68, 1);
