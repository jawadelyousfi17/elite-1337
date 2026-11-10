'use client';

import { useEffect, useState } from 'react';
import { ACCENTS, ACCENT_COLORS, ARTS, DEFAULT_STYLE, FONTS, FONT_LABELS, THEMES, THEME_LABELS, styleQuery, type CardStyle } from '@/lib/card-style';
import { GITHUB_LOGIN, TEXT_FIELDS, cleanLogin, textQuery, type CardText } from '@/lib/github-input';

/** The 80s monitors draw in one color; picking one turns the CRT effect on, a modern theme turns it off. */
const RETRO = ['phosphor', 'amber', 'c64'] as const;
const MODERN = THEMES.filter((id): id is Exclude<typeof THEMES[number], typeof RETRO[number]> => !(RETRO as readonly string[]).includes(id));

type Field = { key: keyof CardText; label: string; placeholder: string };
const SECTIONS: { id: string; title: string; fields: Field[] }[] = [
  { id: 'basics', title: 'Basics', fields: [
    { key: 'name', label: 'Name', placeholder: 'Ada Lovelace' }, { key: 'role', label: 'Role', placeholder: 'Software engineer' },
    { key: 'host', label: 'Host', placeholder: '1337 Benguerir' }, { key: 'loc', label: 'Location', placeholder: 'Benguerir, Morocco' },
    { key: 'now', label: 'Building', placeholder: 'a tiny virtual machine' }, { key: 'fun', label: 'Fun fact (last line)', placeholder: 'I debug with a rubber duck' },
  ] },
  { id: 'setup', title: 'Setup', fields: [
    { key: 'os', label: 'OS', placeholder: 'Arch, macOS' }, { key: 'ide', label: 'IDE', placeholder: 'Neovim, VS Code' },
    { key: 'stack', label: 'Languages', placeholder: 'C, Go, TypeScript' }, { key: 'spoken', label: 'Spoken', placeholder: 'Arabic, French, English' },
    { key: 'hobbies', label: 'Hobbies', placeholder: 'Chess, retro games' },
  ] },
  { id: 'contact', title: 'Contact', fields: [
    { key: 'email', label: 'Email', placeholder: 'ada@example.com' }, { key: 'web', label: 'Website', placeholder: 'ada.dev' },
    { key: 'linkedin', label: 'LinkedIn', placeholder: 'ada-lovelace' }, { key: 'discord', label: 'Discord', placeholder: 'ada' },
    { key: 'x', label: 'X', placeholder: '@ada' },
  ] },
];

function Chips<T extends string>({ label, items, value, labels, onPick }: { label: string; items: readonly T[]; value: T; labels?: Record<T, string>; onPick: (id: T) => void }) {
  return <div className="gc-group" role="group" aria-label={label}><span className="gc-name">{label}</span>
    <div className="gc-chips">{items.map((id) => <button key={id} type="button" className="gc-chip" aria-pressed={value === id} onClick={() => onPick(id)}>{labels?.[id] ?? id}</button>)}</div></div>;
}

/** A snippet card with Markdown and HTML tabs and a copy button. */
function Snippet({ tabs }: { tabs: { id: string; label: string; value: string }[] }) {
  const [active, setActive] = useState(tabs[0].id);
  const [copied, setCopied] = useState(false);
  const tab = tabs.find((entry) => entry.id === active) ?? tabs[0];
  const copy = async () => { try { await navigator.clipboard.writeText(tab.value); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked: the text can still be selected by hand */ } };
  return <div className="gc-code">
    <div className="gc-code-head">
      <div role="tablist">{tabs.map((entry) => <button key={entry.id} type="button" role="tab" aria-selected={entry.id === tab.id} className="gc-tab" onClick={() => { setActive(entry.id); setCopied(false); }}>{entry.label}</button>)}</div>
      <button type="button" className={copied ? 'gc-copy is-copied' : 'gc-copy'} onClick={copy} aria-label={copied ? 'Copied' : `Copy ${tab.label}`} title={copied ? 'Copied' : 'Copy'}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{copied ? <path d="M5 12.5l4.5 4.5L19 7.5"/> : <><rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/></>}</svg>
      </button>
    </div>
    <pre tabIndex={0}>{tab.value}</pre>
  </div>;
}

/** Username, a few optional lines and the look; the card is a plain image link, so nothing is stored. */
export function CardMaker({ siteUrl }: { siteUrl: string }) {
  const [input, setInput] = useState('');
  const [text, setText] = useState<CardText>({});
  const [style, setStyle] = useState<CardStyle>({ ...DEFAULT_STYLE, logo: false });
  const [origin, setOrigin] = useState(siteUrl.replace(/\/$/, ''));
  const [tab, setTab] = useState('basics');
  const [submitted, setSubmitted] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { if (!siteUrl) setOrigin(window.location.origin); }, [siteUrl]);
  const tweak = <K extends keyof CardStyle>(key: K, value: CardStyle[K]) => setStyle((previous) => ({ ...previous, [key]: value }));

  // The card is made for the username that was submitted, not for every letter typed.
  const login = submitted, valid = GITHUB_LOGIN.test(login);
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const typed = cleanLogin(input);
    if (!GITHUB_LOGIN.test(typed)) { setNote('Enter a GitHub username, like octocat.'); return; }
    setNote(null); setInput(typed); setSubmitted(typed);
  };
  // The 1337 logo is opt-in on this card (`logo=1`), because it sits over the last lines of text.
  const query = `${styleQuery({ ...style, logo: true })}${style.logo ? '&logo=1' : ''}${textQuery(text)}`.slice(1);
  const path = valid ? `/api/gh/${login}.svg${query ? `?${query}` : ''}` : null;
  // The preview waits for a pause in typing, so each keystroke does not draw a card.
  useEffect(() => { const timer = setTimeout(() => { setShown(path); setFailed(false); }, 450); return () => clearTimeout(timer); }, [path]);
  // Fetching from GitHub takes a few seconds the first time: show it until the image has arrived.
  const loading = !!path && !failed && (path !== shown || loadedSrc !== shown);
  // A new username needs GitHub (a few seconds the first time); a changed field or look only redraws a card whose data is already cached.
  const user = (src: string | null) => src?.split('?')[0] ?? null;
  const fetching = loading && user(path) !== user(loadedSrc);
  const url = `${origin}${path ?? `/api/gh/your-username.svg${query ? `?${query}` : ''}`}`;
  const profile = `https://github.com/${valid ? login : ''}`;

  const filled = (keys: (keyof CardText)[]) => keys.some((key) => text[key]);
  // The bar starts at step 1: a username, then a card, then your details, then your look.
  const steps = [true, valid, filled(SECTIONS.flatMap((section) => section.fields.map((field) => field.key))), JSON.stringify(style) !== JSON.stringify({ ...DEFAULT_STYLE, logo: false })];

  return <div className="gc-grid">
    <section className="gc-panel gc-top">
      <h1>GitHub Card</h1>
      <div className="gc-steps" aria-hidden="true">{steps.map((done, index) => <span key={index} className={done ? 'is-done' : undefined}/>)}</div>
      <p className="gc-lead">A terminal-style profile card for your GitHub README. No sign-in, and you only show what you fill in.</p>
      <form className="gc-search" onSubmit={submit} noValidate>
        <label className="gc-field"><span className="gc-name">GitHub username <i>*</i></span>
          <span className="gc-search-row">
            <input value={input} onChange={(event) => { setInput(event.target.value); setNote(null); }} maxLength={80} placeholder="octocat" spellCheck={false} autoCapitalize="none" autoComplete="off" autoFocus aria-invalid={!!note} aria-describedby="gc-note"/>
            <button type="submit" className="gc-go" disabled={fetching && submitted === cleanLogin(input)}>{fetching && submitted === cleanLogin(input) ? 'Fetching…' : 'Generate'}</button>
          </span></label>
        <p id="gc-note" className="gc-note" role="status">{note}</p>
      </form>
    </section>
    <section className="gc-panel gc-preview" aria-label="Your card">
      <div className="gc-stage" aria-busy={loading}>
        {shown && !failed
          ? <img className={fetching ? 'gc-card is-loading' : 'gc-card'} src={shown} alt={`GitHub card of ${login}`} width={985} height={530} onLoad={() => setLoadedSrc(shown)} onError={() => setFailed(true)}/>
          : <div className={fetching ? 'gc-card gc-empty is-busy' : 'gc-card gc-empty'} role="status">{failed ? 'No GitHub user with that name.' : fetching ? '' : 'Enter your GitHub username and press Generate.'}</div>}
        {fetching && <div className="gc-busy" role="status"><span className="gc-spin" aria-hidden="true"/><strong>Fetching from GitHub…</strong></div>}
        {loading && !fetching && <span className="gc-updating" role="status"><span className="gc-spin" aria-hidden="true"/>Updating…</span>}
      </div>
      <h2>Add it to your README</h2>
      <p className="gc-sub">Paste one of these in the README of your profile repository, the one named after your username.</p>
      <Snippet tabs={[
        { id: 'md', label: 'Markdown', value: `[![${valid ? login : 'GitHub'} card](${url})](${profile})` },
        { id: 'html', label: 'HTML', value: `<a href="${profile}"><img src="${url}" alt="GitHub card" width="985"></a>` },
      ]}/>
    </section>
    <div className="gc-panel gc-form">
      <div className="gc-tabs" role="tablist" aria-label="Card details">
        {[...SECTIONS.map(({ id, title, fields }) => ({ id, title, used: fields.some(({ key }) => text[key]) })), { id: 'look', title: 'Look', used: JSON.stringify(style) !== JSON.stringify({ ...DEFAULT_STYLE, logo: false }) }].map(({ id, title, used }) =>
          <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls="gc-tabpanel" className="gc-tab" onClick={() => setTab(id)}>{title}{used && <i className="gc-dot" aria-label="filled in"/>}</button>)}
      </div>
      <div id="gc-tabpanel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {SECTIONS.filter((section) => section.id === tab).map(({ id, fields }) => <div key={id} className="gc-fields">{fields.map(({ key, label, placeholder }) => <label key={key} className="gc-field"><span className="gc-name">{label}</span>
          <input value={text[key] ?? ''} onChange={(event) => setText((previous) => ({ ...previous, [key]: event.target.value }))} maxLength={TEXT_FIELDS[key]} placeholder={placeholder} autoComplete="off"/></label>)}</div>)}
        {tab === 'look' && <div className="gc-look">
          <Chips label="Theme" items={MODERN} value={style.theme} labels={THEME_LABELS} onPick={(id) => setStyle((previous) => ({ ...previous, theme: id, crt: false }))}/>
          <div className="gc-group" role="group" aria-label="80s terminal"><span className="gc-name">80s terminal</span>
            <div className="gc-chips">{RETRO.map((id) => <button key={id} type="button" className="gc-chip" aria-pressed={style.theme === id} onClick={() => setStyle((previous) => ({ ...previous, theme: id, crt: true }))}>{THEME_LABELS[id]}</button>)}
              <button type="button" className="gc-chip" aria-pressed={style.crt} onClick={() => tweak('crt', !style.crt)}>CRT effect</button></div></div>
          <div className="gc-group" role="group" aria-label="Color"><span className="gc-name">Color</span>
            <div className="gc-chips">{ACCENTS.map((id) => <button key={id} type="button" className="gc-swatch" style={{ '--swatch': ACCENT_COLORS[id].dark } as React.CSSProperties} aria-pressed={style.accent === id} aria-label={id} title={id} onClick={() => tweak('accent', id)}/>)}</div></div>
          <Chips label="Font" items={FONTS} value={style.font} labels={FONT_LABELS} onPick={(id) => tweak('font', id)}/>
          <div className="gc-group" role="group" aria-label="Picture style"><span className="gc-name">Picture style</span>
            <div className="gc-chips">{ARTS.map((id) => <button key={id} type="button" className="gc-chip" aria-pressed={style.art === id} onClick={() => tweak('art', id)}>{id === 'ascii' ? 'ASCII' : 'Blocks'}</button>)}
              <button type="button" className="gc-chip" aria-pressed={style.logo} onClick={() => tweak('logo', !style.logo)}>1337 logo</button></div></div>
        </div>}
      </div>
    </div>
    <footer className="gc-foot">Made by the <a href="https://www.elite-1337.app">Elite 1337</a> community. Nothing is stored: your card is just a link.</footer>
  </div>;
}
