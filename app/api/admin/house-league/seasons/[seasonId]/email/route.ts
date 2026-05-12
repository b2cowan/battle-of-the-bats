import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getLeagueSeasonById, getRegistrationsForSeason, insertLeagueEmailLog, getLeagueEmailLog } from '@/lib/db';
import { sendEmail, leagueBroadcastHtml, ADMIN_EMAIL } from '@/lib/email';
import type { LeagueRegistrationStatus } from '@/lib/types';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_house_league')) return forbidden();
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ seasonId: string }> },
) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;
  if (ctx!.role !== 'owner' && ctx!.role !== 'league_admin') return forbidden();

  const { seasonId } = await params;
  try {
    const log = await getLeagueEmailLog(seasonId);
    return NextResponse.json({ log });
  } catch {
    return NextResponse.json({ log: [] });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ seasonId: string }> },
) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'league_admin') return forbidden();

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const body = await req.json();
  const { subject, message, scope, divisionId, teamId, status } = body as {
    subject: string;
    message: string;
    scope: 'all' | 'division' | 'team' | 'status';
    divisionId?: string;
    teamId?: string;
    status?: LeagueRegistrationStatus;
  };

  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'subject and message are required' }, { status: 400 });
  }
  if (!['all', 'division', 'team', 'status'].includes(scope)) {
    return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
  }

  const allRegs = await getRegistrationsForSeason(seasonId);

  let targets = allRegs;
  switch (scope) {
    case 'all':
      targets = allRegs.filter(r => r.status === 'active');
      break;
    case 'division':
      if (!divisionId) return NextResponse.json({ error: 'divisionId required for division scope' }, { status: 400 });
      targets = allRegs.filter(r => r.divisionId === divisionId && r.status === 'active');
      break;
    case 'team':
      if (!teamId) return NextResponse.json({ error: 'teamId required for team scope' }, { status: 400 });
      targets = allRegs.filter(r => r.teamId === teamId);
      break;
    case 'status':
      if (!status) return NextResponse.json({ error: 'status required for status scope' }, { status: 400 });
      targets = allRegs.filter(r => r.status === status);
      break;
  }

  if (targets.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0 });
  }

  const orgName      = ctx!.org.name;
  const contactEmail = ADMIN_EMAIL;

  let sent = 0;
  let skipped = 0;

  for (const reg of targets) {
    if (!reg.guardianEmail) { skipped++; continue; }
    const html = leagueBroadcastHtml({
      orgName,
      seasonName: season.name,
      subject: subject.trim(),
      message: message.trim(),
      contactEmail,
    });
    try {
      await sendEmail(reg.guardianEmail, subject.trim(), html);
      sent++;
    } catch {
      skipped++;
    }
  }

  console.log(`[email] League broadcast: season=${seasonId} scope=${scope} sent=${sent} skipped=${skipped}`);

  const audienceLabel =
    scope === 'all'    ? 'All active registrants' :
    status === 'waitlisted'    ? 'Waitlist' :
    status === 'pending_review' ? 'Pending review' :
    scope;

  try {
    await insertLeagueEmailLog({
      orgId:        ctx!.org.id,
      seasonId,
      sentBy:       ctx!.user.id,
      subject:      subject.trim(),
      scope,
      audience:     audienceLabel,
      countSent:    sent,
      countSkipped: skipped,
    });
  } catch (e) {
    console.error('[email] Failed to write email log:', e);
  }

  return NextResponse.json({ sent, skipped });
}
