import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { getEffectiveFee, lowerEntry, lowerEntryRow, owedAmount, paymentLine, type FeeSchedule, type TeamRecord } from '../../lib/tournament-teams.ts';
import { registrationAmountDue, registrationFee } from '../../lib/registration-amount-due.ts';
import { effectiveFee } from '../../lib/mark-paid.ts';

/**
 * Club Tier Stage 12c Part 4 — a team's part refund lowers ITS entry by the same amount (owner ruling §0j 3), so the refund
 * is never owed back. Every reader of a team's fee applies it, as the database's tournament_team_fee does (mig 382).
 * The ruled example: a $400 entry, $100 deposit paid, $40 back → entry $360, $60 net paid, $300 still owed (unchanged).
 */
const FEE: FeeSchedule = { depositAmount: 100, depositDueDate: null, totalFeeAmount: 400, totalFeeDueDate: '2026-11-01' };
const team = (over: Partial<TeamRecord> = {}): TeamRecord => ({
  id: 't', name: 'Riverside Rockets', coach: '', email: '', division_id: 'd', division_name: '', status: 'accepted',
  paymentStatus: 'pending', depositPaid: 60, totalPaid: 60, registered_at: '', entryLowered: 40, ...over,
});

describe('the lowered entry (12c)', () => {
  it('lowers the entry, never below zero, and keeps the deposit within it', () => {
    assert.equal(lowerEntry(FEE, 40).totalFeeAmount, 360);
    assert.equal(lowerEntry(FEE, 500).totalFeeAmount, 0);
    assert.equal(lowerEntry(FEE, 350).depositAmount, 50);
    assert.equal(lowerEntry(FEE, 0), FEE, 'no lowering: the very same fee');
    assert.equal(lowerEntry({ depositAmount: null, totalFeeAmount: null }, 40).totalFeeAmount, null, 'no fee stays no fee');
    assert.equal(lowerEntryRow({ total_fee_amount: 400, deposit_amount: 100 }, '40').total_fee_amount, 360);
  });
  it('the ruled example: the balance does not move, and the refund is never owed back', () => {
    const fee = getEffectiveFee(team(), [], 'tournament', FEE);
    assert.equal(fee.totalFeeAmount, 360);
    assert.equal(owedAmount(team(), fee), 300);
    assert.deepEqual(paymentLine(team(), fee, '2026-10-27')?.lead, 'Owes $300');
  });
  it('a team that had paid in full and got $40 back is still paid in full', () => {
    const t = team({ totalPaid: 360, depositPaid: 100 });
    const fee = getEffectiveFee(t, [], 'tournament', FEE);
    assert.equal(owedAmount(t, fee), 0);
  });
  it('a division fee is lowered too', () => {
    const fee = getEffectiveFee(team(), [{ id: 'd', totalFeeAmount: 500, depositAmount: 100 } as never], 'division', FEE);
    assert.equal(fee.totalFeeAmount, 460);
  });
  it('reminders, the pay page and check-in read the same lowered entry', () => {
    const t = { division_id: 'd', deposit_paid: 60, total_paid: 60, entry_lowered: 40 };
    const tour = { fee_schedule_mode: 'tournament', deposit_amount: 100, deposit_due_date: null, total_fee_amount: 400, total_fee_due_date: null };
    assert.equal(registrationFee(t, tour, new Map()).totalFeeAmount, 360);
    assert.deepEqual(registrationAmountDue(t, registrationFee(t, tour, new Map())), { amount: 40, dueDate: null }, 'the deposit step: $100 less $60 paid');
    assert.equal(effectiveFee(t, tour, null).totalFeeAmount, 360);
  });
  it('every query that feeds a fee reader selects the lowered entry', () => {
    for (const f of [
      'lib/team-pay-facts.ts', 'lib/needs-attention.ts', 'app/api/admin/check-in/route.ts', 'app/api/admin/tournament-dashboard/route.ts',
      'app/api/admin/tournaments/[tournamentId]/registrations/export/route.ts', 'app/api/admin/tournaments/[tournamentId]/registrations/payment-reminders/route.ts',
      'components/coaches/CoachTournamentRecord.tsx', 'lib/basic-coach-teams.ts', 'lib/event-recap-read.ts',
    ]) assert.ok(readCode(f).includes('entry_lowered'), f + ' reads entry_lowered');
  });
});
