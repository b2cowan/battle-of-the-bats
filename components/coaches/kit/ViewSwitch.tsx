'use client';
/**
 * ⚖ THE VIEW SWITCH — the one control for up to three views of one body of records (the 6c rule: "the olive face chooses
 * what is read" — a switch for up to three views, the olive View pill past that; Club Tier 6c, Ask 13 — standard §11.3;
 * owner 2026-10-10, §289): the white card on the strong line, the chosen view olive, rounded (Toolbar Rules, Rule 4).
 * Every calendar wears it as `CalendarViewSwitch` (its three words); any other two- or three-view list wears it directly.
 * Its own module, styled from the kit's sheet alone, so a page that wants the switch loads neither the calendars nor the
 * portal's stylesheet (Toolbar Rules Stage 2). `toolbarView` gives it equal columns and the touch floor inside
 * `CoachListToolbar`.
 */
import kit from './CoachKit.module.css';

export default function ViewSwitch<V extends string>({ views, value, onChange, label, fill = false }: {
  views: readonly { id: V; label: string }[]; value: V; onChange: (view: V) => void; label: string;
  /** The switch takes its whole row on a phone, in equal parts (the player record's, whose write doors stack under it). */
  fill?: boolean;
}) {
  return (
    <div className={`${kit.calViews} ${kit.toolbarView}${fill ? ` ${kit.toolbarViewFill}` : ''}`} role="group" aria-label={label}>
      {views.map(v => (
        <button key={v.id} type="button" className={`${kit.calView}${value === v.id ? ` ${kit.calViewOn}` : ''}`} aria-pressed={value === v.id} onClick={() => onChange(v.id)}>
          {v.label}
        </button>
      ))}
    </div>
  );
}
