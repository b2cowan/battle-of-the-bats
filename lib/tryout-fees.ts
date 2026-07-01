import { supabaseAdmin } from './supabase-admin';
import type { TryoutAcceptDues } from './db';

/**
 * Derive the team's "standard fee schedule" for pre-filling the accept-to-roster drawer (Phase 2B.4).
 *
 * There is NO fee-template in the schema (ratified OQ1, 2026-07-01): teams bill everyone the same, so
 * the team's PREVAILING player dues ARE the de-facto standard. This is a pure read — it never writes.
 *
 * Tiers:
 *  1. `prevailing` — the most-common total among roster players who already have a dated installment
 *     plan, plus that plan's installments. Fully dated → the drawer can default the fees toggle ON.
 *  2. `budget_plan` — no prevailing dues yet, but the team has a budget: suggest a per-player total
 *     (total budget ÷ active roster size). There are no canonical installment dates to read, so this
 *     is a total-only hint (one undated installment the coach dates before saving) → `complete: false`,
 *     toggle stays OFF by default.
 *  3. `null` — nothing to derive (brand-new team). The drawer shows a blank, manual schedule.
 */

export interface SuggestedDuesInstallment {
  installmentNumber: number;
  amount: number;
  dueDate: string; // '' when undated (budget_plan hint)
}

export interface SuggestedDues {
  totalAmount: number;
  installments: SuggestedDuesInstallment[];
  source: 'prevailing' | 'budget_plan';
  /** true when every installment carries a real due date (drawer defaults the fees toggle ON). */
  complete: boolean;
}

const round2 = (n: number) => Math.round(Number(n) * 100) / 100;

export async function deriveStandardDuesSchedule(programYearId: string): Promise<SuggestedDues | null> {
  // ── Tier 1: prevailing roster dues ──────────────────────────────────────────
  const { data: schedules } = await supabaseAdmin
    .from('rep_player_dues_schedules')
    .select('id, total_amount')
    .eq('program_year_id', programYearId);

  if (schedules && schedules.length) {
    const scheduleIds = schedules.map(s => s.id);
    const { data: installments } = await supabaseAdmin
      .from('rep_player_dues_installments')
      .select('schedule_id, installment_number, amount, due_date')
      .in('schedule_id', scheduleIds)
      .order('installment_number');

    type InstRow = { schedule_id: string; installment_number: number; amount: number; due_date: string };
    const bySchedule = new Map<string, InstRow[]>();
    for (const inst of (installments ?? []) as InstRow[]) {
      const list = bySchedule.get(inst.schedule_id) ?? [];
      list.push(inst);
      bySchedule.set(inst.schedule_id, list);
    }

    // Only schedules that actually carry installments qualify as a usable "standard".
    const usable = schedules.filter(s => (bySchedule.get(s.id)?.length ?? 0) > 0);
    if (usable.length) {
      // Group by total (rounded to cents) and pick the most common. Tie-break: first seen.
      const counts = new Map<number, { count: number; sampleScheduleId: string }>();
      for (const s of usable) {
        const key = round2(s.total_amount as number);
        const entry = counts.get(key);
        if (entry) entry.count++;
        else counts.set(key, { count: 1, sampleScheduleId: s.id });
      }
      let best: { total: number; count: number; sampleScheduleId: string } | null = null;
      for (const [total, { count, sampleScheduleId }] of counts) {
        if (!best || count > best.count) best = { total, count, sampleScheduleId };
      }
      if (best) {
        const sample = (bySchedule.get(best.sampleScheduleId) ?? [])
          .slice()
          .sort((a, b) => a.installment_number - b.installment_number)
          .map((i, idx) => ({ installmentNumber: idx + 1, amount: round2(i.amount), dueDate: i.due_date }));
        return { totalAmount: best.total, installments: sample, source: 'prevailing', complete: true };
      }
    }
  }

  // ── Tier 2: budget-plan per-player total (undated hint) ──────────────────────
  const { data: lines } = await supabaseAdmin
    .from('rep_budget_lines')
    .select('total_amount')
    .eq('program_year_id', programYearId);
  const totalBudget = (lines ?? []).reduce((s: number, l: { total_amount: number | null }) => s + Number(l.total_amount ?? 0), 0);

  if (totalBudget > 0) {
    const { count } = await supabaseAdmin
      .from('rep_roster_players')
      .select('id', { count: 'exact', head: true })
      .eq('program_year_id', programYearId)
      .eq('status', 'active');
    const rosterCount = Math.max(count ?? 0, 1);
    const perPlayer = round2(totalBudget / rosterCount);
    if (perPlayer > 0) {
      return {
        totalAmount: perPlayer,
        installments: [{ installmentNumber: 1, amount: perPlayer, dueDate: '' }],
        source: 'budget_plan',
        complete: false,
      };
    }
  }

  return null;
}

// ── Accept-drawer dues validation (shared by the admin + coach accept routes) ──
//
// Fees are OPTIONAL — a null/absent `dues` is valid (accept-without-fees). When present, mirror the
// existing dues route's rules: total > 0, ≥1 installment, each installment dated, amounts sum to total.
// The mig-169 RPC re-validates as a backstop; this gives the user a clean 400 with a helpful message.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Returns a human-readable error string if `dues` is present-but-invalid, else null (valid or absent). */
export function validateAcceptDues(dues: unknown): string | null {
  if (dues === null || dues === undefined) return null; // fees off — fine
  if (typeof dues !== 'object') return 'Invalid fee schedule.';
  const d = dues as Record<string, unknown>;

  const total = Number(d.totalAmount);
  if (!Number.isFinite(total) || total <= 0) return 'Total fee must be greater than 0.';

  if (!Array.isArray(d.installments) || d.installments.length === 0) {
    return 'Add at least one installment, or turn fees off.';
  }

  let sum = 0;
  for (const raw of d.installments) {
    const inst = raw as Record<string, unknown>;
    const amount = Number(inst.amount);
    if (!Number.isFinite(amount) || amount <= 0) return 'Each installment amount must be greater than 0.';
    if (typeof inst.dueDate !== 'string' || !DATE_RE.test(inst.dueDate)) {
      return 'Each installment needs a due date.';
    }
    sum += amount;
  }
  if (Math.abs(sum - total) > 0.01) {
    return `Installments (${sum.toFixed(2)}) must add up to the total (${total.toFixed(2)}).`;
  }
  return null;
}

/** Coerce a validated `dues` payload into the accept helper's shape. Call only after validateAcceptDues. */
export function normalizeAcceptDues(dues: any): TryoutAcceptDues {
  return {
    totalAmount: Number(dues.totalAmount),
    notes: typeof dues.notes === 'string' ? dues.notes.trim() || null : null,
    installments: (dues.installments as any[]).map((i, idx) => ({
      installmentNumber: Number.isFinite(Number(i.installmentNumber)) ? Number(i.installmentNumber) : idx + 1,
      amount: Number(i.amount),
      dueDate: i.dueDate,
    })),
  };
}
