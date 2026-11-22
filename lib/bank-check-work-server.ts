import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from './supabase-admin';
import { resolvePersonNamer } from './db';
import { tournamentToday } from './timezone';
import { canMoveClubMoney } from './member-access';
import type { EntitlementOrg } from './module-entitlements';
import {
  BANK_CHECK_DRAFT_DAYS, isWorkWorthKeeping, type CheckWork, type ColleagueWork, type SavedWork, type WorkElsewhere,
  type WorkRead, type WorkRefusal,
} from './bank-check-work';

/**
 * THE SERVER HALF OF A BANK CHECK IN PROGRESS (S7 Part 1; table `bank_check_drafts`, mig 522, /dba Finding #54; the shape is
 * lib/bank-check-work.ts). Every function takes an account id the CALLER'S GATE has already proven is theirs (club:
 * `clubWorkAccount`; coach: the gate's team's account). Nothing here decides who may save a check; it is handed `canSave`.
 *
 * ⚖ MINE ONLY: a person reads and writes their own row. Colleagues' rows are read with `COLLEAGUE_COLS` and nothing more.
 * ⚖ HOW A ROW GOES: discard (Save this check, Start over), expiry (deleted on sight here; the nightly sweep, mig 523), loss
 *   of write access (`discardWorkOf` from the removal routes; and `readWork` deletes a colleague's row whose owner
 *   `canSave` no longer passes), a coach season's rollover or close (`discardAccountWork`), and the CASCADEs.
 */

const MY_COLS = 'statement_end_date, balance_text, cash_text, marked_keys, answered_no_keys, started_date, started_balance_text, started_difference_cents, revision, updated_at, expires_at';
// ⚠ The colleague's quiet line: who, which date, when it last changed. Never add a column here (pinned by test).
export const COLLEAGUE_COLS = 'user_id, statement_end_date, updated_at';

const DAY_MS = 86_400_000;

interface MyRow {
  statement_end_date: string; balance_text: string; cash_text: string | null; marked_keys: string[]; answered_no_keys: string[] | null;
  started_date: string | null; started_balance_text: string | null; started_difference_cents: number | string | null;
  revision: number; updated_at: string; expires_at: string;
}

/** Who among these people can still save a check on this account (the gate's rule, asked of someone else). */
export type CanSave = (userIds: readonly string[]) => Promise<ReadonlySet<string>>;

const dayOf = (iso: string) => tournamentToday(new Date(iso));

function savedOf(r: MyRow): SavedWork {
  return {
    date: r.statement_end_date,
    balance: r.balance_text,
    ...(r.cash_text ? { cash: r.cash_text } : {}),
    marked: [...(r.marked_keys ?? [])],
    ...(r.answered_no_keys?.length ? { answeredNo: [...r.answered_no_keys] } : {}),
    started: r.started_date && r.started_balance_text !== null && r.started_difference_cents !== null
      ? { date: r.started_date, balance: r.started_balance_text, differenceCents: Number(r.started_difference_cents) }
      : null,
    revision: r.revision,
    changedOn: dayOf(r.updated_at),
    endsOn: dayOf(r.expires_at),
  };
}

function rowOf(w: CheckWork, now: Date) {
  return {
    statement_end_date: w.date,
    balance_text: w.balance,
    cash_text: w.cash?.trim() ? w.cash : null,
    answered_no_keys: w.answeredNo ?? [],
    marked_keys: w.marked,
    started_date: w.started?.date ?? null,
    started_balance_text: w.started?.balance ?? null,
    started_difference_cents: w.started?.differenceCents ?? null,
    updated_at: now.toISOString(),
    expires_at: new Date(now.getTime() + BANK_CHECK_DRAFT_DAYS * DAY_MS).toISOString(),
  };
}

/** An expired row is none: gone on sight, for everyone on this account. */
async function dropExpired(accountId: string, nowIso: string): Promise<void> {
  const { error } = await supabaseAdmin.from('bank_check_drafts').delete()
    .eq('bank_account_id', accountId).lt('expires_at', nowIso);
  if (error) throw error;
}

/**
 * GET …/work: the person's own work on this account, and the colleagues' quiet lines. A colleague's row whose owner can no
 * longer save a check here is deleted, not shown (ruling 2: the work goes with the write access). No account yet (a team
 * before its first keep): nothing.
 */
export async function readWork(p: { accountId: string | null; me: string; orgId: string; canSave: CanSave }):
  Promise<Omit<WorkRead, 'elsewhere'>> {
  if (!p.accountId) return { mine: null, colleagues: [] };
  const nowIso = new Date().toISOString();
  await dropExpired(p.accountId, nowIso);
  const [mine, others] = await Promise.all([
    supabaseAdmin.from('bank_check_drafts').select(MY_COLS)
      .eq('bank_account_id', p.accountId).eq('user_id', p.me).maybeSingle(),
    supabaseAdmin.from('bank_check_drafts').select(COLLEAGUE_COLS)
      .eq('bank_account_id', p.accountId).neq('user_id', p.me).order('updated_at', { ascending: false }),
  ]);
  if (mine.error) throw mine.error;
  if (others.error) throw others.error;
  const rows = (others.data ?? []) as { user_id: string; statement_end_date: string; updated_at: string }[];
  let colleagues: ColleagueWork[] = [];
  if (rows.length) {
    const ids = rows.map(r => r.user_id);
    const can = await p.canSave(ids);
    const gone = ids.filter(id => !can.has(id));
    if (gone.length) await discardWorkOf(gone, [p.accountId]);
    const kept = rows.filter(r => can.has(r.user_id));
    const nameOf = kept.length ? await resolvePersonNamer(p.orgId, kept.map(r => r.user_id)) : () => null;
    colleagues = kept.map(r => ({ name: nameOf(r.user_id), date: r.statement_end_date, changedOn: dayOf(r.updated_at) }));
  }
  return { mine: mine.data ? savedOf(mine.data as MyRow) : null, colleagues };
}

/**
 * PUT …/work: keep the work as it is now (kept as you go; Save for later is the same keep, its answer names `endsOn`).
 * Every keep restarts the 30 days. `revision` null = the first keep (Start); otherwise the revision last read, and a keep
 * another device has overtaken is refused `work_changed` (never an unseen overwrite). Work no longer worth keeping (no
 * balance, no cash, no mark) is discarded: `saved` null.
 */
export async function keepWork(p: { accountId: string; me: string; work: CheckWork; revision: number | null }):
  Promise<{ ok: true; saved: SavedWork | null } | { ok: false; code: WorkRefusal }> {
  if (!isWorkWorthKeeping(p.work)) {
    await discardWork(p.accountId, p.me);
    return { ok: true, saved: null };
  }
  const now = new Date();
  const nowIso = now.toISOString();
  if (p.revision === null) {
    // A row past its 30 days is none (the sweep may not have run yet): it never blocks a fresh Start.
    const { error: gone } = await supabaseAdmin.from('bank_check_drafts').delete()
      .eq('bank_account_id', p.accountId).eq('user_id', p.me).lt('expires_at', nowIso);
    if (gone) throw gone;
    const { data, error } = await supabaseAdmin.from('bank_check_drafts')
      .insert({ bank_account_id: p.accountId, user_id: p.me, revision: 1, ...rowOf(p.work, now) })
      .select(MY_COLS).single();
    if (error) {
      // Another device started first: it holds newer work than this card knows.
      if (error.code === '23505') return { ok: false, code: 'work_changed' };
      throw error;
    }
    return { ok: true, saved: savedOf(data as MyRow) };
  }
  const { data, error } = await supabaseAdmin.from('bank_check_drafts')
    .update({ revision: p.revision + 1, ...rowOf(p.work, now) })
    .eq('bank_account_id', p.accountId).eq('user_id', p.me).eq('revision', p.revision).gt('expires_at', nowIso)
    .select(MY_COLS);
  if (error) throw error;
  const row = (data ?? [])[0] as MyRow | undefined;
  return row ? { ok: true, saved: savedOf(row) } : { ok: false, code: 'work_changed' };
}

/** DELETE …/work (Start over), and Save this check: the person's work on this account goes. */
export async function discardWork(accountId: string, me: string): Promise<void> {
  const { error } = await supabaseAdmin.from('bank_check_drafts').delete().eq('bank_account_id', accountId).eq('user_id', me);
  if (error) throw error;
}

/** Save this check: the work goes in the same request, after the save. A failed delete never fails the save (the card
 *  meets the date as checked, the shipped replace sentence; the 30 days and the sweep are the backstop). */
export async function discardWorkAfterSave(accountId: string, me: string): Promise<void> {
  try { await discardWork(accountId, me); } catch (e) {
    console.error('[bank-check-work] the saved check’s work was not discarded; it expires on its own:', e instanceof Error ? e.message : e);
  }
}

/** Loss of write access: these people's work on these accounts goes. */
export async function discardWorkOf(userIds: readonly string[], accountIds: readonly string[]): Promise<void> {
  if (!userIds.length || !accountIds.length) return;
  const { error } = await supabaseAdmin.from('bank_check_drafts').delete()
    .in('user_id', [...userIds]).in('bank_account_id', [...accountIds]);
  if (error) throw error;
}

/**
 * A coach's season rolls over or closes (ruling 2): every person's work on the team's account goes. In the database
 * (`bank_check_drafts_discard_team`, mig 522), so the club-side callers of the roll never read a team's account (D1).
 */
export async function discardTeamWork(teamId: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc('bank_check_drafts_discard_team', { p_team: teamId, p_user: null });
  if (error) throw error;
}

// ── the club ────────────────────────────────────────────────────────────────────────────────

/** The club's live club-kind account by id, or null: the work routes' account check (never a team's account, D1). */
export async function clubWorkAccount(orgId: string, accountId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from('bank_accounts').select('id')
    .eq('id', accountId).eq('org_id', orgId).eq('owner_kind', 'club').is('archived_at', null).maybeSingle();
  if (error) throw error;
  return (data?.id as string | undefined) ?? null;
}

/** Every live club-kind account of the club. */
async function clubAccountIds(orgId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from('bank_accounts').select('id')
    .eq('org_id', orgId).eq('owner_kind', 'club').is('archived_at', null);
  if (error) throw error;
  return (data ?? []).map(r => r.id as string);
}

/** The club's Account pill: the person's saved work on the club's OTHER accounts (ruling 3, drawing tab 4). */
export async function workElsewhere(orgId: string, me: string, accountId: string): Promise<WorkElsewhere[]> {
  const ids = (await clubAccountIds(orgId)).filter(id => id !== accountId);
  if (!ids.length) return [];
  const { data, error } = await supabaseAdmin.from('bank_check_drafts').select('bank_account_id, statement_end_date')
    .eq('user_id', me).in('bank_account_id', ids).gt('expires_at', new Date().toISOString());
  if (error) throw error;
  return (data ?? []).map(r => ({ accountId: r.bank_account_id as string, date: r.statement_end_date as string }));
}

/** The club's rule, asked of colleagues: an active member who can move club money (read = write on the club's bank). */
export function clubCanSave(org: EntitlementOrg & { id: string }): CanSave {
  return async (userIds) => {
    if (!userIds.length) return new Set();
    const { data, error } = await supabaseAdmin.from('organization_members').select('user_id, role, capabilities')
      .eq('organization_id', org.id).eq('status', 'active').in('user_id', [...userIds]);
    if (error) throw error;
    return new Set((data ?? [])
      .filter(m => canMoveClubMoney({ role: m.role, capabilities: m.capabilities ?? null }, org))
      .map(m => m.user_id as string));
  };
}

/** A club member's access changed or they were removed: their work on every club account goes (none if they can still
 *  save one). Best-effort, never failing the members step: the read's own check and the 30 days are the backstop. */
export async function discardClubWorkUnlessAllowed(org: EntitlementOrg & { id: string }, userId: string): Promise<void> {
  try {
    if ((await clubCanSave(org)([userId])).has(userId)) return;
    await discardWorkOf([userId], await clubAccountIds(org.id));
  } catch (e) {
    console.error('[bank-check-work] a removed member’s saved bank work was not discarded now; it goes on the next read:', e instanceof Error ? e.message : e);
  }
}

// ── a coach ─────────────────────────────────────────────────────────────────────────────────
// (Who on the team may save is a coach reader: lib/bank-coach-work.ts, the coach's bank, D1.)

/** A coach left the team or lost money write: their work on the team's account goes. Best-effort, as the club's. */
export async function discardTeamWorkOf(teamId: string, userId: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin.rpc('bank_check_drafts_discard_team', { p_team: teamId, p_user: userId });
    if (error) throw error;
  } catch (e) {
    console.error('[bank-check-work] a coach’s saved bank work was not discarded now; it goes on the next read:', e instanceof Error ? e.message : e);
  }
}

// ── the answers ─────────────────────────────────────────────────────────────────────────────

const WORK_REFUSAL: Record<WorkRefusal, { status: number; error: string }> = {
  // Settled by /marketing 2026-11-22 (S7 Part 2). The card says its own sentence; these are the API's.
  bad_work: { status: 400, error: 'This check couldn’t be kept. Check the date and the amounts.' },
  work_changed: { status: 409, error: 'You changed this check on another device, so this page now shows the latest.' },
};

export const workRefused = (code: WorkRefusal): Response =>
  NextResponse.json({ error: WORK_REFUSAL[code].error, code }, { status: WORK_REFUSAL[code].status });
