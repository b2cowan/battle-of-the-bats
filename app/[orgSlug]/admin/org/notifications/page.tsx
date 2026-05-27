'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Mail, Smartphone, Info, AlertCircle } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { ALL_EVENT_TYPES, NOTIFICATION_EVENT_LABELS, NOTIFICATION_EVENT_DESCRIPTIONS } from '@/lib/notification-labels';
import type { NotificationEventType, NotificationPreference } from '@/lib/types';
import styles from './notifications.module.css';

// ── System defaults ────────────────────────────────────────────────────────────

function systemDefault(eventType: NotificationEventType, role: string): NotificationPreference {
  return {
    eventType,
    channelBell:  true,
    channelPush:  false,
    channelEmail: eventType === 'payment_failed' && (role === 'owner' || role === 'admin'),
  };
}

// ── Toggle component ───────────────────────────────────────────────────────────

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

export default function OrgNotificationPreferencesPage() {
  const { currentOrg, userRole } = useOrg();
  const orgSlug = currentOrg?.slug;
  const role    = userRole ?? 'staff';

  // Map of eventType → current preference (or system default)
  const [prefs, setPrefs] = useState<Map<NotificationEventType, NotificationPreference>>(new Map());
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [saving, setSaving]     = useState<Set<NotificationEventType>>(new Set());
  const [savedRecently, setSavedRecently] = useState<Set<NotificationEventType>>(new Set());
  const [pushWarning, setPushWarning]     = useState(false);

  // Debounce refs per event type
  const debounceRefs = useRef<Map<NotificationEventType, ReturnType<typeof setTimeout>>>(new Map());

  // ── Load preferences ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!orgSlug) return;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/org/notification-preferences?orgSlug=${orgSlug}`);
        if (!res.ok) throw new Error('Failed to load preferences.');
        const { preferences } = await res.json() as { preferences: NotificationPreference[] };

        const map = new Map<NotificationEventType, NotificationPreference>();
        // Seed with system defaults for all event types
        for (const et of ALL_EVENT_TYPES) {
          map.set(et, systemDefault(et, role));
        }
        // Overlay saved rows
        for (const p of preferences) {
          map.set(p.eventType, p);
        }
        setPrefs(map);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [orgSlug, role]);

  // ── Save a single preference row ────────────────────────────────────────────

  const savePref = useCallback(async (pref: NotificationPreference) => {
    if (!orgSlug) return;
    setSaving(prev => new Set(prev).add(pref.eventType));
    try {
      const res = await fetch(`/api/admin/org/notification-preferences?orgSlug=${orgSlug}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ preferences: [pref] }),
      });
      if (!res.ok) throw new Error('Save failed.');
      setSavedRecently(prev => {
        const next = new Set(prev).add(pref.eventType);
        setTimeout(() => {
          setSavedRecently(s => { const n = new Set(s); n.delete(pref.eventType); return n; });
        }, 1500);
        return next;
      });
    } catch {
      // On failure, don't revert — leave optimistic state; surface error banner
      setError('Failed to save preference. Please try again.');
    } finally {
      setSaving(prev => { const n = new Set(prev); n.delete(pref.eventType); return n; });
    }
  }, [orgSlug]);

  // ── Optimistic toggle handler ────────────────────────────────────────────────

  function handleToggle(
    eventType: NotificationEventType,
    channel: 'channelBell' | 'channelPush' | 'channelEmail',
    value: boolean,
  ) {
    const current = prefs.get(eventType) ?? systemDefault(eventType, role);
    const updated: NotificationPreference = { ...current, [channel]: value };

    // Track iOS push callout
    if (channel === 'channelPush' && value) setPushWarning(true);
    if (channel === 'channelPush' && !value) {
      // Hide warning if no push is enabled anywhere
      const anyPush = [...prefs.values()].some(p =>
        p.eventType === eventType ? false : p.channelPush,
      );
      if (!anyPush) setPushWarning(false);
    }

    // Optimistic update
    setPrefs(prev => new Map(prev).set(eventType, updated));

    // Debounce save (300 ms)
    const existing = debounceRefs.current.get(eventType);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => savePref(updated), 300);
    debounceRefs.current.set(eventType, t);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><Bell size={21} /></div>
          <div>
            <h1 className={styles.pageTitle}>Notification Preferences</h1>
            <p className={styles.pageSub}>
              Choose which channels fire for each event type. Changes save automatically.
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

      {pushWarning && (
        <div className={styles.pushCallout}>
          <Smartphone size={15} />
          <span>
            <strong>iOS push notifications</strong> require adding FieldLogicHQ to your Home Screen first
            (iOS 16.4+). In Safari, tap the Share button and choose &ldquo;Add to Home Screen&rdquo;.
          </span>
        </div>
      )}

      {/* Preferences table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thEvent}>Event</th>
              <th className={styles.thChannel}>
                <span className={styles.channelLabel}>
                  <Bell size={13} /> Bell
                </span>
              </th>
              <th className={styles.thChannel}>
                <span className={styles.channelLabel}>
                  <Smartphone size={13} /> Push
                </span>
              </th>
              <th className={styles.thChannel}>
                <span className={styles.channelLabel}>
                  <Mail size={13} /> Email
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? ALL_EVENT_TYPES.map(et => (
                  <tr key={et} className={styles.skeletonRow}>
                    <td><div className={styles.skeletonLabel} /></td>
                    <td><div className={styles.skeletonToggle} /></td>
                    <td><div className={styles.skeletonToggle} /></td>
                    <td><div className={styles.skeletonToggle} /></td>
                  </tr>
                ))
              : ALL_EVENT_TYPES.map(et => {
                  const pref = prefs.get(et) ?? systemDefault(et, role);
                  const isSaving = saving.has(et);
                  return (
                    <tr key={et} className={`${styles.row} ${isSaving ? styles.rowSaving : ''}`}>
                      <td className={styles.tdEvent}>
                        <span className={styles.eventLabel}>{NOTIFICATION_EVENT_LABELS[et]}</span>
                        <span className={styles.eventDesc} title={NOTIFICATION_EVENT_DESCRIPTIONS[et]}>
                          <Info size={12} />
                          <span className={styles.descText}>{NOTIFICATION_EVENT_DESCRIPTIONS[et]}</span>
                        </span>
                      </td>
                      <td className={styles.tdChannel}>
                        <Toggle
                          checked={pref.channelBell}
                          onChange={v => handleToggle(et, 'channelBell', v)}
                          label={`Bell notifications for ${NOTIFICATION_EVENT_LABELS[et]}`}
                        />
                      </td>
                      <td className={styles.tdChannel}>
                        <Toggle
                          checked={pref.channelPush}
                          onChange={v => handleToggle(et, 'channelPush', v)}
                          label={`Push notifications for ${NOTIFICATION_EVENT_LABELS[et]}`}
                        />
                      </td>
                      <td className={styles.tdChannel}>
                        <Toggle
                          checked={pref.channelEmail}
                          onChange={v => handleToggle(et, 'channelEmail', v)}
                          label={`Email notifications for ${NOTIFICATION_EVENT_LABELS[et]}`}
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
        System defaults: Bell is on for all events. Push is off by default. Email is off except
        for <strong>Payment failed</strong> (owners and admins only).
      </p>
    </div>
  );
}
