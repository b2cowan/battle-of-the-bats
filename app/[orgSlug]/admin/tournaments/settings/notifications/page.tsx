'use client';
/**
 * TOURNAMENT NOTIFICATIONS — Tournament admin redesign Stage 5 (E6, A54; F31), built to hub v45, ruled as drawn
 * 2026-10-10.
 *
 *   mute      Mute everything from this tournament — one 52px row, its whole width the switch
 *   tell me   each event a 52px row whose whole width toggles its switch (today a 36×20 switch in a table cell); the
 *   when      ten event names stay today's (the words list), chat's row only where the plan has chat
 *   saving    each change saves at once, as today — now with the floating pill (today silent on success, a banner
 *             on failure); Retry sends the switches as they stand
 *   door      Manage what you receive everywhere → the account's notification settings, at the foot
 *
 * Notification Settings Phase 1 (locked D1) stands: this page is MUTE-ONLY. What a channel is set to lives on the
 * universal /account/notifications page; here you can only silence this one tournament.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { TOURNAMENT_EVENT_TYPES, NOTIFICATION_EVENT_LABELS } from '@/lib/notification-labels';
import { hasPlanFeature } from '@/lib/plan-features';
import type { NotificationEventType } from '@/lib/types';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { LoadFailed, SavePill, repKit } from '@/components/admin/kit/club/RepKit';
import { NOTIFY_WORDS as W } from '@/lib/tournament-settings-words';
import styles from './notifications.module.css';

const CHAT_EVENT: NotificationEventType = 'chat_message';

interface TournamentPref {
  eventType: NotificationEventType;
  optedOut: boolean;
}

/** One 52px row, its whole width the switch. */
function SwitchRow({ on, name, caption, onToggle }: {
  on: boolean; name: string; caption?: string; onToggle: () => void;
}) {
  return (
    <button type="button" role="switch" aria-checked={on} className={styles.row} onClick={onToggle}>
      <span className={styles.text}>
        <span className={styles.name}>{name}</span>
        {caption && <span className={styles.caption}>{caption}</span>}
      </span>
      <span className={styles.switch} aria-hidden />
    </button>
  );
}

export default function TournamentNotificationPreferencesPage() {
  const { currentTournament } = useTournament();
  const { currentOrg } = useOrg();
  usePageTitle('Notifications');
  const tournamentId = currentTournament?.id;
  const orgSlug = currentOrg?.slug;

  // Tournament chat is a Tournament Plus+ feature: its row (and its place in the mute) only where the org has chat.
  const chatEnabled = currentOrg ? hasPlanFeature(currentOrg.planId, 'tournament_chat') : false;
  const eventTypes = useMemo<NotificationEventType[]>(
    () => (chatEnabled ? [...TOURNAMENT_EVENT_TYPES, CHAT_EVENT] : [...TOURNAMENT_EVENT_TYPES]),
    [chatEnabled],
  );

  // Per-event opt-out (veto): true = muted.
  const [prefs, setPrefs] = useState<Map<NotificationEventType, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const latest = useRef(prefs);

  const isMuted = eventTypes.every(et => prefs.get(et) === true);

  const load = useCallback(async () => {
    if (!tournamentId) return;
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/notification-preferences`, { cache: 'no-store' });
      if (!res.ok) throw new Error('load');
      const { preferences } = await res.json() as { preferences: TournamentPref[] };
      const map = new Map<NotificationEventType, boolean>();
      for (const et of TOURNAMENT_EVENT_TYPES) map.set(et, false);
      for (const p of preferences) map.set(p.eventType, p.optedOut);
      latest.current = map;
      setPrefs(map);
    } catch {
      setLoadError(W.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- a new event reads its own settings
  useEffect(() => { void load(); }, [load]);

  /** Sends the switches as they stand when its turn comes (each change, and Retry) — one at a time, so the last change
   *  is what the server keeps; the rows stay tappable (and keep focus) while one is in flight. */
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const save = useCallback(() => {
    if (!tournamentId) return;
    setSaving(true);
    setSaveError(null);
    const run = chain.current.catch(() => {}).then(async () => {
      try {
        const preferences = eventTypes.map(et => ({ eventType: et, optedOut: latest.current.get(et) ?? false }));
        const res = await fetch(`/api/admin/tournaments/${tournamentId}/notification-preferences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferences }),
        });
        if (!res.ok) throw new Error('save');
      } catch {
        setSaveError(W.saveFailed);
      }
    });
    chain.current = run;
    void run.finally(() => { if (chain.current === run) setSaving(false); });
  }, [tournamentId, eventTypes]);

  function apply(next: Map<NotificationEventType, boolean>) {
    latest.current = next;
    setPrefs(next);
    save();
  }
  const muteAll = (mute: boolean) => apply(new Map(eventTypes.map(et => [et, mute] as const)));
  const toggle = (et: NotificationEventType) => apply(new Map(prefs).set(et, !(prefs.get(et) ?? false)));

  if (!tournamentId) {
    return <div className={repKit.page}><p className={styles.quiet}>{W.noTournament}</p></div>;
  }

  const rowsFor = (list: NotificationEventType[]) => list.map(et => (
    <li key={et}>
      <SwitchRow
        on={!(prefs.get(et) ?? false)}
        name={NOTIFICATION_EVENT_LABELS[et]}
        caption={et === CHAT_EVENT ? W.mentions : undefined}
       
        onToggle={() => toggle(et)}
      />
    </li>
  ));

  return (
    <div className={repKit.page}>
      <AdminPageHeader inlineActions title={W.title} />

      {loadError ? (
        <LoadFailed title={loadError} onRetry={() => void load()} />
      ) : loading ? (
        <p className={styles.quiet} role="status">Loading…</p>
      ) : (
        <>
          <div className={styles.card}>
            <SwitchRow on={isMuted} name={W.mute} caption={W.muteCaption} onToggle={() => muteAll(!isMuted)} />
          </div>
          <section className={styles.card} aria-labelledby="tell-me-when">
            <h2 id="tell-me-when" className={styles.band}>{W.tellMeWhen}</h2>
            <ul className={styles.rows}>
              {rowsFor(chatEnabled ? [...TOURNAMENT_EVENT_TYPES, CHAT_EVENT] : [...TOURNAMENT_EVENT_TYPES])}
            </ul>
          </section>
          <Link href={`/account/notifications?focus=org-${orgSlug ?? ''}`} className={styles.door}>
            {W.manage} <ChevronRight size={16} aria-hidden />
          </Link>
        </>
      )}

      <SavePill saving={saving} dirty={false} error={saveError} onRetry={save} />
    </div>
  );
}
