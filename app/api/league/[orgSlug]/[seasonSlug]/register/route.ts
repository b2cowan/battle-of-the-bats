import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getLeagueSeasonBySlug, getDivisionsForSeason } from '@/lib/db';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { leagueSignupHtml } from '@/lib/email';
import { sendTransactionalEmail } from '@/lib/platform-email-templates';
import { systemMailFace } from '@/lib/club-email-context';
import { withObservability } from '@/lib/observability';
import { throttlePublicForm, throttlePublicFormRecipient } from '@/lib/public-form-throttle';
import { placeLeagueRegistration } from '@/lib/league-registration-place';
import { leaguePrice } from '@/lib/league-price';
import { isCalendarDate, tournamentToday } from '@/lib/timezone';
import { registrationRefusal } from '@/lib/league-registration-state';
import { cutoffFor, bornFitsDate } from '@/lib/born-years';
import { normalizeGuardianEmailRequired } from '@/lib/guardian-email';
import { recordLeagueMarketingConsent } from '@/lib/org-people';
import { notify } from '@/lib/notify';
import { signupNotice, signupSubject, type PlacedChild } from '@/lib/league-signup';

export const dynamic = 'force-dynamic';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A FAMILY SIGNS UP ONE CHILD OR SEVERAL (Club Tier Stage 9b-1, Parts 3–6; owner Q5, 9b·4, 9b·5, 9b·12, 9b·13, S2·b;
 * words HOUSE_LEAGUE_STAGE9B1_COPY.md §7, §8, §10–§12).
 *
 *   1. The form takes a sign-up only while its status AND its dates say so (the refusal says why).
 *   2. Every child is checked first; nothing is placed until the whole request is well formed.
 *   3. A date of birth is required on a season that sorts by age, and it picks the division (with the club's cut-off). A
 *      child no division takes is NOT registered (9b·4); two divisions for one age group need the family's pick (9b·13).
 *   4. Each child is placed through the one locked database step (Part 3), its price recorded on the club's day. Each gets
 *      its own outcome (9b·5): accepted, received, waitlisted — or refused as already signed up. No all-or-nothing.
 *   5. One reference ties the children together; one email lists them all; one notice reaches the club's Needs attention.
 *   6. The unticked email-consent line, when ticked, files one consent row for the sign-up (CASL).
 * The email and the notice are AWAITED (each in its own try): the email carries the family's reference and how to pay, and
 * work left running after the response can be dropped on the host (Next after() on Amplify). Neither fails the sign-up.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const MAX_CHILDREN = 8;
/** The consent line's words, as the family read them (the evidence filed with a tick). */
const consentLine = (club: string) => `${club} may email me about future seasons and club news. You can unsubscribe at any time.`;

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function str(v: unknown, max?: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return max ? t.slice(0, max) : t;
}

type ChildIn = { firstName: string | null; lastName: string | null; dob: string | null; divisionId: string | null; jersey: string | null; position: string | null; notes: string | null };

/** A family's reference: eight characters they can read back (the status page takes it with their email). */
function newReference(): string {
  return randomBytes(4).toString('hex').toUpperCase();
}

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; seasonSlug: string }> },) => {
  const { orgSlug, seasonSlug } = await params;

  const throttled = throttlePublicForm(req);
  if (throttled) return throttled;

  // Gate the public register API exactly like the league index/sub-pages (audit J3-068):
  // a private, canceled, or non-entitled org must not accept public registrations.
  const org = await resolvePublicLeagueContext(orgSlug);
  if (!org) return NextResponse.json({ error: 'This club’s site isn’t available.' }, { status: 404 });

  const season = await getLeagueSeasonBySlug(org.id, seasonSlug);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  // 1. The form takes a sign-up only while its status AND its dates say so (9b-1 Part 4, S2·b); the refusal says why.
  const closed = registrationRefusal(season);
  if (closed) return NextResponse.json({ error: closed, code: 'not_open' }, { status: 409 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // 2. The whole request, checked before anything is placed. One child in the old flat shape still reads as one child.
  const rawChildren: Record<string, unknown>[] = Array.isArray(body.children)
    ? (body.children as unknown[]).filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
    : [{ firstName: body.playerFirstName, lastName: body.playerLastName, dateOfBirth: body.playerDateOfBirth, divisionId: body.divisionId,
        jerseyPref: body.playerJerseyPref, positionPref: body.playerPositionPref, notes: body.playerNotes }];
  if (rawChildren.length === 0) return NextResponse.json({ error: 'Add a child to sign up.' }, { status: 400 });
  if (rawChildren.length > MAX_CHILDREN) {
    return NextResponse.json({ error: `You can sign up ${MAX_CHILDREN} children at once. Sign up again for more.` }, { status: 400 });
  }
  const kids: ChildIn[] = rawChildren.map(c => ({
    firstName: str(c.firstName, 80), lastName: str(c.lastName, 80), dob: str(c.dateOfBirth), divisionId: str(c.divisionId),
    jersey: str(c.jerseyPref, 3), position: str(c.positionPref, 60), notes: str(c.notes, 500),
  }));

  const guardianFirst = str(body.guardianFirstName, 80);
  const guardianLast  = str(body.guardianLastName, 80);
  const guardianEmail = str(body.guardianEmail, 200);
  const guardianPhone = str(body.guardianPhone, 30);
  const waiverAccepted = body.waiverAccepted === true;
  const emailConsent = body.emailConsent === true;

  const divisions = await getDivisionsForSeason(season.id);
  if (divisions.length === 0) return NextResponse.json({ error: 'No divisions are available for this season' }, { status: 409 });
  const bands = divisions.some(d => d.bornFromYear != null || d.bornToYear != null);
  const cutoff = cutoffFor(org.birthdayCutoffs, season.sport);

  const errors: Record<string, string> = {};
  const chosen: (typeof divisions[number] | 'nofit')[] = [];
  kids.forEach((k, i) => {
    const at = `children.${i}`;
    if (!k.firstName) errors[`${at}.firstName`] = 'Enter a first name.';
    if (!k.lastName) errors[`${at}.lastName`] = 'Enter a last name.';
    if (k.dob && !isCalendarDate(k.dob)) errors[`${at}.dateOfBirth`] = 'Enter a real date of birth.';
    else if (bands && !k.dob) errors[`${at}.dateOfBirth`] = 'Enter a date of birth so we can find the right division.';
    if (errors[`${at}.dateOfBirth`]) { chosen.push('nofit'); return; }
    // The date of birth picks the division (9b·4, 9b·13); with no age bands the family picks.
    // An empty side is "no limit": a division with no years takes every child.
    const fits = bands ? divisions.filter(d => bornFitsDate({ from: d.bornFromYear, to: d.bornToYear }, cutoff, k.dob!)) : divisions;
    if (fits.length === 0) { chosen.push('nofit'); return; }
    const pick = fits.length === 1 && (!k.divisionId || k.divisionId === fits[0].id) ? fits[0] : fits.find(d => d.id === k.divisionId);
    if (!pick) { errors[`${at}.divisionId`] = `Choose a division for ${k.firstName ?? 'this child'}.`; chosen.push('nofit'); return; }
    chosen.push(pick);
  });
  if (!guardianFirst) errors.guardianFirstName = 'Enter your first name.';
  if (!guardianLast) errors.guardianLastName = 'Enter your last name.';
  if (!guardianEmail) errors.guardianEmail = 'Enter your email address.';
  else if (!isValidEmail(guardianEmail)) errors.guardianEmail = 'Enter a valid email address.';
  if (season.waiverText && !waiverAccepted) errors.waiverAccepted = 'Agree to the waiver to sign up.';
  if (Object.keys(errors).length > 0) return NextResponse.json({ errors }, { status: 400 });
  if (chosen.every(c => c === 'nofit')) {
    const year = kids.find(k => k.dob)?.dob?.slice(0, 4);
    return NextResponse.json({ error: `No division takes children born in ${year}. Contact ${org.name} to ask what is available.`, code: 'nofit' }, { status: 409 });
  }

  // Last gate before the writes and the mail, so a family retrying after a late refusal has not spent its budget.
  const recipientThrottled = throttlePublicFormRecipient(guardianEmail!);
  if (recipientThrottled) return recipientThrottled;

  // 4. Each child through the one locked step, in the form's order; its own outcome.
  const reference = newReference();
  const today = tournamentToday();
  const waiverAcceptedAt = season.waiverText && waiverAccepted ? new Date().toISOString() : null;
  type Result = PlacedChild & { outcome: 'active' | 'pending_review' | 'waitlisted' | 'duplicate' | 'nofit'; id: string | null };
  const results: Result[] = [];
  let position = 0;
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i], d = chosen[i];
    const base = { firstName: k.firstName!, lastName: k.lastName!, waitlistPosition: null, id: null };
    if (d === 'nofit') { results.push({ ...base, divisionName: '', status: 'pending_review', fee: null, outcome: 'nofit' }); continue; }
    const fee = leaguePrice(d, season, today)?.amount ?? null;
    // One child failing to place never loses the others: it is reported, and the ones placed still get their email.
    let placed: Awaited<ReturnType<typeof placeLeagueRegistration>>;
    try {
      placed = await placeLeagueRegistration({
      orgId: org.id, seasonId: season.id, divisionId: d.id, want: 'auto', feeAmount: fee,
      signupRef: reference, signupPosition: ++position,
      child: {
        firstName: k.firstName!, lastName: k.lastName!, dateOfBirth: k.dob, jerseyPref: k.jersey, positionPref: k.position, notes: k.notes,
        guardianFirstName: guardianFirst!, guardianLastName: guardianLast!, guardianEmail: guardianEmail!, guardianPhone,
        source: 'public_form', waiverAcceptedAt,
      },
      // With waiverAcceptedAt this files the consent-ledger row (mig 252) beside the placement.
      waiverText: season.waiverText ?? null,
    });
    } catch (e) {
      console.error('[league-register] placing a child failed:', e);
      results.push({ ...base, divisionName: d.name, status: 'pending_review', fee, outcome: 'nofit' });
      continue;
    }
    if ('refusal' in placed) {
      results.push({ ...base, divisionName: d.name, status: 'pending_review', fee, outcome: placed.refusal === 'duplicate' ? 'duplicate' : 'nofit' });
      continue;
    }
    results.push({
      ...base, id: placed.placed.id, divisionName: d.name, status: placed.placed.status as Result['status'],
      waitlistPosition: placed.placed.waitlistPosition, fee, outcome: placed.placed.status as Result['outcome'],
    });
  }
  const placedKids = results.filter(r => r.id);
  if (placedKids.length === 0) {
    const dup = results.find(r => r.outcome === 'duplicate');
    return NextResponse.json({
      error: dup ? `${dup.firstName} ${dup.lastName} is already signed up for this season. Use your reference to check their status.` : 'Nothing was signed up.',
      code: dup ? 'duplicate' : 'nothing',
    }, { status: 409 });
  }

  // 6. The email-consent line (CASL): one row for the sign-up, filed against its first registration.
  if (emailConsent && season.askEmailConsent) {
    await recordLeagueMarketingConsent({
      orgId: org.id, guardianEmailNormalized: normalizeGuardianEmailRequired(guardianEmail!),
      registrationId: placedKids[0].id!, consentText: consentLine(org.name), acceptedAt: new Date().toISOString(),
    });
  }

  // 5. One email per sign-up, and one notice for the club.
  const anyAccepted = placedKids.some(r => r.status === 'active');
  const children: PlacedChild[] = placedKids.map(r => ({
    firstName: r.firstName, lastName: r.lastName, divisionName: r.divisionName, status: r.status, waitlistPosition: r.waitlistPosition, fee: r.fee,
  }));
  try {
    const face = await systemMailFace(org);
    await sendTransactionalEmail({
      key: 'league_signup',
      to: guardianEmail!,
      vars: { guardianFirstName: guardianFirst!, seasonName: season.name, reference },
      defaultSubject: signupSubject(children, season.name),
      defaultHtml: leagueSignupHtml({
        guardianFirstName: guardianFirst!, seasonName: season.name, clubName: org.name, reference,
        howToPay: anyAccepted ? season.howToPay : null, statusPath: `/${org.slug}/league/${season.slug}/status`, children, face,
      }),
      family: face ? {
        face,
        reason: children.length === 1 ? `${children[0].firstName} was signed up for ${season.name}` : `your children were signed up for ${season.name}`,
      } : undefined,
    });
  } catch (e) {
    console.error('[league-register] email send failed:', e);
  }
  try {
    const n = signupNotice(children, `${guardianFirst} ${guardianLast}`, season.name);
    await notify({
      orgId: org.id,
      eventType: 'house_league_registration_new',
      title: n.title,
      body: n.body,
      link: `/${org.slug}/admin/house-league/seasons/${season.id}/registrations`,
    });
  } catch (e) {
    console.error('[league-register] staff notice failed:', e);
  }

  return NextResponse.json({
    reference,
    guardianEmail: guardianEmail!,
    howToPay: anyAccepted ? season.howToPay : null,
    children: results.map(r => ({
      firstName: r.firstName, lastName: r.lastName, outcome: r.outcome, divisionName: r.divisionName,
      waitlistPosition: r.waitlistPosition, fee: r.fee,
    })),
    // The old single-child reply, kept for any caller that reads it.
    id: placedKids[0].id, status: placedKids[0].status, waitlistPosition: placedKids[0].waitlistPosition,
  }, { status: 201 });
}, { route: '/api/league/[orgSlug]/[seasonSlug]/register' });
