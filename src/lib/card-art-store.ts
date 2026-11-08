import { sql } from './db';
import { ART_COLS, ART_ROWS } from './card-art';

export type CardArtSource = 'upload' | 'github' | 'link';
export type CardArt = { source: CardArtSource; label: string; cells: string };
export type SaveResult = 'saved' | 'limited' | 'invalid' | 'unavailable';

let ready: Promise<unknown> | undefined;
/** Created on first use (see neon/card-art.sql). */
function ensureTable() {
  ready ??= sql()`
    create table if not exists card_art (
      user_id bigint primary key check (user_id > 0),
      source text not null check (source in ('upload', 'github', 'link')),
      label text not null default '',
      cells text not null,
      updated_at timestamptz not null default now()
    )`.catch((error) => { ready = undefined; throw error; });
  return ready;
}

/** Cells must be exactly ART_COLS x ART_ROWS bytes in base64: nothing else is ever stored or drawn. */
export function validCells(cells: unknown): cells is string {
  return typeof cells === 'string' && cells.length === Math.ceil(ART_COLS * ART_ROWS / 3) * 4 && /^[A-Za-z0-9+/]+={0,2}$/.test(cells)
    && Buffer.from(cells, 'base64').length === ART_COLS * ART_ROWS;
}

/** The picture a student chose, or null (their 42 photo is used). Never throws: the card must still draw. */
export async function getCardArt(userId: number): Promise<CardArt | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    await ensureTable();
    const rows = await sql()`select source, label, cells from card_art where user_id = ${userId}`;
    const row = rows[0] as CardArt | undefined;
    return row && validCells(row.cells) ? row : null;
  } catch (error) {
    console.error('Card picture unavailable:', error instanceof Error ? error.name : 'unknown');
    return null;
  }
}

/** One picture per student; changing it again within 5 seconds is refused so the table cannot be hammered. */
export async function saveCardArt(userId: number, art: CardArt): Promise<SaveResult> {
  if (!Number.isSafeInteger(userId) || userId <= 0 || !validCells(art.cells) || !['upload', 'github', 'link'].includes(art.source)) return 'invalid';
  if (!process.env.DATABASE_URL) return 'unavailable';
  const label = art.label.slice(0, 80);
  try {
    await ensureTable();
    const rows = await sql()`
      insert into card_art (user_id, source, label, cells) values (${userId}, ${art.source}, ${label}, ${art.cells})
      on conflict (user_id) do update set source = excluded.source, label = excluded.label, cells = excluded.cells, updated_at = now()
      where card_art.updated_at < now() - interval '5 seconds'
      returning user_id`;
    return rows.length ? 'saved' : 'limited';
  } catch (error) {
    console.error('Card picture not saved:', error instanceof Error ? error.name : 'unknown');
    return 'unavailable';
  }
}

/** Back to the student's 42 photo. */
export async function clearCardArt(userId: number): Promise<SaveResult> {
  if (!Number.isSafeInteger(userId) || userId <= 0) return 'invalid';
  if (!process.env.DATABASE_URL) return 'saved';
  try { await ensureTable(); await sql()`delete from card_art where user_id = ${userId}`; return 'saved'; }
  catch (error) { console.error('Card picture not cleared:', error instanceof Error ? error.name : 'unknown'); return 'unavailable'; }
}
