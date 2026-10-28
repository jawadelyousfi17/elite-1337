import { after } from 'next/server';
import { sql } from './db';
import { hideRequestSchema, type HideRequestResult } from './hide-request-rules';

/** A student asking to be removed from the app. Handled by hand: the request is stored and sent to Discord. */

let ready: Promise<unknown> | undefined;
/** Created on first use (see neon/hide-requests.sql). */
function ensureTable() {
  ready ??= sql()`
    create table if not exists hide_requests (
      user_id bigint primary key,
      login text not null,
      reason text not null,
      status text not null default 'pending',
      requested_at timestamptz not null default now()
    )`.catch((error) => { ready = undefined; throw error; });
  return ready;
}

/** One request per student; asking again within the hour is refused, later it replaces the reason and notifies again. */
export async function saveHideRequest(userId: number, login: string, input: unknown): Promise<HideRequestResult> {
  const parsed = hideRequestSchema.safeParse(input);
  if (!parsed.success) return 'invalid';
  if (!process.env.DATABASE_URL) return 'unavailable';
  const { reason } = parsed.data;
  try {
    await ensureTable();
    const rows = await sql()`
      insert into hide_requests (user_id, login, reason) values (${userId}, ${login}, ${reason})
      on conflict (user_id) do update set reason = excluded.reason, login = excluded.login, status = 'pending', requested_at = now()
      where hide_requests.requested_at < now() - interval '1 hour'
      returning user_id`;
    if (!rows.length) return 'limited';
    after(() => notifyHideRequest(login, reason));
    return 'sent';
  } catch (error) {
    console.error('Hide request unavailable:', error instanceof Error ? error.name : 'unknown');
    return 'unavailable';
  }
}

/** Discord webhook body; mentions are disabled so a reason cannot ping anyone. */
export function hideRequestPayload(login: string, reason: string) {
  return {
    username: 'Elite 1337 Requests',
    allowed_mentions: { parse: [] },
    embeds: [{
      title: '🗑️ Profile removal request',
      description: reason,
      color: 0xedc5f9,
      fields: [{ name: 'To apply', value: 'Add the login to ANONYMIZED_LOGINS in Vercel, then redeploy.', inline: false }, { name: 'Student', value: `[${login}](https://profile.intra.42.fr/users/${encodeURIComponent(login)})`, inline: true }],
      timestamp: new Date().toISOString(),
    }],
  };
}

/** Best effort: a missing webhook or a Discord outage never fails the request, which is already saved. */
async function notifyHideRequest(login: string, reason: string) {
  const url = process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
  if (!url) return;
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(hideRequestPayload(login, reason)), signal: AbortSignal.timeout(5000) });
    if (!response.ok) console.error('Discord hide request notification failed:', response.status);
  } catch (error) {
    console.error('Discord hide request notification failed:', error instanceof Error ? error.name : 'unknown');
  }
}
