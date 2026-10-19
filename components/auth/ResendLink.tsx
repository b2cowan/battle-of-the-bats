'use client';
import { useEffect, useState } from 'react';
import { formatTime } from '@/lib/utils';

/** How long the resend button stays away after a send (the server allows a few an hour per address). */
const RESEND_COOLDOWN_MS = 60_000;

/**
 * Ask for a fresh verification link. The server sends only to an account still waiting for its email and answers the
 * same either way. The one client request shape — "Send the link again" below and the register form's waiting-account
 * paths.
 */
export function requestVerificationLink(p: { email: string; next?: string; continueName?: string }): Promise<Response> {
  return fetch('/api/auth/resend-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p),
  });
}

/**
 * "SEND THE LINK AGAIN" — the button, and the "Sent again at 2:14 p.m." sentence that stands in for it until another
 * send is allowed (absent beats disabled). The check-your-email block (V3, 2026-10-16) and sign-in's waiting-account
 * box (Account-First Sign-up A7, 2026-10-18) both render this one control, so the two never word or time a resend
 * differently; each host passes its own classes. Kept apart from the block so sign-in doesn't carry the block's styles.
 */
export default function ResendLink({ email, next, continueName, classes }: {
  email: string;
  /** Where the resent link returns to (the same place the first link does), and the name it continues. Omitted, the
   *  server picks: the account's start door, else Home. */
  next?: string;
  continueName?: string;
  classes: { button: string; sent: string; error: string };
}) {
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
      const res = await requestVerificationLink({ email, next, continueName });
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
    <>
      {sentAt ? (
        <p className={classes.sent} role="status">Sent again at {clock}. Check your spam folder too.</p>
      ) : (
        <button type="button" className={classes.button} onClick={resend} disabled={busy}>
          {busy ? 'Sending…' : 'Send the link again'}
        </button>
      )}
      {error && <p className={classes.error} role="alert">{error}</p>}
    </>
  );
}
