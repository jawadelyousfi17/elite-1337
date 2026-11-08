'use client';

import { useState } from 'react';
import { Check, Copy, Info } from '@/components/icons';
import { cn } from '@/lib/utils';

export type CodeTab = { id: string; label: string; value: string };

/** A snippet card: tabs on the left of the header, an info tip and a copy button on the right, the code below. */
export function CodeBlock({ tabs, note }: { tabs: CodeTab[]; note?: string }) {
  const [active, setActive] = useState(tabs[0].id);
  const [copied, setCopied] = useState(false);
  const tab = tabs.find((entry) => entry.id === active) ?? tabs[0];
  const copy = async () => {
    try { await navigator.clipboard.writeText(tab.value); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked: the text can still be selected by hand */ }
  };
  return <div className="cd-code">
    <div className="cd-code-head">
      <div className="cd-code-tabs" role="tablist">
        {tabs.map((entry) => <button key={entry.id} type="button" role="tab" aria-selected={entry.id === tab.id} className={cn('cd-code-tab', entry.id === tab.id && 'is-active')} onClick={() => { setActive(entry.id); setCopied(false); }}>{entry.label}</button>)}
      </div>
      <div className="cd-code-tools">
        {note && <span className="cd-code-icon pl-anon-tip" tabIndex={0} role="note" data-tip={note} aria-label={note}><Info size={20}/></span>}
        <button type="button" className="cd-code-icon" onClick={copy} aria-label={copied ? 'Copied' : `Copy ${tab.label}`}>{copied ? <Check size={20}/> : <Copy size={20}/>}</button>
      </div>
    </div>
    <pre className="cd-code-body" tabIndex={0}>{tab.value}</pre>
  </div>;
}
