'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, Check, X, CreditCard, RefreshCw, Mail, ChevronDown, ChevronUp, AlertCircle, Download, Plus, Trash2, MapPin, Search, LayoutDashboard } from 'lucide-react';
import { saveTeam, updateTeam, deleteTeam, getTeams, getAgeGroups, savePool } from '@/lib/db';
import { downloadCSV, formatPoolName } from '@/lib/utils';
import { useTournament } from '@/lib/tournament-context';
import { AgeGroup, Team } from '@/lib/types';
import s from '../admin-common.module.css';
import styles from './teams-admin.module.css';
import FeedbackModal from '@/components/FeedbackModal';

interface TeamRecord {
  id: string;
  name: string;
  coach: string;
  email: string;
  age_group_id: string;
  age_group_name: string;
  tournament_name: string;
  status: 'pending' | 'accepted' | 'rejected' | 'waitlist';
  paymentStatus: 'pending' | 'paid';
  registered_at: string;
  poolId?: string;
  adminNotes?: string;
}

type Status = 'pending' | 'accepted' | 'rejected' | 'waitlist';

export default function UnifiedTeamsPage() {
  const { currentTournament } = useTournament();
  const [regs, setRegs]       = useState<TeamRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatuses, setSelectedStatuses] = useState<Status[]>(['pending', 'accepted', 'waitlist']);
  const [search, setSearch]   = useState('');
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [selectedAgeGroupId, setSelectedAgeGroupId] = useState<string>('');
  const [working, setWorking] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', coach: '', email: '', ageGroupId: '' });
  const [stableSortedIds, setStableSortedIds] = useState<string[]>([]);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
  const [viewMode, setViewMode] = useState<'flat' | 'pools'>('pools');
  const [feedback, setFeedback] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'primary' | 'danger' | 'warning' | 'success' | 'info';
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'primary' });

  const load = useCallback(async () => {
    if (!currentTournament) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Fetch all data in parallel
      const [rRes, groups] = await Promise.all([
        fetch('/api/registrations'),
        getAgeGroups(currentTournament.id)
      ]);
      
      const rData = (await rRes.json()).map((r: any) => ({
        ...r,
        poolId: r.pool_id,
        paymentStatus: r.payment_status,
        adminNotes: r.admin_notes
      }));

      setAgeGroups(groups);
      if (groups.length) {
        if (!selectedAgeGroupId || selectedAgeGroupId === 'all') {
          setSelectedAgeGroupId(groups[0].id);
        }
        if (!addForm.ageGroupId) {
          setAddForm(f => ({ ...f, ageGroupId: groups[0].id }));
        }
      }

      setRegs(rData);

      // 2. Initialize stable order if not set
      if (stableSortedIds.length === 0) {
        const initialSorted = [...rData].sort((a: any, b: any) => {
          const statusOrder: any = { accepted: 1, waitlist: 2, pending: 3, rejected: 4 };
          if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
          if (a.paymentStatus !== b.paymentStatus) return a.paymentStatus === 'paid' ? -1 : 1;
          
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

  async function patch(id: string, updates: any) {
    setWorking(id);
    try {
      const res = await fetch(`/api/admin/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id], updates }),
      });
      if (!res.ok) throw new Error('Update failed');
      setRegs(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    } catch (e: any) {
      setFeedback({
        isOpen: true,
        title: 'Update Error',
        message: e.message,
        type: 'danger'
      });
    } finally {
      setWorking(null);
    }
  }

  async function randomizePools() {
    if (!selectedAgeGroupId || selectedAgeGroupId === 'all') return;
    const group = ageGroups.find(g => g.id === selectedAgeGroupId);
    if (!group || !group.pools || group.pools.length <= 1) {
      setFeedback({
        isOpen: true,
        title: 'Action Required',
        message: 'This division needs at least 2 pools to randomize.',
        type: 'warning'
      });
      return;
    }

    setFeedback({
      isOpen: true,
      title: 'Randomize Pools?',
      message: `Randomize pool assignments for all ACCEPTED teams in ${group.name}? This will overwrite existing assignments.`,
      type: 'primary',
      onConfirm: async () => {
        setWorking('randomizing');
        try {
          const acceptedTeams = regs.filter(r => r.age_group_id === selectedAgeGroupId && r.status === 'accepted');
          if (acceptedTeams.length === 0) {
            setFeedback({
              isOpen: true,
              title: 'No Teams',
              message: 'There are no accepted teams in this division to assign.',
              type: 'warning'
            });
            return;
          }

          const shuffled = [...acceptedTeams].sort(() => Math.random() - 0.5);
          const pools = group.pools || [];
          
          for (let i = 0; i < shuffled.length; i++) {
            const team = shuffled[i];
            const pool = pools[i % pools.length];
            
            await fetch(`/api/admin/teams`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: [team.id], updates: { poolId: pool.id } }),
            });
          }

          load();
          setFeedback({
            isOpen: true,
            title: 'Success!',
            message: 'Pools have been randomized and saved.',
            type: 'success'
          });
        } catch (e: any) {
          setFeedback({
            isOpen: true,
            title: 'Randomization Failed',
            message: e.message,
            type: 'danger'
          });
        } finally {
          setWorking(null);
        }
      }
    });
  }

  async function handleAddTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!currentTournament) return;
    setWorking('new');
    try {
      const id = crypto.randomUUID();
      await saveTeam({
        id,
        name: addForm.name,
        coach: addForm.coach,
        email: addForm.email,
        ageGroupId: addForm.ageGroupId,
        tournamentId: currentTournament.id,
        status: 'accepted',
        paymentStatus: 'paid',
        registeredAt: new Date().toISOString(),
        players: []
      });

      setShowAddModal(false);
      setAddForm({ name: '', coach: '', email: '', ageGroupId: ageGroups[0]?.id || '' });
      load();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setWorking(null);
    }
  }

  const filtered = regs.filter(r => {
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(r.status);
    const matchesDivision = r.age_group_id === selectedAgeGroupId;
    const matchesSearch = search === '' || 
      r.name.toLowerCase().includes(search.toLowerCase()) || 
      r.coach.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesDivision && matchesSearch;
  });

  const sorted = stableSortedIds
    .map(id => filtered.find(r => r.id === id))
    .filter(Boolean) as TeamRecord[];

  const newTeams = filtered.filter(r => !stableSortedIds.includes(r.id));
  const finalDisplay = [...sorted, ...newTeams];

  const grouped = finalDisplay.reduce((acc, r) => {
    if (!acc[r.age_group_name]) acc[r.age_group_name] = [];
    acc[r.age_group_name].push(r);
    return acc;
  }, {} as Record<string, TeamRecord[]>);

  function exportCSV() {
    const headers = ['Team', 'Coach', 'Email', 'Division', 'Pool', 'Status', 'Payment'];
    const rows = filtered.map(r => [r.name, r.coach, r.email, r.age_group_name, r.poolId ? ageGroups.find(g => g.id === r.age_group_id)?.pools?.find(p => p.id === r.poolId)?.name || '-' : '-', r.status, r.paymentStatus]);
    downloadCSV(`teams-regs-${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  }

  const renderRow = (r: TeamRecord, hidePoolBadge = false) => {
    const isExpanded = expanded.has(r.id);
    const busy = working === r.id;
    return (
      <div key={r.id} className={s.row}>
        <div className={s.rowMain}>
          <div style={{ width: 12 }} />
          <div style={{ flex: 2 }} className={s.primaryCell}><strong>{r.name}</strong></div>
          <div style={{ flex: 1.5 }} className={s.secondaryCell}>{r.coach}</div>
          
          {!hidePoolBadge && (
            <div style={{ flex: 1 }}>
              {(() => {
                const g = ageGroups.find(x => x.id === r.age_group_id);
                if (!g || (g.poolCount || 0) <= 1) return <span style={{ color: 'var(--white-20)', fontSize: '0.75rem' }}>No Pools</span>;
                
                const poolRecord = g.pools?.find(p => p.id === r.poolId);
                const displayPoolName = poolRecord ? poolRecord.name : null;

                if (r.status !== 'accepted') return '-';
                if (displayPoolName) return <span className="badge badge-purple" style={{ opacity: 0.8 }}>{formatPoolName(displayPoolName)}</span>;
                return <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>Needs Pool</span>;
              })()}
            </div>
          )}

          <div style={{ width: 120 }}>
            <span className={`badge badge-${r.status === 'accepted' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'}`}>{r.status}</span>
          </div>
          <div style={{ width: 120, paddingLeft: '1rem' }}>{r.status === 'accepted' ? <span className={`badge badge-${r.paymentStatus === 'paid' ? 'success' : 'warning'}`}>{r.paymentStatus}</span> : '-'}</div>
          <div style={{ width: 40, textAlign: 'right' }}><button className={s.iconBtn} onClick={() => setExpanded(prev => { const set = new Set(prev); set.has(r.id) ? set.delete(r.id) : set.add(r.id); return set; })}>{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button></div>
        </div>
        {isExpanded && (
          <div className={s.expandedRow}>
            <div className={s.expandedContent}>
              <div className={s.expandedInfo}>
                <div className={styles.infoLine}><span>Email: <a href={`mailto:${r.email}`}>{r.email}</a></span><span style={{ marginLeft: '1rem' }}>Reg: {new Date(r.registered_at).toLocaleDateString()}</span></div>
                <div className={styles.notesArea}><label>Admin Notes</label><textarea placeholder="Private notes..." defaultValue={r.adminNotes} onBlur={e => e.target.value !== r.adminNotes && patch(r.id, { adminNotes: e.target.value })} /></div>
              </div>
              <div className={s.expandedActions}>
                {(() => {
                  const g = ageGroups.find(x => x.id === r.age_group_id);
                  if (!g || (g.poolCount || 0) <= 1) return null;
                  return (
                    <div className={styles.transferGroup}><label>Pool Assignment</label>
                      <select value={r.poolId || ''} onChange={e => patch(r.id, { poolId: e.target.value })}>
                        <option value="" style={{ background: '#111', color: '#fff' }}>No Pool</option>
                        {(g.pools || []).map(p => (
                          <option key={p.id} value={p.id} style={{ background: '#111', color: '#fff' }}>{formatPoolName(p.name)}</option>
                        ))}
                      </select>
                    </div>
                  );
                })()}
                <div className={styles.buttonGroup}>
                  {r.status === 'pending' && <><button className="btn btn-primary btn-xs" onClick={() => patch(r.id, { status: 'accepted' })} disabled={busy}>Accept</button><button className="btn btn-danger btn-xs" onClick={() => patch(r.id, { status: 'rejected' })} disabled={busy}>Reject</button></>}
                  {r.status === 'accepted' && <><button className="btn btn-outline btn-xs" onClick={() => patch(r.id, { paymentStatus: r.paymentStatus === 'paid' ? 'pending' : 'paid' })} disabled={busy}>{r.paymentStatus === 'paid' ? 'Unpay' : 'Pay'}</button><a href={`/teams/${r.id}`} target="_blank" className="btn btn-ghost btn-xs">Profile ↗</a></>}
                  {(r.status === 'rejected' || r.status === 'waitlist') && <button className="btn btn-ghost btn-xs" onClick={() => patch(r.id, { status: 'pending' })} disabled={busy}>Restore</button>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div className={s.headerLeft}>
          <div className={s.headerIcon}><Users size={20} /></div>
          <div>
            <h1 className={s.pageTitle}>Registrations</h1>
            <p className={s.pageSub}>Manage all teams and signups in one place</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button className="btn btn-outline btn-sm" onClick={exportCSV} disabled={regs.length === 0}><Download size={14} /> Export</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)} disabled={!currentTournament}><Plus size={16} /> Add Team</button>
        </div>
      </div>

      <div className={s.controlsBar}>
        <div className={s.controlsLeft}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSummaryModal(true)} style={{ color: 'var(--purple-light)', gap: '0.5rem' }}>
            <LayoutDashboard size={14} /> Summary Dashboard
          </button>
          <button className="btn btn-ghost btn-sm" onClick={randomizePools} disabled={loading || !selectedAgeGroupId} style={{ color: 'var(--purple-light)', gap: '0.5rem' }}>
            <RefreshCw size={14} className={working === 'randomizing' ? 'spin' : ''} /> Randomize Pools
          </button>
        </div>
        <div className={s.controlsRight}>
          <div className={s.controlGroup}>
            <label className={s.controlLabel}>Division:</label>
            <select className={`${s.controlSelect} form-input`} value={selectedAgeGroupId} onChange={e => setSelectedAgeGroupId(e.target.value)}>
              {ageGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className={s.viewToggle}>
            <button className={`${s.toggleBtn} ${viewMode === 'flat' ? s.toggleActive : ''}`} onClick={() => setViewMode('flat')}>Flat</button>
            <button className={`${s.toggleBtn} ${viewMode === 'pools' ? s.toggleActive : ''}`} onClick={() => setViewMode('pools')}>Pools</button>
          </div>
        </div>
      </div>

      {showSummaryModal && (
        <div className="modal-overlay" onClick={() => setShowSummaryModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <LayoutDashboard size={20} className="text-primary" />
                <h3 style={{ margin: 0 }}>Tournament Summary</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowSummaryModal(false)}><X size={16} /></button>
            </div>
            <div style={{ padding: '2rem' }}>
              <div className={styles.summaryGridModal}>
                {ageGroups.map(g => {
                  const groupRegs = regs.filter(r => r.age_group_id === g.id);
                  const accepted = groupRegs.filter(r => r.status === 'accepted').length;
                  const capacity = g.capacity || 0;
                  return (
                    <div key={g.id} className={styles.summaryCardModal} onClick={() => { setSelectedAgeGroupId(g.id); setShowSummaryModal(false); }}>
                      <div className={styles.summaryHeader}>
                        <strong>{g.name}</strong>
                        {capacity > 0 && <span className={accepted >= capacity ? styles.fullBadge : styles.capacityBadge}>{accepted}/{capacity}</span>}
                      </div>
                      <div className={styles.summaryStats}>
                        <div style={{ marginBottom: '0.25rem' }}>{groupRegs.filter(r => r.status === 'pending').length} Pending • {groupRegs.filter(r => r.status === 'waitlist').length} Waitlist</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowSummaryModal(false)}>Close Dashboard</button>
            </div>
          </div>
        </div>
      )}

      <div className={s.filtersRow}>
        <div className={s.statusFilters}>
          {(['pending', 'accepted', 'waitlist', 'rejected'] as Status[]).map(st => (
            <button key={st} className={`${s.filterChip} ${selectedStatuses.includes(st) ? s.chipActive : ''}`} onClick={() => setSelectedStatuses(prev => prev.includes(st) ? prev.filter(x => x !== st) : [...prev, st])}>
              {st.toUpperCase()} ({regs.filter(r => r.status === st).length})
            </button>
          ))}
        </div>
        <div className={s.searchWrapper}>
          <Search size={16} className={s.searchIcon} />
          <input type="text" placeholder="Search teams or coaches..." value={search} onChange={e => setSearch(e.target.value)} className={s.searchInput} />
        </div>
      </div>

      {!hasLoadedInitial ? (
        <div className="empty-state"><RefreshCw size={32} className="spin" style={{ opacity: 0.4 }} /><p>Loading data…</p></div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="empty-state"><Users size={40} style={{ opacity: 0.2 }} /><p>No teams matching filters.</p></div>
      ) : (
        <div className={s.compactList}>
          {Object.entries(grouped).map(([ageGroup, groupRegs]) => (
            <div key={ageGroup} className={s.groupSection}>
              <div className={s.groupHeader}><strong>{ageGroup}</strong> <span className="badge badge-purple">{groupRegs.length} Teams</span></div>
              
              {viewMode === 'flat' ? (
                <>
                  {groupRegs.map(r => renderRow(r))}
                </>
              ) : (
                <div className={s.compactListContent}>
                  {(() => {
                    const g = ageGroups.find(x => x.id === groupRegs[0]?.age_group_id);
                    const pools = g?.pools || [];
                    
                    // Group teams by poolId
                    const byPool = groupRegs.reduce((acc, r) => {
                      const pid = r.poolId || 'unassigned';
                      if (!acc[pid]) acc[pid] = [];
                      acc[pid].push(r);
                      return acc;
                    }, {} as Record<string, TeamRecord[]>);

                    return [{ id: 'unassigned', name: 'Unassigned' }, ...pools].map(p => {
                      const teamsInPool = byPool[p.id] || [];
                      if (teamsInPool.length === 0) return null;

                      return (
                        <div key={p.id} className={s.poolSubSection}>
                          <div className={s.poolSubHeader}>
                            <div className={s.poolDot} style={{ background: p.id === 'unassigned' ? 'var(--danger-light)' : 'var(--purple-light)' }} />
                            <span className={s.poolSubLabel} style={{ color: p.id === 'unassigned' ? 'var(--danger-light)' : undefined }}>{p.id === 'unassigned' ? 'UNASSIGNED' : `${p.name.replace(/^Pool\s+/i, '').trim().toUpperCase()} POOL`}</span>
                            <span className={s.poolSubCount}>({teamsInPool.length})</span>
                          </div>
                          {teamsInPool.map(r => renderRow(r, true))}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={!!working}>Save Team</button></div>
            </form>
          </div>
        </div>
      )}

      <FeedbackModal 
        {...feedback} 
        onClose={() => setFeedback(f => ({ ...f, isOpen: false, onConfirm: undefined }))} 
      />
    </div>
  );
}
