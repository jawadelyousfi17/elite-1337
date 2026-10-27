import { sql } from './db';
import { after } from 'next/server';
import { z } from 'zod';
import { siteUrl } from '@/lib/site';

export const FEEDBACK_KINDS = ['bug', 'idea', 'other'] as const;
export const MAX_FEEDBACK = 2000;
const HOURLY_LIMIT = 5;

export const feedbackSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  message: z.string().trim().min(3).max(MAX_FEEDBACK),
  page: z.string().max(300).catch(''),
  screen: z.string().max(40).catch(''),
  reply: z.boolean(),
});
export type FeedbackInput = z.input<typeof feedbackSchema>;
export type FeedbackResult = 'sent' | 'invalid' | 'limited' | 'unavailable';
export type FeedbackKind = typeof FEEDBACK_KINDS[number];
export type FeedbackEntry = { id: number; login: string | null; kind: FeedbackKind; message: string; page: string; screen: string; createdAt: string };
export const isFeedbackKind = (value: unknown): value is FeedbackKind => FEEDBACK_KINDS.includes(value as FeedbackKind);


/** Stores one report; at most HOURLY_LIMIT per student per hour, enforced in the same statement as the insert. */
export async function saveFeedback(userId: number, login: string, input: unknown): Promise<FeedbackResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return 'invalid';
  if (!process.env.DATABASE_URL) return 'unavailable';
  const { kind, message, page, screen, reply } = parsed.data;
  try {
    const rows = await sql()`
      insert into feedback (user_id, login, kind, message, page, screen)
      select ${userId}, ${reply ? login : null}, ${kind}, ${message}, ${page}, ${screen}
      where (select count(*) from feedback where user_id = ${userId} and created_at > now() - interval '1 hour') < ${HOURLY_LIMIT}
      returning id, created_at`;
    if (!rows.length) return 'limited';
    const entry: FeedbackEntry = { id: Number(rows[0].id), login: reply ? login : null, kind, message, page, screen, createdAt: new Date(rows[0].created_at).toISOString() };
    after(() => notifyDiscord(entry));
    return 'sent';
  } catch (error) {
    console.error('Feedback unavailable:', error instanceof Error ? error.name : 'unknown');
    return 'unavailable';
  }
}

/** Logins allowed to read feedback, from ADMIN_LOGINS (comma-separated); nobody when unset. */
export function isFeedbackAdmin(login: string | null | undefined) {
  const admins = (process.env.ADMIN_LOGINS ?? '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  return !!login && admins.includes(login.toLowerCase());
}

/** Newest reports first; null when the database is not configured or unreachable. */
export async function listFeedback(limit = 500): Promise<FeedbackEntry[] | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const rows = await sql()`
      select id, login, kind, message, page, screen, created_at from feedback
      order by created_at desc limit ${limit}`;
    return rows.map((row) => ({ id: Number(row.id), login: row.login, kind: row.kind, message: row.message, page: row.page, screen: row.screen, createdAt: new Date(row.created_at).toISOString() }));
  } catch (error) {
    console.error('Feedback unavailable:', error instanceof Error ? error.name : 'unknown');
    return null;
  }
}

const DISCORD_STYLE: Record<FeedbackKind, { title: string; color: number }> = {
  bug: { title: '🐞 Bug report', color: 0xff8a8f },
  idea: { title: '💡 Idea', color: 0xfff0b5 },
  other: { title: '💬 Feedback', color: 0xcafbd2 },
};

/** Discord webhook body for one report; mentions are disabled so a message cannot ping anyone. */
export function discordPayload(entry: FeedbackEntry) {
  const style = DISCORD_STYLE[entry.kind];
  return {
    username: 'Elite 1337 Feedback',
    allowed_mentions: { parse: [] },
    embeds: [{
      title: style.title,
      url: new URL('/admin/feedback', siteUrl).href,
      description: entry.message,
      color: style.color,
      fields: [
        { name: 'From', value: entry.login ? `[${entry.login}](https://profile.intra.42.fr/users/${encodeURIComponent(entry.login)})` : 'Anonymous', inline: true },
        { name: 'Page', value: entry.page || '—', inline: true },
        { name: 'Screen', value: entry.screen || '—', inline: true },
      ],
      timestamp: entry.createdAt,
    }],
  };
}

/** Best effort: a missing webhook or a Discord outage never fails the report, which is already saved. */
export async function notifyDiscord(entry: FeedbackEntry) {
  const url = process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
  if (!url) return;
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(discordPayload(entry)), signal: AbortSignal.timeout(5000) });
    if (!response.ok) console.error('Discord feedback notification failed:', response.status);
  } catch (error) {
    console.error('Discord feedback notification failed:', error instanceof Error ? error.name : 'unknown');
  }
}
