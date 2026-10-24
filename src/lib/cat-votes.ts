import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const CATS = [
  { id: 'mochi', name: 'Mochi' }, { id: 'oreo', name: 'Oreo' }, { id: 'tux', name: 'Tux' },
  { id: 'kiwi', name: 'Kiwi' }, { id: 'domino', name: 'Domino' }, { id: 'tiger', name: 'Tiger' },
] as const;
export type CatId = typeof CATS[number]['id'];
export const isCat = (value: unknown): value is CatId => CATS.some((cat) => cat.id === value);

export type CatTally = { counts: Record<CatId, number>; total: number };

/** Counts one vote per row; unknown cats are ignored. */
export function tallyVotes(rows: { cat: string }[]): CatTally {
  const counts = Object.fromEntries(CATS.map((cat) => [cat.id, 0])) as Record<CatId, number>;
  for (const row of rows) if (isCat(row.cat)) counts[row.cat]++;
  return { counts, total: Object.values(counts).reduce((sum, count) => sum + count, 0) };
}

let client: SupabaseClient | undefined;
export const catVotesConfigured = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const db = () => client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

/** The shared tally and the viewer's own pick, or null when votes are not stored (not configured or unreachable). */
export async function loadCatVotes(userId: number): Promise<{ tally: CatTally; mine: CatId | null } | null> {
  if (!catVotesConfigured()) return null;
  try {
    const { data, error } = await db().from('cat_votes').select('user_id,cat');
    if (error) throw error;
    const rows = data as { user_id: number; cat: string }[];
    const own = rows.find((row) => row.user_id === userId)?.cat;
    return { tally: tallyVotes(rows), mine: isCat(own) ? own : null };
  } catch (error) {
    console.error('Cat votes unavailable:', error instanceof Error ? error.name : 'unknown');
    return null;
  }
}

export async function saveCatVote(userId: number, cat: CatId) {
  if (!catVotesConfigured()) return false;
  const { error } = await db().from('cat_votes').upsert({ user_id: userId, cat, updated_at: new Date().toISOString() });
  if (error) { console.error('Cat vote failed:', error.name); return false; }
  return true;
}
