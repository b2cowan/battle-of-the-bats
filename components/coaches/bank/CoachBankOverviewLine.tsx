'use client';
/**
 * THE COACH MONEY OVERVIEW'S BANK LINE (Bank balance check BC8a; K7, R0 tab 7 drew it "in the Cash on hand card's foot,
 * right of 'Ledger'"; built under the IN/OUT bars, above the foot: the walk found it can't fit beside "Ledger →").
 *   · "Check your bank balance ›" + a quiet line — until the first check, in EVERY season stage (bank check novice UX S2,
 *     ask A3, drawing D3 + the S2 drawings): an invitation, because "Bank: not checked yet" named a state, not a next step.
 *     Both lines are ONE door. Only for someone who can check; a reader keeps the plain "Bank: not checked yet ›".
 *   · "Bank: checked through {date} ›"  — the season's latest check, a door to the Bank view
 *   · the amber "Off by $X" chip beside it when that check is off — a door to the check itself (every highlight opens)
 * No "Matches": quiet when all is well, as the club's settled Overview line is. Never a figure but the chip's.
 * Money read and money write alike (the route answers both; a reader's Bank view has no form, K7).
 * `standalone`: in the setup Overview (Plan and Collect), which has no Cash on hand card to sit in — the line stands on its
 * own above the rail, a little air above and below, its left edge on the card edge.
 * ⚠ QUIET (BC5a's lesson: the bank tables reach production with the bank code): a read that fails — refused, no live
 *   season, offline, an older server — draws no line, and the card stands as it did. The route logs a server failure
 *   (`withObservability`); nothing here may take down the Overview.
 * ⚖ D1: the coach's own screen. The club never reads this (tests/unit/bank-coach-routes-guard.test.ts §3).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { CoachChip } from '@/components/coaches/kit';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { cents, dayYear } from '@/lib/bank-screen';
import { bankCheckHref, readTeamBank, type TeamBank } from './coachBank';
import b from './CoachBank.module.css';

export default function CoachBankOverviewLine({ orgSlug, teamId, href, standalone = false }: {
  orgSlug: string;
  teamId: string;
  /** Money → Ledger → View: Bank (the hub's own `sectionHref`, so the address keeps the hub's other params). */
  href: string;
  /** Stands on its own in the setup Overview (no card around it). */
  standalone?: boolean;
}) {
  const [view, setView] = useState<TeamBank | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    void readTeamBank(orgSlug, teamId).then(r => { if (!current) return; if (r.ok) setView(r.view); else setFailed(true); });
    return () => { current = false; };
  }, [orgSlug, teamId]);

  const frame = `${b.overviewMark}${standalone ? ` ${b.overviewStandalone}` : ''}`;
  // While the read is out, a phone holds the row (no jump under the thumb); a failed read draws nothing.
  if (!view) return failed ? null : <span className={`${frame} ${b.overviewHold}`} aria-hidden />;
  const t = view.checkedThrough;
  // The invitation: never checked, and the person can check (a reader's Bank view has no form to invite them to).
  if (!t && view.canWrite) {
    return (
      <span className={frame}>
        <Link href={href} className={`${b.overviewDoor} ${b.overviewInvite}`}>
          <span className={b.inviteMain}>{W.inviteLead}<ChevronRight size={14} aria-hidden /></span>
          <span className={b.inviteNote}>{W.inviteNote}</span>
        </Link>
      </span>
    );
  }
  return (
    <span className={frame}>
      <Link href={href} className={b.overviewDoor}>
        {/* The last words keep the "›" (a phone wraps the sentence, never leaving the chevron alone on a line). */}
        {t ? <>{W.overviewLead} {W.overviewThrough} <span className={b.overviewDate}><b>{dayYear(t.date)}</b><ChevronRight size={14} aria-hidden /></span></>
          : <>{W.overviewLead} <span className={b.overviewDate}>{W.overviewNoAccount}<ChevronRight size={14} aria-hidden /></span></>}
      </Link>
      {t?.result === 'off' && (
        <Link href={bankCheckHref(href, t.id)} className={b.chipDoor}
          aria-label={W.openOffCheck(cents(t.offByCents), dayYear(t.date))}>
          <CoachChip tone="warn">{W.offBy(cents(t.offByCents))}</CoachChip>
        </Link>
      )}
    </span>
  );
}
