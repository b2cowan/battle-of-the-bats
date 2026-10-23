'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth';
import { SystemAction } from '@/components/shared/SystemScreen';

/** Sign-out button for the suspended page (J10-019). The quiet button of the system-screen family: the page has no lime button. */
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
    <SystemAction kind="secondary" onClick={handleSignOut} disabled={loading}>
      {loading ? 'Signing out…' : 'Sign out'}
    </SystemAction>
  );
}
