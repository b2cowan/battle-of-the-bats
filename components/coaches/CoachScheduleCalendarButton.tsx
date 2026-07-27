'use client';

import { useState } from 'react';
import { CalendarPlus, Check } from 'lucide-react';
import type { ICSEventInput } from '@/lib/export/ics';
import styles from './CoachTournamentRecord.module.css';

/**
 * B1.1 — "Add all games to your calendar" for the Schedule zone.
 *
 * The ICS EVENTS are built server-side (in CoachTournamentRecord) and passed down
 * ready-made, so this ships a handful of small objects instead of the tournament's
 * whole games/teams/divisions payload just to filter it again in the browser. The
 * heavy lifting still reuses the shipped `downloadICS` builder — dynamically
 * imported on click so the `ics` package never lands in the record page's bundle.
 *
 * Honesty (approved mockups 2026-07-27): an .ics download is a SNAPSHOT, not a
 * subscription. If the organizer moves a game the coach's calendar will not update
 * itself, so the caption says so rather than letting them discover it on Saturday.
 */
export default function CoachScheduleCalendarButton({
  filename,
  events,
  gameCount,
}: {
  filename: string;
  events: ICSEventInput[];
  gameCount: number;
}) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');

  if (events.length === 0) return null;

  async function handle() {
    if (state === 'busy') return;
    setState('busy');
    try {
      const { downloadICS } = await import('@/lib/export/ics');
      await downloadICS(filename, events);
      setState('done');
      window.setTimeout(() => setState('idle'), 2400);
    } catch {
      // A failed download shouldn't strand the button in a spinner.
      setState('idle');
    }
  }

  return (
    // Approved mockups put the button AND its caveat inside one card, so the caveat
    // reads as part of the control rather than loose page text under it.
    <div className={`card ${styles.calBlock}`}>
      <button type="button" className={styles.calBtn} onClick={handle} disabled={state === 'busy'}>
        {state === 'done' ? <Check size={14} aria-hidden /> : <CalendarPlus size={14} aria-hidden />}
        {state === 'done'
          ? 'Added to your downloads'
          : `Add ${gameCount === 1 ? 'this game' : `all ${gameCount} games`} to your calendar`}
      </button>
      <p className={styles.calNote}>
        Opens in your phone or computer calendar. This is a snapshot — if the organizer changes a
        time or field later, add it again to pick up the change.
      </p>
    </div>
  );
}
