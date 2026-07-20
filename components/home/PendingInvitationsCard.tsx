'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Check, X } from 'lucide-react';
import styles from './PendingInvitationsCard.module.css';

export type PendingInvite = {
  memberId: string;
  orgSlug: string | null;
  orgName: string | null;
  role: string;
};

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  staff: 'Staff member',
  official: 'Scorekeeper',
  league_admin: 'League administrator',
  league_registrar: 'League registrar',
  treasurer: 'Treasurer',
  coach: 'Coach',
  owner: 'Owner',
};

function roleLabel(role: string) {
  return ROLE_LABEL[role] ?? role;
}

export default function PendingInvitationsCard({ invitations }: { invitations: PendingInvite[] }) {
  const router = useRouter();
  const [items, setItems] = useState(invitations);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (items.length === 0) return null;

  async function respond(memberId: string, action: 'accept' | 'decline') {
    setError('');
    setBusyId(memberId);
    try {
      const res = await fetch(`/api/auth/invitations/${memberId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong. Please try again.');
        setBusyId(null);
        return;
      }
      if (action === 'accept' && data?.orgSlug) {
        // Land them in the org. Scorekeepers (official) go to the scorekeeper view,
        // everyone else to the admin shell — mirrors the accept-invite page redirect.
        const dest = data.role === 'official'
          ? `/${data.orgSlug}/scorekeeper`
          : `/${data.orgSlug}/admin`;
        router.push(dest);
        router.refresh();
        return;
      }
      // Decline (or accept with no slug): drop it from the list in place.
      setItems(prev => prev.filter(i => i.memberId !== memberId));
      setBusyId(null);
      // Nudge the persistent nav's pending-invites badge to refetch — it doesn't remount on this
      // in-place resolve, so it would otherwise show a stale count (usePendingInviteCount listens).
      window.dispatchEvent(new Event('flhq:invites-changed'));
      router.refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
      setBusyId(null);
    }
  }

  return (
    <section className={styles.wrap} aria-label="Pending invitations">
      <div className={styles.heading}>
        <Mail size={14} strokeWidth={2} aria-hidden />
        <span>{items.length === 1 ? 'You have an invitation' : `You have ${items.length} invitations`}</span>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.list}>
        {items.map(invite => {
          const busy = busyId === invite.memberId;
          return (
            <div key={invite.memberId} className={styles.item}>
              <div className={styles.info}>
                <div className={styles.orgName}>{invite.orgName ?? invite.orgSlug ?? 'An organization'}</div>
                <div className={styles.roleLine}>
                  Invited as <strong>{roleLabel(invite.role)}</strong>
                </div>
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.accept}
                  disabled={busy}
                  onClick={() => respond(invite.memberId, 'accept')}
                >
                  <Check size={14} strokeWidth={2.5} aria-hidden />
                  {busy ? 'Working…' : 'Accept'}
                </button>
                <button
                  type="button"
                  className={styles.decline}
                  disabled={busy}
                  onClick={() => respond(invite.memberId, 'decline')}
                  aria-label={`Decline invitation to ${invite.orgName ?? 'organization'}`}
                >
                  <X size={14} strokeWidth={2.5} aria-hidden />
                  Decline
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
