// Builds src/app/tweaks.generated.css from globals.css and landing-support.css: override rules that only apply
// while a tweak is active (html[data-tw-*]), so the default design is untouched.
// Run: node scripts/generate-tweaks-css.mjs
import fs from 'node:fs';
import postcss from 'postcss';

const source = ['../src/app/globals.css', '../src/components/landing-support.css'].map((file) => fs.readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');
const surface = { '#000': 'bg', '#141414': 'card', '#161616': 'card', '#0f0f0f': 'card', '#202020': 'raise', '#2b2b2b': 'hover' };
const isChart = (selector) => /\.sc-|st-career|st-validated-top|landing|credit/.test(selector);
const out = { surface: [], accent: [], radius: [], light: [] };

// Light theme helpers: neutral grays only; colored text and pastel tiles keep their own ink.
const hex = (value) => { const match = /^#([0-9a-f]{3}|[0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value); if (!match) return null; const raw = match[1].length === 3 ? [...match[1]].map((c) => c + c).join('') : match[1]; return { rgb: [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16)), alpha: match[2] ?? '' }; };
const neutralLightness = (value) => { const color = hex(value); if (!color || color.alpha) return null; const [r, g, b] = color.rgb; return Math.max(r, g, b) - Math.min(r, g, b) <= 14 ? (r + g + b) / 765 : null; };
const lightInk = (value) => { const l = neutralLightness(value); if (l === null) return null; return l >= .85 ? '#141414' : l >= .65 ? '#3d3d3d' : l >= .45 ? '#5f5f5f' : null; };
// Dark neutral backgrounds keep their nesting order in light mode: darkest becomes white, lighter steps become grays.
const lightSurface = (value) => {
  const color = hex(value); if (!color) return null;
  const [r, g, b] = color.rgb; if (Math.max(r, g, b) - Math.min(r, g, b) > 14) return null;
  const l = (r + g + b) / 765; if (l > .3) return null;
  return (l < .1 ? '#ffffff' : l < .14 ? '#ecece9' : l < .2 ? '#e2e2df' : '#d6d6d2') + color.alpha; // translucent bars stay translucent
};
const flipWhiteAlpha = (value) => value.replace(/#fff(?:fff)?([0-9a-f]{2})\b/gi, '#000000$1');

postcss.parse(source).walkRules((rule) => {
  if (rule.parent?.type === 'atrule' && rule.parent.name === 'keyframes') return;
  const media = rule.parent?.type === 'atrule' && rule.parent.name === 'media' ? rule.parent.params : null;
  const selectors = rule.selectors.filter((selector) => !selector.includes(':root') && !isChart(selector));
  if (!selectors.length) return;
  const decls = {}; rule.walkDecls((decl) => { decls[decl.prop] = decl.value.trim().toLowerCase(); });
  const light = [];
  const declared = decls.background ?? decls['background-color'];
  const background = declared === 'transparent' || declared === 'none' ? undefined : declared;
  if (background === '#fff' || background === '#ffffff') {
    light.push('background:#141414!important');
    if (decls.color && (neutralLightness(decls.color) ?? 1) < .2) light.push('color:#fff!important');
  } else if (background && /#fff(?:fff)?[0-9a-f]{2}\b/i.test(background)) light.push(`background:${flipWhiteAlpha(background)}!important`);
  else if (background && lightSurface(background) && !selectors.every((selector) => /^(html|body)$/.test(selector.trim()))) light.push(`background:${lightSurface(background)}!important`);
  if (decls.color && !(background && !surface[background] && background !== '#fff' && background !== '#ffffff') && lightInk(decls.color)) light.push(`color:${lightInk(decls.color)}!important`);
  for (const prop of ['border', 'border-color', 'border-top', 'border-bottom', 'border-left', 'box-shadow']) if (decls[prop] && /#fff(?:fff)?[0-9a-f]{2}\b/i.test(decls[prop])) light.push(`${prop}:${flipWhiteAlpha(decls[prop])}!important`);
  // Pastel KPI cards own their text colors in both themes.
  const lightSelectors = selectors.filter((selector) => !/support-(food-frame|selected)|\.st-kpi\b/.test(selector));
  if (light.length && lightSelectors.length) out.light.push({ media, selectors: lightSelectors, decl: light.join(';') });
  rule.walkDecls((decl) => {
    const value = decl.value.trim().toLowerCase(), isBackground = decl.prop === 'background' || decl.prop === 'background-color';
    // Every background and radius is re-emitted in source order, so more specific states (active, selected) keep winning.
    if (isBackground) out.surface.push({ media, selectors, decl: surface[value] ? `background:var(--tw-${surface[value]})!important` : `${decl.prop}:${decl.value}!important` });
    if (isBackground && value === '#cafbd2') out.accent.push({ media, selectors, decl: 'background:var(--tw-accent)!important' });
    if (decl.prop === 'color' && value === '#cafbd2') out.accent.push({ media, selectors, decl: 'color:var(--tw-accent)!important' });
    const radius = /^(\d+)px$/.exec(value);
    if (decl.prop === 'border-radius') out.radius.push({ media, selectors, decl: radius && +radius[1] >= 12 && +radius[1] <= 40 ? `border-radius:calc(${radius[1]}px * var(--tw-r))!important` : `border-radius:${decl.value}!important` });
  });
});

// Dark mode: the pastels and reds are tuned for light surfaces and glare on black, so mute them.
const MUTED = { '#cafbd2': '#a7d8b1', '#edc5f9': '#c9a3d6', '#f2d1fb': '#cdaed8', '#fff0b5': '#dccd92', '#d9f7fa': '#a9d1d6', '#e3def5': '#bdb6d6', '#c9f8d4': '#a5d6b0', '#f7c5ce': '#d4a2ac', '#ff8a8f': '#d9767b', '#ffb3b3': '#d89a9b', '#ffd6d6': '#c9a5a6', '#ff6b70': '#e0676c', '#ff9a9e': '#d98488', '#ff7f85': '#d9767b' };
const mutedPattern = new RegExp(Object.keys(MUTED).join('|'), 'gi');
const dark = [];
postcss.parse(source).walkRules((rule) => {
  if (rule.parent?.type === 'atrule' && rule.parent.name === 'keyframes') return;
  const media = rule.parent?.type === 'atrule' && rule.parent.name === 'media' ? rule.parent.params : null;
  const decls = [];
  rule.walkDecls((decl) => { if (mutedPattern.test(decl.value)) decls.push(`${decl.prop}:${decl.value.replace(mutedPattern, (hex) => MUTED[hex.toLowerCase()])}!important`); mutedPattern.lastIndex = 0; });
  if (!decls.length) return;
  const DARK = 'html:not([data-tw-light]):not(:has(.landing))';
  const selectors = rule.selectors.map((selector) => /^(:root|html)$/.test(selector.trim()) ? DARK : `${DARK} ${selector.replace(/^html\s*/, '')}`);
  const css = `${selectors.join(',')}{${decls.join(';')}}`;
  dark.push(media ? `@media ${media}{${css}}` : css);
});

const emit = (attr, items) => items.map(({ media, selectors, decl }) => {
  const rule = `${selectors.map((selector) => `html[${attr}] ${selector.replace(/^html\s*/, '')}`).join(',')}{${decl}}`;
  return media ? `@media ${media}{${rule}}` : rule;
}).join('\n');

const css = `/* Generated by scripts/generate-tweaks-css.mjs from globals.css; do not edit by hand. */
html[data-tw-surface],html[data-tw-surface] body{background:var(--tw-bg)!important}
html[data-tw-accent]{--mint:var(--tw-accent);--primary:var(--tw-accent)}
${emit('data-tw-surface', out.surface)}
${emit('data-tw-accent', out.accent)}
${emit('data-tw-radius', out.radius)}
html[data-tw-light]{color-scheme:light;--text:#141414;--foreground:#141414;--muted:#6a6a6a;--muted-foreground:#6a6a6a;--popover-foreground:#141414}
html[data-tw-light] body{color:#141414}
html[data-tw-light] .nav .brand img{filter:brightness(0);opacity:.88}
/* Charts are excluded from the automatic mapping, so their light versions are written by hand. */
html[data-tw-light] :is(.sc-x,.sc-y,.sc-cal-head,.sc-scale,.sc-heat thead th){color:#5f5f5f}
html[data-tw-light] .sc-heat tbody th{color:#141414}
html[data-tw-light] .sc-cell.is-empty{background:repeating-linear-gradient(135deg,#ecece9 0 4px,#f6f6f4 4px 8px);color:#9a9a9a}
html[data-tw-light] .sc-cell:is(:hover,:focus-visible){box-shadow:0 0 0 2px #fff,0 0 0 3px #3f6b4c}
html[data-tw-light] .sc-grid{stroke:#0000001a}
html[data-tw-light] .sc-bars{background:linear-gradient(#0000000f,#0000000f) top/100% 1px no-repeat,linear-gradient(#0000000f,#0000000f) center/100% 1px no-repeat,linear-gradient(#0000001f,#0000001f) bottom/100% 1px no-repeat}
html[data-tw-light] .sc-median{border-left-color:#b8860b}
html[data-tw-light] .sc-median em{color:#8a6500}
html[data-tw-light] .sc-change{background:#fff;border-color:#0000001a;color:#3d3d3d}
html[data-tw-light] .sc-tip{background:#141414;color:#fff;box-shadow:0 10px 30px -10px #0006}
html[data-tw-light] .sc-tip small{color:#b4b4b4}
html[data-tw-light] .sc-cross{background:#0000002e}
html[data-tw-light] .sc-dot{box-shadow:0 0 0 2px #fff}
html[data-tw-light] .sc-donut-track{stroke:#ecece9}
html[data-tw-light] .sc-donut-center span,html[data-tw-light] .sc-legend small{color:#6a6a6a}
html[data-tw-light] .sc-day{color:#3d3d3d}
html[data-tw-light] .sc-day.is-future{color:#c4c4c4}
html[data-tw-light] .sc-day.is-today{box-shadow:inset 0 0 0 1.5px #3f6b4c}
html[data-tw-light] .sc-day.has-count{color:#fff}
html[data-tw-light] .sc-day.has-count.is-light{color:#5a1015}
html[data-tw-light] .st-validated-top i{background:#ecece9}
html[data-tw-light] .st-career-loading{background:#ecece9}
${emit('data-tw-light', out.light)}
${dark.join('\n')}
/* Pale red reads poorly on white; use a deeper red for return figures. */
html[data-tw-light] :is(.st-returns-lead strong,.st-correctors-score strong,.st-rbars-avg em){color:#c92a3a!important}
html[data-tw-light] .st-correctors-list li+li{border-top-color:#0000000f!important}
html[data-tw-light] .st-correctors-list a:hover{background:#f3f3f1!important}
html[data-tw-light] .st-correctors-list .avatar{background:#ecece9!important;color:#5f5f5f!important}
html[data-tw-light] .st-correctors-bar{background:#0000000f!important}
html[data-tw-light] .st-correctors-rank.is-top{color:#0a0a0a!important}
html[data-tw-light] .st-correctors-rank.is-top-1{background:#ff8a8f!important}
html[data-tw-light] .st-correctors-rank.is-top-2{background:#ffc2c4!important}
html[data-tw-light] .st-correctors-rank.is-top-3{background:#ffe0e1!important}
html[data-tw-light] .st-rbars-avg em{background:#fff!important}
html[data-tw-light] .st-info-tip{background:#141414!important;color:#fff!important;box-shadow:0 14px 34px -10px #0006!important}
html[data-tw-light] .st-info-tip strong{color:#b4b4b4!important}
html[data-tw-light] .st-cat.is-mine img{box-shadow:0 0 0 3px #fff,0 0 0 5px #141414!important}
html[data-tw-light] .st-cat.is-mine .st-cat-share{background:#141414!important;color:#fff!important}
html[data-tw-light] .st-cat:hover:not(:disabled){background:#f3f3f1!important}
html[data-tw-light] .sv-pill{background:#fffffff2!important;border-color:#0000001a!important;box-shadow:0 14px 34px -14px #0004!important}
html[data-tw-light] .sv-pill-open svg,html[data-tw-light] .sv-privacy svg{color:#3f6b4c!important}
html[data-tw-light] .sv-primary{background:#141414!important;color:#fff!important}
html[data-tw-light] .sv-option.is-picked,html[data-tw-light] .sv-scale-dot.is-picked{background:#cafbd2!important;color:#0a0a0a!important}
html[data-tw-light] .kiwi-bubble{background:#fff!important;color:#141414!important;border-color:#0000001a!important;box-shadow:0 18px 40px -16px #0004!important}
html[data-tw-light] .kiwi-face{filter:drop-shadow(0 10px 18px #0003)!important}
html[data-tw-light] .of-card{background:#fff!important;border-color:#0000000f!important}
html[data-tw-light] .of-card-req{background:#fff1e0!important;color:#9a4b00!important}
html[data-tw-light] .of-card.is-featured{background:linear-gradient(160deg,#e9f9ec,#fff 60%)!important;border-color:#3f6b4c40!important}
html[data-tw-light] .of-summary{color:#3d3d3d!important}
html[data-tw-light] .of-steps li{color:#5f5f5f!important}
html[data-tw-light] .of-steps svg{color:#3f6b4c!important}
html[data-tw-light] .of-note{background:#f3f3f1!important;color:#6a6a6a!important}
html[data-tw-light] .of-cta{background:#141414!important;color:#fff!important}
html[data-tw-light] .of-cta:hover{background:#2b2b2b!important}
html[data-tw-light] .of-contact{background:#fff!important;color:#141414!important;border-color:#0000001a!important;box-shadow:0 24px 60px -20px #0004!important}
html[data-tw-light] .of-contact-arrow{fill:#fff!important}
html[data-tw-light] .of-contact-number{color:#141414!important}
html[data-tw-light] .of-contact-hint{color:#6a6a6a!important}
html[data-tw-light] .of-contact-qr{background:#fff!important;box-shadow:inset 0 0 0 1px #00000014!important}
html[data-tw-light] .of-contact-close:hover{background:#f3f3f1!important;color:#141414!important}
html[data-tw-light] .of-ad{border-color:#00000033!important}
html[data-tw-light] .of-contact-wa{background:#25d366!important;color:#05210f!important}
html[data-tw-light] .race,html[data-tw-light] .race-stats>div,html[data-tw-light] .race-empty{background:#fff!important;border-color:#0000000f!important}
html[data-tw-light] .race-track{background:linear-gradient(180deg,#f3f7f3 0,#fff 70%)!important}
/* Race ground uses artwork in both themes; do not replace its background image. */
html[data-tw-light] .race-cliff{background:linear-gradient(180deg,#c9c9c4,transparent)!important}
html[data-tw-light] .race-stop.is-cleared .race-label b{color:#141414!important}
html[data-tw-light] .race-gap{background:#f3f3f1!important;color:#6a6a6a!important}
html[data-tw-light] .race-controls{border-top-color:#0000000f!important}
html[data-tw-light] .race-play,html[data-tw-light] .race-speed button[aria-pressed=true]{background:#141414!important;color:#fff!important}
html[data-tw-light] .race-speed{background:#f3f3f1!important}
html[data-tw-light] .race-sound{background:#f3f3f1!important;color:#6a6a6a!important}
html[data-tw-light] .race-sound:hover{background:#e9e9e6!important;color:#141414!important}
html[data-tw-light] .race-sound[aria-pressed=true]{color:#2f6b40!important}
html[data-tw-light] .race-start{border-left-color:#3f6b4c!important}
html[data-tw-light] .race-intra,html[data-tw-light] .race-versus-note a{background:#fff!important;box-shadow:inset 0 0 0 1px #0000001a!important}
html[data-tw-light] .race-vs{background:#fff!important;border-color:#0000001a!important;box-shadow:none!important}
html[data-tw-light] .race-vs:hover{background:#fafaf8!important;border-color:#00000033!important}
html[data-tw-light] .race-vs:focus-within{background:#fff!important;border-color:#3f8f57!important;box-shadow:0 0 0 4px #3f8f5726!important}
html[data-tw-light] .race-vs-icon{color:#8a8a8a!important}
html[data-tw-light] .race-vs:hover .race-vs-icon,html[data-tw-light] .race-vs:focus-within .race-vs-icon{color:#3f8f57!important}
html[data-tw-light] .race-vs button{background:#141414!important;color:#fff!important}
html[data-tw-light] .race-notice{background:#ffe5e6!important;color:#9a1c28!important}
html[data-tw-light] .race-board{border-bottom-color:#0000000f!important}
html[data-tw-light] .race-track.is-versus+.race-track.is-versus{border-top-color:#0000001a!important}
html[data-tw-light] .race-circle-star{border-color:#00000026!important;color:#00000026!important}
html[data-tw-light] .race-circle-label{background:#f3f3f1!important;color:#6a6a6a!important}
html[data-tw-light] .race-circle.is-unlocked .race-circle-star{border-color:#e0aa1e!important;color:#7a4b00!important}
html[data-tw-light] .race-circle.is-unlocked .race-circle-label{background:#f5c542!important;color:#3a2600!important}
html[data-tw-light] .race-tag{background:#141414e6!important;color:#fff!important}
html[data-tw-light] .race-vs-list{background:#fff!important;border-color:#0000001a!important;box-shadow:0 18px 40px -16px #0004!important}
html[data-tw-light] .race-vs-list li.is-active{background:#f3f3f1!important}
html[data-tw-light] .race-vs-list em{background:#f3f3f1!important;color:#5f5f5f!important}
html[data-tw-light] .race-vs-list em.is-lost{background:#ffe5e6!important;color:#9a1c28!important}
html[data-tw-light] .race-vs-list .avatar{background:#ecece9!important;color:#5f5f5f!important}
html[data-tw-light] .race-vs input{color:#141414!important}
html[data-tw-light] .race-scrub{background:linear-gradient(90deg,#5fbf77,#3f8f57) 0/var(--p) 100% no-repeat,#0000001a!important}
html[data-tw-light] .race-mark{background:#e2e2df!important;color:#9a9a9a!important}
html[data-tw-light] .race-mark.is-on{background:#f5c542!important;color:#3a2600!important}
html[data-tw-light] .race-compare{border-bottom-color:#0000000f!important}
html[data-tw-light] .race-compare-bar{background:#0000000f!important}
html[data-tw-light] .race.is-versus .race-stage+.race-stage{border-top-color:#0000001a!important}
/* My race: logtime stats */
html[data-tw-light] .pr-kpis>div:not(.is-gold,.is-mint){background:#fff!important;border-color:#0000000f!important;color:#141414!important}
html[data-tw-light] .pr-kpis>div.is-gold{background:#fff0b5!important;color:#3a2e05!important}
html[data-tw-light] .pr-kpis>div.is-mint{background:#cafbd2!important;color:#173923!important}
html[data-tw-light] :is(.pr-kpis dt,.pr-kpis .pr-sub,.pr-title small,.pr-note,.pr-month,.pr-cal-days,.pr-scale,.pr-seat b,.pr-empty){color:#5f5f5f!important}
html[data-tw-light] .pr-note b{color:#8a6500!important}
html[data-tw-light] .pr-cal-days{background:#fff!important}
html[data-tw-light] .pr-skel{background:#ecece9!important}
html[data-tw-light] .pr-kpi-label{color:#5f5f5f!important}
html[data-tw-light] .pr-loading-note i{border-color:#0000001f!important;border-top-color:#3f6b4c!important}
html[data-tw-light] .pr-cell{background:#ecece9!important}
html[data-tw-light] .pr-cell.is-l1{background:#cdeed4!important}
html[data-tw-light] .pr-cell.is-l2{background:#97d3a4!important}
html[data-tw-light] .pr-cell.is-l3{background:#5f9a6d!important}
html[data-tw-light] .pr-cell.is-l4{background:#2f6b40!important}
html[data-tw-light] .pr-cell.is-future{background:transparent!important}
html[data-tw-light] .pr-cal .pr-cell:hover{box-shadow:0 0 0 1.5px #141414!important}
html[data-tw-light] .pr-seats i{background:#ecece9!important}
html[data-tw-light] .pr-seats em{background:#5f9a6d!important}
html[data-tw-light] .pr-seats li:first-child em{background:#e6c35a!important}
/* Legal pages */
html[data-tw-light] .legal-body section{background:#fff!important;border-color:#0000000f!important}
html[data-tw-light] :is(.legal-intro p,.legal-body p,.legal-body li){color:#3d3d3d!important}
html[data-tw-light] :is(.legal-head h1,.legal-body h2,.legal-body strong){color:#141414!important}
html[data-tw-light] .legal-body a{color:#2f6b40!important}
html[data-tw-light] :is(.legal-kicker,.legal-toc li a){color:#5f5f5f!important}
html[data-tw-light] .legal-toc li a:hover{background:#ecece9!important;color:#141414!important}
html[data-tw-light] .legal-other{background:#141414!important;color:#fff!important}
html[data-tw-light] .legal-links a{color:#5f5f5f!important}
html[data-tw-light] .legal-links a:hover{color:#141414!important}
@media(max-width:860px){html[data-tw-light] .legal-toc li a{background:#fff!important}}
html[data-tw-light] .pl-intra{border-color:#00000024!important;color:#2a2a2a!important;background:transparent!important}
html[data-tw-light] .pl-intra:hover{background:#0000000d!important;border-color:#00000040!important;color:#000!important}
html[data-tw-light] :is(.sk-kpi,.sk-chart,.sk-side,.sk-offer,.sk-stat)::before,html[data-tw-light] :is(.sk-kpi,.sk-offer)::after{background:#ecece9!important}
html[data-tw-light] .fb-pill svg{color:#3f6b4c!important}
html[data-tw-light] .fb-field textarea{background:#f4f4f2!important;color:#141414!important;border-color:#0000001a!important}
html[data-tw-light] .fb-reply{color:#3d3d3d!important}
html[data-tw-light] .fb-reply input{accent-color:#141414}
/* Popovers sit on white in light mode, like the support popover. */
html[data-tw-light] .nav-rank-pop{background:#fff!important;border-color:#0000001a!important;box-shadow:0 24px 60px -24px #0004!important}
html[data-tw-light] .nav-rank-pop [data-slot=separator]{background:#0000001a!important}
`;
// The landing page keeps its own dark artwork whatever the theme, so theme overrides never reach it.
const scoped = css.replaceAll('html[data-tw-light]', 'html[data-tw-light]:not(:has(.landing))').replaceAll('html[data-tw-surface]', 'html[data-tw-surface]:not(:has(.landing))');
fs.writeFileSync(new URL('../src/app/tweaks.generated.css', import.meta.url), scoped);
console.log(`surface ${out.surface.length}, accent ${out.accent.length}, radius ${out.radius.length}, light ${out.light.length}, dark-muted ${dark.length} rules`);
