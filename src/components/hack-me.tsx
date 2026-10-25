'use client';

import { Dialog } from 'radix-ui';
import Image from 'next/image';
import { useState } from 'react';
import { ArrowUpRight, Check, Discord, Mail, X } from '@/components/icons';
import { HackerBadge } from '@/components/hacker-badge';
import { CONTACT_DISCORD, CONTACT_EMAIL } from '@/lib/site';

/** Desktop-only invitation to look for vulnerabilities; reports go to the maintainer directly, there is no form. */
const RULES = [
  'Test elite-1337.app with your own account only.',
  'Stop at proof: never read, change or delete other students’ data.',
  'No DoS, flooding or mass automated scans.',
  '42 Intra, Vercel, Neon and Discord are out of scope.',
  'Report privately and keep it quiet until it is fixed.',
];

export function HackMe() {
  const [copied, setCopied] = useState(false);
  // Discord has no profile links for usernames, so the button copies it instead.
  const copyDiscord = () => navigator.clipboard?.writeText(CONTACT_DISCORD).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }, () => {});
  return <Dialog.Root>
    <Dialog.Trigger className="sv-pill fb-pill hk-pill" aria-label="Try hack me"><Image src="/assets/hack-me/security-shield.webp" alt="" width={28} height={28}/><span>Try hack me</span></Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="sv-overlay"/>
      <Dialog.Content className="sv-dialog" aria-describedby="hk-lead">
        <Dialog.Close className="sv-close" aria-label="Close"><X size={16}/></Dialog.Close>
        <div className="sv-step">
          <Image className="fb-art" src="/assets/hack-me/security-shield.webp" alt="" width={80} height={80}/>
          <Dialog.Title className="sv-title">Try hack me</Dialog.Title>
          <p className="sv-lead" id="hk-lead">You have the green light to pentest Elite 1337. Find a real vulnerability and you get the <HackerBadge/> badge next to your login, everywhere on the site.</p>
          <ul className="hk-rules">{RULES.map((rule) => <li key={rule}><span aria-hidden="true">✅</span>{rule}</li>)}</ul>
          <div className="sv-actions">
            <span className="hk-contacts">
              <button type="button" className="hk-contact is-discord" onClick={copyDiscord} aria-label={copied ? 'Discord username copied' : `Copy Discord username ${CONTACT_DISCORD}`}>
                {copied ? <Check size={22} weight="bold"/> : <Discord size={22} weight="fill"/>}
                <span className="hk-tip" aria-hidden="true">{copied ? 'Copied!' : <>Discord · <b>{CONTACT_DISCORD}</b> · click to copy</>}</span>
              </button>
              <a className="hk-contact is-mail" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Elite 1337 vulnerability report')}`} aria-label={`Email ${CONTACT_EMAIL}`}>
                <Mail size={22} weight="fill"/>
                <span className="hk-tip" aria-hidden="true">Email · <b>{CONTACT_EMAIL}</b></span>
              </a>
            </span>
            <a className="sv-primary" href="https://profile.intra.42.fr/users/jel-yous" target="_blank" rel="noopener noreferrer">jel-yous on Intra<ArrowUpRight size={14} weight="bold"/></a>
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
