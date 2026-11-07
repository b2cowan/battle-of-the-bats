'use client';
/**
 * THE COACH'S BANK VIEW — Money → Ledger → View: Bank (Bank balance check BC7a; B8 as approved: the Ledger's fourth view).
 * Drawing BANK_BALANCE_CHECK_DRAWINGS.html tab 2 (the coach phone frame), laid out as the club's walked desk Bank tab
 * (owner 2026-11-06, plan §0 "Coach desk and reader"): the head line, the check on top (ask 10), the saved checks under it.
 * ⚖ ONE ACCOUNT, NO SETUP: the team's "Team bank account" is made at its first save; the season's opening balance is the
 *   start (ask 7). "Never checked" is `checks.length === 0`, never `account === null` (BC6b kept edge a).
 * ⚖ K7 / B7: money write sees the form (`canWrite`, the SERVER's); money read sees the head line, the saved checks and an
 *   opened check — no form (so no Find), no Delete, no "Check this statement again", as a club reader does.
 * ⚖ THE WORKING SEASON ONLY (B10): the route reads the live season; a team with no live season never reaches this view
 *   (the team layout's season gate sends it to the closed-season page).
 * ⚖ D1: the club never sees any of this (tests/unit/bank-coach-routes-guard.test.ts §3).
 * Mounted by the Ledger panel, which stays mounted hidden under the Money hub: it reads only while it is on screen
 * (`active`), and again on the money revision (a line added through "Add the missing line", or anywhere in Money).
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import LoadingState from '@/components/shared/LoadingState';
import CoachLoadError from '@/components/coaches/CoachLoadError';
import { CoachChip, ledgerKit } from '@/components/coaches/kit';
import { CoachRow, CoachRowList } from '@/components/coaches/CoachRowList';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { useMoneyRevision } from '@/lib/coach-money-refresh';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { cents, dayYear } from '@/lib/bank-screen';
import { readTeamBank, type TeamBank, type TeamCheck } from './coachBank';
import CoachBankCheck, { type MissingLine } from './CoachBankCheck';
import CoachBankWindow from './CoachBankWindow';
import { DotPart } from './CoachBankFind';
import b from './CoachBank.module.css';

export default function CoachBankView({ orgSlug, teamId, active = true, onAddLine }: {
  orgSlug: string;
  teamId: string;
  /** The Ledger is on screen (the hub keeps it mounted hidden). */
  active?: boolean;
  /** "Add the missing line": the Ledger's own Record money window, filled with the gap (money write only). */
  onAddLine?: (line: MissingLine) => void;
}) {
  const [view, setView] = useState<TeamBank | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  // "Check this statement again": the form starts again on that day (re-keyed, so it scrolls to it with the balance empty).
  const [again, setAgain] = useState<{ date: string; n: number } | null>(null);
  const revision = useMoneyRevision();
  const isPhone = useIsPhone();
  const [retry, setRetry] = useState(0);
  const load = () => setRetry(n => n + 1);
  // A write's answer is the newest read there is: a plain read already in flight when it lands must not replace it (/review).
  const writes = useRef(0);

  useEffect(() => {
    if (!active) return;
    let current = true;
    const at = writes.current;
    void readTeamBank(orgSlug, teamId).then(r => {
      if (!current || at !== writes.current) return;
      if (r.ok) { setView(r.view); setError(''); } else setError(r.error);
    });
    return () => { current = false; };
  }, [active, orgSlug, teamId, revision, retry]);

  if (!view) {
    return error
      ? <CoachLoadError message={error} onRetry={load} />
      : <LoadingState label={W.coachLoading} />;
  }

  const through = view.checkedThrough;
  const latestCheck = view.checks[0];
  const opened = openId ? view.checks.find(c => c.id === openId) ?? null : null;
  const accountName = view.account?.name ?? W.coachAccount;
  /** A write's answer: the bank read again, and what to tell the coach. */
  const settle = (next: TeamBank, text: string) => { writes.current += 1; setView(next); setError(''); setNotice(text); };

  return (
    <div>
      {/* The head line (tab 2, ask 4): the account, how far it is checked, its result; the amber chip opens the latest. */}
      <p className={b.head}>
        {/* Each part keeps its dot: a phone wraps between the parts, never leaving "·" to start a line (BC7b walk). */}
        <b>{accountName}</b>
        {through ? (
          <>
            <DotPart lead><span>{W.overviewThrough} <b>{dayYear(through.date)}</b></span></DotPart>
            {/* The result, with its dot only when there is one to show (/review: never a lone "·"). */}
            {through.result === 'matches' ? <DotPart><span>{W.matches}</span></DotPart> : latestCheck && (
              <DotPart>
                <button type="button" className={b.chipDoor} aria-label={W.openOffCheck(cents(through.offByCents), dayYear(through.date))}
                  onClick={() => setOpenId(latestCheck.id)}>
                  <CoachChip tone="warn">{W.offBy(cents(through.offByCents))}</CoachChip>
                </button>
              </DotPart>
            )}
          </>
        ) : <DotPart lead><span>{W.notChecked}</span></DotPart>}
      </p>
      {/* A re-read that failed once the view is up: say so above the figures it couldn't refresh (/review). */}
      {error && <CoachLoadError message={error} onRetry={load} />}
      {notice && <p className={b.notice} role="status">{notice}</p>}

      {view.canWrite && (
        <CoachBankCheck key={again ? `again-${again.n}` : 'check'} orgSlug={orgSlug} teamId={teamId} view={view} active={active}
          againDate={again?.date} onAddLine={onAddLine}
          onSaved={(next, text) => { setAgain(null); settle(next, text); }}
          onTouched={() => setNotice('')} />
      )}

      <h3 className={`${styles.panelSubhead} ${b.listHead}`}>{W.listTitle}</h3>
      {view.checks.length === 0 ? (
        <p className={`${styles.formHint} ${b.empty}`}>{W.coachNoChecksYet}</p>
      ) : isPhone ? (
        // On a phone each check is a row of the portal's framed list, the whole row its door (the club's BC4b cards):
        // "Oct 31, 2026 · $3,060.00", its result, who checked it and when.
        <CoachRowList label={W.listTitle}>
          {view.checks.map(c => (
            // No aria-label: the row's own words (date, balance, result, who) are its name, as the desk's cells read (/review).
            <CoachRow key={c.id} as="button" door="chevron" aria-haspopup="dialog" onClick={() => setOpenId(c.id)}
              title={W.cardTitle(dayYear(c.date), cents(c.bankCents))}
              caption={<>
                <span className={b.cardLine}><Result c={c} /></span>
                <span className={b.cardLine}>{W.checkedCell(c.checkedBy, dayYear(c.checkedAt))}</span>
              </>} />
          ))}
        </CoachRowList>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>{W.listCol.date}</th>
                <th className={`${styles.th} ${styles.thNum}`}>{W.listCol.bankSaid}</th>
                <th className={`${styles.th} ${styles.thNum}`}>{W.listCol.shouldHave}</th>
                <th className={styles.th}>{W.listCol.result}</th>
                <th className={styles.th}>{W.listCol.checkedBy}</th>
                <th className={styles.th}><span className={styles.srOnly}>{W.listCol.open}</span></th>
              </tr>
            </thead>
            <tbody>
              {view.checks.map(c => (
                // The row is the door, its date the keyboard's; the chevron the row's promise (the Ledger's own row).
                <tr key={c.id} className={`${styles.tr} ${styles.rowTappable}`} onClick={() => { if (!window.getSelection()?.toString()) setOpenId(c.id); }}>
                  <td className={styles.td}>
                    <button type="button" className={ledgerKit.name} aria-haspopup="dialog" aria-label={W.openCheck(dayYear(c.date))}
                      onClick={e => { e.stopPropagation(); setOpenId(c.id); }}>
                      {dayYear(c.date)}
                    </button>
                  </td>
                  <td className={`${styles.td} ${styles.tdNum}`} data-label={W.listCol.bankSaid}>{cents(c.bankCents)}</td>
                  <td className={`${styles.td} ${styles.tdNum}`} data-label={W.listCol.shouldHave}>{cents(c.figure.shouldBeCents)}</td>
                  <td className={styles.td} data-label={W.listCol.result}><Result c={c} /></td>
                  <td className={styles.td} data-label={W.listCol.checkedBy}>{W.checkedCell(c.checkedBy, dayYear(c.checkedAt))}</td>
                  <td className={`${styles.td} ${ledgerKit.goCell}`}>
                    <span className={ledgerKit.goMark} aria-hidden><ChevronRight size={16} /></span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {opened && (
        <CoachBankWindow orgSlug={orgSlug} teamId={teamId} accountName={accountName} check={opened} canWrite={view.canWrite}
          onClose={() => setOpenId(null)}
          onAgain={date => { setOpenId(null); setNotice(''); setAgain(a => ({ date, n: (a?.n ?? 0) + 1 })); }}
          onDeleted={(next, text) => { setOpenId(null); settle(next, text); }} />
      )}
    </div>
  );
}

/** "Matches" · "Matches · 1 line not in the bank yet" · amber "Off by $X" · amber "Books now say $X" (tab 5). */
function Result({ c }: { c: TeamCheck }) {
  const waiting = c.waiting.length;
  return (
    <span className={b.resultCell}>
      {c.figure.result === 'matches'
        ? <span>{waiting ? W.matchesWaiting(waiting) : W.matches}</span>
        : <CoachChip tone="warn">{W.offBy(cents(c.figure.offByCents))}</CoachChip>}
      {c.booksNowSayCents !== null && <CoachChip tone="warn">{W.booksNowSay(cents(c.booksNowSayCents))}</CoachChip>}
    </span>
  );
}
