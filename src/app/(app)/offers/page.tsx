import Image from 'next/image';
import { ArrowUpRight, Check } from '@/components/icons';
import { requireStudent } from '@/lib/guard';
import { OFFERS, OFFERS_CHECKED, type Offer } from '@/lib/offers';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Student Offers' };

function Logo({ offer }: { offer: Offer }) {
  return <span className="of-logo" aria-hidden="true">
    <Image src={offer.logo} alt="" width={72} height={72} sizes="72px"/>
  </span>;
}

export default async function OffersPage() {
  await requireStudent();
  return <main className="shell of">
    <header className="of-head">
      <h1>Offers</h1>
      <p>Tools to build. Perks to enjoy. All in one place.</p>
    </header>
    <ul className="of-grid">
      {OFFERS.map((offer) => <li key={offer.id} className={cn('of-card', offer.featured && 'is-featured')}>
        <div className="of-top">
          <Logo offer={offer}/>
          <div className="of-top-meta"><span className="of-value">{offer.value}</span>{offer.featured && <span className="of-start">Start here</span>}</div>
        </div>
        <h2>{offer.name}</h2>
        {offer.card && <span className="of-card-req" title="A credit or debit card is required to sign up"><Image src="/assets/offers/card-required-3d.webp" alt="" width={28} height={28} sizes="28px"/>Card required</span>}
        <p className="of-summary">{offer.summary}</p>
        {offer.steps && <ul className="of-steps">{offer.steps.map((step) => <li key={step}><Check size={13}/>{step}</li>)}</ul>}
        {offer.note && <p className="of-note">{offer.note}</p>}
        <div className="of-actions"><a className="of-cta" href={offer.url} target="_blank" rel="noopener noreferrer" data-umami-event="offer-click" data-umami-event-offer={offer.id}>{offer.cta}<ArrowUpRight size={15} weight="bold"/></a></div>
      </li>)}
    </ul>
    <p className="of-foot">Checked {OFFERS_CHECKED}. Eligibility and terms vary by provider.</p>
  </main>;
}
