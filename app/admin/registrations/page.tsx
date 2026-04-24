'use client';
import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Check, X, CreditCard, RefreshCw, Mail, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { saveTeam, deleteTeam, getTeams } from '@/lib/storage';
import { useTournament } from '@/lib/tournament-context';
import styles from './registrations-admin.module.css';

interface Registration {
  id: string;
  team_name: string;
  coach_name: string;
  email: string;
  age_group_id: string;
  age_group_name: string;
  tournament_name: string;
  status: 'pending' | 'accepted' | 'rejected' | 'waitlist';
  payment_status: 'pending' | 'paid';
  registered_at: string;
}

type Tab = 'pending' | 'accepted' | 'waitlist' | 'all';

export default function AdminRegistrationsPage() {
  const { currentTournament } = useTournament();
  const [regs, setRegs]       = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<Tab>('pending');
  const [working, setWorking] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/registrations');
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(JSON.stringify(data, null, 2));
        setRegs([]);
      } else {
        setRegs(Array.isArray(data) ? data : []);
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function patch(id: string, updates: Record<string, string>, reg?: Registration) {
    setWorking(id);
    try {
      const res = await fetch(`/api/registrations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update registration');
      }

      if (updates.status === 'accepted' && reg && currentTournament) {
        const existing = getTeams().find(t => t.id === reg.id);
        if (!existing) {
          saveTeam({
            id: reg.id,
            name: reg.team_name,
            coach: reg.coach_name,
            email: reg.email,
            ageGroupId: reg.age_group_id,
            tournamentId: currentTournament.id,
            players: [],
          });
        }
      } else if (updates.status === 'rejected' && reg) {
        deleteTeam(reg.id);
      }
    } catch (e: any) {
      setErrorMsg(`Update failed: ${e.message}`);
    } finally {
      await load();
      setWorking(null);
    }
  }

  function toggle(id: string) {
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  const filtered = regs.filter(r => {
    if (tab === 'pending')  return r.status === 'pending';
  const pendingCount  = regs.filter(r => r.status === 'pending').length;
  const acceptedCount = regs.filter(r => r.status === 'accepted').length;
  const waitlistCount = regs.filter(r => r.status === 'waitlist').length;

  const filtered = regs.filter(r => tab === 'all' || r.status === tab);

  // Group by age group
  const grouped = filtered.reduce((acc, r) => {
    if (!acc[r.age_group_name]) acc[r.age_group_name] = [];
    acc[r.age_group_name].push(r);
    return acc;
  }, {} as Record<string, Registration[]>);

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><ClipboardList size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Registrations</h1>
            <p className={styles.pageSub}>Review and manage team registration requests</p>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load} id="reg-refresh-btn">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={`tab-btn ${tab === 'pending'  ? 'active' : ''}`} onClick={() => setTab('pending')}>
          Pending {pendingCount > 0 && <span className={styles.tabBadge}>{pendingCount}</span>}
        </button>
        <button className={`tab-btn ${tab === 'waitlist' ? 'active' : ''}`} onClick={() => setTab('waitlist')}>
          Waitlist {waitlistCount > 0 && <span className={styles.tabBadge}>{waitlistCount}</span>}
        </button>
        <button className={`tab-btn ${tab === 'accepted' ? 'active' : ''}`} onClick={() => setTab('accepted')}>
          Accepted {acceptedCount > 0 && <span className={styles.tabBadge}>{acceptedCount}</span>}
        </button>
        <button className={`tab-btn ${tab === 'all'      ? 'active' : ''}`} onClick={() => setTab('all')}>
          All ({regs.length})
        </button>
      </div>

      {errorMsg ? (
        <div className="empty-state" style={{ color: 'var(--danger)', textAlign: 'left' }}>
          <AlertCircle size={40} style={{ margin: '0 auto 1rem', opacity: 0.8 }} />
          <p style={{ textAlign: 'center', marginBottom: '1rem' }}>Backend Error (500)</p>
          <pre style={{ background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: 8, fontSize: '0.8rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {errorMsg}
          </pre>
        </div>
      ) : loading ? (
        <div className="empty-state"><RefreshCw size={32} style={{ opacity: 0.4 }} /><p>Loading…</p></div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="empty-state">
          <ClipboardList size={40} />
          <p>No registrations found.</p>
        </div>
      ) : (
        <div className={styles.cards}>
          {Object.entries(grouped).map(([ageGroup, groupRegs]) => (
            <div key={ageGroup} style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--white)', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                {ageGroup} <span className="badge badge-purple" style={{ marginLeft: '0.5rem' }}>{groupRegs.length} Teams</span>
              </h3>
              
              {groupRegs.map(r => {
                const isExpanded = expanded.has(r.id);
                const busy = working === r.id;
                return (
                  <div key={r.id} className={`card ${styles.regCard}`}>
                    {/* Header row */}
                    <div className={styles.cardHeader}>
                      <div className={styles.cardLeft}>
                        <div className={styles.teamNameRow}>
                          <strong className={styles.teamName}>{r.team_name}</strong>
                          {r.status === 'pending'  && <span className="badge badge-warning">Pending</span>}
                          {r.status === 'waitlist' && <span className="badge badge-danger" style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>Waitlist</span>}
                          {r.status === 'accepted' && <span className="badge badge-success">Accepted</span>}
                          {r.status === 'rejected' && <span className="badge badge-danger">Rejected</span>}
                        </div>
                        <div className={styles.cardMeta}>
                          <span className={styles.metaItem}>{r.tournament_name}</span>
                          <span className={styles.metaItem}>{formatDate(r.registered_at)}</span>
                        </div>
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggle(r.id)} aria-label="Toggle details">
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className={styles.details}>
                        <div className={styles.detailGrid}>
                          <div className={styles.detailItem}><span>Coach</span><strong>{r.coach_name}</strong></div>
                          <div className={styles.detailItem}><span>Email</span>
                            <a href={`mailto:${r.email}`} className={styles.emailLink}>
                              <Mail size={12} />{r.email}
                            </a>
                          </div>
                          {r.status === 'accepted' && (
                            <div className={styles.detailItem}><span>Payment</span>
                              {r.payment_status === 'paid'
                                ? <span className="badge badge-success">Paid ✓</span>
                                : <span className="badge badge-warning">Pending</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className={styles.actions}>
                      {r.status === 'pending' && (
                        <>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => patch(r.id, { status: 'accepted' }, r)}
                            disabled={busy || !currentTournament}
                            title={!currentTournament ? "No active tournament set" : ""}
                            id={`accept-${r.id}`}
                          >
                            <Check size={13} /> {busy ? 'Processing…' : 'Accept & Email'}
                          </button>
                          <button
                            className="btn btn-warning btn-sm"
                            onClick={() => patch(r.id, { status: 'waitlist' }, r)}
                            disabled={busy}
                          >
                            Waitlist
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => patch(r.id, { status: 'rejected' }, r)}
                            disabled={busy}
                            id={`reject-${r.id}`}
                          >
                            <X size={13} /> Reject
                          </button>
                        </>
                      )}
                      {r.status === 'waitlist' && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => patch(r.id, { status: 'pending' }, r)}
                          disabled={busy}
                        >
                          Restore to Pending
                        </button>
                      )}
                      {r.status === 'accepted' && r.payment_status === 'pending' && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => patch(r.id, { payment_status: 'paid' })}
                          disabled={busy}
                          id={`paid-${r.id}`}
                        >
                          <CreditCard size={13} /> {busy ? 'Processing…' : 'Mark as Paid'}
                        </button>
                      )}
                      {r.status === 'accepted' && r.payment_status === 'paid' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => patch(r.id, { payment_status: 'pending' })}
                          disabled={busy}
                          id={`unpaid-${r.id}`}
                        >
                          Undo Payment
                        </button>
                      )}
                      {r.status === 'rejected' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => patch(r.id, { status: 'pending' })}
                          disabled={busy}
                        >
                          Restore to Pending
                        </button>
                      )}
                      {r.status === 'accepted' && (
                        <a
                          href={`/teams/${r.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-ghost btn-sm"
                        >
                          View Profile ↗
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
