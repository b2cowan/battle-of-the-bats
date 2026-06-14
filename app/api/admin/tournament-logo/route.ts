import { NextResponse } from 'next/server';
import { forbidden, getAuthContextWithScope, scopeGuard, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hasPlanFeature } from '@/lib/plan-features';
import { hasCapability } from '@/lib/roles';
import { withObservability } from '@/lib/observability';

const BUCKET   = 'org-logos';
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
};

async function ensureBucket() {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const existing = buckets?.find(b => b.name === BUCKET);
  if (existing) {
    if (!existing.public) await supabaseAdmin.storage.updateBucket(BUCKET, { public: true });
    return;
  }
  await supabaseAdmin.storage.createBucket(BUCKET, { public: true });
}

export const POST = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'manage_branding')) return forbidden();

  const tournamentId = url.searchParams.get('tournamentId');
  if (!tournamentId) return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  if (!hasPlanFeature(ctx.org.planId, 'advanced_tournament_branding')) {
    return NextResponse.json(
      { error: 'Tournament logos require Tournament Plus or higher' },
      { status: 403 }
    );
  }

  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!ALLOWED_MIME.includes(file.type)) return NextResponse.json({ error: 'Only JPEG, PNG, and WebP images are allowed' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File must be 2 MB or smaller' }, { status: 400 });

  await ensureBucket();

  const ext  = EXT_MAP[file.type];
  const path = `${ctx.org.id}/${tournamentId}/logo.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  const logoUrl = urlData.publicUrl;

  const { error: dbError } = await supabaseAdmin
    .from('tournaments')
    .update({ logo_url: logoUrl })
    .eq('id', tournamentId)
    .eq('org_id', ctx.org.id);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ logoUrl });
}, { route: '/api/admin/tournament-logo' });

export const DELETE = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'manage_branding')) return forbidden();

  const tournamentId = url.searchParams.get('tournamentId');
  if (!tournamentId) return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  if (!hasPlanFeature(ctx.org.planId, 'advanced_tournament_branding')) {
    return NextResponse.json(
      { error: 'Tournament logos require Tournament Plus or higher' },
      { status: 403 }
    );
  }

  for (const ext of ['jpg', 'png', 'webp']) {
    await supabaseAdmin.storage.from(BUCKET).remove([`${ctx.org.id}/${tournamentId}/logo.${ext}`]);
  }

  const { error } = await supabaseAdmin
    .from('tournaments')
    .update({ logo_url: null })
    .eq('id', tournamentId)
    .eq('org_id', ctx.org.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}, { route: '/api/admin/tournament-logo' });
