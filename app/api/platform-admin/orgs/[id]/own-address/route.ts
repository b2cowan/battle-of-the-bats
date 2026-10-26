import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { clubDomainDeps } from '@/lib/club-domain-deps';
import { clubDomainStore } from '@/lib/club-domain-store';
import { stopClubDomain } from '@/lib/club-domain-service';
import { withObservability } from '@/lib/observability';

/**
 * POST /api/platform-admin/orgs/[id]/own-address { reason }: platform support RELEASES a club's own web address (Club Tier Stage 4e
 * close-out, owner ruling 2026-10-24): the host lets go of the name and the row goes, so the next club (or the same one) can connect
 * it. This is the same "take it away" as the owner's Stop, run for a club that will not or cannot press it, and always with a
 * reason on the audit log. The club's pages revert to the FieldLogicHQ address at once.
 */
export const POST = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('club_support');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { reason?: string };
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) return NextResponse.json({ error: 'Reason is required.' }, { status: 400 });

  const row = await clubDomainStore.getByOrg(id);
  if (!row) return NextResponse.json({ error: 'This club has no web address of its own.' }, { status: 404 });

  const stopped = await stopClubDomain(clubDomainDeps(), id);
  if (!stopped.ok) {
    return NextResponse.json({ error: 'The host could not be told to release the address. Nothing was changed; try again.' }, { status: 502 });
  }

  await writePlatformAuditLog(
    auth.user.email!,
    id,
    'release_club_web_address',
    'own_address',
    { address: row.full_name, status: row.status },
    null,
    { reason },
  );

  return NextResponse.json({ ok: true, released: row.full_name });
}, { route: '/api/platform-admin/orgs/[id]/own-address' });
