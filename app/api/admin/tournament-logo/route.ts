import { NextResponse } from 'next/server';
import { forbidden, getAuthContextWithScope, requireTournamentInOrg, scopeGuard, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hasPlanFeature } from '@/lib/plan-features';
import { hasCapability } from '@/lib/roles';
import { withObservability } from '@/lib/observability';
import { ORG_LOGO_BUCKET as BUCKET, ensureOrgLogoBucket } from '@/lib/org-logo-storage';
import { measureLogoAspect } from '@/lib/org-logo-measure';

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
};

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
  // The event must be this organization's BEFORE the storage write or removal below: `scopeGuard` passes an owner for any id,
  // and the id is part of the storage path (a foreign or crafted id must never reach another tenant's folder).
  const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
  if (wrongOrg) return wrongOrg;

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

  await ensureOrgLogoBucket();

  const ext  = EXT_MAP[file.type];
  const path = `${ctx.org.id}/${tournamentId}/logo.${ext}`;
  const bytes = await file.arrayBuffer();

  // The shape is measured while the file uploads (the two are independent; `measureLogoAspect` never throws).
  const [{ error: uploadError }, logoAspect] = await Promise.all([
    supabaseAdmin.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: true }),
    measureLogoAspect(bytes),
  ]);

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  // Version stamp, as the organization's logo has (`/api/admin/org-logo`): the storage path is stable across re-uploads of the
  // same file type, so without it the address never changes and a browser keeps showing the old picture (beside the new
  // picture's stored shape, in the admin sidebar's tile).
  const logoUrl = `${urlData.publicUrl}?v=${Date.now()}`;

  const { error: dbError } = await supabaseAdmin
    .from('tournaments')
    // The shape is stored with the logo (mig 460): the admin sidebar's tile decides logo-or-initials from it on the server's
    // first paint. Unreadable bytes store null, which the tile reads as the event's initials.
    .update({ logo_url: logoUrl, logo_aspect: logoAspect })
    .eq('id', tournamentId)
    .eq('org_id', ctx.org.id);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ logoUrl, logoAspect });
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
  // The event must be this organization's BEFORE the storage write or removal below: `scopeGuard` passes an owner for any id,
  // and the id is part of the storage path (a foreign or crafted id must never reach another tenant's folder).
  const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
  if (wrongOrg) return wrongOrg;

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
    .update({ logo_url: null, logo_aspect: null })
    .eq('id', tournamentId)
    .eq('org_id', ctx.org.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}, { route: '/api/admin/tournament-logo' });
