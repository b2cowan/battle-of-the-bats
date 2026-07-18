'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Star } from 'lucide-react';
import { useAllFollowedTeams, unfollowTeamEverywhere } from '@/lib/follow';
import { useFollowFeed } from '@/lib/hooks/useFollowFeed';
import { followStatusText, GROUP_RANK } from '@/lib/home-following';
import { teamColor, teamInitials } from '@/lib/team-color';
import type { FollowedTeamAccount } from '@/lib/fan-follows';
import type { FollowFeedEntry } from '@/lib/follow-feed';
import warm from './warmTheme.module.css';
import styles from './FollowingList.module.css';

/**
 * The All-following page (Unified Home, Round 1 rev 4) — the MANAGE surface for follows.
 * Warm-light; per-team rows grouped Tournaments / Past events, each with an unfollow star.
 * Signed out → the device's local follows (localStorage), enriched client-side. Signed in →
 * the ACCOUNT follow list (travels across devices), server-seeded, plus a never-silent offer
 * to CLAIM any device-only follows onto the account (shared-device safeguard). Score alerts
 * are managed in Account · Notifications (single-home rule) — one quiet pointer, never here.
 */

export default function FollowingList({
  accountFollows,
  feedEntries,
  signedIn,
}: {
  accountFollows: FollowedTeamAccount[];
  /** Server-computed feed for accountFollows — empty/ignored when signed out. */
  feedEntries: FollowFeedEntry[];
  signedIn: boolean;
}) {
  const router = useRouter();
  const { teams: deviceTeams, ready } = useAllFollowedTeams();
  const [claiming, setClaiming] = useState(false);
  const [claimHidden, setClaimHidden] = useState(false);
  // Optimistic unfollow — hide immediately; the server list catches up on refresh/sync.
  const [unfollowed, setUnfollowed] = useState<Set<string>>(new Set());

  const accountTeamIds = new Set(accountFollows.map(a => a.teamId));
  const deviceOnly = deviceTeams.filter(t => !accountTeamIds.has(t.id));

  const feed = useFollowFeed({
    teams: signedIn
      ? accountFollows.map(a => ({ teamId: a.teamId, teamName: a.teamName, orgSlug: a.orgSlug, tournamentSlug: a.tournamentSlug }))
      : deviceTeams.map(t => ({ teamId: t.id, teamName: t.name, orgSlug: t.orgSlug, tournamentSlug: t.tournamentSlug })),
    initialEntries: signedIn ? feedEntries : undefined,
  });

  function handleUnfollow(entry: FollowFeedEntry) {
    if (unfollowed.has(entry.teamId)) return; // ignore a double-tap before the row unmounts
    unfollowTeamEverywhere(entry.orgSlug, entry.tournamentSlug, entry.teamId);
    setUnfollowed(prev => new Set(prev).add(entry.teamId));
    if (signedIn) router.refresh(); // re-seed the server account list without the removed team
  }

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
      if (res.ok) router.refresh();
    } catch {
      /* leave the offer up so they can retry */
    } finally {
      setClaiming(false);
    }
  }

  const entries = feed.entries.filter(e => !unfollowed.has(e.teamId));
  const current = entries
    .filter(e => e.group !== 'recent')
    .sort((a, b) => GROUP_RANK[a.group] - GROUP_RANK[b.group]);
  const past = entries.filter(e => e.group === 'recent');
  const total = entries.length;

  // Honest "you follow N" count = the account/device follow list (minus optimistic unfollows),
  // NOT the enriched feed — getFollowFeed legitimately drops a followed team whose tournament went
  // unpublished/canceled, so `total` can be 0 while the user genuinely follows teams.
  const rawFollowIds = signedIn ? accountFollows.map(a => a.teamId) : deviceTeams.map(t => t.id);
  const followCount = rawFollowIds.filter(id => !unfollowed.has(id)).length;

  const showClaim = signedIn && ready && !claimHidden && deviceOnly.length > 0;
  // 'list' when there are cards; 'unavailable' when the account follows teams but the feed came back
  // empty (game info momentarily gone — never mislabel that as "you follow nothing"); 'empty' only
  // when the user genuinely follows nothing; 'blank' while the feed/localStorage is still resolving.
  const view =
    total > 0 ? 'list'
    : feed.loading ? 'blank'
    : followCount > 0 ? 'unavailable'
    : !ready ? 'blank'
    : deviceOnly.length === 0 ? 'empty'
    : 'blank';

  return (
    <div className={`${warm.warm} ${styles.page}`}>
      <div className={styles.headerRow}>
        <Link href="/discover" className={styles.back}>
          <ArrowLeft size={13} strokeWidth={2.4} aria-hidden /> Home
        </Link>
        <h1 className={styles.title}>
          All following <span className={styles.titleCount}>· {followCount}</span>
        </h1>
      </div>

      {showClaim && (
        <div className={styles.claim}>
          <p className={styles.claimTitle}>Add your device follows?</p>
          <p className={styles.claimText}>
            You follow {deviceOnly.length === 1 ? 'this team' : `these ${deviceOnly.length} teams`} on
            this device. Add {deviceOnly.length === 1 ? 'it' : 'them'} to your account so they travel with you.
          </p>
          <p className={styles.claimTeams}>{deviceOnly.map(t => t.name).join(' · ')}</p>
          <div className={styles.claimActions}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={claim} disabled={claiming}>
              {claiming ? 'Adding…' : 'Add to my account'}
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setClaimHidden(true)}>
              Not now
            </button>
          </div>
        </div>
      )}

      {view === 'empty' ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>You&rsquo;re not following any teams yet</p>
          <p className={styles.emptyText}>
            Find a tournament, open a team, and tap Follow — it&rsquo;ll show up here
            {signedIn ? ' on every device you sign in on.' : '.'}
          </p>
          <Link href="/discover" className={styles.emptyCta}>Browse tournaments →</Link>
        </div>
      ) : view === 'unavailable' ? (
        <p className={styles.unavailable}>
          Game info for your followed teams isn&rsquo;t available right now — try again shortly.
        </p>
      ) : view === 'blank' ? (
        // Feed / localStorage still resolving — render nothing rather than flash a wrong state.
        <div />
      ) : (
        <>
          {current.length > 0 && (
            <>
              <p className={styles.kicker}>Tournaments</p>
              <div className={styles.list}>
                {current.map(entry => <FollowRow key={rowKey(entry)} entry={entry} onUnfollow={handleUnfollow} />)}
              </div>
            </>
          )}
          {past.length > 0 && (
            <>
              <p className={styles.kicker}>Past events</p>
              <div className={styles.list}>
                {past.map(entry => <FollowRow key={rowKey(entry)} entry={entry} onUnfollow={handleUnfollow} past />)}
              </div>
            </>
          )}
        </>
      )}

      <p className={styles.alertsRow}>
        Score alerts are managed in{' '}
        <Link href="/account/notifications" className={styles.alertsLink}>Account · Notifications</Link>.
      </p>
    </div>
  );
}

const rowKey = (e: FollowFeedEntry) => `${e.orgSlug}/${e.tournamentSlug}/${e.teamId}`;

function FollowRow({
  entry,
  onUnfollow,
  past,
}: {
  entry: FollowFeedEntry;
  onUnfollow: (entry: FollowFeedEntry) => void;
  past?: boolean;
}) {
  const status = followStatusText(entry);
  return (
    <div className={`${styles.row} ${past ? styles.rowPast : ''}`}>
      <Link href={`/${entry.orgSlug}/${entry.tournamentSlug}`} className={styles.rowLink}>
        <span className={styles.monogram} style={{ background: teamColor(entry.teamName, 55, 42) }} aria-hidden>
          {teamInitials(entry.teamName)}
        </span>
        <span className={styles.body}>
          <span className={styles.name}>{entry.teamName}</span>
          <span className={styles.event}>{entry.tournamentName}</span>
          <span className={`${styles.status} ${status.live ? styles.statusLive : ''}`}>
            {status.live && <span className={styles.liveDot} aria-hidden />}
            {status.text}
          </span>
        </span>
      </Link>
      <button
        type="button"
        className={styles.star}
        aria-label={`Unfollow ${entry.teamName}`}
        onClick={() => onUnfollow(entry)}
      >
        <Star size={18} strokeWidth={2} fill="currentColor" aria-hidden />
      </button>
    </div>
  );
}
