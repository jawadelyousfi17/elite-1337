import type { ApiCampus } from './fortytwo-api';
import type { BlackholedStudent, RankingDataset } from './dataset';
import type { StudentRank } from './ranking';

/** Demo mode (IS_DEMO=1) shows made-up students and a made-up signed-in user, so a recording never exposes real people. */
export const isDemo = () => ['1', 'true', 'yes'].includes((process.env.IS_DEMO ?? '').trim().toLowerCase());

export const DEMO_USER = { id: '9000001', login: 'demo-student' };
const CAMPUSES: ApiCampus[] = [
  { id: 16, name: 'Khouribga', city: 'Khouribga', country: 'Morocco' },
  { id: 21, name: 'Benguerir', city: 'Benguerir', country: 'Morocco' },
  { id: 55, name: 'Rabat', city: 'Rabat', country: 'Morocco' },
  { id: 75, name: 'Tetouan', city: 'Tetouan', country: 'Morocco' }
];
const FIRST = ['Amine', 'Salma', 'Youssef', 'Imane', 'Omar', 'Hajar', 'Mehdi', 'Khadija', 'Anas', 'Meryem', 'Reda', 'Sara', 'Ayoub', 'Nada', 'Zakaria', 'Aya', 'Hamza', 'Lina', 'Ilyas', 'Rania', 'Walid', 'Soukaina', 'Bilal', 'Yasmine', 'Karim', 'Chaima', 'Tarik', 'Oumaima', 'Nabil', 'Ghita'];
const LAST = ['Alaoui', 'Bennani', 'Chraibi', 'Darif', 'El Idrissi', 'Fassi', 'Gharbi', 'Haddad', 'Idrissi', 'Jabri', 'Kettani', 'Lahlou', 'Mansouri', 'Naciri', 'Ouazzani', 'Qadiri', 'Rifai', 'Sebti', 'Tazi', 'Zniber'];
const MONTHS = ['january', 'march', 'june', 'july', 'august', 'september', 'october'];
const COHORTS = ['2022', '2023', '2024', '2025', '2026'];

function random(seed: number) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 32; };
}
const pick = <T,>(items: T[], next: () => number) => items[Math.floor(next() * items.length)];

function build(): { dataset: RankingDataset; seen: Map<number, string> } {
  const next = random(1337);
  const students: StudentRank[] = [];
  const blackholed: BlackholedStudent[] = [];
  const seen = new Map<number, string>();
  const used = new Set<string>();
  const day = 86_400_000;
  for (let index = 0; index < 220; index++) {
    const first = pick(FIRST, next), last = pick(LAST, next);
    let login = (first[0] + last).toLowerCase().replace(/[^a-z]/g, '').slice(0, 8);
    while (used.has(login)) login += Math.floor(next() * 9);
    used.add(login);
    const cohort = pick(COHORTS, next), id = 9000100 + index;
    const campusIds = [pick(CAMPUSES, next).id];
    const base = { id, login, displayName: `${first} ${last}`, commonCoreCohort: cohort, campusIds, photo: '/demo.png' };
    if (index >= 190) { blackholed.push({ ...base, level: Math.round((1 + next() * 6) * 100) / 100, blackholedAt: new Date(Date.now() - (5 + next() * 300) * day).toISOString() }); continue; }
    const frozen = next() < 0.12;
    students.push({
      ...base, poolYear: String(Number(cohort) - 1), poolMonth: pick(MONTHS, next), level: Math.round((frozen ? 1 + next() * 6 : 2 + next() * 14) * 100) / 100,
      globalRank: 0, campusRanks: {}, ...(frozen ? { frozen: true } : {}), ...(!frozen && next() < 0.06 ? { alumni: true } : {})
    });
    if (frozen) seen.set(id, new Date(Date.now() - (20 + next() * 500) * day).toISOString());
  }
  students.push({ id: Number(DEMO_USER.id), login: DEMO_USER.login, displayName: 'Demo Student', poolYear: '2024', poolMonth: 'july', commonCoreCohort: '2024', level: 9.42, campusIds: [21], globalRank: 0, campusRanks: {}, photo: '/demo.png' });
  students.sort((a, b) => b.level - a.level || a.login.localeCompare(b.login));
  const rank = (items: StudentRank[], set: (student: StudentRank, place: number) => void) => {
    let previous: number | undefined, place = 0;
    items.forEach((student, position) => { if (student.level !== previous) place = position + 1; set(student, place); previous = student.level; });
  };
  rank(students, (student, place) => { student.globalRank = place; });
  for (const campus of CAMPUSES) rank(students.filter((student) => student.campusIds.includes(campus.id)), (student, place) => { student.campusRanks[campus.id] = place; });
  blackholed.sort((a, b) => Date.parse(b.blackholedAt) - Date.parse(a.blackholedAt));
  return { dataset: { students, blackholed, acceptedUserIds: [...students, ...blackholed].map((student) => student.id), campuses: CAMPUSES, fetchedAt: new Date().toISOString(), complete: true }, seen };
}
let cached: ReturnType<typeof build> | undefined;
const demo = () => (cached ??= build());

export const demoDataset = (): RankingDataset => demo().dataset;
export const demoLastSeen = (ids: number[]) => new Map(ids.filter((id) => demo().seen.has(id)).map((id) => [id, demo().seen.get(id)!]));

/** A friendly cartoon face for any id, so every demo student has a picture without touching 42's photo CDN. */
export function demoAvatar(id: number): string {
  const next = random(id * 7919);
  const skin = pick(['#f3c9a5', '#e0a97c', '#c68a5b', '#8d5a3b', '#f6d6bd'], next), hair = pick(['#1c1410', '#3b2417', '#6b3f1d', '#0d0d0d', '#8a5a2b'], next);
  const back = pick(['#cafbd2', '#edc5f9', '#bfe3ff', '#ffd9b8', '#fff2a8'], next), shirt = pick(['#2b2b2b', '#4b6cb7', '#c0504d', '#3a8f6b', '#7c5cbf'], next);
  const style = Math.floor(next() * 3), glasses = next() < 0.3;
  const hairShape = style === 0 ? `<path d="M30 52c0-26 12-34 30-34s30 8 30 34c-6-12-14-17-30-17s-24 5-30 17z" fill="${hair}"/>`
    : style === 1 ? `<path d="M28 60c-4-30 8-44 32-44s36 14 32 44c-4-6-6-10-8-18-8 4-34 4-48 0-2 8-4 12-8 18z" fill="${hair}"/>`
    : `<path d="M32 46c2-20 14-28 28-28s26 8 28 28c-8-8-18-10-28-10s-20 2-28 10z" fill="${hair}"/><circle cx="60" cy="18" r="9" fill="${hair}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="${back}"/><path d="M14 120c0-24 20-34 46-34s46 10 46 34z" fill="${shirt}"/><rect x="52" y="74" width="16" height="16" fill="${skin}"/><ellipse cx="60" cy="52" rx="26" ry="30" fill="${skin}"/>${hairShape}<circle cx="50" cy="56" r="3" fill="#222"/><circle cx="70" cy="56" r="3" fill="#222"/><path d="M50 70q10 8 20 0" stroke="#7a3b2e" stroke-width="3" fill="none" stroke-linecap="round"/>${glasses ? '<g fill="none" stroke="#222" stroke-width="2"><circle cx="50" cy="56" r="8"/><circle cx="70" cy="56" r="8"/><path d="M58 56h4"/></g>' : ''}</svg>`;
}
