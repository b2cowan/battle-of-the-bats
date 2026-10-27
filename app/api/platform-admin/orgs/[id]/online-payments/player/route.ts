import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { writePlatformAuditLogStrict } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * "Show the player" (Club Tier Stage 12d-2 Part 5; words §6.1 `pa.player.show`): a disputed payment's child or team, named
 * only on request, and every opening logged ("Opening a name is logged."). A read: the only row it writes is the audit
 * entry. Never a card or bank number. The roles that read a club's Stripe records.
 */
export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;

export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('find_stripe');
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { onlinePaymentId?: unknown };
  const paymentId = typeof body.onlinePaymentId === 'string' && UUID.test(body.onlinePaymentId) ? body.onlinePaymentId : null;
  if (!paymentId) return NextResponse.json({ error: 'That payment couldn’t be found.' }, { status: 404 });
  const { data: op } = await supabaseAdmin.from('online_payments').select('id, org_id, flow, team_id, description')
    .eq('id', paymentId).eq('org_id', id).maybeSingle();
  if (!op) return NextResponse.json({ error: 'That payment couldn’t be found.' }, { status: 404 });
  // Only a disputed payment's name is shown here (the panel's rows).
  const { count: disputed } = await supabaseAdmin.from('online_payment_disputes').select('id', { count: 'exact', head: true })
    .eq('org_id', id).eq('online_payment_id', op.id);
  if (!disputed) return NextResponse.json({ error: 'That payment couldn’t be found.' }, { status: 404 });
  // Logged FIRST, strictly (/review): a log that can't be written shows no name.
  await writePlatformAuditLogStrict(auth.user.email ?? 'platform-admin', id, 'online_payment_player_shown', 'online_payment', null, { onlinePaymentId: op.id }, {});

  let names: string[] = [];
  if (op.flow === 'tournament_team') {
    const { data: team } = op.team_id ? await supabaseAdmin.from('teams').select('name').eq('id', op.team_id as string).maybeSingle() : { data: null };
    names = [(team?.name as string | undefined) ?? (op.description as string)];
  } else {
    const { data: items } = await supabaseAdmin.from('online_payment_items').select('registration_id, description').eq('online_payment_id', op.id);
    const regIds = (items ?? []).map(i => i.registration_id as string | null).filter((x): x is string => !!x);
    const { data: regs } = regIds.length
      ? await supabaseAdmin.from('league_registrations').select('id, player_first_name, player_last_name').in('id', regIds)
      : { data: [] };
    names = (regs ?? []).map(r => `${r.player_first_name ?? ''} ${r.player_last_name ?? ''}`.trim()).filter(Boolean);
    if (!names.length) names = (items ?? []).map(i => (i.description as string).split(' · ')[0]);
  }
  return NextResponse.json({ names }, { headers: { 'Cache-Control': 'no-store' } });
}, { route: '/api/platform-admin/orgs/[id]/online-payments/player' });
