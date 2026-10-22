import { NextResponse } from 'next/server';
import { clubLookEditor } from '@/lib/public-site-access';
import { ORG_BANNER_MAX_BYTES, ORG_IMAGE_TYPES } from '@/lib/org-image-limits';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

const BUCKET    = 'org-assets';
const MAX_BYTES = ORG_BANNER_MAX_BYTES;
const ALLOWED_MIME: readonly string[] = ORG_IMAGE_TYPES;
const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
};

async function ensureBucket() {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const existing = buckets?.find(b => b.name === BUCKET);
  if (existing) {
    if (!existing.public) {
      await supabaseAdmin.storage.updateBucket(BUCKET, { public: true });
    }
    return;
  }
  await supabaseAdmin.storage.createBucket(BUCKET, { public: true });
}

export const POST = withObservability(async (req: Request) => {
  // The owner or an admin changes the club's look (Public site builder, Option A, 2026-10-21; lib/public-site-access.ts).
  const r = await clubLookEditor(req);
  if (r.error) return r.error;
  const { org } = r.ctx;

  // Plan gate: Tournament Plus and higher only
  if (org.planId === 'tournament') {
    return NextResponse.json(
      { error: 'Hero banner requires Tournament Plus or higher' },
      { status: 403 }
    );
  }

  const formData = await req.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json(
      { error: 'Only JPEG, PNG, and WebP images are allowed' },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File must be 4 MB or smaller' }, { status: 400 });
  }

  await ensureBucket();

  const ext  = EXT_MAP[file.type];
  const path = `${org.id}/hero-banner.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  const heroBannerUrl = urlData.publicUrl;

  const { error: dbError } = await supabaseAdmin
    .from('organizations')
    .update({ hero_banner_url: heroBannerUrl })
    .eq('id', org.id);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ heroBannerUrl });
}, { route: '/api/admin/org-hero-banner' });

export const DELETE = withObservability(async (req: Request) => {
  // The owner or an admin changes the club's look (Public site builder, Option A, 2026-10-21; lib/public-site-access.ts).
  const r = await clubLookEditor(req);
  if (r.error) return r.error;
  const { org } = r.ctx;

  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ hero_banner_url: null })
    .eq('id', org.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}, { route: '/api/admin/org-hero-banner' });
