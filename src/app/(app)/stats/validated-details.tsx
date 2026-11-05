'use client';

import { Dialog } from 'radix-ui';
import { Expand, X } from '@/components/icons';
import { LanguageIcon } from '@/components/language-icon';

const fmt = (value: number) => value.toLocaleString('en-US');

/** The whole ranking behind the top 10, with each project's share: the card cuts long names, the dialog shows them in full. */
export function ValidatedDetails({ items, period }: { items: { project: string; count: number }[]; period: string }) {
  const total = items.reduce((sum, item) => sum + item.count, 0), peak = Math.max(1, ...items.map((item) => item.count));
  return <Dialog.Root>
    <Dialog.Trigger className="st-enlarge" aria-label="See all validated projects"><Expand size={16}/></Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="sv-overlay"/>
      <Dialog.Content className="sv-dialog st-details" aria-describedby="st-details-lead">
        <Dialog.Close className="sv-close" aria-label="Close"><X size={16}/></Dialog.Close>
        <Dialog.Title className="sv-title">Most validated</Dialog.Title>
        <p className="sv-lead" id="st-details-lead">{fmt(total)} validated across {items.length} {items.length === 1 ? 'project' : 'projects'} in the {period}.</p>
        <ol className="st-validated-top st-details-list">{items.map((item) => <li key={item.project}>
          <span className="st-validated-name"><LanguageIcon project={item.project}/>{item.project}</span>
          <b>{fmt(item.count)}<small>{Math.max(1, Math.round(item.count / total * 100))}%</small></b>
          <i aria-hidden="true"><em style={{ width: `${item.count / peak * 100}%` }}/></i>
        </li>)}</ol>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
