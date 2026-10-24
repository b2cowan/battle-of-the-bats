import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { isCronRequest } from '@/lib/cron-auth';
import { runClubDomainTick } from '@/lib/club-domain-tick';
import { clubDomainTickDeps } from '@/lib/club-domain-tick-deps';

/**
 * Clubs' own web addresses: the status check (Club Tier Stage 4e, Part 6). Walks every connection and looks at what is due:
 * a waiting one every wake (is the host live? are the records in? two days with nothing -> it gives up), a live one's record 2
 * every hour and the rest once a day, a broken one every wake so a fix clears itself. Moves a connection between connected /
 * needs attention / not working / not connected, and emails the OWNER (never an admin) once per stretch. READS ONLY against
 * AWS and DNS. The full rules are lib/club-domain-tick.ts.
 *
 * Callers: the pg_cron scheduler every 15 minutes via x-cron-secret, or a super-admin by hand. A wake that finds nothing due costs
 * one read of the (tiny) table and writes nothing; it leaves an audit row only when something changed.
 */
export const maxDuration = 300;

export const POST = withObservability(async (req: Request) => {
  const machine = isCronRequest(req);
  let actor = 'cron-scheduler';
  if (!machine) {
    const auth = await requireSuperAdmin();
    if (auth.response) return auth.response;
    actor = auth.user.email ?? 'platform-admin';
  }

  const summary = await runClubDomainTick(clubDomainTickDeps());

  if (summary.changed > 0 || summary.failed > 0 || Object.keys(summary.emailed).length > 0) {
    await writePlatformAuditLog(actor, null, 'club_domains_tick', 'result', null, summary);
  }
  return NextResponse.json(summary);
}, { route: '/api/platform-admin/club-domains-tick' });
