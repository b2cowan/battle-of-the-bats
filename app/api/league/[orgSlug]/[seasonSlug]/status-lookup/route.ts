import { NextResponse } from 'next/server';
import { getLeagueSeasonBySlug, getDivisionsForSeason } from '@/lib/db';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { throttlePublicForm } from '@/lib/public-form-throttle';
import { registrationReference } from '@/lib/utils';
import { registrationOwes } from '@/lib/league-price';

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

  const { data } = await supabaseAdmin
    .from('league_registrations')
    .select('id, status, player_first_name, player_last_name, division_id, waitlist_position, signup_ref, fee_amount, registration_fee_paid, fee_entry_id')
    .eq('season_id', season.id)
    .eq('guardian_email', email)
    .not('status', 'in', '(declined,withdrawn)')
    .order('registered_at', { ascending: true });

  const rows = data ?? [];

  // Possession check: the supplied code must match one of THIS email's registrations (its sign-up's reference, or its own).
  // If it does, the caller has proven they hold a real confirmation for this email, so we return all of that email's
  // registrations this season (siblings signed up separately too). Otherwise: nothing.
  const codeMatches = rows.some((r: any) => r.signup_ref === refCode || registrationReference(String(r.id)) === refCode);
  if (!codeMatches) {
    return NextResponse.json({ registrations: [] });
  }

  const divisions = await getDivisionsForSeason(season.id);
  const divisionMap = Object.fromEntries(divisions.map(d => [d.id, d.name]));
  // The day each paid fee was received ("$150 · paid Oct 24").
  const entryIds = rows.map((r: any) => r.fee_entry_id).filter(Boolean);
  const paidOn = new Map<string, string>();
  if (entryIds.length) {
    const { data: entries } = await supabaseAdmin.from('accounting_entries').select('id, entry_date').in('id', entryIds);
    for (const e of entries ?? []) paidOn.set(e.id as string, String(e.entry_date));
  }

  const registrations = rows.map((r: any) => {
    const fee = registrationOwes({ feeAmount: r.fee_amount != null ? Number(r.fee_amount) : null }, season);
    return {
      ref: r.signup_ref ?? registrationReference(String(r.id)),
      status: r.status,
      playerFirstName: r.player_first_name,
      playerLastName: r.player_last_name,
      divisionName: divisionMap[r.division_id] ?? '—',
      waitlistPosition: r.waitlist_position ?? null,
      fee,
      paid: r.registration_fee_paid === true,
      paidOn: r.fee_entry_id ? paidOn.get(r.fee_entry_id) ?? null : null,
    };
  });
  // The club's how-to-pay words reach the family only once a child is accepted and owes something (9b·9).
  const owes = registrations.some(r => r.status === 'active' && !r.paid && (r.fee ?? 0) > 0);

  return NextResponse.json({
    registrations,
    howToPay: owes ? season.howToPay : null,
    clubName: org.name,
    reviewFirst: !season.autoApproveUnderCapacity,
  });
}, { route: '/api/league/[orgSlug]/[seasonSlug]/status-lookup' });
