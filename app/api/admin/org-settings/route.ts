import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { org } = ctx;
  return NextResponse.json({
    name: org.name,
    slug: org.slug,
    logoUrl: org.logoUrl ?? null,
    isPublic: org.isPublic,
  });
}

export async function PATCH(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { user, org } = ctx;

  // Verify caller is owner
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
    // Uniqueness check — exclude current org
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

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data: updated, error } = await supabaseAdmin
    .from('organizations')
    .update(updates)
    .eq('id', org.id)
    .select('name, slug, logo_url, is_public')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    name: updated.name,
    slug: updated.slug,
    logoUrl: updated.logo_url ?? null,
    isPublic: updated.is_public,
  });
}
