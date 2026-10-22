import { NextResponse } from 'next/server';
import { clubLookEditor } from '@/lib/public-site-access';
import { ORG_IMAGE_TYPES, ORG_LOGO_MAX_BYTES } from '@/lib/org-image-limits';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { ORG_LOGO_BUCKET as BUCKET, ensureOrgLogoBucket } from '@/lib/org-logo-storage';
import { parseStockLogoUrl, removeStockLogoFile } from '@/lib/stock-logo-render';

const MAX_BYTES = ORG_LOGO_MAX_BYTES;
const ALLOWED_MIME: readonly string[] = ORG_IMAGE_TYPES;
const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const POST = withObservability(async (req: Request) => {
  // The owner or an admin changes the club's look (Public site builder, Option A, 2026-10-21; lib/public-site-access.ts).
  const r = await clubLookEditor(req);
  if (r.error) return r.error;
  const { org } = r.ctx;

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
    return NextResponse.json({ error: 'File must be 2 MB or smaller' }, { status: 400 });
  }

  await ensureOrgLogoBucket();

  const ext = EXT_MAP[file.type];
  const path = `${org.id}/logo.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  // Version stamp: the storage path is stable across re-uploads, so without this the URL
  // never changes — browsers keep the old image cached, and the PDF pipeline's derived-logo
  // cache (keyed by this URL) would keep printing the OLD logo forever after a replacement.
  const logoUrl = `${urlData.publicUrl}?v=${Date.now()}`;

  const { error: dbError } = await supabaseAdmin
    .from('organizations')
    .update({ logo_url: logoUrl })
    .eq('id', org.id);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // An upload replaces a stock pick: the made one goes (lib/stock-logo-render.ts).
  await removeStockLogoFile(org.logoUrl, org.id);

  return NextResponse.json({ logoUrl });
}, { route: '/api/admin/org-logo' });

export const DELETE = withObservability(async (req: Request) => {
  // The owner or an admin changes the club's look (Public site builder, Option A, 2026-10-21; lib/public-site-access.ts).
  const r = await clubLookEditor(req);
  if (r.error) return r.error;
  const { org } = r.ctx;

  const { error: dbError } = await supabaseAdmin
    .from('organizations')
    .update({ logo_url: null })
    .eq('id', org.id);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Remove from storage only once the org no longer points at it (best-effort — a missing path is
  // skipped). One call: an upload under any extension, and a stock pick made in the club's colour.
  const stockPath = parseStockLogoUrl(org.logoUrl, org.id)?.objectPath;
  await supabaseAdmin.storage.from(BUCKET).remove([
    ...['jpg', 'png', 'webp'].map(ext => `${org.id}/logo.${ext}`),
    ...(stockPath ? [stockPath] : []),
  ]);

  return NextResponse.json({ ok: true });
}, { route: '/api/admin/org-logo' });
