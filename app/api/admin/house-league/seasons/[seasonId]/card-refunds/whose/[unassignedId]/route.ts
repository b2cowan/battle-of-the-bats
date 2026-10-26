import { NextResponse } from 'next/server';
import { getAuthContextWithRole, forbidden } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { canMarkLeagueFeePaid } from '@/lib/league-fee-paid';
import { getLeagueSeasonById } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { CARD_REFUND_WORDS } from '@/lib/house-league-money-words';
import { cardLabel, money } from '@/lib/online-payment-words';
import { childList } from '@/lib/league-pay-words';
import { possessive } from '@/lib/utils';
import { formatStoredDate, orgDayKey } from '@/lib/timezone';
import { retrieveRefund } from '@/lib/stripe-connect';
import { recordLeagueRefundRows } from '@/lib/online-payment-landing';
import { onlinePaymentsOn } from '@/lib/online-payments-switch';

/**
 * "WHOSE WAS IT?" (Club Tier Stage 12c Part 3; words CLUB_TIER_STAGE12C_REFUND_VISIBLE_COPY.md §5). A part refund made in
 * the club's Stripe dashboard on a payment for two or more children is held out of the season's book until the desk says
 * whose fee it was — one child, or split between them. GET reads what the window needs; POST records it (a refund row per
 * child, one Stripe id), books it, tells the family once (or asks "what now?" for a child still enrolled) and clears the
 * notice. The desk only (takeFees; the treasurer never refunds, §0f).
 */

type Ctx = { orgId: string; seasonId: string; unassignedId: string };

async function load({ orgId, seasonId, unassignedId }: Ctx) {
  const { data: u } = await supabaseAdmin.from('online_refunds_unassigned')
    .select('id, org_id, online_payment_id, stripe_refund_id, amount, stripe_created_at, created_at, assigned_at')
    .eq('id', unassignedId).eq('org_id', orgId).maybeSingle();
  if (!u) return null;
  const { data: op } = await supabaseAdmin.from('online_payments')
    .select('id, org_id, season_id, stripe_account_id, card_brand, card_last4, bank_last4, rail')
    .eq('id', u.online_payment_id as string).maybeSingle();
  if (!op || op.season_id !== seasonId) return null;
  const { data: items } = await supabaseAdmin.from('online_payment_items')
    .select('id, registration_id, amount, description').eq('online_payment_id', op.id as string).order('created_at').order('id');
  const { data: back } = await supabaseAdmin.from('online_payment_refunds')
    .select('online_payment_item_id, amount, fee_refunded, status, booked_at').eq('online_payment_id', op.id as string);
  const used = new Map<string, number>();
  for (const f of (back ?? []) as Array<{ online_payment_item_id: string | null; amount: number; fee_refunded: number; status: string; booked_at: string | null }>) {
    if (!f.online_payment_item_id || (f.status !== 'pending' && f.status !== 'succeeded' && !f.booked_at)) continue;
    used.set(f.online_payment_item_id, (used.get(f.online_payment_item_id) ?? 0) + Math.round((Number(f.amount) - Number(f.fee_refunded)) * 100));
  }
  const rows = (items ?? []) as Array<{ id: string; registration_id: string | null; amount: number; description: string }>;
  const regIds = rows.map(i => i.registration_id).filter((x): x is string => !!x);
  const { data: regs } = regIds.length
    ? await supabaseAdmin.from('league_registrations').select('id, player_first_name, player_last_name, division_id, guardian_email').in('id', regIds)
    : { data: [] };
  const regById = new Map(((regs ?? []) as Array<{ id: string; player_first_name: string; player_last_name: string; division_id: string | null; guardian_email: string }>).map(r => [r.id, r]));
  const divIds = [...new Set([...regById.values()].map(r => r.division_id).filter((x): x is string => !!x))];
  const { data: divs } = divIds.length ? await supabaseAdmin.from('league_divisions').select('id, name').in('id', divIds) : { data: [] };
  const divName = new Map(((divs ?? []) as Array<{ id: string; name: string }>).map(d => [d.id, d.name]));
  const children = rows.flatMap(i => {
    const g = i.registration_id ? regById.get(i.registration_id) : undefined;
    if (!g) return [];
    return [{
      itemId: i.id, regId: g.id, name: `${g.player_first_name} ${g.player_last_name}`, first: g.player_first_name,
      division: (g.division_id ? divName.get(g.division_id) : null) ?? (i.description.split(' · ')[1] ?? ''),
      paidCents: Math.round(Number(i.amount) * 100), leftCents: Math.round(Number(i.amount) * 100) - (used.get(i.id) ?? 0),
    }];
  });
  return { u, op, children, guardianEmail: [...regById.values()][0]?.guardian_email?.trim() ?? '' };
}

async function gate(req: Request, params: Promise<{ seasonId: string; unassignedId: string }>) {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'read');
  if (err) return { err };
  if (!canMarkLeagueFeePaid(ctx!)) return { err: forbidden() };
  const { seasonId, unassignedId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return { err: NextResponse.json({ error: 'Season not found' }, { status: 404 }) };
  return { ctx: ctx!, seasonId, unassignedId };
}

export const GET = withObservability(async (req: Request, { params }: { params: Promise<{ seasonId: string; unassignedId: string }> }) => {
  const g = await gate(req, params);
  if ('err' in g) return g.err as Response;
  const read = await load({ orgId: g.ctx.org.id, seasonId: g.seasonId, unassignedId: g.unassignedId });
  if (!read) return NextResponse.json({ error: 'That refund is no longer waiting.' }, { status: 404 });
  const at = (read.u.stripe_created_at as string | null) ?? (read.u.created_at as string);
  return NextResponse.json({
    amount: Number(read.u.amount), assigned: !!read.u.assigned_at,
    day: formatStoredDate(orgDayKey(at), { withYear: false }),
    card: read.op.rail === 'bank_debit' ? `the account ending ${read.op.bank_last4 ?? ''}` : cardLabel(read.op.card_brand as string | null, read.op.card_last4 as string | null),
    reference: read.u.stripe_refund_id as string,
    children: read.children.map(c => ({ regId: c.regId, name: c.name, first: c.first, division: c.division, paid: c.paidCents / 100, left: c.leftCents / 100 })),
    guardianEmail: read.guardianEmail,
  });
}, { route: '/api/admin/house-league/seasons/[seasonId]/card-refunds/whose/[unassignedId]' });

export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ seasonId: string; unassignedId: string }> }) => {
  const g = await gate(req, params);
  if ('err' in g) return g.err as Response;
  const read = await load({ orgId: g.ctx.org.id, seasonId: g.seasonId, unassignedId: g.unassignedId });
  if (!read) return NextResponse.json({ error: 'That refund is no longer waiting.' }, { status: 404 });
  if (read.u.assigned_at) return NextResponse.json({ error: 'Someone already said whose it was.', code: 'answered' }, { status: 409 });
  // The launch switch (every online-payments door reads it): answering reads the refund from Stripe.
  if (!onlinePaymentsOn()) return NextResponse.json({ error: 'Online payments aren’t available right now. Try again later.', code: 'switch_off' }, { status: 409 });
  const W = CARD_REFUND_WORDS.whose;
  const body = await req.json().catch(() => ({})) as { picks?: Array<{ regId?: unknown; amount?: unknown }>; reason?: unknown };
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const amountCents = Math.round(Number(read.u.amount) * 100);
  const picks = (Array.isArray(body.picks) ? body.picks : [])
    .map(p => ({ child: read.children.find(c => c.regId === p.regId), cents: Math.round(Number(p.amount) * 100) }))
    .filter(p => p.child && Number.isFinite(p.cents) && p.cents > 0);
  if (!picks.length) return NextResponse.json({ error: W.errChoose, code: 'choose' }, { status: 400 });
  const sum = picks.reduce((n, p) => n + p.cents, 0);
  if (sum !== amountCents) return NextResponse.json({ error: W.errSum(money(sum / 100), money(amountCents / 100)), code: 'sum' }, { status: 400 });
  const over = picks.find(p => p.cents > p.child!.leftCents);
  if (over) return NextResponse.json({ error: W.errOver(possessive(over.child!.first), money(over.child!.leftCents / 100)), code: 'over' }, { status: 400 });
  if (!reason) return NextResponse.json({ error: W.errReason, code: 'reason' }, { status: 400 });
  if (reason.length > 500) return NextResponse.json({ error: 'A reason is at most 500 characters.', code: 'reason' }, { status: 400 });

  // Claim the answer first, so two desks answering at once record it once.
  const { data: claimed } = await supabaseAdmin.from('online_refunds_unassigned')
    .update({ assigned_at: new Date().toISOString(), assigned_by: g.ctx.user.id })
    .eq('id', read.u.id as string).is('assigned_at', null).select('id').maybeSingle();
  if (!claimed) return NextResponse.json({ error: 'Someone already said whose it was.', code: 'answered' }, { status: 409 });
  let emailed = false;
  try {
    const stripe = await retrieveRefund(read.op.stripe_account_id as string, read.u.stripe_refund_id as string);
    ({ emailed } = await recordLeagueRefundRows(
      g.ctx.org, read.op as Parameters<typeof recordLeagueRefundRows>[1], read.u.stripe_refund_id as string,
      (read.u.stripe_created_at as string | null) ?? (read.u.created_at as string), stripe.status === 'succeeded',
      picks.map(p => ({ itemId: p.child!.itemId, base: p.cents, fee: 0 })), reason, g.ctx.user.id,
    ));
  } catch (e) {
    // Nothing recorded: the question stays open.
    await supabaseAdmin.from('online_refunds_unassigned').update({ assigned_at: null, assigned_by: null }).eq('id', read.u.id as string);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'The refund couldn’t be recorded. Try again.', code: 'record' }, { status: 409 });
  }
  const names = childList(picks.map(p => p.child!.first));
  const amount = money(amountCents / 100);
  // A child still enrolled waits for "what now?", so the family isn't emailed yet: the toast says only what was done.
  const said = !emailed ? W.recorded(amount, names)
    : read.guardianEmail ? W.done(amount, names, read.guardianEmail) : W.doneNoEmail(amount, names);
  return NextResponse.json({ said });
}, { route: '/api/admin/house-league/seasons/[seasonId]/card-refunds/whose/[unassignedId]' });
