import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Instrument_Sans } from 'next/font/google';

const font = Instrument_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-sans' });

const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3400';
export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: 'GitHub Card', template: '%s | GitHub Card' },
  description: 'Make a terminal-style profile card for your GitHub README from your username. No sign-in.',
  openGraph: { title: 'GitHub Card', description: 'A terminal-style profile card for your GitHub README. No sign-in.', type: 'website' },
};
export const viewport: Viewport = { colorScheme: 'light', themeColor: '#f6f7f9' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={font.variable}><body>{children}</body></html>;
}
