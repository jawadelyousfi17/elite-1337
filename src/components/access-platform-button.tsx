'use client';

import { useFormStatus } from 'react-dom';
import { LoaderCircle } from 'lucide-react';
import { ArrowRight } from '@/components/icons';

export function AccessPlatformButton() {
  const { pending } = useFormStatus();

  return <button type="submit" className="landing-cta" disabled={pending} aria-busy={pending} data-umami-event="signin-click">
    <img className="landing-cta-logo" src="/assets/42-mark.webp" alt="" width={31} height={22} aria-hidden="true"/>
    <span className="landing-cta-label" role="status" aria-live="polite">{pending ? 'Opening platform…' : 'Access the platform'}</span>
    <span className="landing-cta-icon" aria-hidden="true">{pending ? <LoaderCircle size={20} className="landing-access-spinner"/> : <ArrowRight size={20} weight="bold"/>}</span>
  </button>;
}
