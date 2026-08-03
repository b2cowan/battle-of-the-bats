'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, ClipboardList, PencilLine } from 'lucide-react';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import { tournamentToday, formatInOrgZone } from '@/lib/timezone';
import type { RepTeamEvent } from '@/lib/types';
// Path copied verbatim from the verified sibling `CoachStaffPanel.tsx` — a CSS-module import is
// invisible to TypeScript, so a wrong depth compiles happily and ships an unstyled screen.
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import css from './CoachHelperHome.module.css';

/**
 * The HELPER's home (Practice Plans Phase 4, mockup frames H1 / H4 / H5).
 *
 * A helper is a parent volunteer or an outside instructor invited to run one station. The coach
 * Overview — six tiles about the roster, attendance, dues and lineups — has literally nothing it can
 * render for them, so this stands in its place: **the practice they turned up for, and nothing
 * else.** D30 calls it "the helper's one-screen portal"; this is that screen's front door, and the
 * station itself is the run screen that already shipped in slice 1b (D28), reused rather than
 * redrawn.
 *
 * ⚠ WHICH PERSON GETS THIS IS DECIDED BY CAPABILITIES, NOT BY A ROLE — see the caller. Nothing here
 * grants anything: every door this screen offers is one the server would have opened anyway, and
 * every door it omits is one the server would refuse. It is an altitude choice, not a gate.
 *
 * ⚠ NO DEAD ENDS. Every state below either offers a practice or explains, in the coach's own terms,
 * why there isn't one — because "a door a persona can SEE but not USE is a bug wearing a politer
 * face", and a helper has exactly one door to get wrong.
 */

type Props = {
  orgSlug: string;
  teamId: string;
  teamName: string;
  /**
   * IANA zone. Left undefined by every caller today, which resolves to the org zone inside
   * `lib/timezone.ts` — the same way every other date in the portal is formatted. ⚠ "Today" is a
   * question about the team's calendar, never the browser's: a helper opening this on a phone still
   * set to another province must not be told there is no practice.
   */
  timeZone?: string;
};

type EventsResponse = { events?: RepTeamEvent[] };

/** A practice, reduced to what this screen asks of it. */
type PracticeRow = {
  id: string;
  /** `YYYY-MM-DD` in the ORG's zone, so "today" survives a coach travelling and a UTC midnight. */
  day: string;
  startsAt: string;
  location: string | null;
  hasPlan: boolean;
};

const DATE_LONG: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
const DATE_SHORT: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
const TIME_ONLY: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

export default function CoachHelperHome({ orgSlug, teamId, teamName, timeZone }: Props) {
  const [practices, setPractices] = useState<PracticeRow[] | null>(null);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events?type=practice`);
      if (!res.ok) throw new Error('We could not load the practice schedule.');
      const json: EventsResponse = await res.json();
      const rows = (json.events ?? [])
        .filter(e => e.eventType === 'practice' && e.status !== 'cancelled')
        .map(e => ({
          id: e.id,
          day: tournamentToday(new Date(e.startsAt), timeZone),
          startsAt: e.startsAt,
          location: e.location ?? null,
          // The plan rides the event, so this needs no second request — and it is the difference
          // between "come back later" and "here is your station", which is the whole of H5.
          hasPlan: Boolean(e.practicePlan),
        }))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      setPractices(rows);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'We could not load the practice schedule.');
    }
  }, [orgSlug, teamId, timeZone]);

  useEffect(() => { void load(); }, [load]);

  const today = tournamentToday(new Date(), timeZone);
  const todays = practices?.find(p => p.day === today) ?? null;
  /**
   * ⚠ Compared as `YYYY-MM-DD` STRINGS in the org's zone, never as timestamps. A practice at 6:30pm
   * is "today" all day, and an instant comparison would drop it off this screen the moment it
   * started — which is precisely when the helper is standing in the car park opening their phone.
   */
  const upcoming = (practices ?? []).filter(p => p.day > today).slice(0, 3);

  const runHref = (eventId: string) =>
    `/${orgSlug}/coaches/teams/${teamId}/practice/${eventId}/run`;

  return (
    <div className={css.wrap}>
      <header className={css.head}>
        <p className={css.eyebrow}>{teamName}</p>
        <h1 className={css.title}>
          {todays ? 'Tonight’s practice' : 'Practices'}
        </h1>
      </header>

      {loadError && (
        <div className={css.card}>
          <p className={styles.errorText}>{loadError}</p>
          <button type="button" className={styles.btnSecondary} onClick={() => { void load(); }}>
            Try again
          </button>
        </div>
      )}

      {!practices && !loadError && <p className={styles.muted}>Loading…</p>}

      {/* ── H1: there is a practice today, and a plan to open ─────────────────── */}
      {todays && todays.hasPlan && (
        <div className={css.card}>
          <p className={css.when}>
            {formatInOrgZone(todays.startsAt, DATE_LONG, 'en-CA', timeZone)}
            {' · '}
            {formatInOrgZone(todays.startsAt, TIME_ONLY, 'en-CA', timeZone)}
          </p>
          {todays.location && <p className={css.where}>{todays.location}</p>}
          <p className={css.lede}>
            Open the plan to find your station and the group with you.
          </p>
          {/*
            Straight to the run screen, not to the plan editor's read view: the helper is standing
            on a field, and the run screen is the surface built for a phone held in one hand. It
            offers the station picker first, with theirs already picked out if the coach tagged
            them on it.
          */}
          {/*
            The RUN screen's own primary, not the portal's — this control leads straight into that
            screen, and it is the 56px target sized for a gloved hand outdoors. Reusing it means the
            helper's one button is the same object they will keep tapping once they are inside.
          */}
          <Link href={runHref(todays.id)} className={`${styles.ppRunPrimary} ${css.openStation}`}>
            <ClipboardList size={16} aria-hidden /> Open my station
          </Link>
        </div>
      )}

      {/* ── H5: the practice exists, but nobody has written the plan yet ──────── */}
      {todays && !todays.hasPlan && (
        <div className={css.card}>
          <p className={css.when}>
            {formatInOrgZone(todays.startsAt, DATE_LONG, 'en-CA', timeZone)}
            {' · '}
            {formatInOrgZone(todays.startsAt, TIME_ONLY, 'en-CA', timeZone)}
          </p>
          {todays.location && <p className={css.where}>{todays.location}</p>}
          {/*
            ⚠ `quiet` is the correct variant by the component's own rule: this block carries no CTA,
            because none of the actions are the helper's to take. An empty state that invents a
            button is worse than one that admits the wait.
          */}
          <CoachEmptyState
            quiet
            icon={<PencilLine size={18} aria-hidden />}
            headline="The plan isn’t written yet"
            description="When your coach writes it, your station will show up here. Nothing to do until then."
          />
        </div>
      )}

      {/* ── H4: no practice today ─────────────────────────────────────────────── */}
      {practices && !todays && (
        <div className={css.card}>
          {/*
            ⚠ The genuinely empty case is stated plainly rather than dressed up. A helper with no
            practices ahead of them has been added early, or the season is over — and saying so is
            more use than an encouraging blank.
          */}
          <CoachEmptyState
            quiet
            icon={<CalendarClock size={18} aria-hidden />}
            headline="No practice today"
            description={upcoming.length > 0 ? (
              <>
                The next one is{' '}
                <strong>
                  {formatInOrgZone(upcoming[0].startsAt, DATE_LONG, 'en-CA', timeZone)}
                  {', '}
                  {formatInOrgZone(upcoming[0].startsAt, TIME_ONLY, 'en-CA', timeZone)}
                </strong>
                {upcoming[0].location ? ` at ${upcoming[0].location}` : ''}. You’ll be able to open
                the plan on the day.
              </>
            ) : (
              'There’s nothing on the practice schedule at the moment. Your coach will add the next one when it’s set.'
            )}
          />
        </div>
      )}

      {/* The rest of a helper's schedule access, spent where it is worth something. */}
      {upcoming.length > 0 && (
        <div className={css.card}>
          <h2 className={css.sectionLabel}>Coming up</h2>
          <ul className={css.list}>
            {upcoming.map(p => (
              <li key={p.id} className={css.row}>
                <span className={css.rowDay}>
                  {formatInOrgZone(p.startsAt, DATE_SHORT, 'en-CA', timeZone)}
                </span>
                <span className={css.rowMeta}>
                  {formatInOrgZone(p.startsAt, TIME_ONLY, 'en-CA', timeZone)}
                  {p.location ? ` · ${p.location}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
