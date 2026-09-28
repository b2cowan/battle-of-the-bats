'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth';
import { useKitStyle } from '@/components/admin/AdminKitProvider';
import { DAYOF_KIT } from './day-of-kit';

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
  // Admin Design Continuity slice 5: the kit's patch while the switch is on (the shell's layout says so),
  // today's style object untouched while it is off.
  const kx = useKitStyle();

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
      style={kx({
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
      }, DAYOF_KIT.signOut)}
    >
      {/* "Sign out" — the Account sheet's spelling. Drawn in capitals with the switch off, so the two
          only disagreed once the kit showed them in mixed case. */}
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
