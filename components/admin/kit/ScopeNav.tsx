'use client';
/**
 * ONE DAY (OR ONE DIVISION) AT A TIME, WITH ITS ARROWS — the label between them opens the list to choose from (a sheet
 * on a phone). Shared, moved here unchanged from the tournament schedule's toolbar (Tournament admin redesign Stage 3,
 * S1, ruled 2026-10-09) when the club scheduler's phone took a Day view (owner, 2026-10-12, walk §300: "should there be
 * a day option for a phone since these schedules could be quite large? it should only toggle days with actual events").
 *
 *   · the tournament schedule — its Day view's day, and a bracket's division;
 *   · the club scheduler on a phone — Day: only the dates the schedule has slots on, so a Sundays-only schedule steps
 *     Sunday to Sunday and a date off is never a stop.
 *
 * `placement` draws a wide desk's inline form (the label alone) or a row of its own below 1280px (the label over its
 * caption). At an end the arrow sits disabled, so the label never shifts.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import sn from './ScopeNav.module.css';

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
    <div className={`${sn.scope} ${placement === 'inline' ? sn.scopeInline : sn.scopeRow}`}>
      <button type="button" className={sn.arrow} onClick={() => prev && onChoose(prev)} disabled={!prev} aria-label={prevLabel}>
        <ChevronLeft size={16} aria-hidden />
      </button>
      <CoachToolbarMenu
        label={`${menuTitle}: ${label}`}
        title={menuTitle}
        plainTrigger
        triggerClassName={sn.scopeLabel}
        align="start"
        drawerOnPhone
        panelMinWidth={220}
        triggerContent={<>
          <span>{label}</span>
          {caption && <span className={sn.scopeCaption}>{caption}</span>}
        </>}
      >
        {choices.map(c => (
          <CoachToolbarMenuItem key={c.key} label={c.label} checked={c.key === value} onSelect={() => onChoose(c.key)} />
        ))}
      </CoachToolbarMenu>
      <button type="button" className={sn.arrow} onClick={() => next && onChoose(next)} disabled={!next} aria-label={nextLabel}>
        <ChevronRight size={16} aria-hidden />
      </button>
    </div>
  );
}
