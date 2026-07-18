'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  X, Sparkles, Building2, ClipboardCheck, Trophy, Users, Star, ChevronRight,
  RotateCcw, type LucideIcon,
} from 'lucide-react';
import { useAllFollowedTeams } from '@/lib/follow';
import { useFollowFeed } from '@/lib/hooks/useFollowFeed';
import {
  rollupFollowFeedByTournament,
  type ConsumerHomePayload,
  type TournamentFollowCard,
} from '@/lib/home-following';
import type { UserAccessContext, UserAccessContextKind } from '@/lib/user-contexts';
import { teamColor, teamInitials } from '@/lib/team-color';
import PendingInvitationsCard from '@/components/home/PendingInvitationsCard';
import styles from './HomePersonalization.module.css';

const INTRO_KEY = 'flhq_unified_home_intro_dismissed';

const KIND_ICON: Record<UserAccessContextKind, LucideIcon> = {
  organization: Building2,
  tournament_official: ClipboardCheck,
  coaches_basic: Trophy,
  coaches_premium: Users,
  fan: Star,
};
const KIND_LABEL: Record<UserAccessContextKind, string> = {
  organization: 'Admin Area',
  tournament_official: 'Tournament',
  coaches_basic: 'Coaches Portal',
  coaches_premium: 'Coaches Portal',
  fan: 'Following',
};
const KIND_ACCENT: Partial<Record<UserAccessContextKind, 'blue' | 'amber' | 'olive'>> = {
  organization: 'blue',
  tournament_official: 'amber',
};

const EMPTY_FOLLOWING = { current: [] as TournamentFollowCard[], past: [] as TournamentFollowCard[] };

/**
 * Home personalization (Unified Home, Phase 1) — the account-specific sections that sit
 * between the search bar and the Browse directory: what's-new intro, pending invitations,
 * Workspaces, lapsed "reactivate" cards, and the tournament-first Following section.
 *
 * Client-fetched from /api/consumer/home so the /discover SSR shell never carries per-user
 * data into cacheable HTML (FP-2 pattern). Signed-out visitors get an empty payload and this
 * component falls back to the DEVICE's local follows (localStorage) resolved client-side —
 * the same source the Following tab uses when signed out.
 */
export default function HomePersonalization() {
  const [payload, setPayload] = useState<ConsumerHomePayload | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/consumer/home')
      .then(r => (r.ok ? r.json() : null))
      .then((data: ConsumerHomePayload | null) => {
        if (!cancelled) { setPayload(data); setLoaded(true); }
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const signedIn = payload?.signedIn ?? false;
  const useDevice = loaded && !signedIn;

  // Signed-out: resolve the device's local follows into the same live feed, then roll them
  // up tournament-first exactly like the server does for signed-in accounts.
  const { teams: deviceTeams } = useAllFollowedTeams();
  const deviceFeed = useFollowFeed({
    teams: useDevice
      ? deviceTeams.map(t => ({ teamId: t.id, teamName: t.name, orgSlug: t.orgSlug, tournamentSlug: t.tournamentSlug }))
      : [],
  });
  const deviceFollowing = useDevice ? rollupFollowFeedByTournament(deviceFeed.entries) : EMPTY_FOLLOWING;

  const following = signedIn ? (payload?.following ?? EMPTY_FOLLOWING) : deviceFollowing;
  const hasFollowing = following.current.length > 0 || following.past.length > 0;

  const workspaces = signedIn ? (payload?.workspaces ?? []) : [];
  const lapsed = signedIn ? (payload?.lapsed ?? []) : [];
  const invites = signedIn ? (payload?.pendingInvites ?? []) : [];

  // Honest follow count (server-provided for accounts, device list otherwise) — independent of feed
  // enrichment. A followed team whose tournament went unpublished drops out of `following` but must
  // NOT flip Home to "Nothing here yet": show a quiet "game info unavailable" line instead.
  const followCount = signedIn ? (payload?.followCount ?? 0) : deviceTeams.length;
  const feedSettled = signedIn ? loaded : (useDevice && !deviceFeed.loading);
  const followsButEmpty = followCount > 0 && !hasFollowing && feedSettled;

  const signedInEmpty =
    loaded && signedIn &&
    invites.length === 0 && workspaces.length === 0 && lapsed.length === 0 && followCount === 0;

  return (
    <div className={styles.wrap}>
      <WhatsNewIntro />

      {/* Loading placeholder for the account sections (Browse below is already painted). */}
      {!loaded && <div className={styles.skeleton} aria-hidden />}

      {invites.length > 0 && <PendingInvitationsCard invitations={invites} />}

      {workspaces.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <p className={styles.kicker}>Workspaces</p>
          </div>
          <div className={styles.cardList}>
            {workspaces.map(ws => <WorkspaceCard key={ws.id} ctx={ws} />)}
          </div>
        </section>
      )}

      {lapsed.length > 0 && (
        <section className={styles.section}>
          <div className={styles.cardList}>
            {lapsed.map(l => (
              <Link key={l.orgId} href={l.destination} className={styles.lapsedCard}>
                <span className={styles.lapsedIcon} aria-hidden><RotateCcw size={18} strokeWidth={1.9} /></span>
                <span style={{ minWidth: 0 }}>
                  <span className={styles.lapsedTitle} style={{ display: 'block' }}>{l.orgName}</span>
                  <span className={styles.lapsedMeta}>{l.planLabel} · Subscription lapsed</span>
                </span>
                <span className={styles.lapsedCta}>Reactivate →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {(hasFollowing || followsButEmpty) && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <p className={styles.kicker}>Following · Tournaments</p>
            <Link href="/following" className={styles.headLink}>
              All following <ChevronRight size={11} strokeWidth={2.4} aria-hidden />
            </Link>
          </div>
          {hasFollowing ? (
            <>
              <div className={styles.cardList}>
                {following.current.map(card => <FollowCard key={card.key} card={card} />)}
              </div>
              {following.past.length > 0 && (
                <details className={styles.pastGroup}>
                  <summary className={styles.pastSummary}>Past events ({following.past.length})</summary>
                  <div className={styles.pastList}>
                    {following.past.map(card => <FollowCard key={card.key} card={card} past />)}
                  </div>
                </details>
              )}
            </>
          ) : (
            // Follows exist but every card's game info dropped out — never mislabel as "nothing yet".
            <p className={styles.quietEmpty}>
              Game info for your followed teams isn&rsquo;t available right now — try again shortly.
            </p>
          )}
        </section>
      )}

      {signedInEmpty && (
        <p className={styles.quietEmpty}>
          Nothing here yet — follow a team or tournament and it&rsquo;ll show up here.
        </p>
      )}
    </div>
  );
}

function WhatsNewIntro() {
  // localStorage read is client-only — render nothing until mounted, then reveal after reading
  // the dismissed flag. Deliberately SSR-safe (a lazy initializer would mismatch hydration);
  // the one post-mount setState is the intended "sync from localStorage on mount".
  const [show, setShow] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional one-shot sync from localStorage on mount (SSR-safe)
    try { setShow(localStorage.getItem(INTRO_KEY) !== '1'); } catch { /* private mode → just show once */ }
  }, []);
  if (!show) return null;
  return (
    <div className={styles.intro}>
      <Sparkles size={16} strokeWidth={2} className={styles.introIcon} aria-hidden />
      <div className={styles.introBody}>
        <span className={styles.introTitle}>Welcome to your new Home</span>
        <span className={styles.introText}>
          Discover and Following are now here on Home — your workspaces, teams, and tournaments in one place.
          Scores and Chat each have their own tab below.
        </span>
      </div>
      <button
        type="button"
        className={styles.introClose}
        aria-label="Dismiss"
        onClick={() => { try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* ignore */ } setShow(false); }}
      >
        <X size={16} strokeWidth={2.2} aria-hidden />
      </button>
    </div>
  );
}

function WorkspaceCard({ ctx }: { ctx: UserAccessContext }) {
  const Icon = KIND_ICON[ctx.kind];
  const accent = KIND_ACCENT[ctx.kind];
  return (
    <Link href={ctx.destination} className={styles.wsCard}>
      <span className={styles.wsIcon} data-accent={accent} aria-hidden>
        <Icon size={19} strokeWidth={1.8} />
      </span>
      <span className={styles.wsInfo}>
        <span className={styles.wsTop}>
          <span className={styles.wsKind}>{KIND_LABEL[ctx.kind]}</span>
          <span className={styles.wsBadge} data-accent={accent}>{ctx.badgeLabel}</span>
        </span>
        <span className={styles.wsTitle}>{ctx.title}</span>
        <span className={styles.wsMeta}>
          <span>{ctx.subtitle}</span>
          {ctx.detail && <span>{ctx.detail}</span>}
        </span>
      </span>
      <ChevronRight size={16} strokeWidth={2.2} className={styles.wsChevron} aria-hidden />
    </Link>
  );
}

function FollowCard({ card, past }: { card: TournamentFollowCard; past?: boolean }) {
  const teamLine = card.teamNames.length === 1
    ? `Your team · ${card.teamNames[0]}`
    : `Your teams · ${card.teamNames.join(', ')}`;
  return (
    <Link href={card.href} className={`${styles.followCard} ${past ? styles.followCardPast : ''}`}>
      <span className={styles.followLogo} style={{ background: teamColor(card.tournamentName, 55, 42) }} aria-hidden>
        {teamInitials(card.tournamentName)}
      </span>
      <span className={styles.followBody}>
        <span className={styles.followName}>{card.tournamentName}</span>
        <span className={styles.followTeam}>{teamLine}</span>
        <span className={`${styles.followStatus} ${card.status.live ? styles.followStatusLive : ''}`}>
          {card.status.live && <span className={styles.followLiveDot} aria-hidden />}
          {card.status.text}
        </span>
      </span>
      <Star size={14} strokeWidth={2} fill="currentColor" className={styles.followStar} aria-label="Following" />
    </Link>
  );
}
