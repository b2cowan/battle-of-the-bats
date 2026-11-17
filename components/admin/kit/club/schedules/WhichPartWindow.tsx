'use client';
/**
 * REGENERATE WHICH PART? / SETTINGS FOR WHICH PART? (Phase 8, Session 3 — drawing tab 4; owner ruling 4, 2026-11-16: "One
 * part at a time"). Asked only on a schedule with added parts, and asked FIRST, so switching part can never throw away
 * edits half made. Then the shipped regenerate question or Settings window opens on that part alone; a regenerate of one
 * part never touches another.
 *
 * The choice is the shipped view switch (one white track) — up to three choices, as the switch's own rule says; past that,
 * a plain select (the olive View pill's job on a toolbar, a field's here).
 */
import { useState } from 'react';
import KitDialog from '../KitDialog';
import ck from '../ClubKit.module.css';
import { ViewSwitch } from '@/components/coaches/kit';
import { formatShortWeekdayDate } from '@/lib/timezone';
import { PART_WORDS as P } from '@/lib/club-schedule-words';
import { scheduleDates, slotDays, type ScheduleView } from '@/lib/club-schedule-view';
import { memberView, type PartRead } from '@/lib/club-schedule-family';

const PARENT = '__schedule';

/** "Thu, Dec 10 · 14U AA" — when a member's time is, and who it is for (the page's meta line's words). */
function summaryOf(v: ScheduleView): string {
  const days = slotDays(v.slots);
  const when = days.length === 1 ? formatShortWeekdayDate(days[0]) : scheduleDates(v.schedule.startsOn, v.schedule.endsOn);
  const names = v.teams.filter(t => v.slots.some(x => x.teamIds.includes(t.id))).map(t => t.name);
  return `${when} · ${P.metaTeams(names)}`;
}

export default function WhichPartWindow({ then, parentName, parentView, parts, onPick, onClose }: {
  then: 'settings' | 'regenerate';
  parentName: string;
  parentView: ScheduleView;
  parts: readonly PartRead[];
  /** The part chosen (null: the schedule itself). */
  onPick: (partId: string | null) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string>(PARENT);
  const choices = [{ id: PARENT, label: parentName }, ...parts.map(p => ({ id: p.id, label: p.label }))];
  const chosen = choices.find(c => c.id === picked) ?? choices[0];
  const view = memberView(parentView, parts, picked === PARENT ? null : picked);
  const hint = then === 'regenerate'
    ? P.whichRegenHint(chosen.label, choices.filter(c => c.id !== chosen.id).map(c => c.label))
    : P.whichSettingsHint(chosen.label, summaryOf(view));
  return (
    <KitDialog
      kind="question"
      eyebrow={parentName}
      title={then === 'regenerate' ? P.whichRegenTitle : P.whichSettingsTitle}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose}>{P.whichBack}</button>
          <button type="button" className="btn btn-lime" onClick={() => onPick(picked === PARENT ? null : picked)}>
            {then === 'regenerate' ? P.whichRegenGo : P.whichSettingsGo}
          </button>
        </>
      )}
    >
      <div className={ck.field}>
        <span className={ck.label} id="which-part-label">{P.whichPart}</span>
        {choices.length <= 3 ? (
          <ViewSwitch views={choices} value={picked} onChange={setPicked} label={P.whichPart} />
        ) : (
          <select className={ck.select} aria-labelledby="which-part-label" value={picked} onChange={e => setPicked(e.target.value)}>
            {choices.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        )}
        <span className={ck.hint}>{hint}</span>
      </div>
    </KitDialog>
  );
}
