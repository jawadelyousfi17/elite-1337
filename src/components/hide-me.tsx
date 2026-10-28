'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Dialog } from 'radix-ui';
import { X } from '@/components/icons';
import { sendHideRequest } from '@/components/hide-me-actions';
import { MIN_REASON, MAX_REASON } from '@/lib/hide-request-rules';
import { CONTACT_DISCORD, CONTACT_EMAIL } from '@/lib/site';

type Step = 'form' | 'sure' | 'done';
/** Other parts of the app (the profile menu) open this dialog with this event. */
export const OPEN_HIDE_ME = 'hide-me:open';

/** Asks to have the student's profile removed from the app: form, then an "are you sure?", then a goodbye. The team handles it by hand. */
export function HideMe() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [reason, setReason] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  // Set once Confirm is pressed with something missing, so the form says what.
  const [attempted, setAttempted] = useState(false);
  const busy = useRef(false);
  const typed = reason.trim().length;
  const tooShort = typed < MIN_REASON, valid = !tooShort && acknowledged;
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_HIDE_ME, show);
    return () => window.removeEventListener(OPEN_HIDE_ME, show);
  }, []);

  const change = (next: boolean) => {
    if (busy.current) return;
    setOpen(next);
    if (!next) { setStep('form'); setError(''); setAttempted(false); if (step === 'done') { setReason(''); setAcknowledged(false); } }
  };

  /** Confirm: go on when the form is complete, otherwise point at what is missing and focus it. */
  const confirm = (event: React.FormEvent) => {
    event.preventDefault();
    if (valid) { setAttempted(false); setStep('sure'); return; }
    setAttempted(true);
    form.current?.querySelector<HTMLElement>(tooShort ? 'textarea' : 'input[type=checkbox]')?.focus();
  };

  const send = async () => {
    if (busy.current || !valid) return;
    busy.current = true;
    setSending(true);
    setError('');
    try {
      const result = await sendHideRequest({ reason: reason.trim(), acknowledged: true });
      if (result === 'sent') setStep('done');
      else { setStep('form'); setError(result === 'limited' ? 'We already have your request. Give us a little time.' : 'Your request could not be sent. Please try again in a moment.'); }
    } catch {
      setStep('form');
      setError('Your request could not be sent. Please try again in a moment.');
    } finally {
      busy.current = false;
      setSending(false);
    }
  };

  return <Dialog.Root open={open} onOpenChange={change}>
    <Dialog.Trigger className="sv-pill fb-pill hm-pill" aria-label="Remove my profile from Elite 1337"><Image src="/assets/hide-me/trash.webp" alt="" width={28} height={28}/><span>Remove me</span><em className="nav-new" aria-hidden="true">New!</em></Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="sv-overlay"/>
      <Dialog.Content className="sv-dialog" aria-busy={sending} aria-describedby="hm-lead">
        <Dialog.Close className="sv-close" aria-label="Close" disabled={sending}><X size={16}/></Dialog.Close>
        {step === 'form' && <form ref={form} className="sv-step" noValidate onSubmit={confirm}>
          <Image className="fb-art" src="/assets/hide-me/trash.webp" alt="" width={80} height={80}/>
          <Dialog.Title className="sv-title">Remove my profile</Dialog.Title>
          <p className="sv-lead" id="hm-lead">Tell us why you want to leave. You will see what happens on the next step.</p>
          <label className={cn('fb-field', attempted && tooShort && 'is-invalid')}>
            <span className="sr-only">Why do you want to leave?</span>
            <textarea value={reason} onChange={(event) => setReason(event.target.value.slice(0, MAX_REASON))} rows={4} maxLength={MAX_REASON} aria-invalid={attempted && tooShort} aria-describedby={attempted && tooShort ? 'hm-reason-error' : undefined} placeholder="Why do you want your profile removed? (at least 10 characters)"/>
            <small aria-hidden="true">{tooShort ? `${MIN_REASON - typed} more` : `${reason.length}/${MAX_REASON}`}</small>
          </label>
          {attempted && tooShort && <p className="hm-error" id="hm-reason-error" role="alert">Please tell us why, in at least {MIN_REASON} characters{typed > 0 && <> ({MIN_REASON - typed} more)</>}.</p>}
          <label className={cn('fb-reply', attempted && !acknowledged && 'is-invalid')}><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} aria-invalid={attempted && !acknowledged} aria-describedby={attempted && !acknowledged ? 'hm-ack-error' : undefined}/><span>I understand and acknowledge this</span></label>
          {attempted && !acknowledged && <p className="hm-error" id="hm-ack-error" role="alert">Please tick the box to confirm you understand.</p>}
          {error && <p className="sv-hint fb-error" role="alert">{error}</p>}
          <div className="sv-actions hm-actions">
            <button type="submit" className="sv-secondary">Confirm</button>
            <button type="button" className="sv-primary" onClick={() => change(false)}>Cancel</button>
          </div>
        </form>}
        {step === 'sure' && <div className="sv-step">
          <Image className="fb-art" src="/assets/hide-me/trash.webp" alt="" width={80} height={80}/>
          <Dialog.Title className="sv-title">Are you sure?</Dialog.Title>
          <p className="sv-lead" id="hm-lead">This is what happens once your profile is removed:</p>
          <ul className="hm-rules">
            <li><span aria-hidden="true">✅</span><span>You are replaced by an anonymous profile in the app, with no level and no other information.</span></li>
            <li><span aria-hidden="true">✅</span><span>You won&apos;t see yourself on Elite 1337 anymore.</span></li>
            <li><span aria-hidden="true">✅</span><span>You won&apos;t be able to access the app anymore.</span></li>
            <li><span aria-hidden="true">✅</span><span>Changed your mind? Contact the admin: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or Discord <b>{CONTACT_DISCORD}</b>.</span></li>
          </ul>
          <div className="sv-actions hm-actions">
            <button type="button" className="sv-secondary" onClick={send} disabled={sending}>{sending ? <span role="status">Sending…</span> : 'Yes'}</button>
            <button type="button" className="sv-primary" onClick={() => change(false)} disabled={sending}>No</button>
          </div>
        </div>}
        {step === 'done' && <div className="sv-step sv-done">
          <Image className="fb-art" src="/assets/hide-me/goodbye.webp" alt="" width={80} height={80}/>
          <Dialog.Title className="sv-title">We&apos;re sad to see you go!</Dialog.Title>
          <p className="sv-lead" id="hm-lead">We will remove your profile as soon as possible. We will let you know via Discord! If you change your mind, contact the admin.</p>
          <div className="sv-actions hm-actions"><Dialog.Close className="sv-primary">Close</Dialog.Close></div>
        </div>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
