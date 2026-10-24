// Umami Cloud. The website id is public by design (it ships in the page); override it per environment if needed.
export const UMAMI_WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ?? '38abc134-8c22-485b-9c67-442d916d38e9';
/** Only the production host reports, so local development and previews never use up the monthly event quota. */
export const UMAMI_DOMAINS = process.env.NEXT_PUBLIC_UMAMI_DOMAINS ?? 'eleet-phi.vercel.app';

type UmamiWindow = Window & { umami?: { track: (event: string, data?: Record<string, string | number>) => void } };

/** Records a named action. Never pass logins, names or search text. */
export function track(event: string, data?: Record<string, string | number>) {
  try { (window as UmamiWindow).umami?.track(event, data); } catch { /* analytics must never break the app */ }
}
