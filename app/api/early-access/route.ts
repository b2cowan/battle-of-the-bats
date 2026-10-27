import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability, captureAndJson, captureError } from '@/lib/observability';
import { isSendableGuardianEmail, normalizeGuardianEmailRequired } from '@/lib/guardian-email';
import { throttleLeadForm } from '@/lib/public-form-throttle';
import { cleanHeardFrom, cleanLinkTag } from '@/lib/lead-form-answers';
import { decideRefill, isWorkedLead, type KnownLead } from '@/lib/early-access-refill';

const PLAN_OPTIONS = new Set(['league', 'club']);
const FEATURE_OPTIONS = new Set([
  'house_league',
  'registration',
  'public_site',
  'accounting',
  'rep_teams',
  'coach_portal',
  'communications',
]);

/** What the visitor reads when anything fails inside: never the database's own words (Stage 7 Part 8, threat 10). */
const COULD_NOT_SAVE = 'We couldn’t save your request just now. Please try again in a few minutes.';

/** Cut to length, with NUL and lone surrogates removed: the database refuses them, and a refusal that only some paths hit would tell a visitor which address is already a lead. */
function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.replace(/\u0000/g, '').toWellFormed().trim().slice(0, maxLength) : '';
}

function cleanList(value: unknown, allowed: Set<string>, maxItems = 8) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && allowed.has(item))
    .slice(0, maxItems);
}

const KNOWN_COLUMNS = 'id, submission_count, internal_status, source, source_words, linked_at, converted_org_id, '
  + 'last_contacted_at, next_action, follow_up_due_at, release_notifications_consent';

type Known = KnownLead & { id: string; submission_count: number | null };

export const POST = withObservability(async (req: Request) => {
  // The lead form's own throttle (per source address, with a ceiling across everyone), apart from the family forms'
  // buckets so a flood here can never lock a registration night. Before anything is read.
  const throttled = throttleLeadForm(req);
  if (throttled) return throttled;

  const body = (await req.json().catch(() => null)) ?? {};

  // Honeypot for low-effort bots. Real users never see/fill this field.
  if (cleanText(body.website, 200)) {
    return NextResponse.json({ ok: true });
  }

  const name = cleanText(body.name, 120);
  const email = normalizeGuardianEmailRequired(cleanText(body.email, 180));
  const organizationName = cleanText(body.organizationName, 160);
  const role = cleanText(body.role, 120);
  const sports = cleanText(body.sports, 160);
  const notes = cleanText(body.notes, 1200);
  const sourcePath = cleanText(body.sourcePath, 240);
  const planInterest = cleanList(body.planInterest, PLAN_OPTIONS, 2);
  const featuresInterested = cleanList(body.featuresInterested, FEATURE_OPTIONS);
  // The box as the visitor left it. A form with no such box (the coach form) sends none: a new lead keeps today's
  // default (yes), and a refill reads "no statement", never a yes.
  const consentSent = typeof body.releaseNotificationsConsent === 'boolean' ? body.releaseNotificationsConsent : undefined;
  const heardFrom = cleanHeardFrom(body.heardFrom);
  const refTag = cleanLinkTag(body.refTag);

  if (!name) {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  }

  if (!isSendableGuardianEmail(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  if (!organizationName) {
    return NextResponse.json({ error: 'Organization name is required.' }, { status: 400 });
  }

  if (planInterest.length === 0 && featuresInterested.length === 0) {
    return NextResponse.json({ error: 'Choose at least one plan or feature.' }, { status: 400 });
  }

  const now = new Date().toISOString();

  const readLead = () => supabaseAdmin
    .from('early_access_leads')
    .select(KNOWN_COLUMNS)
    .eq('email_normalized', email)
    .maybeSingle<Known>();

  const { data: first, error: existingError } = await readLead();
  if (existingError) return captureAndJson(existingError, { error: COULD_NOT_SAVE });
  let existing: Known | null = first;

  if (!existing) {
    const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? null;
    const { error } = await supabaseAdmin.from('early_access_leads').insert({
      created_at: now,
      updated_at: now,
      last_submitted_at: now,
      submission_count: 1,
      status: 'new',
      name,
      email,
      email_normalized: email,
      organization_name: organizationName,
      role: role || null,
      sports: sports || null,
      plan_interest: planInterest,
      features_interested: featuresInterested,
      notes: notes || null,
      source_path: sourcePath || null,
      heard_from: heardFrom,
      ref_tag: refTag,
      user_agent: userAgent,
      release_notifications_consent: consentSent !== false,
    });
    if (!error) return NextResponse.json({ ok: true });
    // Two forms for one new address at the same moment (a double click, two tabs): the loser is a known address, so it
    // takes the refill path below and the visitor sees exactly what the winner saw.
    if (error.code !== '23505') return captureAndJson(error, { error: COULD_NOT_SAVE });
    const { data: winner, error: rereadError } = await readLead();
    if (rereadError || !winner) return captureAndJson(rereadError ?? error, { error: COULD_NOT_SAVE });
    existing = winner;
  }

  // A known address. The visitor sees exactly what a new address sees; only the lead differs (early-access-refill.ts).
  const { count: noteCount, error: notesError } = await supabaseAdmin
    .from('early_access_lead_notes')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', existing.id);
  if (notesError) return captureAndJson(notesError, { error: COULD_NOT_SAVE });

  const outcome = decideRefill(existing, isWorkedLead(existing, (noteCount ?? 0) > 0), {
    name,
    organization_name: organizationName,
    role: role || null,
    sports: sports || null,
    plan_interest: planInterest,
    features_interested: featuresInterested,
    notes: notes || null,
    heard_from: heardFrom,
    consent: consentSent,
  });

  const { error: updateError } = await supabaseAdmin
    .from('early_access_leads')
    .update({
      ...outcome.patch,
      updated_at: now,
      last_submitted_at: now,
      submission_count: (existing.submission_count ?? 1) + 1,
    })
    .eq('id', existing.id);
  if (updateError) return captureAndJson(updateError, { error: COULD_NOT_SAVE });

  // The dated entry comes after the lead is updated, so a failure here never leaves a stray entry behind, and it is
  // reported to the error log rather than to the visitor: a known address must answer exactly as an unknown one does,
  // even in the failure mode (an environment that does not have the table yet).
  const { error: entryError } = await supabaseAdmin.from('early_access_lead_submissions').insert({
    lead_id: existing.id,
    submitted_at: now,
    kind: 'form',
    source_path: sourcePath || null,
    ...outcome.entry,
  });
  if (entryError) await captureError(entryError);

  return NextResponse.json({ ok: true });
}, { route: '/api/early-access' });
