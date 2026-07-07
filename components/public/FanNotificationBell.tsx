'use client';
/**
 * components/public/FanNotificationBell.tsx
 *
 * The public tournament's team-INDEPENDENT notification opt-in — a bell in the Navbar
 * right-actions group (every public tab, mobile + desktop). Lets an anonymous fan turn on
 * tournament notifications WITHOUT first following a team. Opens a panel (desktop popover /
 * mobile bottom-sheet) with per-category switches:
 *   • Tournament messages — organizer announcements / rain delays (tournament-wide)
 *   • Score alerts        — game scores for the team the fan follows
 *
 * Shares the SAME server row + localStorage state as the per-team FollowAlertsToggle
 * (via lib/fan-alerts + the `fl-fan-alerts-change` event), so the two never diverge.
 *
 * Only mounted when the tournament includes fan push (Tournament Plus+) — the parent decides.
 * Mirrors FollowAlertsToggle's honesty states: iOS-needs-install, permission-blocked,
 * unsupported (renders nothing).
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellRing, BellOff, BellPlus, X, Loader2, Check } from 'lucide-react';
import { isPushSupported, PushPermissionError } from '@/lib/push-client';
import { isIOSLike, isStandalonePWA } from '@/lib/device';
import { readFollowedTeam, type FollowedTeam } from '@/lib/follow';
import {
  fanAlertsKey,
  readFanAlertsState,
  subscribeFanAlerts,
  verifyFanAlertsLive,
} from '@/lib/fan-alerts';
import styles from './FanNotificationBell.module.css';

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  tournamentId: string;
}

export default function FanNotificationBell({ orgSlug, tournamentSlug, tournamentId }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Desktop popover coords (computed from the bell rect on open). null = mobile bottom-sheet
  // (CSS positions it); the panel is portaled to <body> so it clears the bottom nav / other bars.
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const [supported, setSupported] = useState(true);
  const [iosInstall, setIosInstall] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const [open, setOpen] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  // Switch positions. Default both ON so a first-time fan sees the "you'll get everything" preview.
  const [messages, setMessages] = useState(true);
  const [scores, setScores] = useState(true);
  const [team, setTeam] = useState<FollowedTeam | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Mirrors `busy` synchronously so the sync() effect can skip re-reading state while a user
  // change is in flight — otherwise a verify/event callback could clobber the pending change
  // (same guard the per-team FollowAlertsToggle uses via its stateRef).
  const busyRef = useRef(false);

  // ── Environment + live-state sync ─────────────────────────────────────────
  useEffect(() => {
    // iPhone/iPad in a normal browser tab: push needs Add-to-Home-Screen (iOS 16.4+, standalone).
    if (isIOSLike() && !isStandalonePWA()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIosInstall(true);
      return;
    }
    if (!isPushSupported()) {
      setSupported(false);
      return;
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      setBlocked(true);
    }

    const sync = () => {
      // A user change is mid-flight (applyCategories) — it owns the final state. Skip so a
      // stale verify/event doesn't revert the switches the user is actively setting.
      if (busyRef.current) return;
      setTeam(readFollowedTeam(orgSlug, tournamentSlug));
      const stored = readFanAlertsState(orgSlug, tournamentSlug);
      if (!stored) {
        setSubscribed(false);
        setMessages(true);
        setScores(true);
        return;
      }
      setSubscribed(true);
      setMessages(stored.notifyMessages);
      setScores(stored.notifyScores);
      // Verify the subscription is still live; drop to unsubscribed if it silently died.
      void (async () => {
        const live = await verifyFanAlertsLive(stored);
        if (!live && !busyRef.current) {
          setSubscribed(false);
          setMessages(true);
          setScores(true);
        }
      })();
    };
    sync();
    // Filter the storage event to this tournament's key so unrelated localStorage writes don't
    // trigger a needless re-sync + verify (matches FollowAlertsToggle).
    const onStorage = (e: StorageEvent) => {
      if (e.key === fanAlertsKey(orgSlug, tournamentSlug)) sync();
    };
    window.addEventListener('fl-fan-alerts-change', sync);
    window.addEventListener('fl-follow-change', sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('fl-fan-alerts-change', sync);
      window.removeEventListener('fl-follow-change', sync);
      window.removeEventListener('storage', onStorage);
    };
  }, [orgSlug, tournamentSlug]);

  // ── Close on outside click / Esc ──────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Element | null;
      if (!t) return;
      // The panel is portaled to <body> (outside wrapRef), so check it explicitly.
      if (wrapRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Open the panel; anchor the desktop popover under the bell. Mobile (≤640) uses the CSS sheet.
  function toggleOpen() {
    if (!open && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      const mobile = window.innerWidth <= 640;
      setPos(mobile ? null : { top: Math.round(r.bottom + 8), right: Math.round(window.innerWidth - r.right) });
    }
    setOpen(o => !o);
  }

  // ── Apply a category combination to the shared subscription ────────────────
  async function applyCategories(nextMessages: boolean, nextScores: boolean) {
    // Remember the committed switch positions so a failed write can revert the optimistic flip.
    const prevMessages = messages;
    const prevScores = scores;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await subscribeFanAlerts({
        orgSlug,
        tournamentSlug,
        tournamentId,
        team: team ? { id: team.id, name: team.name } : null,
        notifyMessages: nextMessages,
        notifyScores: nextScores,
      });
      setMessages(nextMessages);
      setScores(nextScores);
      setSubscribed(nextMessages || nextScores);
    } catch (err) {
      // Roll the switches back to their last-saved positions so the UI matches reality.
      setMessages(prevMessages);
      setScores(prevScores);
      const reason = err instanceof PushPermissionError ? err.reason : 'failed';
      if (reason === 'denied') setBlocked(true);
      else setError(err instanceof Error ? err.message : 'Could not update notifications.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function toggleMessages() {
    const next = !messages;
    setMessages(next);
    if (subscribed) void applyCategories(next, scores);
  }
  function toggleScores() {
    const next = !scores;
    setScores(next);
    if (subscribed) void applyCategories(messages, next);
  }

  if (!supported) return null;

  const bellOn = subscribed && !blocked;
  const BellIcon = blocked ? BellOff : iosInstall ? BellPlus : bellOn ? BellRing : Bell;

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <button
        type="button"
        className={`${styles.bellBtn} ${bellOn ? styles.bellOn : ''}`}
        onClick={toggleOpen}
        aria-label={bellOn ? 'Tournament notifications — on' : 'Turn on tournament notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Notifications"
      >
        <BellIcon size={16} />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} aria-hidden />
          <div
            ref={panelRef}
            className={styles.panel}
            style={pos ? { position: 'fixed', top: pos.top, right: pos.right } : undefined}
            role="dialog"
            aria-label="Tournament notifications"
          >
            <div className={styles.head}>
              <BellRing size={16} className={styles.headIcon} aria-hidden />
              <span className={styles.headTitle}>Tournament alerts</span>
              <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            {iosInstall ? (
              <div className={styles.explain}>
                <p className={styles.explainText}>
                  On iPhone or iPad, tap <strong>Share</strong> then <strong>“Add to Home Screen”</strong>, then open this app to turn on alerts.
                </p>
                <button
                  type="button"
                  className="btn btn-lime btn-sm"
                  onClick={() => { window.dispatchEvent(new CustomEvent('flhq:show-install')); setOpen(false); }}
                >
                  Show me how
                </button>
              </div>
            ) : blocked ? (
              <div className={styles.explain}>
                <p className={styles.explainText}>
                  Notifications are blocked — turn them on in your browser settings, then reopen this.
                </p>
              </div>
            ) : (
              <>
                <p className={styles.sub}>Get a heads-up on your phone.</p>

                <div className={styles.rows}>
                  <Row
                    label="Tournament messages"
                    desc="Rain delays & day-of updates"
                    on={messages}
                    disabled={busy}
                    onToggle={toggleMessages}
                  />
                  <Row
                    label="Score alerts"
                    desc="For teams you follow"
                    on={scores}
                    disabled={busy}
                    onToggle={toggleScores}
                    hint={!team ? 'Follow a team to start these' : undefined}
                  />
                </div>

                {error && <p className={styles.error}>{error}</p>}

                <div className={styles.foot}>
                  {busy ? (
                    <span className={styles.working}><Loader2 size={14} className={styles.spin} /> Working…</span>
                  ) : subscribed ? (
                    <>
                      <span className={styles.onNote}><Check size={14} /> Notifications on</span>
                      <button type="button" className={styles.linkBtn} onClick={() => applyCategories(false, false)}>
                        Turn all off
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={`btn btn-lime btn-sm ${styles.cta}`}
                      onClick={() => applyCategories(messages, scores)}
                      disabled={!messages && !scores}
                    >
                      Turn on notifications
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

// ── Category row with a switch ───────────────────────────────────────────────
function Row({
  label, desc, on, disabled, onToggle, hint,
}: {
  label: string;
  desc: string;
  on: boolean;
  disabled: boolean;
  onToggle: () => void;
  hint?: string;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.rowLabel}>{label}</span>
        <span className={styles.rowDesc}>{desc}</span>
        {hint && <span className={styles.rowHint}>{hint}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={disabled}
        className={`${styles.switch} ${on ? styles.switchOn : ''}`}
        onClick={onToggle}
      >
        <span className={styles.thumb} />
      </button>
    </div>
  );
}
