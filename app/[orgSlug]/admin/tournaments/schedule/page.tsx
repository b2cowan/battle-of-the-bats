'use client';
import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Pencil, Trash2, X, Check, Download, Sparkles, Trophy, MapPin, Clock, Search } from 'lucide-react';
import { formatPoolName } from '@/lib/utils';
import { saveGame, updateGame, deleteGame } from '@/lib/db';
import { downloadCSV, formatTime } from '@/lib/utils';
import { useTournament } from '@/lib/tournament-context';
import ScheduleGenerator from './Generator';
import PlayoffWizard from './PlayoffWizard';
import GameList from './components/GameList';
import { Game, Team, AgeGroup, Diamond, PoolSlot } from '@/lib/types';
import s from '../../admin-common.module.css';
import styles from './schedule-admin.module.css';
import FeedbackModal from '@/components/FeedbackModal';
import HelpCallout from '@/components/help/HelpCallout';
import AddVenueModal from '@/components/admin/AddVenueModal';

type ModalMode = 'add' | 'edit' | null;

const emptyForm = {
  ageGroupId: '', homeTeamId: '', awayTeamId: '',
  homeSlotId: '', awaySlotId: '',
  date: '', time: '09:00', location: '', diamondId: '', notes: null as string | null,
  bracketCode: '',
};

export default function AdminSchedulePage() {
  const { currentTournament } = useTournament();
  const [games, setGames]       = useState<Game[]>([]);
  const [teams, setTeams]       = useState<Team[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [diamonds, setDiamonds] = useState<Diamond[]>([]);
  const [modalSlots, setModalSlots] = useState<PoolSlot[]>([]);
  const [modalSlotsLoading, setModalSlotsLoading] = useState(false);
  const [modal, setModal]       = useState<ModalMode>(null);
  const [editing, setEditing]   = useState<Game | null>(null);
  const [form, setForm]         = useState(emptyForm);
  const [filterGroup, setFilterGroup] = useState('');
  const [viewMode, setViewMode] = useState<'pool' | 'playoff'>('pool');
  const [groupMode, setGroupMode] = useState<'flat' | 'pools'>('pools');
  const [layoutMode, setLayoutMode] = useState<'list' | 'bracket'>('list');
  const [showGenerator, setShowGenerator] = useState(false);
  const [showPlayoffWizard, setShowPlayoffWizard] = useState(false);
  const [search, setSearch] = useState('');
  const [venueSearch, setVenueSearch] = useState('');
  const [venueDropdownOpen, setVenueDropdownOpen] = useState(false);
  const [addVenueOpen, setAddVenueOpen] = useState(false);
  const [feedback, setFeedback] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'primary' | 'danger' | 'warning' | 'success' | 'info';
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'primary' });


  async function refresh() {
    const tournamentId = currentTournament?.id;
    if (!tournamentId) return;

    const [gamesRes, teamsRes, groupsRes, diamondsRes] = await Promise.all([
      fetch(`/api/admin/games?tournamentId=${encodeURIComponent(tournamentId)}`),
      fetch(`/api/admin/teams?tournamentId=${encodeURIComponent(tournamentId)}`),
      fetch(`/api/admin/age-groups?tournamentId=${encodeURIComponent(tournamentId)}`),
      fetch(`/api/admin/diamonds?tournamentId=${encodeURIComponent(tournamentId)}`),
    ]);

    const games = gamesRes.ok ? await gamesRes.json() : [];
    const allTeams = teamsRes.ok ? await teamsRes.json() : [];
    const groups = groupsRes.ok ? await groupsRes.json() : [];
    const diamonds = diamondsRes.ok ? await diamondsRes.json() : [];

    setGames(games);
    setTeams(allTeams.filter((t: any) => t.status === 'accepted'));
    setAgeGroups(groups);
    if (groups.length > 0 && !filterGroup) {
      setFilterGroup(groups[0].id);
    }
    setDiamonds(diamonds);
  }
  
  useEffect(() => { refresh(); }, [currentTournament?.id]);

  const groupTeams   = (id: string) => teams.filter(t => t.ageGroupId === id);
  const getTeamName  = (id: string) => teams.find(t => t.id === id)?.name ?? null;
  const resolveTeam  = (id: string, placeholder?: string) => getTeamName(id) ?? placeholder ?? 'TBD';
  const getGroupName = (id: string) => ageGroups.find(g => g.id === id)?.name ?? '—';
  const getDiamondName = (id?: string) => id ? (diamonds.find(d => d.id === id)?.name ?? '') : '';

  async function fetchModalSlots(ageGroupId: string) {
    if (!currentTournament?.id || !ageGroupId) { setModalSlots([]); return; }
    setModalSlotsLoading(true);
    try {
      const res = await fetch(`/api/admin/pool-slots?tournamentId=${encodeURIComponent(currentTournament.id)}&ageGroupId=${encodeURIComponent(ageGroupId)}`);
      setModalSlots(res.ok ? await res.json() : []);
    } catch { setModalSlots([]); }
    finally { setModalSlotsLoading(false); }
  }

  async function handleSetVisibility(ageGroupId: string, visibility: string) {
    const ag = ageGroups.find(g => g.id === ageGroupId);
    if (visibility === 'published_teams' && !ag?.isClosed) {
      setFeedback({ isOpen: true, title: 'Registration Still Open', message: `Close registration for "${ag?.name ?? 'this division'}" before publishing team names.`, type: 'warning' });
      return;
    }
    try {
      await fetch('/api/admin/age-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-visibility', data: { id: ageGroupId, scheduleVisibility: visibility } }),
      });
      setAgeGroups(prev => prev.map(g => g.id === ageGroupId ? { ...g, scheduleVisibility: visibility as any } : g));
    } catch {
      setFeedback({ isOpen: true, title: 'Error', message: 'Failed to update visibility.', type: 'danger' });
    }
  }

  function handlePublishAll() {
    setFeedback({
      isOpen: true,
      title: 'Publish All Divisions?',
      message: 'Set all divisions to "Generic Names" visibility? The public schedule will show slot names (Team 1, Team 2…). Switch individual divisions to "Team Names" once registration closes.',
      type: 'primary',
      onConfirm: async () => {
        await fetch('/api/admin/age-groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set-visibility', data: { tournamentId: currentTournament?.id, scheduleVisibility: 'published_generic' } }),
        });
        setAgeGroups(prev => prev.map(g => ({ ...g, scheduleVisibility: 'published_generic' as const })));
      }
    });
  }

  function openAdd() {
    const ageGroupId = filterGroup || (ageGroups[0]?.id ?? '');
    setForm({ ...emptyForm, ageGroupId });
    setVenueSearch('');
    setEditing(null);
    setModal('add');
    fetchModalSlots(ageGroupId);
  }

  function openEdit(g: Game) {
    setForm({
      ageGroupId: g.ageGroupId,
      homeTeamId: g.homeTeamId ?? '',
      awayTeamId: g.awayTeamId ?? '',
      homeSlotId: g.homeSlotId ?? '',
      awaySlotId: g.awaySlotId ?? '',
      date: g.date ?? '',
      time: g.time ?? '09:00',
      location: g.location ?? '',
      diamondId: g.diamondId ?? '',
      notes: g.notes ?? '',
      bracketCode: g.bracketCode ?? '',
    });
    const existingDiamond = g.diamondId ? diamonds.find(d => d.id === g.diamondId) : null;
    setVenueSearch(existingDiamond?.name ?? g.location ?? '');
    setEditing(g);
    setModal('edit');
    fetchModalSlots(g.ageGroupId);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const slotMode = modalSlots.length > 0;
    const homeSlot = slotMode ? modalSlots.find(s => s.id === form.homeSlotId) : null;
    const awaySlot = slotMode ? modalSlots.find(s => s.id === form.awaySlotId) : null;
    const data: Omit<Game, 'id'> = {
      tournamentId:    currentTournament?.id ?? '',
      ageGroupId:      form.ageGroupId,
      homeTeamId:      slotMode ? '' : (form.homeTeamId || ''),
      awayTeamId:      slotMode ? '' : (form.awayTeamId || ''),
      homeSlotId:      homeSlot?.id,
      awaySlotId:      awaySlot?.id,
      homePlaceholder: homeSlot?.displayName,
      awayPlaceholder: awaySlot?.displayName,
      date:            form.date,
      time:            form.time,
      location:        form.location,
      diamondId:       form.diamondId || undefined,
      notes:           form.notes || undefined,
      status:          editing?.status || 'scheduled',
      bracketCode:     form.bracketCode || undefined,
    };
    if (modal === 'add') await saveGame(data);
    else if (editing) await updateGame(editing.id, data);
    setModal(null);
    refresh();
  }

  async function markCancelled(id: string) { await updateGame(id, { status: 'cancelled' }); refresh(); }
  async function markScheduled(id: string) { await updateGame(id, { status: 'scheduled', homeScore: null, awayScore: null }); refresh(); }

  function handleDeleteRequest(id: string) {
    setFeedback({
      isOpen: true,
      title: 'Remove Game?',
      message: 'This will permanently remove the game from the schedule.',
      type: 'danger',
      onConfirm: async () => {
        await deleteGame(id);
        refresh();
      }
    });
  }

  async function handleVenueSaved(saved: Diamond) {
    const res = await fetch(`/api/admin/diamonds?tournamentId=${encodeURIComponent(currentTournament!.id)}`);
    const updated: Diamond[] = res.ok ? await res.json() : [];
    setDiamonds(updated);
    setForm(f => ({ ...f, diamondId: saved.id, location: saved.name }));
    setVenueSearch(saved.name);
    setAddVenueOpen(false);
  }

  const scheduled = games;
  const filtered  = scheduled.filter(g => {
    const matchesDivision = g.ageGroupId === filterGroup;
    const matchesView = viewMode === 'playoff' ? g.isPlayoff : !g.isPlayoff;
    const q = search.toLowerCase();
    const matchesSearch = q === '' ||
      resolveTeam(g.homeTeamId, g.homePlaceholder).toLowerCase().includes(q) ||
      resolveTeam(g.awayTeamId, g.awayPlaceholder).toLowerCase().includes(q);
    return matchesDivision && matchesView && matchesSearch;
  });

  function formatDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function exportToCSV() {
    const headers = ['Date', 'Time', 'Division', 'Home Team', 'Away Team', 'Location', 'Status'];
    const rows = filtered.map(g => [
      g.date,
      formatTime(g.time),
      getGroupName(g.ageGroupId),
      resolveTeam(g.homeTeamId, g.homePlaceholder),
      resolveTeam(g.awayTeamId, g.awayPlaceholder),
      g.diamondId ? getDiamondName(g.diamondId) : g.location,
      g.status,
    ]);
    const filename = `schedule-${currentTournament?.year || 'all'}-${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(filename, headers, rows);
  }

  function statusBadge(status: string) {
    if (status === 'completed') return <span className="badge badge-success">Final</span>;
    if (status === 'cancelled') return <span className="badge badge-danger">Cancelled</span>;
    return <span className="badge badge-warning">Scheduled</span>;
  }

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div className={s.headerLeft}>
          <div className={s.headerIcon}><Calendar size={20} /></div>
          <div>
            <h1 className={s.pageTitle}>Schedule Management</h1>
            <p className={s.pageSub}>
              {currentTournament ? `${currentTournament.name} (${currentTournament.year})` : 'Plan tournament games'}
            </p>
          </div>
        </div>
        <div className={s.headerActions}>
          <button className="btn btn-outline btn-sm" onClick={exportToCSV} disabled={filtered.length === 0}>
            <Download size={14} /> Export
          </button>
          <button className="btn btn-primary btn-sm" onClick={openAdd} disabled={!currentTournament}>
            <Plus size={16} /> Add Game
          </button>
        </div>
      </div>

      <div className={s.controlsBar}>
        <div className={s.controlsLeft}>
          <div className={s.viewToggle}>
            <button className={`${s.toggleBtn} ${viewMode === 'pool' ? s.toggleActive : ''}`} onClick={() => setViewMode('pool')}>Round Robin</button>
            <button className={`${s.toggleBtn} ${viewMode === 'playoff' ? s.toggleActive : ''}`} onClick={() => setViewMode('playoff')}>Playoffs</button>
          </div>
          {viewMode === 'pool' ? (
            <button className="btn btn-ghost btn-sm text-primary-light" onClick={() => setShowGenerator(true)} disabled={!currentTournament} style={{ height: '32px', marginLeft: '0.5rem' }}>
              <Sparkles size={14} /> Auto-Generate
            </button>
          ) : (
            <button className="btn btn-ghost btn-sm text-primary-light" onClick={() => setShowPlayoffWizard(true)} disabled={!currentTournament} style={{ height: '32px', marginLeft: '0.5rem' }}>
              <Trophy size={14} /> Playoff Wizard
            </button>
          )}
          {viewMode === 'pool' && (
            <button className="btn btn-ghost btn-sm" onClick={handlePublishAll} disabled={!currentTournament || ageGroups.length === 0} style={{ height: '32px', marginLeft: '0.5rem', color: 'var(--logic-lime)', gap: '0.4rem' }}>
              Publish All
            </button>
          )}
        </div>
        <div className={s.controlsRight}>
          <div className={s.controlGroup}>
            <label className={s.controlLabel}>Division:</label>
            <select className={`${s.controlSelect} form-input`} value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
              {ageGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          {viewMode === 'pool' && (() => {
            const ag = ageGroups.find(g => g.id === filterGroup);
            return (
              <div className={s.controlGroup}>
                <label className={s.controlLabel}>Visibility:</label>
                <select
                  className={`${s.controlSelect} form-input`}
                  value={ag?.scheduleVisibility ?? 'unpublished'}
                  onChange={e => handleSetVisibility(filterGroup, e.target.value)}
                  style={{ minWidth: '155px' }}
                >
                  <option value="unpublished">Unpublished</option>
                  <option value="published_generic">Generic Names</option>
                  <option value="published_teams">{ag?.isClosed ? 'Team Names' : 'Team Names (close reg first)'}</option>
                </select>
              </div>
            );
          })()}
          {viewMode === 'pool' && (
            <div className={s.viewToggle}>
              <button className={`${s.toggleBtn} ${groupMode === 'flat' ? s.toggleActive : ''}`} onClick={() => setGroupMode('flat')}>Flat</button>
              <button className={`${s.toggleBtn} ${groupMode === 'pools' ? s.toggleActive : ''}`} onClick={() => setGroupMode('pools')}>Pools</button>
            </div>
          )}
          {viewMode === 'playoff' && (
            <div className={s.viewToggle}>
              <button className={`${s.toggleBtn} ${layoutMode === 'list' ? s.toggleActive : ''}`} onClick={() => setLayoutMode('list')}>List</button>
              <button className={`${s.toggleBtn} ${layoutMode === 'bracket' ? s.toggleActive : ''}`} onClick={() => setLayoutMode('bracket')}>Bracket</button>
            </div>
          )}
        </div>
      </div>

      <div className={s.filtersRow}>
        <div className={s.statusFilters}>
          <span className={s.filterChip} style={{ cursor: 'default', opacity: 0.6 }}>
            {filtered.length} Game{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className={s.searchWrapper}>
          <Search size={16} className={s.searchIcon} />
          <input type="text" placeholder="Search teams..." value={search} onChange={e => setSearch(e.target.value)} className={s.searchInput} />
        </div>
      </div>

      {currentTournament && games.length === 0 && (
        <HelpCallout
          variant="info"
          title="No games scheduled yet"
          body="Build your schedule by adding games manually, or use Auto-Generate to create a round-robin schedule from your age groups and teams. For playoffs, use the Playoff Wizard."
        />
      )}

      {viewMode === 'playoff' && layoutMode === 'bracket' ? (
        <PlayoffBracketView
          games={filtered}
          teams={teams}
          ageGroup={ageGroups.find(g => g.id === filterGroup)}
          onEdit={openEdit}
          onDelete={handleDeleteRequest}
          getGroupName={getGroupName}
          formatDate={formatDate}
          statusBadge={statusBadge}
        />
      ) : (
        <div className={s.compactList}>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <Calendar size={40} style={{ opacity: 0.2 }} />
              <p>{currentTournament ? 'No games found for this division.' : 'No tournament selected.'}</p>
            </div>
          ) : (
            <GameList
              games={filtered}
              teams={teams}
              ageGroups={ageGroups}
              diamonds={diamonds}
              viewMode={viewMode}
              groupByPool={groupMode === 'pools'}
              pools={ageGroups.find(g => g.id === filterGroup)?.pools}
              onEdit={openEdit}
              onDelete={handleDeleteRequest}
              onCancel={markCancelled}
              onSchedule={markScheduled}
              mode="planning"
            />
          )}
        </div>
      )}

      {(modal === 'add' || modal === 'edit') && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal === 'add' ? 'Add Game' : 'Edit Game'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row form-row-3" style={{ marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Division *</label>
                  <select className="form-select" value={form.ageGroupId}
                    onChange={e => { setForm(f => ({ ...f, ageGroupId: e.target.value, homeTeamId: '', awayTeamId: '', homeSlotId: '', awaySlotId: '' })); fetchModalSlots(e.target.value); }} required>
                    <option value="">Select...</option>
                    {ageGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Time</label>
                  <input className="form-input" type="time" value={form.time}
                    onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
                </div>
              </div>
              {(() => {
                if (modalSlotsLoading) {
                  return <div style={{ marginBottom: '1rem', padding: '0.7rem 0.875rem', fontSize: '0.85rem', color: 'var(--white-40)' }}>Loading slots…</div>;
                }

                const ag = ageGroups.find(g => g.id === form.ageGroupId);
                const mPools = ag?.pools ?? [];

                if (modalSlots.length > 0) {
                  const slotOptions = mPools.length > 0
                    ? mPools.flatMap(pool => {
                        const ps = modalSlots.filter(s => s.poolId === pool.id);
                        return ps.length > 0 ? [{ label: pool.name, slots: ps }] : [];
                      })
                    : [{ label: null, slots: modalSlots }];
                  const renderSlotSelect = (value: string, onChange: (v: string) => void, label: string) => (
                    <div className="form-group">
                      <label className="form-label">{label}</label>
                      <select className="form-select" value={value} onChange={e => onChange(e.target.value)}>
                        <option value="">Select slot...</option>
                        {slotOptions.map(({ label: gLabel, slots }) =>
                          gLabel
                            ? <optgroup key={gLabel} label={gLabel}>{slots.map(s => <option key={s.id} value={s.id}>{s.displayName}</option>)}</optgroup>
                            : slots.map(s => <option key={s.id} value={s.id}>{s.displayName}</option>)
                        )}
                      </select>
                    </div>
                  );
                  return (
                    <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
                      {renderSlotSelect(form.homeSlotId, v => setForm(f => ({ ...f, homeSlotId: v })), 'Home Slot')}
                      {renderSlotSelect(form.awaySlotId, v => setForm(f => ({ ...f, awaySlotId: v })), 'Away Slot')}
                    </div>
                  );
                }

                return (
                  <>
                    <div style={{ marginBottom: '0.75rem', padding: '0.7rem 0.875rem', background: 'var(--white-5)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--white-40)' }}>
                      No slots configured for this division. Configure pools in Division Settings to use slot-based scheduling.
                    </div>
                    <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label">Home Team</label>
                        <select className="form-select" value={form.homeTeamId} onChange={e => setForm(f => ({ ...f, homeTeamId: e.target.value }))}>
                          <option value="">Select...</option>
                          {groupTeams(form.ageGroupId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Away Team</label>
                        <select className="form-select" value={form.awayTeamId} onChange={e => setForm(f => ({ ...f, awayTeamId: e.target.value }))}>
                          <option value="">Select...</option>
                          {groupTeams(form.ageGroupId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </>
                );
              })()}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Venue *</label>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ height: '26px', fontSize: '0.75rem', padding: '0 0.6rem', gap: '0.25rem' }}
                    onClick={() => setAddVenueOpen(true)}
                  >
                    <Plus size={12} /> Add venue
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <MapPin size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--white-30)', pointerEvents: 'none', zIndex: 1 }} />
                  <input
                    className="form-input"
                    style={{ paddingLeft: '2.1rem' }}
                    placeholder={diamonds.length > 0 ? 'Search venues…' : 'Type a location…'}
                    value={venueSearch}
                    autoComplete="off"
                    required
                    onChange={e => {
                      const v = e.target.value;
                      setVenueSearch(v);
                      setForm(f => ({ ...f, location: v, diamondId: '' }));
                      setVenueDropdownOpen(true);
                    }}
                    onFocus={() => { if (diamonds.length > 0) setVenueDropdownOpen(true); }}
                    onBlur={() => setTimeout(() => setVenueDropdownOpen(false), 150)}
                  />
                  {venueDropdownOpen && (() => {
                    const q = venueSearch.toLowerCase();
                    const filtered = diamonds.filter(d =>
                      !q || d.name.toLowerCase().includes(q) || (d.address || '').toLowerCase().includes(q)
                    );
                    if (filtered.length === 0) return null;
                    return (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 200,
                        background: '#0d0f18', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)', boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
                        maxHeight: '180px', overflowY: 'auto',
                      }}>
                        {filtered.map((d, i) => (
                          <div
                            key={d.id}
                            onMouseDown={() => {
                              setForm(f => ({ ...f, diamondId: d.id, location: d.name }));
                              setVenueSearch(d.name);
                              setVenueDropdownOpen(false);
                            }}
                            style={{
                              padding: '0.55rem 0.875rem',
                              cursor: 'pointer',
                              borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--white-5)')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}
                          >
                            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--white)' }}>{d.name}</div>
                            {d.address && <div style={{ fontSize: '0.73rem', color: 'var(--white-40)', marginTop: '1px' }}>{d.address}</div>}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                {form.diamondId && (
                  <div style={{ marginTop: '0.35rem', fontSize: '0.73rem', color: 'var(--white-40)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Check size={11} style={{ color: 'var(--logic-lime)' }} /> Linked to saved venue
                  </div>
                )}
              </div>
              {viewMode === 'playoff' && (
                <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Abbreviation</label>
                    <input
                      className="form-input"
                      placeholder="e.g. SF1, FIN"
                      value={form.bracketCode}
                      maxLength={3}
                      onChange={e => setForm(f => ({ ...f, bracketCode: e.target.value.toUpperCase() }))}
                      style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.05em', textTransform: 'uppercase' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes (optional)</label>
                    <input className="form-input" placeholder="Any additional info" value={form.notes || ''}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>
              )}
              {viewMode !== 'playoff' && (
                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                  <label className="form-label">Notes (optional)</label>
                  <input className="form-input" placeholder="Any additional info" value={form.notes || ''}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" id="schedule-save-btn"><Check size={14} /> Save Game</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showGenerator && currentTournament && (
        <ScheduleGenerator 
          tournament={currentTournament}
          ageGroups={ageGroups}
          teams={teams}
          diamonds={diamonds}
          onCancel={() => setShowGenerator(false)}
          onComplete={() => {
            setShowGenerator(false);
            refresh();
          }}
        />
      )}

      {showPlayoffWizard && filterGroup !== '' && (
        <PlayoffWizard
          ageGroup={ageGroups.find(g => g.id === filterGroup)!}
          tournamentId={currentTournament?.id || ''}
          onClose={() => setShowPlayoffWizard(false)}
          onComplete={() => {
            setShowPlayoffWizard(false);
            refresh();
          }}
        />
      )}

      {addVenueOpen && currentTournament && (
        <AddVenueModal
          tournamentId={currentTournament.id}
          onClose={() => setAddVenueOpen(false)}
          onSaved={handleVenueSaved}
          zIndex={1100}
        />
      )}

      <FeedbackModal
        {...feedback}
        onClose={() => setFeedback(f => ({ ...f, isOpen: false, onConfirm: undefined }))}
      />
    </div>
  );
}

function inferGamePool(game: any, allGames: any[], pools: any[]): string | null {
  // Direct: placeholder contains "Pool X"
  for (const pool of pools) {
    const bare = pool.name.replace(/^Pool\s+/i, '').trim();
    const tag = `Pool ${bare}`;
    if (game.homePlaceholder?.includes(tag) || game.awayPlaceholder?.includes(tag)) {
      return pool.name;
    }
  }
  // Transitive: "Winner SF1" → find that game's pool.
  // Match by bracketId (set per-pool in executeCreate) to avoid code collisions.
  const ph = game.homePlaceholder || game.awayPlaceholder || '';
  const winnerCode = ph.match(/Winner (\w+)/)?.[1];
  if (winnerCode) {
    const source = allGames.find((g: any) =>
      g.bracketCode === winnerCode &&
      g.isPlayoff &&
      g.id !== game.id &&
      (game.bracketId ? g.bracketId === game.bracketId : true)
    );
    if (source) return inferGamePool(source, allGames, pools);
  }
  // BracketId sibling fallback: for manually-added rounds with no placeholder,
  // find any sibling game in the same bracketId group that has a direct pool match.
  if (game.bracketId) {
    for (const sibling of allGames) {
      if (sibling.id === game.id || sibling.bracketId !== game.bracketId || !sibling.isPlayoff) continue;
      for (const pool of pools) {
        const bare = pool.name.replace(/^Pool\s+/i, '').trim();
        const tag = `Pool ${bare}`;
        if (sibling.homePlaceholder?.includes(tag) || sibling.awayPlaceholder?.includes(tag)) {
          return pool.name;
        }
      }
    }
  }
  return null;
}

// Detect split mode from game data: any playoff game whose placeholder names a pool
function hasSplitPoolGames(games: any[], pools: any[]): boolean {
  return pools.length >= 2 && games.some(g =>
    pools.some((p: any) => {
      const bare = p.name.replace(/^Pool\s+/i, '').trim();
      const tag = `Pool ${bare}`;
      return g.homePlaceholder?.includes(tag) || g.awayPlaceholder?.includes(tag);
    })
  );
}

function buildBracketColumns(games: any[]) {
  const standardRounds = [
    { title: 'Quarterfinals', pattern: /^QF/i },
    { title: 'Semifinals', pattern: /^SF/i },
    { title: 'Finals', pattern: /^(FIN|IF|3RD)$/i }
  ];

  const columns = standardRounds.map(r => ({
    ...r,
    games: games
      .filter((g: any) => r.pattern.test(g.bracketCode || ''))
      .sort((a: any, b: any) => {
        if (/^FIN/i.test(a.bracketCode) && /^3RD/i.test(b.bracketCode)) return -1;
        if (/^3RD/i.test(a.bracketCode) && /^FIN/i.test(b.bracketCode)) return 1;
        return (a.bracketCode || '').localeCompare(b.bracketCode || '');
      })
  })).filter(c => c.games.length > 0);

  // Group non-standard codes into individual columns, one per unique round
  // (identified by shared bracketCode prefix). Maintains wizard round order
  // and shows the bracketCode as the column title.
  const matchedIds = new Set(columns.flatMap(c => c.games.map((g: any) => g.id)));
  const custom = games.filter((g: any) => !matchedIds.has(g.id));
  if (custom.length > 0) {
    const byCode: Record<string, any[]> = {};
    custom.forEach((g: any) => {
      const key = g.bracketCode || 'EXTRA';
      if (!byCode[key]) byCode[key] = [];
      byCode[key].push(g);
    });
    Object.entries(byCode).forEach(([code, cGames]) => {
      columns.push({
        title: code,
        pattern: new RegExp(`^${code}$`, 'i'),
        games: cGames
      });
    });
  }
  return columns;
}

function BracketColumns({ columns, onEdit, onDelete, formatDate }: any) {
  const [titles, setTitles] = React.useState<Record<number, string>>(() =>
    Object.fromEntries(columns.map((c: any, i: number) => [i, c.title]))
  );
  return (
    <div style={{
      display: 'flex',
      gap: '2.5rem',
      overflowX: 'auto',
      padding: '1.5rem 0',
      minHeight: '300px',
    }}>
      {columns.map((col: any, idx: number) => (
        <div key={idx} style={{ display: 'flex', flexDirection: 'column', width: '210px', flexShrink: 0 }}>
          <input
            value={titles[idx] ?? col.title}
            onChange={e => setTitles(prev => ({ ...prev, [idx]: e.target.value }))}
            style={{
              textAlign: 'center',
              color: 'var(--logic-lime)',
              fontFamily: 'var(--font-display)',
              fontSize: '0.8rem',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginBottom: '1.5rem',
              opacity: 0.7,
              background: 'transparent',
              border: 'none',
              borderBottom: '1px dashed transparent',
              outline: 'none',
              width: '100%',
              cursor: 'text',
              padding: '2px 4px',
            }}
            onFocus={e => { e.target.style.borderBottomColor = 'rgba(var(--blueprint-blue-rgb),0.4)'; e.target.style.opacity = '1'; }}
            onBlur={e => { e.target.style.borderBottomColor = 'transparent'; e.target.style.opacity = '0.7'; }}
          />

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: col.title === 'Finals' ? 'center' : 'space-around',
            flex: 1,
            gap: col.title === 'Finals' ? '2.5rem' : '1.5rem'
          }}>
            {col.games.map((g: any) => (
              <div key={g.id} style={{ position: 'relative' }}>
                {idx < columns.length - 1 && (
                  <div style={{
                    position: 'absolute', right: '-2.5rem', top: '50%',
                    width: '2.5rem', height: '1px',
                    background: 'var(--blueprint-blue)', opacity: 0.3, zIndex: 0
                  }} />
                )}
                <div className="card" style={{
                  padding: '0.75rem',
                  border: '1px solid var(--white-10)',
                  background: 'rgba(15, 15, 20, 0.98)',
                  backdropFilter: 'blur(20px)',
                  position: 'relative', zIndex: 1,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
                  borderRadius: '10px'
                }}>
                  <div className="flex-between" style={{ marginBottom: '7px' }}>
                    <div style={{
                      fontSize: '0.6rem', fontWeight: 900, color: 'var(--logic-lime)',
                      background: 'rgba(var(--blueprint-blue-rgb), 0.1)', padding: '2px 8px',
                      borderRadius: '4px', border: '1px solid rgba(var(--blueprint-blue-rgb), 0.2)', letterSpacing: '0.02em'
                    }}>{g.bracketCode}</div>
                    <div className="flex gap-1.5">
                      <button className="btn btn-ghost btn-sm" onClick={() => onEdit(g)} title="Edit" style={{
                        height: '24px', width: '24px', padding: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(255,255,255,0.03)'
                      }}><Pencil size={11} /></button>
                      <button className="btn btn-ghost btn-sm text-danger" onClick={() => onDelete(g.id)} title="Delete" style={{
                        height: '24px', width: '24px', padding: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(255,255,255,0.03)'
                      }}><Trash2 size={11} /></button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '28px', fontSize: '0.55rem', fontWeight: 900, color: 'var(--logic-lime)',
                        textAlign: 'center', background: 'rgba(var(--blueprint-blue-rgb), 0.1)', padding: '1px 0',
                        borderRadius: '3px', border: '1px solid rgba(var(--blueprint-blue-rgb), 0.2)', letterSpacing: '0.02em'
                      }}>VIS</div>
                      <div style={{
                        fontWeight: '700', fontSize: '0.85rem', color: '#ffffff',
                        flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>
                        {g.awayPlaceholder || 'TBD'}
                      </div>
                    </div>
                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.03)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '28px', fontSize: '0.55rem', fontWeight: 900, color: 'var(--logic-lime)',
                        textAlign: 'center', background: 'rgba(var(--blueprint-blue-rgb), 0.1)', padding: '1px 0',
                        borderRadius: '3px', border: '1px solid rgba(var(--blueprint-blue-rgb), 0.2)', letterSpacing: '0.02em'
                      }}>HOM</div>
                      <div style={{
                        fontWeight: '700', fontSize: '0.85rem', color: '#ffffff',
                        flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>
                        {g.homePlaceholder || 'TBD'}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '0.4rem',
                    paddingTop: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.05)',
                    fontSize: '0.7rem', color: 'var(--white-40)'
                  }}>
                    <div className="flex items-center" style={{ gap: '5px' }}><Calendar size={10} className="text-primary-light opacity-50" /> {g.date ? formatDate(g.date) : 'TBD'}</div>
                    <div className="flex items-center" style={{ gap: '5px', justifyContent: 'flex-end' }}><Clock size={10} className="text-primary-light opacity-50" /> {g.time ? formatTime(g.time) : 'TBD'}</div>
                    <div className="flex items-center" style={{ gap: '5px', gridColumn: 'span 2' }}><MapPin size={10} className="text-primary-light opacity-50" /> {g.location || 'TBD'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PlayoffBracketView({ games, teams, ageGroup, onEdit, onDelete, getGroupName, formatDate, statusBadge }: any) {
  if (games.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '4rem' }}>
        <Trophy size={48} />
        <p>No playoff games scheduled for this division.</p>
        <p className="text-sm text-muted">Use the Playoff Wizard to generate brackets.</p>
      </div>
    );
  }

  const pools = ageGroup?.pools || [];
  const isSplitMode = hasSplitPoolGames(games, pools);

  if (isSplitMode) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '3rem',
        padding: '2rem 0.75rem',
        background: 'radial-gradient(circle at 50% 50%, rgba(var(--blueprint-blue-rgb), 0.06) 0%, transparent 70%)'
      }}>
        {pools.map((pool: any) => {
          const poolGames = games.filter((g: any) => inferGamePool(g, games, pools) === pool.name);
          if (poolGames.length === 0) return null;
          const columns = buildBracketColumns(poolGames);
          return (
            <div key={pool.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <Trophy size={16} style={{ color: 'var(--logic-lime)' }} />
                <h3 style={{ color: 'var(--logic-lime)', fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
                  {formatPoolName(pool.name)} Playoffs
                </h3>
                <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, var(--blueprint-blue), transparent)' }} />
              </div>
              <BracketColumns columns={columns} onEdit={onEdit} onDelete={onDelete} formatDate={formatDate} />
            </div>
          );
        })}
        {(() => {
          const unassigned = games.filter((g: any) => inferGamePool(g, games, pools) === null);
          if (unassigned.length === 0) return null;
          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <h3 style={{ color: 'var(--white-40)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>Other</h3>
              </div>
              <BracketColumns columns={buildBracketColumns(unassigned)} onEdit={onEdit} onDelete={onDelete} formatDate={formatDate} />
            </div>
          );
        })()}
      </div>
    );
  }

  // Standard flat layout
  const columns = buildBracketColumns(games);
  return (
    <div style={{
      display: 'flex',
      gap: '2.5rem',
      overflowX: 'auto',
      padding: '2rem 0.75rem',
      minHeight: '500px',
      background: 'radial-gradient(circle at 50% 50%, rgba(var(--blueprint-blue-rgb), 0.06) 0%, transparent 70%)'
    }}>
      <BracketColumns columns={columns} onEdit={onEdit} onDelete={onDelete} formatDate={formatDate} />
    </div>
  );
}
