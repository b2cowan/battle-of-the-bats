'use client';
import { useState, useEffect } from 'react';
import { Tag, Plus, Pencil, Trash2, X, Check, ChevronUp, ChevronDown, Trophy } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import type { Division, DivisionSettings } from '@/lib/types';
import { TournamentAdminHeader } from '@/components/admin/tournament';
import TieBreakerEditor from '@/components/admin/TieBreakerEditor';
import FieldHint from '@/components/help/FieldHint';
import { normalizeTieBreakers, clampRunDiffCap, DEFAULT_TIE_BREAKERS, BREAKER_LABELS, type TieBreaker } from '@/lib/tie-breakers';

interface OrgMemberOption {
  id: string;
  email: string;
  displayName: string | null;
  title: string | null;
  role: string;
}
import styles from './admin-page.module.css';

type ModalMode = 'add' | 'edit' | null;
type DivisionFormPayload = {
  tournamentId: string;
  name: string;
  minAge: number | null;
  maxAge: number | null;
  order: number;
  contactMemberId?: string | null;
  capacity?: number;
  poolCount: number;
  poolNames?: string;
  requiresPoolSelection: boolean;
  playoffConfig: NonNullable<Division['playoffConfig']>;
  depositAmount?: number | null;
  depositDueDate?: string | null;
  totalFeeAmount?: number | null;
  totalFeeDueDate?: string | null;
  settings: DivisionSettings;
};

/** Format an age range pair into a compact readable string. */
function formatAgeRange(min: number | null | undefined, max: number | null | undefined): string {
  if (min == null && max == null) return 'Open';
  if (min == null) return `Any–${max}`;
  if (max == null) return `${min}+`;
  return `${min}–${max}`;
}

async function loadDivisionState(tournamentId?: string, orgSlug?: string) {
  if (!tournamentId) return { groups: [] as Division[], orgMembers: [] as OrgMemberOption[] };
  const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const [groupsRes, membersRes] = await Promise.all([
    fetch(`/api/admin/divisions?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`),
    fetch(`/api/admin/members${orgQuery}`),
  ]);
  const groups: Division[] = groupsRes.ok ? await groupsRes.json() : [];
  const allMembers: OrgMemberOption[] = membersRes.ok ? await membersRes.json() : [];
  const orgMembers = allMembers
    .filter(m => ['owner', 'admin', 'staff'].includes(m.role))
    .sort((a, b) => {
      const roleOrder: Record<string, number> = { owner: 0, admin: 1, staff: 2 };
      const roleDiff = (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9);
      if (roleDiff !== 0) return roleDiff;
      return (a.displayName ?? a.email).localeCompare(b.displayName ?? b.email);
    });
  return { groups, orgMembers };
}

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function DivisionsPage() {
  const { currentTournament, isLocked } = useTournament();
  const { currentOrg } = useOrg();
  usePageTitle('Divisions');
  const [groups, setGroups] = useState<Division[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalMode>(null);
  const [editing, setEditing] = useState<Division | null>(null);
  const [form, setForm] = useState({
    name: '', minAge: '', maxAge: '', order: '', contactMemberId: '',
    capacity: '', poolCount: '0', poolNames: '',
    requiresPoolSelection: false, usePools: false,
    tieBreakers: [...DEFAULT_TIE_BREAKERS] as TieBreaker[],
    runDiffCap: '',
    depositAmount: '', depositDueDate: '', totalFeeAmount: '', totalFeeDueDate: '',
    overrideGameTiming: false,
    gameDurationMinutes: '',
    bufferMinutes: '',
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  async function refresh() {
    const next = await loadDivisionState(currentTournament?.id, currentOrg?.slug);
    setGroups(next.groups);
    setOrgMembers(next.orgMembers);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const next = await loadDivisionState(currentTournament?.id, currentOrg?.slug);
      if (cancelled) return;
      setGroups(next.groups);
      setOrgMembers(next.orgMembers);
      setLoading(false);
    }

    void load();
    return () => { cancelled = true; };
  }, [currentTournament?.id, currentOrg?.slug]);

  function openAdd() {
    setForm({
      name: '', minAge: '', maxAge: '', order: String(groups.length + 1),
      contactMemberId: '', capacity: '', poolCount: '0', poolNames: '',
      requiresPoolSelection: false, usePools: false,
      tieBreakers: [...DEFAULT_TIE_BREAKERS] as TieBreaker[],
      runDiffCap: '',
      depositAmount: '', depositDueDate: '', totalFeeAmount: '', totalFeeDueDate: '',
      overrideGameTiming: false, gameDurationMinutes: '', bufferMinutes: '',
    });
    setEditing(null);
    setModal('add');
    setAdvancedOpen(false);
  }

  function openEdit(g: Division) {
    const hasTimingOverride = typeof g.settings?.game_duration_minutes === 'number' || typeof g.settings?.buffer_minutes === 'number';
    setForm({
      name: g.name,
      minAge: g.minAge === null || g.minAge === undefined ? '' : String(g.minAge),
      maxAge: g.maxAge === null || g.maxAge === undefined ? '' : String(g.maxAge),
      order: String(g.order), contactMemberId: g.contactMemberId || '',
      capacity: g.capacity ? String(g.capacity) : '',
      poolCount: String(g.poolCount || 0), poolNames: g.poolNames || '',
      requiresPoolSelection: !!g.requiresPoolSelection,
      usePools: (g.poolCount || 0) >= 2,
      tieBreakers: normalizeTieBreakers(g.playoffConfig?.tieBreakers),
      runDiffCap: typeof g.playoffConfig?.maxRunDiffPerGame === 'number' && g.playoffConfig.maxRunDiffPerGame > 0
        ? String(g.playoffConfig.maxRunDiffPerGame) : '',
      depositAmount: g.depositAmount != null ? String(g.depositAmount) : '',
      depositDueDate: g.depositDueDate ?? '',
      totalFeeAmount: g.totalFeeAmount != null ? String(g.totalFeeAmount) : '',
      totalFeeDueDate: g.totalFeeDueDate ?? '',
      overrideGameTiming: hasTimingOverride,
      gameDurationMinutes: g.settings?.game_duration_minutes != null ? String(g.settings.game_duration_minutes) : '',
      bufferMinutes: g.settings?.buffer_minutes != null ? String(g.settings.buffer_minutes) : '',
    });
    // Auto-expand advanced accordion if any overrides are present
    const hasFeeOverride = g.depositAmount != null || g.totalFeeAmount != null;
    const tournamentTBs = normalizeTieBreakers(currentTournament?.settings?.tie_breakers);
    const divTBs = normalizeTieBreakers(g.playoffConfig?.tieBreakers);
    const hasTBOverride = JSON.stringify(divTBs) !== JSON.stringify(tournamentTBs);
    const hasCapOverride = typeof g.playoffConfig?.maxRunDiffPerGame === 'number' && g.playoffConfig.maxRunDiffPerGame > 0;
    setAdvancedOpen(!!g.contactMemberId || hasTimingOverride || hasFeeOverride || hasTBOverride || hasCapOverride);

    setEditing(g);
    setModal('edit');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentTournament) return;
    const minAge = form.minAge.trim() ? Number(form.minAge) : null;
    const maxAge = form.maxAge.trim() ? Number(form.maxAge) : null;
    if (minAge !== null && (!Number.isFinite(minAge) || minAge < 0)) {
      alert('Age limits must be positive numbers, or left blank for an open-ended range.');
      return;
    }
    if (maxAge !== null && (!Number.isFinite(maxAge) || maxAge < 0)) {
      alert('Age limits must be positive numbers, or left blank for an open-ended range.');
      return;
    }
    if (minAge !== null && maxAge !== null && minAge > maxAge) {
      alert('Minimum age cannot be greater than maximum age.');
      return;
    }
    const divSettings: DivisionSettings = {};
    const submittedGameTimingScope = currentTournament?.settings?.game_timing_scope ?? null;
    const gd = parseInt(form.gameDurationMinutes, 10);
    const buf = parseInt(form.bufferMinutes, 10);
    if (form.overrideGameTiming || submittedGameTimingScope === 'per_division') {
      if (!isNaN(gd) && gd > 0) divSettings.game_duration_minutes = gd;
      if (!isNaN(buf) && buf >= 0) divSettings.buffer_minutes = buf;
    }

    const data: DivisionFormPayload = {
      tournamentId: currentTournament.id,
      name: form.name.trim(),
      minAge,
      maxAge,
      // On Add, auto-assign next order; on Edit, use the form value
      order: modal === 'add' ? groups.length + 1 : Number(form.order),
      contactMemberId: form.contactMemberId || null,
      capacity: form.capacity ? Number(form.capacity) : undefined,
      poolCount: Number(form.poolCount),
      poolNames: form.poolNames.trim() || undefined,
      requiresPoolSelection: form.requiresPoolSelection,
      playoffConfig: {
        ...(editing?.playoffConfig || { type: 'single', crossover: 'reseed', hasThirdPlace: false, teamsQualifying: 4 }),
        tieBreakers: normalizeTieBreakers(form.tieBreakers),
        // null = inherit the tournament-level cap (TournamentSettings.max_run_diff_per_game)
        maxRunDiffPerGame: clampRunDiffCap(form.runDiffCap),
      },
      depositAmount:  form.depositAmount  ? Number(form.depositAmount)  : null,
      depositDueDate: form.depositDueDate || null,
      totalFeeAmount: form.totalFeeAmount ? Number(form.totalFeeAmount) : null,
      totalFeeDueDate: form.totalFeeDueDate || null,
      settings: divSettings,
    };

    try {
      const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
      const res = await fetch(`/api/admin/divisions${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: modal === 'add' ? 'save' : 'update',
          id: editing?.id,
          data
        })
      });
      const resData = await res.json() as { error?: string };
      if (!res.ok) throw new Error(resData.error || 'Failed to save');

      setModal(null);
      refresh();
    } catch (err: unknown) {
      alert('Error saving: ' + getErrorMessage(err, 'Unknown error'));
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
      const res = await fetch(`/api/admin/divisions${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: deleteId })
      });
      if (!res.ok) throw new Error('Failed to delete');
      setDeleteId(null);
      refresh();
    } catch (err: unknown) {
      alert('Error deleting: ' + getErrorMessage(err, 'Unknown error'));
    }
  }


  return (
    <div className={styles.page}>
      <TournamentAdminHeader
        icon={<Tag size={20} />}
        title="Divisions"
        subtitle="Manage tournament divisions and registration groups"
        locked={isLocked}
        mobileActionsInline
        help={{
          module: 'tournaments',
          sectionIds: ['divisions-and-pools'],
          fullGuideHref: currentOrg ? `/${currentOrg.slug}/admin/help/tournaments#divisions-and-pools` : undefined,
        }}
        actions={!isLocked ? (
          <button className={`btn btn-lime btn-data ${styles.addDivisionBtn}`} onClick={openAdd} id="division-add-btn" disabled={!currentTournament}>
            <Plus size={16} />
            <span className={styles.addDivisionLabel}> Add Division</span>
          </button>
        ) : undefined}
      />

      {loading ? (
        <div className={styles.loadingState}>
          <span className={styles.loadingDot} />
          <span className={styles.loadingDot} />
          <span className={styles.loadingDot} />
        </div>
      ) : groups.length === 0 ? (
        <div className={`empty-state ${styles.emptyState}`}>
          <div className="empty-icon"><Tag size={32} /></div>
          <h4 className="display-sm">No divisions yet</h4>
          <p className="text-muted">Add a division for each age group or category in this tournament.</p>
          {!isLocked && (
            <button className="btn btn-lime" onClick={openAdd} disabled={!currentTournament}>
              <Plus size={16} /> Add Division
            </button>
          )}
        </div>
      ) : (
        <div className={styles.divisionBoard}>
          {groups.map(g => {
            const accepted = g.acceptedCount ?? 0;
            const cap = g.capacity ?? 0;
            const hasCap = cap > 0;
            const pct = hasCap ? Math.min(1, accepted / cap) : 0;
            const fill = !hasCap ? 'none'
              : accepted === 0 ? 'empty'
              : accepted >= cap ? 'full'
              : pct >= 0.8 ? 'almost'
              : 'filling';
            const fillLabel = !hasCap ? `${accepted} team${accepted === 1 ? '' : 's'}`
              : fill === 'full' ? 'Full'
              : fill === 'almost' ? 'Almost full'
              : fill === 'empty' ? 'No teams yet'
              : 'Filling';
            return (
              <div key={g.id} className={styles.divisionCard} data-fill={fill}>
                <div className={styles.divisionCardHead}>
                  <span className={styles.divisionName}>{g.name}</span>
                  {g.isClosed
                    ? <span className="badge badge-danger">Closed</span>
                    : <span className="badge badge-success">Open</span>}
                </div>
                <div className={styles.divisionCardAge}>{formatAgeRange(g.minAge, g.maxAge)}</div>

                <div className={styles.gaugeRow}>
                  <div className={styles.gaugeTrack}>
                    <div
                      className={styles.gaugeFill}
                      data-fill={fill}
                      style={{ width: hasCap ? `${pct * 100}%` : '0%' }}
                    />
                  </div>
                  <span className={styles.gaugeValue}>{hasCap ? `${accepted} / ${cap}` : accepted}</span>
                </div>
                <div className={styles.gaugeLabel} data-fill={fill}>{fillLabel}</div>

                <div className={styles.divisionCardFoot}>
                  {(g.poolCount || 0) >= 2 && g.pools && g.pools.length > 0 ? (
                    <div className={styles.poolChips}>
                      {g.pools.map(p => (
                        <span key={p.id} className={styles.poolChip}>{p.name}</span>
                      ))}
                    </div>
                  ) : (
                    <span className={styles.mutedCell}>No pools</span>
                  )}
                  {!isLocked && (
                    <div className={styles.rowActions}>
                      <button className="btn btn-ghost btn-data" onClick={() => openEdit(g)} id={`edit-division-${g.id}`}><Pencil size={13} /></button>
                      <button className="btn btn-danger btn-data" onClick={() => setDeleteId(g.id)} id={`delete-division-${g.id}`}><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal === 'add' ? 'Add Division' : 'Edit Division'}</h3>
              <button className="btn btn-ghost btn-data" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              {/* ── Section 1: Core Setup ── */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Division Name *</label>
                <input className="form-input" placeholder="e.g. U13" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>

              {/* Age Range — compact inline */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Age Range</label>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.65rem', color: 'var(--white-40)' }}>Min</label>
                    <input className="form-input" type="number" value={form.minAge}
                      onChange={e => setForm(f => ({ ...f, minAge: e.target.value }))} placeholder="Any" style={{ width: '80px' }} />
                  </div>
                  <span style={{ color: 'var(--white-30)', fontFamily: 'var(--font-data)', paddingBottom: '8px', flexShrink: 0 }}>–</span>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.65rem', color: 'var(--white-40)' }}>Max</label>
                    <input className="form-input" type="number" value={form.maxAge}
                      onChange={e => setForm(f => ({ ...f, maxAge: e.target.value }))} placeholder="Any" style={{ width: '80px' }} />
                  </div>
                </div>
              </div>

              {/* Capacity */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Capacity</label>
                <input className="form-input" type="number" placeholder="e.g. 8" value={form.capacity}
                  onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} style={{ maxWidth: '110px' }} />
                <p style={{ fontSize: '0.72rem', color: 'var(--white-30)', marginTop: '0.3rem', lineHeight: 1.4 }}>
                  No limit if blank. Registration status is managed from the Registrations page.
                </p>
              </div>

              {/* ── Pools ── */}
              <div className="form-group" style={{ marginBottom: '1.25rem', background: 'var(--white-5)', padding: '0.75rem', borderRadius: '2px', border: '1px solid var(--border-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: form.usePools ? '1rem' : 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.usePools} onChange={e => setForm(f => ({ ...f, usePools: e.target.checked, poolCount: e.target.checked ? (Number(f.poolCount) < 2 ? '2' : f.poolCount) : '0' }))} />
                    <span style={{ fontWeight: 600 }}>Enable pools</span>
                  </label>
                  {form.usePools && (
                    <div className="subCheck">
                      <label htmlFor="div-pool-selfselect" style={{ fontSize: '0.7rem', color: 'var(--white-30)', textTransform: 'uppercase', fontWeight: 800 }}>Self-select pool:</label>
                      <input id="div-pool-selfselect" type="checkbox" aria-describedby="div-pool-selfselect-hint" checked={form.requiresPoolSelection} onChange={e => setForm(f => ({ ...f, requiresPoolSelection: e.target.checked }))} />
                    </div>
                  )}
                </div>
                {form.usePools && (
                  <FieldHint id="div-pool-selfselect-hint">
                    When on, teams pick their own pool during registration. When off, you assign pools yourself from the Registrations page.
                  </FieldHint>
                )}
                {form.usePools && (
                  <>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="div-pool-count" style={{ fontSize: '0.65rem' }}>Count</label>
                      <input id="div-pool-count" className="form-input" type="number" min="2" max="10" value={form.poolCount}
                        aria-describedby="div-pool-count-hint"
                        onChange={e => setForm(f => ({ ...f, poolCount: e.target.value }))} style={{ width: '70px' }} />
                    </div>
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
                      {Array.from({ length: Number(form.poolCount) || 2 }).map((_, i) => {
                        const names = form.poolNames.split(',').map(n => n.trim());
                        const currentName = names[i] || '';
                        const defaultChar = String.fromCharCode(65 + i);
                        return (
                          <div key={i} className="form-group">
                            <label className="form-label" style={{ fontSize: '0.65rem' }}>{defaultChar} Label</label>
                            <input
                              className="form-input"
                              placeholder="e.g. Gold"
                              value={currentName}
                              style={{ height: '32px', fontSize: '0.85rem' }}
                              onChange={e => {
                                const newNames = [...names];
                                while (newNames.length < (i + 1)) newNames.push('');
                                newNames[i] = e.target.value;
                                setForm(f => ({ ...f, poolNames: newNames.join(',') }));
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <FieldHint id="div-pool-count-hint">
                    Splits the division into this many round-robin pools (2–10). Each pool gets its own name, and teams are spread across them.
                  </FieldHint>
                  </>
                )}
              </div>

              {/* ── Division Contact ── */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">
                  Division Contact
                  <span style={{ marginLeft: '0.4rem', fontWeight: 400, color: 'var(--white-40)', fontSize: '0.72rem', textTransform: 'none', letterSpacing: 0 }}>Optional</span>
                </label>
                <select className="form-select" value={form.contactMemberId} onChange={e => setForm(f => ({ ...f, contactMemberId: e.target.value }))}>
                  <option value="">Default (tournament contact)</option>
                  {orgMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.displayName ?? m.email}{m.title ? ` — ${m.title}` : ''} ({m.role})
                    </option>
                  ))}
                </select>
                {form.contactMemberId ? (() => {
                  const picked = orgMembers.find(m => m.id === form.contactMemberId);
                  return picked ? (
                    <p className="form-help" style={{ fontSize: '0.72rem', color: 'var(--white-40)', marginTop: '0.25rem' }}>
                      Notifications for this division will go to <strong>{picked.email}</strong>
                    </p>
                  ) : null;
                })() : (
                  <p className="form-help" style={{ fontSize: '0.72rem', color: 'var(--white-30)', marginTop: '0.25rem' }}>
                    Leave blank to use the tournament&apos;s default contact.
                  </p>
                )}
              </div>

              {/* ── Division Overrides Accordion (only shown when tournament has per-division or allow_override scopes) ── */}
              {(() => {
                const feeScope = currentTournament?.settings?.fee_scope ?? null;
                const gameTimingScope = currentTournament?.settings?.game_timing_scope ?? null;
                const tieBreakerScope = currentTournament?.settings?.tie_breaker_scope ?? null;
                const tTieBreakers = normalizeTieBreakers(currentTournament?.settings?.tie_breakers);
                const tGameDuration = currentTournament?.settings?.game_duration_minutes ?? 90;
                const tBufferMinutes = currentTournament?.settings?.buffer_minutes ?? 15;

                const showOverrides =
                  (feeScope !== 'tournament' && feeScope !== 'free') ||
                  gameTimingScope !== 'tournament' ||
                  tieBreakerScope !== 'tournament';

                if (!showOverrides) return null;

                const overrideCount = [
                  form.overrideGameTiming,
                  !!(form.depositAmount || form.depositDueDate || form.totalFeeAmount || form.totalFeeDueDate),
                  tieBreakerScope === 'allow_override' && JSON.stringify(form.tieBreakers) !== JSON.stringify(tTieBreakers),
                ].filter(Boolean).length;

                return (
                  <>
                    <button
                      type="button"
                      onClick={() => setAdvancedOpen(o => !o)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', padding: '0.65rem 0.9rem',
                        background: 'var(--white-03)', border: '1px solid var(--border-2)',
                        borderRadius: advancedOpen ? '2px 2px 0 0' : '2px',
                        cursor: 'pointer', color: 'inherit', marginBottom: advancedOpen ? 0 : '1.5rem',
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white-60)' }}>
                        Division Overrides
                        {!advancedOpen && overrideCount > 0 && (
                          <span style={{ marginLeft: '0.5rem', fontWeight: 600, fontSize: '0.75rem', color: 'var(--logic-lime)', textTransform: 'none', letterSpacing: 0 }}>
                            ({overrideCount} active)
                          </span>
                        )}
                      </span>
                      {advancedOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>

                    {advancedOpen && (
                      <div style={{ border: '1px solid var(--border-2)', borderTop: 0, padding: '1.25rem 1rem', marginBottom: '1.5rem', borderRadius: '0 0 2px 2px', background: 'var(--white-02)' }}>

                        {/* Fee Schedule — conditional on fee_scope */}
                        {feeScope !== 'tournament' && feeScope !== 'free' && (
                          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label className="form-label" style={{ marginBottom: '0.35rem', display: 'block' }}>
                              Fee Schedule
                              {feeScope === 'per_division' && <span style={{ marginLeft: '0.35rem', color: 'var(--danger-light)', fontSize: '0.75rem' }}>Required</span>}
                              {feeScope === 'allow_override' && <span style={{ marginLeft: '0.35rem', color: 'var(--white-40)', fontSize: '0.75rem' }}>Optional override</span>}
                            </label>
                            {feeScope === 'allow_override' && (
                              <p style={{ fontSize: '0.72rem', color: 'var(--white-30)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                                Leave blank to inherit from tournament defaults.
                              </p>
                            )}
                            {feeScope === 'per_division' && (
                              <p style={{ fontSize: '0.72rem', color: 'var(--white-30)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                                Fees must be set individually for each division in this tournament.
                              </p>
                            )}
                            {!feeScope && (
                              <p style={{ fontSize: '0.72rem', color: 'var(--white-30)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                                Configure fee scope in Event Settings to control how fees apply across divisions.
                              </p>
                            )}
                            <div className="form-row form-row-2">
                              <div className="form-group">
                                <label className="form-label">Deposit Amount ($)</label>
                                <input className="form-input" type="number" min="0" step="0.01" placeholder="e.g. 200"
                                  value={form.depositAmount} onChange={e => setForm(f => ({ ...f, depositAmount: e.target.value }))} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Deposit Due Date</label>
                                <input className="form-input" type="date" value={form.depositDueDate} onChange={e => setForm(f => ({ ...f, depositDueDate: e.target.value }))} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Total Fee ($)</label>
                                <input className="form-input" type="number" min="0" step="0.01" placeholder="e.g. 500"
                                  value={form.totalFeeAmount}
                                  onChange={e => setForm(f => ({ ...f, totalFeeAmount: e.target.value }))}
                                  required={feeScope === 'per_division'} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Total Fee Due Date</label>
                                <input className="form-input" type="date" value={form.totalFeeDueDate} onChange={e => setForm(f => ({ ...f, totalFeeDueDate: e.target.value }))} />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Game Timing — conditional on game_timing_scope */}
                        {gameTimingScope !== 'tournament' && (
                          <div className="form-group" style={{ marginBottom: '1.5rem', borderTop: '1px solid var(--border-2)', paddingTop: '1.25rem' }}>
                            {gameTimingScope === 'per_division' ? (
                              <>
                                <label className="form-label" style={{ marginBottom: '0.35rem', display: 'block' }}>
                                  Game Timing <span style={{ color: 'var(--danger-light)', fontSize: '0.75rem' }}>Required</span>
                                </label>
                                <p style={{ fontSize: '0.72rem', color: 'var(--white-30)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                                  Game timing must be set for each division in this tournament.
                                </p>
                                <div className="form-row form-row-2">
                                  <div className="form-group">
                                    <label className="form-label">Game Duration (minutes)</label>
                                    <input className="form-input" type="number" min="1" max="600" step="5"
                                      placeholder="e.g. 90" value={form.gameDurationMinutes}
                                      onChange={e => setForm(f => ({ ...f, gameDurationMinutes: e.target.value }))} required />
                                  </div>
                                  <div className="form-group">
                                    <label className="form-label">Buffer Between Games (minutes)</label>
                                    <input className="form-input" type="number" min="0" max="120" step="5"
                                      placeholder="e.g. 15" value={form.bufferMinutes}
                                      onChange={e => setForm(f => ({ ...f, bufferMinutes: e.target.value }))} />
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
                                  <input type="checkbox" checked={form.overrideGameTiming}
                                    onChange={e => setForm(f => ({ ...f, overrideGameTiming: e.target.checked, gameDurationMinutes: e.target.checked ? f.gameDurationMinutes : '', bufferMinutes: e.target.checked ? f.bufferMinutes : '' }))} />
                                  <span style={{ fontWeight: 600 }}>Override Game Timing for this Division</span>
                                  {gameTimingScope === 'allow_override' && <span style={{ fontSize: '0.72rem', color: 'var(--white-40)' }}>Optional</span>}
                                </label>
                                {form.overrideGameTiming ? (
                                  <div className="form-row form-row-2" style={{ marginTop: '0.75rem' }}>
                                    <div className="form-group">
                                      <label className="form-label">Game Duration (minutes)</label>
                                      <input className="form-input" type="number" min="1" max="600" step="5"
                                        placeholder={String(tGameDuration)} value={form.gameDurationMinutes}
                                        onChange={e => setForm(f => ({ ...f, gameDurationMinutes: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                      <label className="form-label">Buffer Between Games (minutes)</label>
                                      <input className="form-input" type="number" min="0" max="120" step="5"
                                        placeholder={String(tBufferMinutes)} value={form.bufferMinutes}
                                        onChange={e => setForm(f => ({ ...f, bufferMinutes: e.target.value }))} />
                                    </div>
                                  </div>
                                ) : (
                                  <p style={{ fontSize: '0.72rem', color: 'var(--white-30)', marginTop: '0.35rem', lineHeight: 1.5 }}>
                                    Inheriting tournament default: {tGameDuration} min games, {tBufferMinutes} min buffer.
                                    {gameTimingScope === 'allow_override' && ' Check above to override for this division.'}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {/* Tie-Breakers — conditional on tie_breaker_scope */}
                        {tieBreakerScope !== 'tournament' && (
                          <div className="form-group" style={{ borderTop: '1px solid var(--border-2)', paddingTop: '1.25rem' }}>
                            <label className="form-label" style={{ marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Trophy size={14} /> Standing Tie-Breaker Hierarchy
                              {tieBreakerScope === 'per_division' && <span style={{ color: 'var(--danger-light)', fontSize: '0.75rem' }}>Required</span>}
                            </label>
                            {tieBreakerScope === 'allow_override' && (
                              <p style={{ fontSize: '0.72rem', color: 'var(--white-30)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                                Tournament default: {tTieBreakers.map(b => BREAKER_LABELS[b]).join(' → ')}. Reorder below to override for this division.
                              </p>
                            )}
                            {tieBreakerScope === 'per_division' && (
                              <p style={{ fontSize: '0.72rem', color: 'var(--white-30)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                                Set the tie-breaker order for this division&apos;s standings and playoff seeding.
                              </p>
                            )}
                            {!tieBreakerScope && (
                              <p style={{ fontSize: '0.72rem', color: 'var(--white-30)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                                Configure tie-breaker scope in Event Settings to control how standings are broken.
                              </p>
                            )}
                            <TieBreakerEditor
                              idPrefix="division"
                              value={form.tieBreakers}
                              onChange={next => setForm(f => ({ ...f, tieBreakers: next }))}
                              cap={form.runDiffCap}
                              onCapChange={raw => setForm(f => ({ ...f, runDiffCap: raw }))}
                              capHelp="Blank = inherit the tournament default. Caps the Run Diff column only."
                            />
                            {tieBreakerScope === 'allow_override' && JSON.stringify(form.tieBreakers) !== JSON.stringify(tTieBreakers) && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-data"
                                style={{ marginTop: '0.5rem', fontSize: '0.72rem' }}
                                onClick={() => setForm(f => ({ ...f, tieBreakers: [...tTieBreakers] }))}
                              >
                                Reset to tournament default
                              </button>
                            )}
                          </div>
                        )}

                      </div>
                    )}
                  </>
                );
              })()}

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost btn-data" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-lime btn-data" id="division-save-btn"><Check size={14} /> Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Division?</h3>
              <button className="btn btn-ghost btn-data" onClick={() => setDeleteId(null)}><X size={16} /></button>
            </div>
            <p style={{ color: 'var(--white-60)', marginBottom: '0.5rem' }}>
              This will permanently delete this division. Teams, games, and results in this division will remain but lose their division link.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost btn-data" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger btn-data" onClick={handleDelete} id="confirm-delete-division"><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
