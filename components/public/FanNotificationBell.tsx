'use client';
/**
 * components/public/FanNotificationBell.tsx
 *
 * The public tournament's notification bell — Navbar right-actions group (every
 * public tab, mobile + desktop). Slice 3 (Business Decisions Log 2026-07-14):
 * alerts require a signed-in account, so the panel is:
 *   • Signed out — a "sign in to get score alerts" pitch (returns to this page).
 *   • Signed in  — the two ACCOUNT-level switches (Game alerts / Event news —
 *     shared state with the Followed teams card and the per-team toggle via
 *     lib/fan-alert-prefs-client, so they can never diverge) plus an honest
 *     THIS-DEVICE state: the account switches say what you want, the device row
 *     says whether this phone/browser is registered to receive it.
 *
 * Only mounted when the tournament includes fan push (Tournament Plus+) — the
 * parent decides. Mirrors FollowAlertsToggle's honesty states: iOS-needs-install,
 * permission-blocked, unsupported (renders nothing).
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, BellRing, BellOff, BellPlus, X, Loader2, Check, Settings, ChevronRight } from 'lucide-react';
import {
  isPushSupported,
  enablePushOnThisDevice,
  getCurrentPushEndpoint,
  PushPermissionError,
} from '@/lib/push-client';
import { isIOSLike, isStandalonePWA } from '@/lib/device';
import { useFanAlertPrefs, saveFanAlertPref } from '@/lib/fan-alert-prefs-client';
import type { FanAlertPrefs } from '@/lib/fan-alert-prefs';
import styles from './FanNotificationBell.module.css';

// The switches are ACCOUNT-level (org/tournament-agnostic), and the mount gate
// (Plus plan, tournament not finished) lives in the caller. Two trigger shapes:
// `icon` (the desktop top-bar bell) and `row` (a full-width row inside the
// tournament More sheet — G5 moved mobile notifications in there). The panel
// itself is identical and portals above either trigger.
export default function FanNotificationBell({ variant = 'icon' }: { variant?: 'icon' | 'row' } = {}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  // Desktop popover coords (computed from the bell rect on open). null = mobile bottom-sheet
  // (CSS positions it); the panel is portaled to <body> so it clears the bottom nav / other bars.
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const [supported, setSupported] = useState(true);
  const [iosInstall, setIosInstall] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const [open, setOpen] = useState(false);
  const prefs = useFanAlertPrefs();
  // Optimistic overlay for a save in flight — the switch flips immediately and
  // reverts on failure, instead of freezing for the whole network round trip.
  const [optimistic, setOptimistic] = useState<Partial<FanAlertPrefs>>({});
  // Whether THIS browser holds a live push subscription (account switches say what
  // you want; this says whether this device can receive it).
  const [deviceReady, setDeviceReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // ── Environment + device state ────────────────────────────────────────────
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
    let cancelled = false;
    void getCurrentPushEndpoint().then(endpoint => {
      if (cancelled) return;
      setDeviceReady(!!endpoint && typeof Notification !== 'undefined' && Notification.permission === 'granted');
    });
    return () => { cancelled = true; };
  }, []);

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

  // ── Save one account switch (registering this device when turning ON) ──────
  async function applyPref(key: keyof FanAlertPrefs, next: boolean) {
    setBusy(true);
    setError('');
    setOptimistic(o => ({ ...o, [key]: next })); // flip immediately; revert below on failure
    const result = await saveFanAlertPref(key, next);
    if (result.ok) {
      if (next && !result.deviceIssue) setDeviceReady(true);
      if (result.deviceReason === 'denied') setBlocked(true);
    } else if (result.deviceReason === 'denied') {
      setBlocked(true);
    } else if (result.error) {
      setError(result.error);
    }
    // Success: the shared cache/event now carries the new value; failure: server
    // truth stands. Either way the overlay has served its purpose.
    setOptimistic(o => {
      const rest = { ...o };
      delete rest[key];
      return rest;
    });
    setBusy(false);
  }

  // Register this browser for push without touching the account switches.
  async function enableDevice() {
    setBusy(true);
    setError('');
    try {
      await enablePushOnThisDevice();
      setDeviceReady(true);
    } catch (err) {
      if (err instanceof PushPermissionError && err.reason === 'denied') setBlocked(true);
      else setError(err instanceof Error ? err.message : 'Could not turn on this device.');
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  const ready = prefs.state === 'ready';
  const bellOn = ready && deviceReady && (prefs.prefs.gameAlerts || prefs.prefs.eventNews) && !blocked;
  const BellIcon = blocked ? BellOff : iosInstall ? BellPlus : bellOn ? BellRing : Bell;

  const rowSub = blocked
    ? 'Blocked in browser settings'
    : iosInstall
      ? 'Add to Home Screen to enable'
      : bellOn
        ? 'On for this device'
        : 'Score alerts & event news';

  return (
    <div ref={wrapRef} className={variant === 'row' ? styles.wrapRow : styles.wrap}>
      {variant === 'row' ? (
        <button
          type="button"
          className={styles.rowTrigger}
          onClick={toggleOpen}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span className={`${styles.rowTriggerIcon} ${bellOn ? styles.bellOn : ''}`}>
            <BellIcon size={15} />
          </span>
          <span className={styles.rowTriggerText}>
            <span className={styles.rowTriggerLabel}>Notifications</span>
            <span className={styles.rowTriggerSub}>{rowSub}</span>
          </span>
          <ChevronRight size={14} className={styles.rowTriggerChev} aria-hidden />
        </button>
      ) : (
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
      )}

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
              <span className={styles.headTitle}>Score alerts</span>
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
            ) : prefs.state === 'signedOut' ? (
              <div className={styles.explain}>
                <p className={styles.explainText}>
                  Following and live scores work without an account. <strong>Score alerts are what
                  signing in gets you</strong> — a push when your teams&rsquo; games go live, on every
                  device you sign in on.
                </p>
                <button
                  type="button"
                  className="btn btn-lime btn-sm"
                  onClick={() => router.push(`/auth/login?next=${encodeURIComponent(pathname || '/')}`)}
                >
                  Sign in
                </button>
              </div>
            ) : (
              <>
                <p className={styles.sub}>For every team you follow, on every event.</p>

                <div className={styles.rows}>
                  <Row
                    label="Game alerts"
                    desc="Live scores & finals for your teams"
                    on={optimistic.gameAlerts ?? (ready && prefs.prefs.gameAlerts)}
                    disabled={busy || !ready}
                    onToggle={() => ready && applyPref('gameAlerts', !prefs.prefs.gameAlerts)}
                  />
                  <Row
                    label="Event news"
                    desc="Rain delays & day-of updates"
                    on={optimistic.eventNews ?? (ready && prefs.prefs.eventNews)}
                    disabled={busy || !ready}
                    onToggle={() => ready && applyPref('eventNews', !prefs.prefs.eventNews)}
                  />
                </div>

                {error && <p className={styles.error}>{error}</p>}

                <div className={styles.foot}>
                  {busy ? (
                    <span className={styles.working}><Loader2 size={14} className={styles.spin} /> Working…</span>
                  ) : deviceReady ? (
                    <span className={styles.onNote}><Check size={14} /> This device receives alerts</span>
                  ) : (
                    <button
                      type="button"
                      className={`btn btn-lime btn-sm ${styles.cta}`}
                      onClick={enableDevice}
                      disabled={!ready}
                    >
                      Turn on for this device
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => router.push('/account/notifications?focus=fan')}
                  >
                    <Settings size={12} aria-hidden /> All settings
                  </button>
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
  label, desc, on, disabled, onToggle,
}: {
  label: string;
  desc: string;
  on: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.rowLabel}>{label}</span>
        <span className={styles.rowDesc}>{desc}</span>
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
