'use client';
import { useState, useEffect, useCallback } from 'react';
import { Users, Check, X, CreditCard, RefreshCw, Mail, ChevronDown, ChevronUp, AlertCircle, Download, Plus, Trash2, MapPin } from 'lucide-react';
import { saveTeam, updateTeam, deleteTeam, getTeams, getAgeGroups, saveRegistration, savePool } from '@/lib/db';
import { downloadCSV } from '@/lib/utils';
import { useTournament } from '@/lib/tournament-context';
import { AgeGroup, Team } from '@/lib/types';
import styles from './teams-admin.module.css';

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
  pool?: string;
  poolId?: string;
}

type Status = 'pending' | 'accepted' | 'rejected' | 'waitlist';

export default function UnifiedTeamsPage() {
  const { currentTournament } = useTournament();
  const [regs, setRegs]       = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatuses, setSelectedStatuses] = useState<Status[]>(['pending', 'accepted', 'waitlist']);
  const [search, setSearch]   = useState('');
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [selectedAgeGroupId, setSelectedAgeGroupId] = useState<string>('all');
  const [working, setWorking] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', coach: '', email: '', ageGroupId: '', pool: '' });
  const [stableSortedIds, setStableSortedIds] = useState<string[]>([]);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);

  const load = useCallback(async () => {
    if (!currentTournament) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Fetch all data in parallel
      const [rRes, tRes, groups] = await Promise.all([
        fetch('/api/registrations'),
        getTeams(currentTournament.id),
        getAgeGroups(currentTournament.id)
      ]);
      
      const rData = await rRes.json();
      if (!rRes.ok) throw new Error(rData.error || 'Failed to load registrations');

      setAgeGroups(groups);
      if (groups.length && !addForm.ageGroupId) {
        setAddForm(f => ({ ...f, ageGroupId: groups[0].id }));
      }

      // 2. Merge registrations with team data (pools)
      const teamMap = new Map(tRes.map(t => [t.id, t]));
      const merged = (Array.isArray(rData) ? rData : []).map((r: Registration) => ({
        ...r,
        pool: teamMap.get(r.id)?.pool,
        poolId: teamMap.get(r.id)?.poolId
      }));

      setRegs(merged);

      // 3. Initialize stable order if not set
      if (stableSortedIds.length === 0) {
        const initialSorted = [...merged].sort((a: any, b: any) => {
          const statusOrder: any = { accepted: 1, waitlist: 2, pending: 3, rejected: 4 };
          if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
          if (a.payment_status !== b.payment_status) return a.payment_status === 'paid' ? -1 : 1;
          
          if (a.status === 'accepted') {
            if (!a.poolId && b.poolId) return -1;
            if (a.poolId && !b.poolId) return 1;
            if (a.poolId && b.poolId) {
              const ap = groups.find(g => g.id === a.age_group_id)?.pools?.find(p => p.id === a.poolId);
              const bp = groups.find(g => g.id === b.age_group_id)?.pools?.find(p => p.id === b.poolId);
              return (ap?.name || '').localeCompare(bp?.name || '');
            }
          }
          return new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime();
        });
        setStableSortedIds(initialSorted.map((x: any) => x.id));
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
      setHasLoadedInitial(true);
    }
  }, [currentTournament?.id, stableSortedIds.length, addForm.ageGroupId]);

  useEffect(() => { load(); }, [load]);

  async function patch(id: string, updates: any, reg?: Registration) {
    setWorking(id);
    try {
      const res = await fetch(`/api/admin/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'update',
          ids: [id],
          updates
        }),
      });
      if (!res.ok) throw new Error('Update failed');
      
      // Update local state immediately
      setRegs(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setWorking(null);
    }
  }



  async function handleAddTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!currentTournament) return;
    setWorking('new');
    try {
      const id = crypto.randomUUID();
      // 1. Save Registration (Auto-accepted)
      await saveRegistration({
        id,
        tournament_id: currentTournament.id,
        team_name: addForm.name,
        coach_name: addForm.coach,
        email: addForm.email,
        age_group_id: addForm.ageGroupId,
        status: 'accepted',
        payment_status: 'paid',
        registered_at: new Date().toISOString()
      } as any);

      // 2. Save Team
      await saveTeam({
        id,
        name: addForm.name,
        coach: addForm.coach,
        email: addForm.email,
        ageGroupId: addForm.ageGroupId,
        tournamentId: currentTournament.id,
        pool: addForm.pool || undefined,
        players: []
      });

      setShowAddModal(false);
      setAddForm({ name: '', coach: '', email: '', ageGroupId: ageGroups[0]?.id || '', pool: '' });
      load();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setWorking(null);
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

  // Use the stable order for rendering
  const sorted = stableSortedIds
    .map(id => filtered.find(r => r.id === id))
    .filter(Boolean) as Registration[];

  // Add any new teams (that weren't in the stable order yet)
  const newTeams = filtered.filter(r => !stableSortedIds.includes(r.id));
  const finalDisplay = [...sorted, ...newTeams];

  const grouped = finalDisplay.reduce((acc, r) => {
    if (!acc[r.age_group_name]) acc[r.age_group_name] = [];
    acc[r.age_group_name].push(r);
    return acc;
  }, {} as Record<string, Registration[]>);

  function exportCSV() {
    const headers = ['Team', 'Coach', 'Email', 'Division', 'Pool', 'Status', 'Payment'];
    const rows = filtered.map(r => [r.team_name, r.coach_name, r.email, r.age_group_name, r.pool || '-', r.status, r.payment_status]);
    downloadCSV(`teams-regs-${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><Users size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Teams & Registrations</h1>
            <p className={styles.pageSub}>Manage all teams and signups in one place</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button className="btn btn-outline btn-sm" onClick={exportCSV} disabled={regs.length === 0}><Download size={14} /> Export</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)} disabled={!currentTournament}><Plus size={16} /> Add Team</button>
        </div>
      </div>



      {/* Controls */}
      <div className={styles.controlsRow}>
        <div className={styles.controlsLeft}>
          <div className={styles.statusFilters}>
            {(['pending', 'accepted', 'waitlist', 'rejected'] as Status[]).map(s => (
              <button key={s} className={`${styles.filterChip} ${selectedStatuses.includes(s) ? styles.chipActive : ''}`} onClick={() => setSelectedStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}>
                {s.toUpperCase()} ({regs.filter(r => r.status === s).length})
              </button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSummary(!showSummary)} style={{ color: 'var(--white-40)' }}>{showSummary ? 'Hide Stats' : 'Show Stats'}</button>
        </div>
        <div className={styles.controlsRight}>
          <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="form-input" />
          <select className="form-input" value={selectedAgeGroupId} onChange={e => setSelectedAgeGroupId(e.target.value)} style={{ minWidth: 140 }}>
            <option value="all">All Divisions</option>
            {ageGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </div>

      {/* Summary */}
      {showSummary && (
        <div className={styles.summaryGrid}>
          {ageGroups.map(g => {
            const groupRegs = regs.filter(r => r.age_group_id === g.id);
            const accepted = groupRegs.filter(r => r.status === 'accepted').length;
            const capacity = g.capacity || 0;
            return (
              <div key={g.id} className={`${styles.summaryCard} ${selectedAgeGroupId === g.id ? styles.selectedSummary : ''}`} onClick={() => setSelectedAgeGroupId(g.id)}>
                <div className={styles.summaryHeader}>
                  <strong>{g.name}</strong>
                  {capacity > 0 && <span className={accepted >= capacity ? styles.fullBadge : styles.capacityBadge}>{accepted}/{capacity}</span>}
                </div>
                <div className={styles.summaryStats}>
                  <div style={{ marginBottom: '0.25rem' }}>{groupRegs.filter(r => r.status === 'pending').length} Pending • {groupRegs.filter(r => r.status === 'waitlist').length} Waitlist</div>
                  <div className={styles.poolBreakdown}>
                    {(() => {
                      if (!g.poolCount || g.poolCount <= 1) return null;
                      const poolsList = g.pools || [];
                      const unassigned = groupRegs.filter(r => r.status === 'accepted' && !r.poolId).length;
                      
                      return (
                        <>
                          {poolsList.map((p) => {
                            const count = groupRegs.filter(r => r.poolId === p.id).length;
                            return (
                              <span key={p.id} className={styles.poolStatBadge}>
                                {p.name}: <strong>{count}</strong>
                              </span>
                            );
                          })}
                          {unassigned > 0 && (
                            <span className={styles.poolStatBadge} style={{ color: 'var(--danger-light)', background: 'var(--danger-faint)' }}>
                              Unassigned: <strong>{unassigned}</strong>
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List */}
      {!hasLoadedInitial ? (
        <div className="empty-state"><RefreshCw size={32} className="spin" style={{ opacity: 0.4 }} /><p>Loading data…</p></div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="empty-state"><Users size={40} style={{ opacity: 0.2 }} /><p>No teams matching filters.</p></div>
      ) : (
        <div className={styles.compactList}>
          {Object.entries(grouped).map(([ageGroup, groupRegs]) => (
            <div key={ageGroup} className={styles.groupSection}>
              <div className={styles.groupHeader}><strong>{ageGroup}</strong> <span className="badge badge-purple">{groupRegs.length} Teams</span></div>
              <div className={styles.tableHeader}>
                <div style={{ width: 12 }} />
                <div style={{ flex: 2 }}>Team Name</div>
                <div style={{ flex: 1.5 }}>Coach</div>
                {(() => {
                  const g = ageGroups.find(x => x.name === ageGroup);
                  return (g?.poolCount || 0) > 1 && <div style={{ flex: 1 }}>Pool</div>;
                })()}
                <div style={{ width: 100 }}>Status</div>
                <div style={{ width: 100 }}>Payment</div>
                <div style={{ width: 80 }} />
              </div>
              {groupRegs.map(r => {
                const isExpanded = expanded.has(r.id);
                const busy = working === r.id;
                return (
                  <div key={r.id} className={styles.row}>
                    <div className={styles.rowMain}>
                      <div style={{ width: 12 }} />
                      <div style={{ flex: 2 }} className={styles.primaryCell}><strong>{r.team_name}</strong></div>
                      <div style={{ flex: 1.5 }} className={styles.secondaryCell}>{r.coach_name}</div>
                      
                      {(() => {
                        const g = ageGroups.find(x => x.id === r.age_group_id);
                        if (!g || (g.poolCount || 0) <= 1) return null;
                        const poolRecord = g.pools?.find(p => p.id === r.poolId);
                        const displayPoolName = poolRecord ? poolRecord.name : r.pool; // Fallback to legacy string

                        return (
                          <div style={{ flex: 1 }}>
                            {r.status === 'accepted' ? (
                              displayPoolName ? (
                                <span className="badge badge-purple" style={{ opacity: 0.8 }}>Pool {displayPoolName}</span>
                              ) : (
                                <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>Needs Pool</span>
                              )
                            ) : '-'}
                          </div>
                        );
                      })()}

                      <div style={{ width: 100 }}>
                        <span className={`badge badge-${r.status === 'accepted' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'}`}>{r.status}</span>
                      </div>
                      <div style={{ width: 100 }}>{r.status === 'accepted' ? <span className={`badge badge-${r.payment_status === 'paid' ? 'success' : 'warning'}`}>{r.payment_status}</span> : '-'}</div>
                      <div style={{ width: 80, textAlign: 'right' }}><button className={styles.iconBtn} onClick={() => setExpanded(prev => { const s = new Set(prev); s.has(r.id) ? s.delete(r.id) : s.add(r.id); return s; })}>{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button></div>
                    </div>
                    {isExpanded && (
                      <div className={styles.expandedRow}>
                        <div className={styles.expandedContent}>
                          <div className={styles.expandedInfo}>
                            <div className={styles.infoLine}><span>Email: <a href={`mailto:${r.email}`}>{r.email}</a></span><span style={{ marginLeft: '1rem' }}>Reg: {new Date(r.registered_at).toLocaleDateString()}</span></div>
                            <div className={styles.notesArea}><label>Admin Notes</label><textarea placeholder="Private notes..." defaultValue={r.admin_notes} onBlur={e => e.target.value !== r.admin_notes && patch(r.id, { admin_notes: e.target.value })} /></div>
                          </div>
                          <div className={styles.expandedActions}>
                            {(() => {
                              const g = ageGroups.find(x => x.id === r.age_group_id);
                              if (!g || (g.poolCount || 0) <= 1) return null;
                              return (
                                <div className={styles.transferGroup}><label>Pool Assignment</label>
                                  <select value={r.poolId || ''} onChange={e => patch(r.id, { poolId: e.target.value })}>
                                    <option value="" style={{ background: '#111', color: '#fff' }}>No Pool</option>
                                    {(g.pools || []).map(p => (
                                      <option key={p.id} value={p.id} style={{ background: '#111', color: '#fff' }}>Pool {p.name}</option>
                                    ))}
                                  </select>
                                </div>
                              );
                            })()}
                            <div className={styles.buttonGroup}>
                              {r.status === 'pending' && <><button className="btn btn-primary btn-xs" onClick={() => patch(r.id, { status: 'accepted' }, r)} disabled={busy}>Accept</button><button className="btn btn-danger btn-xs" onClick={() => patch(r.id, { status: 'rejected' }, r)} disabled={busy}>Reject</button></>}
                              {r.status === 'accepted' && <><button className="btn btn-outline btn-xs" onClick={() => patch(r.id, { payment_status: r.payment_status === 'paid' ? 'pending' : 'paid' })} disabled={busy}>{r.payment_status === 'paid' ? 'Unpay' : 'Pay'}</button><a href={`/teams/${r.id}`} target="_blank" className="btn btn-ghost btn-xs">Profile ↗</a></>}
                              {(r.status === 'rejected' || r.status === 'waitlist') && <button className="btn btn-ghost btn-xs" onClick={() => patch(r.id, { status: 'pending' })} disabled={busy}>Restore</button>}
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

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Add Team Manually</h3><button className="btn btn-ghost btn-sm" onClick={() => setShowAddModal(false)}><X size={16} /></button></div>
            <form onSubmit={handleAddTeam}>
              <div className="form-group"><label className="form-label">Team Name *</label><input className="form-input" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} required /></div>
              <div className="form-row form-row-2" style={{ marginTop: '1rem' }}>
                <div className="form-group"><label className="form-label">Coach</label><input className="form-input" value={addForm.coach} onChange={e => setAddForm(f => ({ ...f, coach: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} /></div>
              </div>
              <div className="form-row form-row-2" style={{ marginTop: '1rem' }}>
                <div className="form-group"><label className="form-label">Division *</label><select className="form-select" value={addForm.ageGroupId} onChange={e => setAddForm(f => ({ ...f, ageGroupId: e.target.value }))} required>{ageGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Pool</label><select className="form-select" value={addForm.pool} onChange={e => setAddForm(f => ({ ...f, pool: e.target.value }))}><option value="">None</option>{(() => { const g = ageGroups.find(x => x.id === addForm.ageGroupId); if (!g || !g.poolCount) return null; const names = g.poolNames ? g.poolNames.split(',').map(n => n.trim()) : []; return Array.from({ length: g.poolCount }).map((_, i) => { const v = names[i] || String.fromCharCode(65 + i); return <option key={v} value={v}>Pool {v}</option>; }); })()}</select></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={!!working}>Save Team</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
