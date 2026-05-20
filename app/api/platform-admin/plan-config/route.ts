import { getPlatformAuthContext } from '@/lib/platform-auth';
import { getAllPlanConfigOverrideRows, upsertPlanConfigOverride } from '@/lib/plan-config-db';

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_PLANS = ['tournament', 'tournament_plus', 'league', 'club'];

export async function GET() {
  const user = await getPlatformAuthContext();
  if (!user) return unauthorized();

  const rows = await getAllPlanConfigOverrideRows();
  return Response.json(rows);
}

export async function PATCH(req: Request) {
  const user = await getPlatformAuthContext();
  if (!user) return unauthorized();

  const body = await req.json() as {
    plan_id: string;
    tournament_limit?: number | null;
    seat_limit?: number | null;
    trial_days?: number | null;
  };

  const { plan_id, tournament_limit, seat_limit, trial_days } = body;

  if (!plan_id) return badRequest('Missing plan_id');
  if (!VALID_PLANS.includes(plan_id)) return badRequest('Invalid plan_id');

  // Validate each numeric field: must be null, undefined, or a non-negative integer
  const numericFields = [
    ['tournament_limit', tournament_limit],
    ['seat_limit',       seat_limit],
    ['trial_days',       trial_days],
  ] as [string, unknown][];

  for (const [key, val] of numericFields) {
    if (val !== null && val !== undefined) {
      if (!Number.isInteger(val) || (val as number) < 0) {
        return badRequest(`${key} must be a non-negative integer or null`);
      }
    }
  }

  try {
    await upsertPlanConfigOverride(
      plan_id,
      { tournament_limit, seat_limit, trial_days },
      user.email,
    );
    return Response.json({ ok: true });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}