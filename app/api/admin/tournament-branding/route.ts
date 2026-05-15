import { NextResponse } from 'next/server';
import { forbidden, getAuthContextWithScope, scopeGuard, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request) {
  const ctx = await getAuthContextWithScope();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();

  const tournamentId = new URL(req.url).searchParams.get('tournamentId');
  if (!tournamentId) return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const { data, error } = await supabaseAdmin
    .from('tournaments')
    .select('logo_url, hero_banner_url, theme_preset, theme_primary, theme_accent, theme_font, theme_card_style, require_score_finalization')
    .eq('id', tournamentId)
    .eq('organization_id', ctx.org.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    logoUrl:                  data.logo_url,
    heroBannerUrl:            data.hero_banner_url,
    themePreset:              data.theme_preset,
    themePrimary:             data.theme_primary,
    themeAccent:              data.theme_accent,
    themeFont:                data.theme_font,
    themeCardStyle:           data.theme_card_style,
    requireScoreFinalization: data.require_score_finalization,
  });
}

export async function PATCH(req: Request) {
  const ctx = await getAuthContextWithScope();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();

  const tournamentId = new URL(req.url).searchParams.get('tournamentId');
  if (!tournamentId) return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const body = await req.json() as {
    themePreset?: string | null;
    themePrimary?: string | null;
    themeAccent?: string | null;
    themeFont?: string | null;
    themeCardStyle?: string | null;
    requireScoreFinalization?: boolean | null;
  };

  const updates: Record<string, unknown> = {};
  if ('themePreset'              in body) updates.theme_preset               = body.themePreset ?? null;
  if ('themePrimary'             in body) updates.theme_primary              = body.themePrimary ?? null;
  if ('themeAccent'              in body) updates.theme_accent               = body.themeAccent ?? null;
  if ('themeFont'                in body) updates.theme_font                 = body.themeFont ?? null;
  if ('themeCardStyle'           in body) updates.theme_card_style           = body.themeCardStyle ?? null;
  if ('requireScoreFinalization' in body) updates.require_score_finalization = body.requireScoreFinalization ?? null;

  const { error } = await supabaseAdmin
    .from('tournaments')
    .update(updates)
    .eq('id', tournamentId)
    .eq('organization_id', ctx.org.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
