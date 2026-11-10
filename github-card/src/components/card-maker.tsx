'use client';

import { useEffect, useState } from 'react';
import { ACCENTS, ACCENT_COLORS, ARTS, DEFAULT_STYLE, FONTS, FONT_LABELS, THEMES, THEME_LABELS, styleQuery, type CardStyle } from '@/lib/card-style';
import { GITHUB_LOGIN, TEXT_FIELDS, cleanLogin, textQuery, type CardText } from '@/lib/github-input';

type Field = { key: keyof CardText; label: string; placeholder: string };
const SECTIONS: { title: string; fields: Field[] }[] = [
  { title: 'About you', fields: [
    { key: 'name', label: 'Name', placeholder: 'Ada Lovelace' }, { key: 'os', label: 'OS', placeholder: 'Arch, macOS' },
    { key: 'host', label: 'Host', placeholder: '1337 Benguerir' }, { key: 'role', label: 'Role', placeholder: 'Software engineer' },
    { key: 'ide', label: 'IDE', placeholder: 'Neovim, VS Code' }, { key: 'loc', label: 'Location', placeholder: 'Benguerir, Morocco' },
    { key: 'stack', label: 'Languages', placeholder: 'C, Go, TypeScript' }, { key: 'spoken', label: 'Spoken', placeholder: 'Arabic, French, English' },
    { key: 'hobbies', label: 'Hobbies', placeholder: 'Chess, retro games' }, { key: 'now', label: 'Building', placeholder: 'a tiny virtual machine' },
  ] },
  { title: 'Contact', fields: [
    { key: 'email', label: 'Email', placeholder: 'ada@example.com' }, { key: 'web', label: 'Website', placeholder: 'ada.dev' },
    { key: 'linkedin', label: 'LinkedIn', placeholder: 'ada-lovelace' }, { key: 'discord', label: 'Discord', placeholder: 'ada' },
    { key: 'x', label: 'X', placeholder: '@ada' },
  ] },
  { title: 'Last line', fields: [{ key: 'fun', label: 'Fun fact', placeholder: 'I debug with a rubber duck' }] },
];

function Chips<T extends string>({ label, items, value, labels, onPick }: { label: string; items: readonly T[]; value: T; labels?: Record<T, string>; onPick: (id: T) => void }) {
  return <div className="gc-group" role="group" aria-label={label}><span className="gc-label">{label}</span>
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
      <button type="button" className="gc-copy" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
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
  const [shown, setShown] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { if (!siteUrl) setOrigin(window.location.origin); }, [siteUrl]);
  const tweak = <K extends keyof CardStyle>(key: K, value: CardStyle[K]) => setStyle((previous) => ({ ...previous, [key]: value }));

  const login = cleanLogin(input), valid = GITHUB_LOGIN.test(login);
  // The 1337 logo is opt-in on this card (`logo=1`), because it sits over the last lines of text.
  const query = `${styleQuery({ ...style, logo: true })}${style.logo ? '&logo=1' : ''}${textQuery(text)}`.slice(1);
  const path = valid ? `/api/gh/${login}.svg${query ? `?${query}` : ''}` : null;
  // The preview waits for a pause in typing, so each keystroke does not draw a card.
  useEffect(() => { const timer = setTimeout(() => { setShown(path); setFailed(false); }, 450); return () => clearTimeout(timer); }, [path]);
  const url = `${origin}${path ?? `/api/gh/your-username.svg${query ? `?${query}` : ''}`}`;
  const profile = `https://github.com/${valid ? login : ''}`;

  return <div className="gc-grid">
    <header className="gc-head">
      <h1>GitHub Card</h1>
      <p>A terminal-style profile card for your GitHub README. No sign-in. Fill in only what you want to show.</p>
    </header>
    <div className="gc-user">
      <input value={input} onChange={(event) => setInput(event.target.value)} maxLength={80} placeholder="GitHub username" aria-label="GitHub username" spellCheck={false} autoCapitalize="none" autoComplete="off" autoFocus/>
    </div>
    <section className="gc-preview" aria-label="Your card">
      {shown && !failed
        ? <img className="gc-card" src={shown} alt={`GitHub card of ${login}`} width={985} height={530} onError={() => setFailed(true)}/>
        : <div className="gc-card gc-empty" role="status">{failed ? 'No GitHub user with that name.' : 'Type your GitHub username to see your card.'}</div>}
      <h2>Add it to your README</h2>
      <p className="gc-sub">Paste one of these in the README of your profile repository, the one named after your username.</p>
      <Snippet tabs={[
        { id: 'md', label: 'Markdown', value: `[![${valid ? login : 'GitHub'} card](${url})](${profile})` },
        { id: 'html', label: 'HTML', value: `<a href="${profile}"><img src="${url}" alt="GitHub card" width="985"></a>` },
      ]}/>
    </section>
    <div className="gc-form">
      {SECTIONS.map(({ title, fields }) => <section key={title}><h2>{title}</h2>
        <div className="gc-fields">{fields.map(({ key, label, placeholder }) => <label key={key} className="gc-field"><span>{label}</span>
          <input value={text[key] ?? ''} onChange={(event) => setText((previous) => ({ ...previous, [key]: event.target.value }))} maxLength={TEXT_FIELDS[key]} placeholder={placeholder} autoComplete="off"/></label>)}</div>
      </section>)}
      <section><h2>Look</h2>
        <div className="gc-look">
          <Chips label="Theme" items={THEMES} value={style.theme} labels={THEME_LABELS} onPick={(id) => tweak('theme', id)}/>
          <div className="gc-group" role="group" aria-label="Color"><span className="gc-label">Color</span>
            <div className="gc-chips">{ACCENTS.map((id) => <button key={id} type="button" className="gc-swatch" style={{ '--swatch': ACCENT_COLORS[id].dark } as React.CSSProperties} aria-pressed={style.accent === id} aria-label={id} title={id} onClick={() => tweak('accent', id)}/>)}</div></div>
          <Chips label="Font" items={FONTS} value={style.font} labels={FONT_LABELS} onPick={(id) => tweak('font', id)}/>
          <div className="gc-group" role="group" aria-label="Picture style"><span className="gc-label">Picture style</span>
            <div className="gc-chips">{ARTS.map((id) => <button key={id} type="button" className="gc-chip" aria-pressed={style.art === id} onClick={() => tweak('art', id)}>{id === 'ascii' ? 'ASCII' : 'Blocks'}</button>)}
              <button type="button" className="gc-chip" aria-pressed={style.logo} onClick={() => tweak('logo', !style.logo)}>1337 logo</button>
              <button type="button" className="gc-chip" aria-pressed={style.crt} onClick={() => tweak('crt', !style.crt)}>CRT effect</button></div></div>
        </div>
      </section>
    </div>
    <footer className="gc-foot">Made by the <a href="https://www.elite-1337.app">Elite 1337</a> community. Nothing is stored: your card is just a link.</footer>
  </div>;
}
