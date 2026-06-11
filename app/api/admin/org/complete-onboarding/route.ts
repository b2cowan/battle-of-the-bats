import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

export const POST = withObservability(async () => {
  const ctx = await getAuthContextWithRole();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();

  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', ctx.org.id)
    .is('onboarding_completed_at', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}, { route: '/api/admin/org/complete-onboarding' });
