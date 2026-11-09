'use client';
import { useState } from 'react';
import Link from 'next/link';
import warm from '@/components/consumer/warmTheme.module.css';
import styles from '../../family.module.css';
import { GUARDIAN_CONSENT_DRAFT_NOTICE, beforeYouJoinWords } from '@/lib/family-guardian-consent';

/**
 * The accept page's "Before you join" (interim, Stage 4a build Session 1 — Part 4 rebuilds the page to the drawing).
 *
 * Deliberately a BUTTON rather than an automatic acceptance on page load: the link arrives by email, and email scanners follow
 * URLs. Joining is a consequential act on a child's data and has to be a person choosing it. No age question (ruling 12).
 */
export default function ClaimClient({ token, open, clubName, childNames }: {
  token: string; open: boolean; clubName: string | null; childNames: string[];
}) {
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardianBox, setGuardianBox] = useState(false);
  const [consentBox, setConsentBox] = useState(false);

  const shell = (inner: React.ReactNode) => (
    <div className={warm.warm}>
      <div className={styles.page}>
        <div className={styles.card}>{inner}</div>
      </div>
    </div>
  );

  if (!open || !clubName || childNames.length === 0) {
    return shell(<h1 className={styles.joinTitle}>This invitation no longer works</h1>);
  }
  const W = beforeYouJoinWords(clubName, childNames);

  async function join() {
    if (busy || !guardianBox || !consentBox) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/family/claim/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guardianBox, consentBox }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        window.location.href = `/auth/login?next=${encodeURIComponent(`/family/claim/${token}`)}`;
        return;
      }
      if (!res.ok) throw new Error(data.error === 'another_email' ? 'This invitation is for another email.' : 'This invitation no longer works.');
      setJoined(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This invitation no longer works.');
    } finally {
      setBusy(false);
    }
  }

  if (joined) {
    return shell(<>
      <h1 className={styles.joinTitle}>You’ve joined</h1>
      <div className={styles.actions}>
        <Link href="/following" className={styles.chip}>Open</Link>
      </div>
    </>);
  }

  return shell(<>
    <h1 className={styles.joinTitle}>{W.pageTitle}</h1>
    <p className={styles.placeholderNote}>{GUARDIAN_CONSENT_DRAFT_NOTICE}</p>
    <h2 className={styles.fieldLabel}>{W.title}</h2>
    <p className={styles.joinLede}>{W.intro}</p>
    <p className={styles.fieldLabel}>{W.whoTitle}</p>
    <ul>
      <li>{W.who.you}</li>
      <li>{W.who.staff}</li>
      <li>{W.who.others}</li>
      <li>{W.who.us}</li>
    </ul>
    <p className={styles.joinLede}>{W.choice}</p>
    <label className={styles.check}>
      <input type="checkbox" checked={guardianBox} onChange={e => setGuardianBox(e.target.checked)} />
      <span>{W.guardianBox} <strong>Required</strong></span>
    </label>
    <label className={styles.check}>
      <input type="checkbox" checked={consentBox} onChange={e => setConsentBox(e.target.checked)} />
      <span>{W.consentBox} <strong>Required</strong></span>
    </label>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.actions}>
      <button type="button" className={styles.chip} onClick={join} disabled={busy || !guardianBox || !consentBox}>
        {busy ? 'Joining…' : W.button}
      </button>
    </div>
  </>);
}
