'use client';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './IOSInstallBanner.module.css';

const DISMISS_KEY = 'flhq-ios-install-dismissed';
const DISMISS_MS  = 90 * 24 * 60 * 60 * 1000;

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

export default function IOSInstallBanner() {
  const [visible,  setVisible]  = useState(false);
  const [isChrome, setIsChrome] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    if (!/iPhone|iPad|iPod/i.test(ua)) return;
    if ((window.navigator as any).standalone === true) return;

    const raw = localStorage.getItem(DISMISS_KEY);
    if (raw && Date.now() - parseInt(raw, 10) < DISMISS_MS) return;

    setIsChrome(/CriOS/i.test(ua));
    setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className={styles.banner} role="complementary" aria-label="Install app prompt">
      <img src="/icons/pwa-192.png" alt="FieldLogicHQ" className={styles.icon} />

      <div className={styles.body}>
        <p className={styles.title}>Install FieldLogicHQ</p>
        <p className={styles.instructions}>
          {isChrome ? (
            <>Tap <strong>⋯</strong> in the top-right, then <strong>Add to Home Screen</strong></>
          ) : (
            <>Tap <strong>Share</strong> <ShareIcon /> below, then <strong>Add to Home Screen</strong></>
          )}
        </p>
      </div>

      <button className={styles.dismiss} onClick={dismiss} aria-label="Dismiss install prompt">
        <X size={15} />
      </button>
    </div>
  );
}
