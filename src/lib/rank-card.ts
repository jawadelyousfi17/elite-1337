import { campusName, type RankingDataset } from './dataset';
import { cohortRank, topPercent } from './ranking';

export type CardData = {
  login: string; level: number; campus: string; cohort: string | null;
  cohortRank: number | null; cohortSize: number; campusRank: number | null; campusSize: number; globalRank: number; globalSize: number;
  photo: string | null;
  status: 'frozen' | 'alumni' | null;
};
export type CardTheme = 'auto' | 'dark' | 'light';

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

const W = 840, H = 340, MONO = "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'DejaVu Sans Mono','Liberation Mono',monospace";
const PHOTO_X = 34, PHOTO_Y = 30, PHOTO = 280;
const TEXT_X = 366, COLS = 60, CHAR_W = 7.4, LINE = 22, TEXT_TOP = 46, TEXT_FONT = 12.3;

const DARK = '.bg{fill:#0d1117;stroke:#30363d}.panel{fill:#161b22}.ph{fill:#21262d}.ph2{fill:#30363d}.ring{fill:none;stroke:#30363d}.k{fill:#d2a8ff}.v{fill:#a5d6ff}.d{fill:#6e7681}.t{fill:#c9d1d9}.c{fill:#6e7681}.g{fill:#56d364}.z{fill:#79e2d9}.p{fill:#f0abfc}';
const LIGHT = '.bg{fill:#fff;stroke:#d0d7de}.panel{fill:#f6f8fa}.ph{fill:#e6eaef}.ph2{fill:#c5ccd4}.ring{fill:none;stroke:#d0d7de}.k{fill:#8250df}.v{fill:#0550ae}.d{fill:#8c959f}.t{fill:#24292f}.c{fill:#6e7781}.g{fill:#1a7f37}.z{fill:#0b7a75}.p{fill:#a626a4}';
const STYLE: Record<CardTheme, string> = { dark: DARK, light: LIGHT, auto: `${DARK}@media (prefers-color-scheme: light){${LIGHT}}` };

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

/** The student's photo as a rounded square; a neutral head-and-shoulders shape when there is none. */
function portrait(photo: string | null): string {
  const clip = `<clipPath id="pc"><rect x="${PHOTO_X}" y="${PHOTO_Y}" width="${PHOTO}" height="${PHOTO}" rx="16"/></clipPath>`;
  const body = photo
    ? `<image x="${PHOTO_X}" y="${PHOTO_Y}" width="${PHOTO}" height="${PHOTO}" preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,${photo}"/>`
    : `<rect class="ph" x="${PHOTO_X}" y="${PHOTO_Y}" width="${PHOTO}" height="${PHOTO}"/><circle class="ph2" cx="${PHOTO_X + 140}" cy="${PHOTO_Y + 108}" r="54"/><ellipse class="ph2" cx="${PHOTO_X + 140}" cy="${PHOTO_Y + 290}" rx="112" ry="100"/>`;
  return `<defs>${clip}</defs><g clip-path="url(#pc)">${body}</g><rect class="ring" x="${PHOTO_X + .5}" y="${PHOTO_Y + .5}" width="${PHOTO - 1}" height="${PHOTO - 1}" rx="16"/>`;
}

/**
 * A self-contained 840x340 SVG in a terminal style: the student's photo and a few key/value lines. The photo is embedded
 * as a small base64 JPEG (no external requests, scripts or fonts), so GitHub's image proxy shows it as is, and the card
 * follows the viewer's light or dark theme. `photo` is that JPEG in base64; without it a neutral silhouette is drawn.
 */
export function renderRankCard(data: CardData, theme: CardTheme = 'auto', photo: string | null = null): string {
  const text = lines(data).map((segments, index) => `<text x="${TEXT_X}" y="${TEXT_TOP + index * LINE}" textLength="${(segments.reduce((sum, [, part]) => sum + part.length, 0) * CHAR_W).toFixed(1)}" lengthAdjust="spacing" xml:space="preserve">${segments.map(([cls, part]) => `<tspan class="${cls}">${escape(part)}</tspan>`).join('')}</text>`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escape(`${data.login}: level ${data.level.toFixed(2)}, ${rank(data.cohortRank)} in cohort, ${data.campus}`)}" font-family="${MONO}">
<style>${STYLE[theme]}</style>
<rect class="bg" x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14"/>
<rect class="panel" x="14" y="14" width="${W - 28}" height="${H - 28}" rx="10"/>
${portrait(photo)}
<g font-size="${TEXT_FONT}">
${text}
</g>
</svg>`;
}

/** The card shown while the rankings are still loading, so a README never shows a broken image. */
export function renderPendingCard(theme: CardTheme = 'auto'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Rankings are updating" font-family="${MONO}"><style>${STYLE[theme]}</style><rect class="bg" x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14"/><rect class="panel" x="14" y="14" width="${W - 28}" height="${H - 28}" rx="10"/><text class="t" x="${W / 2}" y="164" text-anchor="middle" font-size="18">elite-1337</text><text class="c" x="${W / 2}" y="190" text-anchor="middle" font-size="13">// Rankings are updating, check back in a minute</text></svg>`;
}
