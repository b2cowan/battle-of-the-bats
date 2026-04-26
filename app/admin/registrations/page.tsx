'use client';
import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Check, X, CreditCard, RefreshCw, Mail, ChevronDown, ChevronUp, AlertCircle, Download } from 'lucide-react';
import { saveTeam, deleteTeam, getTeams, getAgeGroups } from '@/lib/db';
import { downloadCSV } from '@/lib/utils';
import { useTournament } from '@/lib/tournament-context';
import { AgeGroup } from '@/lib/types';
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
  admin_notes?: string;
}

type Status = 'pending' | 'accepted' | 'rejected' | 'waitlist';

export default function AdminRegistrationsPage() {
  const { currentTournament } = useTournament();
  const [regs, setRegs]       = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatuses, setSelectedStatuses] = useState<Status[]>(['pending', 'accepted', 'waitlist']);
  const [search, setSearch]   = useState('');
  const [selectedRegIds, setSelectedRegIds] = useState<Set<string>>(new Set());
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [selectedAgeGroupId, setSelectedAgeGroupId] = useState<string>('all');
  const [working, setWorking] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [showSummary, setShowSummary] = useState(true);

  const loadAgeGroups = useCallback(async () => {
    if (currentTournament) {
      const groups = await getAgeGroups(currentTournament.id);
      setAgeGroups(groups);
    }
  }, [currentTournament]);

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

  useEffect(() => { load(); loadAgeGroups(); }, [load, loadAgeGroups]);

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
        const teams = await getTeams(currentTournament.id);
        const existing = teams.find(t => t.id === reg.id);
        if (!existing) {
          await saveTeam({
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
        await deleteTeam(reg.id);
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

  function toggleSelect(id: string) {
    setSelectedRegIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleStatus(status: Status) {
    setSelectedStatuses(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  }

  async function handleBulkAction(action: 'accepted' | 'paid' | 'rejected') {
    if (selectedRegIds.size === 0) return;
    setBulkWorking(true);
    const ids = Array.from(selectedRegIds);
    
    try {
      for (const id of ids) {
        const reg = regs.find(r => r.id === id);
        if (!reg) continue;
        
        const updates: any = {};
        if (action === 'accepted' || action === 'rejected') updates.status = action;
        if (action === 'paid') updates.payment_status = 'paid';
        
        await patch(id, updates, reg);
      }
      setSelectedRegIds(new Set());
    } finally {
      setBulkWorking(false);
    }
  }

  const filtered = regs.filter(r => {
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(r.status);
    const matchesDivision = selectedAgeGroupId === 'all' || r.age_group_id === selectedAgeGroupId;
    const matchesSearch = search === '' || 
      r.team_name.toLowerCase().includes(search.toLowerCase()) || 
      r.coach_name.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesDivision && matchesSearch;
  });

  const statusOrder: Record<Status, number> = {
    accepted: 1,
    pending: 2,
    waitlist: 3,
    rejected: 4
  };

  const sorted = [...filtered].sort((a, b) => {
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime();
  });

  // Group by age group
  const grouped = sorted.reduce((acc, r) => {
    if (!acc[r.age_group_name]) acc[r.age_group_name] = [];
    acc[r.age_group_name].push(r);
    return acc;
  }, {} as Record<string, Registration[]>);

  function exportToCSV() {
    const headers = ['Team Name', 'Coach', 'Email', 'Division', 'Tournament', 'Status', 'Payment', 'Registered At'];
    const rows = regs.map(r => [
      r.team_name,
      r.coach_name,
      r.email,
      r.age_group_name,
      r.tournament_name,
      r.status.toUpperCase(),
      r.payment_status.toUpperCase(),
      r.registered_at
    ]);
    downloadCSV(`registrations-${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  }

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
        <div className="flex gap-1">
          <button className="btn btn-outline btn-sm" onClick={exportToCSV} id="reg-export-btn" disabled={regs.length === 0}>
            <Download size={14} /> Export CSV
          </button>
          <button className="btn btn-ghost btn-sm" onClick={load} id="reg-refresh-btn">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className={styles.controlsRow}>
        <div className={styles.controlsLeft}>
          <div className={styles.statusFilters}>
            {(['pending', 'accepted', 'waitlist', 'rejected'] as Status[]).map(s => {
              const count = regs.filter(r => r.status === s).length;
              const isActive = selectedStatuses.includes(s);
              return (
                <button 
                  key={s}
                  className={`${styles.filterChip} ${isActive ? styles.chipActive : ''}`}
                  onClick={() => toggleStatus(s)}
                >
                  {s.toUpperCase()} ({count})
                </button>
              );
            })}
          </div>
          <button 
            className="btn btn-ghost btn-sm" 
            onClick={() => setShowSummary(!showSummary)}
            style={{ color: 'var(--white-40)' }}
          >
            {showSummary ? 'Hide Stats' : 'Show Stats'}
          </button>
        </div>

        <div className={styles.controlsRight}>
          <div className={styles.searchBar}>
            <input 
              type="text" 
              placeholder="Search..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="form-input"
            />
          </div>

          <div className={styles.filterGroup}>
            <select 
              id="age-group-filter"
              className="form-input" 
              value={selectedAgeGroupId} 
              onChange={e => setSelectedAgeGroupId(e.target.value)}
              style={{ minWidth: '150px' }}
            >
              <option value="all">All Divs</option>
              {ageGroups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {showSummary && (
        <div className={styles.summaryGrid}>
          {ageGroups.map(g => {
            const groupRegs = regs.filter(r => r.age_group_id === g.id);
            const accepted = groupRegs.filter(r => r.status === 'accepted').length;
            const pending = groupRegs.filter(r => r.status === 'pending').length;
            const capacity = g.capacity || 0;
            const isFull = capacity > 0 && accepted >= capacity;

            return (
              <div 
                key={g.id} 
                className={`${styles.summaryCard} ${selectedAgeGroupId === g.id ? styles.selectedSummary : ''}`}
                onClick={() => setSelectedAgeGroupId(g.id)}
              >
                <div className={styles.summaryHeader}>
                  <strong>{g.name}</strong>
                  {capacity > 0 && (
                    <span className={isFull ? styles.fullBadge : styles.capacityBadge}>
                      {accepted}/{capacity}
                    </span>
                  )}
                </div>
                <div className={styles.summaryStats}>
                  <span>{pending} P • {groupRegs.filter(r => r.status === 'waitlist').length} W</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedRegIds.size > 0 && (
        <div className={styles.bulkActions}>
          <span>{selectedRegIds.size} selected</span>
          <div className="flex gap-1">
            <button className="btn btn-primary btn-sm" onClick={() => handleBulkAction('accepted')} disabled={bulkWorking}>Accept</button>
            <button className="btn btn-outline btn-sm" onClick={() => handleBulkAction('paid')} disabled={bulkWorking}>Mark Paid</button>
            <button className="btn btn-danger btn-sm" onClick={() => handleBulkAction('rejected')} disabled={bulkWorking}>Reject</button>
          </div>
        </div>
      )}

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
        <div className={styles.compactList}>
          {Object.entries(grouped).map(([ageGroup, groupRegs]) => (
            <div key={ageGroup} className={styles.groupSection}>
              <div className={styles.groupHeader}>
                <strong>{ageGroup}</strong>
                <span className="badge badge-purple">{groupRegs.length} Teams</span>
              </div>
              
              <div className={styles.tableHeader}>
                <div style={{ width: '40px' }} />
                <div style={{ flex: 2 }}>Team</div>
                <div style={{ flex: 1.5 }}>Coach</div>
                <div style={{ width: '100px' }}>Status</div>
                <div style={{ width: '100px' }}>Payment</div>
                <div style={{ width: '80px' }} />
              </div>

              {groupRegs.map(r => {
                const isExpanded = expanded.has(r.id);
                const isSelected = selectedRegIds.has(r.id);
                const busy = working === r.id;
                return (
                  <div key={r.id} className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}>
                    <div className={styles.rowMain}>
                      <div style={{ width: '40px', display: 'flex', justifyContent: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => toggleSelect(r.id)}
                          className={styles.rowCheck}
                        />
                      </div>
                      
                      <div style={{ flex: 2 }} className={styles.primaryCell}>
                        <strong className={styles.teamName}>{r.team_name}</strong>
                      </div>

                      <div style={{ flex: 1.5 }} className={styles.secondaryCell}>
                        {r.coach_name}
                      </div>

                      <div style={{ width: '100px' }}>
                        {r.status === 'pending'  && <span className="badge badge-warning">Pending</span>}
                        {r.status === 'waitlist' && <span className="badge" style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', fontSize: '0.7rem' }}>Waitlist</span>}
                        {r.status === 'accepted' && <span className="badge badge-success">Accepted</span>}
                        {r.status === 'rejected' && <span className="badge badge-danger">Rejected</span>}
                      </div>

                      <div style={{ width: '100px' }}>
                        {r.status === 'accepted' ? (
                          r.payment_status === 'paid' 
                            ? <span className="badge badge-success">Paid</span>
                            : <span className="badge badge-warning">Unpaid</span>
                        ) : '-'}
                      </div>

                      <div style={{ width: '80px', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button className={styles.iconBtn} onClick={() => toggle(r.id)}>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className={styles.expandedRow}>
                        <div className={styles.expandedContent}>
                          <div className={styles.expandedInfo}>
                            <div className={styles.infoLine}>
                              <span>Email: <a href={`mailto:${r.email}`}>{r.email}</a></span>
                              <span style={{ marginLeft: '1rem' }}>Registered: {formatDate(r.registered_at)}</span>
                            </div>
                            
                            <div className={styles.notesArea}>
                              <label>Admin Notes</label>
                              <textarea 
                                placeholder="Add private notes here..."
                                defaultValue={r.admin_notes || ''}
                                onBlur={(e) => {
                                  if (e.target.value !== (r.admin_notes || '')) {
                                    patch(r.id, { admin_notes: e.target.value });
                                  }
                                }}
                              />
                            </div>
                          </div>

                          <div className={styles.expandedActions}>
                            <div className={styles.transferGroup}>
                              <label>Move to Division</label>
                              <select 
                                value={r.age_group_id} 
                                onChange={(e) => patch(r.id, { 
                                  age_group_id: e.target.value,
                                  age_group_name: ageGroups.find(g => g.id === e.target.value)?.name || ''
                                })}
                              >
                                {ageGroups.map(g => (
                                  <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                              </select>
                            </div>

                            <div className={styles.buttonGroup}>
                              {r.status === 'pending' && (
                                <>
                                  <button className="btn btn-primary btn-xs" onClick={() => patch(r.id, { status: 'accepted' }, r)} disabled={busy}>Accept</button>
                                  <button className="btn btn-warning btn-xs" onClick={() => patch(r.id, { status: 'waitlist' }, r)} disabled={busy}>Waitlist</button>
                                  <button className="btn btn-danger btn-xs" onClick={() => patch(r.id, { status: 'rejected' }, r)} disabled={busy}>Reject</button>
                                </>
                              )}
                              {r.status === 'accepted' && (
                                <>
                                  <button className="btn btn-outline btn-xs" onClick={() => patch(r.id, { payment_status: r.payment_status === 'paid' ? 'pending' : 'paid' })} disabled={busy}>
                                    {r.payment_status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                                  </button>
                                  <a href={`/teams/${r.id}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-xs">Profile ↗</a>
                                </>
                              )}
                              {(r.status === 'waitlist' || r.status === 'rejected') && (
                                <button className="btn btn-ghost btn-xs" onClick={() => patch(r.id, { status: 'pending' })} disabled={busy}>Restore</button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
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
