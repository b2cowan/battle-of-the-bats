'use client';
/**
 * components/public/FollowAlertsToggle.tsx
 * Anonymous fan opt-in for push score alerts on the team they follow. Only
 * rendered when the tournament's plan includes `fan_score_alerts` (Tournament
 * Plus+). Subscribes the browser to push and registers a row keyed to
 * (endpoint, tournamentId) via the anonymous fan-push API.
 */
import { useEffect, useState } from 'react';
import { Bell, BellRing, BellOff, Loader2 } from 'lucide-react';
import {
  isPushSupported,
  subscribeToPush,
  getCurrentPushEndpoint,
  PushPermissionError,
} from '@/lib/push-client';

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  tournamentId: string;
  team: { id: string; name: string };
}

type State = 'off' | 'pending' | 'on' | 'error';

function alertsKey(orgSlug: string, tournamentSlug: string) {
  return `fl_fan_alerts_${orgSlug}_${tournamentSlug}`;
}

/** Notify other toggle instances on the same tab (the native `storage` event
 *  only fires cross-tab) so the rail/scorebug/home toggles stay in sync. */
function notifyAlertsChange() {
  window.dispatchEvent(new CustomEvent('fl-fan-alerts-change'));
}

export default function FollowAlertsToggle({ orgSlug, tournamentSlug, tournamentId, team }: Props) {
  const [supported, setSupported] = useState(true);
  const [state, setState] = useState<State>('off');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    // Browser-only capabilities + stored opt-in hydrate after first paint, and
    // stay in sync with other toggle instances (storage + same-tab event).
    if (!isPushSupported()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSupported(false);
      return;
    }
    const sync = () => {
      try {
        const raw = localStorage.getItem(alertsKey(orgSlug, tournamentSlug));
        if (raw) {
          const parsed = JSON.parse(raw) as { teamId?: string };
          setState('on');
          // The followed team changed while alerts were on — silently move the
          // server row to the new team.
          if (parsed.teamId && parsed.teamId !== team.id) void register('silent');
        } else {
          setState(prev => (prev === 'on' ? 'off' : prev));
        }
      } catch {
        /* ignore */
      }
    };
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === alertsKey(orgSlug, tournamentSlug)) sync();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('fl-fan-alerts-change', sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('fl-fan-alerts-change', sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, tournamentSlug, team.id]);

  async function register(mode: 'interactive' | 'silent') {
    const sub = await subscribeToPush();
    const res = await fetch('/api/public/fan-push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: sub.keys,
        tournamentId,
        teamId: team.id,
        deviceLabel: sub.deviceLabel,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? 'Could not enable alerts.');
    }
    localStorage.setItem(
      alertsKey(orgSlug, tournamentSlug),
      JSON.stringify({ endpoint: sub.endpoint, teamId: team.id }),
    );
    notifyAlertsChange();
    if (mode === 'interactive') setState('on');
  }

  async function enable() {
    setState('pending');
    setMsg('');
    try {
      await register('interactive');
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
      let endpoint: string | null = null;
      try {
        const raw = localStorage.getItem(alertsKey(orgSlug, tournamentSlug));
        endpoint = raw ? (JSON.parse(raw) as { endpoint?: string }).endpoint ?? null : null;
      } catch {
        /* ignore */
      }
      endpoint = endpoint ?? (await getCurrentPushEndpoint());
      if (endpoint) {
        await fetch('/api/public/fan-push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint, tournamentId }),
        });
      }
      localStorage.removeItem(alertsKey(orgSlug, tournamentSlug));
      notifyAlertsChange();
      setState('off');
    } catch {
      // Even if the network call fails, treat it as off locally.
      localStorage.removeItem(alertsKey(orgSlug, tournamentSlug));
      notifyAlertsChange();
      setState('off');
    }
  }

  if (!supported) return null;

  if (state === 'pending') {
    return (
      <button type="button" className="btn btn-ghost btn-sm" disabled>
        <Loader2 size={14} /> Working…
      </button>
    );
  }

  if (state === 'on') {
    return (
      <button type="button" className="btn btn-lime btn-sm" onClick={disable}>
        <BellRing size={14} /> Alerts on
      </button>
    );
  }

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={enable}>
        {state === 'error' ? <BellOff size={14} /> : <Bell size={14} />} Get score alerts
      </button>
      {state === 'error' && msg && (
        <span style={{ fontSize: '0.7rem', color: 'var(--white-55)', flexBasis: '100%' }}>{msg}</span>
      )}
    </>
  );
}
