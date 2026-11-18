import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { WAITING_ROLE_CLEARED } from '@/lib/waiting-board-role';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { requireFreshCode } from '@/lib/two-step-fresh';
import { roleChangeStartsGrace, startTwoStepGrace } from '@/lib/two-step-grace';

type MemberRow = {
  user_id: string;
  role: string;
  status: string;
};

export const POST = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('club_support');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as {
    newOwnerUserId?: string;
    reason?: string;
  };
  const newOwnerUserId = typeof body.newOwnerUserId === 'string' ? body.newOwnerUserId.trim() : '';
  const reason = typeof body.reason === 'string' && body.reason.trim()
    ? body.reason.trim()
    : null;

  if (!newOwnerUserId) {
    return NextResponse.json({ error: 'New owner user ID is required.' }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: 'Reason is required.' }, { status: 400 });
  }

  const { data: members, error: memberError } = await supabaseAdmin
    .from('organization_members')
    .select('user_id, role, status')
    .eq('organization_id', id)
    .returns<MemberRow[]>();

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  const newOwnerMember = members?.find(m => m.user_id === newOwnerUserId);
  if (!newOwnerMember) {
    return NextResponse.json(
      { error: 'The selected user is not a member of this organization.' },
      { status: 400 }
    );
  }
  if (newOwnerMember.role === 'owner') {
    return NextResponse.json(
      { error: 'This user is already an owner.' },
      { status: 400 }
    );
  }

  const currentOwners = (members ?? []).filter(m => m.role === 'owner');

  // Handing someone a club asks for a code (Board Ready two-step, Part 2: staff doors ask too, owner 2026-11-11), after
  // every check above and before the first write.
  const stale = await requireFreshCode();
  if (stale) return stale;

  // Promote the new owner first so the org is never briefly ownerless. A board role waiting on a coach's row (trust
  // close-out 13 P2b, mig 503) is moot once they own the club, and the row's CHECK allows a waiting role on a coach row only.
  const { error: promoteError } = await supabaseAdmin
    .from('organization_members')
    .update({ role: 'owner', ...WAITING_ROLE_CLEARED })
    .eq('organization_id', id)
    .eq('user_id', newOwnerUserId);

  if (promoteError) {
    return NextResponse.json({ error: promoteError.message }, { status: 500 });
  }

  // Two-step (Board Ready, Part 3): an active member moved under the board's switch from outside it gets their own 14 days.
  if (newOwnerMember.status === 'active' && roleChangeStartsGrace(newOwnerMember.role, 'owner')) {
    await startTwoStepGrace(newOwnerUserId, id, 'owner');
  }

  // Demote all previous owners to admin.
  if (currentOwners.length > 0) {
    const prevOwnerIds = currentOwners.map(m => m.user_id);
    const { error: demoteError } = await supabaseAdmin
      .from('organization_members')
      .update({ role: 'admin' })
      .eq('organization_id', id)
      .in('user_id', prevOwnerIds);

    if (demoteError) {
      return NextResponse.json({ error: demoteError.message }, { status: 500 });
    }
  }

  await writePlatformAuditLog(
    auth.user.email!,
    id,
    'transfer_org_ownership',
    'owner_user_id',
    currentOwners.map(m => m.user_id).join(', ') || null,
    {
      newOwnerUserId,
      demotedOwnerIds: currentOwners.map(m => m.user_id),
    },
    { reason },
  );

  return NextResponse.json({
    ok: true,
    newOwnerUserId,
    demotedCount: currentOwners.length,
  });
}, { route: '/api/platform-admin/orgs/[id]/transfer-ownership' });
