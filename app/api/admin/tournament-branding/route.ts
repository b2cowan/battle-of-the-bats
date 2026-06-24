import { NextResponse } from 'next/server';
import { forbidden, getAuthContextWithScope, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { CARD_STYLE_OPTIONS, FONT_OPTIONS, PRESETS } from '@/lib/themes';
import { normalizeHiddenPublicPages } from '@/lib/public-pages';
import { hasPlanFeature } from '@/lib/plan-features';
import type { PublicPageKey } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import { fetchAsDataUrl, detectBackgroundHex } from '@/lib/pwa-icon';

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const VALID_PRESETS = new Set(Object.keys(PRESETS));
const VALID_FONTS = new Set(Object.keys(FONT_OPTIONS));
const VALID_CARD_STYLES = new Set(Object.keys(CARD_STYLE_OPTIONS));
const PLUS_VISUAL_FIELDS = [
  'themePreset',
  'themePrimary',
  'themeAccent',
  'themeFont',
  'themeCardStyle',
  'colorMode',
  'iconBgColor',
  'appName',
] as const;

const APP_NAME_MAX = 30;

/** Auto-detect the app-icon tile colour the same way the icon routes do: sample the
 *  effective logo's own background. Used to seed/show the "Auto" option in the UI. */
async function suggestIconBg(logoUrl: string | null): Promise<string | null> {
  if (!logoUrl) return null;
  const dataUrl = await fetchAsDataUrl(logoUrl);
  return dataUrl ? detectBackgroundHex(dataUrl) : null;
}

export const GET = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  // Admins may read tournament branding + score policy for their own org's tournaments
  // (scopeGuard below still restricts which tournaments). Owner-only enforcement on
  // *writes* is handled per-field in PATCH.

  const tournamentId = url.searchParams.get('tournamentId');
  if (!tournamentId) return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const { data, error } = await supabaseAdmin
    .from('tournaments')
    .select('logo_url, hero_banner_url, theme_preset, theme_primary, theme_accent, theme_font, theme_card_style, color_mode, icon_bg_color, app_name, require_score_finalization')
    .eq('id', tournamentId)
    .eq('org_id', ctx.org.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: pageData } = await supabaseAdmin
    .from('tournaments')
    .select('public_hidden_pages, coach_names_show_on_public')
    .eq('id', tournamentId)
    .eq('org_id', ctx.org.id)
    .maybeSingle();

  // For the App Icon control: auto-sample the colour the icon would use by default.
  // The icon resolves the effective logo as tournament logo → org logo, so mirror that
  // fallback here. Only worth computing for plans that can use advanced branding.
  let iconBgSuggested: string | null = null;
  if (hasPlanFeature(ctx.org.planId, 'advanced_tournament_branding')) {
    let effectiveLogo = data.logo_url as string | null;
    if (!effectiveLogo) {
      const { data: orgRow } = await supabaseAdmin
        .from('organizations').select('logo_url').eq('id', ctx.org.id).maybeSingle();
      effectiveLogo = orgRow?.logo_url ?? null;
    }
    iconBgSuggested = await suggestIconBg(effectiveLogo);
  }

  return NextResponse.json({
    logoUrl:                  data.logo_url,
    heroBannerUrl:            data.hero_banner_url,
    themePreset:              data.theme_preset,
    themePrimary:             data.theme_primary,
    themeAccent:              data.theme_accent,
    themeFont:                data.theme_font,
    themeCardStyle:           data.theme_card_style,
    colorMode:                data.color_mode ?? 'dark',
    iconBgColor:              data.icon_bg_color ?? null,
    iconBgSuggested,
    appName:                  data.app_name ?? null,
    requireScoreFinalization: data.require_score_finalization,
    publicHiddenPages:        normalizeHiddenPublicPages(pageData?.public_hidden_pages),
    coachNamesShowOnPublic:   pageData?.coach_names_show_on_public === true,
  });
}, { route: '/api/admin/tournament-branding' });

export const PATCH = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

  const tournamentId = url.searchParams.get('tournamentId');
  if (!tournamentId) return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const body = await req.json() as {
    themePreset?: string | null;
    themePrimary?: string | null;
    themeAccent?: string | null;
    themeFont?: string | null;
    themeCardStyle?: string | null;
    colorMode?: 'dark' | 'light' | null;
    iconBgColor?: string | null;
    appName?: string | null;
    publicHiddenPages?: PublicPageKey[] | null;
    coachNamesShowOnPublic?: boolean | null;
    requireScoreFinalization?: boolean | null;
  };

  // Branding fields: the tournament's public visual identity + which public pages show.
  // Gated on the manage_branding capability (owner + admin by default; tunable per-member).
  // Operational settings like requireScoreFinalization are not branding and stay as-is.
  const BRANDING_FIELDS = [...PLUS_VISUAL_FIELDS, 'publicHiddenPages', 'coachNamesShowOnPublic'] as const;
  if (!hasCapability(ctx.role, ctx.capabilities, 'manage_branding') && BRANDING_FIELDS.some(field => field in body)) {
    return forbidden();
  }

  const updates: Record<string, unknown> = {};
  const canUseAdvancedBranding = hasPlanFeature(ctx.org.planId, 'advanced_tournament_branding');

  if (!canUseAdvancedBranding && PLUS_VISUAL_FIELDS.some(field => field in body)) {
    return NextResponse.json(
      { error: 'Tournament visual branding requires Tournament Plus or higher' },
      { status: 403 }
    );
  }

  if ('themePreset' in body) {
    if (body.themePreset === null) {
      updates.theme_preset = null;
    } else {
      const preset = String(body.themePreset);
      updates.theme_preset = VALID_PRESETS.has(preset) ? preset : 'platform';
    }
  }

  if ('themePrimary' in body) {
    if (body.themePrimary === null) {
      updates.theme_primary = null;
    } else {
      if (!canUseAdvancedBranding) {
        return NextResponse.json(
          { error: 'Custom tournament colors require Tournament Plus or higher' },
          { status: 403 }
        );
      }
      const hex = String(body.themePrimary);
      if (!HEX_RE.test(hex)) {
        return NextResponse.json({ error: 'Invalid hex color for themePrimary' }, { status: 400 });
      }
      updates.theme_primary = hex;
    }
  }

  if ('themeAccent' in body) {
    if (body.themeAccent === null) {
      updates.theme_accent = null;
    } else {
      if (!canUseAdvancedBranding) {
        return NextResponse.json(
          { error: 'Custom tournament colors require Tournament Plus or higher' },
          { status: 403 }
        );
      }
      const hex = String(body.themeAccent);
      if (!HEX_RE.test(hex)) {
        return NextResponse.json({ error: 'Invalid hex color for themeAccent' }, { status: 400 });
      }
      updates.theme_accent = hex;
    }
  }

  if ('themeFont' in body) {
    const font = body.themeFont ? String(body.themeFont) : 'system';
    if (!VALID_FONTS.has(font)) {
      return NextResponse.json({ error: 'Invalid theme font' }, { status: 400 });
    }
    if (!canUseAdvancedBranding && font !== 'system') {
      return NextResponse.json(
        { error: 'Custom tournament fonts require Tournament Plus or higher' },
        { status: 403 }
      );
    }
    updates.theme_font = font === 'system' ? null : font;
  }

  if ('themeCardStyle' in body) {
    const style = body.themeCardStyle ? String(body.themeCardStyle) : 'default';
    if (!VALID_CARD_STYLES.has(style)) {
      return NextResponse.json({ error: 'Invalid theme card style' }, { status: 400 });
    }
    if (!canUseAdvancedBranding && style !== 'default') {
      return NextResponse.json(
        { error: 'Alternative tournament card styles require Tournament Plus or higher' },
        { status: 403 }
      );
    }
    updates.theme_card_style = style === 'default' ? null : style;
  }

  if ('iconBgColor' in body) {
    if (body.iconBgColor === null) {
      updates.icon_bg_color = null;
    } else {
      const hex = String(body.iconBgColor);
      if (!HEX_RE.test(hex)) {
        return NextResponse.json({ error: 'Invalid hex color for iconBgColor' }, { status: 400 });
      }
      updates.icon_bg_color = hex;
    }
  }

  if ('appName' in body) {
    const trimmed = body.appName == null ? '' : String(body.appName).trim();
    updates.app_name = trimmed ? trimmed.slice(0, APP_NAME_MAX) : null;
  }

  if ('colorMode'                in body) updates.color_mode                 = body.colorMode === 'light' ? 'light' : null;
  if ('publicHiddenPages'        in body) updates.public_hidden_pages        = normalizeHiddenPublicPages(body.publicHiddenPages);
  if ('coachNamesShowOnPublic'   in body) updates.coach_names_show_on_public = Boolean(body.coachNamesShowOnPublic);
  if ('requireScoreFinalization' in body) updates.require_score_finalization = body.requireScoreFinalization;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabaseAdmin
    .from('tournaments')
    .update(updates)
    .eq('id', tournamentId)
    .eq('org_id', ctx.org.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}, { route: '/api/admin/tournament-branding' });
