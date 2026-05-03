import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { PRESETS, FONT_OPTIONS, CARD_STYLE_OPTIONS } from '@/lib/themes';

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const VALID_PRESETS     = new Set(Object.keys(PRESETS));
const VALID_FONTS       = new Set(Object.keys(FONT_OPTIONS));
const VALID_CARD_STYLES = new Set(Object.keys(CARD_STYLE_OPTIONS));

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { org } = ctx;

  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('name, slug, logo_url, is_public, theme_preset, theme_primary, theme_accent, hero_banner_url, theme_font, theme_card_style')
    .eq('id', org.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }

  return NextResponse.json({
    name:           data.name,
    slug:           data.slug,
    logoUrl:        data.logo_url         ?? null,
    isPublic:       data.is_public,
    themePreset:    data.theme_preset     ?? 'platform',
    themePrimary:   data.theme_primary    ?? null,
    themeAccent:    data.theme_accent     ?? null,
    heroBannerUrl:  data.hero_banner_url  ?? null,
    themeFont:      data.theme_font       ?? 'system',
    themeCardStyle: data.theme_card_style ?? 'default',
  });
}

export async function PATCH(req: Request) {
  const ctx = await getAuthContext();
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

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const trimmed = String(body.name).trim();
    if (!trimmed) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    updates.name = trimmed;
  }

  if (body.slug !== undefined) {
    const slug = String(body.slug).trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: 'Slug may only contain lowercase letters, numbers, and hyphens' },
        { status: 400 }
      );
    }
    const { data: existing } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .neq('id', org.id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: 'That slug is already taken' }, { status: 409 });
    }
    updates.slug = slug;
  }

  if (body.isPublic !== undefined) {
    updates.is_public = Boolean(body.isPublic);
  }

  // ── Theme fields ─────────────────────────────────────────────────────────────

  if (body.themePreset !== undefined) {
    const preset = String(body.themePreset);
    updates.theme_preset = VALID_PRESETS.has(preset) ? preset : 'platform';
  }

  if (body.themePrimary !== undefined) {
    if (body.themePrimary === null) {
      updates.theme_primary = null;
    } else {
      const isProOrElite = org.planId === 'pro' || org.planId === 'elite';
      if (!isProOrElite) {
        return NextResponse.json(
          { error: 'Custom colors require a Pro or Elite plan' },
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

  if (body.themeAccent !== undefined) {
    if (body.themeAccent === null) {
      updates.theme_accent = null;
    } else {
      const isProOrElite = org.planId === 'pro' || org.planId === 'elite';
      if (!isProOrElite) {
        return NextResponse.json(
          { error: 'Custom colors require a Pro or Elite plan' },
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

  if (body.themeFont !== undefined) {
    const font = String(body.themeFont);
    const isProOrElite = org.planId === 'pro' || org.planId === 'elite';
    if (!isProOrElite && font !== 'system') {
      return NextResponse.json(
        { error: 'Custom fonts require a Pro or Elite plan' },
        { status: 403 }
      );
    }
    updates.theme_font = VALID_FONTS.has(font) ? font : 'system';
  }

  if (body.themeCardStyle !== undefined) {
    const style = String(body.themeCardStyle);
    updates.theme_card_style = VALID_CARD_STYLES.has(style) ? style : 'default';
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data: updated, error } = await supabaseAdmin
    .from('organizations')
    .update(updates)
    .eq('id', org.id)
    .select('name, slug, logo_url, is_public, theme_preset, theme_primary, theme_accent, hero_banner_url, theme_font, theme_card_style')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    name:           updated.name,
    slug:           updated.slug,
    logoUrl:        updated.logo_url         ?? null,
    isPublic:       updated.is_public,
    themePreset:    updated.theme_preset     ?? 'platform',
    themePrimary:   updated.theme_primary    ?? null,
    themeAccent:    updated.theme_accent     ?? null,
    heroBannerUrl:  updated.hero_banner_url  ?? null,
    themeFont:      updated.theme_font       ?? 'system',
    themeCardStyle: updated.theme_card_style ?? 'default',
  });
}
