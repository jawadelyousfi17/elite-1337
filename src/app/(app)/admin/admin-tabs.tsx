import Link from 'next/link';
import { cn } from '@/lib/utils';

const TABS = [{ href: '/admin/feedback', label: 'Feedback' }, { href: '/admin/experiments', label: 'Experiments' }];

export function AdminTabs({ current }: { current: string }) {
  return <nav className="fa-tabs" aria-label="Admin pages">{TABS.map((tab) => <Link key={tab.href} href={tab.href} className={cn('fa-tab', current === tab.href && 'is-picked')} aria-current={current === tab.href ? 'page' : undefined}>{tab.label}</Link>)}</nav>;
}
