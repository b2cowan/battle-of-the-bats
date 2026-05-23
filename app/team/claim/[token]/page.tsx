import { Suspense } from 'react';
import Link from 'next/link';
import TeamSignupClient, { type TeamClaimPrefill } from '../../TeamSignupClient';
import styles from '../../page.module.css';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import { getTeamWorkspaceClaimByToken } from '@/lib/team-workspace-claims';

type PageProps = {
  params: Promise<{ token: string }>;
};

export const metadata = {
  title: 'Claim Team Workspace - FieldLogicHQ',
  description: 'Activate a Team workspace from a tournament team claim link.',
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
              <p className={styles.price}>Start a new Team workspace</p>
            </div>
          </div>
          <Link href="/team" className={styles.inlineAction}>Open Team signup</Link>
        </div>
      </section>
    </main>
  );
}

export default async function TeamClaimPage({ params }: PageProps) {
  const { token } = await params;
  const [gatingMap, claim] = await Promise.all([
    getPlanGatingMap(),
    getTeamWorkspaceClaimByToken(token).catch(error => {
      console.error('[team claim] lookup error:', error);
      return null;
    }),
  ]);

  if (!claim) {
    return (
      <ClaimUnavailable
        title="Claim link not found"
        body="This Team workspace claim link is invalid. Use the latest link from your tournament email or start a new Team workspace."
      />
    );
  }

  if (claim.status !== 'available') {
    return (
      <ClaimUnavailable
        title={claim.status === 'claimed' ? 'Team already claimed' : 'Claim link unavailable'}
        body={
          claim.status === 'claimed'
            ? 'This tournament team has already been activated as a Team workspace.'
            : 'This Team workspace claim link has expired or was revoked.'
        }
      />
    );
  }

  const prefill: TeamClaimPrefill = {
    token: claim.token,
    contactEmail: claim.contactEmail,
    teamName: claim.tournamentTeam.name,
    coachName: claim.tournamentTeam.coachName,
    ageGroup: claim.ageGroup.name,
    tournamentName: claim.tournament.name,
    seasonYear: claim.seasonYear,
  };

  return (
    <Suspense fallback={null}>
      <TeamSignupClient teamIsGated={gatingMap.team} claim={prefill} />
    </Suspense>
  );
}
