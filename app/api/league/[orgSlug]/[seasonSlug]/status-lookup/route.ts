import { NextResponse } from 'next/server';
import { getLeagueSeasonBySlug, getDivisionsForSeason } from '@/lib/db';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { throttlePublicForm } from '@/lib/public-form-throttle';
import { registrationReference } from '@/lib/utils';
import { registrationOwes } from '@/lib/league-price';
import { loadRegistrationMoneyLines } from '@/lib/league-money-read';
import { lastPayment, lastRefund, receivedOf } from '@/lib/league-money';

export const dynamic = 'force-dynamic';

/**
 * POST /api/league/[orgSlug]/[seasonSlug]/status-lookup
 *
 * Secure replacement for the old GET status oracle (audit J3-069). The previous page
 * returned a guardian's children (names, age division, status, waitlist position) to
 * ANYONE who typed an email — no possession proof — and leaked the email into the URL.
 *
 * Now the caller must supply the email AND a valid reference: the sign-up's (Club Tier 9b-1: one reference ties every
 * child a family signed up together) or, for an older registration, the 8-char code from its own id. The code is the
 * possession proof: a stranger who guesses an email but not a code gets nothing. Submitting via POST keeps the email out
 * of URLs/logs. The org is gated like the rest of the public league surface, so this works only on public, entitled orgs.
 *
 * Privacy: the response is deliberately uniform — an invalid email/code pair and a
 * never-registered email both return `{ registrations: [] }`, so the endpoint can't be
 * used to enumerate which emails are registered.
 *
 * Throttled (2026-09-25): the reference code is the only secret, so an unlimited endpoint let a
 * caller who knows an email walk the code space at will.
 *
 * 9b-1 (Part 5): each child's price (the one recorded at sign-up) and whether it is paid, and the club's how-to-pay words
 * once a child is accepted and owes something. "Accepted" is the family's word (the page says it, not this route).
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; seasonSlug: string }> },) => {
  const { orgSlug, seasonSlug } = await params;

  const throttled = throttlePublicForm(req);
  if (throttled) return throttled;

  const org = await resolvePublicLeagueContext(orgSlug);
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const season = await getLeagueSeasonBySlug(org.id, seasonSlug);
  if (!season) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: { email?: unknown; refCode?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  // A reference is 8 characters (hex). Be forgiving about spaces, dashes and a leading # the user might paste.
  const refCode = typeof body.refCode === 'string'
    ? body.refCode.trim().toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 8)
    : '';

  if (!email || refCode.length !== 8) {
    return NextResponse.json(
      { error: 'Enter the email you signed up with and the 8-character reference from your confirmation.' },
      { status: 400 },
    );
  }

  // 9b-2: an ended child is shown too (Declined / Withdrawn, with a refund or the fee the club kept), and the money is
  // read from the season's book (a part payment after a price rise reads true), never from the paid flag alone.
  const { data } = await supabaseAdmin
    .from('league_registrations')
    .select('id, status, player_first_name, player_last_name, division_id, waitlist_position, signup_ref, fee_amount, end_money, end_money_reason, withdraw_requested_at')
    .eq('season_id', season.id)
    .eq('guardian_email', email)
    .order('registered_at', { ascending: true });

  const rows = data ?? [];

  // Possession: a reference shows ONLY the registrations it names — the children of that one sign-up (or, for an older
  // registration, that registration). Never every child under the email: anyone can sign up under any email they type,
  // receive a reference for it, and would otherwise read another family's children with it (review 2026-10-25).
  const named = rows.filter((r: any) => r.signup_ref === refCode || registrationReference(String(r.id)) === refCode);
  if (named.length === 0) {
    return NextResponse.json({ registrations: [] });
  }

  const divisions = await getDivisionsForSeason(season.id);
  const divisionMap = Object.fromEntries(divisions.map(d => [d.id, d.name]));
  // Each child's money, from the season's book: received (in − out), the last payment's day, and any refund.
  const lines = await loadRegistrationMoneyLines(named.map((r: any) => String(r.id)));

  const registrations = named.map((r: any) => {
    const fee = registrationOwes({ feeAmount: r.fee_amount != null ? Number(r.fee_amount) : null }, season);
    const mine = lines.get(String(r.id)) ?? [];
    const received = receivedOf(mine);
    const last = lastPayment(mine);
    const refund = lastRefund(mine);
    const ended = r.status === 'declined' || r.status === 'withdrawn';
    return {
      ref: r.signup_ref ?? registrationReference(String(r.id)),
      // The child's own code: what "Ask to withdraw" names (shown only to a family that already holds the reference).
      child: registrationReference(String(r.id)),
      status: r.status,
      playerFirstName: r.player_first_name,
      playerLastName: r.player_last_name,
      divisionName: divisionMap[r.division_id] ?? '—',
      waitlistPosition: r.waitlist_position ?? null,
      fee,
      received,
      paid: (fee ?? 0) > 0 && received >= (fee ?? 0),
      owing: !ended && r.status === 'active' ? Math.max(0, Math.round(((fee ?? 0) - received) * 100) / 100) : 0,
      paidOn: last?.day ?? null,
      refund: refund ? { amount: mine.filter(l => l.status === 'posted' && l.dir === 'out').reduce((s, l) => s + l.amount, 0), day: refund.day, method: refund.method } : null,
      kept: ended && r.end_money === 'kept' && received > 0 ? { amount: received, reason: r.end_money_reason ?? '' } : null,
      withdrawRequestedAt: r.withdraw_requested_at ?? null,
    };
  });
  // The club's how-to-pay words reach the family only once a child is accepted and owes something (9b·9).
  const owes = registrations.some(r => r.status === 'active' && r.owing > 0);

  return NextResponse.json({
    registrations,
    howToPay: owes ? season.howToPay : null,
    clubName: org.name,
    reviewFirst: !season.autoApproveUnderCapacity,
    // A finished season takes no "Ask to withdraw" (9b-2).
    finished: season.status === 'completed' || season.status === 'archived',
  });
}, { route: '/api/league/[orgSlug]/[seasonSlug]/status-lookup' });
