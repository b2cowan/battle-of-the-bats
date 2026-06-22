import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getActiveOrgWorkspaceCount } from '@/lib/org-membership-policy';
import { withObservability } from '@/lib/observability';

/**
 * GET /api/me/workspaces — lightweight signal for client shells: how many org workspaces does
 * the SESSION user have? Drives whether to show the "All Workspaces" switcher link, which is
 * hidden for single-workspace users ("single-org by default", decision 2026-06-19).
 */
export const GET = withObservability(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0, hasMultiple: false });

  const count = await getActiveOrgWorkspaceCount(user.id);
  return NextResponse.json({ count, hasMultiple: count > 1 });
}, { route: '/api/me/workspaces' });
