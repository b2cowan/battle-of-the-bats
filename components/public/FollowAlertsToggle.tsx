'use client';
/**
 * components/public/FollowAlertsToggle.tsx
 * Anonymous fan opt-in for push score alerts on the team they follow. Only
 * rendered when the tournament's plan includes `fan_score_alerts` (Tournament
 * Plus+). Subscribes the browser to push and registers a row keyed to
 * (endpoint, tournamentId) via the anonymous fan-push API.
 *
 * Three honesty fixes live here:
 *  - J6-048: on a normal iPhone tab (push needs Add-to-Home-Screen on iOS 16.4+),
 *    show an explainer instead of a blank/dead button.
 *  - J6-050: "Alerts on" reflects the LIVE subscription + permission, not just a
 *    stale localStorage flag.
 */
import { useEffect, useRef, useState } from 'react';
import { Bell, BellRing, BellOff, BellPlus, Loader2 } from 'lucide-react';
import { getCurrentPushEndpoint, isPushSupported, PushPermissionError } from '@/lib/push-client';
import { isIOSLike, isStandalonePWA } from '@/lib/device';
import {
  clearFanAlertsOptIn,
  enableFanAlerts,
  fanAlertsKey,
  notifyFanAlertsChange,
  readFanAlertsOptIn,
  verifyFanAlertsLive,
} from '@/lib/fan-alerts';
import styles from './FollowAlertsToggle.module.css';

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  tournamentId: string;
  team: { id: string; name: string };
  /**
   * 'pill' renders the toggle as a compact pill matching the sibling
   * "My Team Games" / "Add to Calendar" follow-actions — used in the mobile
   * strip so all three read as one tidy row. 'default' (the desktop rail +
   * anywhere else) keeps the inline `btn` form.
   */
  variant?: 'default' | 'pill';
}

type State = 'off' | 'pending' | 'on' | 'error';

export default function FollowAlertsToggle({ orgSlug, tournamentSlug, tournamentId, team, variant = 'default' }: Props) {
  const pill = variant === 'pill';
  const iconSize = pill ? 12 : 14;
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
  const [state, setState] = useState<State>('off');
  const [msg, setMsg] = useState('');
  // Mirror state into a ref so the effect's sync() can read the LIVE value without
  // re-subscribing — used to skip work while an enable()/disable() is in flight.
  const stateRef = useRef<State>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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
    const sync = () => {
      // An enable()/disable() is mid-flight (it owns the final state). Skip — its
      // own success path dispatches fl-fan-alerts-change, and acting here would
      // prematurely clear the pending spinner / launch a spurious verify.
      if (stateRef.current === 'pending') return;
      const stored = readFanAlertsOptIn(orgSlug, tournamentSlug);
      if (!stored) {
        setState(prev => (prev === 'on' ? 'off' : prev));
        return;
      }
      // Optimistically show ON from the stored opt-in (no flicker for the common,
      // valid case)…
      setState('on');
      // …then verify against the LIVE subscription + permission and drop back to
      // OFF if it no longer holds, so we never show a confident "Alerts on" while
      // pushes have silently stopped (J6-050).
      void (async () => {
        const live = await verifyFanAlertsLive(stored);
        if (!live) {
          clearFanAlertsOptIn(orgSlug, tournamentSlug);
          notifyFanAlertsChange();
          setState('off');
          return;
        }
        // The followed team changed while alerts were on — move the server row.
        if (stored.teamId && stored.teamId !== team.id) {
          try {
            await enableFanAlerts({ orgSlug, tournamentSlug, tournamentId, team });
          } catch {
            /* best-effort re-point; the toggle stays usable */
          }
        }
      })();
    };
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === fanAlertsKey(orgSlug, tournamentSlug)) sync();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('fl-fan-alerts-change', sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('fl-fan-alerts-change', sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, tournamentSlug, tournamentId, team.id]);

  async function enable() {
    setState('pending');
    setMsg('');
    try {
      await enableFanAlerts({ orgSlug, tournamentSlug, tournamentId, team });
      setState('on');
    } catch (err) {
      const reason = err instanceof PushPermissionError ? err.reason : 'failed';
      setMsg(
        reason === 'denied'
          ? 'Notifications are blocked — enable them in your browser settings.'
          : err instanceof Error
            ? err.message
            : 'Could not enable alerts.',
      );
      setState('error');
    }
  }

  async function disable() {
    setState('pending');
    try {
      let endpoint = readFanAlertsOptIn(orgSlug, tournamentSlug)?.endpoint ?? null;
      endpoint = endpoint ?? (await getCurrentPushEndpoint());
      if (endpoint) {
        await fetch('/api/public/fan-push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint, tournamentId }),
        });
      }
      clearFanAlertsOptIn(orgSlug, tournamentSlug);
      notifyFanAlertsChange();
      setState('off');
    } catch {
      // Even if the network call fails, treat it as off locally.
      clearFanAlertsOptIn(orgSlug, tournamentSlug);
      notifyFanAlertsChange();
      setState('off');
    }
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

  if (state === 'pending') {
    return (
      <button type="button" className={btnClass('btn-ghost')} disabled>
        <Loader2 size={iconSize} /> Working…
      </button>
    );
  }

  if (state === 'on') {
    return (
      <button type="button" className={btnClass('btn-lime')} onClick={disable}>
        <BellRing size={iconSize} /> Alerts on
      </button>
    );
  }

  return (
    <>
      <button type="button" className={btnClass('btn-ghost')} onClick={enable}>
        {state === 'error' ? <BellOff size={iconSize} /> : <Bell size={iconSize} />} {offLabel}
      </button>
      {state === 'error' && msg && (
        <span style={{ fontSize: '0.7rem', color: 'var(--white-55)', flexBasis: '100%' }}>{msg}</span>
      )}
    </>
  );
}
