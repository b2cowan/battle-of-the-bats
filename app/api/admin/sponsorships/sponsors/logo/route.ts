import { NextResponse } from 'next/server';
import { requireSponsorships } from '@/lib/club-sponsorships-auth';
import { ORG_LOGO_MAX_BYTES } from '@/lib/org-image-limits';
import { ensureOrgLogoBucket, ORG_LOGO_BUCKET } from '@/lib/org-logo-storage';
import { newSponsorLogoFileName, parseSponsorLogoUrl, sponsorLogoObjectPath } from '@/lib/sponsor-logo';
import { prepareSponsorLogo } from '@/lib/sponsor-logo-image';
import { PUBLIC_SITE_WORDS as W } from '@/lib/public-site-words';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

/**
 * A sponsor's logo (Board Ready Stage 6, Part 1 — moved here from the site editor's route with the list, ask 12). Anyone
 * who opens Sponsorships. The file is OPENED and re-saved as a small PNG (lib/sponsor-logo-image.ts), never stored as
 * sent, under a random name inside this club's `sponsors` folder (the Stage 4d pipeline, unchanged), so the address the
 * window gets back is the only kind a page will ever show. The sponsor is saved separately, by its own route.
 */
export const POST = withObservability(async (req: Request) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const { org } = gate.ctx;
  if (Number(req.headers.get('content-length')) > ORG_LOGO_MAX_BYTES + 64 * 1024) return NextResponse.json({ error: W.logoTooBig }, { status: 400 });
  const formData = await req.formData().catch(() => null);
  const file = formData?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: W.logoUnreadable }, { status: 400 });
  if (file.size > ORG_LOGO_MAX_BYTES) return NextResponse.json({ error: W.logoTooBig }, { status: 400 });
  const made = await prepareSponsorLogo(Buffer.from(await file.arrayBuffer()), file.type);
  if (!made.ok) return NextResponse.json({ error: made.error }, { status: 400 });
  await ensureOrgLogoBucket();
  const path = sponsorLogoObjectPath(org.id, newSponsorLogoFileName());
  const { error } = await supabaseAdmin.storage.from(ORG_LOGO_BUCKET).upload(path, made.png, { contentType: 'image/png', upsert: false });
  if (error) {
    console.error('sponsorship logo upload failed', error);
    return NextResponse.json({ error: W.logoUploadFailed }, { status: 500 });
  }
  const { data } = supabaseAdmin.storage.from(ORG_LOGO_BUCKET).getPublicUrl(path);
  return NextResponse.json({ logoUrl: data.publicUrl });
}, { route: '/api/admin/sponsorships/sponsors/logo' });

/**
 * Throw a logo file away: a cancelled new sponsor's upload, or the file a saved edit stopped pointing at. Only one of THIS
 * club's own sponsor logos (it drives a service-role delete), and never a file a saved sponsor still names.
 */
export const DELETE = withObservability(async (req: Request) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const { org } = gate.ctx;
  const body = (await req.json().catch(() => null)) as { logoUrl?: unknown } | null;
  const logoUrl = typeof body?.logoUrl === 'string' ? body.logoUrl : '';
  const parsed = parseSponsorLogoUrl(logoUrl, org.id);
  if (!parsed) return NextResponse.json({ error: W.logoNotOurs }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('club_sponsors').select('logo_url').eq('org_id', org.id).not('logo_url', 'is', null);
  if (error) return NextResponse.json({ error: W.saveFailed }, { status: 500 });
  // Compared by the file each names, not the string, so the same address written another way still counts as in use.
  const inUse = ((data ?? []) as { logo_url: string }[]).some(s => parseSponsorLogoUrl(s.logo_url, org.id)?.objectPath === parsed.objectPath);
  if (inUse) return NextResponse.json({ error: W.saveFailed }, { status: 409 });
  await supabaseAdmin.storage.from(ORG_LOGO_BUCKET).remove([parsed.objectPath]);
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/sponsorships/sponsors/logo' });
