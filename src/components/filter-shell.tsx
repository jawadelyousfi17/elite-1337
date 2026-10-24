import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, Funnel, Search, X } from '@/components/icons';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export function FilterShell({ action, hidden, q, placeholder, clearHref, activeCount, defaultOpen, children }: {
  action: string; hidden: Record<string, string>; q?: string; placeholder: string; clearHref: string; activeCount: number; defaultOpen: boolean; children: ReactNode;
}) {
  return <Collapsible defaultOpen={defaultOpen} className="pl-filterbox">
    <div className="pl-search-row">
      <form className="pl-searchbar" action={action} role="search">
        {Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value}/>)}
        <Search size={20} className="pl-searchbar-icon"/>
        <input name="q" placeholder={placeholder} defaultValue={q ?? ''} maxLength={40} aria-label={placeholder} autoComplete="off"/>
        {q && <Link className="pl-searchbar-clear" href={clearHref} aria-label="Clear search"><X size={16}/></Link>}
        <button type="submit" className="pl-searchbar-go" aria-label="Search"><ArrowRight size={20} weight="bold"/></button>
      </form>
      <CollapsibleTrigger className="pl-filter-btn" aria-label={`Filters${activeCount ? `, ${activeCount} active` : ''}`}>
        <Funnel size={22}/>{activeCount > 0 && <span className="pl-filter-badge">{activeCount}</span>}
      </CollapsibleTrigger>
    </div>
    <CollapsibleTrigger className="pl-backdrop" aria-label="Close filters" tabIndex={-1}/>
    <CollapsibleContent forceMount className="pl-panel">
      <div className="pl-panel-head"><strong>Filters</strong><CollapsibleTrigger className="pl-panel-close" aria-label="Close filters"><X size={18}/></CollapsibleTrigger></div>
      {children}
    </CollapsibleContent>
  </Collapsible>;
}
