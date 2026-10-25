'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Dialog } from 'radix-ui';
import { usePathname } from 'next/navigation';
import { X } from '@/components/icons';
import { cn } from '@/lib/utils';
import { sendFeedback } from '@/components/feedback-actions';

/** Bug reports and feedback, saved for the team in our database. The login is only attached when the student opts in. */
const KINDS = [
  { value: 'bug', label: 'Bug', title: 'Something is broken' },
  { value: 'idea', label: 'Idea', title: 'I have an idea' },
  { value: 'other', label: 'Other', title: 'Something else' },
] as const;
type Kind = typeof KINDS[number]['value'];
const MAX = 2000;

export function FeedbackButton({ login }: { login: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('bug');
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  const change = (next: boolean) => {
    if (submitting.current) return;
    setOpen(next);
    if (next && sent) { setSent(false); setMessage(''); setKind('bug'); setReply(true); }
    if (!next) setError('');
  };

  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = message.trim();
    if (submitting.current || text.length < 3) return;
    // Bots fill hidden fields; people never see this one.
    if ((new FormData(event.currentTarget).get('botcheck'))) return;
    submitting.current = true;
    setSending(true);
    setError('');
    try {
      const result = await sendFeedback({ kind, message: text, page: pathname, screen: `${window.innerWidth}×${window.innerHeight}`, reply });
      if (result === 'sent') setSent(true);
      else setError(result === 'limited' ? 'You have sent a lot of feedback this hour. Please try again later.' : 'Your message could not be sent. Please try again in a moment.');
    } catch {
      setError('Your message could not be sent. Please try again in a moment.');
    } finally {
      submitting.current = false;
      setSending(false);
    }
  };

  return <Dialog.Root open={open} onOpenChange={change}>
    <Dialog.Trigger className="sv-pill fb-pill" aria-label="Feedback"><Image src="/assets/feedback/chat.webp" alt="" width={28} height={28}/><span>Feedback</span></Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="sv-overlay"/>
      <Dialog.Content className="sv-dialog" aria-busy={sending} aria-describedby={undefined}>
        <Dialog.Close className="sv-close" aria-label="Close" disabled={sending}><X size={16}/></Dialog.Close>
        {sent ? <div className="sv-step sv-done">
          <Image className="fb-art" src="/assets/feedback/sent.webp" alt="" width={80} height={80}/>
          <Dialog.Title className="sv-title">Thanks, got it!</Dialog.Title>
          <p className="sv-lead">Every report is read by the team.</p>
          <div className="sv-actions"><Dialog.Close className="sv-primary">Close</Dialog.Close></div>
        </div> : <form className="sv-step" onSubmit={send}>
          <Image className="fb-art" src="/assets/feedback/chat.webp" alt="" width={80} height={80}/>
          <Dialog.Title className="sv-title">Report a bug or share feedback</Dialog.Title>
          <p className="sv-lead">Tell us what went wrong or what would make Elite 1337 better.</p>
          <div className="fb-kinds" role="radiogroup" aria-label="Type">
            {KINDS.map((item) => <button key={item.value} type="button" role="radio" aria-checked={kind === item.value} title={item.title} className={cn('sv-option', kind === item.value && 'is-picked')} disabled={sending} onClick={() => setKind(item.value)}>{item.label}</button>)}
          </div>
          <label className="fb-field">
            <span className="sr-only">Message</span>
            <textarea value={message} onChange={(event) => setMessage(event.target.value.slice(0, MAX))} rows={5} maxLength={MAX} required disabled={sending}
              placeholder={kind === 'bug' ? 'What happened, and what did you expect?' : kind === 'idea' ? 'What would you like to see?' : 'Your message'}/>
            <small aria-hidden="true">{message.length}/{MAX}</small>
          </label>
          <input type="checkbox" name="botcheck" className="fb-bot" tabIndex={-1} autoComplete="off" aria-hidden="true"/>
          <label className="fb-reply"><input type="checkbox" checked={reply} onChange={(event) => setReply(event.target.checked)} disabled={sending}/><span>Add my login (<b>{login}</b>) so we can reply</span></label>
          {error && <p className="sv-hint fb-error" role="alert">{error}</p>}
          <div className="sv-actions">
            <button type="button" className="sv-secondary" onClick={() => change(false)} disabled={sending}>Cancel</button>
            <button type="submit" className="sv-primary" disabled={sending || message.trim().length < 3}>{sending ? <span role="status">Sending…</span> : 'Send'}</button>
          </div>
        </form>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
