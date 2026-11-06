'use client';
/**
 * ACCOUNTING › BANK (Bank balance check BC1; plan docs/projects/active/BANK_RECONCILIATION_PLAN.md §6, drawings
 * BANK_BALANCE_CHECK_DRAWINGS.html, owner rulings 1 and 3 + asks 1–10 and Q1–Q3, 2026-11-05).
 *
 * A treasurer types a bank statement's date and balance; every book line on or before it counts by itself, and the check
 * saves whether it matches or not. What the tab shows, in order of the question it answers:
 *   · no account yet ............................ "Start checking", the first-check card (its whole body)
 *   · an account not started (a second one) ..... the same card for that account
 *   · otherwise ................................. the account line ("{date} · Matches|Off by $X") and the saved checks
 *   · a second account .......................... the Account pill (only then) with "Add an account" at its foot
 * ⚠ BC1 ships no check form: the check sits on this tab above the saved checks (ask 10), built in BC2. Until then the dev
 *   tab shows the account pill, Name and books and the saved-checks list only.
 * ⚖ NO YEAR PILL, no year anywhere: a statement may straddle a fiscal year.
 * ⚖ Every figure is the server's (rule 6): each write answers with the account read again, and the screen draws it.
 * ⚖ A member who can open Accounting but not move club money (B7) reads the same tab with every write control absent.
 */
import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import SingleSelectDropdown from '@/components/coaches/SingleSelectDropdown';
import pill from '@/components/shared/FilterPill.module.css';
import LoadingState from '@/components/shared/LoadingState';
import PageNotice, { useNotice } from '../../PageNotice';
import { Callout, LoadFailed, useDeferredLoad, useLatestRead } from '../../RepKit';
import { moneyFetch } from '../MoneyKit';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { bankUrl, throughWords, type AccountView, type Overview } from './BankShared';
import BankSetup from './BankSetup';
import BankStatements from './BankStatements';
import { AccountWindow } from './BankWindows';
import s from './Bank.module.css';

type Win = { kind: 'addAccount' } | { kind: 'editAccount' } | null;

export default function BankTab({ orgSlug }: { orgSlug: string }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [failed, setFailed] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [view, setView] = useState<AccountView | null>(null);
  const [viewFailed, setViewFailed] = useState(false);
  const [win, setWin] = useState<Win>(null);
  const [notice, setNotice] = useNotice();

  const beginRead = useLatestRead();
  /** `quiet`: a refresh after a save — if it fails the screen stays, rather than becoming a load failure. */
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
  const loadView = useCallback(async (id: string) => {
    const current = beginView();
    setViewFailed(false);
    const r = await moneyFetch<AccountView>(bankUrl(orgSlug, `/accounts/${id}`)).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setViewFailed(true); return; }
    setView(r.data);
  }, [orgSlug, beginView]);

  // A different account is a fresh read; a write's answer arrives with the write (the account read again), so the read
  // is skipped when the view in hand already is that account.
  const heldAccountId = view?.account.id ?? null;
  const loadWanted = useCallback(() => {
    if (!accountId || heldAccountId === accountId) return undefined;
    return loadView(accountId);
  }, [accountId, heldAccountId, loadView]);
  useDeferredLoad(!!accountId, loadWanted);

  if (failed) return <LoadFailed title={W.loadFailed} onRetry={() => void loadOverview()} />;
  if (!overview) return <LoadingState label={W.loading} />;

  const canMove = overview.canMove;
  const noticeEl = notice && <PageNotice notice={notice} />;

  // ── no account yet ──
  if (overview.never || !accountId) {
    if (!canMove) return <Callout role="status">{W.setupReader}</Callout>;
    return (
      <>
        {noticeEl}
        <BankSetup orgSlug={orgSlug} account={null} books={overview.books}
          onSaved={v => { setAccountId(v.account.id); setView(v); void loadOverview(); }} />
      </>
    );
  }

  if (viewFailed) return <LoadFailed title={W.loadFailed} onRetry={() => void loadView(accountId)} />;
  if (!view || view.account.id !== accountId) return <LoadingState label={W.loadingAccount} />;

  const accounts = view.accounts;
  const pickAccount = (id: string) => { setWin(null); setView(null); setAccountId(id); };

  // The Account pill only at a second account, each option saying its latest check, "Add an account" at its foot as
  // "Add ledger" is on the Book pill. One account: its name in the line, and the door to add one.
  const accountLine = accounts.length > 1 ? (
    <SingleSelectDropdown lead shrink label={W.accountPill} value={view.account.id} onChange={pickAccount}
      options={accounts.map(a => ({ id: a.id, label: a.name, detail: throughWords(a.checkedThrough) }))}
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

  const body = !view.start
    // A second account named but not started yet: its own first-check card.
    ? canMove
      ? <BankSetup key={view.account.id} orgSlug={orgSlug} account={view.account} books={overview.books} onSaved={setView} />
      : <Callout role="status">{W.setupReader}</Callout>
    : <BankStatements view={view} accountLine={accountLine} tools={accountTools || null} />;

  return (
    <>
      {noticeEl}
      {body}
      {(win?.kind === 'addAccount' || win?.kind === 'editAccount') && (
        <AccountWindow orgSlug={orgSlug} books={overview.books} accounts={accounts}
          editing={win.kind === 'editAccount' ? { id: view.account.id, name: view.account.name } : undefined}
          onClose={() => setWin(null)}
          onPartial={v => { setView(v); void loadOverview(true); }}
          onDone={(v, added) => {
            setWin(null);
            setNotice({ tone: 'good', text: added ? W.added(v.account.name) : W.saved });
            if (added) setAccountId(v.account.id);
            setView(v);
            void loadOverview(true);
          }} />
      )}
    </>
  );
}
