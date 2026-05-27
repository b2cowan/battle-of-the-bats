'use client';
import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, AlertCircle } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { ALL_EVENT_TYPES, NOTIFICATION_EVENT_LABELS, NOTIFICATION_EVENT_DESCRIPTIONS } from '@/lib/notification-labels';
import type { NotificationEventType } from '@/lib/types';
import styles from './notifications.module.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TournamentPref {
  eventType: NotificationEventType;
  optedOut:  boolean;
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`${styles.toggle} ${checked ? styles.toggleOn : ''} ${disabled ? styles.toggleDisabled : ''}`}
      onClick={() => !disabled && onChange(!checked)}
    />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TournamentNotificationPreferencesPage() {
  const { currentTournament } = useTournament();
  const tournamentId = currentTournament?.id;

  // Map of eventType → optedOut
  const [prefs, setPrefs] = useState<Map<NotificationEventType, boolean>>(new Map());
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // ── Computed: are ALL event types opted out? → muted ───────────────────────

  const isMuted = ALL_EVENT_TYPES.every(et => prefs.get(et) === true);

  // ── Load preferences ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!tournamentId) return;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/tournaments/${tournamentId}/notification-preferences`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? `Server error ${res.status}`);
        }
        const { preferences } = await res.json() as { preferences: TournamentPref[] };

        const map = new Map<NotificationEventType, boolean>();
        for (const et of ALL_EVENT_TYPES) map.set(et, false);
        for (const p of preferences) map.set(p.eventType, p.optedOut);
        setPrefs(map);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [tournamentId]);

  // ── Save helper ─────────────────────────────────────────────────────────────

  const save = useCallback(async (updated: Map<NotificationEventType, boolean>) => {
    if (!tournamentId) return;
    setSaving(true);
    setError(null);
    try {
      const preferences = ALL_EVENT_TYPES.map(et => ({
        eventType: et,
        optedOut:  updated.get(et) ?? false,
      }));
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/notification-preferences`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ preferences }),
      });
      if (!res.ok) throw new Error('Save failed.');
    } catch {
      setError('Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [tournamentId]);

  // ── Master mute toggle ──────────────────────────────────────────────────────

  function handleMuteAll(mute: boolean) {
    const next = new Map<NotificationEventType, boolean>();
    for (const et of ALL_EVENT_TYPES) next.set(et, mute);
    setPrefs(next);
    save(next);
  }

  // ── Per-event toggle ────────────────────────────────────────────────────────

  function handleEventToggle(et: NotificationEventType, optedOut: boolean) {
    const next = new Map(prefs).set(et, optedOut);
    setPrefs(next);
    save(next);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!tournamentId) {
    return (
      <div className={styles.page}>
        <p className={styles.emptyState}>No tournament selected.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            {isMuted ? <BellOff size={21} /> : <Bell size={21} />}
          </div>
          <div>
            <h1 className={styles.pageTitle}>Tournament Notifications</h1>
            <p className={styles.pageSub}>
              Control which notifications you receive for <strong>{currentTournament?.name}</strong>.
              These settings are personal — they only affect your account.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {/* Master mute card */}
      <div className={`${styles.muteCard} ${isMuted ? styles.muteCardActive : ''}`}>
        <div className={styles.muteCardLeft}>
          <BellOff size={18} className={styles.muteIcon} />
          <div>
            <div className={styles.muteTitle}>Mute all notifications for this tournament</div>
            <div className={styles.muteSub}>
              {isMuted
                ? 'You will not receive any notifications for this tournament.'
                : 'Turn this on to silence all notifications from this tournament at once.'}
            </div>
          </div>
        </div>
        <Toggle
          checked={isMuted}
          onChange={handleMuteAll}
          label="Mute all notifications for this tournament"
          disabled={loading || saving}
        />
      </div>

      {/* Per-event opt-out table */}
      <div className={styles.sectionLabel}>Per-event settings</div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thEvent}>Event</th>
              <th className={styles.thMuted}>Receive</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? ALL_EVENT_TYPES.map(et => (
                  <tr key={et} className={styles.skeletonRow}>
                    <td><div className={styles.skeletonLabel} /></td>
                    <td><div className={styles.skeletonToggle} /></td>
                  </tr>
                ))
              : ALL_EVENT_TYPES.map(et => {
                  const optedOut = prefs.get(et) ?? false;
                  return (
                    <tr key={et} className={`${styles.row} ${optedOut ? styles.rowMuted : ''}`}>
                      <td className={styles.tdEvent}>
                        <span className={styles.eventLabel}>{NOTIFICATION_EVENT_LABELS[et]}</span>
                        <span className={styles.eventDesc}>{NOTIFICATION_EVENT_DESCRIPTIONS[et]}</span>
                      </td>
                      <td className={styles.tdMuted}>
                        <Toggle
                          checked={!optedOut}
                          onChange={v => handleEventToggle(et, !v)}
                          label={`Receive ${NOTIFICATION_EVENT_LABELS[et]} notifications for this tournament`}
                          disabled={saving}
                        />
                      </td>
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
      </div>

      <p className={styles.footNote}>
        These opt-outs are tournament-specific. To adjust your default channels across all
        tournaments, visit <strong>Org → Notification Preferences</strong>.
      </p>
    </div>
  );
}
