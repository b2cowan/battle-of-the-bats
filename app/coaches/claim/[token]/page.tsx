import { Suspense } from 'react';
import Link from 'next/link';
import TeamSignupClient, { type TeamClaimPrefill } from '../../../team/TeamSignupClient';
import styles from '../../../team/page.module.css';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import { getTeamWorkspaceClaimByToken } from '@/lib/team-workspace-claims';
import { COACHES_START_PATH } from '@/lib/coaches-portal-routes';

type PageProps = {
  params: Promise<{ token: string }>;
};

export const metadata = {
  title: 'Claim Coaches Portal - FieldLogicHQ',
  description: 'Activate Premium Coaches Portal from a tournament team claim link.',
};

function ClaimUnavailable({ title, body }: { title: string; body: string }) {
  return (
    <main className={styles.page}>
      <section className={styles.signupSurface}>
        <div className={styles.copyPane}>
          <p className={styles.eyebrow}>Tournament team claim</p>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.lede}>{body}</p>
          <div className={styles.pricePanel}>
            <div>
              <p className={styles.priceLabel}>Next step</p>
              <p className={styles.price}>Start Premium Coaches Portal</p>
            </div>
          </div>
          <Link href={COACHES_START_PATH} className={styles.inlineAction}>Open Coaches Portal signup</Link>
        </div>
      </section>
    </main>
  );
}

export default async function CoachesPortalClaimPage({ params }: PageProps) {
  const { token } = await params;
  const [gatingMap, claim] = await Promise.all([
    getPlanGatingMap(),
    getTeamWorkspaceClaimByToken(token).catch(error => {
      console.error('[coaches claim] lookup error:', error);
      return null;
    }),
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
      <TeamSignupClient teamIsGated={gatingMap.team} claim={prefill} />
    </Suspense>
  );
}
