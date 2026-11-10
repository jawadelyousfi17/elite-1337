/** "just now", "12 min ago", "3 h ago", "2 days ago". */
export function timeAgo(iso: string, now = Date.now()) {
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

/** Age for long spans, in whole units: "today", "9 days ago", "1 month 5 days ago", "1 year 2 months ago". */
/** `daysOnly` counts everything in days ("60 days ago") for narrow screens. */
export function daysAgo(iso: string, now = Date.now(), daysOnly = false) {
  const total = Math.floor((now - Date.parse(iso)) / 86_400_000);
  if (!Number.isFinite(total) || total < 1) return 'today';
  if (daysOnly && total >= 1) return `${total} day${total === 1 ? '' : 's'} ago`;
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (total < 30) return `${unit(total, 'day')} ago`;
  if (total < 365) { const months = Math.floor(total / 30), days = total % 30; return `${unit(months, 'month')}${days ? ` ${unit(days, 'day')}` : ''} ago`; }
  const years = Math.floor(total / 365), months = Math.floor((total % 365) / 30);
  return `${unit(years, 'year')}${months ? ` ${unit(months, 'month')}` : ''} ago`;
}
