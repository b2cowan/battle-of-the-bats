'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { DollarSign } from 'lucide-react';
import Link from 'next/link';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import styles from '../../../house-league.module.css';
import type { AccountingEntry, AccountingLedger, LedgerSummary } from '@/lib/types';

interface AnnotatedEntry extends AccountingEntry {
  playerFirstName: string | null;
  playerLastName:  string | null;
  divisionId:      string | null;
  registrationId:  string | null;
}

interface LedgerData {
  ledger:        AccountingLedger;
  summary:       LedgerSummary;
  entries:       AnnotatedEntry[];
  expectedTotal: number;
  feePerReg:     number;
  activeCount:   number;
}

interface SeasonInfo { id: string; name: string; }

function fmt(n: number): string {
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function LedgerPage() {
  const { orgSlug, seasonId } = useParams<{ orgSlug: string; seasonId: string }>();
  const { user, userRole, userCapabilities } = useOrg();

  const canView = hasCapability(userRole ?? 'staff', userCapabilities ?? null, 'module_house_league');

  const [season,  setSeason]  = useState<SeasonInfo | null>(null);
  const [data,    setData]    = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const [seasonRes, ledgerRes] = await Promise.all([
        fetch(`/api/admin/house-league/seasons/${seasonId}`),
        fetch(`/api/admin/house-league/seasons/${seasonId}/ledger`),
      ]);
      const [sd, ld] = await Promise.all([seasonRes.json(), ledgerRes.json()]);
      if (sd.season) setSeason({ id: sd.season.id, name: sd.season.name });
      if (!ledgerRes.ok) throw new Error(ld.error ?? 'Failed to load ledger');
      setData(ld);
    } finally {
      setLoading(false);
    }
  }, [seasonId, canView]);

  useEffect(() => { load(); }, [load]);

  if (!user) return null;
  if (!canView) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--white-40)', fontSize: '0.9rem' }}>You don&apos;t have access to this page.</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--white-40)', fontSize: '0.9rem' }}>Loading…</p>
      </div>
    );
  }

  const collected   = data?.summary.postedIncome   ?? 0;
  const outstanding = data?.summary.pendingIncome  ?? 0;
  const expected    = data?.expectedTotal          ?? 0;
  const entries     = data?.entries                ?? [];

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}>
            <DollarSign size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--white-40)', marginBottom: '0.2rem' }}>
              <Link href={`/${orgSlug}/admin/house-league`} style={{ color: 'inherit', textDecoration: 'none' }}>
                House League
              </Link>
              {season && (
                <>
                  {' / '}
                  <Link
                    href={`/${orgSlug}/admin/house-league/seasons/${seasonId}`}
                    style={{ color: 'inherit', textDecoration: 'none' }}
                  >
                    {season.name}
                  </Link>
                </>
              )}
            </div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#f0f0f0' }}>Ledger</h1>
          </div>
        </div>
      </div>

      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '2rem' }}>
        <SummaryTile label="Expected" value={fmt(expected)} sub={`${data?.activeCount ?? 0} active × ${fmt(data?.feePerReg ?? 0)}`} color="#60a5fa" />
        <SummaryTile label="Collected" value={fmt(collected)} sub="Posted entries" color="#4ade80" />
        <SummaryTile label="Outstanding" value={fmt(outstanding)} sub="Pending entries" color="#fbbf24" />
      </div>

      {/* No fee configured */}
      {(data?.feePerReg ?? 0) === 0 && (
        <div style={{
          padding: '1rem 1.25rem',
          borderRadius: '2px',
          background: 'var(--white-03)',
          border: '1px solid var(--white-8)',
          fontSize: '0.875rem',
          color: 'var(--white-40)',
          marginBottom: '1.5rem',
        }}>
          No registration fee is configured for this season. Set a fee amount in the season settings to track payments here.
        </div>
      )}

      {/* Entries table */}
      {entries.length === 0 ? (
        <div style={{
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          border: '1px dashed var(--white-10)',
          borderRadius: '2px',
          color: 'var(--white-35)',
          fontSize: '0.9rem',
        }}>
          No fee entries yet. Entries are created automatically when registrations are approved (if auto-generate fees is enabled).
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.scheduleTable}>
            <thead>
              <tr>
                <th>Player</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => {
                const isPaid = e.status === 'posted';
                const isVoid = e.status === 'void';
                const playerName = e.playerFirstName
                  ? `${e.playerFirstName} ${e.playerLastName}`
                  : e.description;
                return (
                  <tr
                    key={e.id}
                    style={{ opacity: isVoid ? 0.4 : 1 }}
                  >
                    <td style={{ fontWeight: 600, color: '#f0f0f0' }}>
                      {e.registrationId ? (
                        <Link
                          href={`/${orgSlug}/admin/house-league/seasons/${seasonId}/registrations`}
                          style={{ color: '#f0f0f0', textDecoration: 'none' }}
                        >
                          {playerName}
                        </Link>
                      ) : playerName}
                    </td>
                    <td className={styles.scoreCell} style={{ textAlign: 'right' }}>
                      {fmt(e.amount)}
                    </td>
                    <td>
                      <span
                        className={styles.statusBadge}
                        style={
                          isPaid
                            ? { background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }
                            : isVoid
                              ? { background: 'var(--white-5)', color: 'var(--white-30)' }
                              : { background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }
                        }
                      >
                        {isPaid ? 'Paid' : isVoid ? 'Void' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--white-50)', whiteSpace: 'nowrap' }}>
                      {fmtDate(e.updatedAt)}
                    </td>
                    <td style={{ color: 'var(--white-40)', fontSize: '0.8rem' }}>
                      {e.description}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ marginTop: '1rem', fontSize: '0.72rem', color: 'var(--white-30)' }}>
        Fee status is managed from the{' '}
        <Link
          href={`/${orgSlug}/admin/house-league/seasons/${seasonId}/registrations`}
          style={{ color: 'var(--white-50)', textDecoration: 'underline' }}
        >
          Registrations
        </Link>
        {' '}page.
      </p>
    </div>
  );
}

function SummaryTile({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{
      padding: '1rem 1.25rem',
      borderRadius: '2px',
      background: 'var(--white-03)',
      border: '1px solid var(--white-8)',
    }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--white-35)', marginBottom: '0.4rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, marginBottom: '0.25rem' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--white-30)' }}>
        {sub}
      </div>
    </div>
  );
}
