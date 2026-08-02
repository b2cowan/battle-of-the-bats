import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import warm from '@/components/consumer/warmTheme.module.css';
import styles from '../../family.module.css';
import FamilyTeamClient from './FamilyTeamClient';
import {
  getOrgForGate,
  getVerifiedLinkForUserTeam,
  isFamilyLayerEnabled,
} from '@/lib/family-access';
import { getFamilyTeamView } from '@/lib/family-view';
import { resolveGuardianPayloadForLink } from '@/lib/family-guardian-view';
import { resolveFamilyRecapAvailability } from '@/lib/family-recap';

/**
 * /family/teams/[teamId] — a connected family's view of their team.
 *
 * Authorization is resolved here, server-side, from the session: no verified link, no
 * page. The teamId in the URL selects WHICH link to look for; it never stands in for one.
 *
 * Never indexed, never cached (the route is in the service worker's NEVER_CACHE list too
 * — see public/sw.js; the /coaches PII-leak lesson applies to every new authed route).
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your team',
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

export default async function FamilyTeamPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Shell>
        <h1 className={styles.joinTitle}>Sign in to see this team</h1>
        <p className={styles.joinLede}>
          Your team’s schedule is here once you’re signed in with the account the coach approved.
        </p>
        <div className={styles.actions}>
          <Link href={`/auth/login?next=${encodeURIComponent(`/family/teams/${teamId}`)}`} className={styles.chip}>
            Sign in
          </Link>
        </div>
      </Shell>
    );
  }

  const link = await getVerifiedLinkForUserTeam(user.id, teamId);
  if (!link) {
    // Covers waiting, declined, revoked and "not your team" alike. A waiting family is
    // told the truthful, un-alarming version rather than a 404 they'd read as a bug.
    return (
      <Shell>
        <h1 className={styles.joinTitle}>Not connected yet</h1>
        <p className={styles.joinLede}>
          The coach hasn’t approved a connection for this account. Once they do, the team’s
          schedule appears here.
        </p>
        <div className={styles.actions}>
          <Link href="/following" className={styles.chip}>Back to Following</Link>
        </div>
      </Shell>
    );
  }

  const org = await getOrgForGate(link.orgId);
  const enabled = org ? await isFamilyLayerEnabled({ org, repTeamId: teamId }) : false;
  const view = enabled ? await getFamilyTeamView({ repTeamId: teamId, requireVisibility: 'families' }) : null;

  // Chunk D 3.2 — does this family have a season recap waiting? Resolved through the shared
  // gate rather than re-checked here, and asked even when the schedule is gone: a season that
  // has CLOSED serves no schedule, which is exactly when the recap is the whole point.
  // The link and the premium gate are handed over rather than re-derived — this request has
  // already paid for both.
  const recap = await resolveFamilyRecapAvailability({
    link,
    repTeamId: teamId,
    org: enabled ? org : undefined,
  });

  if (!view) {
    // The season has ended, the coach set the schedule to staff only, or the team's premium
    // access lapsed. A quiet state, never an error — and never a dead end when the family's
    // own artifact is sitting behind it.
    return (
      <Shell>
        {recap.status === 'ready' ? (
          <>
            <h1 className={styles.joinTitle}>The season has finished</h1>
            <p className={styles.joinLede}>
              There’s no live schedule for this team right now — but your player’s season recap
              is here to keep.
            </p>
            <div className={styles.actions}>
              <Link href={`/family/teams/${teamId}/recap`} className={styles.chip}>
                Read the season recap
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className={styles.joinTitle}>Schedule not available</h1>
            <p className={styles.joinLede}>
              This team’s schedule isn’t being shared with families right now. Your connection is
              still active — check back, or ask the coach.
            </p>
            <div className={styles.actions}>
              <Link href="/following" className={styles.chip}>Back to Following</Link>
            </div>
          </>
        )}
      </Shell>
    );
  }

  // The guardian half. ONE shared resolver with the API route — this condition is the tier
  // boundary and must not exist in two files.
  const guardian = await resolveGuardianPayloadForLink(link, teamId);

  return (
    <FamilyTeamClient
      view={view}
      guardian={guardian}
      recap={
        recap.status === 'ready' ? { href: `/family/teams/${teamId}/recap` }
          : recap.status === 'season_open' ? { comingAfter: recap.seasonName }
            : null
      }
    />
  );
}
