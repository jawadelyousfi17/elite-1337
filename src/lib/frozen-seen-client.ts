/** Browser side of the lazy freeze dates: badges ask for their student, one batched request fetches them, and listeners are told when dates arrive. */
const known = new Map<number, string | null>();
const waiting = new Set<number>();
const listeners = new Set<() => void>();
const tries = new Map<number, number>();
let timer: ReturnType<typeof setTimeout> | undefined;
const BATCH = 30, RETRIES = 6;

export const seenOf = (id: number) => known.get(id);
export function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
const notify = () => listeners.forEach((listener) => listener());

function schedule(ms: number) { clearTimeout(timer); timer = setTimeout(flush, ms); }
async function flush() {
  const ids = [...waiting].slice(0, BATCH);
  ids.forEach((id) => waiting.delete(id));
  if (waiting.size) schedule(50);
  if (!ids.length) return;
  try {
    const response = await fetch(`/api/leaderboard/seen?ids=${ids.join(',')}`, { cache: 'no-store' });
    const { seen } = await response.json() as { seen: Record<string, string | null> };
    for (const id of ids) {
      if (id in seen) known.set(id, seen[id]);
      // The server keeps fetching what it could not finish in time; ask again a few times.
      else if ((tries.get(id) ?? 0) < RETRIES) { tries.set(id, (tries.get(id) ?? 0) + 1); waiting.add(id); schedule(4_000); }
    }
    notify();
  } catch { /* the badge simply stays without a date */ }
}
/** Asks for a student's last session once; the date shows up through `seenOf`. */
export function requestSeen(id: number) { if (known.has(id) || waiting.has(id) || (tries.get(id) ?? 0) > 0) return; waiting.add(id); schedule(50); }
