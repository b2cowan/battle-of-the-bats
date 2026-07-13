'use client';
/**
 * components/LegacyInstallBanner.tsx
 *
 * Soft "get the new app" nudge for anyone still running an OLD, per-tournament /
 * scorekeeper PWA install (retired in unified-app Phase 0). Those legacy installs
 * launched at a deep, scoped start_url with `?pwa=1`; the ONE unified app launches
 * at `/?source=pwa` scope '/'. A changed manifest id never migrates an existing
 * install in place, so an old icon keeps working but is frozen — this banner points
 * the user to the browser to install the current app.
 *
 * Heuristic (deliberately light — near-zero installed base, "do not over-invest"):
 * show only when running standalone AND the launch carried the legacy `?pwa=1`
 * marker (remembered for the session so it survives in-app navigation). The new
 * unified app never sets `pwa=1`, so it never triggers this.
 */
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const DISMISS_KEY = 'flhq-legacy-install-dismissed';
const SESSION_FLAG = 'flhq-legacy-pwa';
const DISMISS_MS = 180 * 24 * 60 * 60 * 1000; // 6 months — this is a one-time transition nudge

export default function LegacyInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const standalone =
        window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
        (window.navigator as { standalone?: boolean }).standalone === true;
      if (!standalone) return;

      // Legacy per-tournament/scorekeeper installs launched with ?pwa=1. Remember it
      // for the session so the banner survives navigation away from the launch URL.
      const isLegacyLaunch =
        new URLSearchParams(window.location.search).get('pwa') === '1' ||
        sessionStorage.getItem(SESSION_FLAG) === '1';
      if (new URLSearchParams(window.location.search).get('pwa') === '1') {
        sessionStorage.setItem(SESSION_FLAG, '1');
      }
      if (!isLegacyLaunch) return;

      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw && Date.now() - parseInt(raw, 10) < DISMISS_MS) return;

      setShow(true);
    } catch {
      /* storage/matchMedia unavailable — no banner */
    }
  }, []);

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      role="complementary"
      aria-label="App update available"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.5rem 0.9rem',
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        background: '#111827',
        borderBottom: '1px solid rgba(217,249,157,0.35)',
        fontFamily: 'var(--font-data, monospace)',
        fontSize: '0.72rem',
        color: '#F1F5F9',
      }}
    >
      <span style={{ flex: '1 1 auto', minWidth: 0 }}>
        You&rsquo;re on an older version of this app.{' '}
        <a
          href="/discover"
          target="_blank"
          rel="noopener"
          style={{ color: '#D9F99D', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          Get the new FieldLogicHQ →
        </a>
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          background: 'transparent',
          border: 'none',
          color: 'rgba(148,163,184,0.8)',
          cursor: 'pointer',
          display: 'flex',
          padding: 2,
        }}
      >
        <X size={15} />
      </button>
    </div>
  );
}
