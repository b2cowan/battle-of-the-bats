'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Star } from 'lucide-react';
import {
  useAllFollowedTeams, useAllFollowedTournaments, useAllFollowedOrgs,
  unfollowTeamEverywhere, clearFollowedTournament, clearFollowedOrg,
} from '@/lib/follow';
import { useFollowFeed } from '@/lib/hooks/useFollowFeed';
import { useDeviceEntityFollows } from '@/lib/hooks/useDeviceEntityFollows';
import { followStatusText, GROUP_RANK, type TournamentFollowCard, type OrgFollowCard } from '@/lib/home-following';
import { teamColor, teamInitials } from '@/lib/team-color';
import type { FollowedTeamAccount } from '@/lib/fan-follows';
import type { FollowFeedEntry } from '@/lib/follow-feed';
import warm from './warmTheme.module.css';
import styles from './FollowingList.module.css';

/**
 * The All-following page (Unified Home, Round 1 rev 4 + Phase 6) — the MANAGE surface for follows.
 * Warm-light; per-entity rows grouped Tournaments / Past events / Organizations, each with an
 * unfollow star. Signed out → the device's local follows (localStorage), enriched client-side.
 * Signed in → the ACCOUNT follow list (travels across devices), server-seeded, plus a never-silent
 * offer to CLAIM any device-only follows (all three types) onto the account. Score alerts are
 * managed in Account · Notifications (single-home rule) — one quiet pointer, never here.
 */

export default function FollowingList({
  accountFollows,
  feedEntries,
  accountWholeEvent,
  accountOrgs,
  signedIn,
}: {
  accountFollows: FollowedTeamAccount[];
  /** Server-computed feed for accountFollows — empty/ignored when signed out. */
  feedEntries: FollowFeedEntry[];
  /** Server-computed whole-event follow cards (signed-in). */
  accountWholeEvent: TournamentFollowCard[];
  /** Server-computed followed-org cards (signed-in). */
  accountOrgs: OrgFollowCard[];
  signedIn: boolean;
}) {
  const router = useRouter();
  const { teams: deviceTeams, ready } = useAllFollowedTeams();
  const { tournaments: deviceTournaments } = useAllFollowedTournaments();
  const { orgs: deviceOrgs } = useAllFollowedOrgs();
  const [claiming, setClaiming] = useState(false);
  const [claimHidden, setClaimHidden] = useState(false);
  // Optimistic unfollow — hide immediately; the server list catches up on refresh/sync.
  const [unfollowedTeams, setUnfollowedTeams] = useState<Set<string>>(new Set());
  const [unfollowedTourn, setUnfollowedTourn] = useState<Set<string>>(new Set());
  const [unfollowedOrgs, setUnfollowedOrgs] = useState<Set<string>>(new Set());

  // Signed-out: resolve device whole-event + org follows to cards (public status) via the shared hook.
  const deviceEntities = useDeviceEntityFollows(deviceTournaments, deviceOrgs, !signedIn);

  const accountTeamIds = new Set(accountFollows.map(a => a.teamId));
  const deviceOnlyTeams = deviceTeams.filter(t => !accountTeamIds.has(t.id));

  const feed = useFollowFeed({
    teams: signedIn
      ? accountFollows.map(a => ({ teamId: a.teamId, teamName: a.teamName, orgSlug: a.orgSlug, tournamentSlug: a.tournamentSlug }))
      : deviceTeams.map(t => ({ teamId: t.id, teamName: t.name, orgSlug: t.orgSlug, tournamentSlug: t.tournamentSlug })),
    initialEntries: signedIn ? feedEntries : undefined,
  });

  const wholeEvent = signedIn ? accountWholeEvent : deviceEntities.wholeEvent;
  const orgCards = signedIn ? accountOrgs : deviceEntities.organizations;

  // Whole-event dedupe vs team follows (F6: team wins the card).
  const teamKeys = new Set(feed.entries.map(e => `${e.orgSlug}/${e.tournamentSlug}`));

  function handleUnfollowTeam(entry: FollowFeedEntry) {
    if (unfollowedTeams.has(entry.teamId)) return;
    unfollowTeamEverywhere(entry.orgSlug, entry.tournamentSlug, entry.teamId);
    setUnfollowedTeams(prev => new Set(prev).add(entry.teamId));
    if (signedIn) router.refresh();
  }
  function handleUnfollowTournament(card: TournamentFollowCard) {
    if (unfollowedTourn.has(card.key)) return;
    clearFollowedTournament(card.orgSlug, card.tournamentSlug);
    setUnfollowedTourn(prev => new Set(prev).add(card.key));
    if (signedIn) router.refresh();
  }
  function handleUnfollowOrg(card: OrgFollowCard) {
    if (unfollowedOrgs.has(card.orgSlug)) return;
    clearFollowedOrg(card.orgSlug);
    setUnfollowedOrgs(prev => new Set(prev).add(card.orgSlug));
    if (signedIn) router.refresh();
  }

  async function claim() {
    setClaiming(true);
    try {
      const res = await fetch('/api/consumer/follows/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          follows: deviceOnlyTeams.map(t => ({ teamId: t.id, orgSlug: t.orgSlug, tournamentSlug: t.tournamentSlug })),
          tournaments: deviceOnlyTourn.map(t => ({ orgSlug: t.orgSlug, tournamentSlug: t.tournamentSlug })),
          orgs: deviceOnlyOrgs.map(o => ({ orgSlug: o.orgSlug })),
        }),
      });
      if (res.ok) router.refresh();
    } catch {
      /* leave the offer up so they can retry */
    } finally {
      setClaiming(false);
    }
  }

  // ── Team rows (feed) → current / past ──
  const teamEntries = feed.entries.filter(e => !unfollowedTeams.has(e.teamId));
  const teamCurrent = teamEntries.filter(e => e.group !== 'recent');
  const teamPast = teamEntries.filter(e => e.group === 'recent');

  // ── Whole-event rows (dedup vs team follows, drop optimistic unfollows) ──
  const events = wholeEvent.filter(c => !unfollowedTourn.has(c.key) && !teamKeys.has(c.key));
  const eventCurrent = events.filter(c => c.group !== 'recent');
  const eventPast = events.filter(c => c.group === 'recent');

  const orgs = orgCards.filter(c => !unfollowedOrgs.has(c.orgSlug));

  const currentCount = teamCurrent.length + eventCurrent.length;
  const pastCount = teamPast.length + eventPast.length;

  // Sorted current rows (live first) — team + whole-event interleaved by group rank.
  const currentRows = [
    ...teamCurrent.map(e => ({ kind: 'team' as const, rank: GROUP_RANK[e.group], team: e })),
    ...eventCurrent.map(c => ({ kind: 'event' as const, rank: GROUP_RANK[c.group], card: c })),
  ].sort((a, b) => a.rank - b.rank);

  // Device-only follows (signed-in) → the claim offer, all three types.
  const accountTournKeys = new Set(accountWholeEvent.map(c => c.key));
  const accountOrgSlugs = new Set(accountOrgs.map(c => c.orgSlug));
  const deviceOnlyTourn = deviceTournaments.filter(t => !accountTournKeys.has(`${t.orgSlug}/${t.tournamentSlug}`));
  const deviceOnlyOrgs = deviceOrgs.filter(o => !accountOrgSlugs.has(o.orgSlug));
  const deviceOnlyCount = deviceOnlyTeams.length + deviceOnlyTourn.length + deviceOnlyOrgs.length;

  // Honest count = the raw follow list (minus optimistic unfollows), NOT the enriched feed.
  const followCount =
    (signedIn ? accountFollows.map(a => a.teamId) : deviceTeams.map(t => t.id)).filter(id => !unfollowedTeams.has(id)).length +
    (signedIn ? accountWholeEvent.map(c => c.key) : deviceTournaments.map(t => `${t.orgSlug}/${t.tournamentSlug}`)).filter(k => !unfollowedTourn.has(k) && !teamKeys.has(k)).length +
    (signedIn ? accountOrgs.map(c => c.orgSlug) : deviceOrgs.map(o => o.orgSlug)).filter(s => !unfollowedOrgs.has(s)).length;

  const showClaim = signedIn && ready && !claimHidden && deviceOnlyCount > 0;
  const anyRows = currentCount > 0 || pastCount > 0 || orgs.length > 0;
  const view =
    anyRows ? 'list'
    : feed.loading ? 'blank'
    : followCount > 0 ? 'unavailable'
    : !ready ? 'blank'
    : deviceOnlyCount === 0 ? 'empty'
    : 'blank';

  return (
    <div className={`${warm.warmTab} ${styles.page}`}>
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
            You follow {deviceOnlyCount === 1 ? 'one thing' : `${deviceOnlyCount} things`} on this device.
            Add {deviceOnlyCount === 1 ? 'it' : 'them'} to your account so they travel with you.
          </p>
          <p className={styles.claimTeams}>
            {[...deviceOnlyTeams.map(t => t.name), ...deviceOnlyTourn.map(t => t.name), ...deviceOnlyOrgs.map(o => o.name)].filter(Boolean).join(' · ')}
          </p>
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
          <p className={styles.emptyTitle}>You&rsquo;re not following anything yet</p>
          <p className={styles.emptyText}>
            Find a tournament, team, or organization and tap Follow — it&rsquo;ll show up here
            {signedIn ? ' on every device you sign in on.' : '.'}
          </p>
          <Link href="/discover" className={styles.emptyCta}>Browse tournaments →</Link>
        </div>
      ) : view === 'unavailable' ? (
        <p className={styles.unavailable}>
          Game info for your follows isn&rsquo;t available right now — try again shortly.
        </p>
      ) : view === 'blank' ? (
        <div />
      ) : (
        <>
          {currentRows.length > 0 && (
            <>
              <p className={styles.kicker}>Tournaments</p>
              <div className={styles.list}>
                {currentRows.map(r => r.kind === 'team'
                  ? <TeamRow key={teamRowKey(r.team)} entry={r.team} onUnfollow={handleUnfollowTeam} />
                  : <EventRow key={r.card.key} card={r.card} onUnfollow={handleUnfollowTournament} />)}
              </div>
            </>
          )}
          {(teamPast.length > 0 || eventPast.length > 0) && (
            <>
              <p className={styles.kicker}>Past events</p>
              <div className={styles.list}>
                {teamPast.map(entry => <TeamRow key={teamRowKey(entry)} entry={entry} onUnfollow={handleUnfollowTeam} past />)}
                {eventPast.map(card => <EventRow key={card.key} card={card} onUnfollow={handleUnfollowTournament} past />)}
              </div>
            </>
          )}
          {orgs.length > 0 && (
            <>
              <p className={styles.kicker}>Organizations</p>
              <div className={styles.list}>
                {orgs.map(card => <OrgRow key={card.orgSlug} card={card} onUnfollow={handleUnfollowOrg} />)}
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

const teamRowKey = (e: FollowFeedEntry) => `${e.orgSlug}/${e.tournamentSlug}/${e.teamId}`;

function TeamRow({ entry, onUnfollow, past }: {
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
      <button type="button" className={styles.star} aria-label={`Unfollow ${entry.teamName}`} onClick={() => onUnfollow(entry)}>
        <Star size={18} strokeWidth={2} fill="currentColor" aria-hidden />
      </button>
    </div>
  );
}

function EventRow({ card, onUnfollow, past }: {
  card: TournamentFollowCard;
  onUnfollow: (card: TournamentFollowCard) => void;
  past?: boolean;
}) {
  return (
    <div className={`${styles.row} ${past ? styles.rowPast : ''}`}>
      <Link href={card.href} className={styles.rowLink}>
        <span className={styles.monogram} style={{ background: teamColor(card.tournamentName, 55, 42) }} aria-hidden>
          {teamInitials(card.tournamentName)}
        </span>
        <span className={styles.body}>
          <span className={styles.name}>{card.tournamentName}</span>
          <span className={styles.event}>Whole event</span>
          <span className={`${styles.status} ${card.status.live ? styles.statusLive : ''}`}>
            {card.status.live && <span className={styles.liveDot} aria-hidden />}
            {card.status.text}
          </span>
        </span>
      </Link>
      <button type="button" className={styles.star} aria-label={`Unfollow ${card.tournamentName}`} onClick={() => onUnfollow(card)}>
        <Star size={18} strokeWidth={2} fill="currentColor" aria-hidden />
      </button>
    </div>
  );
}

function OrgRow({ card, onUnfollow }: {
  card: OrgFollowCard;
  onUnfollow: (card: OrgFollowCard) => void;
}) {
  return (
    <div className={styles.row}>
      <Link href={card.href} className={styles.rowLink}>
        <span className={`${styles.monogram} ${styles.monogramRound}`} style={{ background: teamColor(card.orgName, 55, 42) }} aria-hidden>
          {card.logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={card.logoUrl} alt="" className={styles.monogramImg} />
            : teamInitials(card.orgName)}
        </span>
        <span className={styles.body}>
          <span className={styles.name}>{card.orgName}</span>
          <span className={`${styles.status} ${card.context.live ? styles.statusLive : ''}`}>
            {card.context.live && <span className={styles.liveDot} aria-hidden />}
            {card.context.text}
          </span>
        </span>
      </Link>
      <button type="button" className={styles.star} aria-label={`Unfollow ${card.orgName}`} onClick={() => onUnfollow(card)}>
        <Star size={18} strokeWidth={2} fill="currentColor" aria-hidden />
      </button>
    </div>
  );
}
