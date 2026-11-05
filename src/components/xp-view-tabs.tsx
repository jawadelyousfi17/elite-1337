'use client';

export const XP_VIEW_COOKIE = 'xp-view';
export type XpView = 'core' | 'advanced';
const VIEWS = [{ key: 'core', label: 'Common Core' }, { key: 'advanced', label: 'Advanced' }] as const;

/** Curriculum switch inside the project picker. It only changes the list shown, and the pick becomes the student's default. */
export function XpViewTabs({ view, onChange }: { view: XpView; onChange: (view: XpView) => void }) {
  const choose = (key: XpView) => {
    document.cookie = `${XP_VIEW_COOKIE}=${key}; path=/xp; max-age=31536000; samesite=lax`;
    onChange(key);
  };
  return <div className="xp-tabs" role="group" aria-label="Curriculum">
    {VIEWS.map((item) => <button key={item.key} type="button" aria-pressed={item.key === view} onClick={() => choose(item.key)}>{item.label}</button>)}
  </div>;
}
