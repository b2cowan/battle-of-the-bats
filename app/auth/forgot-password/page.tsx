'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import styles from '../auth.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/auth/reset-password`,
    });
    // Always show "check your email" — never reveal whether the account exists.
    setSubmitted(true);
    setLoading(false);
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 3H8L2 7h20l-6-4z" />
            </svg>
          </div>
          <h1 className={styles.title}>Reset Password</h1>
          <p className={styles.sub}>FieldLogicHQ — Tournament Management Platform</p>
        </div>

        {submitted ? (
          <>
            <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: 'var(--fl-text)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              If an account exists for <strong>{email}</strong>, you'll receive a password reset link shortly. Check your inbox (and spam folder).
            </p>
            <div className={styles.footer}>
              <p className={styles.footerText}>
                <Link href="/auth/login" className={styles.footerLink}>Back to Sign In</Link>
              </p>
            </div>
          </>
        ) : (
          <>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className="form-group">
                <label className="form-label" htmlFor="forgot-email">Email Address</label>
                <input
                  id="forgot-email"
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={loading}
              >
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>

            <div className={styles.footer}>
              <p className={styles.footerText}>
                Remembered it?{' '}
                <Link href="/auth/login" className={styles.footerLink}>Back to Sign In</Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
