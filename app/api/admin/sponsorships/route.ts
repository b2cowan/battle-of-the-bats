import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { requireSponsorships } from '@/lib/club-sponsorships-auth';
import { readPackages, readPlaceTargets, readSettings, readSponsors } from '@/lib/club-sponsorships-server';
import { sponsorshipFormQuestionCount } from '@/lib/club-form-server';
import { NOTHING_TAKEN } from '@/lib/club-sponsorships';
import { tournamentToday } from '@/lib/timezone';

/**
 * THE SPONSORSHIPS PLACE'S ONE READ (Board Ready Stage 6, Part 1): the packages with what has taken them, the sponsors
 * with their places, the names of every place, the invoice details, and how far the three steps are. Anyone who opens
 * Sponsorships reads all of it (round 2 tab 3); `changesInvoice` says whether this reader may change Invoice details.
 * Part 1 has no deals yet, so nothing has taken a package (Part 2 counts paid, invoiced and offered deals, ask 7).
 */
export const dynamic = 'force-dynamic';

export const GET = withObservability(async (req: Request) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const orgId = gate.ctx.org.id;
  const [packages, sponsors, settings, targets, formQuestions] = await Promise.all([
    readPackages(orgId), readSponsors(orgId), readSettings(orgId), readPlaceTargets(orgId), sponsorshipFormQuestionCount(orgId),
  ]);
  return NextResponse.json({
    packages: packages.map(p => ({ ...p, taken: NOTHING_TAKEN, takenBy: [] })),
    sponsors,
    settings,
    targets,
    formQuestions,
    changesInvoice: gate.changesInvoice,
    today: tournamentToday(new Date()),
  });
}, { route: '/api/admin/sponsorships' });
