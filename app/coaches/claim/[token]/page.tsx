import { Suspense } from 'react';
import Link from 'next/link';
import TeamSignupClient, { type TeamClaimPrefill } from '../../../team/TeamSignupClient';
import { StartColumn, StartHead } from '@/components/auth/AccountForm';
// The stylesheet itself, not the client module's re-export: a server page can't dot into a client module's export.
import accountForm from '@/components/auth/AccountForm.module.css';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import { getTeamWorkspaceClaimByToken } from '@/lib/team-workspace-claims';
import { COACHES_START_PATH } from '@/lib/coaches-portal-routes';
import { getAuthUserCached } from '@/lib/supabase-server';
import { foundingSeasonOfferFor } from '@/lib/founding-season';
import { readStartDoor } from '@/lib/start-door';

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ confirmed?: string }>;
};

export const metadata = {
  title: 'Claim Coaches Portal - FieldLogicHQ',
  description: 'Activate Premium Coaches Portal from a tournament team claim link.',
};

/** A claim link that can't be used: the start column, its reason, and the way to Coach Premium (The first look, Stage 1b: the look only — Ask 7 parks how the claim works). */
function ClaimUnavailable({ title, body }: { title: string; body: string }) {
  return (
    <StartColumn>
      <StartHead title={title} sub={body} />
      <Link href={COACHES_START_PATH} className={accountForm.primary}>Open Coaches Portal signup</Link>
    </StartColumn>
  );
}

export default async function CoachesPortalClaimPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const confirmed = (await searchParams)?.confirmed === '1';
  const [gatingMap, claim, user] = await Promise.all([
    getPlanGatingMap(),
    getTeamWorkspaceClaimByToken(token).catch(error => {
      console.error('[coaches claim] lookup error:', error);
      return null;
    }),
    getAuthUserCached(),
  ]);

  if (!claim) {
    return (
      <ClaimUnavailable
        title="Claim link not found"
        body="This Coaches Portal claim link is invalid. Use the latest link from your tournament email or start a new Coaches Portal subscription."
      />
    );
  }

  if (claim.status !== 'available') {
    return (
      <ClaimUnavailable
        title={claim.status === 'claimed' ? 'Team already claimed' : 'Claim link unavailable'}
        body={
          claim.status === 'claimed'
            ? 'This tournament team has already been upgraded in Coaches Portal.'
            : 'This Coaches Portal claim link has expired or was revoked.'
        }
      />
    );
  }

  const prefill: TeamClaimPrefill = {
    token: claim.token,
    contactEmail: claim.contactEmail,
    teamName: claim.tournamentTeam.name,
    coachName: claim.tournamentTeam.coachName,
    division: claim.division.name,
    tournamentName: claim.tournament.name,
    seasonYear: claim.seasonYear,
  };

  return (
    <Suspense fallback={null}>
      {/* Account-first (Part 3): the claim keeps its server re-fill; the offer is the server's answer (edge (b)). */}
      <TeamSignupClient
        teamIsGated={gatingMap.team}
        claim={prefill}
        confirmed={confirmed}
        foundingOffer={foundingSeasonOfferFor(user, 'premium')}
        rememberedBilling={readStartDoor(user?.user_metadata)?.billing ?? null}
        signedInEmail={user?.email ?? null}
      />
    </Suspense>
  );
}
