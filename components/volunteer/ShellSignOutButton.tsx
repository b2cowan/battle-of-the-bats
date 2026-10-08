'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth';
import styles from './DayOfShell.module.css';

/**
 * Sign-out control for the volunteer shells (scorekeeper + gate check-in) — J8-001.
 *
 * Both shell headers previously rendered `<Link href="/auth/logout">`, but no /auth/logout route
 * exists, so tapping it 404'd — leaving a volunteer (often on a borrowed/shared phone) with no way
 * to end their session (a privacy hole, not just a dead link). This signs out via the same
 * `signOut()` client call every other shell uses, then sends them to login.
 *
 * Shown above 640px only (the Account sheet carries Sign out on a phone), at 44px — a tablet at the
 * scoring table is a touch screen (Stage 6, A27; it was 15px tall). Its look is the shell's `.signOut`.
 */
export default function ShellSignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    if (loading) return;
    setLoading(true);
    await signOut();
    router.replace('/auth/login');
    router.refresh();
  }

  return (
    <button type="button" className={styles.signOut} onClick={handleSignOut} disabled={loading}>
      {/* "Sign out" — the Account sheet's spelling. */}
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
