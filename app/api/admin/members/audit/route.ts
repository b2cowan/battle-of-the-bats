import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

const PAGE_SIZE = 25;

const ACTION_LABELS: Record<string, string> = {
  member_invited:       'Invited',
  member_removed:       'Removed',
  role_changed:         'Role changed',
  capabilities_changed: 'Capabilities updated',
  member_suspended:     'Suspended',
  member_reinstated:    'Reinstated',
};

function summarizePayload(action: string, payload: Record<string, unknown> | null): string {
  if (!payload) return '';
  switch (action) {
    case 'member_invited':       return `Invited as ${payload.role}`;
    case 'member_removed':       return `Removed (was ${payload.role})`;
    case 'role_changed':         return `${payload.before} → ${payload.after}`;
    case 'capabilities_changed': return 'Capability overrides updated';
    default:                     return '';
  }
}

export const GET = withObservability(async (req: Request) => {
  const ctx = await getAuthContextWithRole();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { data: rows, count, error } = await supabaseAdmin
    .from('org_audit_log')
    .select('id, actor_id, target_id, action, payload, created_at', { count: 'exact' })
    .eq('org_id', ctx.org.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Resolve unique actor/target IDs to emails in parallel.
  // getUserById returns null for deleted auth users — shown as 'Deleted user'.
  const uniqueIds = [
    ...new Set(
      (rows ?? [])
        .flatMap(r => [r.actor_id, r.target_id])
        .filter((id): id is string => !!id)
    ),
  ];

  const emailMap: Record<string, string> = {};
  await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(id);
        emailMap[id] = user?.email ?? 'Deleted user';
      } catch {
        emailMap[id] = 'Deleted user';
      }
    })
  );

  const result = (rows ?? []).map(r => {
    const payload = r.payload as Record<string, unknown> | null;
    // member_removed stores email in payload because the auth user is deleted by then.
    const targetEmail =
      r.action === 'member_removed' && payload?.email
        ? String(payload.email)
        : r.target_id ? (emailMap[r.target_id] ?? '—') : '—';

    return {
      id: r.id,
      action: r.action,
      actionLabel: ACTION_LABELS[r.action] ?? r.action,
      actorEmail: r.actor_id ? (emailMap[r.actor_id] ?? 'Deleted user') : 'System',
      targetEmail,
      details: summarizePayload(r.action, payload),
      createdAt: r.created_at,
    };
  });

  return NextResponse.json({
    rows: result,
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  });
}, { route: '/api/admin/members/audit' });
