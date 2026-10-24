'use client';

import { useEffect, useRef, useState } from 'react';
import { Dialog } from 'radix-ui';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, Check, X } from '@/components/icons';
import { cn } from '@/lib/utils';
import { submitWeb3Form } from '@/lib/web3forms';

/** Optional career survey; only selected answers are sent to Web3Forms. */
const HIDDEN_KEY = 'elite-survey-hidden';

type Choice = { value: string; label: string };
const STATUS: Choice[] = [
  { value: 'full-time', label: 'Yes, full-time' }, { value: 'part-time', label: 'Yes, part-time' },
  { value: 'internship', label: 'Internship' }, { value: 'freelance', label: 'Freelance' }, { value: 'none', label: 'Not working' },
];
const SALARY: Choice[] = [
  { value: '<5k', label: 'Under 5,000 MAD' }, { value: '5-10k', label: '5,000 – 10,000 MAD' }, { value: '10-15k', label: '10,000 – 15,000 MAD' },
  { value: '15-25k', label: '15,000 – 25,000 MAD' }, { value: '25k+', label: 'Over 25,000 MAD' }, { value: 'skip', label: 'Prefer not to say' },
];
const PLACE: Choice[] = [
  { value: 'casablanca', label: 'Casablanca' }, { value: 'rabat', label: 'Rabat' }, { value: 'tangier', label: 'Tangier' }, { value: 'marrakech', label: 'Marrakech' },
  { value: 'morocco-other', label: 'Other city in Morocco' }, { value: 'remote', label: 'Remote' }, { value: 'abroad', label: 'Abroad' },
];
const SECTOR: Choice[] = [
  { value: 'software', label: 'Software & IT services' }, { value: 'finance', label: 'Banking & fintech' }, { value: 'telecom', label: 'Telecom' },
  { value: 'ecommerce', label: 'E-commerce' }, { value: 'startup', label: 'Startup' }, { value: 'consulting', label: 'Consulting & outsourcing' },
  { value: 'public', label: 'Public sector' }, { value: 'other', label: 'Other' },
];
const MOOD = ['Very unhappy', 'Unhappy', 'Okay', 'Happy', 'Very happy'];

type Answers = { status?: string; salary?: string; place?: string; sector?: string; satisfaction?: number };
const STEPS = ['intro', 'status', 'salary', 'place', 'sector', 'satisfaction', 'done'] as const;
type Step = typeof STEPS[number];

export function CareerSurvey() {
  const [hidden, setHidden] = useState(true);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('intro');
  const [answers, setAnswers] = useState<Answers>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  useEffect(() => { try { setHidden(localStorage.getItem(HIDDEN_KEY) === '1'); } catch { setHidden(false); } }, []);
  const hide = () => { setHidden(true); try { localStorage.setItem(HIDDEN_KEY, '1'); } catch { /* ignore */ } };

  const working = answers.status && answers.status !== 'none';
  const path: Step[] = working ? ['status', 'salary', 'place', 'sector', 'satisfaction'] : ['status'];
  const index = path.indexOf(step as Step);
  const next = async () => {
    if (submitting.current || !answered) return;
    if (index >= 0 && index < path.length - 1) {
      setStep(path[index + 1]);
      return;
    }
    submitting.current = true;
    setSending(true);
    setError('');
    const label = (choices: Choice[], value?: string) => choices.find((choice) => choice.value === value)?.label ?? '';
    try {
      await submitWeb3Form('Elite 1337 — Career survey', {
        employment_status: label(STATUS, answers.status),
        ...(working ? {
          monthly_net_salary: label(SALARY, answers.salary),
          work_location: label(PLACE, answers.place),
          sector: label(SECTOR, answers.sector),
          job_satisfaction: `${answers.satisfaction}/5 — ${MOOD[(answers.satisfaction ?? 1) - 1]}`,
        } : {}),
      });
      setStep('done');
    } catch {
      setError('Your answers could not be sent. Please try again in a moment.');
    } finally {
      submitting.current = false;
      setSending(false);
    }
  };
  const back = () => { setError(''); setStep(index > 0 ? path[index - 1] : 'intro'); };
  const pick = (key: keyof Answers, value: string | number) => setAnswers((current) => ({ ...current, [key]: value }));
  const answered = step === 'status' ? !!answers.status : step === 'salary' ? !!answers.salary : step === 'place' ? !!answers.place : step === 'sector' ? !!answers.sector : step === 'satisfaction' ? !!answers.satisfaction : true;

  function change(next: boolean) {
    if (submitting.current) return;
    setOpen(next);
    if (!next && step === 'done') hide();
    if (next && step === 'done') { setStep('intro'); setAnswers({}); }
  }

  if (hidden) return null;
  const options = (key: 'status' | 'salary' | 'place' | 'sector', choices: Choice[]) => <div className="sv-options" role="radiogroup">
    {choices.map((choice) => <button key={choice.value} type="button" role="radio" disabled={sending} aria-checked={answers[key] === choice.value} className={cn('sv-option', answers[key] === choice.value && 'is-picked')} onClick={() => pick(key, choice.value)}>
      <span>{choice.label}</span>{answers[key] === choice.value && <Check size={14}/>}
    </button>)}
  </div>;

  return <Dialog.Root open={open} onOpenChange={change}>
    <div className="sv-pill">
      <Dialog.Trigger className="sv-pill-open"><Image src="/assets/survey/job-icon.webp" alt="" width={28} height={28}/><span>Career survey · 1 min</span></Dialog.Trigger>
      <button type="button" className="sv-pill-hide" onClick={hide} disabled={sending} aria-label="Hide the career survey"><X size={13}/></button>
    </div>
    <Dialog.Portal>
      <Dialog.Overlay className="sv-overlay"/>
      <Dialog.Content className="sv-dialog" aria-describedby={step === 'intro' ? 'sv-privacy' : undefined} aria-busy={sending}>
        <Dialog.Close className="sv-close" aria-label="Close" disabled={sending}><X size={16}/></Dialog.Close>
        {step !== 'intro' && step !== 'done' && <div className="sv-progress" aria-hidden="true"><span style={{ transform: `scaleX(${(index + 1) / path.length})` }}/></div>}

        {step === 'intro' && <div className="sv-step">
          <Image className="sv-job-art" src="/assets/survey/job-icon.webp" alt="" width={88} height={88}/>
          <Dialog.Title className="sv-title">Where did 1337 take you?</Dialog.Title>
          <p className="sv-lead">Five quick questions about your job, so students can see what life looks like after Common Core.</p>
          <p className="sv-social-proof"><strong>54 students</strong> shared their experience!</p>
          <p className="sv-privacy" id="sv-privacy"><Image src="/assets/survey/anonymous-icon.webp" alt="" width={32} height={32} unoptimized/><span><strong>Anonymous.</strong> Your answers are not linked to your name, your login or your 42 account.</span></p>
          <div className="sv-actions"><button type="button" className="sv-secondary" onClick={() => change(false)}>Maybe later</button><button type="button" className="sv-primary" onClick={() => setStep('status')}>Start<ArrowRight size={16}/></button></div>
        </div>}

        {step === 'status' && <div className="sv-step"><Dialog.Title className="sv-title">Are you working now?</Dialog.Title>{options('status', STATUS)}</div>}
        {step === 'salary' && <div className="sv-step"><Dialog.Title className="sv-title">What's your monthly salary?</Dialog.Title><p className="sv-hint">Net, per month.</p>{options('salary', SALARY)}</div>}
        {step === 'place' && <div className="sv-step"><Dialog.Title className="sv-title">Where do you work?</Dialog.Title>{options('place', PLACE)}</div>}
        {step === 'sector' && <div className="sv-step"><Dialog.Title className="sv-title">Which sector?</Dialog.Title>{options('sector', SECTOR)}</div>}
        {step === 'satisfaction' && <div className="sv-step">
          <Dialog.Title className="sv-title">How satisfied are you with your job?</Dialog.Title>
          <div className="sv-scale" role="radiogroup" aria-label="Job satisfaction from 1 to 5">
            {MOOD.map((label, i) => <button key={label} type="button" role="radio" disabled={sending} aria-checked={answers.satisfaction === i + 1} aria-label={label} title={label} className={cn('sv-scale-dot', answers.satisfaction === i + 1 && 'is-picked')} onClick={() => pick('satisfaction', i + 1)}><span className="sv-mood-art" style={{ backgroundPosition: `${i * 25}% center` }} aria-hidden="true"/><span>{i + 1}</span></button>)}
          </div>
          <div className="sv-scale-ends" aria-hidden="true"><span>Very unhappy</span><span>Very happy</span></div>
        </div>}

        {step === 'done' && <div className="sv-step sv-done">
          <span className="sv-icon is-done"><Check size={22}/></span>
          <Dialog.Title className="sv-title">Thank you!</Dialog.Title>
          <p className="sv-lead">Your answers help every student see what comes after 1337. They stay anonymous.</p>
          <div className="sv-actions"><Dialog.Close className="sv-primary">Close</Dialog.Close></div>
        </div>}

        {error && <p className="sv-hint" role="alert">{error}</p>}
        {step !== 'intro' && step !== 'done' && <div className="sv-actions">
          <button type="button" className="sv-secondary" onClick={back} disabled={sending}><ArrowLeft size={16}/>Back</button>
          <button type="button" className="sv-primary" onClick={next} disabled={!answered || sending}>{sending ? <span role="status">Sending…</span> : index === path.length - 1 ? <><Image src="/assets/survey/anonymous-icon.webp" alt="" width={24} height={24} unoptimized/>Submit anonymously</> : <>Next<ArrowRight size={16}/></>}</button>
        </div>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
