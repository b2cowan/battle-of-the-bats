'use client';
/**
 * components/public/AlertsNudge.tsx
 * One-time, dismissible post-install nudge that steers an installed-app follower to
 * turn on score alerts (J6-048, Option B). Catches fans who dismissed the install
 * banner or never found the dock's alerts toggle. Layout-mounted; self-gates to:
 * installed (standalone) PWA · plan includes alerts · push supported · permission
 * not denied · a team is followed · not already opted-in · not already dismissed.
 */
import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { isStandalonePWA } from '@/lib/device';
import { isPushSupported, PushPermissionError } from '@/lib/push-client';
import { readFollowedTeam, type FollowedTeam } from '@/lib/follow';
import { enableFanAlerts, readFanAlertsOptIn } from '@/lib/fan-alerts';
import styles from './AlertsNudge.module.css';

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  tournamentId: string;
  /** Plan gate — true only when the tournament includes fan_score_alerts (Plus+). */
  enabled: boolean;
}

function nudgeKey(orgSlug: string, tournamentSlug: string) {
  return `fl_fan_alerts_nudge_${orgSlug}_${tournamentSlug}`;
}

export default function AlertsNudge({ orgSlug, tournamentSlug, tournamentId, enabled }: Props) {
  const [team, setTeam] = useState<FollowedTeam | null>(null);
  const [visible, setVisible] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const evaluate = () => {
      // The nudge is purely a post-install discovery aid — only inside the app.
      if (!isStandalonePWA() || !isPushSupported()) return setVisible(false);
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return setVisible(false);
      if (readFanAlertsOptIn(orgSlug, tournamentSlug)) return setVisible(false);
      let dismissed = false;
      try {
        dismissed = !!localStorage.getItem(nudgeKey(orgSlug, tournamentSlug));
      } catch {
        /* ignore */
      }
      if (dismissed) return setVisible(false);
      const followed = readFollowedTeam(orgSlug, tournamentSlug);
      if (!followed) return setVisible(false);
      setTeam(followed);
      setVisible(true);
    };
    evaluate();
    window.addEventListener('fl-follow-change', evaluate);
    window.addEventListener('fl-fan-alerts-change', evaluate);
    window.addEventListener('storage', evaluate);
    return () => {
      window.removeEventListener('fl-follow-change', evaluate);
      window.removeEventListener('fl-fan-alerts-change', evaluate);
      window.removeEventListener('storage', evaluate);
    };
  }, [enabled, orgSlug, tournamentSlug]);

  function dismiss() {
    try {
      localStorage.setItem(nudgeKey(orgSlug, tournamentSlug), String(Date.now()));
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  async function enable() {
    if (!team) return;
    setWorking(true);
    try {
      await enableFanAlerts({
        orgSlug,
        tournamentSlug,
        tournamentId,
        team: { id: team.id, name: team.name },
      });
      // Success fires fl-fan-alerts-change → on-screen toggles flip to "Alerts on".
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

  if (!enabled || !visible || !team) return null;

  return (
    <div className={styles.nudge} role="dialog" aria-label="Turn on score alerts">
      <BellRing size={18} className={styles.icon} aria-hidden />
      <div className={styles.body}>
        <p className={styles.title}>Turn on score alerts?</p>
        <p className={styles.sub}>
          Get a push the moment {team.name} scores or finishes.
        </p>
      </div>
      <button type="button" className="btn btn-lime btn-sm" onClick={enable} disabled={working}>
        {working ? 'Working…' : 'Get alerts'}
      </button>
      <button type="button" className={styles.dismiss} onClick={dismiss} aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}
