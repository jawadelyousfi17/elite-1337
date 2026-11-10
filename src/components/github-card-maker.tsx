'use client';

import { useEffect, useState } from 'react';
import { GitHub } from '@/components/icons';
import { CardTweaks } from '@/components/card-tweaks';
import { CodeBlock } from '@/components/code-block';
import { DEFAULT_STYLE, styleQuery, type CardStyle } from '@/lib/card-style';
import { GITHUB_LOGIN, TEXT_FIELDS, cleanLogin, textQuery, type CardText } from '@/lib/github-card-input';

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

/** Public card maker: a username, a few optional lines and the look; the card is a plain image link, so nothing is stored. */
export function GithubCardMaker({ origin }: { origin: string }) {
  const [input, setInput] = useState('');
  const [text, setText] = useState<CardText>({});
  const [style, setStyle] = useState<CardStyle>({ ...DEFAULT_STYLE, logo: false });
  const [failed, setFailed] = useState(false);
  const login = cleanLogin(input);
  const valid = GITHUB_LOGIN.test(login);
  const query = `${styleQuery({ ...style, logo: true })}${style.logo ? '&logo=1' : ''}${textQuery(text)}`;
  const path = valid ? `/api/gh/${login}.svg${query ? `?${query.slice(1)}` : ''}` : null;
  // The preview waits for a pause in typing, so each keystroke does not draw a card.
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => { const timer = setTimeout(() => { setShown(path); setFailed(false); }, 450); return () => clearTimeout(timer); }, [path]);
  const url = path ? `${origin}${path}` : `${origin}/api/gh/your-username.svg${query ? `?${query.slice(1)}` : ''}`;

  return <>
    <aside className="pl-side">
      <section className="pc-head">
        <h1>GitHub card</h1>
        <p>A profile card for your GitHub README. No sign-in needed. Fill in only what you want to show.</p>
      </section>
      <div className="pl-searchbar">
        <GitHub size={20} className="pl-searchbar-icon"/>
        <input value={input} onChange={(event) => setInput(event.target.value)} maxLength={80} placeholder="GitHub username" aria-label="GitHub username" spellCheck={false} autoCapitalize="none" autoComplete="off" autoFocus/>
      </div>
      {SECTIONS.map(({ title, fields }) => <section key={title} className="gh-section"><h2>{title}</h2>
        <div className="gh-fields">
          {fields.map(({ key, label, placeholder }) => <label key={key} className="gh-field"><span>{label}</span>
            <input value={text[key] ?? ''} onChange={(event) => setText((previous) => ({ ...previous, [key]: event.target.value }))} maxLength={TEXT_FIELDS[key]} placeholder={placeholder} autoComplete="off"/></label>)}
        </div>
      </section>)}
      <CardTweaks style={style} onChange={(key, value) => setStyle((previous) => ({ ...previous, [key]: value }))}/>
    </aside>
    <section className="pl-list" aria-label="GitHub card">
      {shown && !failed
        ? <img className="cd-preview" src={shown} alt={`GitHub card of ${login}`} width={985} height={530} onError={() => setFailed(true)}/>
        : <div className="cd-preview gh-empty" role="status">{failed ? 'No GitHub user with that name.' : 'Type your GitHub username to see your card.'}</div>}
      <h2 className="cd-title">Add it to your README</h2>
      <p className="cd-sub">Paste one of these in the README of your profile repository, the one named after your username.</p>
      <CodeBlock note="Public link: anyone with it sees this card." tabs={[
        { id: 'md', label: 'Markdown', value: `[![${valid ? login : 'GitHub'} card](${url})](https://github.com/${valid ? login : ''})` },
        { id: 'html', label: 'HTML', value: `<a href="https://github.com/${valid ? login : ''}"><img src="${url}" alt="GitHub card" width="985"></a>` },
      ]}/>
    </section>
  </>;
}
