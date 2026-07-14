'use client';
/**
 * components/consumer/AccountSignOutButton.tsx — the consumer shell's sign-out
 * (Account tab). Every other shell (admin, coaches, volunteer, platform) has one;
 * this was the gap for fan accounts. Full page load to /discover afterwards so
 * all client state (context, module caches, sheets) resets cleanly.
 */
import { useState } from 'react';
import { signOut } from '@/lib/auth';
import styles from './ConsumerPage.module.css';

export default function AccountSignOutButton() {
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
    } finally {
      window.location.assign('/discover');
    }
  }

  return (
    <button
      type="button"
      className={`${styles.ctaGhost} ${styles.blockBtn}`}
      onClick={handleSignOut}
      disabled={busy}
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
