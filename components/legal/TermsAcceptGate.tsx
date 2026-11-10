import 'server-only';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { checkAcceptance, type AcceptanceUser } from '@/lib/legal-acceptance';
import { paidPlansOwnedBy } from '@/lib/legal-acceptance-plans';
import { screenPassesThrough } from '@/lib/legal-acceptance-rules';
import TermsAcceptScreen from './TermsAcceptScreen';
import TermsGateWatch from './TermsGateWatch';

/**
 * THE SIGN-IN SCREEN'S GATE (GST/HST Stage 6 step 6.3, Chunk B, ruling R3; drawings tab 4). Mounted by every signed-in shell —
 * the consumer app, the club admin, both Coaches Portal shells, the scorekeeper, check-in and the house-league coach's team
 * page (`tests/unit/legal-acceptance-doors.test.ts` holds that list) — never by platform admin (staff are exempt).
 *
 * Decided on the SERVER, before anything else mounts (the `CoachTeamSeasonGate` pattern): a person who still needs to agree to
 * the current Terms gets the screen INSTEAD of the shell, at the same address — no redirect, no route of its own, no nav, and
 * none of the shell's children render. Everyone else gets the shell untouched: nobody signed in, the pages off (production until
 * 6.7), staff and the demo accounts, and anyone who has agreed (an accepted person costs no query: the mirror rides on the
 * user `getUser()` already returned).
 *
 * The page renders instead of the screen at a shell's own account doors (`doors`, the consumer shell's sign-in area and family
 * join page) and, on "We've updated our Terms" only, at a paid-plan owner's billing pages (the cancel door's destination:
 * cancelling is never gated). The address is the proxy's `x-pathname`. A let-through page carries a watch: in-app navigation does
 * not re-run a layout, so leaving the let-through set asks the server again.
 *
 * ⚠ A layout runs on a FULL load only (Next 16 layouts do not re-render on in-app navigation). An installed app left open
 * across the switch shows the screen at its next full load; the organization and purchase routes carry their own check
 * (Chunk C), so nobody becomes a customer in that gap. No polling, by ruling.
 */
export default async function TermsAcceptGate({ user, children, doors, fixedWarm = false }: {
  user: AcceptanceUser | null | undefined;
  children: ReactNode;
} & ScreenOptions) {
  const gate = await termsGateFor(user, { doors, fixedWarm });
  if (gate?.screen) return gate.screen;
  return <>{gate?.watch}{children}</>;
}

interface ScreenOptions {
  /** The shell's own account doors, where its page renders instead (the consumer shell's `CONSUMER_SHELL_DOORS`). */
  doors?: readonly string[];
  /** A portal that is Warm in every theme (the scorekeeper and check-in): the screen wears Warm there too. */
  fixedWarm?: boolean;
}

/**
 * The decision, for a layout with several returns (the club Coaches Portal and its walls) as well as for the gate above:
 *   · null — nothing to do (nobody signed in, the pages off, staff or demo, or agreed);
 *   · `screen` — return it INSTEAD of the shell;
 *   · `watch` — the page is let through (an account door, or a paid owner's billing page); render it beside the page, so
 *     a navigation away from the let-through set asks the server again (`TermsGateWatch`).
 */
export async function termsGateFor(
  user: AcceptanceUser | null | undefined, { doors = [], fixedWarm = false }: ScreenOptions = {},
): Promise<{ screen: ReactNode; watch?: undefined } | { watch: ReactNode; screen?: undefined } | null> {
  if (!user) return null;
  const { state, hadEarlier } = await checkAcceptance(user);
  if (state !== 'needed') return null;

  // The cancel door (§20 (5e)) exists only on "updated"; first publication sold nothing before the Terms existed.
  const [pathname, plans] = await Promise.all([
    headers().then(h => h.get('x-pathname')),
    hadEarlier ? paidPlansOwnedBy(user.id) : Promise.resolve([]),
  ]);
  const billingHrefs = plans.map(p => p.billingHref);
  if (screenPassesThrough(pathname, { doors, billingHrefs })) {
    return { watch: <TermsGateWatch doors={doors} billingHrefs={billingHrefs} /> };
  }
  return { screen: <TermsAcceptScreen email={user.email ?? null} updated={hadEarlier} plans={plans} fixedWarm={fixedWarm} /> };
}
