// GitHub-contributions green palette, dark theme.
// Level 0 = no activity. Levels 1-4 grow in intensity.
export const HEATMAP_COLORS = [
  '#161b22', // 0 - empty cell
  '#0e4429',
  '#006d32',
  '#26a641',
  '#39d353',
];

export type Thresholds = [number, number, number, number];

// Pick thresholds from non-zero daily values using quantiles, so the scale
// adapts to each user's training volume.
export function thresholdsFromValues(values: number[]): Thresholds {
  const nonZero = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) return [0, 0, 0, 0];
  const q = (p: number): number => {
    const idx = Math.min(nonZero.length - 1, Math.floor(p * nonZero.length));
    return nonZero[idx];
  };
  return [q(0.2), q(0.4), q(0.6), q(0.8)];
}

export function colorForValue(value: number, thresholds: Thresholds): string {
  if (value <= 0) return HEATMAP_COLORS[0];
  if (value < thresholds[0]) return HEATMAP_COLORS[1];
  if (value < thresholds[1]) return HEATMAP_COLORS[2];
  if (value < thresholds[2]) return HEATMAP_COLORS[3];
  return HEATMAP_COLORS[4];
}

export function levelForValue(value: number, thresholds: Thresholds): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0) return 0;
  if (value < thresholds[0]) return 1;
  if (value < thresholds[1]) return 2;
  if (value < thresholds[2]) return 3;
  return 4;
}
