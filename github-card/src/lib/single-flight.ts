/**
 * unstable_cache does not share a miss: two callers that ask at the same time (the nav and the page, or two
 * students) both run the fetch. This keeps one in-flight promise per key on the server instance instead.
 * A success stays shared for `holdMs` more, because the cache entry is written in the background and a caller
 * right after the fetch can still miss it. A failure is dropped at once so the next caller retries.
 */
export function singleFlight<A extends unknown[], T>(fn: (...args: A) => Promise<T>, holdMs = 60_000): (...args: A) => Promise<T> {
  const running = new Map<string, Promise<T>>();
  return (...args: A) => {
    const key = JSON.stringify(args);
    const found = running.get(key);
    if (found) return found;
    const started = fn(...args);
    running.set(key, started);
    started.then(() => { setTimeout(() => { if (running.get(key) === started) running.delete(key); }, holdMs).unref?.(); }, () => { if (running.get(key) === started) running.delete(key); });
    return started;
  };
}
