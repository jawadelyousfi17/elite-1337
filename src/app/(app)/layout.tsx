import { Suspense } from 'react';
import { KiwiGuide } from '@/components/kiwi-guide';
import { Credits } from '@/components/credits';
import { FeedbackButton } from '@/components/feedback-button';
import { HackMe } from '@/components/hack-me';
import { InstantNav } from '@/components/instant-nav';
import { LegalLinks } from '@/components/legal-page';
import { Nav } from '@/components/nav';
import { Tweaks } from '@/components/tweaks';
import { requireStudent } from '@/lib/guard';
export const metadata = { robots: { index: false, follow: false } };
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) { const user = await requireStudent(); return <><Nav loggedIn/>{children}<footer className="footer"><div className="shell"><Credits/><LegalLinks/></div></footer><FeedbackButton login={user.login ?? ''}/><HackMe/><KiwiGuide/><Suspense><InstantNav/></Suspense>{process.env.NODE_ENV === 'development' && <Tweaks/>}</>; }
