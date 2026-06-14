'use client';

import { useState } from 'react';
import { Check, Send } from 'lucide-react';
import styles from './CoachStartInterest.module.css';

/**
 * Express-interest capture for the GATED /coaches/start (free-tier Coaches Phase 5m, J5-051).
 *
 * Coaches Portal Premium self-serve checkout isn't open yet (the `team` plan is gated). Instead of
 * a disabled checkout form (a dead-end), the gated state captures a real lead via the shared
 * `/api/early-access` endpoint (featuresInterested: ['coach_portal']) — the single repaired
 * destination all "express interest" labels point to (hub card, afterglow, results email). Works
 * signed-out; prefilled from the session when signed in. Never a purchase.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  defaultName?: string;
  defaultEmail?: string;
};

export default function CoachStartInterest({ defaultName = '', defaultEmail = '' }: Props) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [orgName, setOrgName] = useState('');
  const [notes, setNotes] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — real users never see this
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const canSubmit =
    !busy && name.trim().length > 0 && EMAIL_RE.test(email.trim().toLowerCase()) && orgName.trim().length > 0;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/early-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          organizationName: orgName.trim(),
          notes: notes.trim() || undefined,
          featuresInterested: ['coach_portal'],
          sourcePath: '/coaches/start',
          website, // honeypot
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Could not save your interest.');
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your interest.');
    } finally {
      setBusy(false);
    }
  }

  if (saved) {
    return (
      <div className={styles.wrap}>
        <div className={styles.card}>
          <div className={styles.savedIcon}><Check size={22} aria-hidden /></div>
          <h1 className={styles.title}>You&apos;re on the list</h1>
          <p className={styles.lead}>
            Thanks — we&apos;ll reach out when self-serve Coaches Portal Premium opens. Your free Coaches
            Portal (roster, schedule, and team comms) stays available in the meantime.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Coaches Portal Premium</h1>
        <p className={styles.lead}>
          Self-serve signup isn&apos;t open yet. Tell us you&apos;re interested and we&apos;ll be in touch — no
          commitment, and your free Coaches Portal stays free.
        </p>

        <label className={styles.field}>
          <span className={styles.label}>Your name</span>
          <input className={styles.input} type="text" value={name} maxLength={120} onChange={e => { setName(e.target.value); setSaved(false); }} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Email</span>
          <input className={styles.input} type="email" inputMode="email" autoComplete="email" value={email} onChange={e => { setEmail(e.target.value); setSaved(false); }} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Team or club name</span>
          <input className={styles.input} type="text" value={orgName} maxLength={160} onChange={e => setOrgName(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>What would help your team? <span className={styles.optional}>(optional)</span></span>
          <textarea className={styles.textarea} rows={3} value={notes} maxLength={1200} onChange={e => setNotes(e.target.value)} placeholder="e.g. lineups, dues tracking, documents…" />
        </label>

        {/* Honeypot: visually hidden, off-screen; bots fill it, humans don't. */}
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={website}
          onChange={e => setWebsite(e.target.value)}
          className={styles.honeypot}
        />

        {error && <p className={styles.error} role="alert">{error}</p>}

        <button type="button" className={styles.button} onClick={submit} disabled={!canSubmit}>
          <Send size={15} aria-hidden /> {busy ? 'Saving…' : 'Express interest'}
        </button>
      </div>
    </div>
  );
}
