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

export interface SandboxTourChip {
  /** The numeral shown in the chip. 1-based, in the order they should be tried. */
  n: number;
  label: string;
  /**
   * A CSS selector for the beat this chip points at. When it matches something on the current
   * page, the chip scrolls to it and rings it rather than navigating — the difference between
   * "look at this" and "go somewhere".
   */
  anchor?: string;
  /** Where to go when `anchor` matches nothing here (or there is no anchor at all). */
  href?: string;
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
 * The tour, per sandbox and per side. Three or four beats, each one a thing the product does on
 * its own — a stranger with ninety seconds should not have to guess what to look at.
 *
 * Anchors are deliberately few. `#live-now` is the public page's own section id, and
 * `data-sandbox-tour` marks the two operator panels the tour points at; everything else is a
 * plain link, because "go to the schedule" is a truthful description of what the chip does.
 */
export function sandboxTourChips(
  kind: DemoOrgKind,
  side: SandboxSide,
  org: { slug: string; landingPath: string },
  access: SandboxTourAccess = { isDemoOrganizer: true },
): SandboxTourChip[] {
  if (kind !== 'tournament') {
    // The coach sandbox registers its own beats here when it builds
    // (COACH_SANDBOX_SEASON_PHASES_PLAN.md). An empty list renders no chip rail at all, which is
    // the correct "not built yet" state — the banner still carries the promise.
    return [];
  }

  const adminBase = `/${org.slug}/admin/tournaments`;

  if (side === 'operator') {
    return [
      { n: 1, label: 'See a score come in', anchor: '[data-sandbox-tour="now-playing"]', href: `${adminBase}/dashboard` },
      { n: 2, label: 'Try to break the schedule', anchor: '[data-sandbox-tour="schedule-health"]', href: `${adminBase}/schedule` },
      { n: 3, label: 'See what parents see', href: org.landingPath },
    ];
  }

  return [
    { n: 1, label: 'Scores update on their own', anchor: '#live-now', href: org.landingPath },
    { n: 2, label: 'The bracket fills itself in', href: `${org.landingPath}/playoffs` },
    // The dual view is the beat that sells, so this step is always offered — but it points at the
    // dashboard only for a visitor who can open it. Everyone else goes through the door, which
    // deals with their situation and hands them the session this step needs.
    {
      n: 3,
      label: "See the organizer's side",
      href: access.isDemoOrganizer ? `${adminBase}/dashboard` : SEE_IT_LIVE_PATH,
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

/** `mm:ss`, the shape the mockups' banner shows. Minutes are not capped at 59 — the cycle is 2h. */
export function formatResetCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
