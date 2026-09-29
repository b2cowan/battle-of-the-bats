'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Check, X } from 'lucide-react';
import { formatStoredDate, orgDayKey } from '@/lib/timezone';
import { roleLabel } from '@/lib/member-access';
import type { ConsumerHomeCoachInvite } from '@/lib/home-following';
import styles from './PendingInvitationsCard.module.css';

export type PendingInvite = {
  memberId: string;
  orgSlug: string | null;
  orgName: string | null;
  role: string;
  // ── Club Tier Stage 1, specimen 6 (optional: an older payload simply omits the lines) ──
  roleLabel?: string;
  /** What the role opens, in one sentence — the same sentence the owner saw when inviting. */
  roleOpens?: string;
  inviterName?: string | null;
  inviterRole?: string | null;
  invitedAt?: string | null;
};

/**
 * An invitation on the invitee's Home (Stage 1 specimen 6). It says WHO is asking and WHEN, and in
 * one sentence what the role opens — before this it named only the club and the role, so a person
 * could not tell a real invitation from a mistake. Accepting lands them where their role starts,
 * through the same resolver sign-in uses (J10-011), rather than a hard-coded /admin.
 */
export default function PendingInvitationsCard({
  invitations,
  coachInvitations = [],
}: {
  invitations: PendingInvite[];
  /** A club's coach invitations (Club Tier Stage 2, specimen 6 · 2b) — the same card, the same two answers. */
  coachInvitations?: ConsumerHomeCoachInvite[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(invitations);
  const [coachItems, setCoachItems] = useState(coachInvitations);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (items.length === 0 && coachItems.length === 0) return null;
  const total = items.length + coachItems.length;

  /** A club's coach invitation: accept lands on the team (the server says where); decline tells the club. */
  async function respondCoach(inviteId: string, action: 'accept' | 'decline') {
    setError('');
    setBusyId(inviteId);
    try {
      const res = await fetch(`/api/auth/coach-invitations/${inviteId}`, {
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
      if (action === 'accept' && data?.destination) {
        router.push(data.destination);
        router.refresh();
        return;
      }
      setCoachItems(prev => prev.filter(i => i.inviteId !== inviteId));
      setBusyId(null);
      // The same nudge as a member invitation's decline, so the two handlers never drift (/review).
      window.dispatchEvent(new Event('flhq:invites-changed'));
    } catch {
      setError('Could not reach the server. Please try again.');
      setBusyId(null);
    }
  }

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
      if (action === 'accept' && (data?.destination || data?.orgSlug)) {
        // Where this role starts (the server resolves it). The slug fallback covers an older
        // server that did not yet return a destination.
        const dest = data.destination
          ?? (data.role === 'official' ? `/${data.orgSlug}/scorekeeper` : `/${data.orgSlug}/admin`);
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
        <span>{total === 1 ? 'You have an invitation' : `You have ${total} invitations`}</span>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.list}>
        {coachItems.map(invite => {
          const busy = busyId === invite.inviteId;
          const club = invite.orgName ?? 'A club';
          const team = invite.teamName ?? 'a team';
          const seat = invite.coachRole === 'head_coach' ? 'head coach' : 'an assistant coach';
          const sent = formatStoredDate(orgDayKey(invite.invitedAt));
          return (
            <div key={invite.inviteId} className={styles.item}>
              <div className={styles.info}>
                <div className={styles.headline}>{club} invited you to coach {team} as {seat}</div>
                <div className={styles.from}>
                  {invite.invitedByName ? <>From <strong>{invite.invitedByName}</strong> · </> : null}{sent}
                </div>
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.accept} disabled={busy} onClick={() => respondCoach(invite.inviteId, 'accept')}>
                  <Check size={14} strokeWidth={2.5} aria-hidden />
                  {busy ? 'Working…' : 'Accept'}
                </button>
                <button
                  type="button"
                  className={styles.decline}
                  disabled={busy}
                  onClick={() => respondCoach(invite.inviteId, 'decline')}
                  aria-label={`Decline the invitation to coach ${team}`}
                >
                  <X size={14} strokeWidth={2.5} aria-hidden />
                  Decline
                </button>
              </div>
            </div>
          );
        })}
        {items.map(invite => {
          const busy = busyId === invite.memberId;
          const org = invite.orgName ?? invite.orgSlug ?? 'An organization';
          const role = invite.roleLabel ?? roleLabel(invite.role);
          const sent = invite.invitedAt ? formatStoredDate(orgDayKey(invite.invitedAt)) : null;
          return (
            <div key={invite.memberId} className={styles.item}>
              <div className={styles.info}>
                <div className={styles.headline}>{org} invited you to join as {role}</div>
                {invite.inviterName && (
                  <div className={styles.from}>
                    From <strong>{invite.inviterName}</strong>
                    {invite.inviterRole ? `, ${invite.inviterRole.toLowerCase()}` : ''}
                    {sent ? ` · ${sent}` : ''}
                  </div>
                )}
                {invite.roleOpens && <div className={styles.opens}>{invite.roleOpens}</div>}
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
                  aria-label={`Decline invitation to ${org}`}
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
