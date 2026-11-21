import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchAll } from '@/lib/supabase-paging';
import { writeOrgAuditFirst } from '@/lib/org-audit';
import { STAFF_REG_COLS, readSeasonAnswerGrid, saveAnswerColumns, type StaffRegRow } from '@/lib/club-form-staff';
import { seasonFormId } from '@/lib/club-form-server';
import { ANSWER_COLUMNS_MAX } from '@/lib/club-form-staff-words';
import { HEALTH_EXPORT_ACTION } from '@/lib/member-audit';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { staffSeason } from '@/lib/club-form-staff-route';
import { isUuid } from '@/lib/utils';

type Params = { params: Promise<{ seasonId: string }> };

/**
 * GET — the season's answers WITH health answers, for the one opt-in export "Excel with contact details and health answers"
 * (Board Ready Stage 4 Part 3, ruling 13). The list never carries a health answer; this is asked for only when someone
 * chooses that export, and each time is written to the club's activity log (no answer in the row).
 */
export const GET = withObservability(async (req: Request, { params }: Params) => {
  const { seasonId } = await params;
  const ctx = await getAuthContextWithRole({ orgSlug: new URL(req.url).searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'read');
  if (err || !ctx) return err ?? NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const season = await staffSeason(ctx.org.id, seasonId);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const regs = await fetchAll<StaffRegRow>((a, b) => supabaseAdmin.from('league_registrations')
    .select(STAFF_REG_COLS).eq('season_id', season.id).order('id').range(a, b));
  const grid = await readSeasonAnswerGrid({ seasonId: season.id, regs, health: true });
  // Logged when the file it builds carries health answers (a season with none is not a health export) — and written
  // BEFORE the answers leave: when the line can't be written, nothing goes out (owner call 3, 2026-11-20).
  if (grid?.questions.some(q => q.health)
    && !(await writeOrgAuditFirst(ctx.org.id, ctx.user.id, null, HEALTH_EXPORT_ACTION, { seasonId: season.id }))) {
    return NextResponse.json({ error: 'The health answers didn’t export. Try again.' }, { status: 503 });
  }
  return NextResponse.json({ form: grid }, { headers: { 'Cache-Control': 'no-store' } });
}, { route: '/api/admin/house-league/seasons/[seasonId]/registrations/answers' });

/**
 * PUT { questionIds } — this person's answer columns (ruling 11: up to three, remembered per person). Only this form's
 * live, non-health questions are kept.
 */
export const PUT = withObservability(async (req: Request, { params }: Params) => {
  const { seasonId } = await params;
  const ctx = await getAuthContextWithRole({ orgSlug: new URL(req.url).searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'read');
  if (err || !ctx) return err ?? NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const season = await staffSeason(ctx.org.id, seasonId);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  // A write passes its season (Q16); reading answers stays open on a finished season, so this refuses nothing more today.
  const refused = houseLeagueRefusal(ctx, 'read', season);
  if (refused) return refused;
  const body = await req.json().catch(() => ({})) as { questionIds?: unknown };
  const wanted = Array.isArray(body.questionIds) ? body.questionIds.filter((x): x is string => typeof x === 'string' && isUuid(x)) : [];
  if (wanted.length > ANSWER_COLUMNS_MAX) return NextResponse.json({ error: `Up to ${ANSWER_COLUMNS_MAX} answer columns.` }, { status: 400 });
  const formId = await seasonFormId(season.id);
  if (!formId) return NextResponse.json({ error: 'This season has no sign-up form.' }, { status: 404 });
  const { data: qs, error } = await supabaseAdmin.from('club_form_questions').select('id')
    .eq('form_id', formId).eq('health', false).is('archived_at', null).in('id', wanted.length ? wanted : ['00000000-0000-0000-0000-000000000000']);
  if (error) throw error;
  const ok = new Set(((qs ?? []) as { id: string }[]).map(q => q.id));
  const ids = [...new Set(wanted)].filter(id => ok.has(id));
  await saveAnswerColumns(ctx.user.id, formId, ids);
  return NextResponse.json({ columns: ids });
}, { route: '/api/admin/house-league/seasons/[seasonId]/registrations/answers' });
