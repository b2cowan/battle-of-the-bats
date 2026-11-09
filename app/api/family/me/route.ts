import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { withObservability } from '@/lib/observability';
import { GUARDIAN_TIER_ENABLED } from '@/lib/family-guardian';
import { FAMILY_HOME_PATH } from '@/lib/family-invitation-panel';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Does this account get the "Your family" row in the shared account menu? (Signed-in family accounts Stage 4a, Part 6.7;
 * ruling 11.) Only an account with a live (verified) connection to a child, and only while the guardian tier is on; otherwise
 * 404, and the menu renders exactly as before. Asked by the menu when it first opens; one indexed read.
 */
export const GET = withObservability(async () => {
  if (!GUARDIAN_TIER_ENABLED) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const { data, error } = await supabaseAdmin.from('family_links')
    .select('id').eq('user_id', user.id).eq('status', 'verified').limit(1);
  if (error) throw error;
  if (!data?.length) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ href: FAMILY_HOME_PATH }, { headers: { 'Cache-Control': 'no-store' } });
}, { route: '/api/family/me' });
