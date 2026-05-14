'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from '../auth.module.css';

function SignupConfirmInner() {
  const searchParams = useSearchParams();
  const link = searchParams.get('link');

  if (!link) {
    return (
      <>
        <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: '#f87171', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          This verification link is invalid. Return to sign up and request a new one.
        </p>
        <div className={styles.footer}>
          <p className={styles.footerText}>
            <Link href="/auth/signup" className={styles.footerLink}>Create account</Link>
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: 'var(--fl-text)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
        Click below to verify your email and continue setting up your organization.
      </p>
      <button
        className={styles.submitBtn}
        onClick={() => { window.location.href = link; }}
      >
        Verify Email
      </button>
      <div className={styles.footer}>
        <p className={styles.footerText}>
          Already verified?{' '}
          <Link href="/auth/login" className={styles.footerLink}>Sign in</Link>
        </p>
      </div>
    </>
  );
}

export default function SignupConfirmPage() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1 className={styles.title}>Verify Email</h1>
          <p className={styles.sub}>FieldLogicHQ - Account Security</p>
        </div>
        <Suspense fallback={null}>
          <SignupConfirmInner />
        </Suspense>
      </div>
    </div>
  );
}
