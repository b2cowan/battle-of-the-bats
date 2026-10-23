import { NextResponse } from 'next/server';
import { publicSiteEditor } from '@/lib/public-site-access';
import { ORG_LOGO_MAX_BYTES } from '@/lib/org-image-limits';
import { ensureOrgLogoBucket, ORG_LOGO_BUCKET } from '@/lib/org-logo-storage';
import { newSponsorLogoFileName, parseSponsorLogoUrl, sponsorLogoObjectPath } from '@/lib/sponsor-logo';
import { prepareSponsorLogo } from '@/lib/sponsor-logo-image';
import { PUBLIC_SITE_WORDS as W } from '@/lib/public-site-words';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

/**
 * A club sponsor's logo (Club Tier Stage 4d). Owner or admin only — the Public site editor's rule, NOT the Look rule the
 * club's own logo uses. The file is OPENED and re-saved as a small PNG (lib/sponsor-logo-image.ts), never stored as sent,
 * under a random name inside this club's `sponsors` folder, so the address the editor gets back is the only kind a page
 * will ever show (lib/sponsor-logo.ts). The sponsor row is saved separately, by the ordinary public-site save.
 */
export const POST = withObservability(async (req: Request) => {
  const r = await publicSiteEditor(req, { write: true });
  if (r.error) return r.error;
  const { org } = r.ctx;

  // Refused before the body is read at all when it is plainly too large (the file's own size is checked again below).
  if (Number(req.headers.get('content-length')) > ORG_LOGO_MAX_BYTES + 64 * 1024) return NextResponse.json({ error: W.logoTooBig }, { status: 400 });
  const formData = await req.formData().catch(() => null);
  const file = formData?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: W.logoUnreadable }, { status: 400 });
  // Refused before it is read into memory.
  if (file.size > ORG_LOGO_MAX_BYTES) return NextResponse.json({ error: W.logoTooBig }, { status: 400 });

  const made = await prepareSponsorLogo(Buffer.from(await file.arrayBuffer()), file.type);
  if (!made.ok) return NextResponse.json({ error: made.error }, { status: 400 });

  await ensureOrgLogoBucket();
  const path = sponsorLogoObjectPath(org.id, newSponsorLogoFileName());
  const { error: uploadError } = await supabaseAdmin.storage.from(ORG_LOGO_BUCKET).upload(path, made.png, {
    contentType: 'image/png',
    upsert: false,
  });
  if (uploadError) {
    console.error('sponsor-logo upload failed', uploadError);
    return NextResponse.json({ error: W.logoUploadFailed }, { status: 500 });
  }
  const { data } = supabaseAdmin.storage.from(ORG_LOGO_BUCKET).getPublicUrl(path);
  return NextResponse.json({ logoUrl: data.publicUrl });
}, { route: '/api/admin/public-site/sponsor-logo' });

/**
 * Throw a logo file away: a cancelled new sponsor's upload, or the file a saved edit stopped pointing at. The address must
 * be one of THIS club's own sponsor logos (it drives a service-role delete), and a file a saved sponsor still points at is
 * never deleted — the caller deletes only AFTER the list that dropped it has been saved.
 */
export const DELETE = withObservability(async (req: Request) => {
  const r = await publicSiteEditor(req, { write: true });
  if (r.error) return r.error;
  const { org } = r.ctx;

  const body = (await req.json().catch(() => null)) as { logoUrl?: unknown } | null;
  const logoUrl = typeof body?.logoUrl === 'string' ? body.logoUrl : '';
  const parsed = parseSponsorLogoUrl(logoUrl, org.id);
  if (!parsed) return NextResponse.json({ error: W.logoNotOurs }, { status: 400 });

  // The stored column itself, read with the server's own access (never a page's shared read, which cleans the list and
  // could miss a row): is any saved sponsor still pointing at this file?
  const { data, error } = await supabaseAdmin.from('org_public_site_content').select('sponsors').eq('org_id', org.id).maybeSingle();
  // A read that failed is not "nobody uses it": nothing is deleted on a guess.
  if (error) return NextResponse.json({ error: W.saveFailed }, { status: 500 });
  const stored = Array.isArray(data?.sponsors) ? (data.sponsors as { logoUrl?: unknown }[]) : [];
  // Compared by the file they name, not by the string typed: the same address can be written several ways (upper-case host,
  // a trailing "?", an explicit port) and a saved sponsor must still count as using it.
  const inUse = stored.some(s => typeof s?.logoUrl === 'string' && parseSponsorLogoUrl(s.logoUrl, org.id)?.objectPath === parsed.objectPath);
  if (inUse) return NextResponse.json({ error: W.saveFailed }, { status: 409 });
  // Best-effort housekeeping: a missing file is skipped, and an orphan is harmless.
  await supabaseAdmin.storage.from(ORG_LOGO_BUCKET).remove([parsed.objectPath]);
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/public-site/sponsor-logo' });
