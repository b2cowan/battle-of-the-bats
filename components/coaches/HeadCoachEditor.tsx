'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, UserCog } from 'lucide-react';
import styles from './HeadCoachEditor.module.css';

/**
 * Coaches Portal — head-coach + contact assignment (free-tier Phase 5l).
 *
 * Lets the registrant set/change the team's head-coach NAME and an OPTIONAL coach contact email
 * for this tournament, via `PATCH /api/coaches/tournaments/[teamId]` (sibling of the 5j roster API).
 *
 * Semantics (mirrors the API):
 *   • The NAME is required — the save button is disabled when it's empty (the API also rejects ''),
 *     because `teams.coach` is NOT NULL on prod and drives admin displays + email greetings.
 *   • The contact email is OPTIONAL. When set, coach-facing automatic emails (acceptance, payment,
 *     schedule updates) route to it; leaving it blank routes to the registration email. It NEVER
 *     overwrites the team's access/claim email.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  teamId: string;
  initialCoach: string;
  initialCoachEmail: string | null;
};

export default function HeadCoachEditor({ teamId, initialCoach, initialCoachEmail }: Props) {
  const router = useRouter();

  const [coach, setCoach] = useState(initialCoach ?? '');
  const [coachEmail, setCoachEmail] = useState(initialCoachEmail ?? '');
  // Baseline = the last persisted values; "dirty" is measured against it so we don't save no-ops.
  const [savedCoach, setSavedCoach] = useState(initialCoach ?? '');
  const [savedEmail, setSavedEmail] = useState(initialCoachEmail ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const trimmedName = coach.trim();
  const trimmedEmail = coachEmail.trim();
  const emailValid = trimmedEmail === '' || EMAIL_RE.test(trimmedEmail.toLowerCase());
  const dirty =
    trimmedName !== savedCoach.trim() ||
    trimmedEmail.toLowerCase() !== (savedEmail ?? '').trim().toLowerCase();
  const canSave = !saving && trimmedName.length > 0 && emailValid && dirty;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/coaches/tournaments/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coach: trimmedName, coachEmail: trimmedEmail || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Could not update the head coach.');
      setSavedCoach(trimmedName);
      setSavedEmail(trimmedEmail);
      setSaved(true);
      // Refresh the server-rendered displays (Registration Details "Coach" line, hero greeting).
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the head coach.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`card ${styles.card}`}>
      <div className={styles.head}>
        <UserCog size={16} aria-hidden />
        <p className={styles.intro}>
          Set who coaches this team for this event. The contact email is where acceptance, payment,
          and schedule updates are sent — leave it blank to use your registration email.
        </p>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>Head coach name</span>
        <input
          className={styles.input}
          type="text"
          value={coach}
          maxLength={120}
          placeholder="e.g. Jordan Lee"
          onChange={e => { setCoach(e.target.value); setSaved(false); }}
          aria-label="Head coach name"
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Coach contact email <span className={styles.optional}>(optional)</span></span>
        <input
          className={styles.input}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={coachEmail}
          placeholder="coach@example.com"
          onChange={e => { setCoachEmail(e.target.value); setSaved(false); }}
          aria-label="Coach contact email"
        />
      </label>

      {!emailValid && <p className={styles.hint}>Enter a valid email address, or leave it blank.</p>}
      {!trimmedName && <p className={styles.hint}>A head coach name is required.</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {saved && !error && <p className={styles.success}>Head coach updated.</p>}

      <button type="button" className={styles.saveBtn} onClick={save} disabled={!canSave}>
        <Check size={15} aria-hidden /> {saving ? 'Saving…' : 'Save head coach'}
      </button>
    </div>
  );
}
