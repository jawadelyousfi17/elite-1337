'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Popover } from 'radix-ui';
import { ArrowUpRight, Check, Coffee, Heart, X } from '@/components/icons';
import { track } from '@/lib/analytics';
import './landing-support.css';

const treats = [
  { name: 'Coffee', image: '/assets/support/coffee-cutout.webp', amount: 1, message: 'Cafe dahab is a wonderfull place !' },
  { name: 'Tacos', image: '/assets/support/tacos-cutout.webp', amount: 5, message: 'Thanks! humm, snak king looks cool' },
  { name: 'Tajine', image: '/assets/support/tajine-cutout.webp', amount: 10, message: 'Thanks! A tajine with the crew sounds perfect!' },
] as const;

/** Donations are handled on Ko-fi; it opens in a new tab while the popover celebrates. */
const KOFI_URL = 'https://ko-fi.com/furry_dev';

const quotes = ['You know, Claude is expensive these days.', 'Vercel is so greedy :('];

export function LandingSupport({ variant = 'landing' }: { variant?: 'landing' | 'nav' }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const [quote, setQuote] = useState(0);
  useEffect(() => { setQuote(Math.floor(Math.random() * quotes.length)); }, []);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverOpened = useRef(false);
  const content = useRef<HTMLDivElement>(null);
  const treat = treats[selected];

  const clearHover = () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); };
  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);

  useEffect(() => {
    if (!open || !celebrating) return;
    const timer = window.setTimeout(() => setOpen(false), 3400);
    return () => window.clearTimeout(timer);
  }, [open, celebrating]);

  function changeOpen(next: boolean) {
    clearHover();
    // Each open shows a different quote than the last one, starting from a random one.
    if (next && !open) { setSelected(0); setCelebrating(false); setQuote((current) => (current + 1) % quotes.length); }
    setOpen(next);
  }

  const hover = (next: boolean) => (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    clearHover();
    if (celebrating || (open && !hoverOpened.current)) return;
    if (!next && content.current?.contains(document.activeElement)) return;
    hoverTimer.current = setTimeout(() => {
      if (next && !open) hoverOpened.current = true;
      changeOpen(next);
    }, next ? 120 : 220);
  };

  return <Popover.Root open={open} onOpenChange={changeOpen}>
    <Popover.Trigger asChild>
      {variant === 'nav'
        ? <button className="support-nav-trigger" type="button" aria-label="Buy us a coffee" onPointerEnter={hover(true)} onPointerLeave={hover(false)} onPointerDown={() => { clearHover(); hoverOpened.current = false; }}><Coffee size={20}/></button>
        : <button className="support-trigger" type="button" onPointerEnter={hover(true)} onPointerLeave={hover(false)} onPointerDown={() => { clearHover(); hoverOpened.current = false; }}><span className="support-trigger-icon" aria-hidden="true"><Coffee size={17} weight="bold"/></span>Buy us a coffee<ArrowUpRight size={15} weight="bold" className="support-trigger-arrow"/></button>}
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content ref={content} side={variant === 'nav' ? 'bottom' : 'top'} align={variant === 'nav' ? 'end' : 'center'} sideOffset={12} collisionPadding={16} className="support-dialog" aria-labelledby="support-title" onPointerEnter={hover(true)} onPointerLeave={hover(false)} onOpenAutoFocus={(event) => { if (hoverOpened.current) event.preventDefault(); }} onCloseAutoFocus={(event) => { if (hoverOpened.current) event.preventDefault(); }}>
        <Popover.Close className="support-close" aria-label="Close"><X size={16}/></Popover.Close>
        <header className="support-header">
          <h2 id="support-title" className="support-title">Buy us a coffee</h2>
          <p className="support-quote">“{quotes[quote]}”</p>
        </header>
        {celebrating ? <div className="support-success" role="status" aria-live="polite">
          <div className="support-confetti" aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <span key={i} style={{ '--x': `${Math.cos(i * 2.4) * (90 + i % 4 * 22)}px`, '--y': `${Math.sin(i * 2.4) * 95 - 45}px`, '--spin': `${i * 73}deg`, '--delay': `${i % 5 * 35}ms`, '--color': ['#cafbd2', '#f2d1fb', '#fff0b5', '#d9f7fa'][i % 4] } as CSSProperties}/>)}</div>
          <img className="support-success-image" src={treat.image} alt="" width={100} height={100}/>
          <h3>{treat.message}</h3>
        </div> : <form className="support-body" onSubmit={(event) => { event.preventDefault(); clearHover(); track('donate-click', { treat: treat.name, where: variant }); window.open(KOFI_URL, '_blank', 'noopener,noreferrer'); setCelebrating(true); }}>
          <fieldset className="support-options">
            <legend className="sr-only">Choose a treat</legend>
            {treats.map((item, index) => <label className="support-option" key={item.name} data-selected={selected === index}>
              <input type="radio" name="treat" value={item.name} checked={selected === index} onChange={() => setSelected(index)}/>
              <span className="support-food-frame"><img className="support-food" src={item.image} alt="" width={144} height={144}/></span>
              <span className="support-option-copy"><strong>{item.name}</strong></span>
              <span className="support-selected" aria-hidden="true"><Check size={13}/></span>
              <span className="support-price">${item.amount}<small>USD</small></span>
            </label>)}
          </fieldset>
          <button className="support-submit" type="submit">Send some love <span>${treat.amount} <Heart size={16} weight="fill"/></span></button>
        </form>}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
