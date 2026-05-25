import { Suspense } from 'react';
import TeamSignupClient from '@/app/team/TeamSignupClient';
import { getPlanGatingMap } from '@/lib/plan-gating-server';

export const metadata = {
  title: 'Coaches Portal - FieldLogicHQ',
  description: 'Activate Coaches Portal Premium for one competitive team, with coach-scoped roster, schedule, documents, dues, budget, and lineup tools.',
};

export default async function CoachesPortalStartPage() {
  const gatingMap = await getPlanGatingMap();

  return (
    <Suspense fallback={null}>
      <TeamSignupClient teamIsGated={gatingMap.team} />
    </Suspense>
  );
}
