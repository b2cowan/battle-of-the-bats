'use client';
import { planStepPath, type StartPaidPlan, type StartPricing, type StartStepViewer } from '@/lib/start-door';
import { slugifyOrgName } from '@/lib/utils';
import StartDoorForm, { type StartCreate } from './StartDoorForm';

/**
 * THE PAID DOORS' CREATE STEP (On-sale pages S2): Start a club (drawing tab 6, words W46–W47) and Start a league season
 * while League Plus is on sale (drawing tab 7, words W51–W53; there is no free League start, owner 2026-11-19). Step 1 the account, with the pricing page's pick riding on it; step 2
 * names the organization, and one tap makes it on the free Tournament plan (Ask 14), remembering
 * the plan it came to buy (`startPlan`); step 3 is the door's plan step.
 *
 * A Premium coach is sent to their own portal's "Start your club" instead (trap D): the server answers 409
 * `start_club_in_place` with where to go — only ever on Start a club — and the page sends them there before this form shows.
 */
const PAID_FORM: Record<'club' | 'league_plus', {
  /** The plan the organization remembers (Club or Club · Association from the pick; League Plus). */
  startPlan: (pricing: StartPricing | null) => StartPaidPlan;
  /** The public address's placeholder while no name is typed. */
  slugFallback: string;
  failed: string;
}> = {
  club: { startPlan: pricing => (pricing?.plan === 'club_large' ? 'club_large' : 'club'), slugFallback: 'your-club', failed: 'Could not create your club.' },
  league_plus: { startPlan: () => 'league', slugFallback: 'your-league', failed: 'Could not create your league.' },
};

export default function StartPaidDoorForm({ door, pricing, ...props }: {
  door: 'club' | 'league_plus';
  viewer: StartStepViewer | null;
  confirmed?: boolean;
  /** A pick this door sells only (the page reads it through `paidDoorPick`). */
  pricing: StartPricing | null;
}) {
  const form = PAID_FORM[door];
  // The public address, generated server-side from the name (the final one may gain a number if it is taken).
  const publicAddress = (name: string) => (
    <>Your public address: <strong>fieldlogichq.ca/{slugifyOrgName(name) || form.slugFallback}</strong> — you can change it later.</>
  );

  const createPaidDoor: StartCreate = async (orgName, send) => {
    const res = await send('/api/org/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgName, startPlan: form.startPlan(pricing) }),
    });
    if (!res) return null;
    const data = await res.json().catch(() => ({})) as { orgSlug?: string; error?: string; code?: string; href?: string };
    // A same-site path only (never `//host` or `/\host`): the server builds it from the coach's own portal address.
    if (res.status === 409 && data.code === 'start_club_in_place' && data.href && /^\/(?![/\\])/.test(data.href)) return data.href;
    if (!res.ok || !data.orgSlug) throw new Error(data.error ?? form.failed);
    return planStepPath(data.orgSlug, pricing);
  };

  return <StartDoorForm door={door} create={createPaidDoor} help={publicAddress} pricing={pricing} {...props} />;
}
