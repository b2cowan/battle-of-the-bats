'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth';
import styles from '../auth.module.css';

/** Sign-out button for the suspended page (J10-019) — the one action a suspended user can take. */
export default function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    await signOut();
    router.replace('/auth/login');
    router.refresh();
  }

  return (
    <button type="button" className={styles.submitBtn} onClick={handleSignOut} disabled={loading}>
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
