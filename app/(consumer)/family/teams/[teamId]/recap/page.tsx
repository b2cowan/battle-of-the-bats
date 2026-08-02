import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import warm from '@/components/consumer/warmTheme.module.css';
import styles from '../../../family.module.css';
import PlayerRecapView from '@/components/family/PlayerRecapView';
import { resolveFamilyRecapAvailability } from '@/lib/family-recap';
import { getVerifiedLinkForUserTeam } from '@/lib/family-access';
import { assemblePlayerSeasonRecap } from '@/lib/rep-player-season-recap';
import { recordRecapView } from '@/lib/family-engagement';

/**
 * /family/teams/[teamId]/recap — a guardian's own child's season recap (Chunk D 3.2, S7).
 *
 * Authorization is resolved server-side from the session: no verified GUARDIAN link, no page.
 * The teamId in the URL selects WHICH link to look for; it never stands in for one, and no
 * player id is accepted from the client at all — the child is whoever the coach attached to
 * this guardian's link. "Guardian of player A cannot reach player B" is therefore structural.
 *
 * A follower who guesses this URL, a declined or revoked requester, and a stranger all get the
 * same page: not connected. Never indexed, never cached; `/family` is already in the service
 * worker's NEVER_CACHE list.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Season recap',
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className={warm.warm}>
      <div className={styles.page}>
        <div className={styles.card}>{children}</div>
      </div>
    </div>
  );
}

export default async function FamilyRecapPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Shell>
        <h1 className={styles.joinTitle}>Sign in to see the recap</h1>
        <p className={styles.joinLede}>
          Your player’s season recap is here once you’re signed in with the account the coach
          approved.
        </p>
        <div className={styles.actions}>
          <Link
            href={`/auth/login?next=${encodeURIComponent(`/family/teams/${teamId}/recap`)}`}
            className={styles.chip}
          >
            Sign in
          </Link>
        </div>
      </Shell>
    );
  }

  // Who is connected → is there a recap → build it → note that they opened it. Four explicit
  // steps at the edge, rather than one resolver that silently writes while it reads.
  const link = await getVerifiedLinkForUserTeam(user.id, teamId);
  const state = link
    ? await resolveFamilyRecapAvailability({ link, repTeamId: teamId })
    : { status: 'unavailable' as const };

  if (state.status === 'season_open') {
    return (
      <Shell>
        <h1 className={styles.joinTitle}>The season isn’t finished yet</h1>
        <p className={styles.joinLede}>
          {state.seasonName} is still being played. The season recap is written when the coach
          closes the season — we’ll have it here then.
        </p>
        <div className={styles.actions}>
          <Link href={`/family/teams/${teamId}`} className={styles.chip}>Back to the team</Link>
        </div>
      </Shell>
    );
  }

  const recap = state.status === 'ready'
    ? await assemblePlayerSeasonRecap(
        state.team, state.programYear, state.playerId, { orgName: state.orgName },
      )
    : null;

  if (state.status !== 'ready' || !recap) {
    // ONE state covering follower, waiting, declined, revoked, not-your-team, lapsed-premium
    // and "the roster row went away" alike. Telling a caller WHICH of those it was is telling
    // them something about a child they have no connection to.
    return (
      <Shell>
        <h1 className={styles.joinTitle}>Not available</h1>
        <p className={styles.joinLede}>
          There’s no season recap for this account. Season recaps go to a player’s connected
          parent or guardian — ask the coach if that should be you.
        </p>
        <div className={styles.actions}>
          <Link href="/following" className={styles.chip}>Back to Following</Link>
        </div>
      </Shell>
    );
  }

  // The one write on this page, stated where the opening happens. Awaited rather than
  // deferred: `after()` has no waitUntil bridge on our host, so deferred side-writes can
  // silently never run. It is one idempotent upsert and it swallows its own errors — a
  // telemetry failure must never cost a family their recap.
  await recordRecapView({
    orgId: state.team.orgId,
    repTeamId: state.team.id,
    programYearId: state.programYear.id,
    linkId: state.linkId,
  });

  return (
    <div className={warm.warm}>
      <div className={styles.page}>
        <PlayerRecapView recap={recap} />
        <div className={styles.actions}>
          <Link href={`/family/teams/${teamId}`} className={styles.chipGhost}>Back to the team</Link>
        </div>
      </div>
    </div>
  );
}
