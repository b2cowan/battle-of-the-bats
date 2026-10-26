import { NextResponse } from 'next/server';
import { getLeagueSeasonBySlug } from '@/lib/db';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { throttlePublicForm } from '@/lib/public-form-throttle';
import { registrationReference } from '@/lib/utils';
import { buildSignupStatus, SIGNUP_STATUS_COLUMNS, type SignupStatusRow } from '@/lib/league-signup-status';
import { buildLeaguePayView } from '@/lib/league-pay-view';
import { getClubSiteContent } from '@/lib/club-page-meta';

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
 * 12b: and the pay block (`pay`) when the club takes card payments — the same view the pay link opens.
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
    .select(`${SIGNUP_STATUS_COLUMNS}, guardian_email`)
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

  // Each child's money, from the season's book (the shaping is shared with the pay link's page, Stage 12b).
  const contactEmail = (await getClubSiteContent(org.id).catch(() => null))?.contactEmail ?? null;
  // The pay block covers the WHOLE sign-up (its siblings' names are on it), so it comes only with the reference that
  // shows the whole sign-up — the sign-up's own, or an older registration that has none. A child's own code opens that
  // child alone, and no pay block.
  const wholeSignup = named.every((r: any) => r.signup_ref === refCode || !r.signup_ref);
  const [status, pay] = await Promise.all([
    buildSignupStatus(season, org.name, named as SignupStatusRow[]),
    // 12b: the pay block, when the club takes card payments (null keeps today's words, A6). The reference proved the
    // sign-up, as the pay link does, so the page gets the link's key for Pay.
    wholeSignup ? buildLeaguePayView(String(named[0].id), contactEmail) : Promise.resolve(null),
  ]);
  return NextResponse.json({ ...status, pay });
}, { route: '/api/league/[orgSlug]/[seasonSlug]/status-lookup' });
