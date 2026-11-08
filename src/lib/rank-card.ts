import { campusName, type RankingDataset } from './dataset';
import { cohortRank, topPercent } from './ranking';
import { ART_COLS, ART_ROWS, RAMPS, artRows, silhouetteLuma } from './card-art';
import { ACCENT_COLORS, DEFAULT_STYLE, FONT_STACKS, type CardAccent, type CardArt, type CardFont, type CardTheme } from './card-style';

export type CardData = {
  login: string; level: number; campus: string; cohort: string | null;
  cohortRank: number | null; cohortSize: number; campusRank: number | null; campusSize: number; globalRank: number; globalSize: number;
  photo: string | null;
  status: 'frozen' | 'alumni' | null;
};

/** What the card shows for a student, read from the cached rankings; null when they are not ranked (or asked to be removed). */
export function cardData(dataset: RankingDataset, id: number): CardData | null {
  const student = dataset.students.find((entry) => entry.id === id && !entry.anonymous);
  if (!student) return null;
  const campusId = student.campusIds[0];
  const cohort = student.commonCoreCohort;
  return {
    login: student.login, level: student.level, campus: campusId ? campusName(dataset, campusId) : '1337', cohort,
    cohortRank: cohortRank(dataset.students, student, campusId),
    cohortSize: dataset.students.filter((other) => other.commonCoreCohort === cohort && (!campusId || other.campusIds.includes(campusId))).length,
    campusRank: campusId ? student.campusRanks[campusId] ?? null : null,
    campusSize: campusId ? dataset.students.filter((other) => other.campusIds.includes(campusId)).length : dataset.students.length,
    photo: student.photo ?? null,
    globalRank: student.globalRank, globalSize: dataset.students.length,
    status: student.alumni ? 'alumni' : student.frozen ? 'frozen' : null,
  };
}

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const rank = (value: number | null) => value ? `#${value}` : '—';

const W = 840, H = 320;
const ART_X = 22, CELL_W = 3.75, CELL_H = 7, ART_TOP = 20, ART_FONT = 6.25;
const TEXT_X = 356, COLS = 60, CHAR_W = 7.4, LINE = 22, TEXT_TOP = 40, TEXT_FONT = 12.3;

/** The 1337 logo (a square with the digits cut out), 2000 units wide; its path is stored upside down, so it is flipped when drawn. */
const LOGO_PATH = 'M0 1000 l0 -1000 1000 0 1000 0 0 1000 0 1000 -1000 0 -1000 0 0 -1000z m500 20 l0 -150 23 0 c29 0 37 -7 30 -26 -4 -10 -24 -14 -74 -14 -62 0 -69 2 -69 20 0 15 7 20 25 20 l25 0 0 130 0 130 -35 0 c-31 0 -35 -3 -35 -25 0 -16 -6 -25 -15 -25 -11 0 -15 12 -15 45 l0 45 70 0 70 0 0 -150z m430 -20 l0 -170 -100 0 c-93 0 -100 1 -100 20 0 18 7 20 80 20 l80 0 0 55 0 55 -75 0 c-68 0 -75 2 -75 20 0 17 8 19 73 22 l72 3 3 53 3 52 -80 0 c-74 0 -81 2 -81 20 0 19 7 20 100 20 l100 0 0 -170z m358 -2 l2 -168 -105 0 c-98 0 -105 1 -105 20 0 18 7 20 80 20 l80 0 0 55 0 54 -72 3 c-60 2 -73 6 -76 21 -3 15 6 17 72 17 l76 0 0 55 0 55 -80 0 c-74 0 -80 2 -80 20 0 20 5 21 103 18 l102 -3 3 -167z m352 2 c0 -163 -1 -170 -20 -170 -19 0 -20 7 -20 150 l0 150 -65 0 -65 0 0 -40 c0 -33 -3 -40 -20 -40 -18 0 -20 7 -20 60 l0 60 105 0 105 0 0 -170z';

type Mode = 'dark' | 'light';
const SURFACES: Record<Exclude<CardTheme, 'auto'>, { mode: Mode; bg: string; border: string }> = {
  dark: { mode: 'dark', bg: '#161b22', border: '#30363d' }, black: { mode: 'dark', bg: '#000', border: '#2a2a2a' },
  midnight: { mode: 'dark', bg: '#0f172a', border: '#26324d' }, forest: { mode: 'dark', bg: '#0f1d17', border: '#25382e' },
  plum: { mode: 'dark', bg: '#1c1222', border: '#3a2845' }, light: { mode: 'light', bg: '#fff', border: '#d0d7de' },
};
const INK: Record<Mode, string> = {
  dark: '.lg{fill:#c9d1d9}.art{fill:#c9d1d9}.v{fill:#a5d6ff}.d{fill:#6e7681}.t{fill:#c9d1d9}.c{fill:#6e7681}.g{fill:#56d364}.z{fill:#79e2d9}.p{fill:#f0abfc}',
  light: '.lg{fill:#24292f}.art{fill:#24292f}.v{fill:#0550ae}.d{fill:#8c959f}.t{fill:#24292f}.c{fill:#6e7781}.g{fill:#1a7f37}.z{fill:#0b7a75}.p{fill:#a626a4}',
};
const colors = (surface: { mode: Mode; bg: string; border: string }, accent: CardAccent) => `.bg{fill:${surface.bg};stroke:${surface.border}}${INK[surface.mode]}.k{fill:${ACCENT_COLORS[accent][surface.mode]}}`;

/** The card's CSS for a theme. `auto` is the dark look with the light one swapped in by the viewer's own theme. */
function styleSheet(theme: CardTheme, accent: CardAccent): string {
  if (theme === 'auto') return `${colors(SURFACES.dark, accent)}.art-l{display:none}@media (prefers-color-scheme: light){${colors(SURFACES.light, accent)}.art-d{display:none}.art-l{display:inline}}`;
  const surface = SURFACES[theme];
  return `${colors(surface, accent)}${surface.mode === 'dark' ? '.art-l' : '.art-d'}{display:none}`;
}

type Segment = [cls: string, text: string];
const rule = (title: string): Segment[] => [['t', `- ${title} `], ['d', '─'.repeat(COLS - title.length - 3)]];
function pair(key: string, value: string, valueClass = 'v'): Segment[] {
  const room = COLS - key.length - 7;
  const shown = value.length > room ? `${value.slice(0, room - 1)}…` : value;
  return [['d', '. '], ['k', key], ['t', ': '], ['d', `${'.'.repeat(Math.max(2, COLS - key.length - 5 - shown.length))} `], [valueClass, shown]];
}
const ofTotal = (value: number | null, total: number) => value ? `#${value} of ${total}${total ? ` · top ${topPercent(value, total)}%` : ''}` : '—';

function lines(data: CardData): Segment[][] {
  const status: [string, string] = data.status === 'frozen' ? ['Frozen', 'z'] : data.status === 'alumni' ? ['Alumni', 'p'] : ['Active', 'g'];
  const filled = Math.max(0, Math.min(12, Math.round(data.level / 21 * 12)));
  const head = `${data.login}@elite-1337 `;
  return [
    [['t', head], ['d', '─'.repeat(Math.max(3, COLS - head.length - 3))], ['d', '.-—']],
    pair('Status', status[0], status[1]),
    pair('Campus', data.campus),
    pair('Cohort', data.cohort ?? '—'),
    pair('Level', `${data.level.toFixed(2)}  ${'█'.repeat(filled)}${'░'.repeat(12 - filled)}`),
    rule('Ranking'),
    pair('In cohort', ofTotal(data.cohortRank, data.cohortSize)),
    pair('In campus', ofTotal(data.campusRank, data.campusSize)),
    pair('All 1337', ofTotal(data.globalRank, data.globalSize)),
    [['d', '─'.repeat(COLS - 3)], ['d', '.-—']],
    [['c', '// Live from the elite-1337.app leaderboard']],
    [['c', '// Every rank earned by shipping projects']],
  ];
}

const artGroup = (luma: Uint8Array, mode: Mode, ramp: string) => `<g class="art-${mode === 'dark' ? 'd' : 'l'}" font-size="${ART_FONT}" font-weight="700">${artRows(luma, mode, ramp).map((row, index) => row && `<text class="art" x="${ART_X}" y="${(ART_TOP + (index + 1) * CELL_H - 1.2).toFixed(1)}" textLength="${row.length * CELL_W}" lengthAdjust="spacing" xml:space="preserve">${row}</text>`).join('')}</g>`;

export type CardOptions = { accent?: CardAccent; font?: CardFont; art?: CardArt; logo?: boolean };

/**
 * A self-contained 840x320 SVG in a terminal style: a text portrait of the student and a few key/value lines. It has no
 * fonts, scripts or images, so GitHub's image proxy shows it as is, and it follows the viewer's light or dark theme (or a theme the student picked).
 * `luma` is the photo as ART_COLS x ART_ROWS grayscale bytes; without it a neutral silhouette is drawn.
 */
export function renderRankCard(data: CardData, theme: CardTheme = 'auto', luma: Uint8Array | null = null, options: CardOptions = {}): string {
  const { accent, font, art: artStyle, logo } = { ...DEFAULT_STYLE, ...options };
  const ramp = RAMPS[artStyle];
  const modes: Mode[] = theme === 'auto' ? ['dark', 'light'] : [SURFACES[theme].mode];
  const picture = luma && luma.length === ART_COLS * ART_ROWS ? luma : silhouetteLuma();
  const art = modes.map((mode) => artGroup(picture, mode, ramp)).join('');
  const text = lines(data).map((segments, index) => `<text x="${TEXT_X}" y="${TEXT_TOP + index * LINE}" textLength="${(segments.reduce((sum, [, part]) => sum + part.length, 0) * CHAR_W).toFixed(1)}" lengthAdjust="spacing" xml:space="preserve">${segments.map(([cls, part]) => `<tspan class="${cls}">${escape(part)}</tspan>`).join('')}</text>`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escape(`${data.login}: level ${data.level.toFixed(2)}, ${rank(data.cohortRank)} in cohort, ${data.campus}`)}" font-family="${FONT_STACKS[font]}">
<style>${styleSheet(theme, accent)}</style>
<rect class="bg" x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="10"/>
${art}
<g font-size="${TEXT_FONT}">
${text}
</g>
${logo ? `<g transform="translate(778 260) scale(.02)"><path class="lg" transform="translate(0 2000) scale(1 -1)" d="${LOGO_PATH}"/></g>` : ''}
</svg>`;
}

/** The card shown while the rankings are still loading, so a README never shows a broken image. */
export function renderPendingCard(theme: CardTheme = 'auto', font: CardFont = 'system'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Rankings are updating" font-family="${FONT_STACKS[font]}"><style>${styleSheet(theme, DEFAULT_STYLE.accent)}</style><rect class="bg" x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="10"/><text class="t" x="${W / 2}" y="154" text-anchor="middle" font-size="18">elite-1337</text><text class="c" x="${W / 2}" y="180" text-anchor="middle" font-size="13">// Rankings are updating, check back in a minute</text></svg>`;
}
