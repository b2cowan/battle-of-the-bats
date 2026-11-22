'use client';
/**
 * The plan's panel opened over a page by a plan lock, and what its Upgrade came to — loaded only once a lock is clicked
 * (`PlanPanelHost` mounts it; nothing here ships with an admin page that never shows one).
 *
 * Its Upgrade is Plan & billing's (`requestPlanUpgrade`): a plan applied at once re-reads the org and its
 * tournaments, the page under the drawer unlocks in place and "Plan updated" says so; a paid upgrade leaves
 * for Stripe's checkout, which comes back to Plan & billing. Who is offered the Upgrade (`upgradePlansFor`, the owner
 * only) and when the plan is still early-access follow Plan & billing's own panel, so the drawer offers here exactly what
 * it offers there.
 */
import { useEffect, useState } from 'react';
import { useOrg } from '@/lib/org-context';
import { hasBillingAccess } from '@/lib/roles';
import { useTournament } from '@/lib/tournament-context';
import { usePlanGating } from '@/lib/use-plan-gating';
import { isEffectivelyGated } from '@/lib/plan-config';
import { getBillingHref } from '@/lib/billing-urls';
import { planUpdatedMessage, requestPlanUpgrade, upgradePlansFor, type PanelPlanKey, type UpgradePlanKey } from '@/lib/plan-upgrade';
import { formatAnnualSavings, type BillingCycle } from '@/lib/plan-config';
import { formatBilledTo } from '@/lib/billing-location';
import { ownPlanOf } from '@/lib/free-time';
import KitDialog from '@/components/shared/KitDialog';
import { NoticePill } from '@/components/admin/kit/club/RepKit';
import PlanArticlePanel from './PlanArticlePanel';
import PlanCycleDialog from './PlanCycleDialog';
import { useBillingAddressGate } from './BillingAddressDialog';
import { useTermsGate } from '@/components/legal/TermsAcceptWindow';

type Outcome = { title: string; message: string; type: 'success' | 'danger' };

export default function PlanPanelDrawer({ plan, onClose }: { plan: PanelPlanKey; onClose: () => void }) {
  const { currentOrg, userRole, userCapabilities, refresh: refreshOrg } = useOrg();
  const { refresh: refreshTournaments } = useTournament();
  const gating = usePlanGating();
  // A free Tournament organization on whole-plan free time is offered only the plans above the one it is given (call 40).
  const ownPlan = currentOrg ? ownPlanOf(currentOrg) : undefined;
  const givenPlan = currentOrg && ownPlan === 'tournament' && currentOrg.planId !== ownPlan ? currentOrg.planId : null;
  const [loading, setLoading] = useState(false);
  // Once the Upgrade answers, the panel gives way to what it came to; closing that closes the whole thing.
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const address = useBillingAddressGate(currentOrg ? { orgSlug: currentOrg.slug } : null);
  // A stop on the Terms opens their window over the panel; after the tick the upgrade carries on (step 6.3, C3).
  const terms = useTermsGate();
  // On-sale pages S4 (call 38): the Upgrade opens the payment window — Monthly or Yearly, the true trial — as Plan & billing's does.
  const [payFor, setPayFor] = useState<UpgradePlanKey | null>(null);

  // Back from Stripe's checkout through the browser's own cache: the page comes back as it was left — loading.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) setLoading(false); };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  async function upgrade(key: UpgradePlanKey, billingCycle: BillingCycle) {
    if (!currentOrg) return;
    setLoading(true);
    let result;
    try {
      result = await requestPlanUpgrade({
        planKey: key,
        billingCycle,
        orgSlug: currentOrg.slug,
        returnTo: getBillingHref(currentOrg, { host: 'admin' }),
      }, terms.send);
    } catch (err: unknown) {
      setLoading(false);
      setOutcome({ title: 'Something went wrong', message: err instanceof Error ? err.message : 'Something went wrong. Please try again.', type: 'danger' });
      return;
    }
    // The Terms window was closed: the panel is as it was.
    if ('closed' in result) { setLoading(false); return; }
    // GST/HST Stage 1: no billing address on file → the Billing address window, then the same upgrade again. Asked by the
    // server, not here.
    if ('addressRequired' in result) {
      setLoading(false);
      address.refused(() => setPayFor(key));
      return;
    }
    // Leaving for checkout: Upgrade stays busy while the page unloads, so a second press starts no second checkout.
    if (!result.applied) {
      window.location.assign(result.url);
      return;
    }
    // The plan IS applied — say so whatever the re-read below does; a failed re-read only leaves the page stale.
    setLoading(false);
    setOutcome({ title: 'Plan updated', message: planUpdatedMessage(key, result), type: 'success' });
    try {
      await Promise.all([refreshOrg(), refreshTournaments()]);
    } catch {
      // Nothing to tell: the change is saved, and the next load reads it.
    }
  }

  return (
    <>
      {/* The Billing address window takes the panel's place while it is open; Cancel brings the panel back. */}
      {address.dialog}
      <PlanArticlePanel
        planKey={outcome || address.open || payFor ? null : plan}
        onClose={onClose}
        onUpgrade={key => { if (key !== 'team') address.ensure(() => setPayFor(key)); }}
        upgradeLoading={loading ? plan : null}
        isComingSoon={gating ? gating[plan] : isEffectivelyGated(plan)}
        // Only the owner may change the plan (the server's 'billing' capability): anyone else reads what the plan
        // includes, with no Upgrade that would only be refused.
        canUpgrade={hasBillingAccess(userRole, userCapabilities) && (upgradePlansFor(ownPlan, givenPlan) as PanelPlanKey[]).includes(plan)}
      />
      {payFor && currentOrg && <PlanCycleDialog orgSlug={currentOrg.slug} planKey={payFor} savings={formatAnnualSavings(payFor)} initial="monthly"
        billedTo={address.location ? formatBilledTo(address.location) : null}
        onChangeAddress={() => { const key = payFor; setPayFor(null); address.edit(() => setPayFor(key)); }}
        onClose={() => setPayFor(null)} onContinue={cycle => { const key = payFor; setPayFor(null); void upgrade(key, cycle); }} />}
      {terms.window}
      {outcome?.type === 'success' && (
        <NoticePill message={outcome.message} onDone={onClose} news />
      )}
      {outcome?.type === 'danger' && (
        <KitDialog
          kind="question"
          title={outcome.title}
          onClose={onClose}
          openOn="panel"
          footer={<button type="button" className="btn btn-outline" onClick={onClose}>Close</button>}
        >
          <p>{outcome.message}</p>
        </KitDialog>
      )}
    </>
  );
}
