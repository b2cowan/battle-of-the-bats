import { NextResponse } from 'next/server';
import { forbidden, getAuthContextWithScope, scopeGuard, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hasPlanFeature } from '@/lib/plan-features';

const BUCKET    = 'org-assets';
const MAX_BYTES = 4 * 1024 * 1024;
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

export async function POST(req: Request) {
  const ctx = await getAuthContextWithScope();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();

  const tournamentId = new URL(req.url).searchParams.get('tournamentId');
  if (!tournamentId) return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  if (!hasPlanFeature(ctx.org.planId, 'advanced_tournament_branding')) {
    return NextResponse.json(
      { error: 'Hero banners require Tournament Plus or higher' },
      { status: 403 }
    );
  }

  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!ALLOWED_MIME.includes(file.type)) return NextResponse.json({ error: 'Only JPEG, PNG, and WebP images are allowed' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File must be 4 MB or smaller' }, { status: 400 });

  await ensureBucket();

  const ext  = EXT_MAP[file.type];
  const path = `${ctx.org.id}/${tournamentId}/hero-banner.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  const heroBannerUrl = urlData.publicUrl;

  const { error: dbError } = await supabaseAdmin
    .from('tournaments')
    .update({ hero_banner_url: heroBannerUrl })
    .eq('id', tournamentId)
    .eq('organization_id', ctx.org.id);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ heroBannerUrl });
}

export async function DELETE(req: Request) {
  const ctx = await getAuthContextWithScope();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();

  const tournamentId = new URL(req.url).searchParams.get('tournamentId');
  if (!tournamentId) return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  if (!hasPlanFeature(ctx.org.planId, 'advanced_tournament_branding')) {
    return NextResponse.json(
      { error: 'Hero banners require Tournament Plus or higher' },
      { status: 403 }
    );
  }

  for (const ext of ['jpg', 'png', 'webp']) {
    await supabaseAdmin.storage.from(BUCKET).remove([`${ctx.org.id}/${tournamentId}/hero-banner.${ext}`]);
  }

  const { error } = await supabaseAdmin
    .from('tournaments')
    .update({ hero_banner_url: null })
    .eq('id', tournamentId)
    .eq('organization_id', ctx.org.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
