import { NextResponse } from 'next/server';
import { getLeagueSeasonBySlug } from '@/lib/db';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { withObservability } from '@/lib/observability';
import { throttlePublicForm, throttlePublicFormRecipient } from '@/lib/public-form-throttle';
import { checkNoLoginRateLimit } from '@/lib/no-login-token';
import { sendSignupLinks } from '@/lib/league-signup-link-mail';
import { SIGNUP_LINK_WORDS as SW } from '@/lib/league-pay-words';
import { holdUntilFloor } from '@/lib/no-tell-floor';
import { isValidEmail } from '@/lib/auth-errors';

export const dynamic = 'force-dynamic';

const TOO_MANY = 'Too many attempts. Please wait a few minutes and try again.';

/**
 * POST /api/league/[orgSlug]/[seasonSlug]/email-my-link — "Email me my link" (Signed-in family accounts Stage 1 Part 4,
 * drawing tab 2). It REPLACES the email-and-reference lookup (`status-lookup`, deleted), which opened a family's page
 * for anyone who had seen one of their emails: the reference is printed on every email, so it was never a secret.
 *
 * Possession, now: the INBOX. The caller types an email; every sign-up in this season under it whose link would open
 * is emailed to that address (`sendSignupLinks`), and nothing about any sign-up is ever in the response — no pay key, no
 * names, not even whether one matched. The answer is the SAME body, the same status and (by the floor) the same time
 * whether or not anything was sent, so the endpoint cannot be used to learn who is signed up. The only answers that
 * differ are a malformed email and a throttle, and neither depends on who is signed up.
 *
 * Throttled three ways: the public forms' per-IP budget, the per-inbox budget (one stranger's inbox cannot be flooded
 * from rotating addresses), and its own durable rail (`signup_link_email`). The org is gated like the rest of the
 * public league surface.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; seasonSlug: string }> },) => {
  const started = Date.now();
  const { orgSlug, seasonSlug } = await params;

  const throttled = throttlePublicForm(req);
  if (throttled) return throttled;

  const org = await resolvePublicLeagueContext(orgSlug);
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const season = await getLeagueSeasonBySlug(org.id, seasonSlug);
  if (!season) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: { email?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: SW.errEmail }, { status: 400 }); }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!isValidEmail(email) || email.length > 254) return NextResponse.json({ error: SW.errEmail }, { status: 400 });

  const perInbox = throttlePublicFormRecipient(email);
  if (perInbox) return perInbox;
  const rail = await checkNoLoginRateLimit('signup_link_email', req);
  if (!rail.allowed) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429, headers: { 'Retry-After': String(rail.retryAfterSeconds || 60) } });
  }

  try {
    await sendSignupLinks(org, { id: season.id, name: season.name, slug: season.slug }, email);
  } catch (e) {
    // A failed send answers the same as a sent one: the screen tells the family to ask the club when nothing arrives.
    console.error('[email-my-link] send failed:', e);
  }

  // Forgot password's floor (2 s): a match (which reads the sign-ups and sends an email) and a miss answer at one time.
  await holdUntilFloor(started);
  return NextResponse.json({ ok: true });
}, { route: '/api/league/[orgSlug]/[seasonSlug]/email-my-link' });
