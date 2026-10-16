/**
 * THE UPGRADE, WHEREVER IT IS ASKED FOR (owner, the free tier walk 2026-10-16: "make sure all of these upgrade links just
 * open the upgrade drawer and don't navigate away from the page").
 *
 * Every plan lock in the admin is a link to Plan & billing with the plan's panel asked for (`…?plan=tournament_plus`,
 * `tournamentPlusPanelHref`). That stays the link — so a Ctrl/⌘-click still opens Plan & billing in a new tab, and a
 * lock drawn before this needed no change — but a plain click is caught by `PlanPanelHost` (mounted once in the admin
 * layout) and opens the same panel over the page instead. `planPanelFromHref` is the one reader of that address.
 *
 * `requestPlanUpgrade` is the upgrade request behind Plan & billing's cards, its panel, and the panel opened over any
 * other page. (The club's Billing kit and its plan-move window still ask on their own.) Founding Season (and the dev
 * mock) apply the plan at once; otherwise it returns Stripe's checkout address, which the caller leaves for.
 */
import type { OrgPlan } from './types';
import { PLAN_CONFIG } from './plan-config';

/** The plans a panel can be opened for. */
const PANEL_PLANS = ['tournament_plus', 'league', 'club', 'team'] as const;
export type PanelPlanKey = typeof PANEL_PLANS[number];

/** The plans an organization can be moved onto from the panel (the coach's workspace is its own sign-up). */
export type UpgradePlanKey = Exclude<PanelPlanKey, 'team'>;

/** The plans a panel's Upgrade is offered for, on this plan — only the free Tournament plan is offered Tournament
 *  Plus. Plan & billing's primary cards and the panel over any page read this one rule. */
export function upgradePlansFor(planId: OrgPlan | string | null | undefined): UpgradePlanKey[] {
  return planId === 'tournament' ? ['tournament_plus'] : [];
}

/** The two homes of Plan & billing (`getBillingHref`): the tournament tiers' and the organization's. */
const BILLING_PATH = /^\/[^/]+\/admin\/(?:tournaments\/settings\/subscription|org\/billing)\/?$/;

/**
 * The plan whose panel an address asks for — `/{org}/admin/tournaments/settings/subscription?plan=tournament_plus` or
 * the organization's `/{org}/admin/org/billing?plan=…` — or null for any other address (Plan & billing without a
 * plan, the onboarding's `?plan=club`, a page elsewhere). `base` resolves a relative href.
 */
export function planPanelFromHref(href: string, base = 'http://localhost'): PanelPlanKey | null {
  let url: URL;
  try { url = new URL(href, base); } catch { return null; }
  if (!BILLING_PATH.test(url.pathname)) return null;
  const plan = url.searchParams.get('plan');
  return PANEL_PLANS.find(p => p === plan) ?? null;
}

type Retention = { restoredCount?: number; remainingRetainedCount?: number };
export type PlanUpgradeResult =
  /** The plan was applied at once (Founding Season, or the dev mock): nothing to leave for. */
  | ({ applied: true; foundingSeason?: boolean; compUntil?: string } & Retention)
  /** Stripe's checkout — the caller leaves for it. */
  | { applied?: false; url: string };

/** Ask for the plan. Throws with the server's own words when it refuses (owner-only, a gated plan, …). */
export async function requestPlanUpgrade(input: {
  planKey: UpgradePlanKey;
  billingCycle: 'monthly' | 'annual';
  orgSlug: string;
  /** Where checkout comes back to; the server keeps it only inside this organization's admin. */
  returnTo: string;
}): Promise<PlanUpgradeResult> {
  const res = await fetch('/api/billing/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({})) as { applied?: boolean; url?: string; error?: string } & Retention
    & { foundingSeason?: boolean; compUntil?: string };
  if (!res.ok) throw new Error(data.error ?? 'Checkout failed');
  if (data.applied) return { ...data, applied: true };
  if (!data.url) throw new Error('Checkout did not return a destination.');
  return { url: data.url };
}

/** What "Plan updated" says once a plan was applied at once — Plan & billing's words, said the same everywhere. */
export function planUpdatedMessage(planKey: UpgradePlanKey, result: Retention): string {
  const label = PLAN_CONFIG[planKey].label;
  const remaining = result.remainingRetainedCount
    ? ` ${result.remainingRetainedCount} retained tournament${result.remainingRetainedCount === 1 ? '' : 's'} still exceed this plan limit and remain in retention.`
    : '';
  return result.restoredCount
    ? `Your plan has been updated to ${label}. ${result.restoredCount} retained tournament${result.restoredCount === 1 ? '' : 's'} restored.${remaining}`
    : `Your plan has been updated to ${label}.${remaining}`;
}
