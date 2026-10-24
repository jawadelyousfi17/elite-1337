import './globals.css';
import './tweaks.generated.css';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import localFont from 'next/font/local';
import Script from 'next/script';
import { siteDescription, siteName, siteUrl } from '@/lib/site';
import { UMAMI_DOMAINS, UMAMI_WEBSITE_ID } from '@/lib/analytics';

const generalSans = localFont({
  src: [
    { path: './fonts/GeneralSans-Regular.otf', weight: '400', style: 'normal' },
    { path: './fonts/GeneralSans-Medium.otf', weight: '500', style: 'normal' },
    { path: './fonts/GeneralSans-Semibold.otf', weight: '600', style: 'normal' },
    { path: './fonts/GeneralSans-Bold.otf', weight: '700', style: 'normal' },
  ],
  variable: '--font-general',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: siteName,
  title: { default: 'Elite 1337 — Student Rankings & Common Core Progress', template: '%s | Elite 1337' },
  description: siteDescription,
  openGraph: {
    type: 'website', locale: 'en_US', siteName,
    title: 'Elite 1337 — Student Rankings & Common Core Progress',
    description: siteDescription,
    images: [{ url: '/assets/elite-1337-social.webp', width: 1200, height: 630, alt: 'Elite 1337 — Student rankings. Common Core progress. Your community.' }],
  },
  twitter: {
    card: 'summary_large_image', title: 'Elite 1337 — Student Rankings & Common Core Progress',
    description: siteDescription,
    images: ['/assets/elite-1337-social.webp'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={generalSans.variable} data-tw-light="" data-tw-surface="light" data-tw-radius="sharp"
      style={{ '--tw-bg': '#f3f3f1', '--tw-card': '#ffffff', '--tw-raise': '#ececea', '--tw-hover': '#e2e2df', '--tw-r': '.4' } as CSSProperties}
      suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <Script src="https://cloud.umami.is/script.js" data-website-id={UMAMI_WEBSITE_ID} data-domains={UMAMI_DOMAINS} data-exclude-search="true" strategy="afterInteractive"/>
      </body>
    </html>
  );
}
