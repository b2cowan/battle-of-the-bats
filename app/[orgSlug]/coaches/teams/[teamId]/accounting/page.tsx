'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { DollarSign, Users, Receipt, Building2, BarChart3, TrendingUp, Gift, ArrowLeftRight, Bell } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import HelpCallout from '@/components/help/HelpCallout';
import UpcomingPayablesPanel from '@/components/accounting/UpcomingPayablesPanel';
import styles from '../../../coaches.module.css';

interface BudgetSummary {
  budgetAmount: number | null;
  duesCollected: number;
  totalExpenses: number;
  net: number;
}

function fmt(n: number) {
  return `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CoachesAccountingPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const params = use(paramsPromise);
  const { orgSlug, teamId } = params;
  const { assignments, loading: ctxLoading } = useCoaches();

  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [autoReminders, setAutoReminders] = useState<boolean | null>(null);
  const [reminderSaving, setReminderSaving] = useState(false);

  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [budgetRes, settingsRes] = await Promise.all([
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget`),
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/accounting-settings`),
      ]);
      if (!budgetRes.ok) throw new Error((await budgetRes.json().catch(() => ({}))).error ?? 'Failed to load');
      const data = await budgetRes.json();
      setSummary(data);
      setBudgetInput(data.budgetAmount != null ? String(data.budgetAmount) : '');
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        setAutoReminders(settings.autoRemindersEnabled ?? true);
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load budget.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => { load(); }, [load]);

  async function saveBudget() {
    setSaveError('');
    setSaving(true);
    try {
      const amount = parseFloat(budgetInput);
      if (isNaN(amount) || amount < 0) throw new Error('Enter a valid budget amount');
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budgetAmount: amount }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      setEditingBudget(false);
      await load();
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleAutoReminders(enabled: boolean) {
    setReminderSaving(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/accounting-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoRemindersEnabled: enabled }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setAutoReminders(enabled);
    } finally {
      setReminderSaving(false);
    }
  }

  if (ctxLoading) return <p className={styles.muted}>Loading…</p>;
  if (!assignment) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  const net = summary?.net ?? 0;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><DollarSign size={22} /></div>
          <div>
            <nav className={styles.breadcrumb}>
              <Link href={`/${orgSlug}/coaches`}>Portal</Link>
              <span>/</span>
              <Link href={base}>{assignment.teamName}</Link>
              <span>/</span>
              <span>Accounting</span>
            </nav>
            <h1 className={styles.pageTitle}>Team Accounting</h1>
            <p className={styles.pageSub}>{assignment.programYearName}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : summary && (
        <>
          {/* Summary cards */}
          <div className={styles.summaryGrid} style={{ marginBottom: '2rem' }}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryCardLabel}>Budget Set</span>
              {editingBudget ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <input
                    className={styles.input}
                    type="number"
                    min={0}
                    step="0.01"
                    value={budgetInput}
                    onChange={e => setBudgetInput(e.target.value)}
                    style={{ width: '100%' }}
                    autoFocus
                  />
                  {saveError && <p className={styles.errorText} style={{ fontSize: '0.78rem' }}>{saveError}</p>}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className={styles.btnPrimary} disabled={saving} onClick={saveBudget} style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}>
                      {saving ? '…' : 'Save'}
                    </button>
                    <button className={styles.btnGhost} onClick={() => { setEditingBudget(false); setSaveError(''); }} style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <span className={styles.summaryCardValue}>
                    {summary.budgetAmount != null ? fmt(summary.budgetAmount) : '—'}
                  </span>
                  <button
                    className={styles.btnGhost}
                    onClick={() => setEditingBudget(true)}
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', marginTop: '0.35rem' }}
                  >
                    {summary.budgetAmount != null ? 'Edit' : 'Set budget'}
                  </button>
                </>
              )}
            </div>

            <div className={styles.summaryCard}>
              <span className={styles.summaryCardLabel}>Dues Collected</span>
              <span className={styles.summaryCardValue} style={{ color: '#4ade80' }}>
                {fmt(summary.duesCollected)}
              </span>
            </div>

            <div className={styles.summaryCard}>
              <span className={styles.summaryCardLabel}>Expenses</span>
              <span className={styles.summaryCardValue} style={{ color: summary.totalExpenses > 0 ? '#f87171' : undefined }}>
                {fmt(summary.totalExpenses)}
              </span>
            </div>

            <div className={styles.summaryCard}>
              <span className={styles.summaryCardLabel}>Net Balance</span>
              <span className={styles.summaryCardValue} style={{ color: net >= 0 ? '#4ade80' : '#f87171' }}>
                {net < 0 ? '-' : ''}{fmt(net)}
              </span>
            </div>
          </div>

          {/* Upcoming payables panel */}
          <div style={{ marginBottom: '1.5rem' }}>
            <UpcomingPayablesPanel
              apiUrl={`/api/coaches/${orgSlug}/teams/${teamId}/upcoming-payables`}
            />
          </div>

          {/* Unconfigured-state banner */}
          {summary.budgetAmount === null && summary.duesCollected === 0 && summary.totalExpenses === 0 && (
            <HelpCallout
              variant="info"
              title="Team accounting hasn't been configured yet"
              body="Your org admin will set up dues schedules and cost allocations before this view shows data. Once ready, use the sections below to track player dues, expenses, and org allocations."
            />
          )}

          {/* Quick-link sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Link href={`${base}/accounting/budget`} className={styles.detailSection} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.1rem 1.25rem' }}>
              <BarChart3 size={20} style={{ color: '#4ade80', flexShrink: 0 }} />
              <div>
                <p style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)', margin: 0 }}>Season Budget Plan</p>
                <p className={styles.muted} style={{ margin: 0, fontSize: '0.82rem' }}>Build estimated costs, set player installment schedules</p>
              </div>
            </Link>

            <Link href={`${base}/accounting/budget-vs-actual`} className={styles.detailSection} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.1rem 1.25rem' }}>
              <TrendingUp size={20} style={{ color: '#60a5fa', flexShrink: 0 }} />
              <div>
                <p style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)', margin: 0 }}>Budget vs. Actual</p>
                <p className={styles.muted} style={{ margin: 0, fontSize: '0.82rem' }}>Track headroom, compare spending to plan, view monthly trends</p>
              </div>
            </Link>

            <Link href={`${base}/accounting/fundraisers`} className={styles.detailSection} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.1rem 1.25rem' }}>
              <Gift size={20} style={{ color: '#4ade80', flexShrink: 0 }} />
              <div>
                <p style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)', margin: 0 }}>Fundraisers</p>
                <p className={styles.muted} style={{ margin: 0, fontSize: '0.82rem' }}>Track per-player fundraising, rebates, and automatic dues credits</p>
              </div>
            </Link>

            <Link href={`${base}/accounting/dues`} className={styles.detailSection} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.1rem 1.25rem' }}>
              <Users size={20} style={{ color: '#a855f7', flexShrink: 0 }} />
              <div>
                <p style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)', margin: 0 }}>Player Dues</p>
                <p className={styles.muted} style={{ margin: 0, fontSize: '0.82rem' }}>Set schedules, track payments, mark installments paid</p>
              </div>
            </Link>

            <Link href={`${base}/accounting/expenses`} className={styles.detailSection} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.1rem 1.25rem' }}>
              <Receipt size={20} style={{ color: '#f97316', flexShrink: 0 }} />
              <div>
                <p style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)', margin: 0 }}>Expenses &amp; Tournament Payables</p>
                <p className={styles.muted} style={{ margin: 0, fontSize: '0.82rem' }}>Log expenses, track tournament deposits and balances</p>
              </div>
            </Link>

            <Link href={`${base}/accounting/allocations`} className={styles.detailSection} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.1rem 1.25rem' }}>
              <Building2 size={20} style={{ color: '#3b82f6', flexShrink: 0 }} />
              <div>
                <p style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)', margin: 0 }}>Org Allocations</p>
                <p className={styles.muted} style={{ margin: 0, fontSize: '0.82rem' }}>View costs allocated to this team by your organization</p>
              </div>
            </Link>

            <Link href={`${base}/accounting/payment-requests`} className={styles.detailSection} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.1rem 1.25rem' }}>
              <ArrowLeftRight size={20} style={{ color: '#facc15', flexShrink: 0 }} />
              <div>
                <p style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)', margin: 0 }}>Payment Requests</p>
                <p className={styles.muted} style={{ margin: 0, fontSize: '0.82rem' }}>Submit payments to the org or request reimbursement — admin reviews and approves</p>
              </div>
            </Link>
          </div>

          {/* Automated reminders toggle */}
          {autoReminders !== null && (
            <div className={styles.detailSection} style={{ marginTop: '1.5rem', padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Bell size={20} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)', margin: 0 }}>Automatic Dues Reminders</p>
                <p className={styles.muted} style={{ margin: 0, fontSize: '0.82rem' }}>
                  {autoReminders
                    ? 'On — guardians receive email reminders at 30 days and 7 days before each installment due date.'
                    : 'Off — no automatic reminder emails will be sent for this team.'}
                </p>
              </div>
              <button
                className={autoReminders ? styles.btnPrimary : styles.btnGhost}
                disabled={reminderSaving}
                onClick={() => toggleAutoReminders(!autoReminders)}
                style={{ flexShrink: 0, fontSize: '0.8rem', padding: '0.35rem 0.9rem' }}
              >
                {reminderSaving ? '…' : autoReminders ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
