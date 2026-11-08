'use client';

import { useState } from 'react';
import { Check, Copy } from '@/components/icons';

/** A read-only snippet with a Copy button; the button says "Copied" for a moment so the click is not silent. */
export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked: the text can still be selected by hand */ }
  };
  return <div className="cd-field">
    <div className="cd-field-head"><span>{label}</span><button type="button" className="cd-copy" onClick={copy}>{copied ? <Check size={14}/> : <Copy size={14}/>}{copied ? 'Copied' : 'Copy'}</button></div>
    <textarea readOnly rows={Math.min(8, Math.ceil(value.length / 30))} value={value} aria-label={label} onFocus={(event) => event.currentTarget.select()}/>
  </div>;
}
