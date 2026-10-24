// Web3Forms access keys are public identifiers intended for browser-side use.
const ACCESS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY || '62fbaf26-cb69-41ae-8903-b51459cf5e8c';

export async function submitWeb3Form(subject: string, fields: Record<string, string | number>) {
  const response = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({ ...fields, access_key: ACCESS_KEY, subject, from_name: 'Elite 1337' }),
  });
  const result = await response.json();
  if (!response.ok || result?.success !== true) {
    throw new Error('Your answers could not be sent. Please try again in a moment.');
  }
}
