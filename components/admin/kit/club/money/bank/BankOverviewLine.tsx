'use client';
/**
 * THE ACCOUNTING OVERVIEW'S BANK LINE (Bank balance check BC5a; ask 4, R0 tab 7 "C7 · The Overview line", balance-check
 * drawings tab 5's side frame; owner 2026-11-06 "Overview accounts" and "Overview past year"; CHANGED by the owner 2026-11-09,
 * drawings BANK_OVERVIEW_LINE_DRAWINGS.html option A: ONE line, whatever the number of accounts).
 *
 * Right of "Where the club stands" — the heading row, no new row of its own (drawn), and never a second line: the old stack
 * (one line per account) made the heading row a line taller for every account and pushed the money tiles down.
 *   · "Bank: {account} checked through {date} ›"  — ONE account: the wording the line always had (or "· not checked yet ›")
 *   · "Bank: oldest check {date} ›"               — several accounts, all checked: the club is only checked as far as its oldest
 *   · "Bank: 1 of 3 not checked yet ›"            — several accounts, some never checked (wins over the date)
 *   · "Bank: not checked yet ›"                   — no account yet, for a writer (the Bank tab's first-check card)
 *   · "Check your bank balance ›" + a quiet line — the TWO not-checked states a writer can act on (one account never checked,
 *     no account yet) INVITE instead (bank check S2, A3): one door, the same words as the coach's line. The "1 of 3" count stays.
 *   · the amber chip beside it when a check is off: "Off by $X" (a door to that check) or "2 off" (a door to the Bank tab)
 * The line is a door to the Bank tab on the account it names (the Bank tab lists every account). A reader at a club with no
 * account sees no line: the Bank tab would only tell them to ask the treasurer.
 * ⚖ Never a figure (the drawing): the band below holds the money, and a second balance would read as a competing number.
 * ⚖ TODAY on every year the Year pill shows, as the band beside it is (the server's read names no year).
 * Every figure, date and decision is the server's (`bankMarks`) or the pure rule's (`bankOverviewLine`); this formats.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { RepChip } from '../../RepKit';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { bankOverviewLine } from '@/lib/bank-club-rules';
import type { bankMarks } from '@/lib/bank-club-steps';
import { bankTabHref, cents, dayYear } from './BankShared';
import s from './Bank.module.css';

export type BankMarks = NonNullable<Awaited<ReturnType<typeof bankMarks>>>;

export default function BankOverviewLine({ marks, accountingBase, children }: {
  marks: BankMarks | null;
  accountingBase: string;
  /** The heading the line sits right of ("Where the club stands · today"). */
  children: ReactNode;
}) {
  const door = (accountId?: string, checkId?: string) => bankTabHref(accountingBase, accountId, checkId);
  const { line, off } = bankOverviewLine(marks?.accounts ?? []);

  let words: ReactNode = null;
  let href = door();
  // Bank check S2 (A3): until the first check the line INVITES — "Check your bank balance ›" and a quiet line, one door — for
  // someone who can check: one account never checked, or no account yet (a writer's first-check door). Several accounts with
  // some never checked keep their count ("1 of 3 not checked yet"); a checked line is as it was.
  let invite = false;
  if (line.kind === 'none') {
    // A reader at a club with no account sees nothing; a writer gets the first-check door.
    if (marks?.canMove) { words = <>{W.overviewLead} {W.overviewNoAccount}</>; invite = true; }
  } else if (line.kind === 'one') {
    const t = line.account.checkedThrough;
    href = door(line.account.id);
    words = <>{W.overviewLead} <b>{line.account.name}</b>{' '}{t ? <>{W.overviewThrough} <b>{dayYear(t.date)}</b></> : W.overviewNotChecked}</>;
    invite = !t && !!marks?.canMove;
  } else if (line.kind === 'never') {
    href = door(line.door);
    words = <>{W.overviewLead} <b>{W.overviewSomeNotChecked(line.notChecked, line.total)}</b></>;
  } else {
    href = door(line.door);
    words = <>{W.overviewLead} {W.overviewOldest} <b>{dayYear(line.date)}</b></>;
  }

  return (
    <div className={s.overviewHead}>
      {children}
      {words && (
        <div className={s.overviewMarks}>
          <span className={s.overviewMark}>
            {invite ? (
              <Link href={href} className={`${s.overviewDoor} ${s.overviewInvite}`}>
                <span className={s.inviteMain}>{W.inviteLead}<ChevronRight size={14} aria-hidden /></span>
                <span className={s.inviteNote}>{W.inviteNote}</span>
              </Link>
            ) : (
              <Link href={href} className={s.overviewDoor}>
                {words}<ChevronRight size={14} aria-hidden />
              </Link>
            )}
            {/* Every highlight opens: one off check is a door to that check, several a door to the Bank tab. */}
            {off.count === 1 && 'checkId' in off && (
              <Link href={door(off.accountId, off.checkId)} className={s.chipDoor}
                aria-label={W.openOffCheck(cents(off.offByCents), dayYear(off.date))}>
                <RepChip tone="warn">{W.offBy(cents(off.offByCents))}</RepChip>
              </Link>
            )}
            {off.count > 1 && (
              <Link href={door()} className={s.chipDoor} aria-label={W.openOffChecks(off.count)}>
                <RepChip tone="warn">{W.offCount(off.count)}</RepChip>
              </Link>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
