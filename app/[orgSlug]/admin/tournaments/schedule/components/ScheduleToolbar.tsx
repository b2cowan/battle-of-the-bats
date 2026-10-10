'use client';
/**
 * THE SCHEDULE'S ONE TOOLBAR LINE — Tournament admin redesign Stage 3, S1 (hub HQoRuEsKd7i6cAvCrMNzgM, Stage 3 tab),
 * ruled 2026-10-09. The same line in every view and at every width (owner, 1 October):
 *
 *   the view (the olive pill — Day · All games · Timeline · Bracket) · [the day, or a bracket's division, with its
 *   arrows] · Search · Filter · Tools
 *
 * Today the schedule had three toolbars: a desk's two rows with two limes, 768's doubled stage switch, and a phone
 * whose timeline view drew no Publish and no Tools at all (F75). The line, Search, Filter and Tools wear the admin's
 * shared toolbar sheet — Teams' own (the two tournament toolbars cannot drift); the view pill and the day's arrows
 * are this screen's (ScheduleDay.module.css).
 */
import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import tb from '@/components/admin/tournament/AdminToolbar.module.css';
import sd from './ScheduleDay.module.css';

export type ViewChoice<K extends string> = { key: K; label: string; hint: string; icon: ReactNode };

/** The view pill: the current view's icon and word, opening the views with a line each (a sheet on a phone). */
export function ViewPill<K extends string>({ view, choices, onView, menuTitle }: {
  view: K;
  choices: readonly ViewChoice<K>[];
  onView: (key: K) => void;
  menuTitle: string;
}) {
  const current = choices.find(c => c.key === view) ?? choices[0];
  return (
    <CoachToolbarMenu
      label={`${menuTitle}: ${current.label}`}
      title={menuTitle}
      plainTrigger
      triggerClassName={sd.viewPill}
      align="start"
      drawerOnPhone
      panelMinWidth={240}
      triggerContent={<>{current.icon}{current.label}<ChevronDown size={14} aria-hidden /></>}
    >
      {choices.map(c => (
        <CoachToolbarMenuItem key={c.key} icon={c.icon} label={c.label} hint={c.hint} checked={c.key === view} onSelect={() => onView(c.key)} />
      ))}
    </CoachToolbarMenu>
  );
}

/**
 * The day (or a bracket's division) with its arrows — its label opens the list to choose from. `placement` draws the
 * desk's inline form (the label alone) or the row of its own below 900px (the label over its caption).
 */
export function ScopeNav({
  label, caption, choices, value, onChoose, prev, next, prevLabel, nextLabel, menuTitle, placement,
}: {
  label: string;
  caption?: string;
  choices: readonly { key: string; label: string }[];
  value: string;
  onChoose: (key: string) => void;
  /** The neighbour each arrow steps to, or null at an end (the arrow then sits disabled). */
  prev: string | null;
  next: string | null;
  prevLabel: string;
  nextLabel: string;
  menuTitle: string;
  placement: 'inline' | 'row';
}) {
  return (
    <div className={`${sd.scope} ${placement === 'inline' ? sd.scopeInline : sd.scopeRow}`}>
      <button type="button" className={sd.arrow} onClick={() => prev && onChoose(prev)} disabled={!prev} aria-label={prevLabel}>
        <ChevronLeft size={16} aria-hidden />
      </button>
      <CoachToolbarMenu
        label={`${menuTitle}: ${label}`}
        title={menuTitle}
        plainTrigger
        triggerClassName={sd.scopeLabel}
        align="start"
        drawerOnPhone
        panelMinWidth={220}
        triggerContent={<>
          <span>{label}</span>
          {caption && <span className={sd.scopeCaption}>{caption}</span>}
        </>}
      >
        {choices.map(c => (
          <CoachToolbarMenuItem key={c.key} label={c.label} checked={c.key === value} onSelect={() => onChoose(c.key)} />
        ))}
      </CoachToolbarMenu>
      <button type="button" className={sd.arrow} onClick={() => next && onChoose(next)} disabled={!next} aria-label={nextLabel}>
        <ChevronRight size={16} aria-hidden />
      </button>
    </div>
  );
}

/**
 * The line. `scope` is the day's (or the division's) navigation, drawn twice — inline beside the view on a wide desk,
 * and as `scopeRow` under the line below 900px (the stylesheet decides which shows, so nothing flashes on hydration).
 */
export default function ScheduleToolbar({
  viewPill, scopeInline, scopeRow, search, onSearch, searchLabel, filter, tools,
}: {
  viewPill: ReactNode;
  scopeInline?: ReactNode;
  scopeRow?: ReactNode;
  search: string;
  onSearch: (q: string) => void;
  searchLabel: string;
  filter: ReactNode;
  tools: ReactNode;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <>
      <div className={tb.toolbar}>
        {viewPill}
        {scopeInline}
        <span className={sd.spacer} aria-hidden />
        <div className={tb.deskFilters}>
          <label className={tb.searchField}>
            <Search size={14} aria-hidden />
            <span className="sr-only">{searchLabel}</span>
            <input value={search} onChange={e => onSearch(e.target.value)} placeholder={searchLabel} />
          </label>
        </div>
        <button type="button" className={`${tb.tool} ${tb.phoneTool}`} onClick={() => setSearchOpen(o => !o)}
          aria-expanded={searchOpen || search !== ''} aria-label={searchLabel} data-on={search !== '' || undefined}>
          <Search size={18} aria-hidden />
        </button>
        {filter}
        {tools}
      </div>
      {(searchOpen || search !== '') && (
        <label className={`${tb.searchField} ${tb.phoneSearch}`}>
          <Search size={14} aria-hidden />
          <span className="sr-only">{searchLabel}</span>
          <input autoFocus value={search} onChange={e => onSearch(e.target.value)} placeholder={searchLabel} />
          {search !== '' && (
            <button type="button" className={tb.searchClear} onClick={() => { onSearch(''); setSearchOpen(false); }} aria-label={`Clear ${searchLabel.toLowerCase()}`}>
              <X size={16} aria-hidden />
            </button>
          )}
        </label>
      )}
      {scopeRow}
    </>
  );
}
