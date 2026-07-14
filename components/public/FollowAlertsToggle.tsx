'use client';
/**
 * components/public/FollowAlertsToggle.tsx
 * The in-context "score alerts" control on public tournament pages. Only rendered
 * when the tournament's plan includes `fan_score_alerts` (Tournament Plus+).
 *
 * Slice 3 (Business Decisions Log 2026-07-14): alerts require a signed-in
 * account. Signed out, this is a "Sign in for score alerts" pitch that returns
 * to this page after login. Signed in, it drives the ACCOUNT-level game-alerts
 * switch (global across every followed team — the same switch as the Followed
 * teams card on /account/notifications, via the shared lib/fan-alert-prefs-client
 * state) and registers THIS device for push in the same gesture.
 *
 * Honesty carry-overs:
 *  - J6-048: on a normal iPhone tab (push needs Add-to-Home-Screen on iOS 16.4+),
 *    show an explainer instead of a blank/dead button.
 */
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, BellRing, BellOff, BellPlus, Loader2 } from 'lucide-react';
import { isPushSupported, getCurrentPushEndpoint } from '@/lib/push-client';
import { isIOSLike, isStandalonePWA } from '@/lib/device';
import { useFanAlertPrefs, saveFanAlertPref } from '@/lib/fan-alert-prefs-client';
import styles from './FollowAlertsToggle.module.css';

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  team: { id: string; name: string };
  /**
   * 'pill' renders the toggle as a compact pill matching the sibling
   * "My Team Games" / "Add to Calendar" follow-actions — used in the mobile
   * strip so all three read as one tidy row. 'default' (the desktop rail +
   * anywhere else) keeps the inline `btn` form.
   */
  variant?: 'default' | 'pill';
}

export default function FollowAlertsToggle({ orgSlug, tournamentSlug, team, variant = 'default' }: Props) {
  const pill = variant === 'pill';
  const iconSize = pill ? 12 : 14;
  const pathname = usePathname();
  const router = useRouter();
  // Shorter label in the compact pill row so three actions fit inline on a phone.
  const offLabel = pill ? 'Score alerts' : 'Get score alerts';
  // In pill mode use ONLY the local pill class (the global `btn` padding/colour
  // would override the compact look); 'btn-lime' maps to the lime "on" state.
  const btnClass = (color: string) =>
    pill
      ? [styles.pill, color === 'btn-lime' ? styles.pillOn : ''].filter(Boolean).join(' ')
      : ['btn', color, 'btn-sm'].filter(Boolean).join(' ');
  const [supported, setSupported] = useState(true);
  // iOS push only works once the app is on the home screen — surface that instead
  // of rendering nothing (J6-048).
  const [iosInstall, setIosInstall] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const prefs = useFanAlertPrefs();
  // Whether THIS browser holds a live push subscription. The account pref
  // defaults ON, so "Alerts on" must also require the device to actually be
  // receiving — never a confident "on" while pushes silently can't arrive (J6-050).
  const [deviceReady, setDeviceReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    // iPhone/iPad in a normal browser tab: push is unavailable until the page is
    // added to the home screen (iOS 16.4+, standalone only). Covers iOS <16.4 (no
    // push APIs), 16.4+ non-standalone (APIs present but permission never grants),
    // AND iPadOS desktop-mode (UA reads as macOS) — show the explainer rather than a
    // dead button (J6-048).
    if (isIOSLike() && !isStandalonePWA()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIosInstall(true);
      return;
    }
    if (!isPushSupported()) {
      setSupported(false);
      return;
    }
    let cancelled = false;
    void getCurrentPushEndpoint().then(endpoint => {
      if (cancelled) return;
      setDeviceReady(!!endpoint && typeof Notification !== 'undefined' && Notification.permission === 'granted');
    });
    return () => { cancelled = true; };
  }, []);

  // Best-effort: make sure THIS team's follow is on the account (a device-only
  // follow made while signed out wouldn't be) — idempotent.
  function mirrorFollowToAccount() {
    void fetch('/api/consumer/follows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'follow', teamId: team.id, orgSlug, tournamentSlug }),
    }).catch(() => {});
  }

  async function turnOn() {
    setPending(true);
    setMsg('');
    // Always write the account switch, even when the cached prefs SAY it's on —
    // the cached read can be a fail-open default after a transient API error, and
    // the POST is idempotent, so this never silently skips a needed write. The
    // in-context button should also get THIS device working — a device
    // registration failure is a hard error, not a quiet account-only save.
    const result = await saveFanAlertPref('gameAlerts', true, { strictDevice: true });
    if (result.ok) {
      setDeviceReady(true);
      mirrorFollowToAccount();
    } else {
      setMsg(result.error ?? 'Could not update alerts.');
    }
    setPending(false);
  }

  async function turnOff() {
    setPending(true);
    setMsg('');
    // Account-wide off — the same global switch as the Followed teams card
    // (one setting, everywhere; per-team levels were deliberately deferred).
    const result = await saveFanAlertPref('gameAlerts', false);
    if (!result.ok) setMsg(result.error ?? 'Could not update alerts.');
    setPending(false);
  }

  // iPhone in a normal tab: an honest "add to home screen first" explainer so the
  // marquee Plus feature is at least discoverable on the dominant parent platform.
  if (iosInstall) {
    return (
      <>
        <button type="button" className={btnClass('btn-ghost')} onClick={() => setIosHint(v => !v)}>
          <BellPlus size={iconSize} /> {offLabel}
        </button>
        {iosHint && (
          <span style={{ display: 'block', width: '100%', fontSize: '0.7rem', color: 'var(--white-55)' }}>
            On iPhone or iPad, tap Share then “Add to Home Screen”, then open this app to turn on alerts.
          </span>
        )}
      </>
    );
  }

  if (!supported) return null;

  if (prefs.state === 'checking' || pending) {
    return (
      <button type="button" className={btnClass('btn-ghost')} disabled>
        <Loader2 size={iconSize} /> {pending ? 'Working…' : offLabel}
      </button>
    );
  }

  if (prefs.state === 'signedOut') {
    return (
      <button
        type="button"
        className={btnClass('btn-ghost')}
        onClick={() => router.push(`/auth/login?next=${encodeURIComponent(pathname || '/')}`)}
      >
        <Bell size={iconSize} /> {pill ? 'Score alerts' : 'Sign in for score alerts'}
      </button>
    );
  }

  // "Alerts on" only when the account wants them AND this device can receive them.
  if (prefs.prefs.gameAlerts && deviceReady) {
    return (
      <>
        <button type="button" className={btnClass('btn-lime')} onClick={turnOff}>
          <BellRing size={iconSize} /> Alerts on
        </button>
        {/* A failed turn-OFF lands back here — surface its error instead of a silent no-op. */}
        {msg && (
          <span style={{ fontSize: '0.7rem', color: 'var(--white-55)', flexBasis: '100%' }}>{msg}</span>
        )}
      </>
    );
  }

  return (
    <>
      <button type="button" className={btnClass('btn-ghost')} onClick={turnOn}>
        {msg ? <BellOff size={iconSize} /> : <Bell size={iconSize} />} {offLabel}
      </button>
      {msg && (
        <span style={{ fontSize: '0.7rem', color: 'var(--white-55)', flexBasis: '100%' }}>{msg}</span>
      )}
    </>
  );
}
