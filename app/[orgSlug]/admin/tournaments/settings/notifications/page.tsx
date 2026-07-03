'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Bell, BellOff, AlertCircle, Smartphone, Mail } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { TOURNAMENT_EVENT_TYPES, NOTIFICATION_EVENT_LABELS, NOTIFICATION_EVENT_DESCRIPTIONS, PUSH_DEFAULT_ON_EVENTS } from '@/lib/notification-labels';
import { hasPlanFeature } from '@/lib/plan-features';
import type { NotificationEventType, NotificationPreference } from '@/lib/types';
import styles from './notifications.module.css';

const CHAT_EVENT: NotificationEventType = 'chat_message';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TournamentPref {
  eventType: NotificationEventType;
  optedOut:  boolean;
}

// Push defaults on for the tournament channel because several tournament event
// types are in PUSH_DEFAULT_ON_EVENTS. Derived from module constants → stable.
const TOURNAMENT_PUSH_DEFAULT_ON = TOURNAMENT_EVENT_TYPES.some(et => PUSH_DEFAULT_ON_EVENTS.has(et));

interface Channels {
  bell:  boolean;
  push:  boolean;
  email: boolean;
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
  const { currentOrg } = useOrg();
  usePageTitle('Notifications');
  const tournamentId = currentTournament?.id;
  const orgSlug      = currentOrg?.slug;

  // Tournament chat is a Tournament Plus+ feature. Only surface its notification
  // control (and fold it into the channel/mute batches) when the org has chat.
  const chatEnabled = currentOrg ? hasPlanFeature(currentOrg.planId, 'tournament_chat') : false;
  // The event types this page manages: tournament ops events + chat when enabled.
  // Memoized so effect/callback deps stay stable across renders.
  const eventTypes = useMemo<NotificationEventType[]>(
    () => (chatEnabled ? [...TOURNAMENT_EVENT_TYPES, CHAT_EVENT] : [...TOURNAMENT_EVENT_TYPES]),
    [chatEnabled],
  );

  // ── Per-event opt-out state ───────────────────────────────────────────────
  const [prefs, setPrefs]   = useState<Map<NotificationEventType, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // ── Global channel state (bell / push / email) ────────────────────────────
  // Derived from org-level notification preferences; treated as uniform across
  // all tournament event types.  System defaults: bell on, email off; push on
  // (several tournament events default push-on — see PUSH_DEFAULT_ON_EVENTS).
  const [channels, setChannels]         = useState<Channels>({ bell: true, push: TOURNAMENT_PUSH_DEFAULT_ON, email: false });
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [channelsSaving, setChannelsSaving]   = useState(false);

  // ── Computed: are ALL event types opted out? → muted ───────────────────────
  const isMuted = eventTypes.every(et => prefs.get(et) === true);
  const chatOptedOut = prefs.get(CHAT_EVENT) ?? false;

  // ── Load per-tournament opt-out prefs ───────────────────────────────────────

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
        for (const et of TOURNAMENT_EVENT_TYPES) map.set(et, false);
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

  // ── Load global channel prefs (org-level) ────────────────────────────────

  useEffect(() => {
    if (!orgSlug) return;
    async function loadChannels() {
      setChannelsLoading(true);
      try {
        const res = await fetch(`/api/admin/org/notification-preferences?orgSlug=${orgSlug}`);
        if (!res.ok) return;
        const { preferences } = await res.json() as { preferences: NotificationPreference[] };

        // Derive global channel state from saved tournament-event preferences.
        // Bell: on unless the user explicitly saved bell=false for all of them.
        // Push / Email: on if any tournament event type has it enabled.
        const tournamentPrefs = preferences.filter(p =>
          eventTypes.includes(p.eventType)
        );
        if (tournamentPrefs.length === 0) {
          // No saved rows — use system defaults (push defaults on for the key events)
          setChannels({ bell: true, push: TOURNAMENT_PUSH_DEFAULT_ON, email: false });
        } else {
          setChannels({
            bell:  !tournamentPrefs.every(p => p.channelBell  === false),
            push:  tournamentPrefs.some(p  => p.channelPush  === true),
            email: tournamentPrefs.some(p  => p.channelEmail === true),
          });
        }
      } catch {
        // Non-fatal — channels fall back to system defaults
      } finally {
        setChannelsLoading(false);
      }
    }
    loadChannels();
  }, [orgSlug, eventTypes]);

  // ── Save per-tournament opt-out prefs ────────────────────────────────────

  const save = useCallback(async (updated: Map<NotificationEventType, boolean>) => {
    if (!tournamentId) return;
    setSaving(true);
    setError(null);
    try {
      const preferences = eventTypes.map(et => ({
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
  }, [tournamentId, eventTypes]);

  // ── Save global channel prefs (batch-saves all tournament event types) ────

  const saveChannels = useCallback(async (next: Channels) => {
    if (!orgSlug) return;
    setChannelsSaving(true);
    try {
      const preferences = eventTypes.map(et => ({
        eventType:    et,
        channelBell:  next.bell,
        channelPush:  next.push,
        channelEmail: next.email,
      }));
      await fetch(`/api/admin/org/notification-preferences?orgSlug=${orgSlug}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ preferences }),
      });
    } catch {
      // Non-fatal
    } finally {
      setChannelsSaving(false);
    }
  }, [orgSlug, eventTypes]);

  // ── Master mute toggle ──────────────────────────────────────────────────────

  function handleMuteAll(mute: boolean) {
    const next = new Map<NotificationEventType, boolean>();
    for (const et of eventTypes) next.set(et, mute);
    setPrefs(next);
    save(next);
  }

  // ── Per-event opt-out toggle ────────────────────────────────────────────────

  function handleEventToggle(et: NotificationEventType, optedOut: boolean) {
    const next = new Map(prefs).set(et, optedOut);
    setPrefs(next);
    save(next);
  }

  // ── Channel toggle ─────────────────────────────────────────────────────────

  function handleChannelToggle(channel: keyof Channels, value: boolean) {
    const next = { ...channels, [channel]: value };
    setChannels(next);
    saveChannels(next);
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

      {/* Global channel section */}
      <div className={styles.channelCard}>
        <div className={styles.channelTop}>
          <div className={styles.channelCardLabel}>Receive via</div>
          <div className={styles.channelRow}>
            {([
              { key: 'bell'  as const, Icon: Bell,       label: 'Bell'  },
              { key: 'push'  as const, Icon: Smartphone,  label: 'Push'  },
              { key: 'email' as const, Icon: Mail,        label: 'Email' },
            ]).map(({ key, Icon, label }) => (
              <label key={key} className={styles.channelItem}>
                <Toggle
                  checked={channels[key]}
                  onChange={v => handleChannelToggle(key, v)}
                  label={`${label} notifications`}
                  disabled={channelsLoading || channelsSaving}
                />
                <span className={styles.channelItemLabel}>
                  <Icon size={13} />
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>
        <p className={styles.channelNote}>
          Applies to all notifications on this page. Push requires your browser to grant notification permission.
        </p>
      </div>

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
              ? TOURNAMENT_EVENT_TYPES.map(et => (
                  <tr key={et} className={styles.skeletonRow}>
                    <td><div className={styles.skeletonLabel} /></td>
                    <td><div className={styles.skeletonToggle} /></td>
                  </tr>
                ))
              : TOURNAMENT_EVENT_TYPES.map(et => {
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

      {/* Messaging — only when the org has Tournament Chat. @mentions are always
          delivered (not user-mutable), so only the general chat-message stream has a toggle. */}
      {chatEnabled && (
        <>
          <div className={styles.sectionLabel}>Messaging</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                <tr className={`${styles.row} ${chatOptedOut ? styles.rowMuted : ''}`}>
                  <td className={styles.tdEvent}>
                    <span className={styles.eventLabel}>{NOTIFICATION_EVENT_LABELS[CHAT_EVENT]}</span>
                    <span className={styles.eventDesc}>{NOTIFICATION_EVENT_DESCRIPTIONS[CHAT_EVENT]}</span>
                  </td>
                  <td className={styles.tdMuted}>
                    <Toggle
                      checked={!chatOptedOut}
                      onChange={v => handleEventToggle(CHAT_EVENT, !v)}
                      label={`Receive ${NOTIFICATION_EVENT_LABELS[CHAT_EVENT]} notifications for this tournament`}
                      disabled={saving}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className={styles.channelNote}>
            @mentions always reach you, even with chat messages turned off.
          </p>
        </>
      )}
    </div>
  );
}
