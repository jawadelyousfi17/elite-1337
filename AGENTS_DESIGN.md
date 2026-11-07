# AGENTS_DESIGN.md

How Elite 1337 looks and behaves, for AI agents and people changing the UI. `AGENTS.md` has the rules for code, the 42 API budget and Git; this file is only about design. When the two disagree, `AGENTS.md` wins.

## Principles

- **Dark first, calm, rounded.** The app opens on the Black surface with Round corners and the Mint accent. Light mode exists and must look as good, but it is the variant, not the base.
- **Content over chrome.** Rankings, levels and XP are the product. Cards are flat (no borders, no shadows) and let the numbers lead.
- **Compact and dense.** Small type for secondary text, one clear number per card, no decorative copy.
- **Fail soft.** A slow or missing side service shows a Kiwi note or a skeleton, never a blank page or a spinner that never ends.
- **Respect students.** No public lists that name or shame, no raw 42 photos, no data of other students beyond what the leaderboard already shows.

## Tokens

Defined in `src/app/globals.css` (`:root`) and mirrored by the Tweaks panel (`src/lib/tweaks-store.ts`).

| Token | Value | Use |
|---|---|---|
| Background | `#000` (Black surface) | Page |
| Card (`--panel`) | `#202020` in the base theme, `#141414` for nested cards | Panels, rows |
| Raised / hover | `#202020` / `#2b2b2b` | Buttons, chips, hover states |
| Mint (`--mint`) | `#cafbd2` | Primary accent: highlights, active chips, gains |
| Lilac (`--lilac`) | `#edc5f9` | Eyebrows, secondary accent, avatars |
| Muted text | `#8a8a8a`, `#9a9a9a` | Secondary text |
| Text | `#f9f9f9` | Primary text |
| Font | General Sans (400, 500, 600, 700), loaded locally in `src/app/layout.tsx` | Everything; `font-variant-numeric: tabular-nums` on numbers |

Shape: panels use a 23px radius, rows and cards 18–22px, buttons and chips are pills (`999px`). The Tweaks radius scale multiplies these (Sharp .4, Soft .7, Default 1, Round 1.35); the default is **Round**.

Tweaks the student can choose: surface (Black, Charcoal, Midnight, Forest, Plum, Light), accent (Mint, Lime, Sky, Lilac, Peach, Lemon) and radius. Defaults are Black, Mint and Round. Saved settings live in `localStorage` (see `STORAGE_KEY` in `tweaks-store.ts`); when defaults change, bump the key so old saved choices do not override the new look.

## Components to reuse

Look here before writing new markup or CSS.

- **Chips and filters:** `pl-chip`, `pl-token`, `fa-filter` (`FilterShell`), `ex-table`.
- **Dialogs:** the `sv-*` classes. Confirm and cancel sit together on the right, the main action is the filled button.
- **Empty and loading states:** `KiwiNote`, `KiwiLoader` (`src/components/kiwi-guide.tsx`) and the skeletons in `page-skeletons.tsx`. Every slow page has a `loading.tsx`.
- **Avatars:** the shared `Avatar` with an initials fallback, fed through the signed photo proxy. Anonymous students use "?".
- **Icons:** only from `src/components/icons.tsx` (Phosphor). Add a named export there. Real icons, never text characters like ✓ or ✗ (the one exception is the ✅ list in the Remove me confirmation).
- **Badges:** `HackerBadge`, `AlumniBadge`, `FrozenBadge`, and the "New!" badge (`nav-new`, `menu-new`).
- **Floating buttons:** Feedback, "Try hack me" and "Remove me" are one stack at the bottom right on desktop, positioned from the `--fb` variable. Phones have no pills; "Remove my profile" lives in the profile menu.

## CSS rules

- All styles are in `src/app/globals.css`. Compact rules, one selector per line, grouped under a short `/* comment */` per feature, with a class prefix per feature: `pl-` leaderboard, `st-` stats, `pc-` corrections, `xp-` XP calculator, `ex-` experiments, `hm-` remove me, `hk-` hack me, `gh-` GitHub button.
- **After any change to `globals.css`, run `node scripts/generate-tweaks-css.mjs` and commit both CSS files.** `tweaks.generated.css` is generated; never edit it by hand.
- The generator maps neutral colours to light mode. **Accent-coloured text does not map** (mint on white is unreadable), and neither do dark pills placed on tinted cards. Add an explicit `html[data-tw-light]:not(:has(.landing))` rule for them, and look at the result in light mode.
- The landing page is always dark: rules for light mode must exclude it with `:not(:has(.landing))`.

## Layout and responsive behaviour

- Content width: `.shell` (max 1200px) with a 16px gutter on phones.
- **Phones (under 700px):** the top links move into a glass bottom bar. Floating elements must clear it: `bottom: calc(max(16px, env(safe-area-inset-bottom)) + 76px)` below 760px. The GitHub button stays in the top bar. Check every change at 375px.
- **iPad and small desktops (1024–1199px):** the five top links stay on one line (no wrapping, tighter padding). Below 1024px the bottom bar is used.
- Filter and period links deep in a page get `scroll={false}`, and their container gets `data-keep-scroll`, so the page does not jump.
- Long lists use infinite scroll (leaderboard, corrections, stats) with a Back to top button.

## Motion

- Every animation respects `prefers-reduced-motion` (turn it off or make it static).
- Motion is small and purposeful: a count-up on the new level, a pop on a new gain, a skeleton shimmer, the rotating light on the landing GitHub button. No looping decoration elsewhere.

## Copy

- Short sentences, plain words, no jargon. Say what happened and what to do next.
- Name things as the product does: blackholed, cohort, circle, evaluation, promo.
- Errors are friendly and specific ("42 Intra is busy, try again in a minute"), never a stack trace or a status code.
- Contact details (email, Discord) come from `src/lib/site.ts`, never hard-coded.

## Page patterns

- **Leaderboard:** podium for the top three, then rows (`RankRow`) with rank on the right; filters by campus, cohort, status (including All) and search. Anonymized students show as "Anonymous student" with only their place.
- **Stats and Corrections:** one panel per topic; corrections are grouped by team, with tabs Waiting, Validated, Failed and Locked (short labels, no "Recently"), a day switch under the count line, scoped to the selected campus.
- **XP calculator:** a hero card (level now → level after, rank, total XP gained), an "Up next" list, a level path, and one mark card per project showing only the changing "+N XP". Coalition bonus is a switch with a percentage.
- **Student cards** open in a new tab with a hover arrow; profile photos come from the signed proxy.
- **Landing, 404 and removed pages:** dark, one clear action each, with the Kiwi or horse art.

## Before you finish a UI change

1. `node scripts/generate-tweaks-css.mjs`, then `npx tsc --noEmit` and `npx vitest run`.
2. Look at it in the browser in dark and light, at 375px and at desktop width. For caching or UI changes, use a production build in a copy of the repo (see `AGENTS.md`).
3. Check the keyboard focus ring (`outline: 3px solid var(--mint)`) and reduced motion.
