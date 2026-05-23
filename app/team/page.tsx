import { Suspense } from 'react';
import TeamSignupClient from './TeamSignupClient';
import { getPlanGatingMap } from '@/lib/plan-gating-server';

export const metadata = {
  title: 'Team Workspace - FieldLogicHQ',
  description: 'Create a standalone Team workspace for one competitive team, with coach-scoped roster, schedule, documents, dues, and budget tools.',
};

export default async function TeamSignupPage() {
  const gatingMap = await getPlanGatingMap();

  return (
    <Suspense fallback={null}>
      <TeamSignupClient teamIsGated={gatingMap.team} />
    </Suspense>
  );
}
