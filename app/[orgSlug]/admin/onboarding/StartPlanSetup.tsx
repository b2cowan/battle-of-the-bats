'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CoachWelcomeCard, WaitLine } from '@/components/consumer/CoachWelcomeCard';
import { accountForm } from '@/components/auth/AccountForm';
import type { PaidDoor, StartPlanSetupState as SetupState } from '@/lib/start-door';
import styles from './PlanStep.module.css';

const POLL_MS = 2500;
const MAX_ATTEMPTS = 20; // ~50 s, then "Still setting up" with Check again (the Coaches Portal return's rule)

/**
 * "SETTING UP YOUR CLUB" (On-sale pages S2, trap A; drawing tab 6 "Back from payment", the shipped checkout-complete
 * card). Stripe sends a paid door's buyer back before its webhook has written the plan, so the organization still reads
 * Tournament for a few seconds; this card holds them until it lands, then opens the setup with a full request (the
 * admin's layouts seed the organization once, so a soft navigation would keep the old plan in memory). No button while
 * it waits; after ~50 s "Still setting up" with Check again; a page with no completed checkout of this organization says
 * "We can't find that payment" at once, never after the wait.
 */
export default function StartPlanSetup({ orgSlug, sessionId, door }: { orgSlug: string; sessionId: string | null; door: PaidDoor }) {
  // 'checking' until the first answer: a page with no payment behind it must never say "Payment received", even briefly
  // (the dev walk saw it for ~0.5 s before "We can't find that payment").
  const [state, setState] = useState<'checking' | 'setting' | 'longer' | 'no_payment'>(sessionId ? 'checking' : 'no_payment');
  const [retry, setRetry] = useState(0);
  const word = door === 'club' ? 'club' : 'league';

  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    let timer: number | undefined;
    let attempts = 0;
    async function check() {
      try {
        const res = await fetch(
          `/api/billing/start-plan?orgSlug=${encodeURIComponent(orgSlug)}&session_id=${encodeURIComponent(sessionId!)}`,
          { cache: 'no-store', signal: controller.signal },
        );
        // Signed out or not this organization's owner: the page cannot see the payment, so it never claims one (/review).
        if (res.status === 401 || res.status === 403) { setState('no_payment'); return; }
        const data = res.ok ? await res.json() as { state?: SetupState } : null;
        if (controller.signal.aborted) return;
        if (data?.state === 'ready') {
          window.location.replace(`/${orgSlug}/admin/onboarding`);
          return;
        }
        if (data?.state === 'no_payment') { setState('no_payment'); return; }
        setState(current => (current === 'checking' ? 'setting' : current));
      } catch {
        if (controller.signal.aborted) return;
        // A failed read is not an answer: keep waiting, inside the same ~50 s.
      }
      if (++attempts >= MAX_ATTEMPTS) { setState('longer'); return; }
      timer = window.setTimeout(() => void check(), POLL_MS);
    }
    void check();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [orgSlug, sessionId, retry]);

  if (state === 'no_payment') {
    return (
      <CoachWelcomeCard
        pageClassName={styles.page}
        icon="search"
        quiet
        title="We can’t find that payment"
        sub={`If you’ve just paid, your ${word} is being set up. Otherwise, choose a plan to finish starting it.`}
      >
        <Link href={`/${orgSlug}/admin/onboarding?choosePlan=1`} className={accountForm.primary}>Choose a plan</Link>
      </CoachWelcomeCard>
    );
  }
  if (state === 'longer') {
    return (
      <CoachWelcomeCard
        pageClassName={styles.page}
        icon="clock"
        title={`Still setting up your ${word}`}
        sub="Payment received. Please don’t start another payment. Check again in a minute."
      >
        <button type="button" className={accountForm.primary} onClick={() => { setState('setting'); setRetry(n => n + 1); }}>
          Check again
        </button>
      </CoachWelcomeCard>
    );
  }
  // The first answer comes in about a second; until then the heading alone, never the payment claim.
  return (
    <CoachWelcomeCard pageClassName={styles.page} title={`Setting up your ${word}`}>
      {state === 'setting' && <WaitLine>Payment received. This takes a few seconds.</WaitLine>}
    </CoachWelcomeCard>
  );
}
