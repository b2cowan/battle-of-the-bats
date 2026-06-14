import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

type StartupTaskId =
  | 'plan'
  | 'tournament'
  | 'divisions'
  | 'welcome'
  | 'venues'
  | 'contacts'
  | 'league_season'
  | 'league_divisions'
  | 'league_registration'
  | 'league_tournament';
type StartupTaskStatus = 'pending' | 'complete' | 'skipped';
type StoredStartupTasks = Partial<Record<StartupTaskId, { status: Exclude<StartupTaskStatus, 'pending'>; updatedAt: string }>>;
type StoredStartupRead = {
  tasks: StoredStartupTasks;
  storageAvailable: boolean;
};

const TASK_IDS: StartupTaskId[] = [
  'plan',
  'tournament',
  'divisions',
  'welcome',
  'venues',
  'contacts',
  'league_season',
  'league_divisions',
  'league_registration',
  'league_tournament',
];

function isStartupTaskId(value: unknown): value is StartupTaskId {
  return typeof value === 'string' && TASK_IDS.includes(value as StartupTaskId);
}

function parseStoredTasks(value: unknown): StoredStartupTasks {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, { status?: unknown; updatedAt?: unknown }>)
    .filter(([key, item]) => isStartupTaskId(key) && (item.status === 'complete' || item.status === 'skipped'))
    .map(([key, item]) => [
      key,
      {
        status: item.status as Exclude<StartupTaskStatus, 'pending'>,
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
      },
    ]);
  return Object.fromEntries(entries) as StoredStartupTasks;
}

function isMissingStartupTasksColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message ?? '';
  return error.code === '42703' || error.code === 'PGRST204' || message.includes('startup_tasks');
}

async function readStoredTasks(orgId: string): Promise<StoredStartupRead> {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('startup_tasks')
    .eq('id', orgId)
    .single();

  if (isMissingStartupTasksColumn(error)) {
    return { tasks: {}, storageAvailable: false };
  }
  if (error) throw error;
  return { tasks: parseStoredTasks(data?.startup_tasks), storageAvailable: true };
}

async function buildProgress(
  orgId: string,
  storedOverride?: StoredStartupTasks,
  storageAvailableOverride?: boolean
) {
  const storedState = storedOverride
    ? { tasks: storedOverride, storageAvailable: storageAvailableOverride ?? true }
    : await readStoredTasks(orgId);
  const stored = storedState.tasks;

  const { data: tournaments, error: tournamentError } = await supabaseAdmin
    .from('tournaments')
    .select('id, year, name, slug, status, start_date, end_date, contact_email')
    .eq('org_id', orgId)
    .neq('status', 'archived')
    .order('year', { ascending: false });

  if (tournamentError) throw tournamentError;

  const { data: leagueSeasons, error: leagueSeasonError } = await supabaseAdmin
    .from('league_seasons')
    .select('id')
    .eq('org_id', orgId)
    .neq('status', 'archived')
    .limit(1);

  if (leagueSeasonError) throw leagueSeasonError;

  const firstTournament = tournaments?.[0] ?? null;
  const firstLeagueSeason = leagueSeasons?.[0] ?? null;
  const wizardAvailable = !firstTournament;

  const dataComplete: Record<StartupTaskId, boolean> = {
    plan: true,
    tournament: !!firstTournament,
    divisions: false,
    welcome: false,
    venues: false,
    contacts: false,
    league_season: !!firstLeagueSeason,
    league_divisions: false,
    league_registration: false,
    league_tournament: !!firstTournament,
  };

  const tasks = TASK_IDS.reduce<Record<StartupTaskId, StartupTaskStatus>>((acc, taskId) => {
    if (dataComplete[taskId] || stored[taskId]?.status === 'complete') {
      acc[taskId] = 'complete';
    } else if (stored[taskId]?.status === 'skipped') {
      acc[taskId] = 'skipped';
    } else {
      acc[taskId] = 'pending';
    }
    return acc;
  }, {} as Record<StartupTaskId, StartupTaskStatus>);

  const completeCount = TASK_IDS.filter(taskId => tasks[taskId] === 'complete').length;
  const finishedCount = TASK_IDS.filter(taskId => tasks[taskId] !== 'pending').length;

  return {
    tasks,
    totalCount: TASK_IDS.length,
    completeCount,
    finishedCount,
    allFinished: completeCount === TASK_IDS.length,
    wizardAvailable,
    storageAvailable: storedState.storageAvailable,
    firstTournament: firstTournament
      ? {
          id: firstTournament.id,
          name: firstTournament.name,
          slug: firstTournament.slug,
          year: firstTournament.year,
          status: firstTournament.status,
          startDate: firstTournament.start_date,
          endDate: firstTournament.end_date,
          contactEmail: firstTournament.contact_email,
        }
      : null,
  };
}

export const GET = withObservability(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const orgSlug = searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

  try {
    return NextResponse.json(await buildProgress(ctx.org.id));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to load startup progress';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}, { route: '/api/admin/org/startup-tasks' });

export const POST = withObservability(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const orgSlug = searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

  try {
    const body = await req.json().catch(() => null);
    const taskId = body?.taskId;
    const status = body?.status;

    if (!isStartupTaskId(taskId) || (status !== 'complete' && status !== 'skipped')) {
      return NextResponse.json({ error: 'Invalid startup task update.' }, { status: 400 });
    }

    const storedState = await readStoredTasks(ctx.org.id);
    const next = {
      ...storedState.tasks,
      [taskId]: { status, updatedAt: new Date().toISOString() },
    };

    if (!storedState.storageAvailable) {
      return NextResponse.json(await buildProgress(ctx.org.id, next, false));
    }

    const { error } = await supabaseAdmin
      .from('organizations')
      .update({ startup_tasks: next })
      .eq('id', ctx.org.id);

    if (isMissingStartupTasksColumn(error)) {
      return NextResponse.json(await buildProgress(ctx.org.id, next, false));
    }
    if (error) throw error;

    return NextResponse.json(await buildProgress(ctx.org.id));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to update startup progress';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}, { route: '/api/admin/org/startup-tasks' });
