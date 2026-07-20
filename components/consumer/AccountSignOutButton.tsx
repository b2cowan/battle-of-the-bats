'use client';
/**
 * components/consumer/AccountSignOutButton.tsx — the consumer shell's sign-out (Account tab).
 * Every other shell (admin, coaches, volunteer, platform) has one; this was the gap for fan
 * accounts. Full page load to /discover afterwards so all client state (context, module caches,
 * sheets) resets cleanly. Rendered as a warm settings row (Phase 5) — the styles live with the
 * Account tab it's the only user of.
 */
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { signOut } from '@/lib/auth';
import styles from '@/app/(consumer)/account/account.module.css';

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
      className={`${styles.row} ${styles.signOutRow}`}
      onClick={handleSignOut}
      disabled={busy}
    >
      <span className={styles.rowIcon}><LogOut size={19} aria-hidden /></span>
      <span className={styles.rowLabel}>{busy ? 'Signing out…' : 'Sign out'}</span>
    </button>
  );
}
