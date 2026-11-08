'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, GitHub, LinkIcon, Palette, Picture, Sun, TextAa, Upload, UserRound } from '@/components/icons';
import { CodeBlock } from '@/components/code-block';
import { ACCENTS, ACCENT_COLORS, ARTS, DEFAULT_STYLE, FONTS, FONT_LABELS, THEMES, THEME_LABELS, styleQuery, type CardStyle } from '@/lib/card-style';
import { lumaFromRgba } from '@/lib/card-art';
import { chooseGithubPicture, chooseIntraPhoto, chooseLinkPicture, chooseUploadedPicture, type PictureResult } from '@/app/(app)/card/actions';
import { cn } from '@/lib/utils';

type Choice = 'intra' | 'upload' | 'github' | 'link';
export type CurrentPicture = { source: 'upload' | 'github' | 'link' } | null;
const TABS = [
  { id: 'intra', label: '42 photo', Icon: UserRound },
  { id: 'upload', label: 'Upload', Icon: Upload },
  { id: 'github', label: 'GitHub', Icon: GitHub },
  { id: 'link', label: 'Link', Icon: LinkIcon },
] as const;

/** Shrinks the picked image to the card's gray cells in the browser and returns them as base64, so the file never leaves the device. */
async function fileToCells(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => { const element = new Image(); element.onload = () => resolve(element); element.onerror = () => reject(new Error('unreadable')); element.src = url; });
    const scale = Math.min(1, 480 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no canvas');
    context.fillStyle = '#161b22'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return btoa(String.fromCharCode(...lumaFromRgba(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)));
  } finally { URL.revokeObjectURL(url); }
}

/** The picture picker (left) and the card with its snippets (right). Saving refreshes the card at once. */
export function CardPicture({ path, current, origin }: { path: string; current: CurrentPicture; origin: string }) {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice>(current ? current.source : 'intra');
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState<PictureResult | null>(null);
  const [pending, start] = useTransition();
  const [text, setText] = useState('');
  const [over, setOver] = useState(false);
  const [style, setStyle] = useState<CardStyle>(DEFAULT_STYLE);
  const extra = styleQuery(style);
  const url = `${origin}${path}${extra}`;
  const tweak = <K extends keyof CardStyle>(key: K, value: CardStyle[K]) => setStyle((previous) => ({ ...previous, [key]: value }));

  const run = (job: () => Promise<PictureResult>) => start(async () => {
    setStatus(null);
    try {
      const result = await job();
      setStatus(result);
      if (result.ok) { setVersion((value) => value + 1); router.refresh(); }
    } catch { setStatus({ ok: false, message: 'Something went wrong, try again.' }); }
  });
  const pick = (next: Choice) => {
    setChoice(next); setStatus(null); setText('');
    if (next === 'intra') run(chooseIntraPhoto);
  };
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    run(() => choice === 'github' ? chooseGithubPicture(text) : chooseLinkPicture(text));
  };
  const take = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 12 * 1024 * 1024) return setStatus({ ok: false, message: 'Pick an image under 12 MB.' });
    run(async () => { try { return await chooseUploadedPicture(await fileToCells(file)); } catch { return { ok: false, message: 'Could not read that image.' }; } });
  };
  const upload = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ''; take(file); };

  return <>
    <aside className="pl-side">
      <section className="pc-head">
        <h1>Rank card</h1>
        <p>Show your rank on your GitHub profile. It updates by itself.</p>
        <nav className="fa-tabs pc-tabs" aria-label="Card picture">
          {TABS.map(({ id, label, Icon }) => <button key={id} type="button" className={cn('fa-tab', choice === id && 'is-picked')} aria-pressed={choice === id} disabled={pending} onClick={() => pick(id)}><Icon size={18}/>{label}</button>)}
        </nav>
      </section>
      {choice === 'upload' && <label className={cn('cd-drop', over && 'is-over')} onDragEnter={() => setOver(true)} onDragLeave={() => setOver(false)} onDrop={() => setOver(false)}>
        <Upload size={26}/>
        <strong>{pending ? 'Saving…' : 'Choose an image'}</strong>
        <span>or drop one here</span>
        <input type="file" accept="image/*" onChange={upload} disabled={pending} aria-label="Choose an image"/>
      </label>}
      {(choice === 'github' || choice === 'link') && <form className="pl-searchbar" onSubmit={submit}>
        {choice === 'github' ? <GitHub size={20} className="pl-searchbar-icon"/> : <LinkIcon size={20} className="pl-searchbar-icon"/>}
        <input value={text} onChange={(event) => setText(event.target.value)} maxLength={choice === 'github' ? 40 : 500} placeholder={choice === 'github' ? 'GitHub username' : 'https://…/photo.jpg'} aria-label={choice === 'github' ? 'GitHub username' : 'Image link'} spellCheck={false} autoCapitalize="none" autoComplete="off" required/>
        <button type="submit" className="pl-searchbar-go" aria-label="Save" disabled={pending}><ArrowRight size={20} weight="bold"/></button>
      </form>}
      <div className="pl-groups cd-tweaks">
        <div className="pl-chip-group" role="group" aria-label="Theme"><span className="pl-chip-label"><Sun size={17}/>Theme</span>
          <div className="pl-chips">{THEMES.map((id) => <button key={id} type="button" className="pl-chip is-mint" data-active={style.theme === id || undefined} aria-pressed={style.theme === id} onClick={() => tweak('theme', id)}>{THEME_LABELS[id]}</button>)}</div></div>
        <div className="pl-chip-group" role="group" aria-label="Color"><span className="pl-chip-label"><Palette size={17}/>Color</span>
          <div className="pl-chips">{ACCENTS.map((id) => <button key={id} type="button" className={cn('cd-swatch', style.accent === id && 'is-active')} style={{ '--swatch': ACCENT_COLORS[id].dark } as React.CSSProperties} aria-pressed={style.accent === id} aria-label={id} title={id} onClick={() => tweak('accent', id)}/>)}</div></div>
        <div className="pl-chip-group" role="group" aria-label="Font"><span className="pl-chip-label"><TextAa size={17}/>Font</span>
          <div className="pl-chips">{FONTS.map((id) => <button key={id} type="button" className="pl-chip is-mint" data-active={style.font === id || undefined} aria-pressed={style.font === id} onClick={() => tweak('font', id)}>{FONT_LABELS[id]}</button>)}</div></div>
        <div className="pl-chip-group" role="group" aria-label="Picture style"><span className="pl-chip-label"><Picture size={17}/>Picture style</span>
          <div className="pl-chips">{ARTS.map((id) => <button key={id} type="button" className="pl-chip is-mint" data-active={style.art === id || undefined} aria-pressed={style.art === id} onClick={() => tweak('art', id)}>{id === 'ascii' ? 'ASCII' : 'Blocks'}</button>)}
            <button type="button" className="pl-chip is-mint" data-active={style.logo || undefined} aria-pressed={style.logo} onClick={() => tweak('logo', !style.logo)}>1337 logo</button></div></div>
      </div>
      <p className={cn('cd-status', status && (status.ok ? 'is-ok' : 'is-error'))} role="status" aria-live="polite">{status?.message}</p>
    </aside>
    <section className="pl-list" aria-label="Rank card">
      <img className="cd-preview" src={`${path}&v=${version}${extra}`} alt="Your rank card" width={840} height={320}/>
      <h2 className="cd-title">Add it to your README</h2>
      <p className="cd-sub">Paste one of these in the README of your profile repository, the one named after your GitHub username.</p>
      <CodeBlock note="Public link: anyone with it sees this card." tabs={[
        { id: 'md', label: 'Markdown', value: `[![Elite 1337 rank](${url})](${origin})` },
        { id: 'html', label: 'HTML', value: `<a href="${origin}"><img src="${url}" alt="Elite 1337 rank" width="840"></a>` },
      ]}/>
    </section>
  </>;
}
