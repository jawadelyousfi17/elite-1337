/** Pure helpers that turn a grayscale portrait into the ASCII art on the rank card. */
export const ART_COLS = 80;
export const ART_ROWS = 40;
export type ArtTheme = 'dark' | 'light';
/** Characters from lightest to densest. Plain ASCII looks the same in every font; blocks are denser but depend on the font. */
export const RAMPS = { ascii: ' .:-=+*#%@', blocks: ' ░▒▓█' } as const;
const RAMP = RAMPS.ascii;

/**
 * One string per row. On a dark card bright pixels get the densest characters (light ink on dark), on a light card dark
 * pixels do, so the face reads the right way round in both themes. Trailing blanks are cut; rows are aligned by x.
 */
export function artRows(luma: Uint8Array, theme: ArtTheme, ramp: string = RAMP, cols = ART_COLS, rows = ART_ROWS): string[] {
  const out: string[] = [];
  for (let row = 0; row < rows; row++) {
    let line = '';
    for (let col = 0; col < cols; col++) {
      const value = (luma[row * cols + col] ?? 0) / 255;
      line += ramp[Math.round((theme === 'dark' ? value : 1 - value) * (ramp.length - 1))];
    }
    out.push(line.trimEnd());
  }
  return out;
}

/**
 * Averages the centre square of an RGBA image into a cols x rows grid of gray values, then stretches the contrast (2nd to
 * 98th percentile). Cells are about twice as tall as wide, so the square is squeezed into the grid on purpose.
 */
export function lumaFromRgba(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, cols = ART_COLS, rows = ART_ROWS): Uint8Array {
  const side = Math.min(width, height), left = Math.floor((width - side) / 2), top = Math.floor((height - side) / 2);
  const gray = new Float64Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    const y0 = Math.floor(row * side / rows), y1 = Math.max(y0 + 1, Math.floor((row + 1) * side / rows));
    for (let col = 0; col < cols; col++) {
      // Every cell covers at least one source pixel, even when the image is smaller than the grid.
      const x0 = Math.floor(col * side / cols), x1 = Math.max(x0 + 1, Math.floor((col + 1) * side / cols));
      let sum = 0, count = 0;
      for (let y = y0; y < y1 && y < side; y++) for (let x = x0; x < x1 && x < side; x++) {
        const i = ((top + y) * width + left + x) * 4, alpha = rgba[i + 3] / 255;
        // Transparent pixels count as the card's dark background.
        sum += (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) * alpha + 22 * (1 - alpha);
        count++;
      }
      gray[row * cols + col] = count ? sum / count : 22;
    }
  }
  const sorted = [...gray].sort((a, b) => a - b);
  const low = sorted[Math.floor(sorted.length * 0.02)], high = sorted[Math.floor(sorted.length * 0.98)], span = Math.max(1, high - low);
  return Uint8Array.from(gray, (value) => Math.max(0, Math.min(255, Math.round((value - low) / span * 255))));
}

/** A neutral head-and-shoulders shape for students without a usable photo. */
export function silhouetteLuma(cols = ART_COLS, rows = ART_ROWS): Uint8Array {
  const luma = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const x = ((col + 0.5) / cols) * 2 - 1, y = ((row + 0.5) / rows) * 2 - 1;
    const head = (x / 0.36) ** 2 + ((y + 0.32) / 0.42) ** 2 <= 1;
    const neck = Math.abs(x) < 0.14 && y > 0.05 && y < 0.35;
    const shoulders = (x / 0.92) ** 2 + ((y - 1.02) / 0.78) ** 2 <= 1;
    luma[row * cols + col] = head || neck || shoulders ? 200 - Math.round(Math.abs(x) * 70) : 26;
  }
  return luma;
}
