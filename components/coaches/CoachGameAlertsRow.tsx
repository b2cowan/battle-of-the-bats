'use client';

import { useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { saveFanAlertPref } from '@/lib/fan-alert-prefs-client';
import { syncFollowToAccount } from '@/lib/follow';
import type { AlertRegistration } from '@/lib/coach-alert-registration';
import styles from './CoachGameAlertsRow.module.css';

interface Props {
  teamName: string;
  /**
   * The team's live/upcoming publicly-visible tournament registration — the games this alerts on.
   * Null → nothing to alert on, so no row. Shared type with the picker so the two can't drift.
   */
  registration: AlertRegistration | null;
  className?: string;
}

/**
 * CoachGameAlertsRow — the one-tap own-team game alerts affordance (N3b), relocated from the retired
 * public account sheet into the coach portal overview ("The Flip" P2, both tiers). For a coach whose
 * team is in a live/upcoming public tournament, one tap turns on account-level game alerts AND
 * registers THIS device for push (strictDevice — a device failure is a hard error, never a silent
 * account-only save), then mirrors the team onto the account's follows so the alert has a subject.
 * Mirrors the fan alert model exactly — no new plumbing. Self-gates on a live registration, so it
 * only appears when there's actually a game to be alerted about (same coverage the sheet row had).
 */
export default function CoachGameAlertsRow({ teamName, registration, className }: Props) {
  const [state, setState] = useState<'idle' | 'pending' | 'done'>('idle');
  const [msg, setMsg] = useState('');

  if (!registration) return null;

  async function enable() {
    if (state !== 'idle') return;
    setState('pending');
    setMsg('');
    const result = await saveFanAlertPref('gameAlerts', true, { strictDevice: true });
    if (!result.ok) {
      setMsg(result.error ?? 'Could not turn on alerts.');
      setState('idle');
      return;
    }
    // Alerts are on; the shared account follow mirror is best-effort + idempotent.
    syncFollowToAccount('follow', {
      teamId: registration!.registrationId,
      orgSlug: registration!.orgSlug,
      tournamentSlug: registration!.tournamentSlug,
    });
    setState('done');
  }

  const done = state === 'done';
  return (
    <button
      type="button"
      className={`${styles.row} ${className ?? ''}`}
      data-done={done ? 'true' : undefined}
      onClick={enable}
      disabled={state !== 'idle'}
      aria-live="polite"
    >
      <span className={styles.icon}>
        {done ? <BellRing size={16} strokeWidth={1.8} aria-hidden /> : <Bell size={16} strokeWidth={1.8} aria-hidden />}
      </span>
      <span className={styles.text}>
        <span className={styles.label}>
          {done ? 'Alerts on for your team' : state === 'pending' ? 'Turning on…' : 'Get alerts for your team'}
        </span>
        <span className={msg && !done ? `${styles.sub} ${styles.subError}` : styles.sub}>
          {done
            ? `A push hits this device when ${teamName}'s games go live`
            : msg || `Score alerts for ${teamName}'s tournament games — one tap`}
        </span>
      </span>
    </button>
  );
}
