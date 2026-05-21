import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPermission } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';

type OrgIdentityRow = {
  name: string;
  slug: string;
};

function cleanSlug(value: string) {
  return value.trim().toLowerCase();
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePlatformPermission('manage_support');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json() as { name?: string; slug?: string; reason?: string };

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const slug = typeof body.slug === 'string' ? cleanSlug(body.slug) : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json({
      error: 'Slug must use lowercase letters, numbers, and single hyphens only',
    }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from('organizations')
    .select('name, slug')
    .eq('id', id)
    .single<OrgIdentityRow>();

  if (currentError || !current) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  if (slug !== current.slug) {
    const { count, error: slugError } = await supabaseAdmin
      .from('organizations')
      .select('id', { count: 'exact', head: true })
      .eq('slug', slug)
      .neq('id', id);

    if (slugError) {
      console.error('[platform-admin] org slug check error:', slugError);
      return NextResponse.json({ error: 'Slug check failed' }, { status: 500 });
    }
    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: 'That slug is already taken' }, { status: 409 });
    }
  }

  const { data: updated, error } = await supabaseAdmin
    .from('organizations')
    .update({ name, slug })
    .eq('id', id)
    .select('name, slug')
    .single<OrgIdentityRow>();

  if (error || !updated) {
    console.error('[platform-admin] org identity update error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  if (current.name !== name) {
    await writePlatformAuditLog(auth.user.email!, id, 'update_org_identity', 'name', current.name, {
      value: name,
      reason,
    });
  }
  if (current.slug !== slug) {
    await writePlatformAuditLog(auth.user.email!, id, 'update_org_identity', 'slug', current.slug, {
      value: slug,
      reason,
    });
  }

  return NextResponse.json({ ok: true, org: updated });
}
