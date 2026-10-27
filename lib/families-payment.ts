import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import type { AuthContextWithRole } from './api-auth';
import { getLeagueSeasonById, resolvePersonNamer } from './db';
import { loadHeadCoaches, loadTeamSeasons } from './club-team-board';
import { liveSeasonOf } from './season-live';
import { senderName } from './families-coach-ask';
import { moneyCents as cents } from './club-schedule-words';
import { emailHtml } from './club-schedule-send';
import { sendEmail } from './email';
import { notify } from './notify';
import { fetchAll, inParallel } from './supabase-paging';
import { clearSettled } from './needs-attention';
import { canMarkLeagueFeePaid, writeLeagueMoney } from './league-fee-paid';
import { futureReceivedDateRefusal } from './money-date-guards';
import { methodWord } from './club-money-words';
import { fmt } from './coach-money-summary';
import { formatStoredDate } from './timezone';
import { moneySectionHref } from './coach-money-links';
import { writeOrgAudit } from './org-audit';
import { DUES_PAYMENT_METHODS } from './types';
import { readRepMoney, type FamilyPagePayload } from './families-read';
import {
  HANDOFF_NOTE_MAX, PAYMENT_MAX_CENTS, placement,
  type PaymentLine, type PaymentPlan, type RepPaymentLine,
} from './families-payment-plan';
import { FAMILY_COACH_ASK_WORDS, FAMILY_HANDOFF_COACH_WORDS as CW, FAMILY_PAYMENT_WORDS as W } from './families-words';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * RECORD A PAYMENT, AND THE HAND-OFF TO THE HEAD COACH (Club Tier Stage 5c, Parts B + C; owner Asks 26–28, 2026-10-19).
 *
 * ⚖ THE CLUB NEVER WRITES A TEAM'S BOOK (Ask 26, D1/D3). A rep payment is one write with two effects (the child's dues
 * and an income line in the TEAM's ledger), so no club door may record one: this file never imports
 * `recordRepDuesPayment` and never writes `rep_dues_payments` / `rep_dues_credits` — the stage guard fails the build if
 * any `app/api/admin/**` or this file does. The family record's window records the club's OWN money (a house-league
 * fee, through `writeLeagueMoney`, the Registrations Mark received's one write) and HANDS each rep line to the team's head coach:
 * a `family_payment_handoffs` row (mig 338), delivered the way Ask the coaches reaches coaches (colleague mail that
 * replies to the sender, a "Your club" bell — never `sendFamilyEmail`: nothing in 5c reaches a family). The coach's own
 * Record money writes the payment, carrying the hand-off's id (`claimHandoffForPayment` below).
 *
 * Who: whoever can open Families (the route's gate). A house-league line also needs the fee permission (owner, club
 * admin, league admin, league registrar — `canMarkLeagueFeePaid`, the house-league gate's `takeFees`); a rep line is a send and needs Families alone (Ask 27).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const shortDay = (d: string) => formatStoredDate(d, { withYear: false });

interface Recipient { userId: string; name: string | null; email: string | null }

/** Each rep line's team: is the line's season the team's LIVE one, and who receives a hand-off (never the sender). */
async function teamReach(ctx: AuthContextWithRole, teamIds: readonly string[]) {
  const unique = [...new Set(teamIds)];
  const [heads, seasons] = await Promise.all([loadHeadCoaches(ctx.org.id, unique), loadTeamSeasons(unique)]);
  // The team's LIVE season, by the one rule (`liveSeasonOf` — getActiveRepProgramYear's), from one read for every team.
  const liveYear = new Map(unique.map(id => [id,
    liveSeasonOf((seasons.get(id) ?? []).map(s => ({ ...s, createdAt: s.created_at })))?.id ?? null] as const));
  const reach = new Map<string, { recipients: Recipient[]; onlyYou: boolean }>();
  for (const id of unique) {
    const people = heads.get(id)?.people ?? [];
    reach.set(id, {
      recipients: people.filter(p => p.userId !== ctx.user.id).map(p => ({ userId: p.userId, name: p.name, email: p.email })),
      onlyYou: people.length > 0 && people.every(p => p.userId === ctx.user.id),
    });
  }
  return { liveYear, reach };
}

/** The hand-offs still waiting on a coach, per roster row, in cents. */
async function pendingByRoster(orgId: string, rosterIds: readonly string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!rosterIds.length) return out;
  const { data, error } = await supabaseAdmin.from('family_payment_handoffs').select('roster_player_id, amount')
    .eq('org_id', orgId).eq('state', 'sent').in('roster_player_id', [...rosterIds]);
  if (error) throw error;
  for (const r of data ?? []) {
    const id = r.roster_player_id as string;
    out.set(id, (out.get(id) ?? 0) + Math.round(Number(r.amount) * 100));
  }
  return out;
}

/** The window's lines for one family: every child who owes this season, each with what it can take or why not. */
export async function paymentPlan(ctx: AuthContextWithRole, page: FamilyPagePayload): Promise<{ plan: PaymentPlan; recipients: Map<string, Recipient[]> }> {
  const owing = page.childLines.filter(l => l.current && (
    (l.money && l.money.balanceCents > 0) || (l.leagueReg && l.league?.feeCents != null && l.league.balanceCents > 0)));
  const repTeams = owing.flatMap(l => (l.money ? [l.money.teamId] : []));
  const [{ liveYear, reach }, pending] = await Promise.all([
    teamReach(ctx, repTeams),
    pendingByRoster(ctx.org.id, owing.flatMap(l => (l.money ? [l.money.rosterRowId] : []))),
  ]);
  const feeAllowed = canMarkLeagueFeePaid(ctx);
  const lines: PaymentLine[] = [];
  const recipients = new Map<string, Recipient[]>();
  for (const l of owing) {
    const m = l.money;
    if (!m) {
      // `owing` admitted it: an accepted house-league child with a balance. What the window places is that balance — the
      // whole fee, or what is left after a price rise (9b-2: the book can hold part of a fee).
      lines.push({
        kind: 'league', key: l.key, childName: l.childName, where: l.where, feeCents: l.league!.balanceCents,
        regId: l.leagueReg!.id, seasonId: l.leagueReg!.seasonId, reason: feeAllowed ? null : W.reasonNoFeePermission,
      });
      continue;
    }
    const r = reach.get(m.teamId) ?? { recipients: [], onlyYou: false };
    recipients.set(m.teamId, r.recipients);
    lines.push({
      kind: 'rep', key: l.key, childName: l.childName, teamName: m.where, year: m.year,
      balanceCents: m.balanceCents, pendingCents: pending.get(m.rosterRowId) ?? 0,
      rosterRowId: m.rosterRowId, teamId: m.teamId, programYearId: m.programYearId,
      coaches: r.recipients.map(c => c.name ?? c.email ?? 'the head coach'),
      reason: liveYear.get(m.teamId) !== m.programYearId ? W.reasonClosed(m.where)
        : r.onlyYou ? W.reasonOnlyYou(m.where)
        : r.recipients.length === 0 ? W.reasonNoHead(m.where)
        : null,
    });
  }
  return { plan: { lines }, recipients };
}

// ── The record's chips and History ──────────────────────────────────────────────────────────────

export interface HandoffRow {
  id: string; roster_player_id: string | null; player_name: string; team_id: string; amount: number; received_date: string;
  method: string | null; note: string | null; sent_by: string | null; sent_at: string; sent_to: string[];
  state: 'sent' | 'recorded' | 'not_received'; resolved_by: string | null; resolved_at: string | null;
  /** What the coach's receipt says, when it stands — the coach may record a different amount than the club sent. */
  recorded_amount: number | null;
}

/** A family's hand-offs, newest first (the record, the file — every one, paged). */
export async function readHandoffs(orgId: string, personId: string): Promise<HandoffRow[]> {
  const rows = await fetchAll<any>((from, to) => supabaseAdmin.from('family_payment_handoffs') // eslint-disable-line @typescript-eslint/no-explicit-any
    .select('id, roster_player_id, player_name, team_id, amount, received_date, method, note, sent_by, sent_at, sent_to, state, resolved_by, resolved_at, rep_dues_payments(amount)')
    .eq('org_id', orgId).eq('person_id', personId).order('sent_at', { ascending: false }).order('id').range(from, to));
  return rows.map(({ rep_dues_payments: paid, ...r }) => ({
    ...r, amount: Number(r.amount), sent_to: r.sent_to ?? [], recorded_amount: paid?.amount != null ? Number(paid.amount) : null,
  }));
}

/** The chip beside each child: the NEWEST hand-off for the line's roster row — sent (amber) or not received (red). */
export function handoffChips(page: FamilyPagePayload, rows: readonly HandoffRow[]): Record<string, 'sent' | 'not_received'> {
  const out: Record<string, 'sent' | 'not_received'> = {};
  for (const l of page.childLines) {
    if (!l.money) continue;
    // A hand-off still waiting shows, whatever came after it; otherwise the newest (rows are newest first) — a Not received.
    const mine = rows.filter(r => r.roster_player_id === l.money!.rosterRowId);
    const shown = mine.find(r => r.state === 'sent') ?? mine[0];
    if (shown && shown.state !== 'recorded') out[l.key] = shown.state;
  }
  return out;
}

/** Everyone a set of hand-offs names (and any `also`), by the club's name for them — one lookup. */
export async function handoffNamer(orgId: string, rows: readonly HandoffRow[], also: readonly (string | null)[] = []) {
  return resolvePersonNamer(orgId, [...new Set([...rows.flatMap(r => [r.sent_by, r.resolved_by, ...r.sent_to]), ...also].filter((x): x is string => !!x))]);
}

/** History's lines: the send, and what came of it. */
export async function handoffHistory(orgId: string, rows: readonly HandoffRow[]): Promise<{ at: string; what: string }[]> {
  if (!rows.length) return [];
  const nameOf = await handoffNamer(orgId, rows);
  const out: { at: string; what: string }[] = [];
  for (const r of rows) {
    const amount = fmt(r.amount);
    const coaches = r.sent_to.map(id => nameOf(id)).filter((n): n is string => !!n);
    out.push({ at: r.sent_at, what: W.historySent(amount, r.player_name, coaches, r.sent_by ? nameOf(r.sent_by) : null) });
    const outcome = r.state === 'recorded' ? W.historyRecorded : r.state === 'not_received' ? W.historyNotReceived : null;
    const answered = r.state === 'recorded' && r.recorded_amount != null ? fmt(r.recorded_amount) : amount;
    if (outcome && r.resolved_at) out.push({ at: r.resolved_at, what: outcome(answered, r.player_name, r.resolved_by ? nameOf(r.resolved_by) : null) });
  }
  return out;
}

// ── The press ──────────────────────────────────────────────────────────────────────────────────

export type RecordPaymentResult =
  | { ok: true; fees: string[]; sends: { child: string; amount: string; coaches: string[] }[]; said: string }
  | { ok: false; status: number; body: { error: string; code: string; done?: string } };

const refuse = (status: number, code: string, error: string, done?: string): RecordPaymentResult =>
  ({ ok: false, status, body: { error, code, ...(done ? { done } : {}) } });

/**
 * One press. EVERY line is validated against a fresh plan before anything is written; then the fees are marked (each
 * through the Registrations tick's one write), then the hand-offs are made and delivered. It reports exactly what was
 * done — a fee the fiscal year refuses part-way stops the press there and says which fees were recorded.
 */
export async function recordFamilyPayment(ctx: AuthContextWithRole, page: FamilyPagePayload, raw: Record<string, unknown>): Promise<RecordPaymentResult> {
  const amountCents = raw.amountCents;
  const receivedDate = raw.receivedDate;
  const method = raw.method == null || raw.method === '' ? null : raw.method;
  const note = typeof raw.note === 'string' ? raw.note.trim() || null : null;
  const asked = Array.isArray(raw.lines) ? raw.lines : null;
  if (typeof amountCents !== 'number' || !Number.isInteger(amountCents) || amountCents <= 0 || amountCents > PAYMENT_MAX_CENTS) {
    return refuse(400, 'amount', W.nothingYet);
  }
  if (typeof receivedDate !== 'string' || !isCalendarDate(receivedDate)) return refuse(400, 'date', W.changed);
  if (futureReceivedDateRefusal(receivedDate, 'payment')) return refuse(400, 'date_future', W.dateFuture);
  if (method !== null && (typeof method !== 'string' || !(DUES_PAYMENT_METHODS as readonly string[]).includes(method))) return refuse(400, 'method', W.changed);
  if (note && note.length > HANDOFF_NOTE_MAX) return refuse(400, 'note', W.changed);
  if (!asked || asked.length === 0) return refuse(400, 'lines', W.nothingYet);

  const { plan, recipients } = await paymentPlan(ctx, page);
  const byKey = new Map(plan.lines.map(l => [l.key, l]));
  const placed: Record<string, number> = {};
  const chosen: { line: PaymentLine; cents: number }[] = [];
  for (const a of asked as unknown[]) {
    const key = (a as { key?: unknown })?.key, c = (a as { cents?: unknown })?.cents;
    if (typeof key !== 'string' || typeof c !== 'number' || !Number.isInteger(c) || c <= 0 || c > PAYMENT_MAX_CENTS || key in placed) {
      return refuse(400, 'lines', W.changed);
    }
    const line = byKey.get(key);
    // A line that is gone, refused or (a fee) not whole: the window and the record no longer agree.
    if (!line) return refuse(409, 'changed', W.changed);
    if (line.reason) return refuse(409, 'line_refused', line.reason);
    if (line.kind === 'league' && c !== line.feeCents) return refuse(409, 'changed', W.changed);
    placed[key] = c;
    chosen.push({ line, cents: c });
  }
  const { leftCents } = placement(amountCents, placed);
  if (leftCents > 0) return refuse(400, 'left_to_place', W.leftReason(cents(leftCents)));
  if (leftCents < 0) return refuse(400, 'over_placed', W.overPlaced(cents(-leftCents)));

  // A second press of the same send (a double click, a retry after a lost response, a colleague at the next desk): the
  // same child, amount and day sent in the last minute is refused rather than handed to the coach twice. A read before
  // the write, so two presses in the same instant can both pass — the coach's Record it then credits the second.
  // (A unique index would also refuse a genuine second cheque of the same amount on the same day.)
  const reps = chosen.filter((x): x is { line: RepPaymentLine; cents: number } => x.line.kind === 'rep');
  if (reps.length) {
    const { data: recent, error } = await supabaseAdmin.from('family_payment_handoffs').select('roster_player_id, amount')
      .eq('org_id', ctx.org.id).eq('received_date', receivedDate)
      .gt('sent_at', new Date(Date.now() - 60_000).toISOString()).in('roster_player_id', reps.map(r => r.line.rosterRowId));
    if (error) throw error;
    if ((recent ?? []).some(h => reps.some(r => r.line.rosterRowId === h.roster_player_id && Math.round(Number(h.amount) * 100) === r.cents))) {
      return refuse(409, 'just_sent', W.justSent);
    }
  }

  // 1 · The club's own fees, through the one write.
  const fees: string[] = [];
  for (const { line } of chosen) {
    if (line.kind !== 'league') continue;
    const [season, regRead] = await Promise.all([
      getLeagueSeasonById(line.seasonId, ctx.org.id),
      supabaseAdmin.from('league_registrations').select('id, registration_fee_paid')
        .eq('id', line.regId).eq('org_id', ctx.org.id).eq('season_id', line.seasonId).maybeSingle(),
    ]);
    if (regRead.error) throw regRead.error;
    const reg = regRead.data;
    const sofar = fees.length ? W.done(fees, []) : undefined;
    if (!season || !reg || reg.registration_fee_paid) return refuse(409, 'changed', sofar ? W.partly(sofar) : W.changed, sofar);
    // The window's own date and how reach the book (9b-2: they were dropped before), for exactly the balance it showed.
    const wrote = await writeLeagueMoney(ctx, { seasonId: season.id, regId: reg.id }, {
      kind: 'receive', day: receivedDate, method: method as string | null, amount: line.feeCents / 100, note,
    });
    if ('refused' in wrote || 'refusal' in wrote) {
      const refusedBody = 'refused' in wrote ? wrote.refused : null;
      const words = refusedBody ? (refusedBody.body as { error?: string }).error ?? W.failed : W.changed;
      return refuse(refusedBody ? refusedBody.status : 409, 'fee_refused', sofar ? `${W.partly(sofar)} ${words}` : words, sofar);
    }
    fees.push(line.childName);
  }

  // 2 · The hand-offs: one row per rep line, then the head coaches are told.
  const sends: { child: string; amount: string; coaches: string[] }[] = [];
  if (reps.length) try {
    const [{ data: rows, error }, sender] = await Promise.all([supabaseAdmin.from('family_payment_handoffs').insert(reps.map(r => ({
      org_id: ctx.org.id, person_id: page.person.id, roster_player_id: r.line.rosterRowId, player_name: r.line.childName,
      team_id: r.line.teamId, program_year_id: r.line.programYearId, amount: r.cents / 100, received_date: receivedDate,
      method, note, sent_by: ctx.user.id, sent_to: (recipients.get(r.line.teamId) ?? []).map(c => c.userId),
    }))).select('id, roster_player_id'), senderName(ctx).catch(() => ctx.user.email ?? ctx.org.name)]);
    if (error) throw error;
    const idOf = new Map((rows ?? []).map(h => [h.roster_player_id as string, h.id as string]));
    const made = reps.flatMap(r => { const id = idOf.get(r.line.rosterRowId); return id ? [{ id, r }] : []; });
    await Promise.all(made.map(({ id, r }) =>
      deliverHandoff(ctx, sender, { id, line: r.line, cents: r.cents, receivedDate, method, note }, recipients.get(r.line.teamId) ?? [])));
    sends.push(...made.map(({ r }) => ({ child: r.line.childName, amount: cents(r.cents), coaches: r.line.coaches })));
  } catch (e) {
    // The fees above are recorded: say exactly that, so the window re-reads instead of inviting a second press.
    if (!fees.length) throw e;
    console.error('[families-payment] the hand-offs failed after the fees were recorded:', e);
    const sofar = W.done(fees, []);
    return refuse(500, 'handoffs_failed', `${W.partly(sofar)} ${W.failed}`, sofar);
  }

  // The club's audit log: what was done, in counts — never the family's name or the note.
  await writeOrgAudit(ctx.org.id, ctx.user.id, null, 'families_payment_recorded', { fees: fees.length, handoffs: sends.length, cents: amountCents });
  return { ok: true, fees, sends, said: W.done(fees, sends) };
}

/** Tell a hand-off's head coaches: a "Your club" bell (Needs attention) and colleague mail that replies to the sender.
 *  Best-effort after the row is written: the record already shows it Sent to coach. */
async function deliverHandoff(
  ctx: AuthContextWithRole,
  sender: string,
  h: { id: string; line: RepPaymentLine; cents: number; receivedDate: string; method: string | null; note: string | null },
  coaches: readonly Recipient[],
): Promise<void> {
  const amount = cents(h.cents);
  const how = h.method ? methodWord(h.method) ?? h.method : null;
  const base = `/${ctx.org.slug}/coaches/teams/${h.line.teamId}`;
  const recordLink = moneySectionHref(base, 'dues', { handoff: h.id });
  const notReceivedLink = moneySectionHref(base, 'dues', { handoff: h.id, handoffAnswer: 'not-received' });
  const bell = notify({
    orgId: ctx.org.id, userIds: coaches.map(c => c.userId), excludeUserIds: [ctx.user.id], eventType: 'club_payment_handed_off',
    title: CW.bellTitle(amount, h.line.childName), body: CW.bellBody(how, shortDay(h.receivedDate)),
      link: recordLink, metadata: { handoffId: h.id, teamId: h.line.teamId },
  }).catch(e => console.error('[families-payment] a hand-off bell failed (the hand-off stands):', e));
  const emails = inParallel(coaches.filter(c => !!c.email), 5, async c => {
    try {
      const html = emailHtml({
        subject: CW.emailSubject(h.line.teamName, h.line.childName),
        greeting: FAMILY_COACH_ASK_WORDS.emailGreeting(c.name?.split(' ')[0] ?? null),
        paragraphs: [
          CW.emailLead(ctx.org.name, amount, h.line.childName, how, shortDay(h.receivedDate)),
          ...(h.note ? [CW.emailNote(h.note)] : []),
          CW.emailAsk,
        ],
        lists: [],
        link: { label: CW.recordIt, path: recordLink },
        alsoLink: { label: CW.notReceived, path: notReceivedLink },
        outro: CW.emailOutro(sender),
      });
      await sendEmail(c.email!, CW.emailSubject(h.line.teamName, h.line.childName), html, { kind: 'club_payment_handoff_coach', replyTo: ctx.user.email ?? null });
    } catch (e) {
      console.error('[families-payment] a hand-off email failed (the bell stands):', e);
    }
  });
  await Promise.all([bell, emails]);
}

// ── The coach's side ───────────────────────────────────────────────────────────────────────────

export interface CoachHandoffView {
  id: string;
  state: HandoffRow['state'];
  playerId: string | null;
  playerName: string;
  amount: string;
  /** For the Record money form. */
  amountValue: string;
  receivedDate: string;
  method: string | null;
  /** The note Record money opens with ("Received by the club (Fixture Owner): …"). */
  note: string;
  sentDay: string;
  /** What the player owes now, read the money module's way ("Owes $100.00 · sent by the club · Oct 19"). */
  owes: string | null;
  /** False when the hand-off is for a season that is not the team's live one. */
  liveSeason: boolean;
}

/** One hand-off for a coach on its team (the door's read). Null when it is not this team's. */
export async function coachHandoff(orgId: string, teamId: string, handoffId: string, liveYearId: string): Promise<CoachHandoffView | null> {
  const { data: h, error } = await supabaseAdmin.from('family_payment_handoffs')
    .select('id, roster_player_id, player_name, team_id, program_year_id, amount, received_date, method, note, sent_by, sent_at, state')
    .eq('id', handoffId).eq('org_id', orgId).eq('team_id', teamId).maybeSingle();
  if (error) throw error;
  if (!h) return null;
  // The form's fill (the balance, the sender's name) is read only when the door will open the form.
  const opens = h.state === 'sent' && h.program_year_id === liveYearId;
  const [nameOf, owes] = await Promise.all([
    opens ? resolvePersonNamer(orgId, [h.sent_by]) : Promise.resolve(() => null),
    opens && h.roster_player_id ? playerOwes(orgId, h.roster_player_id) : Promise.resolve(null),
  ]);
  const sender = (h.sent_by ? nameOf(h.sent_by) : null) ?? 'the club';
  const amount = Number(h.amount);
  return {
    id: h.id, state: h.state, playerId: h.roster_player_id ?? null, playerName: h.player_name,
    amount: fmt(amount), amountValue: amount.toFixed(2), receivedDate: h.received_date, method: h.method,
    note: CW.coachNote(sender, h.note ?? null), sentDay: shortDay(h.sent_at), owes,
    liveSeason: h.program_year_id === liveYearId,
  };
}

/** One player's balance, through the money module (the team's own derivation — never re-derived here). */
async function playerOwes(orgId: string, rosterRowId: string): Promise<string | null> {
  const { data: row, error } = await supabaseAdmin.from('rep_roster_players')
    .select('id, program_year_id, rep_program_years(credit_application)').eq('id', rosterRowId).eq('org_id', orgId).maybeSingle();
  if (error) throw error;
  if (!row) return null;
  const f = (await readRepMoney(orgId, [row])).figures.get(rosterRowId);
  return f ? fmt(Math.max(0, f.balance)) : null;
}

/** A YYYY-MM-DD that is a real day ("2026-13-45" is not). */
const isCalendarDate = (d: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T12:00:00Z`).toISOString().slice(0, 10) === d;

/** Is this person still an active member of the club? (A Not received names a child: never to someone who left.) */
async function isActiveMember(orgId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('organization_members').select('user_id')
    .eq('organization_id', orgId).eq('user_id', userId).eq('status', 'active').maybeSingle();
  if (error) throw error;
  return !!data;
}

/** Move a hand-off out of `sent` — ONE conditional update, so of two answers racing, only the first moves it. */
async function moveFromSent(handoffId: string, to: 'recorded' | 'not_received', userId: string, at: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('family_payment_handoffs')
    .update({ state: to, resolved_by: userId, resolved_at: at })
    .eq('id', handoffId).eq('state', 'sent').select('id');
  if (error) throw error;
  return !!data?.length;
}
const answered = { ok: false as const, status: 409, error: CW.refusedAnswered, code: 'handoff_answered' };

export type HandoffClaim = { ok: true; release: () => Promise<void>; stamp: (paymentId: string) => Promise<void> } | { ok: false; status: number; error: string; code: string };

/**
 * RECORD IT, THE COACH'S SAVE (the dues-payments POST with `handoffId`). The hand-off must be this org's, this team's,
 * this player's, on the live season, and still `sent`. It is CLAIMED first — one conditional update, sent → recorded —
 * so two coaches pressing Record it record once; the caller records the payment the ordinary way, then `stamp`s the
 * payment id, or `release`s the claim when the record failed. A claim the release cannot undo (a crash between the two)
 * reads as recorded with no payment: the state explains itself and the coach's book shows no receipt — the one gap,
 * logged.
 */
export async function claimHandoffForPayment(p: { orgId: string; teamId: string; playerId: string; programYearId: string; handoffId: string; paymentId: string; userId: string }): Promise<HandoffClaim> {
  const { data: h, error } = await supabaseAdmin.from('family_payment_handoffs')
    .select('id, team_id, roster_player_id, program_year_id, state').eq('id', p.handoffId).eq('org_id', p.orgId).maybeSingle();
  if (error) throw error;
  if (!h || h.team_id !== p.teamId || h.roster_player_id !== p.playerId) return { ok: false, status: 404, error: CW.refusedOther, code: 'handoff_other' };
  if (h.program_year_id !== p.programYearId) return { ok: false, status: 409, error: CW.wrongSeason, code: 'handoff_season' };
  if (h.state !== 'sent') return answered;
  const now = new Date().toISOString();
  if (!(await moveFromSent(p.handoffId, 'recorded', p.userId, now))) return answered;
  const stamp = async (paymentId: string) => {
    const { error: e } = await supabaseAdmin.from('family_payment_handoffs').update({ payment_id: paymentId }).eq('id', p.handoffId);
    if (e) console.error('[families-payment] the hand-off could not be stamped with its payment (it reads recorded):', e);
    await clearSettled({ orgIds: [p.orgId], kinds: ['club_payment_handed_off'] });
  };
  return {
    ok: true,
    stamp,
    /* A record that threw may still have written its payment (the one write posts the ledger line, then the payment,
       then the credit and the projection — a throw in the last two leaves the payment standing). So the release READS
       first, for EXACTLY the payment this save was given (`paymentId`, chosen before the claim — never a guess by time,
       review 2026-10-19): found, the hand-off stays recorded, stamped with it; not found, it goes back to waiting, for
       a retry. Recorded means a payment exists, waiting means none does. */
    release: async () => {
      try {
        const { data: landed, error: readError } = await supabaseAdmin.from('rep_dues_payments').select('id').eq('id', p.paymentId).maybeSingle();
        if (readError) throw readError;
        if (landed) { await stamp(p.paymentId); return; }
        const { error: e } = await supabaseAdmin.from('family_payment_handoffs')
          .update({ state: 'sent', resolved_by: null, resolved_at: null })
          .eq('id', p.handoffId).eq('state', 'recorded').is('payment_id', null);
        if (e) throw e;
      } catch (e) {
        console.error('[families-payment] a hand-off claim could not be settled after a failed record (it reads recorded):', e);
      }
    },
  };
}

/**
 * NOT RECEIVED — the coach says the money never reached the team. Nothing is written in either book; the hand-off reads
 * not_received (the record's red chip), the person who sent it is told (their bell), and the ask clears for every coach.
 */
export async function markHandoffNotReceived(p: { org: { id: string; slug: string }; teamId: string; teamName: string; handoffId: string; userId: string }): Promise<{ ok: true } | { ok: false; status: number; error: string; code: string }> {
  const { data: h, error } = await supabaseAdmin.from('family_payment_handoffs')
    .select('id, person_id, team_id, player_name, amount, received_date, method, sent_by, state').eq('id', p.handoffId).eq('org_id', p.org.id).maybeSingle();
  if (error) throw error;
  if (!h || h.team_id !== p.teamId) return { ok: false, status: 404, error: CW.gone, code: 'handoff_other' };
  if (h.state !== 'sent') return { ok: false, status: 409, error: h.state === 'recorded' ? CW.alreadyRecorded : CW.alreadyNotReceived, code: 'handoff_answered' };
  if (!(await moveFromSent(p.handoffId, 'not_received', p.userId, new Date().toISOString()))) return answered;
  await clearSettled({ orgIds: [p.org.id], kinds: ['club_payment_handed_off'] });
  if (h.sent_by && h.sent_by !== p.userId && (await isActiveMember(p.org.id, h.sent_by))) {
    try {
      const coach = (await resolvePersonNamer(p.org.id, [p.userId]))(p.userId) ?? 'The head coach';
      await notify({
        orgId: p.org.id, userIds: [h.sent_by], excludeUserIds: [p.userId], eventType: 'club_payment_not_received',
        title: CW.adminTitle(coach, h.player_name, fmt(Number(h.amount))),
        body: CW.adminBody(p.teamName, h.method ? methodWord(h.method) ?? h.method : null, shortDay(h.received_date)),
        link: `/${p.org.slug}/admin/families/${h.person_id}`, metadata: { handoffId: h.id, personId: h.person_id },
      });
    } catch (e) {
      console.error('[families-payment] the sender could not be told (Not received stands):', e);
    }
  }
  return { ok: true };
}
