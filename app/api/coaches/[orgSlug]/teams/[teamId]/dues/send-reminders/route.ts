import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getRepTeam,
  getCoachingAssignmentsForUser,
  getActiveRepProgramYear,
  getDueReminderCandidates,
  markInstallmentsReminderSent,
  markInstallments30ReminderSent,
  markInstallments7ReminderSent,
} from '@/lib/db';
import type { RepDueReminderCandidate } from '@/lib/types';
import { sendEmail } from '@/lib/email';
import { duesReminderEmail } from '@/lib/dues-reminder-email';
import { DUE_REMINDER_DAYS_AHEAD } from '@/lib/dues-installment-view';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteMoney } from '@/lib/coach-capabilities';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

/** One family = one guardian email. A candidate with no email is its own (unreachable) family. */
function familiesOf(list: readonly RepDueReminderCandidate[]): Set<string> {
  return new Set(list.filter(c => c.guardianEmail).map(c => c.guardianEmail as string));
}

// POST /api/coaches/[orgSlug]/teams/[teamId]/dues/send-reminders
// Body (all optional):
//   window: 30 | 7        — an automatic wave (honours the team's toggle; forward-looking only)
//   preview: true         — ⚠ SENDS NOTHING, STAMPS NOTHING. Answers "who would this reach?" for
//                           the Send-due-reminders confirmation (owner D3, 2026-09-04): the same
//                           selection the send uses, so the button can never promise a different
//                           number than it delivers.
//   playerId: string      — ONE family (owner E4, 2026-09-04): the on-demand email, sent only to the
//                           guardian of this player, listing every qualifying installment of theirs
//                           (siblings on the same guardian email included — it is one letter to one
//                           household). The 7-day courtesy still applies; a suppressed family is
//                           reported as `skippedRecent` rather than re-dunned.
//
// ⚠ ONE READ. The candidate query is seven round trips and a coverage pass over the whole roster;
// it runs ONCE here with the courtesy carried as a FLAG, and every mode filters the flag in memory.
// The send path must never email a `recentlyReminded` row — that is the courtesy.
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const window: 30 | 7 | undefined = body.window === 30 ? 30 : body.window === 7 ? 7 : undefined;
  const preview = body.preview === true;
  const playerId: string | null = typeof body.playerId === 'string' && body.playerId ? body.playerId : null;

  // Automated reminder windows: respect coach toggle
  if (window !== undefined && !programYear.autoRemindersEnabled) {
    return NextResponse.json({ remindersChecked: 0, emailsSent: 0, installmentsTagged: 0, skipped: true });
  }

  const daysAhead = window === 30 ? 32 : window === 7 ? 9 : DUE_REMINDER_DAYS_AHEAD;
  const all = await getDueReminderCandidates(teamId, daysAhead, window, { includeRecentlyReminded: true });
  const reachable = all.filter(c => !c.recentlyReminded);

  if (preview) {
    // The families the courtesy is holding back this week: everyone who qualifies on the dates,
    // less everyone who qualifies today. Counted by household, the unit an email goes to.
    const reachableFamilies = familiesOf(reachable);
    const skippedRecent = [...familiesOf(all)].filter(e => !reachableFamilies.has(e)).length;
    const missingEmail = new Set(reachable.filter(c => !c.guardianEmail).map(c => c.playerId)).size;
    return NextResponse.json({
      preview: true,
      families: reachableFamilies.size,
      installments: reachable.filter(c => c.guardianEmail).length,
      skippedRecent,
      missingEmail,
    });
  }

  let candidates = reachable;
  if (playerId) {
    // The household this player belongs to, by guardian email — looked up in the unfiltered list so
    // a family the courtesy is holding back is recognised and REPORTED, not silently skipped.
    const own = all.find(c => c.playerId === playerId);
    if (!own) {
      return NextResponse.json({ remindersChecked: 0, emailsSent: 0, installmentsTagged: 0 });
    }
    if (!own.guardianEmail) {
      return NextResponse.json({ remindersChecked: 1, emailsSent: 0, installmentsTagged: 0, missingEmail: true });
    }
    const email = own.guardianEmail;
    candidates = reachable.filter(c => c.guardianEmail === email);
    if (!candidates.length) {
      return NextResponse.json({ remindersChecked: 1, emailsSent: 0, installmentsTagged: 0, skippedRecent: true });
    }
  }

  if (!candidates.length) {
    return NextResponse.json({ remindersChecked: 0, emailsSent: 0, installmentsTagged: 0 });
  }

  // Group by guardian email; skip candidates with no guardian email
  const byGuardian = new Map<string, typeof candidates>();
  for (const c of candidates) {
    if (!c.guardianEmail) continue;
    const list = byGuardian.get(c.guardianEmail) ?? [];
    list.push(c);
    byGuardian.set(c.guardianEmail, list);
  }

  let emailsSent = 0;
  const taggedIds: string[] = [];

  for (const [email, items] of byGuardian) {
    const first = items[0];
    const guardianFirst = first.guardianFirstName ?? 'there';

    // ONE template (lib/dues-reminder-email.ts) — shared with the sweep, the org-admin route,
    // and the on-screen "See what they'll receive" preview, so the sample a coach reads is the send.
    const { subject, html } = duesReminderEmail({
      teamName: team.name,
      orgName: ctx.org.name,
      window: window ?? null,
      guardianFirst,
      items,
    });

    await sendEmail(email, subject, html);
    emailsSent++;
    for (const i of items) taggedIds.push(i.installmentId);
  }

  if (taggedIds.length) {
    if (window === 30) {
      await markInstallments30ReminderSent(taggedIds);
    } else if (window === 7) {
      await markInstallments7ReminderSent(taggedIds);
    } else {
      await markInstallmentsReminderSent(taggedIds);
    }
  }

  return NextResponse.json({
    remindersChecked: candidates.length,
    emailsSent,
    installmentsTagged: taggedIds.length,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/dues/send-reminders' });
