import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ROLE_DEFAULTS, hasCapability } from '@/lib/roles';
import type { OrgRole } from '@/lib/types';

const VALID_CAPABILITIES = new Set<string>(
  Object.values(ROLE_DEFAULTS).flatMap(s => [...s] as string[])
);

type Params = { params: Promise<{ memberId: string }> };

async function ownerCount(orgId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('role', 'owner');
  return count ?? 0;
}

export async function DELETE(_req: Request, { params }: Params) {
  const ctx = await getAuthContextWithRole();
  if (!ctx) return unauthorized();

  if (!hasCapability(ctx.role, ctx.capabilities, 'manage_members')) return forbidden();

  const { org } = ctx;
  const { memberId } = await params;

  const { data: target } = await supabaseAdmin
    .from('organization_members')
    .select('id, role, user_id')
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

  // Prevent self-removal via this endpoint
  if (target.user_id === ctx.user.id) {
    return NextResponse.json(
      { error: 'You cannot remove yourself from the organization.' },
      { status: 400 }
    );
  }

  // Delete the auth user — ON DELETE CASCADE removes the organization_members row
  // and transitively the org_member_tournament_assignments rows. Hard-delete (default).
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(target.user_id);
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: Params) {
  const ctx = await getAuthContextWithRole();
  if (!ctx) return unauthorized();

  if (!hasCapability(ctx.role, ctx.capabilities, 'manage_members')) return forbidden();

  const { org } = ctx;
  const { memberId } = await params;

  const body = await req.json();

  const hasRoleUpdate = 'role' in body;
  const hasCapabilitiesUpdate = 'capabilities' in body;
  const hasStatusUpdate = 'status' in body;

  // Capabilities and status changes are owner-only
  if (hasCapabilitiesUpdate && ctx.role !== 'owner') return forbidden();
  if (hasStatusUpdate && ctx.role !== 'owner') return forbidden();

  const { data: target } = await supabaseAdmin
    .from('organization_members')
    .select('id, role')
    .eq('id', memberId)
    .eq('organization_id', org.id)
    .single();

  if (!target) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  // Prevent demoting the last owner
  if (hasRoleUpdate && target.role === 'owner' && (await ownerCount(org.id)) <= 1) {
    return NextResponse.json(
      { error: 'Cannot demote the last owner of the organization' },
      { status: 400 }
    );
  }

  // Owners cannot be suspended
  if (hasStatusUpdate && target.role === 'owner') {
    return NextResponse.json(
      { error: 'Cannot suspend an organization owner' },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = {};

  if (hasRoleUpdate) {
    // Accept admin | staff | official; never allow promoting to owner via this endpoint
    update.role =
      body.role === 'admin' ? 'admin'
      : body.role === 'staff' ? 'staff'
      : body.role === 'official' ? 'official'
      : 'staff';
  }

  if (hasStatusUpdate) {
    // Only 'active' and 'suspended' are settable via this endpoint; 'invited' is set by the invite route.
    if (body.status === 'suspended' || body.status === 'active') {
      update.status = body.status;
    }
  }

  if (hasCapabilitiesUpdate) {
    if (body.capabilities === null) {
      update.capabilities = null;
    } else if (typeof body.capabilities === 'object') {
      const sanitized: Record<string, boolean> = {};
      for (const [key, val] of Object.entries(body.capabilities as Record<string, unknown>)) {
        if (VALID_CAPABILITIES.has(key) && typeof val === 'boolean') {
          sanitized[key] = val;
        }
      }
      // Empty object → null (no overrides stored)
      update.capabilities = Object.keys(sanitized).length > 0 ? sanitized : null;
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabaseAdmin
    .from('organization_members')
    .update(update)
    .eq('id', memberId)
    .eq('organization_id', org.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...(hasRoleUpdate ? { role: update.role } : {}) });
}
