'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from '../auth.module.css';

function ResetConfirmInner() {
  const searchParams = useSearchParams();
  const link = searchParams.get('link');

  if (!link) {
    return (
      <>
        <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: '#f87171', lineHeight: 1.6, marginBottom: '1.5rem' }}>
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
        onClick={() => { window.location.href = link; }}
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
          <p className={styles.sub}>FieldLogicHQ — Tournament Management Platform</p>
        </div>
        <Suspense fallback={null}>
          <ResetConfirmInner />
        </Suspense>
      </div>
    </div>
  );
}
