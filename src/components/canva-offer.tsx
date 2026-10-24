'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Popover } from 'radix-ui';
import { WhatsApp, X } from '@/components/icons';

const WHATSAPP_URL = 'https://wa.me/212651754580';
const PRICE = '19 DH';
const MOBILE_QUERY = '(max-width: 700px), (hover: none) and (pointer: coarse)';

export function CanvaOffer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const closeOnMobile = () => { if (media.matches) setOpen(false); };
    media.addEventListener('change', closeOnMobile);
    return () => media.removeEventListener('change', closeOnMobile);
  }, []);

  return <Popover.Root open={open} onOpenChange={(next) => setOpen(next && !window.matchMedia(MOBILE_QUERY).matches)}>
    <li className="of-card of-canva">
        <div className="of-top">
          <span className="of-logo" aria-hidden="true"><Image src="/assets/offers/canva-3d.webp" alt="" width={72} height={72} sizes="72px"/></span>
          <span className="of-value">{PRICE}</span>
        </div>
        <h2>Canva Pro</h2>
        <p className="of-summary"><span className="of-ad">Ad</span>Ask the seller about Canva Pro access and what’s included.</p>
        <div className="of-actions of-canva-actions">
          <Popover.Trigger asChild><button type="button" className="of-cta of-canva-desktop"><WhatsApp size={17}/>Chat with the seller</button></Popover.Trigger>
          <a className="of-cta of-canva-mobile" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"><WhatsApp size={17}/>Chat with the seller</a>
        </div>
    </li>
    <Popover.Portal>
      <Popover.Content side="top" align="center" sideOffset={8} collisionPadding={16} className="of-contact" aria-label="Canva Pro on WhatsApp">
        <Image className="of-contact-qr" src="/assets/offers/canva-whatsapp-qr.png" alt="Scan to chat on WhatsApp with +212 651 754 580" width={112} height={112} unoptimized/>
        <div className="of-contact-info">
          <span className="of-contact-hint">Scan to chat on WhatsApp</span>
          <span className="of-contact-number">+212 651 754 580</span>
          <a className="of-contact-wa" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" data-umami-event="offer-click" data-umami-event-offer="canva"><WhatsApp size={16}/>Open WhatsApp</a>
        </div>
        <Popover.Close className="of-contact-close" aria-label="Close WhatsApp details"><X size={14}/></Popover.Close>
        <Popover.Arrow className="of-contact-arrow" width={14} height={7}/>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
