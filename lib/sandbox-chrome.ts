import type { DemoOrgKind } from './demo-org';
import { SEE_IT_LIVE_PATH } from './sandbox-door';

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
}

/**
 * The banner's promise, per side. The operator side says something stronger because it has to:
 * a visitor on the fan page is only reading, but a visitor in the admin portal is about to try
 * changing something, and the honest thing is to say what happens BEFORE they do.
 */
export function sandboxBannerCopy(side: SandboxSide): SandboxBannerCopy {
  if (side === 'operator') {
    return {
      lead: "You're in the organizer's seat.",
      emphasis: 'Changes show on screen, but nothing is saved.',
    };
  }
  return { lead: 'A real tournament, running right now. Nothing you do here is saved.' };
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
      anchor: '[data-sandbox-tour="now-playing"]',
      said: 'Same tournament, your side of it. The scores you just watched arrive are the ones sitting in "Needs a score".',
      nextLabel: 'Next: try to break it',
    },
    {
      n: 4,
      label: 'Try to break the schedule',
      href: operatorHref(`${adminBase}/schedule`),
      anchor: '[data-sandbox-tour="schedule-health"]',
      said: 'Drag any game onto a slot that is already busy. The health score reacts as you drop it — and nothing you do here is saved.',
    },
  ];
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
