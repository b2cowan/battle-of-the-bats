'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import {
  NotebookPen, CalendarPlus, CheckCircle2, TriangleAlert, ArrowRight, HelpCircle, BookMarked,
} from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachEventListRow from '@/components/coaches/CoachEventListRow';
import { useHelpDrawer } from '@/components/help/help-drawer-context';
import { canManageSchedule, canWriteDevelopment } from '@/lib/coach-capabilities';
import { summarizePracticePlan } from '@/lib/rep-practice-plan';
import { splitUpcomingAndRecent } from '@/lib/coach-tournament-games';
import { formatInOrgZone } from '@/lib/timezone';
import styles from '../../../coaches.module.css';
import type { RepTeamEvent } from '@/lib/types';

/**
 * ── The Practice plans hub (owner-approved 2026-08-15) ───────────────────────────────────────
 *
 * Practice plans had NO front door: the only way to one was the Schedule, tapping the right
 * practice, and scrolling its panel — three interactions deep, and only if the coach already knew
 * which day the practice was on. Meanwhile Lineups, made maybe twenty times a season against a
 * plan's two-to-three times that, had a nav item, a hub, a readiness filter and a templates page.
 * This is that treatment applied to the more frequent tool.
 *
 * ⚠ NO new API. `RepTeamEvent.practicePlan` already rides the events read (mapped through
 * `parsePracticePlan` on every row), so readiness is computed from the list this page already has
 * to fetch. Do not add a per-practice probe here — the whole point is that the answer is free.
 *
 * ⚠ LIVE SEASON ONLY, and deliberately so. Practice plans are not archive-readable: the Schedule
 * panel already hides the plan section behind `!page.isReadOnly`, and neither plan route sits in
 * `APPROVED_SEASON_AWARE_ROUTES`. The nav entry lives in the live-season group, so it is
 * archive-invisible for free — but the SEASON SWITCHER can rewrite this page's own URL with a
 * `?year=`, which is why the read-only guard below is not redundant. Listing a past season's
 * practices would hand the coach a list of rows that every one of them denies on open.
 */

/** A practice is "on now" for a window either side of its start — used only to decide whether the
 *  row offers the live "Run practice" door. Clock arithmetic on absolute instants, so there is no
 *  date-boundary question and no timezone to get wrong. */
const RUN_WINDOW_MS = 3 * 60 * 60 * 1000;

/** Weekday + time only — the date tile beside this line already carries the day and month. */
function rowMeta(startsAt: string) {
  return `${formatInOrgZone(startsAt, { weekday: 'short' })} · ${formatInOrgZone(startsAt, { hour: 'numeric', minute: '2-digit' })}`;
}

export default function CoachesPracticePlansPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(paramsPromise);
  const { loading: ctxLoading } = useCoaches();
  const { openHelp } = useHelpDrawer();
  const page = useCoachSeasonPage(orgSlug, teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  // Clock snapshot, once per mount — the render body must stay pure (same rule as Lineups).
  const [nowMs] = useState(() => Date.now());

  const [upcoming, setUpcoming] = useState<RepTeamEvent[]>([]);
  const [recent, setRecent] = useState<RepTeamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsOnly, setNeedsOnly] = useState(false);

  const caps = page.capabilities;
  // Fail-open while capabilities load — every practice route enforces server-side regardless.
  const canSeeSchedule = caps ? caps.schedule : true;
  // Writing a plan is head-coach-only (the same gate the practice-plan PUT enforces), and a past
  // season can never be written to.
  const canPlan = page.canWrite(caps ? canWriteDevelopment(caps) : false);
  // The templates door gates on what the templates route itself requires, so this page never
  // offers a link that 403s on arrival.
  const canSeeTemplates = caps ? canManageSchedule(caps) : false;
  // Adding a practice is a SCHEDULE-MANAGE act, not a plan one — a coach who can write plans but
  // not schedule must not be handed an "Add a practice" button they cannot use. Fails closed.
  const canAddPractices = page.canWrite(caps ? canManageSchedule(caps) : false);

  const helpRequest = {
    module: 'coaches' as const,
    sectionIds: ['premium-practice-plans'],
    label: 'Practice plans',
    fullGuideHref: `/${orgSlug}/coaches/help#premium-practice-plans`,
  };

  /**
   * ⚠ Every state write is behind `isStale()`. This page does NOT unmount when only the team
   * segment changes — App Router re-renders the same leaf in place — so a slow response for the
   * team the coach has just left would otherwise land on the one they are now looking at: the
   * header would name team B while the list, and the plan summaries in it, came from team A. The
   * same guard, for the same reason, is on the Attendance page. (It also covered a `?year=` change
   * until that control was deleted on 2026-08-16.)
   */
  const load = useCallback(async (isStale: () => boolean = () => false) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events`);
      if (!res.ok) throw new Error('Practices could not be loaded');
      const data: { events?: RepTeamEvent[] } = await res.json();
      const practices = (data.events ?? []).filter(e => e.eventType === 'practice');
      // Split here rather than during render, so Date.now() never runs in a render body. Shared
      // with the Lineups hub, so the recent cap and the "upcoming" rule have one definition.
      const split = splitUpcomingAndRecent(practices, { now: Date.now() });
      if (isStale()) return;
      setUpcoming(split.upcoming);
      setRecent(split.recent);
    } catch (e) {
      // A stale FAILURE matters as much as a stale success: without this, a dead request for the
      // previous team replaces the list the coach is reading with "couldn't be loaded".
      if (!isStale()) setError(e instanceof Error ? e.message : 'Practices could not be loaded');
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, [orgSlug, teamId]);

  // Wait for the assignments context before fetching, so the fail-open default above can't fire a
  // request for a coach whose schedule access has been revoked. `hasAccess` is in the guard too —
  // a coach who is not on this team renders "Team not found" below, and firing a request that can
  // only 403 is work nobody ever sees the result of.
  useEffect(() => {
    if (ctxLoading || !page.hasAccess || !canSeeSchedule || page.isReadOnly) return;
    let cancelled = false;
    void Promise.resolve().then(() => load(() => cancelled));
    return () => { cancelled = true; };
  }, [ctxLoading, page.hasAccess, canSeeSchedule, page.isReadOnly, load]);

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  if (!page.hasAccess) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  const header = (
    <CoachPageHeader
      icon={NotebookPen}
      title="Practice plans"
      helpLabel="Practice plans"
      help={helpRequest}
    />
  );

  if (!canSeeSchedule) {
    return (
      <div className={styles.page}>
        {header}
        {/* No action available here → the quiet variant, but it still teaches what a plan does so
            a coach knows what they'd be asking for rather than just being told "no". */}
        <CoachEmptyState
          quiet
          icon={<NotebookPen size={20} aria-hidden />}
          headline="Practice plans aren't turned on for you"
          description="A practice plan sets out the blocks, stations and groups for one practice, so everyone running it knows what happens next."
          payoff="Whoever builds them here can run the practice from their phone, and the plan is there again next week to change rather than rewrite."
          blocker="Ask your head coach to turn on schedule access for you."
        />
      </div>
    );
  }

  // ⚠ Not redundant with the nav being live-season-only: the season switcher rewrites THIS path
  // with a ?year=, so a coach can land here in an archive without ever seeing a nav entry for it.
  if (page.isReadOnly) {
    return (
      <div className={styles.page}>
        {header}
        <CoachEmptyState
          quiet
          icon={<NotebookPen size={20} aria-hidden />}
          headline="Practice plans are a live-season tool"
          description="A finished season keeps its schedule, attendance and records — but not the plans, which only ever described what was about to happen."
          payoff="Switch back to your current season to plan a practice."
        />
      </div>
    );
  }

  const all = [...upcoming, ...recent];
  /**
   * ⚠ "Has a plan" means it has at least one BLOCK, not that a plan row exists. The builder
   * autosaves about a second after the last keystroke, and a plan counts as savable once a goal,
   * an equipment note or a practice type is set — so a coach who types "work on cut-offs" and then
   * gets called away leaves a real, blockless plan behind. Keying off the row's existence made
   * this page say "Plan set · 0 blocks" and drop that practice out of the very filter that exists
   * to catch it. The page's whole job is "what still needs doing", and a goal on its own does not
   * tell anybody what happens at 6pm. What they typed is still there when they open it.
   */
  const hasPlan = (e: RepTeamEvent) => (e.practicePlan?.blocks.length ?? 0) > 0;
  // needsTotal decides whether the filter exists at all; the chip shows the same count.
  const needsTotal = all.filter(e => !hasPlan(e)).length;
  const shown = (list: RepTeamEvent[]) => (needsOnly ? list.filter(e => !hasPlan(e)) : list);
  const upcomingShown = shown(upcoming);
  const recentShown = shown(recent);
  // The page's ONE lime action: the nearest visible upcoming practice with no plan. No qualifying
  // practice → no lime on this page. Lime is earned, never decorative.
  const primaryId = canPlan ? upcomingShown.find(e => !hasPlan(e))?.id ?? null : null;

  const noPractices = !loading && !error && all.length === 0;
  const noMatches = !loading && !error && !noPractices && upcomingShown.length === 0 && recentShown.length === 0;

  const renderRow = (e: RepTeamEvent) => {
    const planned = hasPlan(e);
    const startMs = new Date(e.startsAt).getTime();
    // "Run practice" is offered only around the practice itself, and only once there is a plan to
    // run — the Schedule panel offers the same door off the same condition.
    const inRunWindow = planned && Math.abs(startMs - nowMs) <= RUN_WINDOW_MS;
    const row = (
      <CoachEventListRow
        key={e.id}
        href={`${base}/practice/${e.id}`}
        startsAt={e.startsAt}
        title={e.name || 'Practice'}
        // A planned practice says what the plan IS; an unplanned one has only its time to give.
        meta={planned && e.practicePlan
          ? `${rowMeta(e.startsAt)} · ${summarizePracticePlan(e.practicePlan)}`
          : rowMeta(e.startsAt)}
        chip={planned
          ? { tone: 'ok', label: 'Plan set', icon: <CheckCircle2 size={13} aria-hidden /> }
          : { tone: 'warn', label: 'No plan', icon: <TriangleAlert size={13} aria-hidden /> }}
        action={planned ? 'Open the plan' : canPlan ? 'Plan this practice' : 'Open'}
        primaryLabel={e.id === primaryId ? 'Plan this practice' : null}
      />
    );
    if (!inRunWindow) return row;
    return (
      <div key={e.id} className={styles.eventChipRow}>
        {row}
        <Link href={`${base}/practice/${e.id}/run`} className={styles.gdEntryBtn}>Run practice</Link>
      </div>
    );
  };

  return (
    <div className={styles.page}>
      {header}

      {loading ? (
        <div className={styles.loadingState}>Loading practices…</div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : noPractices ? (
        <CoachEmptyState
          icon={<CalendarPlus size={22} aria-hidden />}
          eyebrow="Practice plans"
          headline="Plan a practice once, run it from your phone"
          description="A practice plan sets out the blocks, stations and groups for one session — how long each part runs, who's in which group, and what you're teaching."
          payoff="Save one as a template and next week starts from it instead of a blank page, and anyone helping you run the practice can follow the same plan on their own phone."
          blocker={canAddPractices
            ? 'A plan attaches to a real practice, so put one on your schedule first.'
            : 'A plan attaches to a real practice, and none are on the schedule yet. Adding them needs schedule access — ask your head coach.'}
          primaryAction={canAddPractices
            ? { label: 'Add a practice', icon: <CalendarPlus size={15} aria-hidden />, href: `${base}/schedule` }
            : undefined}
          secondaryAction={{ label: 'How practice plans work', icon: <HelpCircle size={15} aria-hidden />, onClick: () => openHelp(helpRequest) }}
        />
      ) : (
        <>
          {/* Stays mounted while toggled on even at zero — otherwise planning the last practice
              would unmount the only control that can turn the filter back off. */}
          {(needsTotal > 0 || needsOnly) && (
            <div className={styles.lineupFilterBar} role="group" aria-label="Filter practices">
              <button
                type="button"
                aria-pressed={needsOnly}
                className={`${styles.lineupFilterChip} ${styles.lineupFilterNeeds} ${needsOnly ? styles.lineupFilterNeedsActive : ''}`}
                onClick={() => setNeedsOnly(v => !v)}
              >
                <TriangleAlert size={12} aria-hidden /> Needs a plan <b className={styles.lineupFilterCount}>{needsTotal}</b>
              </button>
            </div>
          )}

          {upcomingShown.length > 0 && (
            <section aria-labelledby="practices-upcoming">
              <p className={styles.sectionKicker} id="practices-upcoming">Coming up</p>
              <div className={styles.lineupFrontList}>{upcomingShown.map(renderRow)}</div>
            </section>
          )}
          {recentShown.length > 0 && (
            <section aria-labelledby="practices-recent">
              <p className={styles.sectionKicker} id="practices-recent">Recent practices</p>
              <div className={styles.lineupFrontList}>{recentShown.map(renderRow)}</div>
            </section>
          )}
          {noMatches && (
            <p className={styles.lineupFilterNoMatch}>All caught up — every practice here has a plan.</p>
          )}

          {/* The team's reusable plans have ONE home (Development → Plan templates), which already
              does rename / retire / import. This is a door to it, never a second copy of it — two
              lists of the same library would eventually disagree about what a template is. */}
          {canSeeTemplates && (
            <p className={styles.lineupInsightsLink}>
              <Link href={`${base}/development/templates`}>
                <BookMarked size={13} aria-hidden /> Plan templates <ArrowRight size={13} aria-hidden />
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}
