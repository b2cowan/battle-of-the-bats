'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { DollarSign, AlertTriangle } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import styles from '../rep-teams.module.css';

interface AllocationSummary {
  id: string;
  description: string;
  totalAmount: number;
  teamCount: number;
  totalAllocated: number;
  collected: number;
  outstanding: number;
  overdueCount: number;
  createdAt: string;
}

function fmt(n: number) {
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AllocationsPage() {
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const base = `/${currentOrg?.slug ?? ''}/admin`;
  const canWrite = userRole === 'owner' || userRole === 'treasurer';

  const [allocations, setAllocations] = useState<AllocationSummary[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setFetching(true);
    setError('');
    try {
      const res = await fetch('/api/admin/rep-teams/allocations');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setAllocations(data.allocations ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load allocations.');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { if (currentOrg) load(); }, [currentOrg, load]);

  if (loading) return <p className={styles.muted}>Loading…</p>;

  if (!userRole || !hasCapability(userRole, userCapabilities, 'module_rep_teams')) {
    return (
      <div className={styles.accessDenied}>
        <DollarSign size={32} />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have access to the Rep Teams module.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href={`${base}/rep-teams`}>Rep Teams</Link>
        <span>/</span>
        <span>Cost Allocations</span>
      </div>

      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><DollarSign size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Cost Allocations</h1>
            <p className={styles.pageSub}>{currentOrg?.name} — shared expenses split across teams</p>
          </div>
        </div>
        {canWrite && (
          <Link href={`${base}/rep-teams/allocations/new`} className="btn btn-primary">
            + New Allocation
          </Link>
        )}
      </div>

      {error && <p style={{ color: '#f87171', marginBottom: '1rem' }}>{error}</p>}

      {fetching ? (
        <p className={styles.muted}>Loading…</p>
      ) : allocations.length === 0 ? (
        <div className={styles.emptyState}>
          <DollarSign size={28} style={{ opacity: 0.3, margin: '0 auto 0.75rem', display: 'block' }} />
          <p>No allocations yet.</p>
          {canWrite && (
            <p>
              <Link href={`${base}/rep-teams/allocations/new`} className="btn btn-secondary"
                style={{ marginTop: '0.75rem', display: 'inline-block' }}>
                Create your first allocation
              </Link>
            </p>
          )}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Description</th>
                <th className={styles.th}>Teams</th>
                <th className={styles.th}>Total</th>
                <th className={styles.th}>Collected</th>
                <th className={styles.th}>Outstanding</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {allocations.map(a => (
                <tr key={a.id} className={styles.tr}>
                  <td className={styles.td}>
                    <div style={{ fontWeight: 600 }}>{a.description}</div>
                    {a.overdueCount > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.25rem' }}>
                        <AlertTriangle size={12} style={{ color: '#f87171' }} />
                        <span style={{ fontSize: '0.75rem', color: '#f87171' }}>
                          {a.overdueCount} overdue installment{a.overdueCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className={styles.td} style={{ color: 'rgba(255,255,255,0.55)' }}>{a.teamCount}</td>
                  <td className={styles.td} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(a.totalAmount)}</td>
                  <td className={styles.td} style={{ color: '#4ade80', fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(a.collected)}
                  </td>
                  <td className={styles.td} style={{
                    color: a.outstanding > 0 ? (a.overdueCount > 0 ? '#f87171' : 'rgba(255,255,255,0.75)') : '#4ade80',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {fmt(a.outstanding)}
                  </td>
                  <td className={styles.td}>
                    <Link href={`${base}/rep-teams/allocations/${a.id}`}
                      className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}>
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
