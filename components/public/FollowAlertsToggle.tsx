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
import { syncFollowToAccount } from '@/lib/follow';
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
  /** Extra classes appended to the default-variant button — caller theming
   *  (e.g. the team page collapses it to a 44px icon circle on phones). */
  className?: string;
  /** Class for the label span so callers can hide it responsively; the label
   *  always also rides in aria-label/title, so an icon-collapsed button keeps
   *  its accessible name. */
  labelClassName?: string;
}

export default function FollowAlertsToggle({ orgSlug, tournamentSlug, team, variant = 'default', className, labelClassName }: Props) {
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
      : ['btn', color, 'btn-sm', className].filter(Boolean).join(' ');
  const labelProps = (label: string) => ({ 'aria-label': label, title: label });
  const labelSpan = (label: string) => <span className={labelClassName}>{label}</span>;
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
    // deviceReady is per-instance state seeded at mount — when a SIBLING mounted
    // instance registers this device (e.g. the page-row bell while the dock's
    // panel bell is open), it broadcasts so every instance flips to "on"
    // together instead of drifting until reload. (The account pref already
    // syncs via useFanAlertPrefs; this covers the device half of the gate.)
    const onDeviceChange = (e: Event) => {
      setDeviceReady((e as CustomEvent<boolean>).detail === true);
    };
    window.addEventListener('fl-push-device-change', onDeviceChange);
    return () => {
      cancelled = true;
      window.removeEventListener('fl-push-device-change', onDeviceChange);
    };
  }, []);

  // Best-effort: make sure THIS team's follow is on the account (a device-only
  // follow made while signed out wouldn't be) — the shared mirror is idempotent.
  function mirrorFollowToAccount() {
    syncFollowToAccount('follow', { teamId: team.id, orgSlug, tournamentSlug });
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
      window.dispatchEvent(new CustomEvent<boolean>('fl-push-device-change', { detail: true }));
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
        <button type="button" className={btnClass('btn-ghost')} onClick={() => setIosHint(v => !v)} {...labelProps(offLabel)}>
          <BellPlus size={iconSize} /> {labelSpan(offLabel)}
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
      <button type="button" className={btnClass('btn-ghost')} disabled {...labelProps(pending ? 'Working…' : offLabel)}>
        <Loader2 size={iconSize} /> {labelSpan(pending ? 'Working…' : offLabel)}
      </button>
    );
  }

  if (prefs.state === 'signedOut') {
    return (
      <button
        type="button"
        className={btnClass('btn-ghost')}
        onClick={() => router.push(`/auth/login?next=${encodeURIComponent(pathname || '/')}`)}
        {...labelProps('Sign in for score alerts')}
      >
        {/* S1: the sign-in ask must be VISIBLE in the pill too — with only aria/title
            carrying it, the signed-out pill was pixel-identical to the signed-in
            alerts-off state and read as a broken button. Shortened for pill width. */}
        <Bell size={iconSize} /> {labelSpan(pill ? 'Sign in for alerts' : 'Sign in for score alerts')}
      </button>
    );
  }

  // "Alerts on" only when the account wants them AND this device can receive them.
  if (prefs.prefs.gameAlerts && deviceReady) {
    return (
      <>
        <button type="button" className={btnClass('btn-lime')} onClick={turnOff} {...labelProps('Score alerts on — turn off')}>
          <BellRing size={iconSize} /> {labelSpan('Alerts on')}
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
      <button type="button" className={btnClass('btn-ghost')} onClick={turnOn} {...labelProps(offLabel)}>
        {msg ? <BellOff size={iconSize} /> : <Bell size={iconSize} />} {labelSpan(offLabel)}
      </button>
      {msg && (
        <span style={{ fontSize: '0.7rem', color: 'var(--white-55)', flexBasis: '100%' }}>{msg}</span>
      )}
    </>
  );
}
