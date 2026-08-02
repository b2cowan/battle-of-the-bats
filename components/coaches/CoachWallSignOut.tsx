'use client';
/**
 * components/coaches/CoachWallSignOut.tsx — sign-out for the premium portal's "not assigned" wall.
 *
 * The wall is the one portal screen with no sidebar and no bottom nav, so the shell's usual
 * sign-out never mounts there. Before R2 (top-nav audit D2, 2026-08-01) that left a coach whose
 * assignment had been revoked on a screen with no way to sign out at all — the worst case of the
 * "is this place still real?" question, on the account most likely to be on a borrowed phone.
 *
 * Deliberately its own small control rather than a shared one: each shell's sign-out wears its
 * own skin (volunteer = mono HUD, consumer = warm settings row, auth = submit button), and this
 * one reads the portal's tokens so it flips warm/dark with the account theme like the wall around
 * it. Full page load to /discover afterwards so every client cache and context resets cleanly.
 */
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { signOut } from '@/lib/auth';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

export default function CoachWallSignOut() {
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
    } finally {
      window.location.assign('/discover');
    }
  }

  return (
    <button type="button" className={styles.notAssignedDoor} onClick={handleSignOut} disabled={busy}>
      <LogOut size={15} aria-hidden />
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
