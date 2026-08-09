'use client';
/**
 * app/pricing/ViewerAwarePlans.tsx — the org plan grid, told who is reading it (repair ruling R4,
 * 2026-08-01; audit finding D4).
 *
 * THE DEFECT: the app strip links to /pricing from every consumer surface, so a signed-in owner
 * tapping Pricing from their own chrome landed on a page whose plan cards funnelled them into
 * `/auth/signup?plan=club` — the sign-up path for someone who does not have an account, offered
 * to someone who already pays. Highest-traffic seam-crossing in the product, with no continuity.
 *
 * THE RULE, three states:
 *   • Anonymous, and signed-in fans (prospects) — UNCHANGED. Today's cards, today's CTAs. This is
 *     the audience the pitch exists for, and nothing here may make it heavier.
 *   • Signed-in ORG operator — their current tier is marked, and every card's CTA deep-links to
 *     their own billing screen, where a plan change actually happens (with proration and
 *     confirmations). Never the sign-up funnel.
 *   • Signed-in coach with no org — also UNCHANGED here: starting an organization genuinely IS
 *     sign-up for them. Their upgrade path is the Premium Coaches Portal card in the marketing
 *     grid (2026-08-08; formerly a callout below it), whose CTA always points at the coach
 *     checkout — it deliberately never takes the org-operator overrides below.
 *
 * ANONYMOUS-PUBLIC INVARIANT (NAV_UNIFICATION_PLAN §5): everything resolves CLIENT-side after
 * hydration, from signals that already exist — `useClientSignedIn` is a local cookie read, and
 * the role summary is the same one-request answer the operator pill uses everywhere else, gated
 * so an anonymous visitor never fires it. The server still renders one static, role-free page,
 * so /pricing stays cacheable and the SSR HTML is identical for everyone.
 *
 * NO PRICES ARE WRITTEN HERE. Labels name plans and actions only; every price on this page comes
 * from `lib/plan-config.ts` via PricingSection, per the single-source pricing rule.
 */
import PricingSection, { RENDERED_PLAN_KEYS } from '@/components/PricingSection';
import { useClientSignedIn } from '@/lib/use-client-signed-in';
import { useRoleSummaryState } from '@/lib/use-role-summary';
import { PLAN_CONFIG } from '@/lib/plan-config';
import type { OrgPlan } from '@/lib/types';

export default function ViewerAwarePlans({ gatingMap, marketingLayout }: { gatingMap: Record<OrgPlan, boolean>; marketingLayout?: boolean }) {
  const signedIn = useClientSignedIn();
  const { summary: roles, resolving } = useRoleSummaryState(signedIn);

  // An org operator is the only viewer whose CTAs change: they have a billing screen to be sent to.
  const billingHref = roles?.billingHref ?? null;
  // Membership of the RENDERED card set, not of PLAN_CONFIG. `club_large` (Club · Association) and
  // `team` are real plans with no card here, so a PLAN_CONFIG check produced a `currentPlan` that
  // matched nothing — no "Current plan" badge at all for the highest-paying tier (/review).
  const currentPlan = billingHref && roles?.orgPlan && RENDERED_PLAN_KEYS.includes(roles.orgPlan as OrgPlan)
    ? (roles.orgPlan as OrgPlan)
    : undefined;

  // ⚠ THE WINDOW MATTERS. Until the role summary lands we cannot tell an operator from a fan, and
  // the prospect markup's CTA is a LIVE link into `/auth/signup?plan=…`. Rendering it during that
  // window hands a signed-in operator the exact sign-up funnel this feature exists to keep them out
  // of — and a fast clicker can take it. So while a signed-in visitor's answer is in flight the
  // cards hold a non-navigating placeholder; prospects and anonymous visitors never reach this
  // branch (`resolving` is false when the hook is disabled), so the pitch is untouched for them.
  // Clears on failure too, so a fail-quiet response falls through to the prospect CTAs rather than
  // stranding anyone on a dead button.
  if (resolving) {
    return (
      <PricingSection
        gatingMap={gatingMap}
        marketingLayout={marketingLayout}
        ctaHrefFor={() => '#'}
        ctaLabel={() => '…'}
      />
    );
  }

  if (!billingHref) return <PricingSection gatingMap={gatingMap} marketingLayout={marketingLayout} />;

  return (
    <PricingSection
      gatingMap={gatingMap}
      marketingLayout={marketingLayout}
      currentPlan={currentPlan}
      // Same destination for every card: the billing screen is where plan changes are made, and
      // sending "choose Club" somewhere else would fork one decision across two surfaces.
      ctaHrefFor={() => billingHref}
      ctaLabel={planKey =>
        planKey === currentPlan ? 'Manage your plan →' : `Choose ${PLAN_CONFIG[planKey].label} →`
      }
    />
  );
}
