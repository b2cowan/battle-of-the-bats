import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { OrgPdfSettings } from '@/lib/export/pdf';

/**
 * GET /api/admin/org/pdf-settings
 * Returns the org's pdf_settings JSONB column (or {} if never set).
 * Any authenticated org member may read PDF settings — the data is
 * styling-only (not sensitive) and coaches portal pages need it to
 * produce branded exports.  Write access is still restricted to owner/admin.
 */
export async function GET(req: NextRequest) {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug });
  if (!ctx) return unauthorized();

  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('pdf_settings')
    .eq('id', ctx.org.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data?.pdf_settings as OrgPdfSettings | null) ?? {});
}

/**
 * POST /api/admin/org/pdf-settings
 * Writes pdf_settings JSONB to the organizations row.
 * Accessible to owner and admin roles.
 */
export async function POST(req: NextRequest) {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug });
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
}
