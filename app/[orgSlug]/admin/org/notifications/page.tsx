'use client';
import { Fragment, useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Mail, Smartphone, Info, AlertCircle } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import {
  NOTIFICATION_SECTIONS,
  ALL_EVENT_TYPES,
  NOTIFICATION_EVENT_LABELS,
  NOTIFICATION_EVENT_DESCRIPTIONS,
  PUSH_DEFAULT_ON_EVENTS,
} from '@/lib/notification-labels';
import type { NotificationEventType, NotificationPreference } from '@/lib/types';
import type { Capability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { enablePushOnThisDevice, PushPermissionError } from '@/lib/push-client';
import PushDeviceTester from '@/components/notifications/PushDeviceTester';
import styles from './notifications.module.css';

// ── System defaults ────────────────────────────────────────────────────────────

function systemDefault(eventType: NotificationEventType, role: string): NotificationPreference {
  return {
    eventType,
    channelBell:  true,
    channelPush:  PUSH_DEFAULT_ON_EVENTS.has(eventType),
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
  usePageTitle('Notification Preferences');
  const orgSlug = currentOrg?.slug;
  const role    = userRole ?? 'staff';

  // Map of eventType → current preference (or system default)
  const [prefs, setPrefs] = useState<Map<NotificationEventType, NotificationPreference>>(new Map());
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [saving, setSaving]     = useState<Set<NotificationEventType>>(new Set());
  const [savedRecently, setSavedRecently] = useState<Set<NotificationEventType>>(new Set());

  // ── Push-specific state ────────────────────────────────────────────────────
  // null = not yet checked (SSR), false = unsupported, true = supported
  const [pushSupported, setPushSupported] = useState<boolean | null>(null);
  // True while a Push toggle is registering this device (OS permission + subscribe).
  const [enablingPush, setEnablingPush] = useState(false);

  // Debounce refs per event type (used for bell/email — push uses explicit save after permission)
  const debounceRefs = useRef<Map<NotificationEventType, ReturnType<typeof setTimeout>>>(new Map());

  // ── Visible sections — only show modules the org has enabled ──────────────

  const visibleSections = NOTIFICATION_SECTIONS.filter(sec =>
    sec.module === null ||
    (currentOrg ? hasModuleEntitlement(currentOrg, sec.module as Capability) : false)
  );

  // ── Detect push support on mount (client-only) ─────────────────────────────

  useEffect(() => {
    setPushSupported(
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    );
  }, []);

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
      setError('Failed to save preference. Please try again.');
    } finally {
      setSaving(prev => { const n = new Set(prev); n.delete(pref.eventType); return n; });
    }
  }, [orgSlug]);

  // ── Optimistic toggle handler ────────────────────────────────────────────────

  async function handleToggle(
    eventType: NotificationEventType,
    channel: 'channelBell' | 'channelPush' | 'channelEmail',
    value: boolean,
  ) {
    const current = prefs.get(eventType) ?? systemDefault(eventType, role);
    const updated: NotificationPreference = { ...current, [channel]: value };

    // ── Push-specific flow (turning ON) ───────────────────────────────────────
    // Register this device directly inside the click gesture so the phone's
    // "Allow notifications?" dialog appears immediately (it's browser-rendered,
    // so it's always visible regardless of scroll position — no off-screen step).
    if (channel === 'channelPush' && value === true) {
      setError(null);
      setPrefs(prev => new Map(prev).set(eventType, updated)); // optimistic ON
      setEnablingPush(true);
      try {
        await enablePushOnThisDevice();
        savePref(updated);
      } catch (e) {
        // Revert the optimistic toggle and explain what happened.
        setPrefs(prev => {
          const cur = prev.get(eventType);
          return cur ? new Map(prev).set(eventType, { ...cur, channelPush: false }) : prev;
        });
        const reason = e instanceof PushPermissionError ? e.reason : 'failed';
        setError(
          reason === 'denied'
            ? 'Notifications are blocked for this site. Turn them on in your browser or phone settings, then try again.'
          : reason === 'unsupported'
            ? 'This browser doesn’t support push notifications. On iPhone, add the app to your Home Screen first (iOS 16.4+).'
          : reason === 'unconfigured'
            ? 'Push isn’t set up on the server yet. Please try again later.'
          : (e instanceof Error ? e.message : 'Could not enable push notifications.')
        );
      } finally {
        setEnablingPush(false);
      }
      return;
    }

    // ── All other channels + push toggle OFF ──────────────────────────────────
    setPrefs(prev => new Map(prev).set(eventType, updated));

    const existing = debounceRefs.current.get(eventType);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => savePref(updated), 300);
    debounceRefs.current.set(eventType, t);
  }

  // ── iOS push callout: shown when any push toggle is on ──────────────────────

  const anyPushEnabled = [...prefs.values()].some(p => p.channelPush);

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

      {/* iOS push callout — only shown when at least one push toggle is on */}
      {anyPushEnabled && (
        <div className={styles.pushCallout}>
          <Smartphone size={15} />
          <span>
            <strong>iOS push notifications</strong> require adding FieldLogicHQ to your Home Screen first
            (iOS 16.4+). In Safari, tap the Share button and choose &ldquo;Add to Home Screen&rdquo;.
          </span>
        </div>
      )}

      {/* Push not supported banner */}
      {pushSupported === false && (
        <div className={styles.pushCallout}>
          <Smartphone size={15} />
          <span>
            <strong>Push notifications are not supported</strong> in this browser or environment.
            The Push column is disabled. Try Chrome, Edge, or Firefox on desktop, or add the app
            to your Home Screen on iOS 16.4+.
          </span>
        </div>
      )}

      {/* Registered devices + send-test control */}
      <PushDeviceTester />

      {/* Preferences table — grouped by module */}
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
                  {pushSupported === false && (
                    <span className={styles.unsupportedNote}>n/a</span>
                  )}
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
              : visibleSections.map((section, sIdx) => (
                  <Fragment key={section.label}>
                    {/* Section header row */}
                    <tr className={`${styles.sectionHeaderRow} ${sIdx > 0 ? styles.sectionHeaderRowBorder : ''}`}>
                      <td colSpan={4} className={styles.sectionHeaderCell}>
                        {section.label}
                      </td>
                    </tr>

                    {/* Event rows for this section */}
                    {section.eventTypes.map(et => {
                      const pref     = prefs.get(et) ?? systemDefault(et, role);
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
                              // Disable if: browser doesn't support push, or a device registration
                              // is already in flight (avoids firing two OS prompts at once).
                              disabled={pushSupported === false || enablingPush}
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
                    })}
                  </Fragment>
                ))
            }
          </tbody>
        </table>
      </div>

      <p className={styles.footNote}>
        System defaults: Bell is on for all events. Push is on for the time-sensitive alerts
        (registrations, payments, scores, no-shows, coach requests) and off for the rest — it only
        reaches devices you&apos;ve turned notifications on for. Email is off except for{' '}
        <strong>Payment failed</strong> (owners and admins only).
      </p>
    </div>
  );
}
