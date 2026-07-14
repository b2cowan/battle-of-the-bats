'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAllFollowedTeams, type FollowedTeamEntry } from '@/lib/follow';
import type { FollowedTeamAccount } from '@/lib/fan-follows';
import FollowCardList from './FollowCardList';
import styles from './ConsumerPage.module.css';

/**
 * The Following tab (unified-app Phase 2). Signed out → the device's local follow list.
 * Signed in → the ACCOUNT follow list (travels across devices), plus an explicit,
 * never-silent offer to CLAIM any teams this device follows that aren't on the account
 * yet — the shared-device safeguard (mirrors the invite-reconciliation consent pattern).
 */
export default function FollowingList({
  accountFollows,
  signedIn,
}: {
  accountFollows: FollowedTeamAccount[];
  signedIn: boolean;
}) {
  const router = useRouter();
  const { teams: deviceTeams, ready } = useAllFollowedTeams();
  const [claiming, setClaiming] = useState(false);
  const [claimHidden, setClaimHidden] = useState(false);

  // Account follows mapped into the card shape shared with the device list.
  const accountAsEntries: FollowedTeamEntry[] = accountFollows.map(a => ({
    id: a.teamId,
    name: a.teamName,
    orgSlug: a.orgSlug,
    tournamentSlug: a.tournamentSlug,
  }));
  const accountTeamIds = new Set(accountFollows.map(a => a.teamId));
  // Teams this device follows that aren't on the account yet → the claim offer.
  const deviceOnly = deviceTeams.filter(t => !accountTeamIds.has(t.id));

  async function claim() {
    setClaiming(true);
    try {
      const res = await fetch('/api/consumer/follows/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          follows: deviceOnly.map(t => ({ teamId: t.id, orgSlug: t.orgSlug, tournamentSlug: t.tournamentSlug })),
        }),
      });
      if (res.ok) router.refresh(); // re-fetch the server account list so claimed teams move over
    } catch {
      /* leave the offer up so they can retry */
    } finally {
      setClaiming(false);
    }
  }

  // ── Signed-out: device follows only (Phase 1 behavior) ──────────────────────
  if (!signedIn) {
    if (!ready) return <div className={styles.page} />;
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Following</h1>
          <p className={styles.subtitle}>
            Teams you follow on this device. Sign in to keep them on every device.
          </p>
        </div>
        {deviceTeams.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>You&rsquo;re not following any teams yet</p>
            <p className={styles.emptyText}>
              Find a tournament, open a team, and tap Follow — it&rsquo;ll show up here.
            </p>
            <Link href="/discover" className={styles.cta}>Browse tournaments →</Link>
          </div>
        ) : (
          <FollowCardList teams={deviceTeams} />
        )}
      </div>
    );
  }

  // ── Signed-in: account follows (+ claim offer) ──────────────────────────────
  const showClaim = ready && !claimHidden && deviceOnly.length > 0;
  // Only declare "nothing followed" once localStorage has hydrated (`ready`) — otherwise a
  // signed-in user with device-only follows briefly flashes the empty state before the claim
  // card appears. Account follows still render immediately (they come from the server prop).
  const nothingYet = ready && accountFollows.length === 0 && deviceOnly.length === 0;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Following</h1>
        <p className={styles.subtitle}>Teams you follow — on every device you sign in on.</p>
      </div>

      {showClaim && (
        <div className={styles.claim}>
          <p className={styles.claimTitle}>Add your device follows?</p>
          <p className={styles.claimText}>
            You follow {deviceOnly.length === 1 ? 'this team' : `these ${deviceOnly.length} teams`} on
            this device. Add {deviceOnly.length === 1 ? 'it' : 'them'} to your account so they travel with you.
          </p>
          <FollowCardList teams={deviceOnly} />
          <div className={styles.claimActions}>
            <button type="button" className={styles.cta} onClick={claim} disabled={claiming}>
              {claiming ? 'Adding…' : `Add to my account`}
            </button>
            <button type="button" className={styles.ctaGhost} onClick={() => setClaimHidden(true)}>
              Not now
            </button>
          </div>
        </div>
      )}

      {accountFollows.length > 0 ? (
        <>
          {showClaim && <p className={styles.sectionLabel}>On your account</p>}
          <FollowCardList teams={accountAsEntries} />
        </>
      ) : nothingYet ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>You&rsquo;re not following any teams yet</p>
          <p className={styles.emptyText}>
            Find a tournament, open a team, and tap Follow — it&rsquo;ll show up here on every device.
          </p>
          <Link href="/discover" className={styles.cta}>Browse tournaments →</Link>
        </div>
      ) : null}
    </div>
  );
}
