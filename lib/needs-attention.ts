import 'server-only';
import { hasPlanFeature } from './plan-features';
import { effectiveOrgFactsForId } from './entitlement-grants';
import { supabaseAdmin } from './supabase-admin';
import { resolvePersonNamer } from './db';
import { clubMoneyLinks } from './club-money-notify';
import { moneySectionHref } from './coach-money-links';
import { requestWaitsOnClub } from './club-money-figures';
import { NEEDS_ATTENTION_KINDS, isTeamCoachEvent, type NeedsAttentionKind } from './notification-labels';
import { bellReadFilter, type BellSource } from './notification-bell-scope';
import { registrationAmountDue, registrationFee, type DueDivision, type DueTournament } from './registration-amount-due';
import { tournamentTracksPayments } from './tournament-payments-tracked';
import { ourTeamIdsAmong } from './club-own-tournament-team';
import { tournamentToday, utcToZonedInputs } from './timezone';
import { SETTLED_WORDS as W } from './needs-attention-words';
import { money as formatMoney } from './online-payment-words';
import { PAYOUTS_ACCOUNT_COLUMNS, factsFromRow, payoutsState, type PayoutsAccountRow } from './online-payment-account';
import type { SettledNotice } from './types';

/**
 * NEEDS ATTENTION CLEARS ITSELF (owner ruling 2026-10-16, Owner QA §322 "Found before W2"; plan
 * docs/projects/active/NEEDS_ATTENTION_CLEARS_ITSELF_PLAN.md, hub Cv4TBP7XMMXnG4ZWVHB6J9). Server-only.
 *
 * A Needs-attention notification asks someone to do something. Once the thing it asks about stops waiting —
 * answered, declined, withdrawn, closed, handled by someone else — it leaves Needs attention for EVERYONE it went to,
 * and stops counting as unread. It stays readable under All, where its reader says what happened (A2).
 *
 * THE RULEBOOK (`NEEDS_ATTENTION_END`) is total over the 'act' kinds: a new kind fails typecheck until it says how it
 * ends. Each entry reads the notifications' own records (the id each one already carries in `metadata`) and answers,
 * per notification, 'waiting' or what happened. A notification it cannot place is left alone — never cleared on doubt.
 *
 * TWO MOMENTS a notification is cleared:
 *   · on the spot — the common settle steps (Accept, Decline, Withdraw, Approve, Confirm received, a reply, a move's
 *     answer, an invite's answer, check-in) call `clearSettled` after their write lands, so every copy goes at once
 *     and the bells' counts drop live;
 *   · on read — every bell read and count runs `clearSettledForReader` first. It catches every path the first moment
 *     doesn't: the daily sweep closing an ask, time passing, a deleted record, a payment recorded anywhere, and every
 *     notification already sitting there before this shipped.
 * Clearing writes `cleared_at` and, when still null, `read_at` — a settled notification is neither waiting nor news.
 * Both passes swallow their own failures: a bell must still read, and a settle step must still land.
 */

export interface NoticeRow {
  id: string;
  org_id: string;
  user_id: string;
  event_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  link: string | null;
  /** Read by the list route: only a cleared row can be settled. */
  cleared_at?: string | null;
}

/** A door's outcome, for its prose note (A5): the page composes the day and the clock in the reader's zone. */
export type DoorOutcome =
  | { kind: 'ask'; verb: 'accepted' | 'declined' | 'withdrew'; team: string; by: string | null; at: string | null }
  | { kind: 'askClosed'; team: string; at: string | null }
  | { kind: 'requestWithdrawn' };

interface Settled {
  /** Who did it — a user id, named per reader ("You" / their name) only when the record keeps one. */
  by: string | null;
  /** When it happened, when the record keeps it. */
  at: string | null;
  words: (who: string | null, you: boolean) => { outcome: string; then?: string | null };
  /** Where the record lives now (A3): a string replaces the notification's link, null means nothing to open. */
  link?: string | null;
  door?: DoorOutcome;
}
type Verdict = 'waiting' | Settled;
type Resolver = (rows: NoticeRow[]) => Promise<Map<string, Verdict>>;

const SELECT = 'id, org_id, user_id, event_type, metadata, created_at, link';
const CHUNK = 200;
const PAGE = 1000;

const meta = (r: NoticeRow, key: string): string | null => {
  const v = r.metadata?.[key];
  return typeof v === 'string' && v ? v : null;
};
const uniq = <T,>(xs: readonly (T | null | undefined)[]): T[] => [...new Set(xs.filter((x): x is T => x != null))];
const said = (outcome: string, extra: Partial<Settled> = {}): Settled => ({ by: null, at: null, words: () => ({ outcome }), ...extra });
/** The org slug an admin or coach link starts with. */
const slugOf = (link: string | null) => (link ? /^\/([^/?#]+)\/(?:admin|coaches)(?:[/?#]|$)/.exec(link)?.[1] ?? null : null);

/** Rows whose `column` is one of `values`, read in chunks (an `in` list has a length limit). `orderBy` must be unique
 *  per row (the paging stands on it) — `id` unless the table has none, like `org_payment_accounts` (keyed by `org_id`). */
async function rowsIn<T>(table: string, select: string, column: string, values: readonly string[], narrow?: (q: any) => any, orderBy = 'id'): Promise<T[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const out: T[] = [];
  for (let i = 0; i < values.length; i += CHUNK) {
    // Paged in `orderBy` order (`id` unless the table has none): a response is capped at PAGE rows, and a read cut short raises no error — a hand-back's
    // Sundays past the cut read as "taken back" and cleared a notice still waiting (/review 2026-10-16).
    for (let from = 0; ; from += PAGE) {
      let q = supabaseAdmin.from(table).select(select).in(column, values.slice(i, i + CHUNK));
      if (narrow) q = narrow(q);
      const { data, error } = await q.order(orderBy).range(from, from + PAGE - 1);
      if (error) throw error;
      const page = (data ?? []) as unknown as T[];
      out.push(...page);
      if (page.length < PAGE) break;
    }
  }
  return out;
}

async function teamNames(ids: string[]): Promise<Map<string, string>> {
  const rows = await rowsIn<{ id: string; name: string }>('rep_teams', 'id, name', 'id', ids);
  return new Map(rows.map(t => [t.id, t.name]));
}

// ── The rulebook ─────────────────────────────────────────────────────────────────────────────────────────────

/** A team asks for money back for time it hands back — waits while the ask is `waiting`. */
const handBackAsked: Resolver = async rows => {
  const out = new Map<string, Verdict>();
  const ids = uniq(rows.map(r => meta(r, 'handBackId')));
  if (!ids.length) return out;
  type HB = { id: string; team_id: string; state: string; closed_by: string | null; closed_at: string | null; credited_cents: number | null; to_pay_cents: number | null; decline_reason: string | null };
  const [hbs, reqs] = await Promise.all([
    rowsIn<HB>('club_schedule_hand_backs', 'id, team_id, state, closed_by, closed_at, credited_cents, to_pay_cents, decline_reason', 'id', ids),
    rowsIn<{ id: string; club_hand_back_id: string }>('rep_team_payment_requests', 'id, club_hand_back_id', 'club_hand_back_id', ids),
  ]);
  const teams = await teamNames(uniq(hbs.map(h => h.team_id)));
  const byId = new Map(hbs.map(h => [h.id, h]));
  const requestOf = new Map(reqs.map(q => [q.club_hand_back_id, q.id]));
  for (const r of rows) {
    const id = meta(r, 'handBackId');
    if (!id) continue;
    const hb = byId.get(id);
    if (!hb) { out.set(r.id, said(W.askClosed, { link: null })); continue; }
    if (hb.state === 'waiting') { out.set(r.id, 'waiting'); continue; }
    const team = teams.get(hb.team_id) ?? 'The team';
    // An answered ask lives on as its request in Payment requests — for a reader who moves club money (their copy
    // links the Answer, or the request). A schedule builder's copy links the bare schedule, which shows no answered
    // ask, so it gets no button (A3). ⚠ That copy is also the QUIET one — sent without the figure, a money read (/review
    // 2026-10-13) — so its settled line says only what happened, never the money (found reviewing this build).
    const mover = !!r.link && (/[?&]answer=/.test(r.link) || /\/admin\/accounting\/payment-requests/.test(r.link));
    const requestId = requestOf.get(id);
    const slug = slugOf(r.link);
    const link = mover && requestId && slug ? clubMoneyLinks.requests(slug, requestId) : null;
    if (hb.state === 'accepted') {
      const credited = Number(hb.credited_cents ?? 0), paid = Number(hb.to_pay_cents ?? 0);
      out.set(r.id, {
        by: hb.closed_by, at: hb.closed_at, link,
        door: { kind: 'ask', verb: 'accepted', team, by: hb.closed_by, at: hb.closed_at },
        words: (who, you) => ({
          outcome: W.accepted(who, you),
          then: mover ? [credited > 0 ? W.creditedThen(credited, team) : null, paid > 0 ? W.paidBackThen(paid, team) : null].filter(Boolean).join(' ') || null : null,
        }),
      });
    } else if (hb.state === 'declined') {
      out.set(r.id, {
        by: hb.closed_by, at: hb.closed_at, link,
        door: { kind: 'ask', verb: 'declined', team, by: hb.closed_by, at: hb.closed_at },
        words: (who, you) => ({
          outcome: W.declined(who, you),
          then: mover ? [hb.decline_reason ? W.reasonThen(hb.decline_reason, you) : null, W.billUnchangedThen(team)].filter(Boolean).join(' ') : null,
        }),
      });
    } else if (hb.state === 'withdrawn') {
      // A withdrawn ask's request is deleted with it: nothing to open.
      out.set(r.id, {
        by: hb.closed_by, at: hb.closed_at, link: null,
        door: { kind: 'ask', verb: 'withdrew', team, by: hb.closed_by, at: hb.closed_at },
        words: (who, you) => ({ outcome: W.withdrawn(who, you) }),
      });
    } else {
      // Lapsed: the daily sweep closed it (no Sunday still to come) and deleted its request.
      out.set(r.id, { by: null, at: hb.closed_at, link: null, door: { kind: 'askClosed', team, at: hb.closed_at }, words: () => ({ outcome: W.askClosed, then: W.askClosedThen }) });
    }
  }
  return out;
};

/** A team handed back time without asking for money (to its money people) — waits until someone asks for the
 *  money (a late ask over it that wasn't withdrawn), or nothing of it is handed back any more. Time passing does
 *  not end it: a late ask never lapses by date (Stage 11d part C). */
const handBackUnasked: Resolver = async rows => {
  const out = new Map<string, Verdict>();
  const ids = uniq(rows.map(r => meta(r, 'handBackId')));
  if (!ids.length) return out;
  const [lates, held] = await Promise.all([
    rowsIn<{ late_for: string; state: string; asked_by: string | null; asked_at: string; asked_cents: number | null }>(
      'club_schedule_hand_backs', 'late_for, state, asked_by, asked_at, asked_cents', 'late_for', ids),
    rowsIn<{ hand_back_id: string }>('club_schedule_hand_back_slots', 'hand_back_id', 'hand_back_id', ids, q => q.eq('handed_back', true)),
  ]);
  const stillHandedBack = new Set(held.map(h => h.hand_back_id));
  for (const r of rows) {
    const id = meta(r, 'handBackId');
    if (!id) continue;
    const late = lates.filter(l => l.late_for === id && l.state !== 'withdrawn').sort((a, b) => b.asked_at.localeCompare(a.asked_at))[0];
    if (late) {
      const cents = Number(late.asked_cents ?? 0);
      out.set(r.id, { by: late.asked_by, at: late.asked_at, words: (who, you) => ({ outcome: W.askedLater(who, you, cents) }) });
    } else if (!stillHandedBack.has(id)) {
      out.set(r.id, said(W.tookBack));
    } else {
      out.set(r.id, 'waiting');
    }
  }
  return out;
};

/** Coach filed a payment request — waits while the club hasn't decided it. A withdrawn request is deleted. */
const requestFiled: Resolver = async rows => {
  const out = new Map<string, Verdict>();
  const ids = uniq(rows.map(r => meta(r, 'requestId')));
  if (!ids.length) return out;
  type Q = { id: string; status: string; reviewed_by: string | null; reviewed_at: string | null; reversed_by: string | null; reversed_at: string | null; denial_reason: string | null };
  const reqs = new Map((await rowsIn<Q>('rep_team_payment_requests', 'id, status, reviewed_by, reviewed_at, reversed_by, reversed_at, denial_reason', 'id', ids)).map(q => [q.id, q]));
  for (const r of rows) {
    const id = meta(r, 'requestId');
    if (!id) continue;
    const q = reqs.get(id);
    if (!q) { out.set(r.id, said(W.coachWithdrew, { link: null, door: { kind: 'requestWithdrawn' } })); continue; }
    if (requestWaitsOnClub(q.status)) { out.set(r.id, 'waiting'); continue; }
    if (q.status === 'denied') {
      out.set(r.id, { by: q.reviewed_by, at: q.reviewed_at, words: (who, you) => ({ outcome: W.declined(who, you), then: q.denial_reason ? W.reasonThen(q.denial_reason, you) : null }) });
    } else if (q.status === 'reversed') {
      out.set(r.id, { by: q.reversed_by, at: q.reversed_at, words: (who, you) => ({ outcome: W.reversed(who, you) }) });
    } else {
      out.set(r.id, { by: q.reviewed_by, at: q.reviewed_at, words: (who, you) => ({ outcome: W.approved(who, you) }) });
    }
  }
  return out;
};

/** Coach says "I sent the payment" — waits while it is sent and not yet confirmed received. */
const moneySent: Resolver = async rows => {
  const out = new Map<string, Verdict>();
  const ids = uniq(rows.map(r => meta(r, 'installmentId')));
  if (!ids.length) return out;
  type I = { id: string; sent_at: string | null; paid_at: string | null; paid_by: string | null; undone_at: string | null; undone_by: string | null };
  const inst = new Map((await rowsIn<I>('rep_allocation_installments', 'id, sent_at, paid_at, paid_by, undone_at, undone_by', 'id', ids)).map(i => [i.id, i]));
  for (const r of rows) {
    const id = meta(r, 'installmentId');
    if (!id) continue;
    const i = inst.get(id);
    if (i && i.sent_at && !i.paid_at) { out.set(r.id, 'waiting'); continue; }
    if (i?.paid_at) out.set(r.id, { by: i.paid_by, at: i.paid_at, words: (who, you) => ({ outcome: W.confirmedReceived(who, you) }) });
    else if (i?.undone_at) out.set(r.id, { by: i.undone_by, at: i.undone_at, words: (who, you) => ({ outcome: W.receivedUndone(who, you) }) });
    else out.set(r.id, said(W.coachTookBack));
  }
  return out;
};

/** Requests holding a coach's payout — waits while any of them still waits on the club. */
const holdingPayout: Resolver = async rows => {
  const out = new Map<string, Verdict>();
  const listOf = (r: NoticeRow) => (Array.isArray(r.metadata?.requestIds) ? (r.metadata.requestIds as unknown[]).filter((x): x is string => typeof x === 'string') : []);
  const ids = uniq(rows.flatMap(listOf));
  const status = new Map(ids.length ? (await rowsIn<{ id: string; status: string }>('rep_team_payment_requests', 'id, status', 'id', ids)).map(q => [q.id, q.status]) : []);
  for (const r of rows) {
    const list = listOf(r);
    if (!list.length) continue; // names no request: malformed, so never cleared on doubt (/review 2026-10-16)
    const waits = list.some(id => status.has(id) && requestWaitsOnClub(status.get(id)!));
    out.set(r.id, waits ? 'waiting' : said(W.allSettled(list.length)));
  }
  return out;
};

/** A schedule sent for review — waits while the schedule is in review and the team hasn't answered this round. One
 *  head coach's answer settles it for the team's whole staff. */
const scheduleReview: Resolver = async rows => {
  const out = new Map<string, Verdict>();
  const sids = uniq(rows.map(r => meta(r, 'scheduleId')));
  if (!sids.length) return out;
  type S = { id: string; state: string; finalized_by: string | null; finalized_at: string | null };
  const [schedules, sends] = await Promise.all([
    rowsIn<S>('club_schedules', 'id, state, finalized_by, finalized_at', 'id', sids),
    rowsIn<{ id: string; schedule_id: string; sent_at: string }>('club_schedule_sends', 'id, schedule_id, sent_at', 'schedule_id', sids,
      q => q.eq('kind', 'review').not('landed_at', 'is', null)),
  ]);
  // The latest landed review round of each schedule — the round a reply answers (as `latestReviewSend`).
  const latest = new Map<string, string>();
  for (const s of [...sends].sort((a, b) => a.sent_at.localeCompare(b.sent_at))) latest.set(s.schedule_id, s.id);
  const replies = latest.size
    ? await rowsIn<{ send_id: string; team_id: string; answer: string; replied_by: string | null; replied_at: string }>(
      'club_schedule_replies', 'send_id, team_id, answer, replied_by, replied_at', 'send_id', [...latest.values()])
    : [];
  const byId = new Map(schedules.map(s => [s.id, s]));
  for (const r of rows) {
    const sid = meta(r, 'scheduleId'), teamId = meta(r, 'teamId');
    if (!sid) continue;
    const s = byId.get(sid);
    if (!s) { out.set(r.id, said(W.scheduleDeleted)); continue; }
    if (s.state === 'final') { out.set(r.id, { by: s.finalized_by, at: s.finalized_at, words: (who, you) => ({ outcome: W.finalized(who, you) }) }); continue; }
    if (s.state !== 'in_review') { out.set(r.id, 'waiting'); continue; }
    const send = latest.get(sid);
    const reply = replies.filter(x => x.send_id === send && x.team_id === teamId).sort((a, b) => b.replied_at.localeCompare(a.replied_at))[0];
    if (!reply) { out.set(r.id, 'waiting'); continue; }
    const good = reply.answer === 'looks_good';
    out.set(r.id, { by: reply.replied_by, at: reply.replied_at, words: (who, you) => ({ outcome: good ? W.answeredLooksGood(who, you) : W.askedForChange(who, you) }) });
  }
  return out;
};

/** A team move request — waits while one side's yes is recorded and the other's isn't (`ownership_pending`). */
const teamMove: Resolver = async rows => {
  const out = new Map<string, Verdict>();
  const ids = uniq(rows.map(r => meta(r, 'linkId')));
  if (!ids.length) return out;
  const links = new Map((await rowsIn<{ id: string; status: string; updated_at: string | null }>('team_org_links', 'id, status, updated_at', 'id', ids)).map(l => [l.id, l]));
  for (const r of rows) {
    const id = meta(r, 'linkId');
    if (!id) continue;
    const l = links.get(id);
    if (!l) out.set(r.id, said(W.moveWithdrawn));
    else if (l.status === 'ownership_pending') out.set(r.id, 'waiting');
    else if (l.status === 'org_owned') out.set(r.id, said(W.moveAccepted, { at: l.updated_at }));
    else if (l.status === 'declined') out.set(r.id, said(W.moveDeclined, { at: l.updated_at }));
    else if (l.status === 'revoked') out.set(r.id, said(W.moveWithdrawn, { at: l.updated_at }));
  }
  return out;
};

/** An assistant coach waiting for approval — waits while the invite is `pending_approval`. */
const assistantApproval: Resolver = async rows => {
  const out = new Map<string, Verdict>();
  const ids = uniq(rows.map(r => meta(r, 'inviteId')));
  if (!ids.length) return out;
  type Inv = { id: string; status: string; team_id: string; invited_email: string | null; created_at: string };
  const invites = await rowsIn<Inv>('assistant_invite_tokens', 'id, status, team_id, invited_email, created_at', 'id', ids);
  const byId = new Map(invites.map(i => [i.id, i]));
  // A revoked invite was either answered no, cancelled, or replaced by a newer one for the same person and team (a
  // resend mints a new invite). Only the last is knowable, so the others are named together — never a guess.
  const revokedTeams = uniq(invites.filter(i => i.status === 'revoked').map(i => i.team_id));
  const siblings = revokedTeams.length ? await rowsIn<Inv>('assistant_invite_tokens', 'id, status, team_id, invited_email, created_at', 'team_id', revokedTeams) : [];
  for (const r of rows) {
    const id = meta(r, 'inviteId');
    if (!id) continue;
    const i = byId.get(id);
    if (!i) { out.set(r.id, said(W.inviteDeclinedOrCancelled)); continue; }
    if (i.status === 'pending_approval') out.set(r.id, 'waiting');
    else if (i.status === 'pending' || i.status === 'accepted') out.set(r.id, said(W.inviteApproved));
    else if (i.status === 'expired') out.set(r.id, said(W.inviteExpired));
    else if (i.status === 'revoked') {
      const email = (i.invited_email ?? '').toLowerCase();
      const replaced = siblings.some(s => s.id !== i.id && s.team_id === i.team_id && (s.invited_email ?? '').toLowerCase() === email && s.created_at > i.created_at);
      out.set(r.id, said(replaced ? W.inviteReplaced : W.inviteDeclinedOrCancelled));
    }
  }
  return out;
};

/** A family asked to withdraw a house-league child (Club Tier 9b-2) — waits until the registration ends (declined or
 *  withdrawn); a registration no longer there is settled too. Keeping the child is a decision the notice can't see: Done. */
const withdrawRequest: Resolver = async rows => {
  const out = new Map<string, Verdict>();
  const ids = uniq(rows.map(r => meta(r, 'registrationId')));
  if (!ids.length) return out;
  const regs = await rowsIn<{ id: string; status: string; ended_at: string | null }>('league_registrations', 'id, status, ended_at', 'id', ids);
  const byId = new Map(regs.map(g => [g.id, g]));
  for (const r of rows) {
    const id = meta(r, 'registrationId');
    if (!id) continue;
    const g = byId.get(id);
    if (!g) { out.set(r.id, said(W.withdrawGone)); continue; }
    out.set(r.id, g.status === 'declined' || g.status === 'withdrawn' ? said(W.withdrawDone, { at: g.ended_at }) : 'waiting');
  }
  return out;
};

/** A free coach's payment reminder — waits while the registration still owes (part-payment keeps it). */
const paymentReminder: Resolver = async rows => {
  const out = new Map<string, Verdict>();
  const ids = uniq(rows.map(r => meta(r, 'registrationId')));
  if (!ids.length) return out;
  type T = { id: string; status: string | null; tournament_id: string; division_id: string; deposit_paid: number | null; total_paid: number | null; entry_lowered: number | null };
  const teams = await rowsIn<T>('teams', 'id, status, tournament_id, division_id, deposit_paid, total_paid, entry_lowered', 'id', ids);
  const [tournaments, divisions] = await Promise.all([
    rowsIn<DueTournament & { id: string; settings: unknown }>('tournaments', 'id, fee_schedule_mode, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date, settings', 'id', uniq(teams.map(t => t.tournament_id))),
    rowsIn<DueDivision & { id: string }>('divisions', 'id, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date', 'id', uniq(teams.map(t => t.division_id))),
  ]);
  const ours = await ourTeamIdsAmong(teams.map(t => t.id));
  const teamById = new Map(teams.map(t => [t.id, t]));
  const tournamentById = new Map(tournaments.map(t => [t.id, t]));
  const divisionById = new Map<string, DueDivision>(divisions.map(d => [d.id, d]));
  for (const r of rows) {
    const id = meta(r, 'registrationId');
    if (!id) continue;
    const t = teamById.get(id);
    if (!t || t.status !== 'accepted') { out.set(r.id, said(W.noLongerEntered)); continue; }
    const tournament = tournamentById.get(t.tournament_id);
    if (!tournament) continue;
    // "Not tracked here": nothing is owed on the platform any more, so nothing waits (the reminder route's own answer).
    if (!tournamentTracksPayments(tournament.settings)) { out.set(r.id, said(W.notTracked)); continue; }
    // Our own team owes no entry fee (owner 2026-10-21) — handled the way a paid team is.
    out.set(r.id, !ours.has(t.id) && registrationAmountDue(t, registrationFee(t, tournament, divisionById)) ? 'waiting' : said(W.paidInFull));
  }
  return out;
};

/** The club's card payment failed — settled only by good standing (`active`, `trialing`) or a cancelled plan. Every other
 *  state leaves it alone: Stripe's `past_due`, `unpaid`, `incomplete` all mean it still isn't paying, and none of them is
 *  "back in good standing" (/review 2026-10-16). */
const paymentFailed: Resolver = async rows => {
  const out = new Map<string, Verdict>();
  const orgs = new Map((await rowsIn<{ id: string; subscription_status: string | null }>('organizations', 'id, subscription_status', 'id', uniq(rows.map(r => r.org_id)))).map(o => [o.id, o.subscription_status]));
  for (const r of rows) {
    const status = orgs.get(r.org_id) ?? null;
    if (status === 'active' || status === 'trialing') out.set(r.id, said(W.billingGood));
    else if (!orgs.has(r.org_id) || status === 'canceled' || status === 'incomplete_expired') out.set(r.id, said(W.planCancelled));
    else out.set(r.id, 'waiting');
  }
  return out;
};

/** A team marked no-show — waits while the team is still marked no-show and its tournament isn't over (ruling
 *  2026-10-16). A notice from before it recorded its team: settled once every tournament of the club that was running
 *  on its date has ended. */
const noShow: Resolver = async rows => {
  const out = new Map<string, Verdict>();
  const today = tournamentToday();
  type Tn = { id: string; org_id: string; status: string | null; start_date: string | null; end_date: string | null };
  const over = (t: Tn) => t.status === 'completed' || t.status === 'archived' || (!!t.end_date && t.end_date < today);
  const recorded = rows.filter(r => meta(r, 'teamId'));
  const older = rows.filter(r => !meta(r, 'teamId'));
  const teams = recorded.length
    ? await rowsIn<{ id: string; name: string | null; check_in_status: string | null; tournament_id: string }>('teams', 'id, name, check_in_status, tournament_id', 'id', uniq(recorded.map(r => meta(r, 'teamId'))))
    : [];
  const [byTournament, byOrg] = await Promise.all([
    teams.length ? rowsIn<Tn>('tournaments', 'id, org_id, status, start_date, end_date', 'id', uniq(teams.map(t => t.tournament_id))) : Promise.resolve([] as Tn[]),
    older.length ? rowsIn<Tn>('tournaments', 'id, org_id, status, start_date, end_date', 'org_id', uniq(older.map(r => r.org_id))) : Promise.resolve([] as Tn[]),
  ]);
  const teamById = new Map(teams.map(t => [t.id, t]));
  const tournamentById = new Map(byTournament.map(t => [t.id, t]));
  for (const r of recorded) {
    const team = teamById.get(meta(r, 'teamId')!);
    if (!team) { out.set(r.id, said(W.teamRemoved)); continue; }
    const tournament = tournamentById.get(team.tournament_id);
    if (tournament && over(tournament)) out.set(r.id, said(W.tournamentOver));
    else if (team.check_in_status === 'no_show') out.set(r.id, 'waiting');
    else if (team.check_in_status === 'checked_in') out.set(r.id, said(W.checkedInAfterAll(team.name)));
    else out.set(r.id, said(W.noShowUndone));
  }
  const fortnightAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();
  for (const r of older) {
    const day = utcToZonedInputs(r.created_at).date;
    const running = byOrg.filter(t => t.org_id === r.org_id && t.start_date && t.start_date <= day && (t.end_date ?? t.start_date) >= day);
    if (running.length ? running.every(over) : r.created_at < fortnightAgo) out.set(r.id, said(W.tournamentOver));
    else out.set(r.id, 'waiting');
  }
  return out;
};

/** A family's payment the club passed to the head coach (Club Tier Stage 5c, Ask 28) — waits while the hand-off is
 *  `sent`. Record it (the coach's save) or Not received settles it, for every head coach it reached. */
const paymentHandedOff: Resolver = async rows => {
  const out = new Map<string, Verdict>();
  const ids = uniq(rows.map(r => meta(r, 'handoffId')));
  if (!ids.length) return out;
  type H = { id: string; team_id: string; state: string; resolved_by: string | null; resolved_at: string | null; payment_id: string | null };
  const byId = new Map((await rowsIn<H>('family_payment_handoffs', 'id, team_id, state, resolved_by, resolved_at, payment_id', 'id', ids)).map(h => [h.id, h]));
  // A Record it in flight: claimed (recorded) but its payment not yet stamped, within the last few minutes. It may still
  // be released back to waiting, so it is not settled yet — clearing it then would lose the ask for good (review 2026-10-19).
  const inFlight = (h: H) => h.state === 'recorded' && !h.payment_id && !!h.resolved_at && Date.parse(h.resolved_at) > Date.now() - 5 * 60_000;
  for (const r of rows) {
    const id = meta(r, 'handoffId');
    if (!id) continue; // names no hand-off: malformed, so never cleared on doubt
    const h = byId.get(id);
    const slug = slugOf(r.link);
    const dues = h && slug ? moneySectionHref(`/${slug}/coaches/teams/${h.team_id}`, 'dues') : null;
    if (h?.state === 'sent' || (h && inFlight(h))) out.set(r.id, 'waiting');
    else if (h?.state === 'recorded') out.set(r.id, { by: h.resolved_by, at: h.resolved_at, link: dues, words: (who, you) => ({ outcome: W.handOffRecorded(who, you) }) });
    else if (h?.state === 'not_received') out.set(r.id, { by: h.resolved_by, at: h.resolved_at, link: dues, words: (who, you) => ({ outcome: W.handOffNotReceived(who, you), then: W.handOffNotReceivedThen }) });
    else out.set(r.id, said(W.handOffGone, { link: null }));
  }
  return out;
};

/** Stripe needs something from the club (Club Tier Stage 12a) — waits while the Payouts card says "needs attention";
 *  clears itself when Stripe says the account is enabled again, or when the club disconnects. */
const payoutsNeedAttention: Resolver = async rows => {
  const out = new Map<string, Verdict>();
  const accounts = new Map((await rowsIn<PayoutsAccountRow>('org_payment_accounts', PAYOUTS_ACCOUNT_COLUMNS, 'org_id', uniq(rows.map(r => r.org_id)), undefined, 'org_id')).map(a => [a.org_id, a]));
  for (const r of rows) {
    const state = payoutsState(factsFromRow(accounts.get(r.org_id)));
    // Only Stripe saying payments work again settles it; "setting up" is still a wait (review 2026-10-25, M2).
    if (state === 'taking_payments') out.set(r.id, said(W.payoutsBack));
    else if (state === 'disconnected' || state === 'not_set_up') out.set(r.id, said(W.payoutsDisconnected));
    else out.set(r.id, 'waiting');
  }
  return out;
};

type OnlineRow = { id: string; status: string; landed_at: string | null };
const onlinePayments = (rows: NoticeRow[]) =>
  rowsIn<OnlineRow>('online_payments', 'id, status, landed_at', 'id', uniq(rows.map(r => meta(r, 'onlinePaymentId'))));

type OnlineItemRow = { id: string; amount: number; entry_id: string | null; land_error: string | null };
type ItemRefundRow = { online_payment_item_id: string; status: string; amount: number; fee_refunded: number };

/** A house-league child's share that could not land (Stage 12b, one notice per child, `onlinePaymentItemId`) — waits
 *  until that share is refunded in full or lands after all. The payment itself is landed (its other children may be
 *  recorded), so its `landed_at` never settles a child's notice. */
async function onlineItemsNotRecorded(rows: NoticeRow[], out: Map<string, Verdict>): Promise<void> {
  const ids = uniq(rows.map(r => meta(r, 'onlinePaymentItemId')));
  if (!ids.length) return;
  const [items, refunds] = await Promise.all([
    rowsIn<OnlineItemRow>('online_payment_items', 'id, amount, entry_id, land_error', 'id', ids),
    rowsIn<ItemRefundRow>('online_payment_refunds', 'online_payment_item_id, status, amount, fee_refunded', 'online_payment_item_id', ids,
      q => q.eq('status', 'succeeded')),
  ]);
  const byId = new Map(items.map(i => [i.id, i]));
  const refunded = new Map<string, number>();
  for (const f of refunds) refunded.set(f.online_payment_item_id, (refunded.get(f.online_payment_item_id) ?? 0) + Number(f.amount) - Number(f.fee_refunded));
  for (const r of rows) {
    const id = meta(r, 'onlinePaymentItemId');
    if (!id) continue;
    const item = byId.get(id);
    if (!item) out.set(r.id, said(W.onlinePaymentGone, { link: null }));
    else if (item.entry_id) out.set(r.id, said(W.onlineItemRecorded));
    else if (Math.round((refunded.get(id) ?? 0) * 100) >= Math.round(Number(item.amount) * 100)) out.set(r.id, said(W.onlinePaymentRefunded));
    else out.set(r.id, 'waiting');
  }
}

/** A paid online payment that could not land in the team's record (Stage 12a) — waits until it lands or is refunded. */
const onlinePaymentNotRecorded: Resolver = async rows => {
  const out = new Map<string, Verdict>();
  await onlineItemsNotRecorded(rows.filter(r => meta(r, 'onlinePaymentItemId')), out);
  const byId = new Map((await onlinePayments(rows.filter(r => !meta(r, 'onlinePaymentItemId')))).map(p => [p.id, p]));
  // A refund made in Stripe's own dashboard that we could not record (`stripeRefundId`): the payment is LANDED, so its
  // landed_at says nothing — the notice waits for THAT refund to be recorded (review 2026-10-25).
  const stripeIds = uniq(rows.map(r => meta(r, 'stripeRefundId')));
  const recordedRefunds = new Set(stripeIds.length
    ? (await rowsIn<{ stripe_refund_id: string }>('online_payment_refunds', 'stripe_refund_id', 'stripe_refund_id', stripeIds, q => q.eq('status', 'succeeded')))
      .map(f => f.stripe_refund_id)
    : []);
  for (const r of rows) {
    if (meta(r, 'onlinePaymentItemId')) continue;
    const id = meta(r, 'onlinePaymentId');
    if (!id) continue; // names no payment: malformed, so never cleared on doubt
    const p = byId.get(id);
    const stripeRefundId = meta(r, 'stripeRefundId');
    if (!p) out.set(r.id, said(W.onlinePaymentGone, { link: null }));
    else if (stripeRefundId) out.set(r.id, recordedRefunds.has(stripeRefundId) || p.status === 'refunded' ? said(W.refundRecorded) : 'waiting');
    else if (p.status === 'refunded') out.set(r.id, said(W.onlinePaymentRefunded));
    else if (p.landed_at) out.set(r.id, said(W.onlinePaymentRecorded));
    else out.set(r.id, 'waiting');
  }
  return out;
};

/** A refund that could not reach the card (Stage 12a) — waits until the payment is refunded (again, or another way).
 *  A house-league one (12b, `refundId`) waits on ITS refund: booked when Stripe accepted it, done once sent another way. */
const cardRefundFailed: Resolver = async rows => {
  const out = new Map<string, Verdict>();
  const refundIds = uniq(rows.map(r => meta(r, 'refundId')));
  const refundDone = new Set(refundIds.length
    ? (await rowsIn<{ id: string; status: string }>('online_payment_refunds', 'id, status', 'id', refundIds)).filter(f => f.status === 'succeeded').map(f => f.id)
    : []);
  const byId = new Map((await onlinePayments(rows.filter(r => !meta(r, 'refundId')))).map(p => [p.id, p]));
  for (const r of rows) {
    const refundId = meta(r, 'refundId');
    if (refundId) { out.set(r.id, refundDone.has(refundId) ? said(W.refundRecorded) : 'waiting'); continue; }
    const id = meta(r, 'onlinePaymentId');
    if (!id) continue;
    const p = byId.get(id);
    if (!p) out.set(r.id, said(W.onlinePaymentGone, { link: null }));
    else if (p.status === 'refunded') out.set(r.id, said(W.refundRecorded));
    else out.set(r.id, 'waiting');
  }
  return out;
};

/**
 * A bank debit returned while clearing, or reversed after it cleared (12c Part 6, `registrationIds` or `teamId`): the
 * family or team owes again — waits until it is paid in full, or the registration (team) ends.
 */
const debitOwedAgain: Resolver = async rows => {
  const out = new Map<string, Verdict>();
  const regIds = uniq(rows.flatMap(r => (meta(r, 'registrationIds') ?? '').split(',').filter(Boolean)));
  const teamIds = uniq(rows.map(r => meta(r, 'teamId')));
  const [regs, teams] = await Promise.all([
    // Read only: the one writer keeps the paid flag (house-league money guard).
    regIds.length ? rowsIn<{ id: string; status: string } & Record<string, unknown>>(
      'league_registrations', 'id, status, registration_fee_paid', 'id', regIds) : Promise.resolve([]),
    teamIds.length ? rowsIn<{ id: string; status: string; payment_status: string | null }>(
      'teams', 'id, status, payment_status', 'id', teamIds) : Promise.resolve([]),
  ]);
  const regById = new Map(regs.map(g => [g.id, g]));
  const teamById = new Map(teams.map(t => [t.id, t]));
  for (const r of rows) {
    const teamId = meta(r, 'teamId');
    if (teamId) {
      const t = teamById.get(teamId);
      if (!t || t.status !== 'accepted') out.set(r.id, said(W.withdrawDone));
      else out.set(r.id, t.payment_status === 'paid' ? said(W.paidInFull) : 'waiting');
      continue;
    }
    const kids = (meta(r, 'registrationIds') ?? '').split(',').filter(Boolean).map(id => regById.get(id));
    if (!kids.length) continue;
    const live = kids.filter(k => k && k.status !== 'declined' && k.status !== 'withdrawn');
    if (!live.length) out.set(r.id, said(W.withdrawDone));
    else if (live.every(k => k!['registration_fee_paid'] === true)) out.set(r.id, said(W.paidInFull));
    else out.set(r.id, 'waiting');
  }
  return out;
};

/** "Whose was it?" (12c, `unassignedRefundId`): a part refund made in Stripe on a payment for two or more children —
 *  waits until a person says whose it was (no Done: leaving it would keep the refund out of the book for good). */
const cardRefundWhose: Resolver = async rows => {
  const out = new Map<string, Verdict>();
  const ids = uniq(rows.map(r => meta(r, 'unassignedRefundId')));
  const byId = new Map((ids.length
    ? await rowsIn<{ id: string; assigned_at: string | null; assigned_by: string | null }>('online_refunds_unassigned', 'id, assigned_at, assigned_by', 'id', ids)
    : []).map(u => [u.id, u]));
  for (const r of rows) {
    const id = meta(r, 'unassignedRefundId');
    if (!id) continue;
    const u = byId.get(id);
    if (!u) out.set(r.id, said(W.onlinePaymentGone, { link: null }));
    else if (u.assigned_at) out.set(r.id, { by: u.assigned_by, at: u.assigned_at, words: () => ({ outcome: W.refundRecorded }) });
    else out.set(r.id, 'waiting');
  }
  return out;
};

/** "Still enrolled" (12c, `enrolledRefundId` + `registrationId`): a child's fee went back in Stripe while the child is
 *  registered — waits for the desk's answer (withdraw · email the pay link · keep), or for the child to end or pay again. */
const cardRefundStillEnrolled: Resolver = async rows => {
  const out = new Map<string, Verdict>();
  const refundIds = uniq(rows.map(r => meta(r, 'enrolledRefundId')));
  const regIds = uniq(rows.map(r => meta(r, 'registrationId')));
  const [refunds, regs] = await Promise.all([
    refundIds.length ? rowsIn<{ id: string; family_answer: string | null; family_answer_by: string | null; family_answer_at: string | null }>(
      'online_payment_refunds', 'id, family_answer, family_answer_by, family_answer_at', 'id', refundIds) : Promise.resolve([]),
    regIds.length ? rowsIn<{ id: string; status: string; ended_at: string | null; player_first_name: string }>(
      'league_registrations', 'id, status, ended_at, player_first_name', 'id', regIds) : Promise.resolve([]),
  ]);
  const refundById = new Map(refunds.map(f => [f.id, f]));
  const regById = new Map(regs.map(g => [g.id, g]));
  for (const r of rows) {
    const f = refundById.get(meta(r, 'enrolledRefundId') ?? '');
    const g = regById.get(meta(r, 'registrationId') ?? '');
    if (!f || !g) { out.set(r.id, said(W.onlinePaymentGone, { link: null })); continue; }
    if (g.status === 'declined' || g.status === 'withdrawn' || f.family_answer === 'withdraw') out.set(r.id, said(W.withdrawDone, { at: g.ended_at }));
    else if (f.family_answer === 'link') out.set(r.id, { by: f.family_answer_by, at: f.family_answer_at, words: (who, you) => ({ outcome: W.payLinkEmailed(who, you) }) });
    else if (f.family_answer === 'keep') {
      const child = g.player_first_name;
      out.set(r.id, { by: f.family_answer_by, at: f.family_answer_at, words: (who, you) => ({ outcome: W.keptEnrolled(child, who, you) }) });
    } else out.set(r.id, 'waiting');
  }
  return out;
};

/** A refund made in Stripe that matched no payment we recorded (12c, `unmatchedStripeRefundId`): events arrive out of
 *  order — it settles once the payment lands and the refund is recorded on it. */
/** 12d-2 (words §5.2): the new terms item clears itself when the club agrees to that version (or a later one), or
 *  disconnects. No Done. */
type TermsAccount = { org_id: string; terms_version: string | null; terms_agreed_by: string | null; terms_agreed_at: string | null; disconnected_at: string | null };
const paymentsTermsChanged: Resolver = async rows => {
  const out = new Map<string, Verdict>();
  const accounts = new Map((await rowsIn<TermsAccount>('org_payment_accounts', 'org_id, terms_version, terms_agreed_by, terms_agreed_at, disconnected_at', 'org_id', uniq(rows.map(r => r.org_id)), undefined, 'org_id')).map(a => [a.org_id, a]));
  for (const r of rows) {
    const a = accounts.get(r.org_id);
    const asked = meta(r, 'termsVersion');
    if (!a || a.disconnected_at) out.set(r.id, said(W.payoutsDisconnected));
    else if (a.terms_version && asked && a.terms_version >= asked && a.terms_version !== 'placeholder-counsel-pending') {
      out.set(r.id, { by: a.terms_agreed_by, at: a.terms_agreed_at, words: (who, you) => ({ outcome: W.termsAgreed(who, you) }) });
    } else out.set(r.id, 'waiting');
  }
  return out;
};

/** 12d-2 (words §4.2): an ending the owner didn't choose clears itself once it has passed (its pages closed by the daily
 *  job) or stops coming (free time moved, the subscription payment went through), or the club disconnects. */
const paymentsEnding: Resolver = async rows => {
  const out = new Map<string, Verdict>();
  const { upcomingEnding } = await import('./online-payment-endings');
  const accounts = new Map((await rowsIn<TermsAccount>('org_payment_accounts', 'org_id, terms_version, terms_agreed_by, terms_agreed_at, disconnected_at', 'org_id', uniq(rows.map(r => r.org_id)), undefined, 'org_id')).map(a => [a.org_id, a]));
  const now = new Date();
  for (const r of rows) {
    const a = accounts.get(r.org_id);
    if (!a || a.disconnected_at) { out.set(r.id, said(W.payoutsDisconnected)); continue; }
    const endingFor = meta(r, 'endingFor');
    const kind = meta(r, 'endingKind');
    if (kind === 'comp' && endingFor && endingFor <= now.toISOString()) { out.set(r.id, said(W.endingPassed)); continue; }
    // A read that fails keeps it waiting: a settle is final, and a blip must never retire a live warning (/review).
    let still: Awaited<ReturnType<typeof upcomingEnding>>;
    try { still = await upcomingEnding(r.org_id, now); } catch { out.set(r.id, 'waiting'); continue; }
    if (still && still.at === endingFor) { out.set(r.id, 'waiting'); continue; }
    if (still) { out.set(r.id, said(W.endingPassed)); continue; } // a newer ending replaced it (its own item says so)
    // Nothing coming any more: a comp moved later, or the payment went through — payments carry on. A failed payment that
    // ended in a suspension stopped them.
    const facts = await effectiveOrgFactsForId(r.org_id).catch(() => null);
    if (!facts) { out.set(r.id, 'waiting'); continue; }
    out.set(r.id, said(facts.subscriptionStatus === 'canceled' || !hasPlanFeature(facts.planId, 'online_payments') ? W.endingPassed : W.endingOff));
  }
  return out;
};

const cardRefundUnmatched: Resolver = async rows => {
  const out = new Map<string, Verdict>();
  const ids = uniq(rows.map(r => meta(r, 'unmatchedStripeRefundId')));
  const recorded = new Set(ids.length
    ? (await rowsIn<{ stripe_refund_id: string }>('online_payment_refunds', 'stripe_refund_id', 'stripe_refund_id', ids)).map(f => f.stripe_refund_id)
    : []);
  const waiting = new Set(ids.length
    ? (await rowsIn<{ stripe_refund_id: string }>('online_refunds_unassigned', 'stripe_refund_id', 'stripe_refund_id', ids)).map(f => f.stripe_refund_id)
    : []);
  for (const r of rows) {
    const id = meta(r, 'unmatchedStripeRefundId');
    if (!id) continue;
    out.set(r.id, recorded.has(id) || waiting.has(id) ? said(W.refundRecorded, { words: () => ({ outcome: W.refundRecorded, then: W.onlineItemRecorded }) }) : 'waiting');
  }
  return out;
};

/**
 * A team paid past what it owed (12d-1, `onlinePaymentId`): waits while any of the extra still stands
 * (`online_payment_over_left`, read live through the landing — the one module that calls it). Settles on the refund to
 * the card, a refund recorded another way, "Keep it", or an entry raised so nothing is extra.
 */
const onlinePaymentOver: Resolver = async rows => {
  const out = new Map<string, Verdict>();
  const ids = uniq(rows.map(r => meta(r, 'onlinePaymentId')));
  if (!ids.length) return out;
  // Imported when needed: the landing imports this module (clearSettled), so a load-time import would be a cycle.
  const { overLeft } = await import('./online-payment-landing');
  const [ops, refunds, left] = await Promise.all([
    rowsIn<{ id: string; rail: string; over_amount: number | null; over_kept_at: string | null; over_kept_by: string | null }>(
      'online_payments', 'id, rail, over_amount, over_kept_at, over_kept_by', 'id', ids),
    rowsIn<{ online_payment_id: string; stripe_refund_id: string | null; failure_reason: string | null; succeeded_at: string | null; created_by: string | null }>(
      'online_payment_refunds', 'online_payment_id, stripe_refund_id, failure_reason, succeeded_at, created_by', 'online_payment_id', ids, q => q.eq('status', 'succeeded')),
    overLeft(ids),
  ]);
  const byId = new Map(ops.map(o => [o.id, o]));
  for (const r of rows) {
    const id = meta(r, 'onlinePaymentId');
    if (!id) continue;
    const o = byId.get(id);
    if (!o) { out.set(r.id, said(W.onlinePaymentGone, { link: null })); continue; }
    if ((left.get(id) ?? 0) > 0) { out.set(r.id, 'waiting'); continue; }
    if (o.over_kept_at) { out.set(r.id, { by: o.over_kept_by, at: o.over_kept_at, words: () => ({ outcome: W.overKept }) }); continue; }
    const back = refunds.filter(f => f.online_payment_id === id);
    const toCard = back.find(f => f.stripe_refund_id && !f.failure_reason);
    if (toCard) {
      const extra = formatMoney(Number(o.over_amount ?? 0));
      out.set(r.id, { by: toCard.created_by, at: toCard.succeeded_at, words: () => ({ outcome: W.overRefunded(extra, o.rail === 'bank_debit') }) });
    } else if (back.length) out.set(r.id, said(W.refundRecorded));
    else out.set(r.id, said(W.overEntryRaised));
  }
  return out;
};

type DisputeRow = { id: string; status: string; answered: boolean; answered_at: string | null; closed_at: string | null; won_back_at: string | null };
const DISPUTE_CLOSED = new Set(['won', 'lost', 'prevented', 'warning_closed']);
const disputes = (rows: NoticeRow[]) =>
  rowsIn<DisputeRow>('online_payment_disputes', 'id, status, answered, answered_at, closed_at, won_back_at', 'id', uniq(rows.map(r => meta(r, 'onlineDisputeId'))));

/**
 * A card payment is disputed (12d-1, `onlineDisputeId`; words §1.4). The answerer's copy (raised with `answerer: 'yes'`
 * — the contract Part 3's raise keeps) clears once the answer is sent; every other copy waits for the bank's decision.
 * Won, prevented or an inquiry that closed read "won"; lost reads lost (its own item, `card_dispute_lost`, takes over).
 */
const cardDisputed: Resolver = async rows => {
  const out = new Map<string, Verdict>();
  const byId = new Map((await disputes(rows)).map(d => [d.id, d]));
  for (const r of rows) {
    const id = meta(r, 'onlineDisputeId');
    if (!id) continue;
    const d = byId.get(id);
    if (!d) out.set(r.id, said(W.onlinePaymentGone, { link: null }));
    else if (DISPUTE_CLOSED.has(d.status)) out.set(r.id, said(d.status === 'lost' ? W.disputeLost : W.disputeWon, { at: d.closed_at }));
    else if (meta(r, 'answerer') === 'yes' && d.answered) out.set(r.id, said(W.disputeAnswered, { at: d.answered_at }));
    else out.set(r.id, 'waiting');
  }
  return out;
};

/**
 * A dispute was lost (12d-1, `onlineDisputeId` + `teamId` or `registrationIds`; words §1.4): the child or team owes
 * again — it waits, as a reversed debit does, until paid in full or ended; and settles at once if the bank later turns the
 * loss into a win (the money is put back).
 */
const cardDisputeLost: Resolver = async rows => {
  const byId = new Map((await disputes(rows)).map(d => [d.id, d]));
  const out = await debitOwedAgain(rows);
  for (const r of rows) {
    const d = byId.get(meta(r, 'onlineDisputeId') ?? '');
    if (d?.won_back_at) out.set(r.id, said(W.disputeWon, { at: d.won_back_at }));
  }
  return out;
};

/** THE RULEBOOK — one entry per Needs-attention kind (`NeedsAttentionKind` makes it total). */
export const NEEDS_ATTENTION_END: Record<NeedsAttentionKind, Resolver> = {
  club_hand_back_asked: handBackAsked,
  club_hand_back_unasked: handBackUnasked,
  team_request_filed: requestFiled,
  team_money_sent: moneySent,
  team_request_holding_payout: holdingPayout,
  club_schedule_review: scheduleReview,
  team_move_requested: teamMove,
  assistant_coach_approval_requested: assistantApproval,
  team_coach_payment_reminder: paymentReminder,
  payment_failed: paymentFailed,
  team_no_show: noShow,
  club_payment_handed_off: paymentHandedOff,
  payouts_need_attention: payoutsNeedAttention,
  online_payment_not_recorded: onlinePaymentNotRecorded,
  card_refund_failed: cardRefundFailed,
  house_league_withdraw_request: withdrawRequest,
  card_refund_whose: cardRefundWhose,
  card_refund_still_enrolled: cardRefundStillEnrolled,
  card_refund_unmatched: cardRefundUnmatched,
  payments_terms_changed: paymentsTermsChanged,
  payments_ending: paymentsEnding,
  debit_returned: debitOwedAgain,
  debit_reversed: debitOwedAgain,
  online_payment_over: onlinePaymentOver,
  card_disputed: cardDisputed,
  card_dispute_lost: cardDisputeLost,
};

const isNeedsAttention = (eventType: string): eventType is NeedsAttentionKind => (NEEDS_ATTENTION_KINDS as readonly string[]).includes(eventType);

/** Each notification's verdict, one batch per kind. A kind whose read fails leaves its notifications alone. */
async function verdictsFor(rows: readonly NoticeRow[]): Promise<Map<string, Verdict>> {
  const byKind = new Map<NeedsAttentionKind, NoticeRow[]>();
  for (const r of rows) if (isNeedsAttention(r.event_type)) (byKind.get(r.event_type) ?? byKind.set(r.event_type, []).get(r.event_type)!).push(r);
  const maps = await Promise.all([...byKind].map(([kind, list]) => NEEDS_ATTENTION_END[kind](list).catch(e => {
    console.error(`[needs-attention] ${kind} could not be read (left as it is):`, e);
    return new Map<string, Verdict>();
  })));
  return new Map(maps.flatMap(m => [...m]));
}

const isSettled = (v: Verdict | undefined): v is Settled => !!v && v !== 'waiting';

/** The orgs among these that the reader is still an active member of. */
async function memberOrgs(readerId: string, orgIds: readonly string[]): Promise<Set<string>> {
  if (!orgIds.length) return new Set();
  const { data, error } = await supabaseAdmin.from('organization_members').select('organization_id')
    .eq('user_id', readerId).eq('status', 'active').in('organization_id', [...orgIds]);
  if (error) throw error;
  return new Set((data ?? []).map(m => m.organization_id as string));
}

/** Who did it, by the name the club holds for them; the account's own (one Auth lookup each) only for someone the club
 *  holds no name for (/review 2026-10-16: every list open looked each person up in Auth). */
async function namesIn(orgId: string, ids: readonly string[]): Promise<(id: string) => string | null> {
  const { data, error } = await supabaseAdmin.from('organization_members').select('user_id, display_name')
    .eq('organization_id', orgId).in('user_id', [...ids]);
  if (error) throw error;
  const named = new Map((data ?? []).filter(m => m.display_name).map(m => [m.user_id as string, m.display_name as string]));
  const rest = ids.filter(id => !named.has(id));
  const fallback = rest.length ? await resolvePersonNamer(orgId, rest) : () => null;
  return (id: string) => named.get(id) ?? fallback(id);
}

/** Clear these notifications: Done for everyone, and read where still unread. */
async function clearIds(ids: readonly string[]): Promise<void> {
  const now = new Date().toISOString();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    // Read FIRST, then Done: a failure between the two leaves a read row still uncleared, which the next pass re-selects
    // and finishes. The other order left a cleared row unread for good — the pass never looks at a cleared one (/review).
    const { error: readError } = await supabaseAdmin.from('notifications').update({ read_at: now }).in('id', chunk).is('read_at', null);
    if (readError) throw readError;
    const { error } = await supabaseAdmin.from('notifications').update({ cleared_at: now }).in('id', chunk).is('cleared_at', null);
    if (error) throw error;
  }
}

/** A reader's pass runs at most once per PASS_GAP_MS for each bell, per server instance (/review 2026-10-16): the bell and
 *  the phone bar both count on load, and every read or Done re-counts, so a burst re-read the same waiting records each
 *  time. Best-effort — the host runs several instances — and enough: a settle step clears on the spot, so the gap only
 *  delays what time passing or the daily sweep settles. */
const PASS_GAP_MS = 15_000;
const lastPass = new Map<string, number>();

/** ON READ — a reader's own Needs-attention notifications in this bell, cleared where settled. Runs before the bell's
 *  list and count are read, so neither ever shows a settled one as waiting. */
export async function clearSettledForReader(userId: string, bell: BellSource): Promise<void> {
  const key = `${userId}|${bell}`, now = Date.now();
  if ((lastPass.get(key) ?? 0) > now - PASS_GAP_MS) return;
  if (lastPass.size > 5000) lastPass.clear();
  lastPass.set(key, now);
  try {
    const { orgId, only } = bellReadFilter(bell);
    const kinds = only ? NEEDS_ATTENTION_KINDS.filter(k => only.includes(k)) : NEEDS_ATTENTION_KINDS;
    if (!kinds.length) return;
    let q = supabaseAdmin.from('notifications').select(SELECT).eq('user_id', userId).is('cleared_at', null).in('event_type', kinds).limit(500);
    if (orgId) q = q.eq('org_id', orgId);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as NoticeRow[];
    if (!rows.length) return;
    const verdicts = await verdictsFor(rows);
    await clearIds(rows.filter(r => isSettled(verdicts.get(r.id))).map(r => r.id));
  } catch (e) {
    console.error('[needs-attention] the reader’s pass failed (the bell still reads):', e);
  }
}

/** ON THE SPOT — after a settle step lands: every copy, for everyone, of these kinds in these orgs. Awaited by the
 *  caller (a promise left running after a response can be dropped on the host), and it never throws. */
export async function clearSettled(p: { orgIds: readonly (string | null | undefined)[]; kinds: readonly NeedsAttentionKind[] }): Promise<void> {
  try {
    const orgIds = uniq(p.orgIds);
    if (!orgIds.length || !p.kinds.length) return;
    const { data, error } = await supabaseAdmin.from('notifications').select(SELECT)
      .in('org_id', orgIds).in('event_type', [...p.kinds]).is('cleared_at', null).limit(2000);
    if (error) throw error;
    const rows = (data ?? []) as NoticeRow[];
    if (!rows.length) return;
    const verdicts = await verdictsFor(rows);
    await clearIds(rows.filter(r => isSettled(verdicts.get(r.id))).map(r => r.id));
  } catch (e) {
    console.error('[needs-attention] clearing on the spot failed (the next read clears it):', e);
  }
}

/** THE READER'S LINES (A2) — for the Needs-attention kinds in a page of the list, what happened to each one that is
 *  settled, worded for this reader. Never throws: a list without its lines still reads. */
export async function settledLines(rows: readonly NoticeRow[], readerId: string): Promise<Map<string, SettledNotice>> {
  const out = new Map<string, SettledNotice>();
  try {
    const kinds = rows.filter(r => isNeedsAttention(r.event_type));
    if (!kinds.length) return out;
    // A former member's old notifications keep their words, never live outcomes (/review 2026-10-16). A free coach's
    // own notices are filed under a host club they are not a member of, so they pass by kind.
    const active = await memberOrgs(readerId, uniq(kinds.map(r => r.org_id)));
    const act = kinds.filter(r => isTeamCoachEvent(r.event_type) || active.has(r.org_id));
    if (!act.length) return out;
    const verdicts = await verdictsFor(act);
    const people = new Map<string, Set<string>>();
    for (const r of act) {
      const v = verdicts.get(r.id);
      if (isSettled(v) && v.by && v.by !== readerId) (people.get(r.org_id) ?? people.set(r.org_id, new Set()).get(r.org_id)!).add(v.by);
    }
    const namers = new Map(await Promise.all([...people].map(async ([org, ids]) => [org, await namesIn(org, [...ids])] as const)));
    for (const r of act) {
      const v = verdicts.get(r.id);
      if (!isSettled(v)) continue;
      const you = !!v.by && v.by === readerId;
      const who = v.by && !you ? namers.get(r.org_id)?.(v.by) ?? null : null;
      const w = v.words(who, you);
      const line: SettledNotice = { outcome: w.outcome, at: v.at, then: w.then ?? null };
      if (v.link !== undefined) line.link = v.link;
      out.set(r.id, line);
    }
  } catch (e) {
    console.error('[needs-attention] the settled lines could not be read:', e);
  }
  return out;
}

/** THE DOORS (A5) — what happened to the ask or request a page was opened for, read through the reader's OWN
 *  notification about it (so nobody reads the outcome of something they were never told about). */
export async function doorOutcome(readerId: string, q: { handBackId?: string; requestId?: string }): Promise<
  | { found: false }
  | { found: true; waiting: true }
  | { found: true; waiting: false; door: (DoorOutcome & { who: string | null; you: boolean }) | null }
> {
  let row: NoticeRow | null = null;
  const base = () => supabaseAdmin.from('notifications').select(SELECT).eq('user_id', readerId);
  const first = async (build: (b: ReturnType<typeof base>) => ReturnType<typeof base>) => {
    const { data, error } = await build(base()).limit(1).maybeSingle();
    if (error) throw error;
    return (data as NoticeRow | null) ?? null;
  };
  if (q.handBackId) row = await first(b => b.eq('event_type', 'club_hand_back_asked').eq('metadata->>handBackId', q.handBackId!));
  else if (q.requestId) {
    row = await first(b => b.eq('event_type', 'team_request_filed').eq('metadata->>requestId', q.requestId!))
      ?? await first(b => b.eq('event_type', 'club_hand_back_asked').like('link', `%request=${q.requestId}%`));
  }
  if (!row) return { found: false };
  // A former member reads nothing live through an old notification (/review 2026-10-16).
  if (!isTeamCoachEvent(row.event_type) && !(await memberOrgs(readerId, [row.org_id])).has(row.org_id)) return { found: false };
  const v = (await verdictsFor([row])).get(row.id);
  if (!isSettled(v)) return { found: true, waiting: true };
  const door = v.door ?? null;
  if (!door) return { found: true, waiting: false, door: null };
  const by = 'by' in door ? door.by : null;
  const you = !!by && by === readerId;
  const who = by && !you ? (await namesIn(row.org_id, [by]))(by) : null;
  // The page needs the name, never the account id behind it.
  if (door.kind === 'ask') return { found: true, waiting: false, door: { kind: 'ask', verb: door.verb, team: door.team, at: door.at, by: null, who, you } };
  return { found: true, waiting: false, door: { ...door, who, you } };
}
