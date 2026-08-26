import type { DemoOrgKind } from './demo-org';
import {
  DEMO_TOURNAMENT_SLUG, DEMO_OPENER_SLUG, DEMO_INVITATIONAL_SLUG, DEMO_COACH_TEAM_IDS,
  DEMO_COACH_SHOWCASE,
} from './demo-org';
import { SEE_IT_LIVE_PATH } from './sandbox-door';
import { moneySectionHref } from './coach-money-links';
import { insightsSectionHref } from './coach-insights-links.ts';

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
  // The coach's season (COACH_SANDBOX_SEASON_PHASES_PLAN.md — the phase dock), in season order
  'tryout-day', 'off-season', 'season-start', 'mid-season', 'seasons-end',
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
 * The phase dock (coach sandbox): one club, five teams, each frozen at a different moment of a
 * season, listed in the order a year happens. Every press is plain navigation to that team's
 * showcase screen — the coach portal has no public/operator split (it all sits behind the demo
 * session), so both paths agree.
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
      // The hub's Score FACE (One-Room build, 2026-08-23) — the standalone /tryouts/score page is
      // a redirect now. Query-addressed like the Money `?section=` destinations; the chrome's
      // arrival matcher already understands those.
      path: teamPath(DEMO_COACH_TEAM_IDS.tryoutDay, '/tryouts?stage=tryout-day&view=score'),
      saidPublic: 'Tryout day, mid-flight: 28 kids in bibs, two evaluators partway through their scoring, and one split opinion to argue about tonight. Blind scoring is on — the board shows bibs, never names.',
      saidOperator: 'Tryout day, mid-flight: 28 kids in bibs, two evaluators partway through their scoring, and one split opinion to argue about tonight. Blind scoring is on — the board shows bibs, never names.',
      bannerNote: 'Evaluations are mid-flight',
    }),
    moment({
      key: 'off-season',
      label: 'Off-season',
      sub: 'between seasons',
      teamId: DEMO_COACH_TEAM_IDS.offSeason,
      // The Money hub's Budget-vs-Actual TAB (query-addressed) — the standalone page is a legacy
      // redirect now, and the chrome's arrival matcher understands `?section=` destinations.
      path: moneySectionHref(teamPath(DEMO_COACH_TEAM_IDS.offSeason), 'budget-vs-actual'),
      saidPublic: 'Between seasons, with the books open: a budget built line by line, the winter\'s spending already against it, dues two payments in — and one family behind. Nobody has thrown a pitch yet.',
      saidOperator: 'Between seasons, with the books open: a budget built line by line, the winter\'s spending already against it, dues two payments in — and one family behind. Nobody has thrown a pitch yet.',
      bannerNote: 'The season is still being built',
    }),
    moment({
      key: 'season-start',
      label: 'Season start',
      sub: 'two weeks in',
      teamId: DEMO_COACH_TEAM_IDS.seasonStart,
      path: teamPath(DEMO_COACH_TEAM_IDS.seasonStart, '/schedule'),
      saidPublic: 'Two weeks into the year: the whole season already on the calendar, three games played, and the opener\'s lineup saved. This was one evening\'s work in March.',
      saidOperator: 'Two weeks into the year: the whole season already on the calendar, three games played, and the opener\'s lineup saved. This was one evening\'s work in March.',
      bannerNote: 'Two weeks into the season',
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
      /* ⚠ REWRITTEN 2026-08-18 with the closed-season change, and this is the demo drift CLAUDE.md
         warns about, caught in the same unit of work. Both lines used to say the season's record
         was "still open from the same menu — read-only, exactly as it ended". That was true of the
         portal that turned itself into a read-only copy of itself; it is not true of the one page a
         closed season is now, and every screen would still have rendered perfectly while the
         sentence was wrong. */
      saidPublic: 'A finished year, kept on one page: 18-6-2, the recap nine families opened, and the results, the roster, the practices and the money all folded away underneath.',
      saidOperator: 'A finished year, kept on one page: 18-6-2, the recap nine families opened, and the results, the roster, the practices and the money all folded away underneath.',
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
   * Treat "am I already here?" as an EXACT path match rather than a prefix one.
   *
   * The default is a prefix match, which is right for the tournament tour (its steps land on
   * section roots and a visitor deeper inside one is, fairly, already there). It is wrong wherever
   * a step's destination is the PARENT of a page the visitor can reach on their own: the coach
   * tour's first step lands on the Tryouts hub, and the moments dock lands on `/tryouts/score`
   * one level below it — so under prefix matching a visitor who arrived by the dock would press
   * step 1, be told they were already there, and watch nothing move. That is the exact defect the
   * moments dock already fixed for itself ("a subpage press navigates home"); this flag is the
   * same rule, opted into per step so the tournament tour's behaviour is untouched.
   */
  exactPath?: boolean;
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
  /**
   * The same claim in the fewest honest words, for a phone.
   *
   * ⚠ Not a nicety. The banner is two columns on a phone (2026-08-07): identity over status on the
   * left, the signup door pinned right. That leaves the status line about 165px on a 390px screen,
   * and the full sentence needs closer to 230 — so it ellipsised, and the one line in this chrome
   * that must never be optional was ending in "…nothing is sav". A truncated honesty claim is
   * worse than a short one.
   *
   * Only the coats that show the claim ON a phone need this: the tournament sandbox hides the
   * promise below 640px entirely (its first narration line carries it), the coach sandbox does not,
   * because its opening state has no sentence at all.
   */
  emphasisShort?: string;
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
      // The clause a stranger must not miss, standing alone. "Changes show on screen" is the
      // reassurance; "nothing is saved" is the promise, and it is the half that survives a phone.
      emphasisShort: 'Nothing is saved.',
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
  if (kind === 'coach') return coachSandboxTourSteps(org);
  if (kind !== 'tournament') return [];

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
 * The coach tour: ONE seven-step spine that walks a season (Phase 3, mockups rev 2, approved
 * 2026-08-05).
 *
 * ── Why one spine and not five per-moment tours ──────────────────────────────────────────────
 * The dock already offers the five moments self-serve; a tour per moment would be the dock with
 * extra buttons, and it would turn a season into five feature demos — the exact pitch the moments
 * naming exists to avoid. It is also structurally impossible here: step 6 (what a parent reads)
 * only lands having seen step 5 (the playing-time table it answers), and two steps that depend on
 * each other cannot live in separate tours.
 *
 * ── The rule every destination obeys ─────────────────────────────────────────────────────────
 * **A step lands one level deeper than its moment's dock chip.** The dock drops a visitor on the
 * moment's front door; the tour opens the drawer behind it. Step 7 is the single exception, and
 * deliberately: what it is showing is not a screen you can point at, it is the fact that the
 * season's record is still there under the coach's own menu, so the step lands where the chip does
 * and the sentence says so.
 *
 * ── What was measured before this list was written (2026-08-05, live demo, real browser) ─────
 * Three of the plan's candidate beats could not be pointed at, and this list routes around all
 * three rather than shipping steps that would read as broken:
 *   · the tryout SPLIT OPINION (bib 14, 5 vs 2) exists in the data and is rendered nowhere — every
 *     surface shows the 3.5 average — so step 1 points at the ranked board instead;
 *   · the EVALUATOR BIAS chip never fires on this data (consensus is the mean of evaluator means,
 *     so one harsh scorer of two moves both by half the drift: ±0.39 against a 0.75 threshold),
 *     and it sits on a tab the hub does not auto-select for a tryout with scores in it, inside a
 *     `display:none` panel — an anchor there would be a dead step;
 *   · PRACTICE PLANS have no address at all (a schedule event opens a drawer over `/schedule`),
 *     so the off-season step goes to Development, where the testing sessions' honest blanks are
 *     addressable.
 * Every remaining destination was opened and confirmed to render the thing its sentence claims.
 */
function coachSandboxTourSteps(org: { slug: string; landingPath: string }): SandboxTourStep[] {
  const team = (teamId: string, rest = '') => `/${org.slug}/coaches/teams/${teamId}${rest}`;
  return [
    {
      n: 1,
      label: 'See how 28 kids got ranked',
      // The DECIDE stage by name (One-Room build, 2026-08-23) — the sentence and the anchor both
      // describe the decision board, which lives on `?stage=decide`; a bare `/tryouts` would land
      // on whatever stage auto-selects. Naming the stage is also what keeps this press honest:
      // the dock's chip lands on the hub's Score face at the SAME pathname now, and only the
      // query (matcher checks every param the destination names) separates "already here" from
      // "take me there".
      href: team(DEMO_COACH_TEAM_IDS.tryoutDay, '/tryouts?stage=decide'),
      exactPath: true,
      anchor: '[data-sandbox-tour="tryout-decisions"]',
      said: 'Twenty-eight kids tried out this morning. They are already ranked — a weighted average of what each evaluator scored, updating as the scores come in. The names are hidden here: you are deciding on bib numbers, and one switch shows them whenever you want.',
      nextLabel: 'Next: the off-season',
    },
    {
      n: 2,
      label: 'Find the two blanks',
      href: team(DEMO_COACH_TEAM_IDS.offSeason, '/development'),
      exactPath: true,
      anchor: '[data-sandbox-tour="development-sessions"]',
      // ⚠ RE-WRITTEN 2026-08-20 when the world gained a second testing day. The old sentence
      // ("Eleven of thirteen players were tested that day") never became false — both sessions
      // are eleven of thirteen — but it described a screen showing ONE date while the screen now
      // shows two, and it left out the thing the second one exists for. This is the demo-drift
      // case CLAUDE.md reserves for a person: not a broken sentence, a story that stopped keeping
      // up with the product. Numbers verified against `OFFSEASON_TESTING_SESSIONS`.
      said: 'Two testing days, months apart — which is the whole reason the second set of numbers means anything. Eleven of thirteen were there each time; the ones who missed show a dash, not a zero, because nothing here is invented to fill a column. Four things this team is working on, one already reached.',
      nextLabel: 'Next: the season starts',
    },
    {
      n: 3,
      label: 'Count the lineups',
      href: team(DEMO_COACH_TEAM_IDS.seasonStart, '/lineups'),
      exactPath: true,
      anchor: '[data-sandbox-tour="lineups-upcoming"]',
      said: 'One lineup saved — opening day — and twelve games waiting behind it. The whole year went on the calendar in one evening in March; nothing since has had to be re-entered.',
      nextLabel: 'Next: the money',
    },
    {
      n: 4,
      label: 'See if the season is on budget',
      // The hub's Budget-vs-Actual TAB — the tour must never walk a prospect onto the tab-less
      // legacy page (owner, 2026-08-13). exactPath still binds the PATH; the `?section=` part
      // additionally requires the right tab, so "already here" on another tab still travels.
      href: moneySectionHref(team(DEMO_COACH_TEAM_IDS.midSeason), 'budget-vs-actual'),
      exactPath: true,
      anchor: '[data-sandbox-tour="budget-variance"]',
      // ⚠ The Bottle Drive clause (seeded 2026-08-14 with the season settlement sheet).
      // Fundraising lowering a family's bill is the most sympathetic thing this product does, and
      // until that seed the demo could not show it at all. If the drive is ever un-seeded, this
      // sentence goes with it — `check-demo-coach` pins the world it describes.
      //
      // ⚠ The closing clause was added 2026-08-14 when the two team-wide dues settings moved to
      // Team settings → Money. It is the demo's only mention of them, and deliberately so: WHERE
      // credits land is the reason the row above reads the way it does, so a prospect who has just
      // been shown the effect is the one prospect who cares that it is a choice. The seed states
      // both settings (DEMO_DUES_SETTINGS) rather than inheriting them, so this stays true.
      // ⚠ The sponsor clause (seeded 2026-08-15 with the sponsorships follow-ups). It is one
      // sentence because it earns one: the DISTINCTION is the product's idea — a drive asks what
      // each player raised, a sponsor is a single arrival — and the tour had no way to say the
      // portal knows the difference. The demo's sponsor is deliberately club-wide and credited to
      // nobody, so this sentence must never imply a family's bill moved (see MIDSEASON_SPONSOR:
      // the three pins the clause above depends on survive precisely because it does not).
      said: 'Halfway through the year, against a plan built in the spring: here is what has actually gone out, line by line. Diamond rentals are over plan — the report says so rather than hiding it. Seven in ten dollars of dues are in, two families are behind — and one pays in small e-transfers, its installment sitting at $90 of $120, recorded exactly as it arrived. One family owes nothing at all on their last bill: their player sold $240 of bottles, half of it came straight off the dues, and the row reads "covered by fundraising" instead of asking them for it. Which bill that lands on is your call, set once — Player Dues prints the answer under the table, and Team settings is where it changes. Money coming in is not all one thing either: beside the bottle drive sits a $750 sponsor, recorded as one arrival rather than a roster of blank rows, and marked received — a pledge would sit in the plan and count as nothing in the books until the cheque lands.',
      nextLabel: 'Next: where the money actually went',
    },
    {
      /**
       * ⚠ A NEW STEP, because the product gained a screen the story had no sentence for (money
       * redesign P3, 2026-08-17). CLAUDE.md's demo rule asks two questions of every user-facing
       * change: are the existing sentences still true, and *should a demo moment show this?* The
       * answers here were yes and yes — nothing above described the Expenses or Money-in lists, so
       * nothing went stale, but a dated book whose closing balance IS the team's cash is the most
       * shop-window thing in Money and the tour walked straight past it.
       *
       * ⚠ IT IS THE STEP AFTER THE REPORT, DELIBERATELY. Budget vs. Actual answers "are we on
       * plan?"; this answers "where did it actually go, and what is left?" — and a prospect who has
       * just seen the plan is the one who wants the second question. Reversing them would make the
       * register look like a longer version of the report.
       */
      n: 5,
      label: 'Read the season one row at a time',
      href: moneySectionHref(team(DEMO_COACH_TEAM_IDS.midSeason), 'transactions'),
      exactPath: true,
      anchor: '[data-sandbox-tour="register-balance"]',
      /* ⚠⚠ THE CLAIM IN THE FIRST SENTENCE IS LOAD-BEARING, AND ITS CHECK IS NOT AUTOMATIC.
         "The number at the top is the team's cash, to the cent" is exactly the identity
         `npm run check:register` proves — but that script needs a running dev server and a
         Playwright session, so it is NOT in `verify:changed` and nothing in the build re-runs it.
         (An earlier draft of this comment said the sentence "cannot quietly stop being true without
         that check going red", which was itself the drift CLAUDE.md's demo rule describes: a
         narration promising a guarantee nobody had wired up.) It is run by hand, and it is listed in
         the plan's done-means and in Owner QA §46. **If this identity is ever relaxed, this sentence
         is the first thing to change.** Do not soften it to "roughly" instead — the whole design is
         that it is exact; soften the DESIGN or leave the sentence alone. */
      /* ⚠ THE CLUB CLAUSE IS NEW WITH P4 (2026-08-17), and it is one sentence on an existing step
         rather than a ninth step — the tour is already eight, and CLAUDE.md's demo rule asks
         *should a demo moment show this?*, not *does it deserve its own stop*. A Club-plan prospect
         is shopping for precisely this relationship and the demo had no sentence for it.
         ⚠ EVERY FIGURE IN IT IS PINNED BY `MIDSEASON_CLUB_MONEY`: a $900 share in three
         installments (two settled, one ahead), $180 the club agreed to pay back, and a $95 request
         still undecided. If that seed changes, this sentence changes with it — and the pending $95
         is also what makes the "may still say no" clause visible in the scheduled rows above. */
      /* ⚠ THE "Record" CLAUSE IS NEW WITH MONEY CENTRALIZATION P2 (2026-08-23), and it is a
         sentence on this step rather than a ninth stop — the same call the P4 club clause above
         records, for the same reason. It closes the rider Owner QA §80 left open: the green
         button is the most visible thing on this screen and the tour walked straight past it,
         which is precisely the drift CLAUDE.md's demo rule describes. It is also newly TRUE that
         it is the only way in here — Transactions' own Add retired with P2 — so a prospect who
         reads the narration and then looks for an Add button finds the answer already given.
         ⚠ IT CLAIMS NO FIGURES, deliberately: nothing in it is pinned to a seed, so a reseed
         cannot make it wrong. */
      /* ⚠ THE CLOSING "labels" CLAUSE IS NEW WITH MONEY CENTRALIZATION P3 (2026-08-25), and it is
         here because this world could not show the feature at all until the same day: no money tag
         had ever been seeded, so both money faces hid the control outright and a prospect never
         met the one question a budget category cannot answer. `MIDSEASON_MONEY_TAGS` is the world
         it describes — "Spring Classic" deliberately spanning two categories.
         ⚠ IT CLAIMS NO FIGURES EITHER, for the same reason as the Record clause: the totals move
         with the nightly anchor, so the sentence must not name one. */
      said: 'Every dollar this season moved, in date order, with the balance running down the side — and the figure at the top is not a summary, it is the team\'s cash, to the cent. Not just what this coach typed: dues arriving, the bottle drive, the sponsor, and what the club has billed all land on the same book, each tagged with where it came from and one tap from the screen that owns it. Turn on what is scheduled and it keeps going past today — the entry fee due in three weeks, the next round of dues — so the last line is what the account will hold once they land. The club\'s own side has a screen of its own: $900 of shared permits billed across three installments with one still ahead, $180 the club agreed to pay back for a permit this coach fronted, and a $95 share still waiting on an answer — money that shows here as undecided and counts toward nothing until they say yes. And writing any of it down is one green button, up beside Import: Record asks a coach what happened in their own words — a family paid, the drive brought money in, we paid a bill — and files it wherever it belongs, from whichever screen they happen to be standing on. One more control worth a look: the coach\'s own labels. A budget word says what kind of cost something was; a label says which occasion it belonged to — so tick one and the book narrows to that weekend, across every category it touched, and states what it came to.',
      nextLabel: 'Next: playing time',
    },
    {
      n: 6,
      label: 'Ask who has been on the field',
      /* ⚠ THE PLAYING-TIME TAB, not the tab-less legacy page (reports portal P1, 2026-08-18) — the
         same rule step 4 states for the Money hub. `exactPath` still binds the PATH; the `?section=`
         part additionally requires the right TAB, so a visitor standing on the portal's Dashboard is
         not treated as "already here" and travelled correctly to the panel this sentence describes.
         Delivering in place on the wrong tab would ring an anchor inside a `display:none` panel. */
      href: insightsSectionHref(team(DEMO_COACH_TEAM_IDS.midSeason), 'playing-time'),
      exactPath: true,
      anchor: '[data-sandbox-tour="playing-time"]',
      // Measurement in context, never a verdict — the playing-time vocabulary ruling
      // (owner 2026-08-04, BUSINESS_DECISIONS.md). Counts and a cap; the reader draws the line.
      /* ⚠ THE OPENING CLAUSE IS NEW (2026-08-18) and it is the demo's sentence about the portal
         itself. Insights became one page of seven report tabs the same day; a prospect who lands
         here mid-tour now sees a tab row the old narration never mentioned, and CLAUDE.md's demo
         rule asks exactly this — *should a demo moment show this?* One clause on an existing step,
         not a ninth step: the tour is already eight. */
      /* ⚠ THE LAST TWO CLAUSES ARE NEW (2026-08-19) and they are the demo's sentence about the two
         sections this tab gained the same day — the position-recency grid and the arm-care panel.
         CLAUDE.md's demo rule asks *should a demo moment show this?*; a prospect scrolling past two
         new blocks the narration never mentions is the drift it exists to prevent. One clause on an
         existing step, not a ninth: the tour is already eight, and the step before this one made
         the same call for the same reason.
         ⚠ THE "no weekly budget" CLAUSE IS LOAD-BEARING, not a caveat. The approved mockup drew
         arm care against a weekly innings cap this product deliberately does not have, and the
         owner ruled on 2026-08-19 to redraw it against real numbers rather than invent one. If a
         prospect reads a ceiling into this screen, the demo has mis-sold it in the one place where
         being wrong costs a child's arm.
         ⚠ AND THE GRID ONLY VARIES BECAUSE THE SEED WAS FIXED THE SAME DAY: all six saved lineups
         used one authored grid, so every cell said the same number. See `midseasonLineupGrid`. */
      said: 'Every report this coach has sits behind one row of tabs — results, attendance, playing time, development, awards, the scouting book — and this is the playing-time one. One row per player, from the lineups you already saved. Most of the team has been on the field for 24 to 30 innings so far; one player has been on for 12, and has sat back-to-back six times. Two pitchers are carrying 18 innings against a three-an-outing cap. Underneath, a grid of every player against every position: how many days since each of them last stood there, and a dash where no saved lineup ever has — because a position listed on a roster is an intention, not a game anyone played. Then each pitcher\'s rest, against the per-game cap this coach set themselves, which is the only ceiling in here: the product keeps no weekly innings budget of its own and will not invent one. Nobody typed any of this in.',
      nextLabel: 'Next: what a parent sees',
    },
    {
      n: 7,
      label: 'Read what a parent gets',
      href: team(DEMO_COACH_TEAM_IDS.midSeason, `/roster/${DEMO_COACH_SHOWCASE.midSeasonPlayerId}`),
      exactPath: true,
      anchor: '[data-sandbox-tour="family-recap"]',
      // Asks for a PRESS, which is safe: the preview only reads. No step in this tour may ask a
      // visitor to save, score or change anything — the sandbox blocks every write centrally, and
      // a step that invited one would be writing a cheque the demo bounces.
      said: 'This is the player you just saw at the bottom of that table. Press Preview: this is the page his family opens at the end of the season — their view, not yours, drawn by the very screen they will see. It writes itself from what you have already recorded.',
      nextLabel: 'Next: a finished year',
    },
    {
      n: 8,
      label: 'Open a season that is already over',
      href: team(DEMO_COACH_TEAM_IDS.seasonsEnd, '/season-end'),
      exactPath: true,
      anchor: '[data-sandbox-tour="season-recaps"]',
      // ⚠⚠ REWRITTEN 2026-08-18. The middle clause — "the same menu, every screen read-only,
      // exactly as it ended" — described the portal that turned itself into a read-only copy of
      // itself, and that state is deleted: a closed season is ONE PAGE with four shut shelves, and
      // the menu belongs to the team's live season. This is exactly the drift CLAUDE.md's demo rule
      // is about, and it is worth noting it would have survived a build, a sweep and a review:
      // every page still renders, and only the sentence over the top of them was false.
      said: 'Last year, kept on one page: 18-6-2, and nine of twelve families opened their player’s recap — the same page you just read. The season is closed, so this is all of it now: the results, who was on the team, the practices you ran and how the money added up, each folded away until you want it. Open the practices — one reads exactly as it was written.',
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
