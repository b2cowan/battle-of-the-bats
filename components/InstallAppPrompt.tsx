'use client';
/**
 * components/InstallAppPrompt.tsx
 * Dismissible "add to home screen" prompt. Used in two contexts (see callers):
 *  - Fan app  — mounted on public tournament pages (per-tournament manifest).
 *  - Member app — mounted in authenticated shells (root /home-scoped manifest).
 *
 * iOS has no install API, so it shows manual instructions; Android/desktop
 * Chromium capture `beforeinstallprompt` and offer a one-tap Install button.
 * The installed app's name/icon/start_url come from whichever <link rel="manifest">
 * the host page declares — this component only renders the prompt.
 */
import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import styles from './InstallAppPrompt.module.css';

const DISMISS_MS = 90 * 24 * 60 * 60 * 1000;

/** The non-standard install-prompt event fired by Chromium browsers. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function ShareIcon() {
  return (
    <svg
      width="13" height="15" viewBox="0 0 13 15"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline', verticalAlign: 'middle', marginBottom: 2 }}
      aria-hidden
    >
      <path d="M6.5 1v8M6.5 1L4 3.5M6.5 1L9 3.5"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.5 9v4h10V9"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Mode = 'hidden' | 'ios' | 'ios-chrome' | 'android';

interface Props {
  /** Name shown in the prompt copy (the installed name comes from the manifest). */
  appName?: string;
  /** One-line value prop shown on Android. */
  subtitle?: string;
  /** localStorage key so different contexts dismiss independently. */
  dismissKey?: string;
  /** Branded icon for the prompt (e.g. the tournament logo); falls back to the FLHQ PWA icon. */
  iconUrl?: string | null;
}

export default function InstallAppPrompt({
  appName = 'FieldLogicHQ',
  subtitle = 'Add it to your home screen for one-tap access.',
  dismissKey = 'flhq-install-dismissed',
  iconUrl = null,
}: Props) {
  const [mode, setMode] = useState<Mode>('hidden');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;

    const raw = localStorage.getItem(dismissKey);
    if (raw && Date.now() - parseInt(raw, 10) < DISMISS_MS) return;

    // Already installed / running standalone — nothing to prompt.
    if ((window.navigator as { standalone?: boolean }).standalone === true) return;
    if (window.matchMedia?.('(display-mode: standalone)')?.matches) return;

    // iOS has no install API — show manual Add-to-Home-Screen instructions.
    if (/iPhone|iPad|iPod/i.test(ua)) {
      setMode(/CriOS/i.test(ua) ? 'ios-chrome' : 'ios');
      return;
    }

    // Android / desktop Chromium: wait for the native install prompt.
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      // Chromium re-fires `beforeinstallprompt` on client-side (History API)
      // navigations. The host layout stays mounted across those navigations,
      // so without re-checking the dismissal here the banner re-appears on
      // every screen change even after the user dismissed it.
      const stored = localStorage.getItem(dismissKey);
      if (stored && Date.now() - parseInt(stored, 10) < DISMISS_MS) return;
      setDeferred(e as BeforeInstallPromptEvent);
      setMode('android');
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, [dismissKey]);

  function dismiss() {
    localStorage.setItem(dismissKey, String(Date.now()));
    setMode('hidden');
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    setDeferred(null);
    setMode('hidden');
  }

  if (mode === 'hidden') return null;

  return (
    <div className={styles.banner} role="complementary" aria-label="Install app prompt">
      <img src={iconUrl || '/icons/pwa-192.png'} alt={appName} className={styles.icon} />

      <div className={styles.body}>
        <p className={styles.title}>Install {appName}</p>
        <p className={styles.instructions}>
          {mode === 'android' ? (
            <>{subtitle}</>
          ) : mode === 'ios-chrome' ? (
            <>Tap <strong>⋯</strong> in the top-right, then <strong>Add to Home Screen</strong></>
          ) : (
            <>Tap <strong>Share</strong> <ShareIcon /> below, then <strong>Add to Home Screen</strong></>
          )}
        </p>
      </div>

      {mode === 'android' && (
        <button className={styles.install} onClick={install}>
          <Download size={14} /> Install
        </button>
      )}

      <button className={styles.dismiss} onClick={dismiss} aria-label="Dismiss install prompt">
        <X size={15} />
      </button>
    </div>
  );
}
