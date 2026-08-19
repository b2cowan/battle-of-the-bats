'use client';
import { useState, useEffect, useCallback, use, Fragment } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { CalendarCheck, ArrowRight, ChevronRight, ChevronDown } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import { SkeletonBlock } from '@/components/admin/AdminSkeleton';
import {
  COACH_GAME_EVENT_TYPES, eventDisplayTitle, formatEventWhen, pickNextOrMostRecent,
} from '@/lib/coach-tournament-games';
import { resolveAttendanceView } from '@/lib/coach-attendance-view';
import { formatStoredDate } from '@/lib/timezone';
import MonthlyAttendanceChart from '@/components/charts/MonthlyAttendanceChart';
import type { MonthlyAttendanceBucket } from '@/lib/coach-monthly-attendance';
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

/** One missed session — a receipt line behind a fraction. */
interface AttendanceAbsence {
  eventId: string;
  day: string;
  label: string;
  kind: 'game' | 'practice';
}

interface AttendanceRow {
  playerId: string;
  playerFirstName: string;
  playerLastName: string;
  games: CategoryStat;
  practices: CategoryStat;
  /** Recorded absences, most recent first. Present for every player; empty for most of them. */
  absences: AttendanceAbsence[];
  /** Set only when EVERY absence falls on the same weekday and there are ≥2 — a fact about the
   *  calendar (a clashing lesson, a shared ride), never about the child. */
  sameWeekday: string | null;
}

// "attended / known" — known excludes no-reply so an untracked RSVP never counts against a player.
function fraction(s: CategoryStat): string | null {
  return s.known > 0 ? `${s.attended}/${s.known}` : null;
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);

/**
 * The four season figures above the table (Reports Portal P2, 2026-08-19).
 *
 * ⚠⚠ **THE FOURTH TILE IS NOT AN "RSVP REPLY RATE", AND THE MOCKUP'S NAME FOR IT WAS WRONG.** It was
 * drawn as "RSVP reply rate · replied before event day" — but **nobody replies**: RSVP here is a
 * status the COACH sets on the schedule screen, there is no family reply channel and no reply
 * timestamp anywhere in the product. Shipping that label would have credited families for a reply
 * they never sent and blamed them for silence that is actually a half-finished sheet.
 *
 * What the same arithmetic honestly measures is the coach's OWN record-keeping: `known / recorded`
 * — of every player-session you took attendance for, the share that got a definite in-or-out rather
 * than being left at no reply. That is worth showing precisely because `known` is the denominator
 * of every other figure on this screen, so a low number here says "these percentages rest on less
 * than you think". (Owner call, 2026-08-19.)
 */
function seasonTotals(rows: AttendanceRow[]) {
  const t = rows.reduce((acc, r) => ({
    gAtt: acc.gAtt + r.games.attended, gKnown: acc.gKnown + r.games.known,
    pAtt: acc.pAtt + r.practices.attended, pKnown: acc.pKnown + r.practices.known,
    known: acc.known + r.games.known + r.practices.known,
    recorded: acc.recorded + r.games.recorded + r.practices.recorded,
  }), { gAtt: 0, gKnown: 0, pAtt: 0, pKnown: 0, known: 0, recorded: 0 });
  return {
    season: pct(t.gAtt + t.pAtt, t.gKnown + t.pKnown),
    games: pct(t.gAtt, t.gKnown),
    practices: pct(t.pAtt, t.pKnown),
    marked: pct(t.known, t.recorded),
  };
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

  /**
   * ⚠⚠ **THE OPEN DRILL-IN LIVES IN THE ADDRESS, NOT IN `useState`** — `?player=`, the same call the
   * Money hub's fundraiser sub-view made (2026-08-14). Three reasons, and the third is the one that
   * would have been found late:
   *   · a coach can send "look at this row" to an assistant, and Back steps out of it;
   *   · it survives a refresh, so a half-read receipt list is not lost to a stray reload;
   *   · ⚠ **a drill-in that arrives CLOSED is invisible to `check:layout`.** The sweep opens a URL
   *     and measures what renders — it cannot click. An open state with no address would never be
   *     measured at any width, which is precisely the trap OWNER_QA_LEDGER §58 records against this
   *     portal. `scripts/layout-screens.mjs` addresses it as `coach-attendance-receipts`.
   *
   * ⚠⚠ **`push`, NOT `replace` — and the first version got this wrong while its own comment claimed
   * otherwise.** It used `replace` "so Back steps out of it", which is exactly backwards: `replace`
   * OVERWRITES the history entry the tab was opened with, so the closed-table URL stops existing and
   * Back ejects the coach out of Insights entirely instead of closing the row they just opened.
   *
   * `push` is also what the house already does with this shape: the Money hub opens its fundraiser
   * sub-view with a `<Link>` (a push) and reserves `replace` for its FILTER chips, where burying the
   * page under one entry per chip really would be wrong. **A drill-in is a place; a filter is a
   * setting.** Opening several rows costs several Back presses, which is the ordinary bargain.
   */
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openPlayerId = searchParams.get('player');
  function toggleReceipts(playerId: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (openPlayerId === playerId) sp.delete('player'); else sp.set('player', playerId);
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const [rows, setRows] = useState<AttendanceRow[]>([]);
  // Insights P3 (2026-08-19) — schedule-blind, so it fills in for every attendance-access coach
  // regardless of `hasReceipts` (see the route's own header for why a month bucket is safe either
  // way, unlike the per-event receipts below).
  const [monthly, setMonthly] = useState<MonthlyAttendanceBucket[]>([]);
  /** Whether the drill-in is available at all — false for a coach without schedule access, whose
   *  receipts the route withholds. ⚠ Distinct from "nobody missed anything", which it must never
   *  be rendered as. */
  const [hasReceipts, setHasReceipts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /**
   * ⚠⚠ **WHICH TEAM THE ROWS ON SCREEN ACTUALLY DESCRIBE** — the guard this panel's five siblings
   * carry and it did not.
   *
   * A coach with several assignments can move between teams **without this panel unmounting**
   * (panels stay mounted by design, hidden with `display:none`). Both loads here are already guarded
   * against a superseded RESPONSE landing — but nothing stopped the render that happens *between*
   * `teamId` changing and the effects re-firing, which committed the PREVIOUS team's rows under the
   * new team's header. With P2 that window grew teeth: the season tiles state percentages, the
   * chevrons name players in their `aria-label`, and the "Take attendance" card combines the NEW
   * team's base URL with the OLD team's event id — a link into another team's schedule.
   *
   * Same shape as `playing-time/panel.tsx`, deliberately, so `coach-insights-portal.test.ts`'s
   * "every panel that guards its paint on a team also guards its writes" assertion now actually
   * covers this file — it skips any panel with no `loadedFor` at all, so the protection was opt-in
   * and this panel had silently opted out.
   */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
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
      // ⚠ `?monthly=1` opts into the monthly-chart aggregate — the route has a second caller (the
      // team Overview attendance tile) that never reads it, and unconditionally computing it there
      // was a real cost regression the P3 build didn't intend (found in review).
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/attendance?monthly=1`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const data = await res.json();
      if (!isStale()) {
        setRows(data.players ?? []);
        setHasReceipts(data.receipts === true);
        setMonthly(data.monthly ?? []);
      }
    } catch (e: unknown) {
      if (!isStale()) setError(e instanceof Error ? e.message : 'Failed to load attendance.');
    } finally {
      // ⚠ A stale run must not stamp its own team here — the defect its sibling panel was built to
      // survive. Guarding the paint but not this write is what strands a panel forever.
      if (!isStale()) {
        setLoadedFor(teamId);
        setLoading(false);
      }
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
    // ⚠ `loadedFor !== teamId` counts as still loading. It is true on the very first render after a
    // team switch — before the effects have re-fired — and that is exactly the frame in which the
    // previous team's rows would otherwise be painted under this team's name.
    loading: loading || loadedFor !== teamId,
    error: !!error, rowCount: rows.length, hasAnyData,
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
              {/* ── The season figures (Reports Portal P2) ────────────────────────────────────
                  ⚠ ABSENT rather than zeroed until there is something to state, which is the
                  Dashboard's own rule for this same band: "a tile with no data is ABSENT, and an
                  absent tile claims nothing". A row of 0% over a season nobody has marked yet is a
                  confident wrong answer, and the note below already says nothing is recorded.
                  ⚠ Reuses the hub's scoreboard recipe (`insightsBand`/`insightsStat`) rather than a
                  second set of tile classes — the portal has ONE stat band, and a report growing its
                  own would be the drift `CoachTabBar` was extracted to prevent. */}
              {settled && hasAnyData && (() => {
                const t = seasonTotals(rows);
                return (
                  <div className={styles.insightsBand}>
                    <div className={styles.insightsStat}>
                      <span className={styles.insightsStatLbl}>Season</span>
                      <span className={styles.insightsStatVal}>{t.season ?? '—'}<small>%</small></span>
                      <span className={styles.insightsStatCap}>Games and practices</span>
                    </div>
                    {t.games != null && (
                      <div className={styles.insightsStat}>
                        <span className={styles.insightsStatLbl}>Games</span>
                        <span className={styles.insightsStatVal}>{t.games}<small>%</small></span>
                      </div>
                    )}
                    {t.practices != null && (
                      <div className={styles.insightsStat}>
                        <span className={styles.insightsStatLbl}>Practices</span>
                        <span className={styles.insightsStatVal}>{t.practices}<small>%</small></span>
                      </div>
                    )}
                    {t.marked != null && (
                      <div className={styles.insightsStat}>
                        <span className={styles.insightsStatLbl}>Recorded</span>
                        <span className={styles.insightsStatVal}>{t.marked}<small>%</small></span>
                        {/* ⚠ NOT a reply rate — see `seasonTotals`. This is how much of your own
                            sheet you finished, and it is the denominator of every figure beside it. */}
                        <span className={styles.insightsStatCap}>Marked in or out, not left blank</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Month by month (Insights P3, 2026-08-19) ── No empty state of its own: when
                  nothing is recorded yet, `monthly` is simply empty and the note two blocks below
                  already says so — a second "nothing yet" card here would repeat it. */}
              {monthly.length > 0 && <MonthlyAttendanceChart buckets={monthly} />}

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
                      {/* ⚠⚠ NO sort affordance on any column, ever. Roster order is the only order —
                          this is a support read to inform playing-time decisions, and a sortable
                          column is a leaderboard however neutrally it is drawn.

                          ⚠ **RE-AFFIRMED, NOT INHERITED (owner ruling, 2026-08-19).** The P2 mockup
                          drew this table SORTABLE with an amber "Missed most practices" badge on a
                          named child, and mockups are the spec in this repo — so the contradiction
                          went to the owner rather than being resolved by whichever artefact was read
                          last. The ruling stands and the badge is not built. What replaced them is
                          the drill-in below: every row carries the SAME affordance, so a coach can
                          investigate anyone without the screen nominating anyone. Naming the
                          least-reliable player remains the job of ONE sentence in "What stands out",
                          which fires only above a tracked-sessions bar. */}
                      <th className={styles.th}>Player</th>
                      <th className={`${styles.th} ${styles.thNum}`}>Games</th>
                      <th className={`${styles.th} ${styles.thNum}`}>Practices</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* ⚠ `settled`, not `loading`. Real rows are a CLAIM about this team, and a
                        claim may not be painted until both lookups have landed — otherwise the
                        table appears and is then taken away again. See `settled` above. */}
                    {/* One Fragment per player holding the row and, when it is open, its receipts —
                        two <tr> siblings under <tbody>, which is what a table needs. (Not
                        `flatMap` over single-element arrays: that expressed "one row, maybe two"
                        as two nested array literals and a flatten.) */}
                    {!settled ? skeletonRows : rows.map(r => {
                      const tracked = r.games.known > 0 || r.practices.known > 0;
                      const games = fraction(r.games);
                      const practices = fraction(r.practices);
                      const fullName = [r.playerFirstName, r.playerLastName].filter(Boolean).join(' ');
                      const open = openPlayerId === r.playerId;
                      const receiptsId = `att-receipts-${r.playerId}`;
                      return (
                        <Fragment key={r.playerId}>
                        <tr className={styles.tr}>
                          <td className={`${styles.td} ${att.nameCell}`}>
                            <div className={att.nameRow}>
                              <Link href={`${base}/roster/${r.playerId}`} className={att.name}>
                                {fullName}
                              </Link>
                              {/* ⚠ ON EVERY ROW, INCLUDING THE ONES WITH NOTHING TO SHOW — that
                                  uniformity IS the ruling. A chevron that appeared only where there
                                  were absences would be the badge the owner declined, drawn as an
                                  affordance instead of a label.
                                  Icon-only at every width, so `aria-label` carries the whole name of
                                  the action (house rule: a mobile icon action names itself). */}
                              {/* ⚠ `hasReceipts` as well as `hasAnyData`: a coach without schedule
                                  access has the report but not the receipts, and an affordance that
                                  opens onto "nothing missed" would be a confident wrong answer. */}
                              {hasAnyData && hasReceipts && (
                                <button
                                  type="button"
                                  className={att.receiptsBtn}
                                  aria-expanded={open}
                                  aria-controls={receiptsId}
                                  aria-label={open
                                    ? `Hide the sessions ${fullName} missed`
                                    : `Show the sessions ${fullName} missed`}
                                  onClick={() => toggleReceipts(r.playerId)}
                                >
                                  <ChevronDown
                                    size={15}
                                    aria-hidden
                                    className={`${att.receiptsCaret}${open ? ` ${att.receiptsCaretOpen}` : ''}`}
                                  />
                                </button>
                              )}
                            </div>
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
                        {open && (
                        /* ── THE RECEIPTS (Reports Portal P2) ────────────────────────────────
                           The records behind the two fractions above — every session this player
                           was marked ABSENT for, most recent first.

                           ⚠ **NO CAP, deliberately.** The receipts discipline the Ask build
                           established says a cited record must stay reachable; the cheapest way to
                           honour that is not to truncate. A season's absences for one player is a
                           handful of lines, and this list only exists because the coach opened it.

                           ⚠ **GAMES AND PRACTICES BOTH**, because the row above states a fraction
                           for each. A practices-only list under a games number would be a receipt
                           that visibly fails to add up to the thing it explains. */
                        <tr className={`${styles.tr} ${att.receiptsRow}`}>
                          <td className={`${styles.td} ${att.receiptsCell}`} colSpan={3} id={receiptsId}>
                            <p className={att.receiptsHead}>Sessions missed &mdash; the records behind these figures</p>
                            {r.absences.length === 0 ? (
                              <p className={att.receiptsNone}>
                                {tracked
                                  ? 'Nothing missed — present for every session with a recorded answer.'
                                  : 'Nothing recorded for this player yet.'}
                              </p>
                            ) : (
                              <>
                                <ul className={att.receiptsList}>
                                  {r.absences.map(a => {
                                    const kind = a.kind === 'practice' ? 'Practice' : 'Game';
                                    // The event's own words, unless they only repeat the kind.
                                    const detail = a.label && a.label.toLowerCase() !== kind.toLowerCase()
                                      ? a.label : null;
                                    return (
                                      <li key={a.eventId}>
                                        {/* formatStoredDate, never a raw slice — the day arrives as
                                            the ORG's calendar day and must be printed as one. */}
                                        <span className={att.receiptsDay}>{formatStoredDate(a.day, { withYear: false })}</span>
                                        <span className={att.receiptsKind}>{kind}</span>
                                        {detail && <span className={att.receiptsDetail}>{detail}</span>}
                                      </li>
                                    );
                                  })}
                                </ul>
                                {/* A fact about the CALENDAR — a clashing lesson, a shared ride —
                                    never about the child. It only appears when it is true of every
                                    absence, so it can't be read as a tendency. */}
                                {r.sameWeekday && (
                                  <p className={att.receiptsNote}>
                                    Every one of these falls on a {r.sameWeekday}.
                                  </p>
                                )}
                              </>
                            )}
                            {/* ⚠ NO SECOND "Email the family" DOOR, though the mockup drew one. The
                                player's name one line above already opens their profile, where that
                                button lives beside the guardian's address — and a second door to the
                                same place, one line apart, is one door too many (the rule
                                CoachPageHeader already states, and the same call the empty state's
                                dropped "How attendance works" button made). It would also need the
                                guardian-PII grant, which this screen's own gate does not imply. */}
                          </td>
                        </tr>
                        )}
                        </Fragment>
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
