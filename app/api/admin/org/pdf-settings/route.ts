import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { OrgPdfSettings } from '@/lib/export/pdf';
import { resolveOrgPdfSettings, normalizeLogoDataUrl } from '@/lib/export/resolve-pdf-settings';
import { withObservability } from '@/lib/observability';

/**
 * GET /api/admin/org/pdf-settings
 * Two callers, two shapes (D4):
 * - Default: the RAW pdf_settings JSONB (or {}) — the settings form edits stored values, so
 *   it must never see derived ones (a resolved logo round-tripping through the form would be
 *   saved as if the admin had uploaded it).
 * - `?resolve=1`: `{ settings }` — the settings ADMIN paper is generated with: org-name
 *   header fallback, the org's uploaded logo derived into a print-ready data URL, branding
 *   forced on below customization plans. Export surfaces use this.
 * Any authenticated org member may read (styling-only, not sensitive); writes stay owner/admin.
 */
export const GET = withObservability(async (req: NextRequest) => {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('pdf_settings')
    .eq('id', ctx.org.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stored = (data?.pdf_settings as Record<string, unknown> | null) ?? {};

  if (req.nextUrl.searchParams.get('resolve') === '1') {
    const settings = await resolveOrgPdfSettings({
      id: ctx.org.id,
      name: ctx.org.name,
      planId: ctx.org.planId,
      logoUrl: ctx.org.logoUrl ?? null,
      pdfSettings: stored,
    });
    return NextResponse.json({ settings });
  }

  // Raw for the form — the derived-logo cache is internal plumbing, not a stored setting.
  delete stored.logoDerived;
  return NextResponse.json(stored as Partial<OrgPdfSettings>);
}, { route: '/api/admin/org/pdf-settings' });

/**
 * POST /api/admin/org/pdf-settings
 * Writes pdf_settings JSONB to the organizations row.
 * Accessible to owner and admin roles.
 */
export const POST = withObservability(async (req: NextRequest) => {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner' && ctx.role !== 'admin') return forbidden();

  let body: Partial<OrgPdfSettings>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Basic sanity — only write known keys, coerce types
  const settings: Partial<OrgPdfSettings> = {
    headerLine1:            typeof body.headerLine1 === 'string'            ? body.headerLine1 : undefined,
    headerLine2:            typeof body.headerLine2 === 'string'            ? body.headerLine2 : undefined,
    footerText:             typeof body.footerText === 'string'             ? body.footerText  : undefined,
    showDateStamp:          typeof body.showDateStamp === 'boolean'         ? body.showDateStamp : undefined,
    showPageNumbers:        typeof body.showPageNumbers === 'boolean'       ? body.showPageNumbers : undefined,
    showBranding:           typeof body.showBranding === 'boolean'          ? body.showBranding : undefined,
    orientation:            body.orientation === 'landscape'                ? 'landscape' : body.orientation === 'portrait' ? 'portrait' : undefined,
    accentColor:            typeof body.accentColor === 'string'            ? body.accentColor : undefined,
    logoDataUrl:            typeof body.logoDataUrl === 'string'            ? body.logoDataUrl : undefined,
    reportDensity:          body.reportDensity === 'compact'                ? 'compact' : body.reportDensity === 'readable' ? 'readable' : undefined,
    includeGuardianContacts: typeof body.includeGuardianContacts === 'boolean' ? body.includeGuardianContacts : undefined,
    includePlayerNotes:     typeof body.includePlayerNotes === 'boolean'    ? body.includePlayerNotes : undefined,
    includeInternalNotes:   typeof body.includeInternalNotes === 'boolean'  ? body.includeInternalNotes : undefined,
  };

  // A stored logo must be a real, bounded image: re-encode through the same sharp pipeline
  // as everything else the header draws. Rejecting here protects every browser and export
  // that will later decode it (no UI currently sets this field, but the key is accepted).
  if (settings.logoDataUrl) {
    const normalized = await normalizeLogoDataUrl(settings.logoDataUrl);
    if (!normalized) {
      return NextResponse.json({ error: 'Logo must be a valid image.' }, { status: 400 });
    }
    settings.logoDataUrl = normalized;
  }

  // Remove undefined keys so we do a clean merge-friendly write
  const clean = Object.fromEntries(
    Object.entries(settings).filter(([, v]) => v !== undefined),
  );

  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ pdf_settings: clean })
    .eq('id', ctx.org.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}, { route: '/api/admin/org/pdf-settings' });
