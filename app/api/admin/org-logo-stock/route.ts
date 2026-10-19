import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { STOCK_LOGOS, PLAN_ORDER } from '@/lib/stock-logos';
import { applyStockLogo } from '@/lib/stock-logo-render';
import { resolveTheme } from '@/lib/themes';
import { withObservability, captureError } from '@/lib/observability';

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

  const { user, org } = ctx;

  const { data: membership } = await supabaseAdmin
    .from('organization_members')
    .select('role')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .single();

  if (membership?.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const stockPath: unknown = body?.stockPath;

  if (typeof stockPath !== 'string') {
    return NextResponse.json({ error: 'stockPath is required' }, { status: 400 });
  }

  const logo = STOCK_LOGOS.find(l => l.file === stockPath);
  if (!logo) {
    return NextResponse.json({ error: 'Unknown stock logo' }, { status: 400 });
  }

  if (PLAN_ORDER[org.planId] < PLAN_ORDER[logo.minPlan]) {
    return NextResponse.json(
      { error: `Upgrade to ${logo.minPlan} to use this icon` },
      { status: 403 }
    );
  }

  // The pick is made in the club's saved main colour and stored as its logo (lib/stock-logo-render.ts):
  // the art alone is a white mark that vanished on every light surface and every export.
  const { data: current, error: readError } = await supabaseAdmin
    .from('organizations')
    .select('logo_url, theme_preset, theme_primary, theme_accent')
    .eq('id', org.id)
    .single();

  if (readError || !current) {
    return NextResponse.json({ error: 'The logo didn’t save.' }, { status: 500 });
  }

  try {
    const colours = resolveTheme(current.theme_preset, current.theme_primary, current.theme_accent);
    const logoUrl = await applyStockLogo(org.id, logo, colours, current.logo_url);
    return NextResponse.json({ logoUrl });
  } catch (err) {
    void captureError(err, { route: '/api/admin/org-logo-stock', method: 'POST', statusCode: 500 });
    return NextResponse.json({ error: 'The logo didn’t save.' }, { status: 500 });
  }
}, { route: '/api/admin/org-logo-stock' });
