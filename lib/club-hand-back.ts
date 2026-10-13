import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll, fetchAllIn } from './supabase-paging';
import { resolvePersonNamer } from './db';
import { listActiveStaffForTeams } from './coach-membership';
import { notify } from './notify';
import { canMoveClubMoney } from './member-access';
import { canOpenClubSchedules, isScheduleBuilder } from './club-schedule-gate';
import { clubAccountingUserIds, clubMoneyLinks, tellTeamMoneyPeople } from './club-money-notify';
import { refused, type Moved } from './club-money-route';
import { isClosedYearError } from './club-fiscal-year-server';
import { previewCredit, schedulePoolInstallments } from './club-money-reads';
import { clubBillFigures, clubInstallmentDue } from './club-money-figures';
import { toCents } from './coach-register';
import { tournamentToday, utcToZonedInputs } from './timezone';
import { readClubPlaces } from './permit-lookup';
import { placeWords } from './club-schedule-words';
import { HAND_BACK_WORDS as W, namePractices, type CreditMove, type PracticesNamed } from './club-hand-back-words';
import { askSummaries, commonWeekday, eachCents, type AskSummary } from './club-hand-back-reads';
import {
  practiceFigures, practiceSeries, readHandBackScope, scopePractices, type HandBackScope, type HandBackSlot, type PracticeSeries,
} from './club-schedule-coach';
import type { ScheduleRow } from './club-schedule-server';
import type { AuthContextWithRole } from './api-auth';
import type { NotificationEventType, Organization, OrgRole, RepTeamEvent } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A HAND-BACK THAT ASKS FOR MONEY BACK (Club Tier Stage 11d, part A — hub K4MPu4ni53Ct7yrDcmWJd9 → Stage 11d; Asks
 * 1–9 ratified 2026-10-12; plan CLUB_PERMITS_AND_SCHEDULER_PLAN.md §6d). Server-only. The owner, from walk §300 W10:
 * "the club confirms the hand back, thus opening the time slot and also making a 'payment request' … if the money is
 * still owing from the team the amount they owe just goes down".
 *
 *   · THE OFFER (Ask 1) — Hand back's tick: each scope's figure (the practices at what the club billed for each, never
 *     more than the team can still ask back), shown only when the club billed the team for the schedule's time and the
 *     coach can use the team's money (the route decides that).
 *   · THE ASK (Asks 2, 4) — nothing handed back yet: the ask and its request in one step (`club_hand_back_ask`), the
 *     builders and the money movers told, each opened where they can answer (D5, read for who can open what).
 *   · WITHDRAW (Ask 3) — the coach's, while nobody has answered: the ask and its request go together.
 *   · THE ANSWER (Asks 3, 5, 6) — one window from every door: the Sundays still to come, who asked, the figure and how,
 *     the team's bill, ONE statement of what Accept does (`previewCredit` — the step writes the same application), the
 *     open time's cost. Accept is one step; Decline keeps the Sundays the team's with a reason the coach reads.
 *   · THE SWEEP (Ask 7; owner 2026-10-12: a step in the daily scheduled sweep) — an ask whose Sundays have all started
 *     closes and the coach is told; a waiting one's request is trued to the Sundays still to come.
 *
 * An ask's Sundays are read once, for both sides (lib/club-hand-back-reads.ts — the accept step's own reading).
 * Who: asking — the coach's money WRITE access and the schedule's write capability (the route); answering — the club's
 * money rule (`canMoveClubMoney`, the route); every database step is scoped by the org and locks the schedule first.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

type Fail = { ok: false; status: number; code: string; error: string };
const fail = (status: number, code: string, error: string): Fail => ({ ok: false, status, code, error });

const sumCents = (xs: readonly { cents: number }[]) => xs.reduce((n, x) => n + x.cents, 0);

/** Each practice's figure, never more than the room: the excess comes off the latest practices first. */
function capFigures<T extends { cents: number }>(figures: readonly T[], room: number): T[] {
  let excess = sumCents(figures) - Math.max(0, room);
  const out = figures.map(f => ({ ...f }));
  for (let i = out.length - 1; i >= 0 && excess > 0; i--) {
    const take = Math.min(excess, out[i].cents);
    out[i].cents -= take;
    excess -= take;
  }
  return out;
}

/** The club billed its teams for this schedule's time: final, priced (a rate), and a bill drawn. */
const billedSchedule = (row: ScheduleRow) => row.state === 'final' && !!row.bill_scale && !!row.allocation_id;

/** What the team may still ask back from the schedule, in cents (`club_hand_back_room`, mig 328). */
async function roomFor(orgId: string, scheduleId: string, teamId: string, except: string | null): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc('club_hand_back_room', { p_org: orgId, p_schedule: scheduleId, p_team: teamId, p_except: except });
  if (error) throw error;
  return Number(data ?? 0);
}

// ── The offer (Ask 1) ────────────────────────────────────────────────────────────────────────────

export interface AskScopeOffer { count: number; cents: number; eachCents: number | null; weekday: number | null }
export interface AskOffer { teamName: string; one: AskScopeOffer; remaining: AskScopeOffer; all: AskScopeOffer }

/**
 * THE TICK'S FIGURES — one per scope, following the choice above it (specimen 1). Null when there is nothing to ask:
 * the schedule isn't final, billed nothing (no rate), or the team has nothing left to ask back from it. `found` is the
 * series the route already read for the question's rows.
 */
export async function askOffer(p: { orgId: string; teamId: string; teamName: string; event: RepTeamEvent; found: PracticeSeries }): Promise<AskOffer | null> {
  const { found } = p;
  if (!found.series.length) return null;
  const [priced, room] = await Promise.all([
    practiceFigures(p.orgId, found.scheduleId, found.series),
    roomFor(p.orgId, found.scheduleId, p.teamId, null),
  ]);
  if (!priced || !billedSchedule(priced.row) || room <= 0) return null;
  const byEvent = new Map(priced.figures.map(f => [f.eventId, f]));
  const offer = (scope: HandBackScope): AskScopeOffer => {
    const figs = capFigures(scopePractices(found, p.event, scope).map(x => byEvent.get(x.id)).filter((f): f is HandBackSlot => !!f), room);
    return { count: figs.length, cents: sumCents(figs), eachCents: eachCents(figs), weekday: commonWeekday(figs.map(f => f.startsAt)) };
  };
  const one = offer('one');
  if (one.count === 0) return null;
  return { teamName: p.teamName, one, remaining: offer('remaining'), all: offer('all') };
}

// ── The ask (Asks 1, 2, 4) ───────────────────────────────────────────────────────────────────────

/**
 * ASK THE CLUB — the coach's ask: the practices stay the team's until the club answers (Ask 2). The figure is worked out
 * here from the schedule as it stands (never from the browser); the request it carries is filed under the bill's own
 * word (the team's split) and the schedule's club line, money back (`reimbursement`, set by the ask).
 */
export async function askHandBack(p: {
  org: Organization; teamId: string; teamName: string; teamGroupId: string | null; actorUserId: string; event: RepTeamEvent; scope: unknown;
}): Promise<{ ok: true; handBackId: string; requestId: string; cents: number; count: number } | Fail> {
  const scope = readHandBackScope(p.scope);
  if (!scope) return fail(400, 'bad_scope', 'Choose which practices to hand back.');
  if (!p.event.clubScheduleSlotId || p.event.status === 'cancelled' || p.event.startsAt < new Date().toISOString()) return fail(409, 'changed', W.refuse.changed);
  const found = await practiceSeries(p.org.id, p.teamId, p.event);
  if (!found) return fail(409, 'changed', W.refuse.changed);
  if (found.askedSlots.has(p.event.clubScheduleSlotId)) return fail(409, 'asked', W.refuse.changed);
  const practices = scopePractices(found, p.event, scope);
  if (!practices.length) return fail(409, 'changed', W.refuse.changed);
  const [priced, room] = await Promise.all([
    practiceFigures(p.org.id, found.scheduleId, practices),
    roomFor(p.org.id, found.scheduleId, p.teamId, null),
  ]);
  if (!priced?.figures.length) return fail(409, 'changed', W.refuse.changed);
  const row = priced.row;
  if (!billedSchedule(row)) return fail(409, 'not_billed', W.refuse.notBilled);
  // Every practice the coach chose goes in the ask; past the room the latest ride along at no figure (/review 2026-10-13 —
  // the tick's count and the ask's agree, and Accept hands back what was chosen).
  const figures = capFigures(priced.figures, room);
  if (sumCents(figures) <= 0) return fail(409, 'nothing', W.refuse.nothing);

  const { data: split, error: splitErr } = await supabaseAdmin.from('rep_allocation_splits')
    .select('budget_item_id, budget_category_id').eq('allocation_id', row.allocation_id!).eq('team_id', p.teamId).maybeSingle();
  if (splitErr) throw splitErr;
  if (!split) return fail(409, 'not_billed', W.refuse.notBilled);
  const weekday = commonWeekday(figures.map(f => f.startsAt));
  const { data, error } = await supabaseAdmin.rpc('club_hand_back_ask', {
    p_org: p.org.id, p_schedule: found.scheduleId, p_team: p.teamId, p_actor: p.actorUserId, p_scope: scope, p_slots: figures,
    p_request: {
      programYearId: p.event.programYearId, description: W.requestName(figures.length, weekday),
      budgetItemId: split.budget_item_id ?? '', budgetCategoryId: split.budget_category_id ?? '', budgetLineId: row.bill_line_id ?? '',
    },
  });
  if (error) throw error;
  const r = data as { ok: boolean; code?: string; room?: number; handBackId?: string; requestId?: string; cents?: number };
  if (!r.ok) {
    if (r.code === 'over_room') return fail(409, 'over_room', W.refuse.overRoom(Number(r.room ?? 0)));
    if (r.code === 'nothing') return fail(409, 'nothing', W.refuse.nothing);
    if (r.code === 'not_final') return fail(409, 'not_billed', W.refuse.notBilled);
    return fail(409, 'changed', W.refuse.changed);
  }
  const cents = r.cents ?? sumCents(figures);
  const days = figures.map(f => utcToZonedInputs(f.startsAt).date);
  const bell = { teamName: p.teamName, count: figures.length, scheduleName: found.scheduleName, first: days[0], last: days[days.length - 1] };
  await tellClubOfAsk({
    org: p.org, scheduleId: found.scheduleId, teamGroupId: p.teamGroupId, actorUserId: p.actorUserId, handBackId: r.handBackId!, requestId: r.requestId!,
    eventType: 'club_hand_back_asked', answerable: true,
    ...W.bellAsked({ ...bell, cents }),
    quiet: W.bellAsked({ ...bell, cents: null }),
  });
  return { ok: true, handBackId: r.handBackId!, requestId: r.requestId!, cents, count: figures.length };
}

/**
 * TELL THE CLUB (Ask 4; D5, read for who can open what): the schedule's builders and the club's money movers. "A record
 * opens from a notice where it lives, its window open" — so a builder who can move club money lands on the schedule's
 * page with Answer open (`?answer=`); a money mover without Schedules (the treasurer, §300 W13) lands on Payment requests
 * with the ask open (D5 says "the schedule's page", which the treasurer can't open — said in the hand-off); a builder who
 * can't move money lands on the page, where the ask shows without Answer.
 */
async function tellClubOfAsk(p: {
  org: Organization; scheduleId: string; teamGroupId: string | null; actorUserId: string | null; handBackId: string; requestId: string | null;
  eventType: NotificationEventType; title: string; body: string; answerable: boolean;
  /** The same notice without the figure, for a builder who can't move club money (a money read — /review 2026-10-13). */
  quiet?: { title: string; body: string };
}): Promise<void> {
  try {
    const { data: sched, error } = await supabaseAdmin.from('club_schedules').select('created_by, sent_by, finalized_by').eq('id', p.scheduleId).maybeSingle();
    if (error) throw error;
    const named = [sched?.created_by, sched?.sent_by, sched?.finalized_by].filter((x): x is string => !!x);
    const movers = await clubAccountingUserIds(p.org, p.teamGroupId);
    const ids = [...new Set([...named, ...movers])];
    if (!ids.length) return;
    const { data: members, error: mErr } = await supabaseAdmin.from('organization_members').select('user_id, role, capabilities')
      .eq('organization_id', p.org.id).eq('status', 'active').in('user_id', ids);
    if (mErr) throw mErr;
    const page = `/${p.org.slug}/admin/schedules/${p.scheduleId}`;
    const groups = new Map<string, { link: string; quiet: boolean; userIds: string[] }>();
    for (const m of (members ?? []) as { user_id: string; role: OrgRole; capabilities: Record<string, boolean> | null }[]) {
      const builder = named.includes(m.user_id) && isScheduleBuilder(m.role) && canOpenClubSchedules({ planId: p.org.planId, role: m.role });
      const mover = movers.includes(m.user_id) && canMoveClubMoney({ role: m.role, capabilities: m.capabilities }, p.org);
      if (!builder && !mover) continue;
      const link = builder
        ? (mover && p.answerable ? `${page}?answer=${p.handBackId}` : page)
        : clubMoneyLinks.requests(p.org.slug, p.requestId ?? undefined);
      const quiet = !mover && !!p.quiet;
      const key = `${link}|${quiet}`;
      const group = groups.get(key) ?? { link, quiet, userIds: [] };
      group.userIds.push(m.user_id);
      groups.set(key, group);
    }
    for (const { link, quiet, userIds } of groups.values()) {
      const words = quiet && p.quiet ? p.quiet : { title: p.title, body: p.body };
      await notify({
        orgId: p.org.id, eventType: p.eventType, title: words.title, body: words.body, userIds,
        excludeUserIds: p.actorUserId ? [p.actorUserId] : [], link, metadata: { scheduleId: p.scheduleId, handBackId: p.handBackId },
      });
    }
  } catch (e) {
    console.error('[club-hand-back] the club\'s notice failed (the ask landed):', e);
  }
}

// ── Withdraw (Ask 3) ─────────────────────────────────────────────────────────────────────────────

export async function withdrawAsk(p: {
  org: Organization; teamId: string; teamName: string; teamGroupId: string | null; actorUserId: string; handBackId: string;
}): Promise<{ ok: true } | Fail> {
  const summary = (await askSummaries(p.org.id, [p.handBackId])).get(p.handBackId);
  if (!summary || summary.teamId !== p.teamId) return fail(404, 'not_found', W.refuse.notFound);
  const { data, error } = await supabaseAdmin.rpc('club_hand_back_withdraw', { p_org: p.org.id, p_team: p.teamId, p_actor: p.actorUserId, p_hand_back: p.handBackId });
  if (error) throw error;
  const r = data as { ok: boolean; code?: string };
  if (!r.ok) return r.code === 'not_found' ? fail(404, 'not_found', W.refuse.notFound) : fail(409, 'answered', W.refuse.answered);
  await tellClubOfAsk({
    org: p.org, scheduleId: summary.scheduleId, teamGroupId: p.teamGroupId, actorUserId: p.actorUserId, handBackId: p.handBackId, requestId: null,
    eventType: 'club_hand_back_withdrawn', answerable: false,
    ...W.bellWithdrawn({ teamName: p.teamName, count: summary.count, scheduleName: summary.scheduleName }),
  });
  return { ok: true };
}

// ── The answer (Asks 3, 5, 6) ────────────────────────────────────────────────────────────────────

/** Why Accept can't be pressed now, in words — the window says it, Accept refuses with it (one ordered reading). */
export type AnswerRefusal = { code: 'lapsed' | 'stale' | 'year_closed'; text: string };

export interface AnswerView {
  id: string; state: AskSummary['state']; scheduleId: string; scheduleName: string; teamId: string; teamName: string; requestId: string | null;
  askedAt: string; askedBy: { name: string | null; headCoach: boolean };
  /** The Sundays still to come that the team still holds (Ask 7), in time order. */
  sundays: { day: string; startsAt: string; endsAt: string; place: string }[];
  weekday: number | null; count: number; cents: number; eachCents: number | null;
  /** The team's bills from this schedule (its first bill and corrections — one pool). */
  bill: { billedCents: number; creditedCents: number; paidCents: number; owedCents: number; owedDates: string[] };
  /** What Accept does (Ask 5) — the step writes the same application. */
  settle: { creditCents: number; payCents: number; moves: CreditMove[] };
  lineName: string | null;
  /** Every Sunday in it has started (it lapses at the next sweep) · none of it is still the team's · a closed fiscal year. */
  refusal: AnswerRefusal | null;
  canAnswer: boolean;
  closed: { reason: string | null; creditedCents: number | null; toPayCents: number | null } | null;
}

export async function answerView(orgId: string, handBackId: string, canMove: boolean): Promise<AnswerView | null> {
  const summary = (await askSummaries(orgId, [handBackId])).get(handBackId);
  if (!summary) return null;
  const waiting = summary.state === 'waiting';
  const [req, places, schedRow, pool, room, staff, nameOf] = await Promise.all([
    supabaseAdmin.from('rep_team_payment_requests').select('id').eq('org_id', orgId).eq('club_hand_back_id', handBackId).maybeSingle(),
    readClubPlaces(orgId),
    supabaseAdmin.from('club_schedules').select('bill_line_id, org_budget_lines ( description )').eq('id', summary.scheduleId).maybeSingle(),
    schedulePoolInstallments(orgId, summary.scheduleId, summary.teamId),
    waiting ? roomFor(orgId, summary.scheduleId, summary.teamId, handBackId) : Promise.resolve(0),
    listActiveStaffForTeams([summary.teamId]),
    resolvePersonNamer(orgId, [summary.askedBy]),
  ]);
  const capped = waiting ? capFigures(summary.sundays, room) : summary.sundays;
  const cents = waiting ? sumCents(capped) : summary.cents;

  // The team's bill now, and what Accept would do to it (`previewCredit` — the step's own rule, and its closed year).
  const figures = clubBillFigures(pool.installments, tournamentToday());
  const owed = pool.installments.filter(i => !i.paidAt && clubInstallmentDue(i) > 0).map(i => i.dueDate).sort();
  const preview = waiting ? await previewCredit(orgId, pool, cents) : { creditCents: 0, payCents: 0, moves: [], lockedYear: null };
  const refusal: AnswerRefusal | null = !waiting ? null
    : !summary.toCome ? { code: 'lapsed', text: W.refuse.lapsed }
    : summary.count === 0 ? { code: 'stale', text: W.refuse.stale }
    : preview.lockedYear ? { code: 'year_closed', text: W.refuse.yearClosed(preview.lockedYear) }
    : null;

  const asker = staff.find(m => m.userId === summary.askedBy);
  return {
    id: summary.id, state: summary.state, scheduleId: summary.scheduleId, scheduleName: summary.scheduleName,
    teamId: summary.teamId, teamName: summary.teamName, requestId: (req.data?.id as string | undefined) ?? null,
    askedAt: summary.askedAt, askedBy: { name: nameOf(summary.askedBy), headCoach: asker?.coachRole === 'head_coach' },
    sundays: summary.sundays.map(s => ({
      day: utcToZonedInputs(s.startsAt).date, startsAt: s.startsAt, endsAt: s.endsAt,
      place: s.venueId ? placeWords(places.venueName.get(s.venueId) ?? '', s.facilityId ? places.facilityName.get(s.facilityId) ?? null : null) : '',
    })),
    weekday: summary.weekday, count: summary.count, cents, eachCents: eachCents(capped),
    bill: {
      billedCents: toCents(figures.billed), creditedCents: toCents(figures.credited), paidCents: toCents(figures.collected),
      owedCents: toCents(figures.outstanding), owedDates: owed,
    },
    settle: { creditCents: preview.creditCents, payCents: preview.payCents, moves: preview.moves },
    lineName: ((schedRow.data?.org_budget_lines as { description?: string | null } | null)?.description) ?? null,
    refusal,
    canAnswer: canMove && waiting,
    closed: waiting ? null : { reason: summary.declineReason, creditedCents: summary.creditedCents, toPayCents: summary.toPayCents },
  };
}

/** ACCEPT (Ask 3, 5, 6, 9) — one step; the coach is told what it did to the money. */
export async function acceptAsk(ctx: AuthContextWithRole, handBackId: string): Promise<Moved<{ creditCents: number; payCents: number; count: number; teamName: string; what: PracticesNamed }>> {
  const view = await answerView(ctx.org.id, handBackId, true);
  if (!view) return refused(404, { error: W.refuse.notFound, code: 'not_found' });
  if (view.state !== 'waiting') return refused(409, { error: W.refuse.answered, code: 'answered' });
  if (view.refusal) return refused(409, { error: view.refusal.text, code: view.refusal.code });
  const { data, error } = await supabaseAdmin.rpc('club_hand_back_accept', {
    p_org: ctx.org.id, p_actor: ctx.user.id, p_hand_back: handBackId, p_on: tournamentToday(), p_reason: W.reasonHandBack(view.count, view.weekday),
  });
  if (error && isClosedYearError(error)) return refused(409, { error: W.refuse.yearClosed(null), code: 'year_closed' });
  if (error) throw error;
  const r = data as { ok: boolean; code?: string; credited?: number; toPay?: number; slots?: string[] };
  if (!r.ok) {
    const words = r.code === 'lapsed' ? W.refuse.lapsed : r.code === 'stale' ? W.refuse.stale : r.code === 'not_found' ? W.refuse.notFound : W.refuse.answered;
    return refused(r.code === 'not_found' ? 404 : 409, { error: words, code: r.code ?? 'answered' });
  }
  const creditCents = Number(r.credited ?? 0), payCents = Number(r.toPay ?? 0), count = r.slots?.length ?? view.count;
  await tellTeamMoneyPeople({
    org: ctx.org, teamId: view.teamId, actorUserId: ctx.user.id, event: 'club_hand_back_answered',
    ...W.bellAccepted({ scheduleName: view.scheduleName, count, creditCents, payCents, teamName: view.teamName, moves: await movesWritten(ctx.org.id, handBackId) }),
    metadata: { handBackId },
  });
  return { ok: true, creditCents, payCents, count, teamName: view.teamName, what: namePractices(Math.max(1, count), view.weekday) };
}

/** What a written credit did to each payment (the bell's "its Feb 1 payment drops from $864.00 to $432.00"). */
async function movesWritten(orgId: string, handBackId: string): Promise<CreditMove[]> {
  const credits = await fetchAll<{ id: string }>((a, b) => supabaseAdmin.from('rep_allocation_credits').select('id').eq('org_id', orgId).eq('hand_back_id', handBackId).order('id').range(a, b));
  if (!credits.length) return [];
  const parts = await fetchAllIn<{ amount: number | string; rep_allocation_installments: { amount: number | string; credited_amount: number | string; due_date: string } | null }>(credits.map(c => c.id), (c, a, b) => supabaseAdmin
    .from('rep_allocation_credit_parts').select('amount, rep_allocation_installments ( amount, credited_amount, due_date )').eq('org_id', orgId).in('credit_id', c).order('installment_id').range(a, b));
  return parts.filter(p => p.rep_allocation_installments).map(p => {
    const i = p.rep_allocation_installments!;
    const after = toCents(clubInstallmentDue({ amount: Number(i.amount), credited: Number(i.credited_amount) }));
    return { dueDate: i.due_date, fromCents: after + toCents(Number(p.amount)), toCents: after };
  });
}

/** DECLINE (Ask 3) — the Sundays stay the team's; the coach reads the reason. */
export async function declineAsk(ctx: AuthContextWithRole, handBackId: string, rawReason: unknown): Promise<Moved<{ teamName: string; what: PracticesNamed }>> {
  const reason = typeof rawReason === 'string' ? rawReason.trim().slice(0, 500) || null : null;
  const view = await answerView(ctx.org.id, handBackId, true);
  if (!view) return refused(404, { error: W.refuse.notFound, code: 'not_found' });
  const { data, error } = await supabaseAdmin.rpc('club_hand_back_decline', { p_org: ctx.org.id, p_actor: ctx.user.id, p_hand_back: handBackId, p_reason: reason });
  if (error) throw error;
  const r = data as { ok: boolean; code?: string };
  if (!r.ok) return refused(r.code === 'not_found' ? 404 : 409, { error: r.code === 'not_found' ? W.refuse.notFound : W.refuse.answered, code: r.code ?? 'answered' });
  const count = Math.max(1, view.count);
  await tellTeamMoneyPeople({
    org: ctx.org, teamId: view.teamId, actorUserId: ctx.user.id, event: 'club_hand_back_answered',
    ...W.bellDeclined({ scheduleName: view.scheduleName, count, reason }),
    metadata: { handBackId },
  });
  return { ok: true, teamName: view.teamName, what: namePractices(count, view.weekday) };
}

// ── The daily sweep (Ask 7) ──────────────────────────────────────────────────────────────────────

/**
 * THE SWEEP — run by the daily scheduled tick (the dues reminders' route; owner 2026-10-12): an ask whose Sundays have
 * all started closes (lapsed) and the team's money people are told; a waiting ask's request is trued to the Sundays
 * still to come. Safe to run any time: a second run changes nothing.
 */
export async function sweepHandBacks(): Promise<{ lapsed: number; trued: number }> {
  const { data, error } = await supabaseAdmin.rpc('club_hand_back_sweep');
  if (error) throw error;
  const r = data as { lapsed: { handBackId: string; orgId: string; teamId: string; scheduleId: string; count?: number }[]; trued: number };
  if (r.lapsed.length) {
    const [orgs, schedules] = await Promise.all([
      fetchAllIn<{ id: string; slug: string }>([...new Set(r.lapsed.map(l => l.orgId))], (c, a, b) => supabaseAdmin
        .from('organizations').select('id, slug').in('id', c).order('id').range(a, b)),
      fetchAllIn<{ id: string; name: string }>([...new Set(r.lapsed.map(l => l.scheduleId))], (c, a, b) => supabaseAdmin
        .from('club_schedules').select('id, name').in('id', c).order('id').range(a, b)),
    ]);
    const orgOf = new Map(orgs.map(o => [o.id, o]));
    const nameOf = new Map(schedules.map(s => [s.id, s.name]));
    for (const l of r.lapsed) {
      const org = orgOf.get(l.orgId);
      if (!org) continue;
      await tellTeamMoneyPeople({
        org, teamId: l.teamId, actorUserId: '', event: 'club_hand_back_lapsed',
        ...W.bellLapsed({ scheduleName: nameOf.get(l.scheduleId) ?? '', count: Number(l.count ?? 0) }),
        metadata: { handBackId: l.handBackId },
      });
    }
  }
  return { lapsed: r.lapsed.length, trued: Number(r.trued ?? 0) };
}

/** The asks a list of requests carries, by request id (both lists read them through this). */
export async function asksForRequests(orgId: string, requests: readonly { id: string; club_hand_back_id?: string | null }[]): Promise<Map<string, AskSummary>> {
  const linked = requests.filter(r => r.club_hand_back_id);
  const asks = await askSummaries(orgId, linked.map(r => r.club_hand_back_id!));
  return new Map(linked.map(r => [r.id, asks.get(r.club_hand_back_id!)!]).filter(([, a]) => !!a) as [string, AskSummary][]);
}
