import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanList(value: unknown, allowed: Set<string>, maxItems = 8) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && allowed.has(item))
    .slice(0, maxItems);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  // Honeypot for low-effort bots. Real users never see/fill this field.
  if (cleanText(body.website, 200)) {
    return NextResponse.json({ ok: true });
  }

  const name = cleanText(body.name, 120);
  const email = cleanText(body.email, 180).toLowerCase();
  const organizationName = cleanText(body.organizationName, 160);
  const role = cleanText(body.role, 120);
  const sports = cleanText(body.sports, 160);
  const notes = cleanText(body.notes, 1200);
  const sourcePath = cleanText(body.sourcePath, 240);
  const planInterest = cleanList(body.planInterest, PLAN_OPTIONS, 2);
  const featuresInterested = cleanList(body.featuresInterested, FEATURE_OPTIONS);
  const releaseNotificationsConsent = body.releaseNotificationsConsent !== false;

  if (!name) {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  if (!organizationName) {
    return NextResponse.json({ error: 'Organization name is required.' }, { status: 400 });
  }

  if (planInterest.length === 0 && featuresInterested.length === 0) {
    return NextResponse.json({ error: 'Choose at least one plan or feature.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? null;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('early_access_leads')
    .select('id, submission_count')
    .eq('email_normalized', email)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const row = {
    updated_at: now,
    last_submitted_at: now,
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
    user_agent: userAgent,
    release_notifications_consent: releaseNotificationsConsent,
  };

  const result = existing
    ? await supabaseAdmin
        .from('early_access_leads')
        .update({
          ...row,
          submission_count: (existing.submission_count ?? 1) + 1,
        })
        .eq('id', existing.id)
    : await supabaseAdmin
        .from('early_access_leads')
        .insert({
          ...row,
          created_at: now,
          submission_count: 1,
          status: 'new',
        });

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
