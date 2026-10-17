'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { formatTime } from '@/lib/utils';
import styles from './VerifyEmailSent.module.css';

/** How long the resend button stays away after a send (the server allows a few an hour per address). */
const RESEND_COOLDOWN_MS = 60_000;

/**
 * Ask for a fresh verification link. The server sends only to an account still waiting for its email and answers the
 * same either way. The one client request shape — this block's button and the register form's waiting-account paths.
 */
export function requestVerificationLink(p: { email: string; next: string; continueName?: string }): Promise<Response> {
  return fetch('/api/auth/resend-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p),
  });
}

/**
 * THE CHECK-YOUR-EMAIL BLOCK — every sign-up that verifies by link shows it after the form (owner ruling 2026-10-16,
 * "verify every sign-up"; drawings on SIGNUP_EMAIL_VERIFICATION_HUB.html). The org sign-up's own words, a statement
 * of where the email went, "Send the link again" (V3), and the two ways out.
 *
 * `tone` picks the host's own ground: the /start forms, the sign-in card, or the event's public Register page.
 */
export default function VerifyEmailSent(props: {
  tone: 'start' | 'auth' | 'register';
  email: string;
  lead: ReactNode;
  after?: ReactNode;
  /** Where the resent link returns to (the same place the first link does), and the name it continues. */
  resendNext: string;
  continueName?: string;
  /** "Use a different email": back to the form with its entries kept. Absent where the email is fixed. */
  onChangeEmail?: () => void;
  /** "Already verified? Sign in". */
  signInHref?: string;
}) {
  const { tone, email, lead, after, resendNext, continueName, onChangeEmail, signInHref } = props;
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState<Date | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sentAt) return;
    const t = window.setTimeout(() => setSentAt(null), RESEND_COOLDOWN_MS);
    return () => window.clearTimeout(t);
  }, [sentAt]);

  async function resend() {
    setBusy(true);
    setError('');
    try {
      const res = await requestVerificationLink({ email, next: resendNext, continueName });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setError(data.error ?? 'We couldn’t send the link just now. Please try again.');
        return;
      }
      setSentAt(new Date());
    } catch {
      setError('We couldn’t send the link just now. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const clock = sentAt
    ? formatTime(`${String(sentAt.getHours()).padStart(2, '0')}:${String(sentAt.getMinutes()).padStart(2, '0')}`)
    : '';

  return (
    <div className={`${styles.root} ${styles[tone]}`}>
      <p className={styles.lead}>{lead}</p>
      <p className={styles.sent} role="status">Verification email sent to {email}.</p>
      {after && <p className={styles.after}>{after}</p>}
      {sentAt ? (
        <p className={styles.sentAgain} role="status">Sent again at {clock}. Check your spam folder too.</p>
      ) : (
        <button type="button" className={styles.resend} onClick={resend} disabled={busy}>
          {busy ? 'Sending…' : 'Send the link again'}
        </button>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {(onChangeEmail || signInHref) && (
        <div className={styles.foot}>
          {onChangeEmail ? <button type="button" className={styles.footLink} onClick={onChangeEmail}>Use a different email</button> : <span />}
          {signInHref && <span>Already verified? <Link href={signInHref} className={styles.footLink}>Sign in</Link></span>}
        </div>
      )}
    </div>
  );
}
