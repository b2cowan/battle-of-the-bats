'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  NotebookPen, CalendarPlus, CheckCircle2, TriangleAlert, ArrowRight, HelpCircle, Play,
} from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachEventListRow from '@/components/coaches/CoachEventListRow';
import { CoachRowList, CoachRowBand, CoachRowListFoot } from '@/components/coaches/CoachRowList';
import CoachOneThingCard from '@/components/coaches/CoachOneThingCard';
import { useHelpDrawer } from '@/components/help/help-drawer-context';
import { canManageSchedule, canWritePracticePlans } from '@/lib/coach-capabilities';
import { splitUpcomingAndRecent } from '@/lib/coach-tournament-games';
import { parsePracticePlansSection } from '@/lib/practice-plans-address';
import {
  practiceHasPlan, practicePlanState, practiceFitLabel, practiceRecapLine,
  practiceLengthMinutes,
} from '@/lib/practice-state';
import { calendarDaysBetween, formatInOrgZone, relativeDayLabel } from '@/lib/timezone';
import { useMinuteClock } from '@/lib/use-minute-clock';
import PracticePlansTabs from './_PracticePlansTabs';
import DrillsView from './_DrillsView';
import PlanTemplatesView from './_PlanTemplatesView';
import CircuitsView from './_CircuitsView';
import styles from '../../../coaches.module.css';
import type { RepTeamEvent } from '@/lib/types';

/**
 * ── The Practice plans room (hub 2026-08-15; re-evaluation stage 0 · Arrive, 2026-09-14) ─────────
 *
 * Practice plans had NO front door: the only way to one was the Schedule, tapping the right
 * practice, and scrolling its panel — three interactions deep, and only if the coach already knew
 * which day the practice was on. Meanwhile Lineups, made maybe twenty times a season against a
 * plan's two-to-three times that, had a nav item, a hub, a readiness filter and a templates page.
 * This is that treatment applied to the more frequent tool.
 *
 * **Stage 0 · Arrive (owner rulings D1–D8, all "build as drawn", 2026-09-14).** The room is the
 * HUB for four things — the season's practices, plan templates, circuits (stage 4, L9) and the
 * drill library — as tabs (Practices · Templates · Circuits · Drills; Practices the landing;
 * `?section=`), and it opens on the NEXT
 * PRACTICE as one card carrying the room's one lime by state: Plan this practice · Open the plan ·
 * Run practice (inside the run window). "Needs a plan" counts upcoming practices only (it used to
 * count May in September). Below the line the past reads as a record — "No plan written · Open",
 * never "Plan this practice", the recap's first line on a written-up row — and a planned row says
 * how the plan FITS the practice ("3 blocks · 60 of 90 min"). No overview tab, no tiles: the card
 * and the chip are the room's whole state. The two library pages moved here WHOLE from Skills &
 * Goals (`_PlanTemplatesView`, `_DrillsView`); their old addresses redirect.
 *
 * ⚠ NO new API. `RepTeamEvent.practicePlan`, `practiceRecap` and `endsAt` all ride the events
 * read, so the card, the fit line and the recap line are computed from the list this page already
 * has to fetch. Do not add a per-practice probe here — the whole point is that the answer is free.
 *
 * ⚠ ONE definition of "has a plan" (at least one BLOCK) and ONE run window, both in
 * `lib/practice-state.ts` — shared with the Overview's card, so the two screens can never
 * disagree about what a practice needs next.
 *
 * ⚠ **PLANNING IS A LIVE-SEASON ACT; THE PLANS THEMSELVES ARE A RECORD, AND THIS PAGE USED TO DENY
 * THAT** (P3 C1, 2026-08-16). This hub is the live planner and stays one. A team with no live
 * season lands on its closed-season page, where "The practices you ran" is a shelf, so this page
 * has nothing to say about a finished season and does not render for one. No page here learns a
 * year.
 *
 * ⚠ It is deliberately NOT `CoachNotOnTeam`. That component's words are right for a live instrument
 * with nothing to show; this screen genuinely HAS something to show and must hand over the door to
 * it. Its sibling `practice/[eventId]` keeps `CoachNotOnTeam` — one past practice reached by URL is
 * the instrument case.
 */

/** Weekday + time only — the date tile beside this line already carries the day and month. */
function rowMeta(startsAt: string) {
  return `${formatInOrgZone(startsAt, { weekday: 'short' })} · ${clock(startsAt)}`;
}
const clock = (iso: string) => formatInOrgZone(iso, { hour: 'numeric', minute: '2-digit' });
/** The past list's cap by design — six — behind which "Every practice this season ›" waits (L8). */
const RECENT_CAP = 6;

export default function CoachesPracticePlansPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(paramsPromise);
  const searchParams = useSearchParams();
  const section = parsePracticePlansSection(searchParams.get('section'));
  const { loading: ctxLoading } = useCoaches();
  const { openHelp } = useHelpDrawer();
  const page = useCoachSeasonPage(orgSlug, teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  // The card's lime is decided by the run window, so the clock is re-read once a minute — a tab
  // left open through an afternoon must not keep offering "Run practice" for a practice that
  // ended, or miss it for one that started (/review, 2026-09-14).
  const nowMs = useMinuteClock();

  const [upcoming, setUpcoming] = useState<RepTeamEvent[]>([]);
  const [recent, setRecent] = useState<RepTeamEvent[]>([]);
  /**
   * "Every practice this season ›" (stage 4, owner ruling L8, 2026-09-16): the past list is the six
   * most recent by design, and the one thing it lacked against Insights' Practice review was the
   * cap. One quiet door under Recent practices opens the rest IN PLACE — words, never a count, and
   * absent at six or fewer. No tag chips here and no truth label: those are Insights' reasons to
   * exist beside Coverage, and a second list of practices is what the plan forbids.
   */
  // Keyed by TEAM, not a bare boolean: this page does not unmount on a team switch (see `load`),
  // and a door opened on team A must not leave team B's list uncapped with no door to close it.
  const [showAllFor, setShowAllFor] = useState<string | null>(null);
  const showAllRecent = showAllFor === teamId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsOnly, setNeedsOnly] = useState(false);

  const caps = page.capabilities;
  // Fail-open while capabilities load — every practice route enforces server-side regardless.
  const canSeeSchedule = caps ? caps.schedule : true;
  // Writing a plan follows "Schedule: View + edit" (R7 — the same gate the practice-plan PUT
  // enforces), and a past season can never be written to.
  const canPlan = (caps ? canWritePracticePlans(caps) : false);
  // The two library tabs gate on what their reads require (`canManageSchedule`), so this page never
  // offers a tab that 403s on arrival — the tab is ABSENT for a viewer the page would refuse.
  const canSeeLibrary = caps ? canManageSchedule(caps) : false;
  // Adding a practice is a SCHEDULE-MANAGE act, not a plan one — a coach who can write plans but
  // not schedule must not be handed an "Add a practice" button they cannot use. Fails closed.
  const canAddPractices = (caps ? canManageSchedule(caps) : false);
  // A section this coach may not open lands on Practices — the landing, never a refusal screen.
  const activeSection = canSeeLibrary ? section : 'practices';

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
      // Uncapped here (L8): the page shows six and offers the rest behind one door.
      const split = splitUpcomingAndRecent(practices, { now: Date.now(), recentCap: Infinity });
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
  // only 403 is work nobody ever sees the result of. ONCE per team, whichever tab the coach lands
  // on (the Skills & Goals hub's idiom): gating it on the Practices tab re-fetched the list — and
  // flashed "Loading…" — every time the coach came back from a library tab (/simplify, 2026-09-14).
  useEffect(() => {
    if (ctxLoading || !page.hasAccess || !canSeeSchedule) return;
    let cancelled = false;
    void Promise.resolve().then(() => load(() => cancelled));
    return () => { cancelled = true; };
  }, [ctxLoading, page.hasAccess, canSeeSchedule, load]);

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

  // The two libraries — today's pages moved whole (D5). Each draws the room's header with its own
  // action and help, and the tab bar under it.
  if (activeSection === 'drills') return <DrillsView orgSlug={orgSlug} teamId={teamId} />;
  if (activeSection === 'templates') return <PlanTemplatesView orgSlug={orgSlug} teamId={teamId} />;
  if (activeSection === 'circuits') return <CircuitsView orgSlug={orgSlug} teamId={teamId} />;

  /**
   * ⚠ **THE BETWEEN-SEASONS SCREEN THAT STOOD HERE IS DELETED** (2026-08-18). It explained that the
   * season had finished, that plans are still kept, and pointed at where to read them — a whole
   * screen whose only job was to describe a state nobody chose. A team with no live season now
   * lands on its closed-season page, where "The practices you ran" is a shelf, so this page has
   * nothing left to say about a finished season and does not render for one.
   */

  const all = [...upcoming, ...recent];
  /**
   * THE CARD's practice (D1): tonight's, if a planned practice is inside the run window — even one
   * that started twenty minutes ago and so sits in `recent` — otherwise the nearest upcoming one.
   * The card is that row promoted; it is left out of the lists below so nothing appears twice.
   */
  const cardEvent = all.find(e => practicePlanState(e, nowMs) === 'run') ?? upcoming[0] ?? null;
  // needsTotal decides whether the filter exists at all; the chip shows the same count. UPCOMING
  // only (D2): a coach in September was told three practices needed a plan, all in May.
  const needsTotal = upcoming.filter(e => !practiceHasPlan(e)).length;
  // The card's practice never repeats in a list. The filter is the COUNT's filter — upcoming only:
  // with it on, the past half goes (a past practice with no plan is a record, not work), so the
  // rows shown plus the card, if it needs one, are exactly the number on the chip.
  const notCard = (list: RepTeamEvent[]) => list.filter(e => e.id !== cardEvent?.id);
  const upcomingShown = notCard(needsOnly ? upcoming.filter(e => !practiceHasPlan(e)) : upcoming);
  const recentAll = needsOnly ? [] : notCard(recent);
  const recentShown = showAllRecent ? recentAll : recentAll.slice(0, RECENT_CAP);
  const moreRecent = recentAll.length > RECENT_CAP && !showAllRecent;

  const noPractices = !loading && !error && all.length === 0;
  // "All caught up" only when the filter finds nothing AND the card is not itself the match.
  const cardNeedsPlan = !!cardEvent && !practiceHasPlan(cardEvent);
  const noMatches = !loading && !error && !noPractices && needsOnly
    && upcomingShown.length === 0 && !cardNeedsPlan;

  const renderRow = (e: RepTeamEvent, past: boolean) => {
    const planned = practiceHasPlan(e);
    // "Run practice" is offered on EVERY planned practice, past or future (owner, 2026-09-17, on
    // the P10 no-clock ruling: with no timer there is nothing for a window to protect — the field
    // is a reader, and a coach may walk a plan before, during or after it). The Schedule's
    // slide-over and the plan page's toolbar offer the same door off the same condition: a plan
    // with at least one block. Only the WEIGHT reads the day — the card's lime, below.
    // Two halves, two vocabularies (D3): above the line the room is a planner, below it a record.
    // "Open" is the record's door — a past practice, or a coach who cannot write plans — and it is
    // the quiet one; the working doors keep their weight.
    const action = planned ? 'Open the plan' : (!past && canPlan) ? 'Plan this practice' : 'Open';
    return (
      <CoachEventListRow
        key={e.id}
        href={`${base}/practice/${e.id}`}
        startsAt={e.startsAt}
        title={e.name || 'Practice'}
        // A planned practice says how its plan FITS (D4); an unplanned one has only its time to give.
        meta={planned && e.practicePlan
          ? `${rowMeta(e.startsAt)} · ${practiceFitLabel(e.practicePlan, e.startsAt, e.endsAt)}`
          : rowMeta(e.startsAt)}
        chip={planned
          ? { tone: 'ok', label: 'Plan set', icon: <CheckCircle2 size={13} aria-hidden /> }
          : past
            ? { tone: 'mute', label: 'No plan written' }
            : { tone: 'warn', label: 'No plan', icon: <TriangleAlert size={13} aria-hidden /> }}
        action={action}
        quietAction={action === 'Open'}
        note={past ? practiceRecapLine(e.practiceRecap) : null}
        // The room's one lime lives on the card now (D1) — no row carries it.
        primaryLabel={null}
        // Beside the row, never inside it — the row stays one control (§3.6).
        beside={planned ? <Link href={`${base}/practice/${e.id}/run`} className={styles.gdEntryBtn}>Run practice</Link> : undefined}
      />
    );
  };

  /** The next-practice card (D1) — the Overview's "one thing" card, on the hub. */
  const renderCard = (e: RepTeamEvent) => {
    const state = practicePlanState(e, nowMs);
    const days = Math.max(0, calendarDaysBetween(new Date(nowMs), new Date(e.startsAt)));
    const when = relativeDayLabel(days);
    const headline = days === 0
      ? `Today · ${clock(e.startsAt)}`
      : `${formatInOrgZone(e.startsAt, { weekday: 'short', month: 'short', day: 'numeric' })} · ${clock(e.startsAt)}`;
    const length = practiceLengthMinutes(e.startsAt, e.endsAt);
    const meta = [
      e.name || 'Practice',
      e.location,
      e.endsAt && length ? `${clock(e.startsAt)}–${clock(e.endsAt)}` : null,
      length ? `${length} min` : null,
    ].filter(Boolean).join(' · ');
    const planHref = `${base}/practice/${e.id}`;
    const runHref = `${planHref}/run`;
    // The state decides the WEIGHT, never whether the door exists. No plan → Plan this practice
    // (for a coach who may); plan set → Open the plan, with Run practice as the quiet link; on the
    // day → Run practice, with the plan as the quiet link. The field door is on every planned
    // practice on any day (P10 revised, 2026-09-17); the day decides only which of the two is the
    // one thing. A coach who cannot write plans is never shown a lime they cannot earn: an
    // unplanned practice offers "Open" quietly, read-only.
    const primary = state === 'run'
      ? { href: runHref, label: 'Run practice', icon: <Play size={15} aria-hidden /> }
      : state === 'planned'
        ? { href: planHref, label: 'Open the plan', icon: null }
        : canPlan
          ? { href: planHref, label: 'Plan this practice', icon: null }
          : null;
    const answers = state === 'run'
      ? [{ href: planHref, label: 'Open the plan' }]
      : state === 'planned'
        ? [{ href: runHref, label: 'Run practice' }]
        : primary ? [] : [{ href: planHref, label: 'Open' }];
    // The state chip rides the answers slot: the meta row's right side, beside the quiet links.
    const chip = state === 'none' ? (
      <span className={styles.lineupFrontChip} data-tone="warn">
        <TriangleAlert size={13} aria-hidden /> No plan yet
      </span>
    ) : (
      <span className={styles.lineupFrontChip} data-tone="ok">
        <CheckCircle2 size={13} aria-hidden /> Plan set{e.practicePlan ? ` · ${practiceFitLabel(e.practicePlan, e.startsAt, e.endsAt)}` : ''}
      </span>
    );
    return (
      <CoachOneThingCard
        kind="next_practice"
        kicker="Next practice"
        when={when}
        headline={headline}
        primary={primary && (
          <Link href={primary.href} className={`btn btn-lime ${styles.onePrimary}`}>
            {primary.icon}{primary.label} <ArrowRight size={15} aria-hidden />
          </Link>
        )}
        meta={meta}
        answers={(
          <>
            {chip}
            {answers.map(a => (
              <Link key={a.label} href={a.href} className={styles.oneAnswer}>
                {a.label} <ArrowRight size={13} aria-hidden />
              </Link>
            ))}
          </>
        )}
      />
    );
  };

  return (
    <div className={styles.page}>
      {header}
      <PracticePlansTabs base={base} active="practices" showLibrary={canSeeLibrary} />

      {loading ? (
        <div className={styles.loadingState}>Loading practices…</div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : noPractices ? (
        /* D6: headline · one sentence · the arc · one lime. The button opens the Schedule with the
           Add Practice form already open — not the list two clicks short of it. */
        <CoachEmptyState
          icon={<CalendarPlus size={22} aria-hidden />}
          eyebrow="Practice plans"
          headline="Plan a practice once, run it from your phone"
          description="A plan sets out the blocks, stations and groups for one practice — and it lives on the practice, so put one on your schedule first."
          arc={(
            <span aria-label="How practice plans work: schedule it, plan it, print it or run it, write how it went">
              {['Schedule it', 'Plan it', 'Print it or run it', 'Write how it went'].map((w, i) => (
                <span key={w}>{i > 0 && <span aria-hidden>{' → '}</span>}{i === 0 ? <b>{w}</b> : w}</span>
              ))}
            </span>
          )}
          blocker={canAddPractices ? undefined : 'Adding a practice needs schedule access — ask your head coach.'}
          primaryAction={canAddPractices
            ? { label: 'Add a practice', icon: <CalendarPlus size={15} aria-hidden />, href: `${base}/schedule?add=practice` }
            : undefined}
          secondaryAction={{ label: 'How practice plans work', icon: <HelpCircle size={15} aria-hidden />, onClick: () => openHelp(helpRequest) }}
        />
      ) : (
        <>
          {cardEvent && renderCard(cardEvent)}

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

          {/* ONE frame for both halves of the list (standard §3.10, F-27 — owner-ruled 2026-09-16):
              "Coming up" and "Recent practices" are BAND ROWS inside it, not kickers on the paper
              over two stacks of cards. The two vocabularies (D3) are untouched — the planner's
              doors above the band, the record's "Open" below it. */}
          {(upcomingShown.length > 0 || recentShown.length > 0) && (
            <CoachRowList label="Practices" className={styles.hubRowList}>
              {upcomingShown.length > 0 && (
                <>
                  <CoachRowBand id="practices-upcoming">Coming up</CoachRowBand>
                  {upcomingShown.map(e => renderRow(e, false))}
                </>
              )}
              {recentShown.length > 0 && (
                <>
                  <CoachRowBand id="practices-recent">Recent practices</CoachRowBand>
                  {recentShown.map(e => renderRow(e, true))}
                </>
              )}
            </CoachRowList>
          )}
          {/* The one quiet door (L8) — words, never "All 23"; gone once opened, and absent at
              six or fewer. Practice review under Insights → Development is unchanged. It sits
              UNDER the frame, in the notes stack (§3.5), never inside it. */}
          {moreRecent && (
            <CoachRowListFoot>
              <button type="button" className={styles.ppTlQuietLink} onClick={() => setShowAllFor(teamId)}>
                Every practice this season ›
              </button>
            </CoachRowListFoot>
          )}
          {noMatches && (
            <p className={styles.lineupFilterNoMatch}>All caught up — every practice here has a plan.</p>
          )}
        </>
      )}
    </div>
  );
}
