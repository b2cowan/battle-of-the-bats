'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { CalendarCheck, ArrowRight, ChevronRight } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import { SkeletonBlock } from '@/components/admin/AdminSkeleton';
import {
  COACH_GAME_EVENT_TYPES, eventDisplayTitle, formatEventWhen, pickNextOrMostRecent,
} from '@/lib/coach-tournament-games';
import { resolveAttendanceView } from '@/lib/coach-attendance-view';
import type { RepTeamEvent } from '@/lib/types';
import styles from '../../../../coaches.module.css';
import att from './attendance.module.css';

/** Event types attendance is taken on — the games plus practices and multi-day tournaments,
 *  matching the server-side reliability rollup's buckets. */
const ATTENDANCE_EVENT_TYPES = [...COACH_GAME_EVENT_TYPES, 'external_tournament', 'practice'];

interface CategoryStat {
  attended: number;
  known: number;
  recorded: number;
}

interface AttendanceRow {
  playerId: string;
  playerFirstName: string;
  playerLastName: string;
  games: CategoryStat;
  practices: CategoryStat;
}

// "attended / known" — known excludes no-reply so an untracked RSVP never counts against a player.
function fraction(s: CategoryStat): string | null {
  return s.known > 0 ? `${s.attended}/${s.known}` : null;
}

export function AttendancePanel({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const params = use(paramsPromise);
  const { orgSlug, teamId } = params;
  const { loading: ctxLoading } = useCoaches();
  // Which SEASON is on screen — the team's LIVE one, always. `page.capabilities` are that
  // season's. ⚠ `page.canWrite()` is GONE (2026-08-18): it folded read-only into every write
  // flag, and a closed season no longer renders this screen at all, so a capability check is
  // just a capability check.
  const page = useCoachSeasonPage(orgSlug, teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Batch 4 (f8-2): the report explained what it WOULD show but never said where attendance is
  // actually recorded. This is the event it points at — the next one coming up, or failing that
  // the most recent one played, so the answer to "where do I do this?" is a live link, not prose.
  const [markTarget, setMarkTarget] = useState<RepTeamEvent | null>(null);
  // ⚠ A null target and an unanswered request look identical from here. Rendering the empty state
  // on `null` alone meant every visit opened with "Nothing to take attendance for yet" for as long
  // as the lookup took — a confident, wrong answer given before we had looked. These two flags keep
  // the three states apart: still looking / looked and found nothing / could not look.
  const [markTargetLoading, setMarkTargetLoading] = useState(true);
  const [markTargetFailed, setMarkTargetFailed] = useState(false);

  const load = useCallback(async (isStale: () => boolean = () => false) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/attendance`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const data = await res.json();
      if (!isStale()) setRows(data.players ?? []);
    } catch (e: unknown) {
      if (!isStale()) setError(e instanceof Error ? e.message : 'Failed to load attendance.');
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, [orgSlug, teamId]);

  // Non-fatal: the report stands on its own if this fails — it just loses the shortcut.
  const loadMarkTarget = useCallback(async (isStale: () => boolean = () => false) => {
    // ⚠ All three reset together, and the remembered event MUST be one of them. Leaving it set
    // meant a lookup that FAILED kept the previous team's game on screen — the render tests
    // `markTarget` before `markTargetFailed`, so switching teams and hitting a network blip showed
    // team A's game behind a "Take attendance" button pointing at team B's schedule.
    setMarkTargetLoading(true);
    setMarkTargetFailed(false);
    setMarkTarget(null);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events`);
      if (!res.ok) { if (!isStale()) setMarkTargetFailed(true); return; }
      const data: { events?: RepTeamEvent[] } = await res.json();
      if (isStale()) return;
      setMarkTarget(pickNextOrMostRecent(data.events ?? [], {
        types: ATTENDANCE_EVENT_TYPES,
        now: Date.now(),
      }));
    } catch {
      /* the shortcut is a convenience, never a dependency */
      if (!isStale()) setMarkTargetFailed(true);
    } finally {
      if (!isStale()) setMarkTargetLoading(false);
    }
  }, [orgSlug, teamId]);

  // Both loads are keyed on teamId, and a coach with several assignments can switch teams without
  // this page unmounting — so a slow response for the previous team must not land on the new one.
  useEffect(() => {
    let cancelled = false;
    void load(() => cancelled);
    return () => { cancelled = true; };
  }, [load]);
  useEffect(() => {
    let cancelled = false;
    void loadMarkTarget(() => cancelled);
    return () => { cancelled = true; };
  }, [loadMarkTarget]);

  // ⚠ No `if (ctxLoading) return <p>Loading…</p>` here, deliberately. The frame around this panel —
  // title, tab row, help button — needs no fetch and is the hub's, so it is already on screen and
  // only the two unknown regions below shimmer. Collapsing this panel to a bare line was a second
  // flash before the one this report was really filed for, and that is truer now, not less: a bare
  // line under a tab row that has already painted reads as a broken tab.
  // `hasAccess` is false until the context lands, hence the `!ctxLoading`.
  if (!ctxLoading && !page.hasAccess) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  // "Tracked" means we have at least one definite present/absent signal (a known event). Events
  // left at no-reply carry no reliability signal, so an all-no-reply player reads "not tracked yet"
  // rather than an ambiguous row of dashes.
  const hasAnyData = rows.some(r => r.games.known > 0 || r.practices.known > 0);

  /* ── Which of the four states is this? (Phase 2, owner rule 2026-08-15) ──────────────────────
     The reported defect was three regions each deciding independently that they had nothing to
     show. There is now ONE decision, taken here, and the render below is a single either/or:

       solo         → nothing to take attendance for (or nobody to take it of). One empty state,
                      and it is the only thing on the page.
       nothingYet   → the schedule has events but nobody has been marked. The COMMON first-week
                      case, and the one the old second empty state answered worst: it said
                      "nothing here" where the real roster, dashed, proves the roster is
                      connected and shows the shape that is coming.
       (otherwise)  → the report, plus the counting rules folded under it.

     ⚠ Both flags wait for BOTH fetches. A schedule known to be empty while the report is still
     in flight is not yet grounds for the solo empty state — attendance rows can outlive the
     events that produced them (a deleted game), and hiding a coach's real figures behind
     "nothing to take attendance for yet" would be the same species of confident-wrong-answer
     the `markTargetLoading` flag above already exists to prevent. */
  /**
   * ⚠ THE WHOLE DECISION LIVES IN `lib/coach-attendance-view.ts`, as a pure function, and is
   * pinned by `tests/unit/coach-attendance-view.test.ts` — including the 128-combination sweep
   * that proves no flag state produces a blank page. It is not inline here because the `/review`
   * of 2026-08-15 found a real defect in the first, inline version of exactly this logic: it
   * guarded the empty-state DECISION on both fetches but let the report branch paint real rows
   * off the roster fetch alone, so a table could appear and then vanish. A decision that costly
   * should be executable by a test rather than re-read by the next person.
   */
  const view = resolveAttendanceView({
    loading, error: !!error, rowCount: rows.length, hasAnyData,
    markTargetLoading, markTargetFailed, hasMarkTarget: !!markTarget,
  });
  const settled = view.state !== 'loading';
  const solo = view.state === 'solo';
  const nothingYet = view.showNothingYetNote;
  /**
   * ⚠ **THE FINISHED-SEASON HALF OF THIS PAGE IS DELETED** (2026-08-18). `canTakeAttendance` was
   * `!page.isReadOnly`, and it drove three branches: the shortcut card, a past-tense empty state
   * and a past-tense "nothing recorded" note. Every one of them existed to describe a season that
   * had ended — and this page is no longer reached for one at all, because a team with no live
   * season lands on its closed-season page (`CoachTeamSeasonGate`). The live halves are what
   * remain; the record halves were the twenty-nine special cases that ruling removed.
   */

  // Six placeholder rows in the real table's shell — one geometry, two renders, so the report
  // does not jump as it settles.
  const skeletonRows = Array.from({ length: 6 }).map((_, i) => (
    <tr key={i} className={styles.tr}>
      <td className={`${styles.td} ${att.nameCell}`}>
        <span className={att.name}><SkeletonBlock w="130px" h="0.8rem" /></span>
      </td>
      <td className={`${styles.td} ${styles.tdNum}`}><SkeletonBlock w="46px" h="0.8rem" /></td>
      <td className={`${styles.td} ${styles.tdNum}`}><SkeletonBlock w="46px" h="0.8rem" /></td>
    </tr>
  ));

  return (
    /* ⚠ NO WRAPPER, NO BACK LINK, NO HEADER — this is a PANEL (reports portal P1, 2026-08-18). The
       hub owns `styles.page`/`pageWide`, the <h1> and the help "?" (which serves
       `recipe-attendance` while this tab is the open one).

       ⚠⚠ **THE BACK LINK IS DELETED, AND ITS FOUR-STEP HISTORY IS WHY IT COULD FINALLY GO.** It
       said "Insights" and pointed at `/history`, and it had been rewritten three times in three
       days because its destination kept moving:

       · 2026-08-15 — a `/review` REMOVED its `?year=`, correctly: `/history/results` read no year
         at all, so the query LOOKED like it carried the season and did not. Decorating a link whose
         destination ignores it is worse than leaving it bare, because it reads as fixed.
       · 2026-08-16 (rail Phase 1) — that destination learned to read the year, inverting the
         requirement: a bare link now landed a past-season reader on the LIVE season's results.
       · 2026-08-16 (rail Phase 2) — the destination changed again, and Attendance had ONE parent.
       · 2026-08-18 (this phase) — there is no parent to return to: Attendance IS a tab of the hub
         it used to link back to, and the tab row above answers "where am I?" continuously instead
         of once, at the top, in the past tense.

       ⚠ The lesson worth keeping, and the reason each step was findable: **a deliberate omission is
       only as durable as the reason stated with it.** Every one of these was caught by re-reading
       the reason written here, never by noticing the link. */
    <>
      {solo ? (
        /* THE ONLY THING ON THE PAGE. No shortcut card, no methodology, no second "nothing
           here" — the centred card is allowed its own axis precisely because nothing else is
           competing for one. */
        <div className={att.solo}>
          {view.soloKind === 'no-roster' ? (
            /* Events exist but the roster does not. `quiet` per CoachEmptyState's own decision
               rule: this block carries NO call to action, because the coach who can hold the
               attendance duty alone may not hold roster access at all, and an "Add players"
               button that 403s is worse than no button. It is still alone on the page. */
            <CoachEmptyState
              quiet
              icon={<CalendarCheck size={22} aria-hidden />}
              headline="No active players on the roster yet"
              description="Attendance lists your active players. Once the roster is set, every game and practice starts counting."
            />
          ) : (
            <CoachEmptyState
              icon={<CalendarCheck size={22} aria-hidden />}
              headline="Nothing to take attendance for yet"
              description="Attendance is marked on a game or practice. Add one to your schedule and it'll be one tap from here."
              primaryAction={{ label: 'Open schedule', href: `${base}/schedule` }}
              /* ⚠ NO "How attendance works" SECOND BUTTON (owner call, 2026-08-15). The mockup
                 carried one, to replace the methodology this state no longer shows. But the
                 header's "?" is on this same screen, in its fixed corner, opening that exact
                 drawer — so a second door to it one line below would be the duplication this
                 phase exists to remove, wearing a politer face. Same rule CoachPageHeader
                 already states for its nested variant: two doors to the same place, one line
                 apart, is one door too many. */
            />
          )}
        </div>
      ) : (
        <>
          {/* Batch 4 — record first, review second. The review found this page explained what it
              would show but never linked to where attendance is actually taken; the round trip
              back from the game panel is the matching half. */}
          {markTargetLoading ? (
            // Card-shaped placeholder, not a message — the slot holds its size and says nothing it
            // might have to take back.
            <div className={styles.nowCard} aria-busy="true" aria-label="Looking for your next game or practice">
              <SkeletonBlock w="110px" h="0.7rem" />
              <SkeletonBlock w="min(360px, 85%)" h="1.35rem" />
              <SkeletonBlock w="170px" h="0.9rem" />
              <SkeletonBlock w="150px" h="30px" />
            </div>
          ) : markTarget ? (
            // Reuses the Overview "Right now" anchor-card family rather than a parallel set of
            // classes — same eyebrow / headline / meta / CTA shape, so the two read as one pattern.
            <div className={styles.nowCard}>
              <p className={styles.nowEyebrow}>Take attendance</p>
              <p className={styles.nowHeadline}>{eventDisplayTitle(markTarget)}</p>
              <p className={styles.nowMeta}>{formatEventWhen(markTarget.startsAt)}</p>
              <div className={styles.nowActions}>
                <Link href={`${base}/schedule?event=${markTarget.id}&tab=attendance`} className="btn btn-lime btn-sm">
                  Take attendance <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
            </div>
          ) : null /* Lookup failed, or the events are gone but their figures remain. Either way
                      we do not know the schedule is empty, so we do not say it is. */}

          {error ? (
            <p className={styles.errorText}>{error}</p>
          ) : (
            <>
              {/* Replaces the second empty state. It sits ABOVE the table because it is the
                  caption for the dashes underneath — read the other way round, a coach meets a
                  column of "—" with no explanation first. */}
              {nothingYet && (
                <p className={att.note}>
                  Nothing recorded yet — totals fill in here as you mark each game and practice.
                </p>
              )}

              {/* .tableAsCards reflows the table into stacked cards @640 (the Roster idiom), where
                  each cell's `data-label` restores the per-row wording the column headings replace
                  on a desktop. That is the whole reason the micro-labels could go. */}
              <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {/* ⚠ NO sort affordance on any column, ever. Roster order is the only order —
                          this is a support read to inform playing-time decisions, and a sortable
                          column is a leaderboard however neutrally it is drawn. */}
                      <th className={styles.th}>Player</th>
                      <th className={`${styles.th} ${styles.thNum}`}>Games</th>
                      <th className={`${styles.th} ${styles.thNum}`}>Practices</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* ⚠ `settled`, not `loading`. Real rows are a CLAIM about this team, and a
                        claim may not be painted until both lookups have landed — otherwise the
                        table appears and is then taken away again. See `settled` above. */}
                    {!settled ? skeletonRows : rows.map(r => {
                      const tracked = r.games.known > 0 || r.practices.known > 0;
                      const games = fraction(r.games);
                      const practices = fraction(r.practices);
                      return (
                        <tr key={r.playerId} className={styles.tr}>
                          <td className={`${styles.td} ${att.nameCell}`}>
                            <Link href={`${base}/roster/${r.playerId}`} className={att.name}>
                              {[r.playerFirstName, r.playerLastName].filter(Boolean).join(' ')}
                            </Link>
                          </td>
                          {/* One player untracked among tracked team-mates is a different fact from
                              "nobody has been marked yet", and it says so in words rather than
                              leaving two dashes to be read as zeros. It spans both figure columns
                              because it is one statement about the row, not two missing numbers. */}
                          {hasAnyData && !tracked ? (
                            <td className={`${styles.td} ${styles.tdNum} ${att.quiet}`} colSpan={2}>
                              not tracked yet
                            </td>
                          ) : (
                            <>
                              <td className={`${styles.td} ${styles.tdNum}${games ? '' : ` ${att.quiet}`}`} data-label="Games">
                                {games ?? '—'}
                              </td>
                              <td className={`${styles.td} ${styles.tdNum}${practices ? '' : ` ${att.quiet}`}`} data-label="Practices">
                                {practices ?? '—'}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* The methodology, kept word for word, folded shut UNDER the data instead of
                  standing between the coach and it. The first sentence is deliberate wording
                  under a standing ruling (memory/decision_playing_time_vocabulary.md) —
                  "measurement in context", never "fair" — so it travels with the rest rather
                  than being trimmed as preamble.
                  ⚠ `settled` for the same reason the rows are: it explains a table that is not
                  yet on screen, and on a page about to collapse to a solo empty state it would
                  be the second block beside an empty state that is meant to be alone. */}
              {settled && (
              <details className={att.method}>
                <summary className={att.methodHead}>
                  <ChevronRight size={14} className={att.methodCaret} aria-hidden />
                  How these figures are counted
                </summary>
                <p className={att.methodBody}>
                  A season view to inform playing-time decisions and spot when someone&apos;s drifting away — not a ranking.
                  Each figure counts games or practices where you recorded attendance; a player is &ldquo;present&rdquo;
                  when marked attending or late, and events with no reply aren&apos;t counted against anyone.
                </p>
              </details>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
