import { Suspense } from 'react';
import TeamSignupClient from '@/app/team/TeamSignupClient';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import { createClient } from '@/lib/supabase-server';
import CoachStartInterest from '@/components/coaches/CoachStartInterest';

export const metadata = {
  title: 'Coaches Portal - FieldLogicHQ',
  description: 'Activate Coaches Portal Premium for one competitive team, with coach-scoped roster, schedule, documents, dues, budget, and lineup tools.',
};

export default async function CoachesPortalStartPage() {
  const gatingMap = await getPlanGatingMap();

  // GATED (self-serve checkout not open) → a real express-interest capture instead of a disabled
  // checkout dead-end (Phase 5m / J5-051). The single destination all "express interest" labels
  // point to. Prefilled from the session when signed in; works signed-out. Never a purchase.
  if (gatingMap.team) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const meta = (user?.user_metadata ?? {}) as { full_name?: string; first_name?: string; last_name?: string };
    const defaultName = [meta.first_name, meta.last_name].filter(Boolean).join(' ').trim() || meta.full_name || '';
    return <CoachStartInterest defaultName={defaultName} defaultEmail={user?.email ?? ''} />;
  }

  return (
    <Suspense fallback={null}>
      <TeamSignupClient teamIsGated={false} />
    </Suspense>
  );
}
