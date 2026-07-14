'use client';
/**
 * components/public/AlertsNudge.tsx
 * One-time, dismissible post-install nudge (J6-048, Option B) whose remaining job
 * under account-level alerts (Slice 3) is narrow and real: a SIGNED-IN follower
 * whose account wants alerts but whose THIS-DEVICE hasn't granted push permission
 * yet (e.g. a second/new device) gets a one-tap fix. Layout-mounted; self-gates to:
 * installed (standalone) PWA · plan includes alerts · push supported · permission
 * not denied · a team is followed · signed in (a signed-out follower gets the
 * account pitch from FollowAccountNudge instead) · this device not already
 * receiving · not already dismissed.
 */
import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { isStandalonePWA } from '@/lib/device';
import {
  isPushSupported,
  enablePushOnThisDevice,
  getCurrentPushEndpoint,
  PushPermissionError,
} from '@/lib/push-client';
import { readFollowedTeam, type FollowedTeam } from '@/lib/follow';
import { useFanAlertPrefs } from '@/lib/fan-alert-prefs-client';
import styles from './AlertsNudge.module.css';

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  /** Plan gate — true only when the tournament includes fan_score_alerts (Plus+). */
  enabled: boolean;
}

function nudgeKey(orgSlug: string, tournamentSlug: string) {
  return `fl_fan_alerts_nudge_${orgSlug}_${tournamentSlug}`;
}

export default function AlertsNudge({ orgSlug, tournamentSlug, enabled }: Props) {
  const prefs = useFanAlertPrefs();
  const [team, setTeam] = useState<FollowedTeam | null>(null);
  const [visible, setVisible] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    // Alerts require an account (Slice 3) — signed out, FollowAccountNudge owns
    // the pitch; nudging here would dead-end at a sign-in wall. And a fan who
    // explicitly turned Game alerts OFF must not be nudged to register a device
    // that would then receive nothing — respect the account switch.
    if (!enabled || prefs.state !== 'ready' || !prefs.prefs.gameAlerts) return;
    let cancelled = false;
    const evaluate = async () => {
      // The nudge is purely a post-install discovery aid — only inside the app.
      if (!isStandalonePWA() || !isPushSupported()) return setVisible(false);
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return setVisible(false);
      let dismissed = false;
      try {
        dismissed = !!localStorage.getItem(nudgeKey(orgSlug, tournamentSlug));
      } catch {
        /* ignore */
      }
      if (dismissed) return setVisible(false);
      const followed = readFollowedTeam(orgSlug, tournamentSlug);
      if (!followed) return setVisible(false);
      // Already receiving on this device (permission granted + live subscription) — nothing to nudge.
      const endpoint = await getCurrentPushEndpoint();
      if (cancelled) return;
      if (endpoint && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        return setVisible(false);
      }
      setTeam(followed);
      setVisible(true);
    };
    void evaluate();
    const onChange = () => void evaluate();
    window.addEventListener('fl-follow-change', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      cancelled = true;
      window.removeEventListener('fl-follow-change', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [enabled, prefs, orgSlug, tournamentSlug]);

  function dismiss() {
    try {
      localStorage.setItem(nudgeKey(orgSlug, tournamentSlug), String(Date.now()));
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  async function enable() {
    setWorking(true);
    try {
      // Register this device; the account-level switches default to ON, so this is
      // the only step a signed-in follower needs.
      await enablePushOnThisDevice();
      setVisible(false);
    } catch (err) {
      if (err instanceof PushPermissionError && (err.reason === 'denied' || err.reason === 'dismissed')) {
        // The user explicitly refused — don't ask again this install.
        dismiss();
      } else {
        // Transient (network/server) — hide for now, let it reappear next load.
        setVisible(false);
      }
    } finally {
      setWorking(false);
    }
  }

  // Render gate mirrors the effect gate so turning Game alerts off while the
  // nudge is showing hides it immediately (the effect's early return alone
  // would leave a stale `visible` on screen).
  if (!enabled || !visible || !team || prefs.state !== 'ready' || !prefs.prefs.gameAlerts) return null;

  return (
    <div className={styles.nudge} role="dialog" aria-label="Get score alerts on this device">
      <BellRing size={18} className={styles.icon} aria-hidden />
      <div className={styles.body}>
        <p className={styles.title}>Get alerts on this device?</p>
        <p className={styles.sub}>
          A push here the moment {team.name} scores or finishes.
        </p>
      </div>
      <button type="button" className="btn btn-lime btn-sm" onClick={enable} disabled={working}>
        {working ? 'Working…' : 'Turn on'}
      </button>
      <button type="button" className={styles.dismiss} onClick={dismiss} aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}
