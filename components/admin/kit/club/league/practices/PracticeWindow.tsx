'use client';
import { useState, type ReactNode } from 'react';
import { CalendarClock } from 'lucide-react';
import KitDialog from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { RecordAction, RecordDelete } from '../../RepKit';
import { formatInOrgZone, utcToZonedInputs } from '@/lib/timezone';
import { formatTimeRange } from '@/lib/utils';
import { repeatsWords, PRACTICE_WINDOW_WORDS as W } from '@/lib/league-practice-time';
import type { LeaguePractice } from '@/lib/types';
import s from '../time/LeagueTime.module.css';
import p from './PracticeWindow.module.css';

/**
 * A PRACTICE'S WINDOW, READ FIRST (Club Tier Stage 11b Part 4, frame h2). One component for wherever a house-league
 * practice opens — today's Practices view, and 9d-2a's List · Week · Month when it rebuilds them.
 *
 * ⚖ A practice handed out from the club's time (`clubScheduleSlotId`) reads When · Where · Repeats · From, and says only the
 * club's schedule changes it (9d2·5): no pencil, no Cancel — the route refuses both. Its one rare door, "Change U12's
 * practice time", opens Practice time for whoever runs the season; a registrar reads the same facts without it.
 * ⚖ A practice booked by hand gains a pencil: on a series it asks first, "This practice only" or "This & future" (the rep
 * coach's rows, ruled 2026-10-09: the form must know its dates), then the page opens the form. Cancel keeps today's three
 * choices (the page's own window). A cancelled practice reads, and changes no more.
 */
export default function PracticeWindow({ practice, teamName, divisionName, teamPractices, canRun, onClose, onEdit, onCancel, onChangePracticeTime }: {
  practice: LeaguePractice;
  teamName: string;
  divisionName: string;
  /** The team's practices, for Repeats. */
  teamPractices: readonly LeaguePractice[];
  /** Runs the season (owner, admin, league admin on a live season): the pencil and the doors show. */
  canRun: boolean;
  onClose: () => void;
  onEdit: (scope: 'one' | 'rest') => void;
  onCancel: () => void;
  onChangePracticeTime: () => void;
}) {
  const [asking, setAsking] = useState<'one' | 'rest' | null>(null);
  const fromClub = !!practice.clubScheduleSlotId;
  const live = practice.status !== 'cancelled';
  const series = !!practice.recurrenceGroupId;
  const editable = canRun && live && !fromClub;

  const start = practice.scheduledAt ? utcToZonedInputs(practice.scheduledAt) : null;
  const end = practice.endsAt ? utcToZonedInputs(practice.endsAt) : null;
  const when = practice.scheduledAt && start
    ? `${formatInOrgZone(practice.scheduledAt, { weekday: 'short', month: 'short', day: 'numeric' })} · ${formatTimeRange(start.time, end?.time ?? null)}`
    : null;
  const repeats = repeatsWords(practice, teamPractices);

  const fact = (label: string, value: ReactNode) => (
    <div><dt>{label}</dt><dd>{value}</dd></div>
  );

  if (asking) {
    return (
      <KitDialog kind="form" eyebrow={W.eyebrow(divisionName)} title={W.scopeTitle} onClose={onClose}
        back={{ label: W.title(teamName), onBack: () => setAsking(null) }} levelKey="scope"
        footer={<>
          <button type="button" className="btn btn-outline" onClick={() => setAsking(null)}>{W.close}</button>
          <button type="button" className="btn btn-lime" onClick={() => onEdit(asking)}>{W.scopeNext}</button>
        </>}>
        <fieldset className={p.choices}>
          <legend className={p.legend}>{W.scopeTitle}</legend>
          {(['one', 'rest'] as const).map(scope => (
            <label key={scope} className={p.choice}>
              <input type="radio" name="practice-edit-scope" checked={asking === scope} onChange={() => setAsking(scope)} />
              <span>{scope === 'one' ? W.scopeOne : W.scopeRest}</span>
            </label>
          ))}
        </fieldset>
      </KitDialog>
    );
  }

  return (
    <KitDialog kind="form" size="medium" record eyebrow={W.eyebrow(divisionName)} title={W.title(teamName)} onClose={onClose} levelKey="read"
      edit={editable ? { editing: false, label: W.edit, onToggle: () => (series ? setAsking('one') : onEdit('one')) } : undefined}>
      <dl className={s.facts}>
        {when && fact(W.when, when)}
        {practice.location && fact(W.where, practice.location)}
        {repeats && fact(W.repeats, repeats)}
        {fromClub && fact(W.from, W.fromValue(practice.fromSchedule))}
        {!fromClub && practice.notes && fact(W.notes, practice.notes)}
      </dl>
      {fromClub && <p className={ck.hint}>{W.onlyTheClub}</p>}
      {fromClub && canRun && live && (
        <div className={p.door}>
          <RecordAction icon={<CalendarClock size={13} aria-hidden />} onClick={onChangePracticeTime}>{W.changeTime(divisionName)}</RecordAction>
        </div>
      )}
      {editable && (
        <div className={p.door}>
          <RecordDelete onClick={onCancel}>{W.cancel}</RecordDelete>
        </div>
      )}
    </KitDialog>
  );
}
