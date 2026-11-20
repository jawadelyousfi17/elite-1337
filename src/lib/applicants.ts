/** One Wedesign application from the Tally CSV export. Kept only in the admin's browser, never on the server. */
export type Applicant = { id: string; login: string; promo: string; interests: string[]; whatsapp: string; campus: string; submittedAt: string };
export const STATUSES = ['new', 'interviewing', 'done', 'rejected'] as const;
export type ApplicantStatus = typeof STATUSES[number];
export const DEFAULT_ROLES = ['Designer', 'Developer', 'Content', 'Video', 'Marketing', 'Events'];

/** Splits CSV text into rows, handling quoted fields, doubled quotes and CRLF line ends. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field);
  if (row.some((cell) => cell !== '')) rows.push(row);
  return rows;
}

const LOGIN = /^[a-z0-9_.-]{2,40}$/;

/**
 * Reads the Tally export by column name, so reordered or extra columns still work. Rows without a valid 42 login are
 * skipped, and a login that applied twice keeps its latest submission.
 */
export function applicantsFromCsv(text: string): Applicant[] {
  const [header, ...rows] = parseCsv(text.replace(/^﻿/, ''));
  if (!header) return [];
  const column = (name: string) => header.findIndex((cell) => cell.trim().toLowerCase() === name);
  const at = { id: column('submission id'), login: column('your login'), promo: column('promo'), interests: column('your interests fields'), whatsapp: column('your whatsapp'), campus: column('campus'), submittedAt: column('submitted at') };
  if (at.login < 0) return [];
  const read = (row: string[], index: number) => (index < 0 ? '' : row[index] ?? '').trim();
  const byLogin = new Map<string, Applicant>();
  for (const row of rows) {
    const login = read(row, at.login).toLowerCase();
    if (!LOGIN.test(login)) continue;
    const applicant: Applicant = {
      id: read(row, at.id) || login, login, promo: read(row, at.promo), whatsapp: read(row, at.whatsapp), campus: read(row, at.campus), submittedAt: read(row, at.submittedAt),
      interests: read(row, at.interests).split(',').map((item) => item.trim()).filter(Boolean),
    };
    const previous = byLogin.get(login);
    if (!previous || previous.submittedAt <= applicant.submittedAt) byLogin.set(login, applicant);
  }
  return [...byLogin.values()].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

/** A wa.me link for a phone number, or null when it does not look like one. */
export function whatsappLink(phone: string) {
  const digits = phone.replace(/[^\d]/g, '');
  return digits.length >= 8 && digits.length <= 15 ? `https://wa.me/${digits}` : null;
}
