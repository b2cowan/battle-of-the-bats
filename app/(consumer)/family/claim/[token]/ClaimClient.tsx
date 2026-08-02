'use client';
import { useState } from 'react';
import Link from 'next/link';
import warm from '@/components/consumer/warmTheme.module.css';
import styles from '../../family.module.css';
import {
  GUARDIAN_AGE_BAND_OPTIONS,
  GUARDIAN_CONSENT_DRAFT_NOTICE,
  GUARDIAN_CONSENT_LABELS,
  type GuardianAgeBand,
} from '@/lib/family-guardian-consent';

/**
 * Claiming a coach-sent guardian invite.
 *
 * Deliberately a BUTTON rather than an automatic claim on page load: the link arrives by
 * email, and email scanners follow URLs. A claim is a consequential act on a child's data and
 * has to be a person choosing it.
 */
export default function ClaimClient({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'verified' | 'pending_approval' | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Same consents and age band the request path asks for. The coach's invite is not the
  // parent's consent — only the person claiming can give that, and this is where they act.
  const [ageBand, setAgeBand] = useState<GuardianAgeBand | ''>('');
  const [consentData, setConsentData] = useState(false);
  const [consentGuardian, setConsentGuardian] = useState(false);

  const ready = !!ageBand && consentData && consentGuardian;

  async function claim() {
    if (busy || !ready) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/family/claim/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ageBand,
          consentDataCollection: consentData,
          consentGuardian: consentGuardian,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        window.location.href = `/auth/login?next=${encodeURIComponent(`/family/claim/${token}`)}`;
        return;
      }
      if (!res.ok) throw new Error(data.message ?? 'This invite can no longer be used.');
      setResult(data.status);
      setTeamId(data.repTeamId ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This invite can no longer be used.');
    } finally {
      setBusy(false);
    }
  }

  const shell = (inner: React.ReactNode) => (
    <div className={warm.warm}>
      <div className={styles.page}>
        <div className={styles.card}>{inner}</div>
      </div>
    </div>
  );

  if (result === 'verified') {
    return shell(<>
      <h1 className={styles.joinTitle}>You’re connected</h1>
      <p className={styles.joinLede}>Your player’s team is in your Following now.</p>
      <div className={styles.actions}>
        <Link href={teamId ? `/family/teams/${teamId}` : '/following'} className={styles.chip}>
          See the team
        </Link>
      </div>
    </>);
  }

  // The email did not match the address the coach invited — not a failure, just the coach's
  // eyes on it. Said plainly so nobody thinks something went wrong.
  if (result === 'pending_approval') {
    return shell(<>
      <h1 className={styles.joinTitle}>Sent to your coach</h1>
      <p className={styles.joinLede}>
        You signed in with a different email than the one your coach invited, so they’ll confirm
        it’s you. Nothing else is needed from you.
      </p>
      <div className={styles.actions}>
        <Link href="/following" className={styles.chip}>Go to Following</Link>
      </div>
    </>);
  }

  return shell(<>
    <h1 className={styles.joinTitle}>Connect to your player</h1>
    <p className={styles.joinLede}>
      Your coach invited you to follow your player’s team — their schedule, results and the
      coach’s updates.
    </p>
    <label className={styles.field}>
      <span className={styles.fieldLabel}>How old is your player?</span>
      <select
        className={styles.input}
        value={ageBand}
        onChange={e => setAgeBand(e.target.value as GuardianAgeBand)}
      >
        <option value="">Choose…</option>
        {GUARDIAN_AGE_BAND_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
      </select>
    </label>

    <p className={styles.placeholderNote}>{GUARDIAN_CONSENT_DRAFT_NOTICE}</p>
    <label className={styles.check}>
      <input type="checkbox" checked={consentData} onChange={e => setConsentData(e.target.checked)} />
      <span>{GUARDIAN_CONSENT_LABELS.dataCollection('your player’s club')} <strong>Required</strong></span>
    </label>
    <label className={styles.check}>
      <input type="checkbox" checked={consentGuardian} onChange={e => setConsentGuardian(e.target.checked)} />
      <span>{GUARDIAN_CONSENT_LABELS.guardian} <strong>Required</strong></span>
    </label>

    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.actions}>
      <button type="button" className={styles.chip} onClick={claim} disabled={busy || !ready}>
        {busy ? 'Connecting…' : 'Connect'}
      </button>
    </div>
  </>);
}
