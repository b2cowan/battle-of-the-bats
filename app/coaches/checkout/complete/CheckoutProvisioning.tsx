'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoachWelcomeCard, WaitLine } from '@/components/consumer/CoachWelcomeCard';
import { accountForm } from '@/components/auth/AccountForm';

// The workspace is provisioned asynchronously by the Stripe webhook, so it may not exist the
// instant the buyer lands here. Re-check on a short interval; the server page turns this card into
// the welcome the moment it's ready — no manual refresh, and no "back to pricing" dead-end.
const POLL_MS = 2500;
const MAX_ATTEMPTS = 20; // ~50s before offering a manual retry

/**
 * Paid, portal not made yet (The first look G2, 2026-10-20): "Setting up your portal" with the one loading line and no
 * button, then, after the poll gives up, "Still setting up your portal" with Check again (which restarts it). The email
 * is real: the webhook sends the welcome, with the portal link, the moment the portal is made (lib/team-checkout.ts).
 */
export default function CheckoutProvisioning() {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const timedOut = attempts >= MAX_ATTEMPTS;

  useEffect(() => {
    if (timedOut) return;
    const id = setTimeout(() => {
      setAttempts(a => a + 1);
      router.refresh();
    }, POLL_MS);
    return () => clearTimeout(id);
  }, [attempts, timedOut, router]);

  if (timedOut) {
    return (
      <CoachWelcomeCard
        icon="clock"
        title="Still setting up your portal"
        sub="Payment received. We'll email you a link the moment it's ready, so you can close this page."
      >
        <button type="button" className={accountForm.primary} onClick={() => { setAttempts(0); router.refresh(); }}>
          Check again
        </button>
      </CoachWelcomeCard>
    );
  }
  return (
    <CoachWelcomeCard title="Setting up your portal">
      <WaitLine>Payment received. This takes a few seconds.</WaitLine>
    </CoachWelcomeCard>
  );
}
