import { NextResponse } from 'next/server';
import { forbidden, getAuthContextWithScope, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { PRESETS } from '@/lib/themes';
import { normalizeHiddenPublicPages } from '@/lib/public-pages';
import { hasPlanFeature } from '@/lib/plan-features';
import type { PublicPageKey } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import { publicFrameBandFacts } from '@/lib/public-frame-server';
import { TOURNAMENT_TYPE_LOOKS } from '@/lib/tournament-look';

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const VALID_PRESETS = new Set(Object.keys(PRESETS));
const PLUS_VISUAL_FIELDS = [
  'themePreset',
  'themePrimary',
  'themeAccent',
  'typeLook',
] as const;
// Read and written by nothing here: the App icon's colour, name and logo size (icon_bg_color, app_name, app_icon_scale —
// the home-screen icon is always FieldLogicHQ's, Public tournament pages Stage 8 Part 1, owner ruling 2026-11-03); the
// hero banner, Dark/Light and the card style (hero_banner_url, color_mode, theme_card_style — Stage 8 Part 4b, asks A/B);
// and the old font list's `themeFont` key (theme_font now holds the type look, mig 426, written only as `typeLook`).
// A stale tab still sending `themeFont`, `themeCardStyle` or `colorMode` is IGNORED, not refused: refusing would drop
// the same save's Pages and coach-names change too, and nothing reads those values any more. The columns stay until a
// later /db pass (Stage 8 ask C).

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
    .select('logo_url, theme_preset, theme_primary, theme_accent, theme_font, require_score_finalization, status, start_date, end_date, champions_crowned_at')
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

  const advanced = hasPlanFeature(ctx.org.planId, 'advanced_tournament_branding');

  // The Look card's band preview (Public tournament pages Stage 1a Part 3) needs the two facts the band reads from the
  // event's records. Nothing is skipped: the draft can switch a hidden page back on before it saves. Only the Branding
  // page asks (`with=look`) — event settings and the setup wizard share this route and read none of it — and the card
  // draws only on a plan with advanced branding, so no other caller or plan pays for the read.
  const band = advanced && url.searchParams.get('with') === 'look'
    ? await publicFrameBandFacts(
      { id: tournamentId, status: data.status, startDate: data.start_date, endDate: data.end_date, championsCrownedAt: data.champions_crowned_at },
      { register: false, news: false, rules: false },
    ).catch(() => null)
    : null;

  return NextResponse.json({
    logoUrl:                  data.logo_url,
    themePreset:              data.theme_preset,
    themePrimary:             data.theme_primary,
    themeAccent:              data.theme_accent,
    themeFont:                data.theme_font,
    requireScoreFinalization: data.require_score_finalization,
    publicHiddenPages:        normalizeHiddenPublicPages(pageData?.public_hidden_pages),
    coachNamesShowOnPublic:   pageData?.coach_names_show_on_public === true,
    band,
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
    typeLook?: string | null;
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

  // The Look card's type (Stage 1a Part 3): one of the three type looks, stored as picked, or null to follow the club.
  // Classic ('system') is STORED: a null follows the club, so a tournament that picks Classic under a Serif club must
  // keep it (the retired font list's old rule mapped 'system' to null — gone with it, Stage 8 Part 4b).
  if ('typeLook' in body) {
    if (body.typeLook === null) {
      updates.theme_font = null;
    } else {
      const look = String(body.typeLook);
      if (!(TOURNAMENT_TYPE_LOOKS as readonly string[]).includes(look)) {
        return NextResponse.json({ error: 'Invalid type look' }, { status: 400 });
      }
      updates.theme_font = look;
    }
  }

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
