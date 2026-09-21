import { NextResponse } from 'next/server';
import { captureError, withObservability } from '@/lib/observability';
import { resolvePracticePlanRouteContext } from '@/lib/practice-plan-route-context';
import { denyUnless, canWritePracticePlans } from '@/lib/coach-capabilities';
import { getRepRosterPlayers, getRepTeamTagLibrary, stampRepTeamEventPracticePlanSent } from '@/lib/db';
import { isDemoOrgId } from '@/lib/demo-org-server';
import { getPracticeStaffPeople } from '@/lib/practice-plan-staff';
import {
  mineTagIdsOf, myLabelsOnPlan, practiceDayLabel, practicePlanRecipients, practicePlanSentMessage, sanitizeAudience,
  sanitizeChosenUserIds,
} from '@/lib/practice-plan-send';
import { practicePlanEmail, type PracticePlanEmailBlock } from '@/lib/practice-plan-email';
import { notify } from '@/lib/notify';
import { sendEmail } from '@/lib/email';
import { formatInOrgZone } from '@/lib/timezone';
import { formatStoredClock } from '@/lib/utils';
import {
  blockOwnPeople, computeBlockClocks, namesWholeTeam, practicePlanLevels, resolvePracticePlanTagNames, soleStationOf,
} from '@/lib/rep-practice-plan';
import { practiceLengthMinutes } from '@/lib/practice-state';

/**
 * "Send to staff" (COACH_PRACTICE_WHO_RUNS_IT_PLAN.md §5.3; owner rulings A–K, 2026-09-17).
 *
 * The plan autosaves and has no "done" (F04), so this is the explicit act: the coach chooses WHO
 * (`audience` — three groups, or 'chosen' with the ticked `userIds`, owner ask 2026-09-20: one
 * assistant reads it over before the group gets it) and whether their own EMAIL goes with the
 * bell and push (`email`). The recipients are decided by `practicePlanRecipients` — the same pure
 * rule the sheet previewed, so the number the coach read is the number that goes; a ticked id
 * that is the sender, off the staff or without schedule access simply does not go — then ONE
 * dispatch per person, because the body names THEIR stations ("You're on Close control and
 * Footwork ladder"). The practice is stamped with the last send and who it reached (mig 303 ·
 * 305) and the stamp comes back for the toolbar.
 *
 * ⚠ THE BELL AND PUSH honour each person's notification settings and the master pause, as every
 * dispatch does. THE EMAIL DOES NOT (ruling J): it is the coach's own act — a colleague addressing
 * colleagues about tonight — on the ground a dues reminder (transactional, 2026-08-18) and an
 * @mention (pierces the pause) already stand on. It goes through the plain sender, never
 * `notify()`'s pref-gated channel and never the family door; the email names the coach and its
 * footer says why it arrived. `lib/family-email.ts`'s audit of who is outside its door lists this.
 *
 * ⚠ Writes ONE event id and reads no year — not a `HISTORY_ENDPOINTS` entry. Demo orgs are
 * silenced inside `notify()` (fail-closed) and the proxy's write block stops this route on the
 * sandbox anyway; the email is guarded below by the same demo check so a sandbox can never mail.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },) => {
  const { orgSlug, teamId, eventId } = await params;
  const resolved = await resolvePracticePlanRouteContext(orgSlug, teamId, eventId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear, event } = resolved;

  const denied = denyUnless(canWritePracticePlans(assignment.capabilities), 'Sending the plan needs Schedule: View + edit. Ask your head coach.');
  if (denied) return denied;

  const body = await req.json().catch(() => ({})) as { audience?: unknown; email?: unknown; userIds?: unknown };
  const audience = sanitizeAudience(body.audience);
  if (!audience) return NextResponse.json({ error: 'Choose who to send it to.' }, { status: 400 });
  const chosenUserIds = audience === 'chosen' ? sanitizeChosenUserIds(body.userIds) : [];
  if (audience === 'chosen' && chosenUserIds.length === 0) {
    return NextResponse.json({ error: 'Choose at least one person to send it to.' }, { status: 400 });
  }
  const withEmail = body.email === true;

  const plan = event.practicePlan;
  if (!plan || plan.blocks.length === 0) {
    return NextResponse.json({ error: 'There’s nothing to send yet — add a block first.' }, { status: 400 });
  }

  const [staffTags, roster] = await Promise.all([
    getRepTeamTagLibrary(teamId, 'staff', ctx.org.id),
    getRepRosterPlayers(programYear.id),
  ]);
  const people = await getPracticeStaffPeople(teamId, ctx.org.id, staffTags);
  const { recipients } = practicePlanRecipients(people, audience, { senderUserId: ctx.user.id, plan, staffTags, chosenUserIds });
  if (recipients.length === 0) {
    return NextResponse.json({
      error: audience === 'chosen'
        ? 'Nobody to send to — none of the people you chose can open the plan.'
        : 'Nobody to send to — that audience has no one who can open the plan.',
    }, { status: 400 });
  }

  // ── The message's fixed parts, once — the org's clock, the house spelling ("6:00 p.m.") ──
  const nowMs = Date.now();
  const dayLabel = practiceDayLabel(event.startsAt, nowMs, {
    weekday: iso => formatInOrgZone(iso, { weekday: 'long' }),
    shortDate: iso => formatInOrgZone(iso, { month: 'short', day: 'numeric' }),
  });
  const time = (iso: string) => formatInOrgZone(iso, { hour: 'numeric', minute: '2-digit', hour12: true });
  const startLabel = time(event.startsAt);
  const arriveLabel = event.arrivalTime ? formatStoredClock(event.arrivalTime) : null;
  const length = practiceLengthMinutes(event.startsAt, event.endsAt);
  const whenLine = `${formatInOrgZone(event.startsAt, { weekday: 'long', month: 'long', day: 'numeric' })} · ${startLabel}${event.endsAt && length != null ? `–${time(event.endsAt)}` : ''}`;
  const whereLine = event.location?.trim() ?? '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const planPath = `/${orgSlug}/coaches/teams/${teamId}/practice/${eventId}`;
  const coachName = people.find(p => p.userId === ctx.user.id)?.name ?? 'Your coach';

  // The email's outline (ruling K), built ONCE: names resolved, the one clock walk, the staff line
  // per level. Only the "mine" flags are the recipient's — overlaid per person below.
  const resolvedLevels = practicePlanLevels(resolvePracticePlanTagNames(plan, staffTags, []), new Set());
  const clocks = computeBlockClocks(plan.blocks, event.startsAt, event.endsAt);
  const rosterIds = roster.filter(p => p.status === 'active').map(p => p.id);
  const outline: PracticePlanEmailBlock[] = resolvedLevels.map(l => {
    const sole = soleStationOf(l.block);
    const staff = [...new Set([...(l.block.staff ?? []), ...(sole?.staff ?? [])])];
    // The one rule for whose people these are (stage 5, P5) — "Whole team" is a set comparison.
    const own = blockOwnPeople(l.block);
    const whole = own !== undefined && namesWholeTeam(own, rosterIds);
    return {
      time: clocks[l.index]?.startLabel ?? '',
      title: l.title,
      staffLine: [staff.join(' · '), whole ? 'Whole team' : ''].filter(Boolean).join(' · '),
      mine: false,
      stations: l.stations.map(s => ({ name: s.label, staffLine: (s.station.staff ?? []).join(' · '), mine: false })),
    };
  });
  const outlineFor = (mineTagIds: ReadonlySet<string>): PracticePlanEmailBlock[] => {
    // The walk already folds the sole station into its block (one station IS the block).
    const mine = practicePlanLevels(plan, mineTagIds);
    return outline.map((b, i) => ({
      ...b,
      mine: mine[i].mine,
      stations: b.stations.map((s, si) => ({ ...s, mine: mine[i].stations[si]?.mine === true })),
    }));
  };
  // A sandbox can never mail anyone — the same fail-closed answer `notify()` gives itself.
  const demo = await isDemoOrgId(ctx.org.id).catch(() => true);

  // ── One dispatch per person, the body theirs — the people are independent, so in parallel ──
  const results = await Promise.all(recipients.map(async r => {
    const mineTagIds = mineTagIdsOf(r);
    const myLabels = myLabelsOnPlan(plan, mineTagIds);
    const { title, body: text } = practicePlanSentMessage({ dayLabel, startLabel, arriveLabel, myLabels });
    await notify({
      orgId: ctx.org.id,
      eventType: 'practice_plan_sent',
      title,
      body: text,
      link: planPath,
      userIds: [r.userId],
      metadata: { teamId, eventId, audience, sentBy: ctx.user.id },
    });
    if (!withEmail || !r.email || demo) return false;
    const { subject, html } = practicePlanEmail({
      coachName, teamName: team.name, whenLine, whereLine, arriveLabel, myLabels, dayLabel,
      outline: outlineFor(mineTagIds), planUrl: `${appUrl}${planPath}`,
    });
    try {
      return (await sendEmail(r.email, subject, html)).status === 'sent';
    } catch (e) {
      // Best-effort per person, like every other mail here — the bell and push already went.
      console.error('[practice-plan/send] email failed:', e instanceof Error ? e.message : e);
      return false;
    }
  }));
  const emailed = results.filter(Boolean).length;

  // The stamp, AFTER the dispatch — and never a 500 over a send that went: a bell that has landed
  // cannot be unsent, and a 500 here would invite the coach to press again and double it. A stamp
  // that fails is reported (observability) and the toolbar simply shows no sent line this time.
  // `email` records that mail WENT (to at least one) — the tick alone is remembered by the sheet.
  let stamped = null;
  try {
    stamped = await stampRepTeamEventPracticePlanSent(eventId, teamId, programYear.id, {
      by: ctx.user.id, audience, count: recipients.length, email: emailed > 0, to: recipients.map(r => r.userId),
    });
    if (!stamped) throw new Error('practice not found for the sent stamp');
  } catch (e) {
    await captureError(e instanceof Error ? e : new Error(String(e)), {
      route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/practice-plan/send',
      severity: 'warning',
      title: 'Practice plan sent, but the sent stamp did not write',
      org: { id: ctx.org.id },
      requestContext: { teamId, eventId, audience, count: recipients.length, emailed },
    });
  }

  return NextResponse.json({
    sent: stamped?.practicePlanSent ?? null,
    count: recipients.length,
    emailed,
    names: recipients.map(r => r.name),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/practice-plan/send' });
