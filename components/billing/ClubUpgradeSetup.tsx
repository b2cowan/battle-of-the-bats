'use client';

import { useEffect, useState } from 'react';
import { Mail, RefreshCw } from 'lucide-react';
import { CoachCard } from '@/components/coaches/kit';
import LoadingState from '@/components/shared/LoadingState';
import { PLAN_BILLING_WORDS as W } from '@/lib/plan-billing-words';
import { clubHomeAfterUpgradePath, type ClubUpgradeState } from '@/lib/workspace-upgrade';
import { CONTACT_HREF } from './PlanMoveDialog';
import styles from './Billing.module.css';

const POLL_MS = 2500;
const MAX_ATTEMPTS = 20;

/** Only status reads mount here: a slow or failed check never exposes another payment. */
export default function ClubUpgradeSetup({ orgSlug }: { orgSlug: string }) {
  const [state, setState] = useState<'setting' | 'longer' | 'unconfirmed'>('setting');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    let attempts = 0;
    let failures = 0;
    async function check() {
      try {
        const response = await fetch(`/api/billing/club-upgrade-status?orgSlug=${encodeURIComponent(orgSlug)}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Status unavailable');
        const status = await response.json() as ClubUpgradeState;
        if (typeof status.becameClub !== 'boolean' || typeof status.waitingOnPayment !== 'boolean') throw new Error('Invalid status');
        if (controller.signal.aborted) return;
        failures = 0;
        if (status.becameClub) {
          // Both server layouts seed OrgProvider once. A full request mounts the club identity and its menu afresh.
          window.location.replace(clubHomeAfterUpgradePath(orgSlug));
          return;
        }
        // Neither not-ready combination proves payment failure. Both use the same drawn slow state.
        if (++attempts >= MAX_ATTEMPTS) { setState('longer'); return; }
        timer = window.setTimeout(() => void check(), POLL_MS);
      } catch {
        if (controller.signal.aborted) return;
        // One failed read is a blip, not an answer: the flip may land on the next tick. Three in a row is "couldn't confirm".
        if (++failures >= 3) { setState('unconfirmed'); return; }
        timer = window.setTimeout(() => void check(), POLL_MS);
      }
    }
    timer = window.setTimeout(() => void check(), POLL_MS);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [orgSlug, retry]);

  const copy = {
    setting: { title: W.clubUpgrade.settingTitle, body: W.clubUpgrade.settingBody },
    longer: { title: W.clubUpgrade.longerTitle, body: W.clubUpgrade.longerBody },
    unconfirmed: { title: W.clubUpgrade.unconfirmedTitle, body: W.clubUpgrade.unconfirmedBody },
  }[state];
  // One of the two actions leads (lime, with its words); the other is a symbol on a phone and words on a computer.
  const retryLeads = state === 'longer';
  return <div className={styles.body}><CoachCard className={styles.setupCard}>
    <h2 className={styles.sectionTitle}>{copy.title}</h2>
    <p className={styles.hint}>{copy.body}</p>
    {state === 'setting' ? <LoadingState inline label={W.clubUpgrade.settingLoading} /> : <div className={styles.planActions}>
      <button type="button" aria-label={W.clubUpgrade.checkAgain} className={`btn ${retryLeads ? 'btn-lime' : `btn-outline ${styles.symbolAction}`}`} onClick={() => { setState('setting'); setRetry(n => n + 1); }}>{!retryLeads && <RefreshCw size={16} aria-hidden className={styles.phoneIcon} />}<span className={retryLeads ? undefined : styles.desktopText}>{W.clubUpgrade.checkAgain}</span></button>
      <a href={CONTACT_HREF} aria-label={W.change.contact} className={`btn ${retryLeads ? `btn-outline ${styles.symbolAction}` : 'btn-lime'}`}>{retryLeads && <Mail size={16} aria-hidden className={styles.phoneIcon} />}<span className={retryLeads ? styles.desktopText : undefined}>{W.change.contact}</span></a>
    </div>}
  </CoachCard></div>;
}
