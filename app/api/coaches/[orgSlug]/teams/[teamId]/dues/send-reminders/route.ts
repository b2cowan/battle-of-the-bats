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
import { duesReminderEmail, GUARDIAN_FIRST_NAME_PLACEHOLDER } from '@/lib/dues-reminder-email';
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
//   playerId: string      — ONE family's "Remind this family" (owner ruling 2026-09-21): the
//                           on-demand email about THIS player's own next unpaid installment ONLY —
//                           never the team's 3-day window, never their season total, never a
//                           sibling's own bill. An explicit click means "tell them about their
//                           next bill", however far off it is.
//
// ⚠ ONE READ for the team-wide modes (window / bulk on-demand). The candidate query is seven round
// trips and a coverage pass over the whole roster; it runs ONCE with the courtesy carried as a
// FLAG, and every mode filters the flag in memory. The send path must never email a
// `recentlyReminded` row — that is the courtesy. `playerId` runs its OWN unbounded query instead
// (below) — folding it into the bounded team-wide read would silently reintroduce the window this
// button is meant to ignore.
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
  // A wave and a family are two different sends with two different rules (the wave honours the
  // team's toggle and its window; the family ignores both). No caller asks for both, and a body
  // that did would have to be answered by picking one silently — refuse instead (/review 2026-09-21).
  if (window !== undefined && playerId) {
    return NextResponse.json({ error: 'Send either an automatic wave or one family’s reminder, not both.' }, { status: 400 });
  }

  // ⚠ "REMIND THIS FAMILY", UNBOUNDED (owner ruling 2026-09-21). `daysAhead: null` means no
  // installment is excluded for being too far away — the ONLY filters left are "unpaid" and "this
  // player's". Sorted so the FIRST row is the next bill; a family behind on two installments still
  // gets ONE email, about the oldest one, never the total.
  if (playerId) {
    const mine = (await getDueReminderCandidates(teamId, null, undefined, { includeRecentlyReminded: true }))
      .filter(c => c.playerId === playerId)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.installmentNumber - b.installmentNumber);
    const next = mine[0] ?? null;

    // The reasons there is nothing to say, shared by preview and the real send so they can never
    // disagree about WHY: no unpaid installment at all, or held by the 7-day courtesy.
    if (!next) return NextResponse.json(preview ? { empty: true } : { remindersChecked: 0, emailsSent: 0, installmentsTagged: 0 });
    if (next.recentlyReminded) {
      return NextResponse.json(preview
        ? { empty: true, skippedRecent: true }
        : { remindersChecked: 1, emailsSent: 0, installmentsTagged: 0, skippedRecent: true });
    }

    if (preview) {
      // ⚠ NO ADDRESS IS NOT "NOTHING TO SHOW" (owner, 2026-09-21). A coach whose roster row has no
      // guardian email still wants to read what WOULD go once it does — so the letter renders
      // with a placeholder where the greeting would name the guardian, and the modal warns that it
      // cannot send until the Roster is updated. The real send below still refuses.
      // ⚠ THE SAME PLACEHOLDER IS THE PII WALL. A treasurer sends reminders on `money: write` with
      // NO roster-PII grant — the dues payload redacts the guardian's name and address from them,
      // and this preview must not hand those back through a different door. Without the grant the
      // greeting takes the placeholder and `to` is withheld; the real send, which shows them
      // nothing, still greets the real name. Player names are baseline and stay.
      const piiVisible = !!assignment.capabilities.rosterPii;
      const missingEmail = !next.guardianEmail;
      const guardianFirst = !piiVisible || (missingEmail && !next.guardianFirstName)
        ? GUARDIAN_FIRST_NAME_PLACEHOLDER
        : next.guardianFirstName ?? 'there';
      const { subject, html } = duesReminderEmail({
        teamName: team.name,
        orgName: ctx.org.name,
        window: null,
        guardianFirst,
        items: [next],
      });
      return NextResponse.json({
        subject,
        html,
        to: piiVisible ? next.guardianEmail : null,
        missingEmail,
        guardianHidden: !piiVisible,
      });
    }

    if (!next.guardianEmail) {
      return NextResponse.json({ remindersChecked: 1, emailsSent: 0, installmentsTagged: 0, missingEmail: true });
    }
    const { subject, html } = duesReminderEmail({
      teamName: team.name,
      orgName: ctx.org.name,
      window: null,
      guardianFirst: next.guardianFirstName ?? 'there',
      items: [next],
    });
    await sendEmail(next.guardianEmail, subject, html);
    await markInstallmentsReminderSent([next.installmentId]);
    return NextResponse.json({ remindersChecked: 1, emailsSent: 1, installmentsTagged: 1 });
  }

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

  // playerId is handled entirely above and always returns — nothing below runs for that mode.
  const candidates = reachable;
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
