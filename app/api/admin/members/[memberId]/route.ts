import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { OrgRole } from '@/lib/types';

type Params = { params: Promise<{ memberId: string }> };

async function verifyOwner(orgId: string, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .single();
  return data?.role === 'owner';
}

async function ownerCount(orgId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('role', 'owner');
  return count ?? 0;
}

export async function DELETE(_req: Request, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { user, org } = ctx;
  const { memberId } = await params;

  if (!(await verifyOwner(org.id, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch the member to check their role
  const { data: target } = await supabaseAdmin
    .from('organization_members')
    .select('id, role')
    .eq('id', memberId)
    .eq('organization_id', org.id)
    .single();

  if (!target) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  // Prevent removing the last owner
  if (target.role === 'owner' && (await ownerCount(org.id)) <= 1) {
    return NextResponse.json(
      { error: 'Cannot remove the last owner of the organization' },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from('organization_members')
    .delete()
    .eq('id', memberId)
    .eq('organization_id', org.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { user, org } = ctx;
  const { memberId } = await params;

  if (!(await verifyOwner(org.id, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const role: OrgRole = body.role === 'admin' ? 'admin' : body.role === 'staff' ? 'staff' : 'staff';

  // Fetch target to check current role
  const { data: target } = await supabaseAdmin
    .from('organization_members')
    .select('id, role')
    .eq('id', memberId)
    .eq('organization_id', org.id)
    .single();

  if (!target) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  // Officials cannot be promoted — they must be removed and re-invited with the desired role
  if (target.role === 'official') {
    return NextResponse.json(
      { error: 'Field officials cannot be promoted. Remove and re-invite them with the desired role.' },
      { status: 400 }
    );
  }

  // Prevent demoting the last owner (target.role may be 'owner'; new role is always admin/staff)
  if (target.role === 'owner' && (await ownerCount(org.id)) <= 1) {
    return NextResponse.json(
      { error: 'Cannot demote the last owner of the organization' },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from('organization_members')
    .update({ role })
    .eq('id', memberId)
    .eq('organization_id', org.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, role });
}
