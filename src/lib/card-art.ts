/** Pure helpers that turn a grayscale portrait into the text art on the rank card. */
export const ART_COLS = 60;
export const ART_ROWS = 30;
export type ArtTheme = 'dark' | 'light';
const RAMP = ' ░▒▓█';

/**
 * One string per row. On a dark card bright pixels get the densest glyphs (light ink on dark), on a light card dark
 * pixels do, so the face reads the right way round in both themes. Trailing blanks are cut; rows are aligned by x.
 */
export function artRows(luma: Uint8Array, theme: ArtTheme, cols = ART_COLS, rows = ART_ROWS): string[] {
  const out: string[] = [];
  for (let row = 0; row < rows; row++) {
    let line = '';
    for (let col = 0; col < cols; col++) {
      const value = (luma[row * cols + col] ?? 0) / 255;
      line += RAMP[Math.round((theme === 'dark' ? value : 1 - value) * (RAMP.length - 1))];
    }
    out.push(line.trimEnd());
  }
  return out;
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
