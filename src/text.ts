export function truncateLabelText(
  text: string,
  availableWidth: number,
  measure: (value: string) => number,
): string {
  if (!text || measure(text) <= availableWidth) return text;

  const glyphs = Array.from(text);
  const ellipsis = "…";
  let low = 0;
  let high = glyphs.length;

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = `${glyphs.slice(0, middle).join("").trimEnd()}${ellipsis}`;
    if (measure(candidate) <= availableWidth) low = middle;
    else high = middle - 1;
  }

  return `${glyphs.slice(0, low).join("").trimEnd()}${ellipsis}`;
}
