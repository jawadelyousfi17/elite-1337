export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function distance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let older: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) current[j] = Math.min(current[j], older[j - 2] + 1);
      best = Math.min(best, current[j]);
    }
    if (best > limit) return limit + 1;
    older = previous;
    previous = current;
  }
  return previous[b.length];
}

const tolerance = (length: number) => (length <= 3 ? 0 : length <= 6 ? 1 : 2);

function tokenMatches(query: string, word: string): boolean {
  if (word.includes(query)) return true;
  const limit = tolerance(query.length);
  if (!limit) return false;
  if (distance(query, word, limit) <= limit) return true;
  return word.length > query.length && distance(query, word.slice(0, query.length), limit) <= limit;
}

/** True when every query word matches the login, the joined name, or one name word, allowing small typos. */
export function matchesSearch(query: string, fields: (string | null | undefined)[]): boolean {
  const terms = normalize(query).split(' ').filter(Boolean);
  if (!terms.length) return true;
  const texts = fields.filter((field): field is string => !!field).map(normalize);
  const words = texts.flatMap((text) => [text.replace(/ /g, ''), ...text.split(' ')]);
  return terms.every((term) => words.some((word) => tokenMatches(term, word)));
}
