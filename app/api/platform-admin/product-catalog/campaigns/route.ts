import { NextResponse } from 'next/server';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { requirePlatformPermission } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

const VALID_TYPES = new Set(['coupon', 'promo', 'trial', 'launch', 'retention']);
const VALID_STATUSES = new Set(['draft', 'scheduled', 'active', 'paused', 'ended']);
const VALID_PLANS = new Set(['tournament', 'team', 'tournament_plus', 'league', 'club']);

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function cleanOptionalDateTime(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function campaignKey(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return `${slug || 'campaign'}-${Date.now().toString(36)}`;
}

function cleanPlanIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && VALID_PLANS.has(item))
    .filter((item, index, arr) => arr.indexOf(item) === index);
}

export const POST = withObservability(async (req: Request) => {
  const auth = await requirePlatformPermission('manage_product');
  if (auth.response) return auth.response;

  const body = await req.json() as Record<string, unknown>;
  const title = cleanText(body.title, 160);
  const campaignType = cleanText(body.campaign_type, 40) ?? '';
  const status = cleanText(body.status, 40) ?? 'draft';

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }
  if (!VALID_TYPES.has(campaignType)) {
    return NextResponse.json({ error: 'Invalid campaign type' }, { status: 400 });
  }
  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid campaign status' }, { status: 400 });
  }

  const rawTrialDays = typeof body.trial_days === 'number'
    ? body.trial_days
    : typeof body.trial_days === 'string' && body.trial_days.trim()
      ? Number(body.trial_days)
      : null;
  const trialDays = rawTrialDays == null
    ? null
    : Number.isInteger(rawTrialDays) && rawTrialDays >= 0
      ? rawTrialDays
      : NaN;

  if (Number.isNaN(trialDays)) {
    return NextResponse.json({ error: 'Trial days must be a non-negative integer' }, { status: 400 });
  }

  const insert = {
    campaign_key: campaignKey(title),
    title,
    campaign_type: campaignType,
    status,
    target_plan_ids: cleanPlanIds(body.target_plan_ids),
    starts_at: cleanOptionalDateTime(body.starts_at),
    ends_at: cleanOptionalDateTime(body.ends_at),
    coupon_code: cleanText(body.coupon_code, 80),
    discount_summary: cleanText(body.discount_summary, 500),
    trial_days: trialDays,
    notes: cleanText(body.notes, 1200),
    created_by_email: auth.user.email!,
    updated_by_email: auth.user.email!,
  };

  const { data, error } = await supabaseAdmin
    .from('platform_catalog_campaigns')
    .insert(insert)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writePlatformAuditLog(
    auth.user.email!,
    null,
    'create_catalog_campaign',
    data.id,
    null,
    data,
  );

  return NextResponse.json({ ok: true, campaign: data });
}, { route: '/api/platform-admin/product-catalog/campaigns' });

export const PATCH = withObservability(async (req: Request) => {
  const auth = await requirePlatformPermission('manage_product');
  if (auth.response) return auth.response;

  const body = await req.json() as Record<string, unknown>;
  const id = cleanText(body.id, 80);
  const status = cleanText(body.status, 40);

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }
  if (!status || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid campaign status' }, { status: 400 });
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from('platform_catalog_campaigns')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json({ error: currentError.message }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from('platform_catalog_campaigns')
    .update({
      status,
      updated_at: new Date().toISOString(),
      updated_by_email: auth.user.email!,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writePlatformAuditLog(
    auth.user.email!,
    null,
    'update_catalog_campaign_status',
    id,
    { status: current.status },
    { status: data.status },
  );

  return NextResponse.json({ ok: true, campaign: data });
}, { route: '/api/platform-admin/product-catalog/campaigns' });
