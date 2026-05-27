import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * POST /api/admin/org/onboarding-survey
 *
 * Stores a single qualifying question answer on the org's startup_tasks JSONB column.
 * Merges in a top-level `qualifying_answer` key without disturbing existing task entries.
 *
 * Body: { tournamentsPerYear: '1' | '2-3' | '4+' }
 *
 * This is a non-blocking step — callers should not surface errors to the user.
 * Segmentation data only; does not gate any features.
 */
export async function POST(req: Request) {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug });
  if (!ctx) return unauthorized();

  let body: { tournamentsPerYear?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { tournamentsPerYear } = body;
  if (!['1', '2-3', '4+'].includes(tournamentsPerYear ?? '')) {
    return NextResponse.json({ error: 'Invalid tournamentsPerYear value' }, { status: 400 });
  }

  // Read current startup_tasks JSONB, merge in qualifying_answer, write back
  const { data: orgRow, error: readErr } = await supabaseAdmin
    .from('organizations')
    .select('startup_tasks')
    .eq('id', ctx.org.id)
    .single();

  if (readErr && readErr.code !== '42703' && readErr.code !== 'PGRST204') {
    console.error('[onboarding-survey] Read error:', readErr);
    return NextResponse.json({ error: 'Read failed' }, { status: 500 });
  }

  const current = (orgRow?.startup_tasks as Record<string, unknown> | null) ?? {};
  const next = {
    ...current,
    qualifying_answer: {
      tournamentsPerYear,
      updatedAt: new Date().toISOString(),
    },
  };

  const { error: writeErr } = await supabaseAdmin
    .from('organizations')
    .update({ startup_tasks: next })
    .eq('id', ctx.org.id);

  if (writeErr) {
    console.error('[onboarding-survey] Write error:', writeErr);
    return NextResponse.json({ error: 'Write failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
