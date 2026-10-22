import { NextResponse } from 'next/server';
import { clubLookEditor } from '@/lib/public-site-access';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { STOCK_LOGOS, PLAN_ORDER } from '@/lib/stock-logos';
import { applyStockLogo } from '@/lib/stock-logo-render';
import { resolveTheme } from '@/lib/themes';
import { withObservability, captureError } from '@/lib/observability';

export const POST = withObservability(async (req: Request) => {
  // The owner or an admin changes the club's look (Public site builder, Option A, 2026-10-21; lib/public-site-access.ts).
  const r = await clubLookEditor(req);
  if (r.error) return r.error;
  const { org } = r.ctx;

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
      { error: `Upgrade to ${logo.minPlan} to use this logo` },
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
