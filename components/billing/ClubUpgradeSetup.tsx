'use client';

import { useEffect, useState } from 'react';
import { Mail, RefreshCw } from 'lucide-react';
import { CoachCard } from '@/components/coaches/kit';
import LoadingState from '@/components/shared/LoadingState';
import { PLAN_BILLING_WORDS as W } from '@/lib/plan-billing-words';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { clubHomeAfterUpgradePath, type ClubUpgradeState } from '@/lib/workspace-upgrade';
import type { StartPlanSetupState } from '@/lib/start-door';
import type { OrgPlan } from '@/lib/types';
import { CONTACT_HREF } from './PlanMoveDialog';
import styles from './Billing.module.css';

const POLL_MS = 2500;
const MAX_ATTEMPTS = 20;

type SetupState = 'setting' | 'longer' | 'unconfirmed';
type SetupCopy = Record<SetupState, { title: string; body: string }>;

/** The drawn wait card (Stage 4b; reused by On-sale pages S4): a spinner while setting up, then Check again and Contact us. */
function setupCard({ state, copy, onRetry }: { state: SetupState; copy: SetupCopy; onRetry: () => void }) {
  // One of the two actions leads (lime, with its words); the other is a symbol on a phone and words on a computer.
  const retryLeads = state === 'longer';
  return <div className={styles.body}><CoachCard className={styles.setupCard}>
    <h2 className={styles.sectionTitle}>{copy[state].title}</h2>
    <p className={styles.hint}>{copy[state].body}</p>
    {state === 'setting' ? <LoadingState inline label={W.clubUpgrade.settingLoading} /> : <div className={styles.planActions}>
      <button type="button" aria-label={W.clubUpgrade.checkAgain} className={`btn ${retryLeads ? 'btn-lime' : `btn-outline ${styles.symbolAction}`}`} onClick={onRetry}>{!retryLeads && <RefreshCw size={16} aria-hidden className={styles.phoneIcon} />}<span className={retryLeads ? undefined : styles.desktopText}>{W.clubUpgrade.checkAgain}</span></button>
      <a href={CONTACT_HREF} aria-label={W.change.contact} className={`btn ${retryLeads ? `btn-outline ${styles.symbolAction}` : 'btn-lime'}`}>{retryLeads && <Mail size={16} aria-hidden className={styles.phoneIcon} />}<span className={retryLeads ? styles.desktopText : undefined}>{W.change.contact}</span></a>
    </div>}
  </CoachCard></div>;
}

/**
 * Poll `read` until it answers ready or not-ready-for-good. Neither not-ready answer proves a payment failed, so ~50 s of
 * waiting is "taking longer"; three failed reads in a row is "couldn't confirm". `read` resolves true (done), false (keep
 * waiting) or throws (a failed read).
 */
function useSetupPoll(read: (signal: AbortSignal) => Promise<boolean>, key: string): [SetupState, () => void] {
  const [state, setState] = useState<SetupState>('setting');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    let attempts = 0;
    let failures = 0;
    async function check() {
      try {
        const done = await read(controller.signal);
        if (controller.signal.aborted || done) return;
        failures = 0;
        if (++attempts >= MAX_ATTEMPTS) { setState('longer'); return; }
        timer = window.setTimeout(() => void check(), POLL_MS);
      } catch {
        if (controller.signal.aborted) return;
        // One failed read is a blip, not an answer: the plan may land on the next tick. Three in a row is "couldn't confirm".
        if (++failures >= 3) { setState('unconfirmed'); return; }
        timer = window.setTimeout(() => void check(), POLL_MS);
      }
    }
    timer = window.setTimeout(() => void check(), POLL_MS);
    return () => { controller.abort(); window.clearTimeout(timer); };
    // `read` is rebuilt each render; the poll restarts on its key and on Check again only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, retry]);
  return [state, () => { setState('setting'); setRetry(n => n + 1); }];
}

/** Only status reads mount here: a slow or failed check never exposes another payment. */
export default function ClubUpgradeSetup({ orgSlug }: { orgSlug: string }) {
  const [state, retry] = useSetupPoll(async signal => {
    const response = await fetch(`/api/billing/club-upgrade-status?orgSlug=${encodeURIComponent(orgSlug)}`, { cache: 'no-store', signal });
    if (!response.ok) throw new Error('Status unavailable');
    const status = await response.json() as ClubUpgradeState;
    if (typeof status.becameClub !== 'boolean' || typeof status.waitingOnPayment !== 'boolean') throw new Error('Invalid status');
    if (status.becameClub && !signal.aborted) {
      // Both server layouts seed OrgProvider once. A full request mounts the club identity and its menu afresh.
      window.location.replace(clubHomeAfterUpgradePath(orgSlug));
      return true;
    }
    return false;
  }, orgSlug);
  return setupCard({ state, onRetry: retry, copy: {
    setting: { title: W.clubUpgrade.settingTitle, body: W.clubUpgrade.settingBody },
    longer: { title: W.clubUpgrade.longerTitle, body: W.clubUpgrade.longerBody },
    unconfirmed: { title: W.clubUpgrade.unconfirmedTitle, body: W.clubUpgrade.unconfirmedBody },
  } });
}

/**
 * "SETTING UP {PLAN}" ON PLAN & BILLING (On-sale pages S4, drawing tab 3; trap A for an organization that is not a door's).
 * An existing organization's start of League Plus, Club or Club · Association comes back from Stripe before the webhook has
 * written the plan; this holds Plan & billing — no rows, so no second payment — until it lands, then opens the new
 * workspace with a full request (the admin layouts seed the organization once). With Stripe's session it asks about that
 * checkout; without one (a second press was refused while the first lands) it asks whether a payment is still landing.
 * `onNothing` runs when there is no payment behind the page: the caller shows Plan & billing as it is.
 */
export function BillingStartSetup({ orgSlug, orgName, plan, sessionId, onNothing }: {
  orgSlug: string; orgName: string; plan: OrgPlan; sessionId: string | null; onNothing: () => void;
}) {
  const label = PLAN_CONFIG[plan].label;
  const query = sessionId ? `session_id=${encodeURIComponent(sessionId)}` : 'landing=1';
  const [state, retry] = useSetupPoll(async signal => {
    const response = await fetch(`/api/billing/start-plan?orgSlug=${encodeURIComponent(orgSlug)}&${query}`, { cache: 'no-store', signal });
    if (!response.ok) throw new Error('Status unavailable');
    const data = await response.json() as { state?: StartPlanSetupState };
    if (signal.aborted) return true;
    if (data.state === 'ready') { window.location.replace(`/${orgSlug}/admin`); return true; }
    if (data.state === 'no_payment') { onNothing(); return true; }
    if (data.state !== 'setting_up') throw new Error('Invalid status');
    return false;
  }, `${orgSlug}:${query}`);
  return setupCard({ state, onRetry: retry, copy: {
    setting: { title: W.clubUpgrade.startSettingTitle(label), body: W.clubUpgrade.startSettingBody(label, orgName) },
    longer: { title: W.clubUpgrade.longerTitle, body: W.clubUpgrade.startLongerBody(label) },
    unconfirmed: { title: W.clubUpgrade.startUnconfirmedTitle(label), body: W.clubUpgrade.unconfirmedBody },
  } });
}
