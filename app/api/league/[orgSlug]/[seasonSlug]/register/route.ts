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
import { houseLeagueDeskUserIds } from '@/lib/notify-recipients';
import { signupNotice, signupSubject, type PlacedChild } from '@/lib/league-signup';
import { buildLeaguePayView, leagueMailLink } from '@/lib/league-pay-view';
import { getClubSiteContent } from '@/lib/club-page-meta';
import { leaguePayToken, leaguePayUrl } from '@/lib/league-pay-link';
import { SIGNUP_LINK_WORDS as SW } from '@/lib/league-pay-words';
import { readSecondParentEmail, secondParentRefusalWords, SECOND_PARENT_WORDS as SP } from '@/lib/league-second-parent';
import { stoppedSecondParentRefusal } from '@/lib/league-second-parent-stop';
import { went } from '@/lib/league-second-parent-mail';
import { hasSecondParentStop, withSecondParentStop } from '@/lib/league-second-parent-footer';
import { friendMaxFor, readFriends, type FriendIn } from '@/lib/league-friends';
import { readFriendCodes, saveFriendRequests } from '@/lib/league-friends-server';
import { showFriendCode } from '@/lib/league-friend-code';
import { cookies } from 'next/headers';
import { ensureSeasonForm, signupFormView } from '@/lib/club-form-server';
import { answersIn, checkAnswers, onceQuestions, perChildQuestions, signupConsentText, type AnswerIn, type AnswerOut, type SignupQuestion } from '@/lib/club-form-signup';
import { checkFileUses, formGoneError, handoversFrom } from '@/lib/club-form-family';
import { FAMILY_FORM_WORDS as FW_FORM } from '@/lib/club-form-family-words';
import { previewWriteRefusal } from '@/lib/preview-write-refusal';

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
 *   7. Board Ready Stage 1: each child's friends (up to the club's maximum, on a plan with friend requests), checked with
 *      the rest of the form and stored once the child is placed; a code resolves then. Every child gets a friend code
 *      (mig 461's trigger), shown on the confirmation and in the email while the club asks for friends. A friend that
 *      fails to store never fails the sign-up.
 *   8. Board Ready Stage 4 (Parts 1–2): the season's sign-up form. The page sends the STAMP of the form it was drawn with;
 *      a form the club changed since comes back (409 `form_changed`, with the form as it is now) and the page keeps what
 *      was typed. Each child's answers to the per-child questions and the sign-up's own are checked against their types and
 *      Required (a file question never is); a file must be one this form is still holding for that question, at most five
 *      a child. Every live document must be ticked, and a PDF only after OUR SERVER handed it over (its receipt). Then,
 *      INSIDE each child's locked placement (mig 515 `club_form_place_signup`): the child's answers, files and ticks; the
 *      sign-up's own answers ride the first child placed. Any failure rolls that child's placement back: the child is not
 *      signed up and the confirmation says so — an answer is never dropped the way a failed friend request is logged.
 *      `waiver_accepted_at` is set only when a document asked "I have read and agree" (/legal 2026-11-20).
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

type ChildIn = { firstName: string | null; lastName: string | null; dob: string | null; divisionId: string | null; jersey: string | null; position: string | null; notes: string | null; friends: FriendIn[]; answers: AnswerIn[] };


/** A family's reference: eight characters they can read back, to quote to the club (it opens nothing). */
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
  const previewClosed = previewWriteRefusal(org); if (previewClosed) return previewClosed;

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
  // 7. Friends: asked only on a plan with friend requests and a season above None.
  const friendMax = friendMaxFor(org.planId, season.friendRequestsMax);
  const friendErrors: Record<string, string> = {};
  const kids: ChildIn[] = rawChildren.map((c, i) => {
    const read = readFriends(c.friends, friendMax);
    for (const [k, v] of Object.entries(read.errors)) friendErrors[`children.${i}.${k}`] = v;
    return {
      firstName: str(c.firstName, 80), lastName: str(c.lastName, 80), dob: str(c.dateOfBirth), divisionId: str(c.divisionId),
      jersey: str(c.jerseyPref, 3), position: str(c.positionPref, 60), notes: str(c.notes, 500), friends: read.friends,
      answers: answersIn(c.answers),
    };
  });

  const guardianFirst = str(body.guardianFirstName, 80);
  const guardianLast  = str(body.guardianLastName, 80);
  const guardianEmail = str(body.guardianEmail, 200);
  const guardianPhone = str(body.guardianPhone, 30);
  // Signed-in family accounts Stage 3: the second parent's email, one for the whole sign-up. Empty changes nothing.
  const second = readSecondParentEmail(str(body.guardianEmail2, 200), guardianEmail);
  const guardianEmail2 = 'email' in second ? second.email : null;
  // 8. The documents ticked: [{ id, versionId }]. (`waiverAccepted` from a page drawn before Stage 4 reads as no ticks.)
  const sentTicks = new Map<string, string>();
  if (Array.isArray(body.documents)) {
    for (const t of body.documents as unknown[]) {
      const r = (t ?? {}) as Record<string, unknown>;
      if (typeof r.id === 'string' && typeof r.versionId === 'string') sentTicks.set(r.id, r.versionId);
    }
  }
  const emailConsent = body.emailConsent === true;

  const [{ formId, view }, divisions] = await Promise.all([
    ensureSeasonForm(season.id).then(async id => ({ formId: id, view: await signupFormView(id) })),
    getDivisionsForSeason(season.id),
  ]);
  const documents = view.documents;
  // 8. A form the club changed while the family filled it in comes back with the form as it is now; the page keeps what
  // was typed (drawing tab 5). Before any other check: an answer to the old form isn't worth correcting.
  if (body.formStamp !== view.stamp) {
    return NextResponse.json({ error: FW_FORM.changedOther(org.name), code: 'form_changed', form: view }, { status: 409 });
  }
  if (divisions.length === 0) return NextResponse.json({ error: 'No divisions are available for this season' }, { status: 409 });
  const bands = divisions.some(d => d.bornFromYear != null || d.bornToYear != null);
  const cutoff = cutoffFor(org.birthdayCutoffs, season.sport);

  const errors: Record<string, string> = { ...friendErrors };
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
  if ('refusal' in second) errors.guardianEmail2 = secondParentRefusalWords(second.refusal, 'parent');
  // Stage 3b (O4): an address that asked this club to stop is refused in words, never accepted silently.
  else if (guardianEmail2) { const stopped = await stoppedSecondParentRefusal(org.id, guardianEmail2); if (stopped) errors.guardianEmail2 = stopped; }
  // 8. The answers: each child who will be placed (a child with no division gets no questions, and answers are never kept
  // for one), then the sign-up's own. `missing` lists the errors that are an unanswered question (the page counts them).
  const missing: string[] = [];
  const childAnswers: AnswerOut[][] = kids.map((k, i) => {
    if (chosen[i] === 'nofit') return [];
    const r = checkAnswers(perChildQuestions(view), k.answers, k.firstName, qid => `children.${i}.q.${qid}`);
    Object.assign(errors, r.errors);
    missing.push(...r.missing);
    return r.answers;
  });
  const onceChecked = checkAnswers(onceQuestions(view), answersIn(body.once), null, qid => `once.q.${qid}`);
  Object.assign(errors, onceChecked.errors);
  missing.push(...onceChecked.missing);
  // A file must be one this form is still holding, for that question, used once; at most five a child (ruling 9).
  Object.assign(errors, await checkFileUses(formId, [
    ...childAnswers.flatMap((list, i) => list.map(answer => ({ answer, key: `children.${i}.q.${answer.questionId}`, who: kids[i].firstName, set: `children.${i}` }))),
    ...onceChecked.answers.map(answer => ({ answer, key: `once.q.${answer.questionId}`, who: null, set: 'once' })),
  ], new Map<string, SignupQuestion>(view.questions.map(q => [q.id, q]))));
  // Every live document ticked; a PDF only once OUR SERVER handed it over (the receipt the open route gave this browser).
  const jar = await cookies();
  const handedOver = handoversFrom(name => jar.get(name)?.value, documents);
  for (const d of documents) {
    if (sentTicks.get(d.id) !== d.versionId) { errors[`documents.${d.id}`] = FW_FORM.docMissing(d.name, d.tickKind, d.source === 'pdf'); missing.push(`documents.${d.id}`); }
    else if (d.source === 'pdf' && !handedOver.has(d.id)) errors[`documents.${d.id}`] = FW_FORM.docNotOpened(d.name);
  }
  if (Object.keys(errors).length > 0) return NextResponse.json({ errors, missing }, { status: 400 });
  if (chosen.every(c => c === 'nofit')) {
    const year = kids.find(k => k.dob)?.dob?.slice(0, 4);
    return NextResponse.json({ error: `No division takes children born in ${year}. Contact ${org.name} to ask what is available.`, code: 'nofit' }, { status: 409 });
  }

  // Last gate before the writes and the mail. (Each address spends one of its own hourly tokens as it is checked, so a
  // sign-up refused for the SECOND address has already spent one of the first's — a cost of the per-address cap.)
  const recipientThrottled = throttlePublicFormRecipient(guardianEmail!);
  if (recipientThrottled) return recipientThrottled;
  // The second address has its own hourly cap (drawing tab 5): a refused one refuses the whole sign-up, before any write.
  const secondThrottled = guardianEmail2 ? throttlePublicFormRecipient(guardianEmail2) : null;
  if (secondThrottled) return secondThrottled;

  // 4. Each child through the one locked step, in the form's order; its own outcome.
  const reference = newReference();
  const today = tournamentToday();
  // Every document was ticked (checked above); the time is the server's, once for the sign-up. `waiver_accepted_at` keeps its
  // meaning — the family AGREED to something — so it is set only when a document asked "I have read and agree" (/legal
  // 2026-11-20: a code of conduct ticked "I have read" is not a waiver accepted). Every tick is recorded either way.
  const tickedAt = documents.length > 0 ? new Date().toISOString() : null;
  const waiverAcceptedAt = documents.some(d => d.tickKind === 'read_agree') ? tickedAt : null;
  // The consent ledger's evidence (mig 252): the words of every document ticked, as the family read them.
  const consentText = signupConsentText(documents);
  // One tick per document for each child placed, inside the placement (mig 515). The sign-up's own answers ride every
  // child's call; the database saves them with the first child placed.
  const ticks = documents.map(d => ({ documentId: d.id, versionId: d.versionId, sentence: d.sentence, handedOverAt: handedOver.get(d.id)?.toISOString() ?? null }));
  type Result = PlacedChild & { outcome: 'active' | 'pending_review' | 'waitlisted' | 'duplicate' | 'nofit' | 'failed' | 'failed_file'; id: string | null };
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
        guardianFirstName: guardianFirst!, guardianLastName: guardianLast!, guardianEmail: guardianEmail!, guardianEmail2, guardianPhone,
        source: 'public_form', waiverAcceptedAt,
      },
      // With waiverAcceptedAt this files the consent-ledger row (mig 252) beside the placement.
      waiverText: consentText,
      // Only when there is something to save: a sign-up row holding nothing but an email is never made (/legal 2026-11-20).
      form: childAnswers[i].length || onceChecked.answers.length || ticks.length
        ? { formId, answers: childAnswers[i], once: onceChecked.answers, ticks, tickedAt }
        : undefined,
    });
    } catch (e) {
      // Never the error object: a constraint error echoes the failing row, which holds a typed child's name (/legal).
      const gone = formGoneError(e);
      console.error('[league-register] placing a child failed:', gone ?? (e as { code?: string })?.code ?? 'no code');
      results.push({ ...base, divisionName: d.name, status: 'pending_review', fee, outcome: gone === 'file' ? 'failed_file' : 'failed' });
      continue;
    }
    if ('refusal' in placed) {
      results.push({ ...base, divisionName: d.name, status: 'pending_review', fee, outcome: placed.refusal === 'duplicate' ? 'duplicate' : 'nofit' });
      continue;
    }
    if (k.friends.length) {
      try {
        await saveFriendRequests({ orgId: org.id, seasonId: season.id, registrationId: placed.placed.id, friends: k.friends });
      } catch (e) {
        // Never the error object: a constraint error echoes the failing row, which holds a typed child's name (/legal).
        const err = e as { code?: string; message?: string };
        console.error('[league-register] saving friend requests failed:', err?.code ?? 'no code', String(err?.message ?? '').slice(0, 80));
      }
    }
    results.push({
      ...base, id: placed.placed.id, divisionName: d.name, status: placed.placed.status as Result['status'],
      waitlistPosition: placed.placed.waitlistPosition, fee, outcome: placed.placed.status as Result['outcome'],
    });
  }
  const placedKids = results.filter(r => r.id);
  if (placedKids.length === 0) {
    const dup = results.find(r => r.outcome === 'duplicate');
    const failed = results.some(r => r.outcome === 'failed' || r.outcome === 'failed_file');
    return NextResponse.json({
      error: dup ? `${dup.firstName} ${dup.lastName} is already signed up for this season. To see their sign-up, use "${SW.door}" on the season page.`
        : failed ? 'Nothing was signed up: your answers didn’t save. Please try again.' : 'Nothing was signed up.',
      code: dup ? 'duplicate' : failed ? 'failed' : 'nothing',
    }, { status: dup ? 409 : failed ? 500 : 409 });
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
  // The email's one "Your sign-up" button, ALWAYS on the confirmation (Stage 1 ask 3), for the whole sign-up through its
  // first child's link; 12b's card words while the club takes card payments, and the pay block on the confirmation (k2)
  // once a child is accepted (nothing is payable before). A sign-up made a moment ago is at link version 0 (the column's
  // default; only the club's reset moves it), so the button is signed without reading the pay facts.
  const signupUrl = leaguePayUrl(process.env.NEXT_PUBLIC_APP_URL ?? '', { orgSlug: org.slug, seasonSlug: season.slug, registrationId: placedKids[0].id!, version: 0 });
  const contactEmail = anyAccepted ? (await getClubSiteContent(org.id).catch(() => null))?.contactEmail ?? null : null;
  const [online, pay] = anyAccepted
    ? await Promise.all([leagueMailLink(placedKids[0].id!).then(l => l.online), buildLeaguePayView(placedKids[0].id!, contactEmail)])
    : [null, null];
  // Each child's friend code, shown only while the club asks for friends (a read that fails shows none).
  const codes = friendMax > 0 ? await readFriendCodes(placedKids.map(r => r.id!)).catch(() => new Map<string, string | null>()) : new Map<string, string | null>();
  const codeOf = (id: string | null) => { const c = id ? codes.get(id) : null; return c ? showFriendCode(c) : null; };
  const children: PlacedChild[] = placedKids.map(r => ({
    firstName: r.firstName, lastName: r.lastName, divisionName: r.divisionName, status: r.status, waitlistPosition: r.waitlistPosition, fee: r.fee,
    friendCode: codeOf(r.id),
  }));
  // The club's face never throws (a face that cannot be read is a plainer email), so both parents' copies share it.
  const face = await systemMailFace(org);
  // Stage 3 ask 2: the second parent gets the same confirmation and the same "Your sign-up" link (both open one page),
  // greeted "Hi," with the "who added you" line on top — its own message, never a Cc. ALWAYS the built-in email: a
  // customised template has no place for that line and would greet the first parent by name. Each copy in its own try:
  // one failing never fails the sign-up or the other parent's copy.
  const copies = [
    { to: guardianEmail!, secondParentLine: null },
    ...(guardianEmail2 ? [{
      to: guardianEmail2,
      secondParentLine: SP.addedYou(`${guardianFirst} ${guardianLast}`, children.map(c => c.firstName), { name: org.name, contact: face?.contact ?? null, stop: hasSecondParentStop(org.id, guardianEmail2) }),
    }] : []),
  ];
  // The second parent's copy carries the Stop button (Stage 3b, Part 4); the first parent's gets nothing new (O5).
  const withSecondParentCopy = (html: string, copy: { to: string; secondParentLine: string | null }) =>
    copy.secondParentLine ? withSecondParentStop(html, org.id, copy.to) : html;
  let firstWent = true;
  for (const copy of copies) {
    // The second parent's copy follows only a first copy that went (the rule every other sender holds).
    if (copy.secondParentLine && !firstWent) break;
    try {
      const result = await sendTransactionalEmail({
        key: 'league_signup',
        orgId: org.id,
        to: copy.to,
        vars: { guardianFirstName: guardianFirst!, seasonName: season.name, reference },
        defaultSubject: signupSubject(children, season.name),
        defaultHtml: withSecondParentCopy(leagueSignupHtml({
          guardianFirstName: guardianFirst!, seasonName: season.name, clubName: org.name, reference,
          howToPay: anyAccepted ? season.howToPay : null, signupUrl, children, face,
          online, secondParentLine: copy.secondParentLine,
        }), copy),
        family: face ? {
          face,
          reason: children.length === 1 ? `${children[0].firstName} was signed up for ${season.name}` : `your children were signed up for ${season.name}`,
        } : undefined,
        builtInOnly: copy.secondParentLine != null,
      });
      if (!copy.secondParentLine) firstWent = went(result);
    } catch (e) {
      if (!copy.secondParentLine) firstWent = false;
      console.error(`[league-register] ${copy.secondParentLine ? 'second parent ' : ''}email send failed:`, e);
    }
  }
  // The house-league desk only (owner Q2, 2026-11-15; /legal: children's and the guardian's names are need-to-know), the
  // same people the withdrawal request reaches.
  try {
    const n = signupNotice(children, `${guardianFirst} ${guardianLast}`, season.name);
    const userIds = await houseLeagueDeskUserIds(org);
    if (userIds.length) await notify({
      orgId: org.id,
      eventType: 'house_league_registration_new',
      title: n.title,
      body: n.body,
      link: `/${org.slug}/admin/house-league/seasons/${season.id}/registrations`,
      metadata: { facts: n.facts },
      userIds,
    });
  } catch (e) {
    console.error('[league-register] staff notice failed:', e);
  }

  return NextResponse.json({
    reference,
    guardianEmail: guardianEmail!,
    // Stage 3: the finish screen names both addresses ("We've emailed this to {a} and {b}."); null reads as before.
    guardianEmail2,
    howToPay: anyAccepted ? season.howToPay : null,
    // 12b: the pay block for the confirmation, while the club takes card payments; null keeps today's words (A6).
    pay: pay?.kind === 'owing' ? pay : null,
    // Signed-in family accounts Stage 1: the success screen's "Your sign-up →" opens the family's own page, signed.
    // A sign-up made a moment ago is at link version 0 (the column's default; only the club's reset moves it).
    signupToken: leaguePayToken(placedKids[0].id!, 0),
    children: results.map(r => ({
      firstName: r.firstName, lastName: r.lastName, outcome: r.outcome, status: r.status, divisionName: r.divisionName,
      waitlistPosition: r.waitlistPosition, fee: r.fee, friendCode: codeOf(r.id),
    })),
    // The old single-child reply, kept for any caller that reads it.
    id: placedKids[0].id, status: placedKids[0].status, waitlistPosition: placedKids[0].waitlistPosition,
  }, { status: 201 });
}, { route: '/api/league/[orgSlug]/[seasonSlug]/register' });
