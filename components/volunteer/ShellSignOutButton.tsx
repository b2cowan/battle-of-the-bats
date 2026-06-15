'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth';

/**
 * Sign-out control for the volunteer shells (scorekeeper + gate check-in) — J8-001.
 *
 * Both shell headers previously rendered `<Link href="/auth/logout">`, but no /auth/logout route
 * exists, so tapping it 404'd — leaving a volunteer (often on a borrowed/shared phone) with no way
 * to end their session (a privacy hole, not just a dead link). This signs out via the same
 * `signOut()` client call every other shell uses, then sends them to login.
 *
 * Styled to match the header's existing "Sign Out" link (the shells use inline styles, not CSS
 * modules), so the visual stays identical — only the dead Link becomes a working button.
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
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      style={{
        fontFamily: 'var(--font-data)',
        fontSize: '0.7rem',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: '#94A3B8',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: loading ? 'default' : 'pointer',
        flexShrink: 0,
      }}
    >
      {loading ? 'Signing out…' : 'Sign Out'}
    </button>
  );
}
