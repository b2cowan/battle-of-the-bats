import { getAuthContextWithRole, forbidden, unauthorized } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { readClubFees } from '@/lib/platform-stripe-fees';
import { effectiveOrgFactsForId } from '@/lib/entitlement-grants';
import { workspaceHoldsFoundingComp } from '@/lib/founding-season';

/**
 * GET /api/billing/stripe-fees — the Stripe fees a club's online payments caused, for Settings › Plan & billing (Club Tier
 * Stage 12d-1 Part 4, ruling 4: what, when, billed / unpaid, Pay the invoice). Owner-only, like the page.
 *
 *   fees      — newest first, at most 50; 12c's rows that were never billed (comped, before the owner's 2026-10-26 ruling)
 *               are left out, since nothing was ever owed on them. The stored billing error never leaves the platform.
 *   planFree  — the club pays nothing for its plan (free time running, or the Founding comp): its lines add "Your plan
 *               doesn't change", so a fee is never read as the comp being withdrawn (words §3.4).
 */
export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  // Off the billing rail (owner ruling 2, 2026-10-27): a cancelled club is still billed its Stripe fees and emailed its own
  // invoice, so it reads the list that explains them on the one page it can reach. A read, owner-only, nothing else opens.
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true, allowSuspendedOrg: true });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();

  const [fees, facts, founding] = await Promise.all([
    readClubFees(ctx.org.id),
    effectiveOrgFactsForId(ctx.org.id).catch(() => null),
    workspaceHoldsFoundingComp(ctx.org.id).catch(() => false),
  ]);
  return Response.json({
    fees: fees.filter(f => f.state !== 'legacy_exempt').map(({ billError: _hidden, ...f }) => f),
    planFree: !!facts?.freeTime || founding,
  });
}, { route: '/api/billing/stripe-fees' });
