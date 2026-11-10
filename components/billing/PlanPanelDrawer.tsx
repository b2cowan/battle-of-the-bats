'use client';
/**
 * The plan's panel opened over a page by a plan lock, and what its Upgrade came to — loaded only once a lock is clicked
 * (`PlanPanelHost` mounts it; nothing here ships with an admin page that never shows one).
 *
 * Its Upgrade is Plan & billing's (`requestPlanUpgrade`): Founding Season applies the plan at once — the org and its
 * tournaments re-read, the page under the drawer unlocks in place, "Plan updated" says so — and a paid upgrade leaves
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
import { planUpdatedMessage, requestPlanUpgrade, upgradePlansFor, type PanelPlanKey } from '@/lib/plan-upgrade';
import { ownPlanOf } from '@/lib/free-time';
import KitDialog from '@/components/shared/KitDialog';
import { NoticePill } from '@/components/admin/kit/club/RepKit';
import PlanArticlePanel from './PlanArticlePanel';
import { useBillingAddressGate } from './BillingAddressDialog';
import { useTermsGate } from '@/components/legal/TermsAcceptWindow';

type Outcome = { title: string; message: string; type: 'success' | 'danger' };

export default function PlanPanelDrawer({ plan, onClose }: { plan: PanelPlanKey; onClose: () => void }) {
  const { currentOrg, userRole, userCapabilities, refresh: refreshOrg } = useOrg();
  const { refresh: refreshTournaments } = useTournament();
  const gating = usePlanGating();
  const [loading, setLoading] = useState(false);
  // Once the Upgrade answers, the panel gives way to what it came to; closing that closes the whole thing.
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const address = useBillingAddressGate(currentOrg ? { orgSlug: currentOrg.slug } : null);
  // A stop on the Terms opens their window over the panel; after the tick the upgrade carries on (step 6.3, C3).
  const terms = useTermsGate();

  // Back from Stripe's checkout through the browser's own cache: the page comes back as it was left — loading.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) setLoading(false); };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  async function upgrade(key: PanelPlanKey) {
    if (!currentOrg || key === 'team') return;
    setLoading(true);
    let result;
    try {
      result = await requestPlanUpgrade({
        planKey: key,
        billingCycle: 'monthly',
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
    // server, not here: a comped Founding upgrade charges nothing and is never asked.
    if ('addressRequired' in result) {
      setLoading(false);
      address.refused(() => void upgrade(key));
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
        planKey={outcome || address.open ? null : plan}
        billingCycle="monthly"
        onClose={onClose}
        onUpgrade={key => { void upgrade(key); }}
        upgradeLoading={loading ? plan : null}
        isComingSoon={gating ? gating[plan] : isEffectivelyGated(plan)}
        // Only the owner may change the plan (the server's 'billing' capability): anyone else reads what the plan
        // includes, with no Upgrade that would only be refused.
        canUpgrade={hasBillingAccess(userRole, userCapabilities) && (upgradePlansFor(currentOrg ? ownPlanOf(currentOrg) : undefined) as PanelPlanKey[]).includes(plan)}
      />
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
