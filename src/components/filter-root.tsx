'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Collapsible } from '@/components/ui/collapsible';

const MOBILE = '(max-width: 1023px)';

/**
 * The filter panel's open state. On phones and tablets, where it is a dialog, picking a filter closes it so the
 * student sees the result right away; on desktop it stays open beside the list.
 */
export function FilterRoot({ defaultOpen, className, children }: { defaultOpen: boolean; className: string; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('.pl-panel a[href]');
      if (!link || !element.contains(link) || !matchMedia(MOBILE).matches) return;
      // Tapping the filter already picked changes nothing, so the dialog stays open for another choice.
      if (link.hasAttribute('data-active') || link.getAttribute('aria-current') === 'true') return;
      setOpen(false);
    };
    element.addEventListener('click', onClick);
    return () => element.removeEventListener('click', onClick);
  }, []);

  return <Collapsible ref={root} open={open} onOpenChange={setOpen} className={className}>{children}</Collapsible>;
}
