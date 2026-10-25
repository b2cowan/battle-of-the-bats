import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById, getRegistrationsForSeason, insertLeagueEmailLog, getLeagueEmailLog } from '@/lib/db';
import { sendFamilyEmail, getFamilySuppressionList } from '@/lib/family-email';
import { clubEmailFacts } from '@/lib/club-email-context';
import { familyReplyPlan } from '@/lib/email-club-identity';
import { senderName } from '@/lib/families-coach-ask';
import type { LeagueRegistrationStatus } from '@/lib/types';
import { withObservability } from '@/lib/observability';

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const orgSlug = new URL(_req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  // The sent log lists families' messages: read by the people who email them, not by every reader of the season.
  const err = houseLeagueRefusal(ctx, 'email');
  if (err) return err;

  const { seasonId } = await params;
  // Ownership: the log is read by season id alone — the season must be this org's.
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  try {
    const log = await getLeagueEmailLog(seasonId);
    return NextResponse.json({ log });
  } catch {
    return NextResponse.json({ log: [] });
  }
}, { route: '/api/admin/house-league/seasons/[seasonId]/email' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'email');
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'email', season);
  if (refused) return refused;

  const body = await req.json();
  const { subject, message, scope, divisionId, teamId, status, registrationIds } = body as {
    subject: string;
    message: string;
    scope: 'all' | 'division' | 'team' | 'status' | 'selected';
    divisionId?: string;
    teamId?: string;
    status?: LeagueRegistrationStatus;
    /** 'selected' (9b-2's bulk Email): the ticked registrations — only this season's are ever reached. */
    registrationIds?: unknown;
  };

  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'subject and message are required' }, { status: 400 });
  }
  if (!['all', 'division', 'team', 'status', 'selected'].includes(scope)) {
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
    case 'selected': {
      // Read against THIS season's registrations, so an id from anywhere else simply matches nothing. Two children of
      // one family are one email.
      const ids = new Set(Array.isArray(registrationIds) ? registrationIds.filter((x): x is string => typeof x === 'string') : []);
      if (ids.size === 0) return NextResponse.json({ error: 'registrationIds required for selected scope' }, { status: 400 });
      const seen = new Set<string>();
      targets = allRegs.filter(r => {
        if (!ids.has(r.id)) return false;
        const key = r.guardianEmail?.trim().toLowerCase();
        if (key && seen.has(key)) return false;
        if (key) seen.add(key);
        return true;
      });
      break;
    }
  }

  if (targets.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0 });
  }

  // ⚠ This is a BULK ANNOUNCEMENT to families, so it goes through the one guarded family
  // sender (2026-08-18) — it used to call `sendEmail` directly, which meant it honoured no
  // unsubscribe and carried no way to ask for one. The suppression list is fetched once and
  // shared; it already covers addresses a parent has left behind, so an opt-out filed years
  // ago under a former address silences this season's broadcast too.
  const suppressedList = await getFamilySuppressionList(ctx!.org.id);
  // The club's face and where a reply goes (S3b): the admin who wrote it. Read once for the whole season send.
  const [club, sender] = await Promise.all([clubEmailFacts(ctx!.org), senderName(ctx!).catch(() => null)]);
  const reply = familyReplyPlan({ kind: 'person', clubName: ctx!.org.name, senderEmail: ctx!.user.email, senderName: sender });

  let sent = 0;
  let skipped = 0;
  let suppressed = 0;

  for (const reg of targets) {
    // Trimmed, not just truthy: the guarded sender reports a blank-after-trim address as
    // 'suppressed', which would file "   " under "opted out" — the exact bucket this route
    // just went to the trouble of separating from "no email on file".
    if (!reg.guardianEmail?.trim()) { skipped++; continue; }
    try {
      const result = await sendFamilyEmail({
        orgId: ctx!.org.id,
        to: reg.guardianEmail,
        subject: subject.trim(),
        suppressed: suppressedList,
        content: {
          teamName: season.name,
          orgName: ctx!.org.name,
          title: subject.trim(),
          body: message.trim(),
          reason: `you have a registration in ${season.name}`,
          club,
          replyLine: reply.line,
        },
        replyTo: reply.replyTo,
      });
      if (result.status === 'sent') sent++;
      // Counted apart from `skipped`, which means "we could not send". A suppressed
      // recipient is a family we chose not to mail, and the log should not blur the two.
      else if (result.status === 'suppressed') suppressed++;
      else skipped++;
    } catch {
      skipped++;
    }
  }

  console.log(`[email] League broadcast: season=${seasonId} scope=${scope} sent=${sent} skipped=${skipped} suppressed=${suppressed}`);

  const audienceLabel =
    scope === 'all'    ? 'All active registrants' :
    scope === 'selected' ? `${targets.length === 1 ? '1 family' : `${targets.length} families`} picked on Registrations` :
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
      // The stored log has two columns and now three outcomes, so "not delivered" is one
      // number here. The live response below keeps them apart — an admin deciding whether to
      // phone anyone wants "3 opted out" and "3 had no email on file" to read differently.
      countSkipped: skipped + suppressed,
    });
  } catch (e) {
    console.error('[email] Failed to write email log:', e);
  }

  return NextResponse.json({ sent, skipped, suppressed });
}, { route: '/api/admin/house-league/seasons/[seasonId]/email' });
