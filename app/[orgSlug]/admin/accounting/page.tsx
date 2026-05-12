'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { DollarSign, X } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { hasCapability } from '@/lib/roles';
import FeedbackModal from '@/components/FeedbackModal';
import styles from './accounting.module.css';
import type { LedgerSummary } from '@/lib/types';

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 2,
  }).format(n);
}

function defaultDateRange(): { from: string; to: string } {
  const y = new Date().getFullYear();
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

export default function AccountingOverviewPage() {
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const { tournaments } = useTournament();
  const base    = `/${currentOrg?.slug ?? ''}/admin`;
  const isOwner = userRole === 'owner';

  const defaults = defaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo,   setDateTo]   = useState(defaults.to);

  const [ledgers,  setLedgers]  = useState<LedgerSummary[]>([]);
  const [fetching, setFetching] = useState(true);

  const [addOpen,   setAddOpen]   = useState(false);
  const [newName,   setNewName]   = useState('');
  const [creating,  setCreating]  = useState(false);

  const [creatingForTournamentId, setCreatingForTournamentId] = useState<string | null>(null);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'success' | 'danger'>('success');
  const [feedbackMsg,  setFeedbackMsg]  = useState('');

  // Highlight ledger card linked from the tournament sidebar link
  const [highlightEntityId, setHighlightEntityId] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setHighlightEntityId(params.get('tournamentId'));
  }, []);

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [ledgers]);

  function showFeedback(type: 'success' | 'danger', msg: string) {
    setFeedbackType(type); setFeedbackMsg(msg); setFeedbackOpen(true);
  }

  const load = useCallback(async (from: string, to: string) => {
    setFetching(true);
    try {
      const qs  = new URLSearchParams({ from, to });
      const res  = await fetch(`/api/admin/accounting/ledgers?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setLedgers(data.ledgers ?? []);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to load accounting data.');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (currentOrg) load(defaults.from, defaults.to);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg]);

  async function handleCreateLedger() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/accounting/ledgers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, entityType: 'org' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create ledger');
      setAddOpen(false);
      setNewName('');
      await load(dateFrom, dateTo);
      showFeedback('success', `Ledger "${name}" created.`);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to create ledger.');
    } finally {
      setCreating(false);
    }
  }

  async function handleOpenTournamentLedger(tournamentId: string, tournamentName: string) {
    setCreatingForTournamentId(tournamentId);
    try {
      const res = await fetch('/api/admin/accounting/ledgers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tournamentName, entityType: 'tournament', entityId: tournamentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create ledger');
      await load(dateFrom, dateTo);
      showFeedback('success', `Ledger opened for "${tournamentName}".`);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to open tournament ledger.');
    } finally {
      setCreatingForTournamentId(null);
    }
  }

  if (loading) return <p className={styles.muted}>Loading…</p>;

  if (!userRole || !hasCapability(userRole, userCapabilities, 'module_accounting')) {
    return (
      <div className={styles.accessDenied}>
        <DollarSign size={32} />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have access to the Accounting module. Contact your organization owner to enable it.</p>
      </div>
    );
  }

  // G1: org-level totals exclude inter-ledger transfers (incomeOnly / expensesOnly)
  const totalIncome   = ledgers.reduce((s, l) => s + l.incomeOnly,    0);
  const totalExpenses = ledgers.reduce((s, l) => s + l.expensesOnly,  0);
  const netPosted     = ledgers.reduce((s, l) => s + l.netPosted,     0);
  const pendingIn     = ledgers.reduce((s, l) => s + l.pendingIncome,  0);
  const pendingOut    = ledgers.reduce((s, l) => s + l.pendingExpenses, 0);

  // F2: tournaments that don't yet have a ledger
  const ledgerEntityIds = new Set(ledgers.map(l => l.ledger.entityId).filter(Boolean));
  const tournamentsWithoutLedger = tournaments.filter(
    t => t.status !== 'archived' && !ledgerEntityIds.has(t.id)
  );

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerIcon}><DollarSign size={20} /></div>
        <div>
          <h1 className={styles.pageTitle}>Accounting Overview</h1>
          <p className={styles.pageSub}>{currentOrg?.name} — all ledgers</p>
        </div>
      </div>

      {/* G2: date range filter */}
      <div className={styles.dateFilterRow}>
        <span className={styles.dateFilterLabel}>Period</span>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="acc-from">From</label>
          <input
            id="acc-from"
            type="date"
            className={styles.dateInput}
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="acc-to">To</label>
          <input
            id="acc-to"
            type="date"
            className={styles.dateInput}
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => load(dateFrom, dateTo)}
          disabled={fetching}
        >
          {fetching ? 'Loading…' : 'Apply'}
        </button>
      </div>

      {fetching ? (
        <p className={styles.muted}>Loading…</p>
      ) : (
        <>
          {/* G1: org totals — income/expenses exclude transfers so they don't double-count */}
          {ledgers.length > 0 && (
            <div className={styles.totalsCard}>
              <div className={styles.totalItem}>
                <span className={styles.totalLabel}>Total Income</span>
                <div className={`${styles.totalValue} ${styles.totalValuePos}`}>{formatCurrency(totalIncome)}</div>
              </div>
              <div className={styles.totalItem}>
                <span className={styles.totalLabel}>Total Expenses</span>
                <div className={`${styles.totalValue} ${styles.totalValueNeg}`}>{formatCurrency(totalExpenses)}</div>
              </div>
              <div className={styles.totalItem}>
                <span className={styles.totalLabel}>Net Position</span>
                <div className={`${styles.totalValue} ${netPosted > 0 ? styles.totalValuePos : netPosted < 0 ? styles.totalValueNeg : ''}`}>
                  {formatCurrency(netPosted)}
                </div>
              </div>
              {(pendingIn > 0 || pendingOut > 0) && (
                <div className={styles.totalItem}>
                  <span className={styles.totalLabel}>Pending</span>
                  <div className={styles.totalValue} style={{ color: '#fbbf24' }}>
                    {pendingIn  > 0 && `+${formatCurrency(pendingIn)}`}
                    {pendingIn  > 0 && pendingOut > 0 && ' / '}
                    {pendingOut > 0 && `−${formatCurrency(pendingOut)}`}
                  </div>
                </div>
              )}
            </div>
          )}

          {ledgers.length === 0 ? (
            <p className={styles.muted}>No ledgers yet. Use the button below to create your first one.</p>
          ) : (
            <div className={styles.ledgerGrid}>
              {ledgers.map(({ ledger, pendingIncome, pendingExpenses, netPosted: net }) => {
                const isHighlighted = ledger.entityId === highlightEntityId;
                return (
                  <div
                    key={ledger.id}
                    ref={isHighlighted ? highlightRef : null}
                    className={`${styles.ledgerCard} ${isHighlighted ? styles.ledgerCardHighlight : ''}`}
                  >
                    <div className={styles.ledgerCardHeader}>
                      <span className={styles.ledgerName}>{ledger.name}</span>
                      <span className={`${styles.typeBadge} ${ledger.entityType === 'org' ? styles.typeBadgeOrg : styles.typeBadgeTournament}`}>
                        {ledger.entityType === 'org' ? 'Org' : 'Tournament'}
                      </span>
                    </div>

                    <div className={`${styles.balanceAmount} ${net > 0 ? styles.balancePos : net < 0 ? styles.balanceNeg : styles.balanceNeutral}`}>
                      {formatCurrency(net)}
                    </div>
                    <div className={styles.balanceLabel}>Net posted balance</div>

                    {(pendingIncome > 0 || pendingExpenses > 0) && (
                      <div className={styles.pendingRow}>
                        <span>Pending</span>
                        <span style={{ color: '#fbbf24' }}>
                          {pendingIncome  > 0 && `+${formatCurrency(pendingIncome)}`}
                          {pendingIncome  > 0 && pendingExpenses > 0 && ' / '}
                          {pendingExpenses > 0 && `−${formatCurrency(pendingExpenses)}`}
                        </span>
                      </div>
                    )}

                    <Link href={`${base}/accounting/ledger/${ledger.id}`} className={styles.viewLink}>
                      View Ledger →
                    </Link>
                  </div>
                );
              })}
            </div>
          )}

          {/* F2: tournaments without ledgers — offer one-click ledger creation */}
          {(isOwner || userRole === 'treasurer') && tournamentsWithoutLedger.length > 0 && (
            <div className={styles.pendingLedgersSection}>
              <div className={styles.sectionTitle}>Tournaments without a ledger</div>
              {tournamentsWithoutLedger.map(t => (
                <div key={t.id} className={styles.pendingLedgerRow}>
                  <span className={styles.pendingLedgerName}>{t.name}</span>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    disabled={creatingForTournamentId === t.id}
                    onClick={() => handleOpenTournamentLedger(t.id, t.name)}
                  >
                    {creatingForTournamentId === t.id ? 'Opening…' : 'Open Ledger'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {(isOwner || userRole === 'treasurer') && (
            <div className={styles.footerRow} style={{ marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setAddOpen(true)}>
                + Add Ledger
              </button>
            </div>
          )}
        </>
      )}

      {/* Add Ledger modal */}
      {addOpen && (
        <div className={styles.modalOverlay} onClick={() => setAddOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Add Ledger</h3>
              <button className={styles.modalCloseBtn} onClick={() => setAddOpen(false)}><X size={16} /></button>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="acc-new-ledger-name">Ledger Name</label>
              <input
                id="acc-new-ledger-name"
                className={styles.input}
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value.slice(0, 100))}
                placeholder="e.g. Fundraising Account"
                maxLength={100}
                autoFocus
              />
              <p className={styles.hint}>Creates an org-level sub-ledger. Tournament ledgers are created from the Tournaments section above.</p>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className="btn btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleCreateLedger} disabled={creating || !newName.trim()}>
                {creating ? 'Creating…' : 'Create Ledger'}
              </button>
            </div>
          </div>
        </div>
      )}

      <FeedbackModal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        title={feedbackType === 'success' ? 'Done' : 'Error'}
        message={feedbackMsg}
        type={feedbackType}
      />
    </div>
  );
}
