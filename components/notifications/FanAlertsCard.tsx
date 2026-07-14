'use client';

/**
 * components/notifications/FanAlertsCard.tsx — the "Followed teams" card on the
 * unified notifications page (unified-app Phase 2 Slice 3). Fan alerts are
 * account-level and GLOBAL: two switches covering every followed team — no
 * per-team rows (explicitly deferred). Turning a switch ON also registers THIS
 * device for push in the same gesture (browsers require the permission prompt
 * inside a user gesture); if the device can't receive (blocked/unsupported),
 * the account preference still saves — other signed-in devices keep working —
 * and the card says so instead of silently failing.
 *
 * Card anatomy (header/badge/body) reuses the page's own card classes so the fan
 * card can never drift from its org/coach siblings; only the fan-specific bits
 * (badge tint, switch rows, notes) live in the local module.
 */

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { saveFanAlertPref } from '@/lib/fan-alert-prefs-client';
import type { FanAlertPrefs } from '@/lib/fan-alert-prefs';
import cardStyles from '@/app/(consumer)/account/notifications/AccountNotifications.module.css';
import tableStyles from './PreferencesTable.module.css';
import styles from './FanAlertsCard.module.css';

export interface FanCardData {
  teamCount: number;
  gameAlerts: boolean;
  eventNews: boolean;
  /** Names of followed events whose plan doesn't offer fan alerts (the honest gate). */
  noAlertEvents: string[];
}

const ROWS: { key: keyof FanAlertPrefs; label: string; blurb: string }[] = [
  { key: 'gameAlerts', label: 'Game alerts', blurb: 'Live scores and finals for your teams' },
  { key: 'eventNews', label: 'Event news', blurb: 'Announcements from their events' },
];

export default function FanAlertsCard({ data }: { data: FanCardData }) {
  const [prefs, setPrefs] = useState<FanAlertPrefs>({ gameAlerts: data.gameAlerts, eventNews: data.eventNews });
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(key: keyof FanAlertPrefs) {
    if (saving) return;
    const turningOn = !prefs[key];
    const prev = prefs;
    setPrefs({ ...prefs, [key]: turningOn });
    setSaving(true);
    setError(null);
    setNote(null);

    // Shared save: registers this device in the same gesture when turning ON;
    // a device failure is non-fatal here (the account pref still saves — other
    // signed-in devices keep working) and surfaces as a note instead.
    const result = await saveFanAlertPref(key, turningOn);
    if (result.ok) {
      if (result.deviceIssue) setNote(result.deviceIssue);
    } else {
      setPrefs(prev);
      setError(result.error ?? 'Couldn’t save that change — try again.');
    }
    setSaving(false);
  }

  return (
    <>
      <div className={cardStyles.cardHeader}>
        <div className={`${cardStyles.badge} ${styles.badgeFan}`} aria-hidden>★</div>
        <div className={cardStyles.cardHeaderText}>
          <div className={cardStyles.cardName}>Followed teams</div>
          <div className={cardStyles.cardKind}>
            {data.teamCount === 1 ? 'The team you follow' : `All ${data.teamCount} teams you follow`}, every event
          </div>
        </div>
        <span className={cardStyles.roleTag}>Fan</span>
      </div>
      <div className={cardStyles.cardBody}>
        {error && <div className={cardStyles.errorBanner}><AlertCircle size={14} />{error}</div>}
        {ROWS.map(row => (
          <div key={row.key} className={styles.row}>
            <div className={styles.rowText}>
              <div className={styles.rowLabel}>{row.label}</div>
              <div className={styles.rowBlurb}>{row.blurb}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs[row.key]}
              aria-label={row.label}
              disabled={saving}
              className={`${tableStyles.toggle} ${prefs[row.key] ? tableStyles.toggleOn : ''} ${saving ? tableStyles.toggleDisabled : ''}`}
              onClick={() => toggle(row.key)}
            />
          </div>
        ))}
        {note && <p className={styles.deviceNote}>{note}</p>}
        {data.noAlertEvents.length > 0 && (
          <p className={styles.gateNote}>
            <AlertCircle size={13} aria-hidden />
            <span>
              <strong>{data.noAlertEvents.join(', ')}</strong>
              {data.noAlertEvents.length === 1 ? ' doesn’t' : ' don’t'} offer alerts — following and
              live scores still work there.
            </span>
          </p>
        )}
        <p className={cardStyles.footNote}>
          Set once, works on every device you sign in on. Each device asks its own one-time
          &ldquo;allow notifications?&rdquo; permission.
        </p>
      </div>
    </>
  );
}
