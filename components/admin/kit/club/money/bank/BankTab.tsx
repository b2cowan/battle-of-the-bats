'use client';
/**
 * ACCOUNTING › BANK (Bank reconciliation R2c — desk; plan docs/projects/active/BANK_RECONCILIATION_PLAN.md §6 C1–C5 and
 * C10, drawings BANK_RECONCILIATION_DRAWINGS.html, asks B1–B12 and 1–14 ruled A 2026-11-04).
 *
 * A treasurer names the club's bank account, enters where the books stood on a starting day, then checks statements:
 * types the end date and ending balance, ticks the book lines the statement shows, reaches a Difference of $0.00 and
 * marks it checked. What the tab shows, in order of the question it answers:
 *   · no account yet ............................ C1, the setup card (its whole body)
 *   · an account not set up (a second one) ...... C1 for that account
 *   · a statement open .......................... C2 / C3, straight into it (Finish later goes back to the list)
 *   · otherwise ................................. C4 / C5, the statements and "checked through"
 *   · a second account .......................... C10, the Account pill (only then) with "Add an account" at its foot
 * ⚖ NO YEAR PILL, no year anywhere (B3, B10): a statement may straddle a fiscal year.
 * ⚖ Every figure is the server's (rule 6): each write answers with the account read again, and the screen draws it.
 * ⚖ A member who can open Accounting but not move club money (B7) reads the same tab with every write control absent.
 */
import { useCallback, useState } from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import SingleSelectDropdown from '@/components/coaches/SingleSelectDropdown';
import pill from '@/components/shared/FilterPill.module.css';
import LoadingState from '@/components/shared/LoadingState';
import PageNotice, { useNotice } from '../../PageNotice';
import { Callout, LoadFailed, useDeferredLoad, useLatestRead } from '../../RepKit';
import { moneyFetch } from '../MoneyKit';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { bankUrl, dayYear, type AccountView, type Overview, type Summary } from './BankShared';
import BankSetup from './BankSetup';
import BankCheck from './BankCheck';
import BankStatements from './BankStatements';
import { AccountWindow, FeeWindow, StatementWindow, UndoWindow } from './BankWindows';
import s from './Bank.module.css';

type Win = { kind: 'start' } | { kind: 'edit' } | { kind: 'fee' } | { kind: 'undo'; summary: Summary } | { kind: 'addAccount' } | { kind: 'editAccount' } | null;

export default function BankTab({ orgSlug }: { orgSlug: string }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [failed, setFailed] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [view, setView] = useState<AccountView | null>(null);
  const [viewFailed, setViewFailed] = useState(false);
  /** The statement on screen; null = the list. Undefined until the first read decides (straight into an open one). */
  const [checkId, setCheckId] = useState<string | null | undefined>(undefined);
  const [win, setWin] = useState<Win>(null);
  const [notice, setNotice] = useNotice();

  const beginRead = useLatestRead();
  /** `quiet`: a refresh after a save — if it fails the screen the coach is working in stays, rather than becoming a load failure. */
  const loadOverview = useCallback(async (quiet?: boolean) => {
    const current = beginRead();
    if (!quiet) setFailed(false);
    const r = await moneyFetch<Overview>(bankUrl(orgSlug)).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { if (!quiet) setFailed(true); return; }
    setOverview(r.data);
    setAccountId(id => (id && r.data.accounts.some(a => a.id === id) ? id : r.data.accounts[0]?.id ?? null));
  }, [orgSlug, beginRead]);
  useDeferredLoad(!!orgSlug, loadOverview);

  const beginView = useLatestRead();
  const loadView = useCallback(async (id: string, check: string | null) => {
    const current = beginView();
    setViewFailed(false);
    const r = await moneyFetch<AccountView>(bankUrl(orgSlug, `/accounts/${id}`, { check })).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setViewFailed(true); return; }
    setView(r.data);
    // The first read opens an open statement straight away; after that the screen says which one it shows.
    setCheckId(c => (c === undefined ? (r.data.shown?.status === 'open' ? r.data.shown.checkId : null) : c));
  }, [orgSlug, beginView]);

  // A different account or statement is a fresh read; a write's answer arrives with the write (the account read again).
  // ...so the read is skipped when the view in hand already is that answer (the list needs no statement; an open one needs
  // its own), which stops a write that also moves the screen from reading the same account a second time.
  const wanted = checkId ?? null;
  // What the held view shows is a dependency too: a late answer that lands for a statement other than the one asked for
  // is read again rather than left on screen.
  const heldAccountId = view?.account.id ?? null;
  const heldShownId = view?.shown?.checkId ?? null;
  const loadWanted = useCallback(() => {
    if (!accountId) return undefined;
    if (heldAccountId === accountId && (wanted === null || heldShownId === wanted)) return undefined;
    return loadView(accountId, wanted);
  }, [accountId, wanted, heldAccountId, heldShownId, loadView]);
  useDeferredLoad(!!accountId, loadWanted);

  /** A refused write: its words, and the account read again (the server's truth replaces whatever was on screen). */
  const refused = (text: string) => {
    setNotice({ tone: 'bad', text });
    if (accountId) void loadView(accountId, checkId ?? null);
  };

  if (failed) return <LoadFailed title={W.loadFailed} onRetry={() => void loadOverview()} />;
  if (!overview) return <LoadingState label={W.loading} />;

  const canMove = overview.canMove;
  const noticeEl = notice && <PageNotice notice={notice} />;

  // ── C1 · no account yet ──
  if (overview.never || !accountId) {
    if (!canMove) return <Callout role="status">{W.setupReader}</Callout>;
    return (
      <>
        {noticeEl}
        <BankSetup orgSlug={orgSlug} account={null} books={overview.books}
          onSaved={v => { setCheckId(null); setAccountId(v.account.id); setView(v); setWin({ kind: 'start' }); void loadOverview(); }} />
      </>
    );
  }

  if (viewFailed) return <LoadFailed title={W.loadFailed} onRetry={() => void loadView(accountId, checkId ?? null)} />;
  // The held view is the statement asked for, or the screen waits for the read: never one statement's ticks under another's click.
  if (!view || view.account.id !== accountId || (checkId && view.shown?.checkId !== checkId)) return <LoadingState label={W.loadingAccount} />;

  const accounts = view.accounts;
  const shown = checkId ? view.shown : null;
  const summary = shown ? view.checks.find(c => c.id === shown.checkId) ?? null : null;
  const pickAccount = (id: string) => { setWin(null); setCheckId(undefined); setView(null); setAccountId(id); };

  // C10: the Account pill only at a second account, each option saying how far it is checked, "Add an account" at its
  // foot as "Add ledger" is on the Book pill. One account: its name in the line, and the door to add one.
  const accountLine = accounts.length > 1 ? (
    <SingleSelectDropdown lead shrink label={W.accountPill} value={view.account.id} onChange={pickAccount}
      options={accounts.map(a => ({ id: a.id, label: a.name, detail: a.checkedThrough ? W.through(dayYear(a.checkedThrough)) : W.notChecked }))}
      foot={canMove ? (
        <button type="button" className={`${pill.multiSelectOption} ${pill.multiSelectPick}`} onClick={() => setWin({ kind: 'addAccount' })}>
          <Plus size={14} aria-hidden /> {W.addAccount}
        </button>
      ) : undefined} />
  ) : null;
  const accountTools = canMove && (
    <span className={s.statusLine}>
      {accounts.length === 1 && <button type="button" className={s.link} onClick={() => setWin({ kind: 'addAccount' })}>{W.addAccount}</button>}
      <button type="button" className={s.link} onClick={() => setWin({ kind: 'editAccount' })}>{W.editAccount}</button>
    </span>
  );

  let body: React.ReactNode;
  if (!view.account.setup) {
    // A second account named but not set up yet: its own setup card (C10's "Add and set it up").
    body = canMove
      ? <BankSetup key={view.account.id} orgSlug={orgSlug} account={view.account} books={overview.books}
          onSaved={v => { setCheckId(null); setView(v); setWin({ kind: 'start' }); }} />
      : <Callout role="status">{W.setupReader}</Callout>;
  } else if (shown && summary) {
    body = (
      <BankCheck key={shown.checkId} orgSlug={orgSlug} view={view} shown={shown} summary={summary} canMove={canMove}
        onAnswer={setView}
        onMarked={(v, again) => {
          setNotice({ tone: 'good', text: (again ? W.markedAgain : W.marked)(dayYear(shown.statementEndDate)) });
          setView(v);
          setCheckId(null);
        }}
        onRefused={refused}
        onFinishLater={() => setCheckId(null)}
        onEdit={() => setWin({ kind: 'edit' })}
        onFee={() => setWin({ kind: 'fee' })}
        onUndo={() => setWin({ kind: 'undo', summary })} />
    );
  } else {
    body = (
      <BankStatements view={view} canMove={canMove} accountLine={accountLine} tools={accountTools || null}
        onOpen={id => setCheckId(id)} onStart={() => setWin({ kind: 'start' })} onUndo={sm => setWin({ kind: 'undo', summary: sm })} />
    );
  }

  return (
    <>
      {noticeEl}
      {view.payoutsUnavailable && !shown && view.account.setup && (
        <Callout tone="warn" role="status" icon={<AlertTriangle size={16} aria-hidden />}>{W.payoutsUnavailable}</Callout>
      )}
      {body}

      {win?.kind === 'start' && (
        <StatementWindow orgSlug={orgSlug} view={view} onClose={() => setWin(null)}
          onDone={v => { setWin(null); setView(v); setCheckId(v.shown?.checkId ?? null); }} />
      )}
      {win?.kind === 'edit' && summary && (
        <StatementWindow orgSlug={orgSlug} view={view} editing={summary} onClose={() => setWin(null)}
          onDone={v => { setWin(null); setView(v); }} />
      )}
      {win?.kind === 'fee' && shown && (
        <FeeWindow orgSlug={orgSlug} view={view} shown={shown} onClose={() => setWin(null)}
          onDone={v => { setWin(null); setView(v); }} />
      )}
      {win?.kind === 'undo' && (
        <UndoWindow orgSlug={orgSlug} view={view} summary={win.summary} onClose={() => setWin(null)}
          onStale={text => { setWin(null); refused(text); }}
          onDone={v => { setWin(null); setNotice({ tone: 'good', text: W.undone(dayYear(win.summary.statementEndDate)) }); setView(v); setCheckId(win.summary.id); }} />
      )}
      {(win?.kind === 'addAccount' || win?.kind === 'editAccount') && (
        <AccountWindow orgSlug={orgSlug} books={overview.books} accounts={accounts}
          editing={win.kind === 'editAccount' ? { id: view.account.id, name: view.account.name } : undefined}
          onClose={() => setWin(null)}
          onPartial={v => { setView(v); void loadOverview(true); }}
          onDone={(v, added) => {
            setWin(null);
            setNotice({ tone: 'good', text: added ? W.added(v.account.name) : W.saved });
            if (added) { setCheckId(null); setAccountId(v.account.id); }
            setView(v);
            void loadOverview(true);
          }} />
      )}
    </>
  );
}
