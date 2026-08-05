import type { DemoOrgKind } from './demo-org';
import {
  DEMO_TOURNAMENT_SLUG, DEMO_OPENER_SLUG, DEMO_INVITATIONAL_SLUG, DEMO_COACH_TEAM_IDS,
} from './demo-org';
import { SEE_IT_LIVE_PATH } from './sandbox-door';

// The dock ↔ tournament-provider contract constants live in `lib/demo-org.ts` (the neutral module
// both sides already import — the shared provider must never depend on THIS file). Re-exported
// here so chrome-side consumers keep one import.
export {
  SANDBOX_TOURNAMENT_DATASET_KEY,
  SANDBOX_TOURNAMENT_CHANGED_EVENT,
  SANDBOX_SELECT_TOURNAMENT_EVENT,
} from './demo-org';

/**
 * lib/sandbox-chrome.ts — what the sandbox hat SAYS, for any demo org.
 *
 * The chrome (banner + tour chips + reset countdown) is written once against "is this org a demo
 * org?" and never against "is this a tournament?". That is the whole reason the coach sandbox is a
 * chip list and a seed rather than a second build — so everything sandbox-specific and everything
 * tournament-specific meets HERE, in one small pure module, instead of leaking into components.
 *
 * Copy note: the wording below is the mockups' working draft. The shapes and placements are what
 * was approved; final wording goes through `/marketing` before the door opens publicly.
 */

/** Which half of the product the visitor is standing in. Decided from the URL, client-side. */
export type SandboxSide = 'public' | 'operator';

// ── The moments dock (Phase 2, ratified 2026-08-04) ─────────────────────────────────────────
//
// The sandbox's ONE org runs three events in three lifecycle states, and the dock is plain
// navigation between them.

/** The moment keys, per sandbox, in the order each year happens. The type derives from this
 *  array so a new moment cannot be added to one without the other (the chrome's storage
 *  shape-check reads the array; the definitions below carry the type). */
export const SANDBOX_MOMENT_KEYS = [
  // The tournament's year (Phase 2, ratified 2026-08-04)
  'registration-week', 'game-day', 'morning-after',
  // The coach's season (COACH_SANDBOX_SEASON_PHASES_PLAN.md Phase 1 — the phase dock)
  'tryout-day', 'mid-season', 'seasons-end',
] as const;
export type SandboxMomentKey = (typeof SANDBOX_MOMENT_KEYS)[number];

export interface SandboxMoment {
  key: SandboxMomentKey;
  /** The tab's name — a moment in the year, never a feature. */
  label: string;
  /** The time anchor under the label: where in the year this moment sits. */
  sub: string;
  /** This moment's event (tournament sandbox). The dock highlights the moment being edited. */
  tournamentSlug?: string;
  /** This moment's team (coach sandbox). The dock highlights the team the URL is standing in. */
  teamId?: string;
  /** Where a fan-side press lands: the event's public home. */
  fanPath: string;
  /** Where an operator-side press lands: the moment's flagship admin screen (or the door). */
  operatorPath: string;
  /** Only Game day carries the live dot — it is the only moment that moves. */
  isLive?: boolean;
  /** What the narration strip says on arrival, per side. Time named first, always. */
  saidPublic: string;
  saidOperator: string;
  /**
   * What the banner's countdown slot shows while standing in this moment. Null = Game day's
   * own replay countdown. A stranger at a finished event must never read "Replays in 38:12" —
   * that countdown belongs to the Summer Classic's loop and would be a lie anywhere else.
   */
  bannerNote: string | null;
}

/** The moments of the demo's year, in the order the year happens. */
export function sandboxMoments(
  kind: DemoOrgKind,
  org: { slug: string; landingPath: string },
  access: SandboxTourAccess = { isDemoOrganizer: true },
): SandboxMoment[] {
  if (kind === 'coach') return coachSandboxMoments(org);
  if (kind !== 'tournament') return [];
  const adminBase = `/${org.slug}/admin/tournaments`;
  const operatorPath = (path: string) => (access.isDemoOrganizer ? path : SEE_IT_LIVE_PATH);
  return [
    {
      key: 'registration-week',
      label: 'Registration week',
      sub: '3 weeks before',
      tournamentSlug: DEMO_INVITATIONAL_SLUG,
      fanPath: `/${org.slug}/${DEMO_INVITATIONAL_SLUG}`,
      operatorPath: operatorPath(`${adminBase}/registrations`),
      saidPublic: 'You’ve jumped three weeks back. Registration is open — eleven teams are in, U11 is already full, and this page is what families are watching fill up.',
      saidOperator: 'You’ve jumped three weeks back. Fifteen teams are in the pipeline, U11 is full with a waitlist, and this screen is where that week gets managed.',
      bannerNote: 'First pitch in 3 weeks',
    },
    {
      key: 'game-day',
      label: 'Game day',
      sub: 'happening now',
      tournamentSlug: DEMO_TOURNAMENT_SLUG,
      fanPath: org.landingPath,
      operatorPath: operatorPath(`${adminBase}/dashboard`),
      isLive: true,
      saidPublic: 'Back to game day — the Summer Classic is live right now.',
      saidOperator: 'Back to game day — the Summer Classic is live right now, and this dashboard is running it.',
      bannerNote: null,
    },
    {
      key: 'morning-after',
      label: 'The morning after',
      sub: 'ended yesterday',
      tournamentSlug: DEMO_OPENER_SLUG,
      fanPath: `/${org.slug}/${DEMO_OPENER_SLUG}`,
      operatorPath: operatorPath(`${adminBase}/summary`),
      saidPublic: 'This one wrapped yesterday. The champion is crowned and the final record is preserved — nobody had to type it up.',
      saidOperator: 'The day after it all ended: every score in, the champion crowned, and the summary already written. Next year starts from one button.',
      bannerNote: 'Wrapped up yesterday',
    },
  ];
}

/**
 * The phase dock (coach sandbox): one club, three teams, each frozen at a different moment of a
 * season. Every press is plain navigation to that team's showcase screen — the coach portal has
 * no public/operator split (it all sits behind the demo session), so both paths agree.
 *
 * ⚠ No moment carries the live dot, deliberately, including Tryout day. The dot is a claim that
 * the screen moves WHILE YOU WATCH, and the tryout's scores re-anchor nightly, not live — the
 * tournament sandbox's hardest-won lesson is that the chrome never promises motion the clock
 * won't deliver ("they don't seem to do anything", owner QA, three times). The approved mockup
 * drew a pulse here; dropping it is an honesty deviation to flag at owner review, not a whim.
 */
function coachSandboxMoments(org: { slug: string; landingPath: string }): SandboxMoment[] {
  const teamPath = (teamId: string, rest = '') => `/${org.slug}/coaches/teams/${teamId}${rest}`;
  const moment = (m: Omit<SandboxMoment, 'fanPath' | 'operatorPath'> & { path: string }): SandboxMoment => {
    const { path, ...fields } = m;
    return { ...fields, fanPath: path, operatorPath: path };
  };
  return [
    moment({
      key: 'tryout-day',
      label: 'Tryout day',
      sub: 'today, mid-scoring',
      teamId: DEMO_COACH_TEAM_IDS.tryoutDay,
      path: teamPath(DEMO_COACH_TEAM_IDS.tryoutDay, '/tryouts/score'),
      saidPublic: 'Tryout day, mid-flight: 28 kids in bibs, two evaluators partway through their scoring, and one split opinion to argue about tonight. Blind scoring is on — the board shows bibs, never names.',
      saidOperator: 'Tryout day, mid-flight: 28 kids in bibs, two evaluators partway through their scoring, and one split opinion to argue about tonight. Blind scoring is on — the board shows bibs, never names.',
      bannerNote: 'Evaluations are mid-flight',
    }),
    moment({
      key: 'mid-season',
      label: 'Mid-season',
      sub: 'game this Saturday',
      teamId: DEMO_COACH_TEAM_IDS.midSeason,
      // Built from the team id like its siblings (this IS the door's landing path — the door's
      // constant and this one agree by both deriving from DEMO_COACH_TEAM_IDS).
      path: teamPath(DEMO_COACH_TEAM_IDS.midSeason),
      saidPublic: 'The heart of the year: 14-3-1, three events this week, and the Overview holding the one thing that needs doing — Saturday\'s lineup isn\'t set.',
      saidOperator: 'The heart of the year: 14-3-1, three events this week, and the Overview holding the one thing that needs doing — Saturday\'s lineup isn\'t set.',
      bannerNote: 'There\'s a game this Saturday',
    }),
    moment({
      key: 'seasons-end',
      label: 'Season\'s End',
      sub: 'last season, closed',
      teamId: DEMO_COACH_TEAM_IDS.seasonsEnd,
      path: teamPath(DEMO_COACH_TEAM_IDS.seasonsEnd, '/season-end'),
      saidPublic: 'A finished year, kept: 18-6-2, the recap nine families opened, and every screen of the season still browsable — read-only, exactly as it ended.',
      saidOperator: 'A finished year, kept: 18-6-2, the recap nine families opened, and every screen of the season still browsable — read-only, exactly as it ended.',
      bannerNote: 'A finished year, kept',
    }),
  ];
}

/**
 * One beat of the guided tour.
 *
 * ⚠ The rule this shape exists to enforce, learned the expensive way: **a step's proof may never
 * be a panel the product is free to remove.** The first build anchored two steps to the fan page's
 * Live Now section and the dashboard's Now Playing strip, both of which vanish whenever no game is
 * live. With the anchor gone the step fell back to its `href` — which for those two steps was the
 * page the visitor was already standing on — so pressing it produced no scroll, no navigation and
 * no feedback whatsoever. Measured: scroll position unchanged, address unchanged. That is what the
 * owner meant by *"they don't seem to do anything."*
 *
 * So `anchor` is now decoration and `said` is the deliverable. Every step, always, produces a
 * sentence in the chrome saying what just happened. A step can therefore never be dead, because
 * the narration strip appearing IS a visible change, on the exact spot the visitor just pressed.
 */
export interface SandboxTourStep {
  /** 1-based position in the single tour that spans both halves of the product. */
  n: number;
  /** A verb the visitor performs, not a feature we have. */
  label: string;
  /** Where this beat lives. A step whose href is the current page simply narrates in place. */
  href: string;
  /**
   * Optional element to scroll to and ring once the visitor is on `href`. Purely supporting —
   * when it is absent the step still delivers, because `said` does the work.
   */
  anchor?: string;
  /** What the chrome says once the step has been delivered. Written for a stranger. */
  said: string;
  /**
   * Which of the org's tournaments this step's screen must be editing (operator steps only).
   * The admin half addresses screens by context, not URL, so "on the page" is only half of
   * "arrived" — a step that lands on the Teams screen of the WRONG event has not delivered.
   * The chrome pins navigation with `?tournamentSlug=` and checks the provider's stamp.
   */
  tournamentSlug?: string;
  /**
   * This step's payoff is the live score moving, which happens on the tournament's clock rather
   * than on the visitor's click. The chrome adds a live countdown to the next run underneath the
   * sentence, and announces the run when it lands.
   *
   * ⚠ Steps like this must never be LABELLED as though pressing them causes the change. The first
   * version was called "Watch the score change by itself" and the owner pressed it, watched a static
   * 3–8 for several minutes, and reported it as broken. The score had in fact moved — five minutes
   * later. The button was writing a cheque the tournament's clock cashes on its own schedule.
   */
  watchesLiveScore?: boolean;
  /** Label for the control that advances to the next step. */
  nextLabel?: string;
}

/** Who the visitor is, so the tour never points at a door their session cannot open. */
export interface SandboxTourAccess {
  /**
   * Is this visitor holding the demo organizer's session?
   *
   * False for an anonymous visitor who arrived by a shared link rather than through the door, and
   * for somebody signed in as themselves. Neither can open the operator side directly — the admin
   * shell would bounce them — so for them the step points at the DOOR instead, which knows how to
   * get each of them there (straight in for the anonymous visitor; via the confirm screen for the
   * signed-in one). The step is never removed and never walls: the tour would be lying either way.
   */
  isDemoOrganizer: boolean;
}

export interface SandboxBannerCopy {
  /** The plain-language promise. */
  lead: string;
  /** The half that must not be skimmed past — rendered bold. */
  emphasis?: string;
  /** The banner CTA's label — each sandbox asks for ITS OWN signup. */
  cta: string;
  /** The moments dock's visible label, and its accessible name. */
  dockLabel: string;
  dockAriaLabel: string;
  /** The blocked-save toast's sentence, after the bolded "Nothing is saved here." */
  toastText: string;
}

/**
 * The banner's promise, per side. The operator side says something stronger because it has to:
 * a visitor on the fan page is only reading, but a visitor in the admin portal is about to try
 * changing something, and the honest thing is to say what happens BEFORE they do.
 *
 * The coach sandbox has no public half — every page of it is the coach's seat — so it carries
 * the stronger promise everywhere, plus the one fact a stranger needs first: the team is made up.
 */
export function sandboxBannerCopy(side: SandboxSide, kind: DemoOrgKind = 'tournament'): SandboxBannerCopy {
  if (kind === 'coach') {
    return {
      lead: "You're in the coach's seat, on a fictional team.",
      emphasis: 'Changes show on screen, but nothing is saved.',
      cta: 'Start your own team — free',
      dockLabel: 'The season',
      dockAriaLabel: "Moments in the team's season",
      toastText: 'Starting your own team is free.',
    };
  }
  const tournament = {
    cta: 'Start your own — free',
    dockLabel: 'The year',
    dockAriaLabel: "Moments in the tournament's year",
    toastText: 'Starting your own tournament is free.',
  };
  if (side === 'operator') {
    return {
      lead: "You're in the organizer's seat.",
      emphasis: 'Changes show on screen, but nothing is saved.',
      ...tournament,
    };
  }
  return { lead: 'A real tournament, running right now. Nothing you do here is saved.', ...tournament };
}

/**
 * The tour: ONE four-step sequence spanning both halves of the product.
 *
 * The first build ran two unrelated three-chip tours, one per side, so a visitor who flipped to
 * the organizer's seat lost their place and started again — which made the flip read as a detour
 * rather than the climax it is. A single spine means the fourth step is reached having watched a
 * score arrive as a parent, and the sale is the continuity.
 *
 * The order is deliberate and is a story: it is running → it runs itself → this is your side of
 * it → and you can push it around.
 */
export function sandboxTourSteps(
  kind: DemoOrgKind,
  org: { slug: string; landingPath: string },
  access: SandboxTourAccess = { isDemoOrganizer: true },
): SandboxTourStep[] {
  if (kind !== 'tournament') {
    // The coach sandbox registers its own beats here when it builds
    // (COACH_SANDBOX_SEASON_PHASES_PLAN.md). An empty list renders no tour at all, which is the
    // correct "not built yet" state — the banner still carries the promise.
    return [];
  }

  const adminBase = `/${org.slug}/admin/tournaments`;
  // A visitor who arrived by a shared link rather than through the door holds no demo session, so
  // the admin shell would bounce them. Their operator steps point at the door instead, which
  // hands them the session and returns them here — at which point these same steps resolve to the
  // real screens. The step is never removed and never walls: the tour would be lying either way.
  const operatorHref = (path: string) => (access.isDemoOrganizer ? path : SEE_IT_LIVE_PATH);

  return [
    {
      n: 1,
      // Names what pressing it DOES, in the present tense, because that is what it can guarantee.
      // The score moving is the payoff, and the payoff is promised in the sentence below — with a
      // countdown to it — not in the button.
      label: 'Show me the game that is live',
      href: org.landingPath,
      anchor: '#live-now',
      // Deliberately does NOT ask them to sit and watch. Measured gaps between runs are four to
      // seven minutes, and "keep this page open" spends a prospect's attention on staring at a
      // static number. The score strip rides the chrome, so it follows them through the rest of
      // the tour and flags the run wherever they are — which is the better invitation.
      said: 'This game is being played right now. Nobody types these scores in — the strip above updates on its own, and it follows you through the rest of the demo.',
      watchesLiveScore: true,
      nextLabel: 'Next: the bracket',
    },
    {
      n: 2,
      label: 'See the bracket fill itself in',
      /**
       * The bracket DIAGRAM lives on Standings, not on the Playoffs page.
       *
       * `/playoffs` is the Playoff Picture — seeding, matchups and the numbers behind them — and
       * its own "Full Bracket →" button points here. The first build sent this step to
       * `/playoffs`, so a visitor was told "that final slot read Winner of SF1" while looking at a
       * page that does not draw the slot. Owner, third QA pass: *"'see the bracket fill itself in'
       * brings me to this screen, which doesn't show the brackets."* Right again.
       */
      href: `${org.landingPath}/standings`,
      anchor: '[data-sandbox-tour="playoff-bracket"]',
      said: 'The championship slot read "Winner of SF1" until the semifinal ended. Nobody moved that team across — finishing the game did it.',
      nextLabel: "Next: the organizer's seat",
    },
    {
      n: 3,
      label: "Step into the organizer's seat",
      href: operatorHref(`${adminBase}/dashboard`),
      // The org now runs THREE events, so every operator step names its event — otherwise the
      // admin context opens whichever tournament it last edited, which may be the wrong moment.
      ...(access.isDemoOrganizer ? { tournamentSlug: DEMO_TOURNAMENT_SLUG } : {}),
      anchor: '[data-sandbox-tour="now-playing"]',
      said: 'Same tournament, your side of it. The scores you just watched arrive are the ones sitting in "Needs a score".',
      nextLabel: 'Next: try to break it',
    },
    {
      n: 4,
      label: 'Try to break the schedule',
      href: operatorHref(`${adminBase}/schedule`),
      ...(access.isDemoOrganizer ? { tournamentSlug: DEMO_TOURNAMENT_SLUG } : {}),
      anchor: '[data-sandbox-tour="schedule-health"]',
      said: 'Drag any game onto a slot that is already busy. The health score reacts as you drop it — and nothing you do here is saved.',
      nextLabel: 'Next: three weeks back',
    },
    // Steps 5–6 are the moments dock wearing its guided handle: same jumps, same arrival
    // narration discipline. The tour now walks the year, not just the Saturday.
    {
      n: 5,
      label: 'Go back three weeks',
      href: operatorHref(`${adminBase}/registrations`),
      ...(access.isDemoOrganizer ? { tournamentSlug: DEMO_INVITATIONAL_SLUG } : {}),
      anchor: '[data-sandbox-tour="registration-health"]',
      said: 'Three weeks before first pitch, the work looks like this: fifteen teams in the pipeline, U11 full with a waitlist forming, and the health score naming exactly who still owes what.',
      nextLabel: 'Next: the morning after',
    },
    {
      n: 6,
      label: 'Skip to the morning after',
      href: operatorHref(`${adminBase}/summary`),
      ...(access.isDemoOrganizer ? { tournamentSlug: DEMO_OPENER_SLUG } : {}),
      anchor: '[data-sandbox-tour="post-event-summary"]',
      said: 'The day after it all ended: every score in, the champion crowned, and the summary already written. Next year starts from one button.',
    },
  ];
}

/**
 * The narration strip's return label. Names the moment for the tournament sandbox; stays generic
 * for any other kind — this chrome is org-agnostic, and the coach sandbox's home is not "game
 * day" (latent-label finding from the Phase 2 review).
 */
export function sandboxBackLabel(kind: DemoOrgKind): string {
  return kind === 'tournament' ? '← Back to game day' : '← Back to the demo';
}

/**
 * Milliseconds until the sandbox replays.
 *
 * Reads the SAME cycle the reconcile job writes against: cycles are anchored to absolute epoch
 * time (`lib/demo-tournament.ts`), never to a first-run timestamp, so a browser and a scheduled
 * job compute the same boundary without talking to each other. That is what makes the countdown
 * proof the demo is running rather than a decoration — it is the real clock, not an animation.
 */
export function msUntilSandboxReset(cycleMinutes: number, now: number): number {
  const cycleMs = cycleMinutes * 60_000;
  return cycleMs - (now % cycleMs);
}

/**
 * `mm:ss` from milliseconds. Minutes are not capped at 59 — the replay cycle is two hours.
 *
 * `padMinutes` is the only thing that varies between the two places this is needed: the banner's
 * replay countdown is a clock and wants a fixed `05:28`, while the score pill's "changed 1:31 ago"
 * is prose and a leading zero there reads as a stopwatch. One rounding rule, two presentations —
 * the alternative was a near-identical second formatter living in the component.
 */
export function formatResetCountdown(ms: number, padMinutes = true): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const mm = padMinutes ? String(minutes).padStart(2, '0') : String(minutes);
  return `${mm}:${String(seconds).padStart(2, '0')}`;
}
