'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { RESET_RETURN_KEY, registrationReturnPath, stampResetReturn } from '@/lib/consumer-routes';
import styles from '../auth.module.css';

/**
 * The emailed `link` is followed only when it is the auth provider's own verify link — same origin as
 * the project's Supabase URL, over https (http only for a local project). This page navigates to it on
 * a branded "Set New Password" button, so an unchecked value let a crafted URL run `javascript:` on our
 * origin or send a coach to a look-alike page (/review 2026-10-14; the check was missing since the page
 * was written). Anything else reads as an invalid link.
 */
function authActionLink(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const provider = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.origin !== provider.origin) return null;
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function ResetConfirmInner() {
  const searchParams = useSearchParams();
  const link = authActionLink(searchParams.get('link'));
  // A reset started from a registration form returns there (Register Your Existing Team, Stage 1).
  const returnTo = registrationReturnPath(searchParams.get('next'));

  if (!link) {
    return (
      <>
        <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: 'var(--danger-light)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          This link is invalid. Request a new one below.
        </p>
        <div className={styles.footer}>
          <p className={styles.footerText}>
            <Link href="/auth/forgot-password" className={styles.footerLink}>Request a new reset link</Link>
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: 'var(--fl-text)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
        Click the button below to set a new password for your FieldLogicHQ account.
      </p>
      {/* onClick-only navigation — no href — prevents email scanners from pre-consuming the one-time Supabase token */}
      <button
        className={styles.submitBtn}
        onClick={() => {
          // Noted in THIS tab before the hop: the auth provider sends the browser back to the
          // set-a-new-password page in the same tab, which reads it after the reset.
          try {
            if (returnTo) sessionStorage.setItem(RESET_RETURN_KEY, stampResetReturn(returnTo));
            else sessionStorage.removeItem(RESET_RETURN_KEY);
          } catch { /* storage blocked — the reset still works, it lands as it always has */ }
          window.location.href = link;
        }}
      >
        Set New Password
      </button>
      <div className={styles.footer}>
        <p className={styles.footerText}>
          <Link href="/auth/forgot-password" className={styles.footerLink}>Request a new link</Link>
        </p>
      </div>
    </>
  );
}

export default function ResetConfirmPage() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1 className={styles.title}>Reset Password</h1>
          {/* Brand canon: never "tournament management platform" (memory/project_brand_name). */}
          <p className={styles.sub}>FieldLogicHQ</p>
        </div>
        <Suspense fallback={null}>
          <ResetConfirmInner />
        </Suspense>
      </div>
    </div>
  );
}
