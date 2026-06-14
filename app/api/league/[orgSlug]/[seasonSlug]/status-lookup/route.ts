import { NextResponse } from 'next/server';
import { getLeagueSeasonBySlug, getDivisionsForSeason } from '@/lib/db';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

export const dynamic = 'force-dynamic';

/**
 * POST /api/league/[orgSlug]/[seasonSlug]/status-lookup
 *
 * Secure replacement for the old GET status oracle (audit J3-069). The previous page
 * returned a guardian's children (names, age division, status, waitlist position) to
 * ANYONE who typed an email — no possession proof — and leaked the email into the URL.
 *
 * Now the caller must supply the email AND a valid registration reference code (the
 * 8-char code shown on the confirmation screen and in every registration email). The
 * code is the possession proof: a stranger who guesses an email but not a code gets
 * nothing. Submitting via POST keeps the email out of URLs/logs. The org is gated like
 * the rest of the public league surface, so this works only on public, entitled orgs.
 *
 * Privacy: the response is deliberately uniform — an invalid email/code pair and a
 * never-registered email both return `{ registrations: [] }`, so the endpoint can't be
 * used to enumerate which emails are registered.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; seasonSlug: string }> },) => {
  const { orgSlug, seasonSlug } = await params;

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
  // Reference code = first 8 chars of the registration id, shown uppercased. Be forgiving
  // about spaces/dashes the user might paste; keep only hex and take the first 8.
  const refCode = typeof body.refCode === 'string'
    ? body.refCode.trim().toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 8)
    : '';

  if (!email || refCode.length !== 8) {
    return NextResponse.json(
      { error: 'Enter the guardian email and the 8-character reference code from your confirmation.' },
      { status: 400 },
    );
  }

  const { data } = await supabaseAdmin
    .from('league_registrations')
    .select('id, status, player_first_name, player_last_name, division_id, waitlist_position')
    .eq('season_id', season.id)
    .eq('guardian_email', email)
    .not('status', 'in', '(declined,withdrawn)');

  const rows = data ?? [];

  // Possession check: the supplied code must match one of THIS email's registrations.
  // If it does, the caller has proven they hold a real confirmation for this email, so
  // we return all of that email's registrations (e.g. siblings). Otherwise: nothing.
  const codeMatches = rows.some((r: any) => String(r.id).slice(0, 8).toUpperCase() === refCode);
  if (!codeMatches) {
    return NextResponse.json({ registrations: [] });
  }

  const divisions = await getDivisionsForSeason(season.id);
  const divisionMap = Object.fromEntries(divisions.map(d => [d.id, d.name]));

  const registrations = rows.map((r: any) => ({
    ref: String(r.id).slice(0, 8).toUpperCase(),
    status: r.status,
    playerFirstName: r.player_first_name,
    playerLastName: r.player_last_name,
    divisionName: divisionMap[r.division_id] ?? '—',
    waitlistPosition: r.waitlist_position ?? null,
  }));

  return NextResponse.json({ registrations });
}, { route: '/api/league/[orgSlug]/[seasonSlug]/status-lookup' });
