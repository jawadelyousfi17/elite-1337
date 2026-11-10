/** Resolves to `fallback` if `work` takes longer than `ms`, so a slow side service never holds a page open. */
export function withTimeout<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), ms); });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}
