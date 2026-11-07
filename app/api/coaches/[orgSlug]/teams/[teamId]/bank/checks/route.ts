import { withObservability } from '@/lib/observability';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { denyUnless, canWriteMoney } from '@/lib/coach-capabilities';
import { bankBody } from '@/lib/bank-club-steps';
import { saveTeamCheck, teamBankAnswer, teamBankCaller } from '@/lib/bank-coach-steps';

type Params = { params: Promise<{ orgSlug: string; teamId: string }> };

/**
 * POST { date, bankCents, cashCents?, waiting?: [lineKey…] } — save a check of the team's bank on its LIVE season (BC6b;
 * ruling 3: it saves whether it matches or reads "Off by $X"). The first save makes the team's account ("Team bank
 * account", no setup question). The server figures Your books on D from the season's register and reads each Not in the
 * bank yet line itself (rule 6). Money write only; no live season, refused (the season gate is the server's, CLAUDE.md).
 * Answers with the team's bank read again (201). No year: see the GET's header for the one read back (Q1).
 */
export const POST = withObservability(async (req: Request, { params }: Params) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const denied = denyUnless(canWriteMoney(resolved.assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;
  const caller = teamBankCaller(resolved);
  return teamBankAnswer(caller, await saveTeamCheck(caller, await bankBody(req)), 201);
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/bank/checks' });
