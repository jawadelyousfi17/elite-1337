import { campusName, type RankingDataset } from './dataset';
import { cohortRank } from './ranking';

export type CardData = {
  login: string; level: number; campus: string; cohort: string | null;
  cohortRank: number | null; cohortSize: number; campusRank: number | null; globalRank: number; globalSize: number;
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
    globalRank: student.globalRank, globalSize: dataset.students.length,
    status: student.alumni ? 'alumni' : student.frozen ? 'frozen' : null,
  };
}

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const rank = (value: number | null) => value ? `#${value}` : '—';
const DARK = '.bg{fill:#141414}.avatar{fill:#202020}.t{fill:#f9f9f9}.m{fill:#8a8a8a}.a{fill:#cafbd2}.line{stroke:#2b2b2b}';
const LIGHT = '.bg{fill:#fff;stroke:#e4e4e4}.avatar{fill:#eef3ef}.t{fill:#161616}.m{fill:#6b6b6b}.a{fill:#0f7b48}.line{stroke:#ececec}';
const STYLE: Record<CardTheme, string> = { dark: DARK, light: LIGHT, auto: `${DARK}@media (prefers-color-scheme: light){${LIGHT}}` };

/** A self-contained 495x150 SVG (no fonts, scripts or images, so GitHub's image proxy shows it as is). Light and dark follow the viewer's theme. */
export function renderRankCard(data: CardData, theme: CardTheme = 'auto'): string {
  const initials = escape(Array.from(data.login.toUpperCase()).slice(0, 2).join(''));
  const place = [data.campus, data.cohort ? `Cohort ${data.cohort}` : null].filter(Boolean).join(' · ');
  const badge = data.status ? `<rect x="88" y="80" width="${data.status === 'frozen' ? 62 : 56}" height="18" rx="9" fill="${data.status === 'frozen' ? '#bff3f0' : '#edc5f9'}"/><text x="${data.status === 'frozen' ? 119 : 116}" y="93" text-anchor="middle" font-size="10" font-weight="700" fill="#161616" letter-spacing=".5">${data.status === 'frozen' ? 'FROZEN' : 'ALUMNI'}</text>` : '';
  const stat = (x: number, label: string, value: string) => `<text x="${x}" y="120" class="m" font-size="10" font-weight="600" letter-spacing=".8">${label}</text><text x="${x}" y="140" class="t" font-size="17" font-weight="700">${escape(value)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="160" viewBox="0 0 495 160" role="img" aria-label="${escape(`${data.login}: level ${data.level.toFixed(2)}, ${rank(data.cohortRank)} in cohort`)}" font-family="-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
<style>${STYLE[theme]}</style>
<rect class="bg" x=".5" y=".5" width="494" height="159" rx="18"/>
<circle class="avatar" cx="46" cy="50" r="26"/><text class="a" x="46" y="57" text-anchor="middle" font-size="18" font-weight="700">${initials}</text>
<text class="t" x="88" y="46" font-size="21" font-weight="700">${escape(data.login)}</text>
<text class="m" x="88" y="66" font-size="12.5">${escape(place)}</text>
${badge}
<text class="a" x="467" y="58" text-anchor="end" font-size="42" font-weight="800">${rank(data.cohortRank)}</text>
<text class="m" x="467" y="78" text-anchor="end" font-size="11">${data.cohortRank && data.cohortSize ? `in cohort · of ${data.cohortSize}` : 'in cohort'}</text>
<line class="line" x1="28" y1="104" x2="467" y2="104" stroke-width="1"/>
${stat(28, 'LEVEL', data.level.toFixed(2))}${stat(140, 'CAMPUS', rank(data.campusRank))}${stat(250, 'ALL 1337', rank(data.globalRank))}
<text class="m" x="467" y="140" text-anchor="end" font-size="10">elite-1337.app</text>
</svg>`;
}

/** The card shown while the rankings are still loading, so a README never shows a broken image. */
export function renderPendingCard(theme: CardTheme = 'auto'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="160" viewBox="0 0 495 160" role="img" aria-label="Rankings are updating" font-family="-apple-system,'Segoe UI',Helvetica,Arial,sans-serif"><style>${STYLE[theme]}</style><rect class="bg" x=".5" y=".5" width="494" height="159" rx="18"/><text class="t" x="247.5" y="76" text-anchor="middle" font-size="17" font-weight="700">Elite 1337</text><text class="m" x="247.5" y="98" text-anchor="middle" font-size="12">Rankings are updating, check back in a minute</text></svg>`;
}
