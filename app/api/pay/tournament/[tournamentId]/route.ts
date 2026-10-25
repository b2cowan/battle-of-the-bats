import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { hasPlanFeature } from '@/lib/plan-features';
import { onlinePaymentsOn } from '@/lib/online-payments-switch';
import { factsFromRow, takesPayments, PAYOUTS_ACCOUNT_COLUMNS, type PayoutsAccountRow } from '@/lib/online-payment-account';
import { tournamentTracksPayments } from '@/lib/tournament-payments-tracked';
import { getOrganizationBySlugForServer } from '@/lib/server-organizations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Does this tournament take payments online? (Club Tier Stage 12a, copy §10) — the public registration form's review
 * step asks, to say what will happen once the team is accepted. A yes/no and nothing else: no account, no rate. Any doubt
 * answers no, and the form keeps today's box word for word (A6).
 */
export const GET = withObservability(async (_req: Request, { params }: { params: Promise<{ tournamentId: string }> }) => {
  const { tournamentId } = await params;
  const no = NextResponse.json({ online: false });
  if (!onlinePaymentsOn() || !/^[0-9a-f-]{36}$/i.test(tournamentId)) return no;
  const { data: t } = await supabaseAdmin.from('tournaments').select('org_id, settings, status').eq('id', tournamentId).maybeSingle();
  if (!t || !tournamentTracksPayments(t.settings)) return no;
  const [{ data: org }, { data: acct }] = await Promise.all([
    supabaseAdmin.from('organizations').select('slug').eq('id', t.org_id as string).maybeSingle(),
    supabaseAdmin.from('org_payment_accounts').select(PAYOUTS_ACCOUNT_COLUMNS).eq('org_id', t.org_id as string).maybeSingle(),
  ]);
  const full = org?.slug ? await getOrganizationBySlugForServer(org.slug as string) : null;
  if (!full || !hasPlanFeature(full.planId, 'online_payments')) return no;
  return NextResponse.json({ online: takesPayments(factsFromRow(acct as PayoutsAccountRow | null)) });
}, { route: '/api/pay/tournament/[tournamentId]' });
