'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// The workspace is provisioned asynchronously by the Stripe webhook, so it may not exist the
// instant the buyer lands here. Re-check on a short interval; the server page redirects into the
// portal the moment it's ready — no manual refresh, and no "back to pricing" dead-end.
const POLL_MS = 2500;
const MAX_ATTEMPTS = 20; // ~50s before offering a manual retry

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

  return (
    <main style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: '2rem' }}>
      <div style={{ maxWidth: 520 }}>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 800 }}>
          Coaches Portal checkout
        </p>
        <h1 style={{ fontSize: '2rem', margin: '0.35rem 0 0.75rem' }}>
          Payment received — setting up your portal
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.72)', lineHeight: 1.6 }} aria-live="polite">
          {timedOut
            ? 'Your payment went through and your portal is being set up. We’ll email you a link to it the moment it’s ready — so you can safely close this page — or check again here.'
            : 'Hang tight — we’re finishing your workspace and will take you straight in.'}
        </p>
        <div style={{ marginTop: '1.25rem', minHeight: 44, display: 'flex', alignItems: 'center' }}>
          {timedOut ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => { setAttempts(0); router.refresh(); }}
            >
              Check again
            </button>
          ) : (
            <Loader2
              size={26}
              aria-hidden
              style={{ color: 'var(--logic-lime)', animation: 'flhq-checkout-spin 0.9s linear infinite' }}
            />
          )}
        </div>
      </div>
      <style>{'@keyframes flhq-checkout-spin { to { transform: rotate(360deg); } }'}</style>
    </main>
  );
}
