'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { X, Plus, Users, Shuffle, Swords, Trash2, Pencil, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useOrg } from '@/lib/org-context';
import { houseLeagueTeamCap } from '@/lib/free-floor';
import { LeagueUpgradeCta } from '@/components/admin/LeagueCapUpgrade';
import { hasCapability } from '@/lib/roles';
import FeedbackModal from '@/components/FeedbackModal';
import HelpCallout from '@/components/help/HelpCallout';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
} from '@/lib/export';
import ExportMenu from '@/components/admin/ExportMenu';
import styles from '../../../house-league.module.css';
import type { LeagueDivision, LeagueTeam, LeagueRegistration, LeagueDraftState } from '@/lib/types';

// ── Export definition ─────────────────────────────────────────────────────────

const TEAMS_EXPORT_COLS: ExportColumnDef[] = [
  { label: 'Team Name',    key: 'teamName',    format: 'text'   },
  { label: 'Division',     key: 'division',    format: 'text'   },
  { label: 'Coach',        key: 'coachName',   format: 'text'   },
  { label: 'Player Count', key: 'playerCount', format: 'number' },
];

// ── Types ──────────────────────────────────────────────────────────────────────

interface SeasonInfo { id: string; name: string; }

interface FeedbackState {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'success' | 'danger' | 'info';
}

interface EditTeamForm { name: string; color: string; coachName: string; }

// ── Helpers ────────────────────────────────────────────────────────────────────

function playerLabel(r: LeagueRegistration) {
  return `${r.playerFirstName} ${r.playerLastName}`;
}

function playerMeta(r: LeagueRegistration) {
  const parts: string[] = [];
  if (r.playerPositionPref) parts.push(r.playerPositionPref);
  if (r.playerJerseyPref) parts.push(`#${r.playerJerseyPref}`);
  if (r.playerDateOfBirth) {
    const age = new Date().getFullYear() - new Date(r.playerDateOfBirth).getFullYear();
    parts.push(`Age ${age}`);
  }
  return parts.join(' · ');
}

const BTN_PRIMARY: React.CSSProperties = {
  background: 'var(--logic-lime)',
  color: '#1a1f2e',
  border: 'none',
  borderRadius: '2px',
  padding: '0.4rem 0.85rem',
  fontSize: '0.82rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const BTN_SECONDARY: React.CSSProperties = {
  background: 'var(--white-5)',
  color: 'var(--white-70)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '2px',
  padding: '0.4rem 0.85rem',
  fontSize: '0.82rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const BTN_DANGER: React.CSSProperties = {
  background: 'rgba(var(--danger-rgb),0.1)',
  color: '#f87171',
  border: '1px solid rgba(var(--danger-rgb),0.25)',
  borderRadius: '2px',
  padding: '0.4rem 0.85rem',
  fontSize: '0.82rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

// ── DnD sub-components ────────────────────────────────────────────────────────

function DraggableCard({ reg, disabled }: { reg: LeagueRegistration; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: reg.id,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      className={`${styles.playerCard} ${isDragging ? styles.playerCardDragging : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className={styles.playerName}>{playerLabel(reg)}</div>
      {playerMeta(reg) && <div className={styles.playerMeta}>{playerMeta(reg)}</div>}
    </div>
  );
}

function CardOverlay({ reg }: { reg: LeagueRegistration }) {
  return (
    <div className={styles.playerCardOverlay}>
      <div className={styles.playerName}>{playerLabel(reg)}</div>
      {playerMeta(reg) && <div className={styles.playerMeta}>{playerMeta(reg)}</div>}
    </div>
  );
}

function DroppablePool({ children, isOver }: { children: React.ReactNode; isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id: 'pool' });
  return (
    <div
      ref={setNodeRef}
      className={`${styles.poolDropZone} ${isOver ? styles.poolDropZoneOver : ''}`}
    >
      {children}
    </div>
  );
}

function DroppableTeamColumn({
  team,
  players,
  canManage,
  onEdit,
  onDelete,
}: {
  team: LeagueTeam;
  players: LeagueRegistration[];
  canManage: boolean;
  onEdit: (team: LeagueTeam) => void;
  onDelete: (team: LeagueTeam) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: team.id });

  return (
    <div
      ref={setNodeRef}
      className={`${styles.teamColumn} ${isOver ? styles.teamColumnOver : ''}`}
    >
      <div className={styles.teamColumnHeader}>
        {team.color && (
          <div
            className={styles.teamColorDot}
            style={{ background: team.color }}
          />
        )}
        <span className={styles.teamColumnName} title={team.name}>{team.name}</span>
        <span className={styles.teamColumnCount}>{players.length}</span>
        {canManage && (
          <div className={styles.teamColumnActions}>
            <button
              className={styles.iconBtn}
              title="Edit team"
              onClick={() => onEdit(team)}
            >
              <Pencil size={12} />
            </button>
            <button
              className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
              title="Delete team"
              onClick={() => onDelete(team)}
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
      <div className={styles.teamColumnBody}>
        {players.length === 0 && (
          <div className={styles.teamEmptySlot}>Drop players here</div>
        )}
        {players.map(r => (
          <DraggableCard key={r.id} reg={r} disabled={!canManage} />
        ))}
      </div>
    </div>
  );
}

// ── Create Teams Modal ────────────────────────────────────────────────────────

function CreateTeamsModal({
  divisionName,
  remaining,
  onClose,
  onSave,
  orgId,
}: {
  divisionName: string;
  /** Teams still allowed under the free-floor cap (Infinity = unlimited / paid plan). */
  remaining: number;
  onClose: () => void;
  onSave: (teams: Array<{ name: string }>) => Promise<void>;
  /** Attribution for the upgrade_intent_clicked event from the at-cap CTA. */
  orgId?: string | null;
}) {
  const unlimited = !Number.isFinite(remaining);
  const maxCreatable = unlimited ? 20 : Math.max(0, Math.min(20, remaining));
  const atCap = maxCreatable === 0;
  const initialCount = Math.min(4, maxCreatable) || 1;
  const [count, setCount] = useState(initialCount);
  const [names, setNames] = useState<string[]>(
    Array.from({ length: initialCount }, (_, i) => `Team ${i + 1}`)
  );
  const [saving, setSaving] = useState(false);

  function handleCountChange(n: number) {
    const clamped = Math.max(1, Math.min(maxCreatable, n));
    setCount(clamped);
    setNames(prev =>
      Array.from({ length: clamped }, (_, i) => prev[i] ?? `Team ${i + 1}`)
    );
  }

  async function handleSubmit() {
    const defs = names.map(n => ({ name: n.trim() })).filter(t => t.name);
    if (!defs.length) return;
    setSaving(true);
    try { await onSave(defs); } finally { setSaving(false); }
  }

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Create Teams — {divisionName}</h2>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={18} /></button>
        </div>

        {atCap ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--data-gray)', lineHeight: 1.5, margin: '0.25rem 0 1rem' }}>
            You&apos;ve reached the 8-team limit on the free League Starter plan. League gives you unlimited teams.
          </p>
        ) : (
          <>
            {!unlimited && (
              <p style={{ fontSize: '0.75rem', color: 'var(--data-gray)', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
                Free League Starter — you can add up to {remaining} more team{remaining !== 1 ? 's' : ''}.
              </p>
            )}
            <div className={styles.field}>
              <label className={styles.label}>Number of teams</label>
              <input
                type="number"
                min={1}
                max={maxCreatable}
                value={count}
                onChange={e => handleCountChange(Number(e.target.value))}
                className={styles.input}
                style={{ width: 100 }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {names.map((name, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--white-35)', width: 20, textAlign: 'right', flexShrink: 0 }}>
                    {i + 1}.
                  </span>
                  <input
                    className={styles.input}
                    value={name}
                    onChange={e => setNames(prev => prev.map((n, j) => j === i ? e.target.value : n))}
                    placeholder={`Team ${i + 1}`}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        <div className={styles.modalFooter}>
          <button style={BTN_SECONDARY} onClick={onClose}>{atCap ? 'Close' : 'Cancel'}</button>
          {atCap ? (
            <LeagueUpgradeCta className="btn btn-lime" orgId={orgId} capHit="league_team" />
          ) : (
            <button style={BTN_PRIMARY} onClick={handleSubmit} disabled={saving}>
              {saving ? 'Creating…' : `Create ${count} Team${count !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Edit Team Modal ───────────────────────────────────────────────────────────

function EditTeamModal({
  team,
  onClose,
  onSave,
}: {
  team: LeagueTeam;
  onClose: () => void;
  onSave: (patch: { name?: string; color?: string | null; coachName?: string | null }) => Promise<void>;
}) {
  const [form, setForm] = useState<EditTeamForm>({
    name: team.name,
    color: team.color ?? '#60a5fa',
    coachName: team.coachName ?? '',
  });
  const [saving, setSaving] = useState(false);

  function set(k: keyof EditTeamForm, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      await onSave({
        name: form.name.trim() || undefined,
        color: form.color || null,
        coachName: form.coachName.trim() || null,
      });
    } finally { setSaving(false); }
  }

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Edit Team</h2>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Team name</label>
          <input className={styles.input} value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label}>Team colour</label>
            <input
              type="color"
              value={form.color}
              onChange={e => set('color', e.target.value)}
              style={{ width: '100%', height: 38, background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '2px', cursor: 'pointer', padding: 2 }}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Coach name</label>
            <input className={styles.input} value={form.coachName} onChange={e => set('coachName', e.target.value)} placeholder="Optional" />
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button style={BTN_SECONDARY} onClick={onClose}>Cancel</button>
          <button style={BTN_PRIMARY} onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Draft Overlay ─────────────────────────────────────────────────────────────

function DraftOverlay({
  draft,
  remainingPlayers,
  teams,
  saving,
  onPick,
  onUndo,
  onFinalize,
  onClose,
}: {
  draft: LeagueDraftState;
  remainingPlayers: LeagueRegistration[];
  teams: LeagueTeam[];
  saving: boolean;
  onPick: (registrationId: string) => Promise<void>;
  onUndo: () => Promise<void>;
  onFinalize: () => Promise<void>;
  onClose: () => void;
}) {
  const teamMap = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);
  const currentTeam = teamMap.get(draft.currentTeamId);
  const allPicked = remainingPlayers.length === 0;

  return (
    <div className={styles.draftOverlay}>
      <div className={styles.draftHeader}>
        <div className={styles.draftTitleGroup}>
          <span className={styles.draftTitle}>Draft Mode</span>
          {!allPicked && (
            <span className={styles.draftPickMeta}>
              Round {draft.round} · Pick {draft.pickNumber} · {currentTeam?.name ?? '…'}&apos;s turn
            </span>
          )}
        </div>
        <button style={BTN_SECONDARY} onClick={onClose}>Exit Draft</button>
      </div>

      <div className={styles.draftPickOrder}>
        {draft.pickOrder.map(tid => (
          <span
            key={tid}
            className={`${styles.draftTeamChip} ${tid === draft.currentTeamId && !allPicked ? styles.draftTeamChipActive : ''}`}
          >
            {teamMap.get(tid)?.name ?? tid}
          </span>
        ))}
      </div>

      <div className={styles.draftBody}>
        {allPicked ? (
          <div className={styles.draftComplete}>
            <div className={styles.draftCompleteTitle}>All players picked!</div>
            <div className={styles.draftCompleteMsg}>
              Click &quot;Finalize Draft&quot; to apply all picks and close the draft.
            </div>
          </div>
        ) : (
          remainingPlayers.map(r => (
            <div key={r.id} className={styles.draftPlayerRow}>
              <div className={styles.draftPlayerInfo}>
                <div className={styles.playerName}>{playerLabel(r)}</div>
                {playerMeta(r) && <div className={styles.playerMeta}>{playerMeta(r)}</div>}
              </div>
              <button
                style={BTN_PRIMARY}
                onClick={() => onPick(r.id)}
                disabled={saving}
              >
                Pick
              </button>
            </div>
          ))
        )}
      </div>

      <div className={styles.draftFooter}>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            style={BTN_SECONDARY}
            onClick={onUndo}
            disabled={saving || draft.picks.length === 0}
          >
            ↩ Undo Last Pick
          </button>
        </div>
        <button
          style={allPicked ? BTN_PRIMARY : { ...BTN_SECONDARY, opacity: 0.5, cursor: 'not-allowed' }}
          onClick={allPicked ? onFinalize : undefined}
          disabled={saving || !allPicked}
          title={!allPicked ? 'All players must be picked before finalizing' : undefined}
        >
          {saving ? 'Finalizing…' : 'Finalize Draft'}
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TeamsPage() {
  const { orgSlug, seasonId } = useParams<{ orgSlug: string; seasonId: string }>();
  const { currentOrg, userRole, userCapabilities } = useOrg();

  const [season, setSeason] = useState<SeasonInfo | null>(null);
  const [divisions, setDivisions] = useState<LeagueDivision[]>([]);
  const [selectedDivId, setSelectedDivId] = useState<string>('');
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [registrations, setRegistrations] = useState<LeagueRegistration[]>([]);
  const [draft, setDraft] = useState<LeagueDraftState | null>(null);
  const [draftPlayers, setDraftPlayers] = useState<LeagueRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTeam, setEditTeam] = useState<LeagueTeam | null>(null);
  const [deleteTeam, setDeleteTeam] = useState<LeagueTeam | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const [showRandomizeConfirm, setShowRandomizeConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({
    isOpen: false, title: '', message: '', type: 'success',
  });

  // DnD
  const [activeReg, setActiveReg] = useState<LeagueRegistration | null>(null);
  const [overPoolId, setOverPoolId] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const canManage = userRole === 'owner' || userRole === 'league_admin';

  const hasAccess = hasCapability(userRole ?? 'staff', userCapabilities ?? null, 'module_house_league');

  // Derived state
  const selectedDiv = divisions.find(d => d.id === selectedDivId);
  const divTeams = teams.filter(t => t.divisionId === selectedDivId);
  // Free-floor (League Starter) team cap. The floor has exactly one division, so the selected
  // division's team count equals the season count the server enforces against. Infinity for paid.
  const teamCap = currentOrg ? houseLeagueTeamCap(currentOrg) : Infinity;
  const remainingTeamSlots = Number.isFinite(teamCap) ? Math.max(0, teamCap - divTeams.length) : Infinity;

  const pool = registrations.filter(r => !r.teamId);
  const filteredPool = pool; // search filtering handled below
  const teamPlayerMap = useMemo(() => {
    const m = new Map<string, LeagueRegistration[]>();
    for (const t of divTeams) m.set(t.id, []);
    for (const r of registrations) {
      if (r.teamId && m.has(r.teamId)) m.get(r.teamId)!.push(r);
    }
    return m;
  }, [divTeams, registrations]);

  const assignedCount = registrations.filter(r => r.teamId).length;

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadSeasonAndDivisions = useCallback(async () => {
    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}`);
    if (!res.ok) return;
    const { season: s, divisions: divs } = await res.json();
    setSeason({ id: s.id, name: s.name });
    setDivisions(divs ?? []);
    if (divs?.length && !selectedDivId) setSelectedDivId(divs[0].id);
  }, [seasonId, selectedDivId]);

  const loadTeamsAndRegs = useCallback(async (divId: string) => {
    const [teamsRes, regsRes, draftRes] = await Promise.all([
      fetch(`/api/admin/house-league/seasons/${seasonId}/teams?divisionId=${divId}`),
      fetch(`/api/admin/house-league/seasons/${seasonId}/registrations?status=active&divisionId=${divId}`),
      fetch(`/api/admin/house-league/seasons/${seasonId}/draft`),
    ]);
    if (teamsRes.ok) {
      const d = await teamsRes.json();
      setTeams(d.teams ?? []);
    }
    if (regsRes.ok) {
      const d = await regsRes.json();
      setRegistrations(d.registrations ?? []);
    }
    if (draftRes.ok) {
      const d = await draftRes.json();
      setDraft(d.draft ?? null);
      setDraftPlayers(d.remainingPlayers ?? []);
    }
  }, [seasonId]);

  useEffect(() => {
    setLoading(true);
    loadSeasonAndDivisions().finally(() => setLoading(false));
  }, [loadSeasonAndDivisions]);

  useEffect(() => {
    if (selectedDivId) loadTeamsAndRegs(selectedDivId);
  }, [selectedDivId, loadTeamsAndRegs]);

  // ── Error helper ────────────────────────────────────────────────────────────

  function showError(title: string, message: string) {
    setFeedback({ isOpen: true, title, message, type: 'danger' });
  }

  // ── Drag & Drop ─────────────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    const reg = registrations.find(r => r.id === event.active.id);
    setActiveReg(reg ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveReg(null);
    setOverPoolId(false);
    const { active, over } = event;
    if (!over) return;

    const registrationId = active.id as string;
    const targetId = over.id as string;
    const reg = registrations.find(r => r.id === registrationId);
    if (!reg) return;

    if (targetId === 'pool') {
      if (!reg.teamId) return; // already in pool
    } else {
      if (reg.teamId === targetId) return; // dropped on same team
    }

    // Optimistic update
    setRegistrations(prev =>
      prev.map(r => r.id === registrationId ? { ...r, teamId: targetId === 'pool' ? null : targetId } : r)
    );

    try {
      const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/placement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          divisionId: selectedDivId,
          registrationId,
          teamId: targetId === 'pool' ? null : targetId,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
    } catch (e: any) {
      // Revert
      setRegistrations(prev =>
        prev.map(r => r.id === registrationId ? { ...r, teamId: reg.teamId } : r)
      );
      showError('Assignment failed', e.message);
    }
  }

  // ── Team actions ────────────────────────────────────────────────────────────

  async function handleCreateTeams(defs: Array<{ name: string }>) {
    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ divisionId: selectedDivId, teams: defs }),
    });
    if (!res.ok) {
      showError('Could not create teams', (await res.json()).error ?? 'Unknown error');
      return;
    }
    setShowCreateModal(false);
    await loadTeamsAndRegs(selectedDivId);
  }

  async function handleEditTeam(patch: { name?: string; color?: string | null; coachName?: string | null }) {
    if (!editTeam) return;
    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/teams/${editTeam.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      showError('Could not update team', (await res.json()).error ?? 'Unknown error');
      return;
    }
    setEditTeam(null);
    await loadTeamsAndRegs(selectedDivId);
  }

  async function handleDeleteTeam(team: LeagueTeam) {
    setSaving(true);
    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/teams/${team.id}`, {
      method: 'DELETE',
    });
    setSaving(false);
    if (!res.ok) {
      showError('Cannot delete team', (await res.json()).error ?? 'Unknown error');
    } else {
      setDeleteTeam(null);
      await loadTeamsAndRegs(selectedDivId);
    }
  }

  // ── Placement actions ───────────────────────────────────────────────────────

  async function handleRandomize() {
    setSaving(true);
    setShowRandomizeConfirm(false);
    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/placement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'randomize', divisionId: selectedDivId }),
    });
    setSaving(false);
    if (!res.ok) {
      showError('Randomize failed', (await res.json()).error ?? 'Unknown error');
    } else {
      await loadTeamsAndRegs(selectedDivId);
    }
  }

  async function handleClearAll() {
    setSaving(true);
    setShowClearConfirm(false);
    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/placement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear', divisionId: selectedDivId }),
    });
    setSaving(false);
    if (!res.ok) {
      showError('Clear failed', (await res.json()).error ?? 'Unknown error');
    } else {
      setDraft(null);
      await loadTeamsAndRegs(selectedDivId);
    }
  }

  // ── Draft actions ───────────────────────────────────────────────────────────

  async function handleStartDraft() {
    if (!divTeams.length) return;
    const pickOrder = divTeams.map(t => t.id);
    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', divisionId: selectedDivId, pickOrder }),
    });
    if (!res.ok) {
      showError('Could not start draft', (await res.json()).error ?? 'Unknown error');
      return;
    }
    const { draft: d, remainingPlayers } = await res.json();
    setDraft(d);
    setDraftPlayers(remainingPlayers);
    setDraftOpen(true);
  }

  async function draftAction(body: Record<string, unknown>) {
    setSaving(true);
    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      showError('Draft error', (await res.json()).error ?? 'Unknown error');
      return;
    }
    const data = await res.json();
    if (data.draft !== undefined) {
      setDraft(data.draft);
      setDraftPlayers(data.remainingPlayers ?? []);
    }
    if (data.ok && body.action === 'finalize') {
      setDraft(null);
      setDraftOpen(false);
      await loadTeamsAndRegs(selectedDivId);
    }
  }

  // ── Export ──────────────────────────────────────────────────────────────────

  function handleExportXLSX() {
    const rows = divTeams.map(t => ({
      teamName:    t.name,
      division:    selectedDiv?.name ?? '',
      coachName:   t.coachName ?? '',
      playerCount: teamPlayerMap.get(t.id)?.length ?? 0,
    }));
    const headers  = serializeHeaders(TEAMS_EXPORT_COLS);
    const data     = serializeRows(rows, TEAMS_EXPORT_COLS);
    const filename = buildFilename(
      { org: currentOrg?.slug, dataset: 'hl-teams', scope: season?.name ?? selectedDiv?.name },
      'xlsx',
    );
    downloadXLSX(filename, headers, data, 'Teams');
  }

  function handleExportCSV() {
    const rows = divTeams.map(t => ({
      teamName:    t.name,
      division:    selectedDiv?.name ?? '',
      coachName:   t.coachName ?? '',
      playerCount: teamPlayerMap.get(t.id)?.length ?? 0,
    }));
    const headers  = serializeHeaders(TEAMS_EXPORT_COLS);
    const data     = serializeRows(rows, TEAMS_EXPORT_COLS);
    const filename = buildFilename(
      { org: currentOrg?.slug, dataset: 'hl-teams', scope: season?.name ?? selectedDiv?.name },
      'csv',
    );
    downloadCSVBlob(filename, generateCSV(headers, data));
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className={styles.muted}>Loading teams…</div>;
  }

  if (!hasAccess) {
    return (
      <div className={styles.accessDenied}>
        <Users size={32} />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have access to the House League module.</p>
      </div>
    );
  }

  const backHref = `/${orgSlug}/admin/house-league/seasons/${seasonId}`;

  return (
    <div className={`${styles.page} ${styles.teamsPage}`}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <Link href={backHref} style={{ color: 'var(--white-40)', display: 'flex', alignItems: 'center' }}>
            <ChevronLeft size={18} />
          </Link>
          <div className={styles.headerIcon}><Users size={22} /></div>
          <div>
            <h1 className={styles.pageTitle}>Teams &amp; Draft</h1>
            {season && <p className={styles.pageSub}>{season.name}</p>}
          </div>
        </div>
      </div>

      {divisions.length === 0 && (
        <div className={styles.emptyState}>
          <p>No divisions found. Create a division for this season before building teams.</p>
        </div>
      )}

      {divisions.length > 0 && (
        <>
          {/* Toolbar */}
          <div className={styles.teamsToolbar}>
            {divisions.length > 1 && (
              <>
                <select
                  className={styles.divSelect}
                  value={selectedDivId}
                  onChange={e => setSelectedDivId(e.target.value)}
                >
                  {divisions.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <div className={styles.toolbarSep} />
              </>
            )}

            {canManage && (
              <button style={BTN_SECONDARY} onClick={() => setShowCreateModal(true)}>
                <Plus size={14} style={{ marginRight: 4 }} />
                {divTeams.length === 0 ? 'Create Teams' : 'Add Teams'}
              </button>
            )}

            {canManage && divTeams.length > 0 && pool.length > 0 && (
              <button style={BTN_SECONDARY} onClick={() => setShowRandomizeConfirm(true)} disabled={saving}>
                <Shuffle size={14} style={{ marginRight: 4 }} />
                Randomize
              </button>
            )}

            {canManage && divTeams.length > 0 && !draft && (
              <button style={BTN_SECONDARY} onClick={handleStartDraft} disabled={saving}>
                <Swords size={14} style={{ marginRight: 4 }} />
                Start Draft
              </button>
            )}

            {draft && (
              <button style={BTN_PRIMARY} onClick={() => setDraftOpen(true)}>
                <Swords size={14} style={{ marginRight: 4 }} />
                Resume Draft
              </button>
            )}

            <ExportMenu
              formats={['xlsx', 'csv']}
              onExportXLSX={handleExportXLSX}
              onExportCSV={handleExportCSV}
              disabled={divTeams.length === 0}
            />

            {canManage && assignedCount > 0 && (
              <>
                <div style={{ marginLeft: 'auto' }} />
                <button style={BTN_DANGER} onClick={() => setShowClearConfirm(true)} disabled={saving}>
                  Clear All Assignments
                </button>
              </>
            )}
          </div>

          {/* Three-panel layout */}
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className={styles.teamsLayout}>
              {/* Pool */}
              <div className={styles.poolPanel}>
                <div className={styles.poolHeader}>
                  <span className={styles.sectionTitle}>Player Pool</span>
                  <span className={styles.poolCount}>{pool.length} unassigned</span>
                </div>
                <DroppablePool isOver={overPoolId}>
                  {pool.length === 0 ? (
                    <div className={styles.poolEmpty}>All players assigned</div>
                  ) : (
                    pool.map(r => <DraggableCard key={r.id} reg={r} disabled={!canManage} />)
                  )}
                </DroppablePool>
              </div>

              {/* Teams */}
              <div className={styles.teamsPanel}>
                {divTeams.length === 0 ? (
                  <div className={styles.noTeamsPrompt}>
                    {canManage ? (
                      <HelpCallout
                        variant="info"
                        title="No teams yet"
                        body="Create your teams first, then assign players from your approved registrations. You can drag players onto teams manually, randomize assignments, or run a structured draft."
                      />
                    ) : (
                      'No teams have been created for this division.'
                    )}
                  </div>
                ) : (
                  <div className={styles.teamColumns}>
                    {divTeams.map(t => (
                      <DroppableTeamColumn
                        key={t.id}
                        team={t}
                        players={teamPlayerMap.get(t.id) ?? []}
                        canManage={canManage}
                        onEdit={setEditTeam}
                        onDelete={setDeleteTeam}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DragOverlay>
              {activeReg ? <CardOverlay reg={activeReg} /> : null}
            </DragOverlay>
          </DndContext>
        </>
      )}

      {/* Modals */}
      {showCreateModal && selectedDiv && (
        <CreateTeamsModal
          divisionName={selectedDiv.name}
          remaining={remainingTeamSlots}
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreateTeams}
          orgId={currentOrg?.id}
        />
      )}

      {editTeam && (
        <EditTeamModal
          team={editTeam}
          onClose={() => setEditTeam(null)}
          onSave={handleEditTeam}
        />
      )}

      {deleteTeam && (
        <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && setDeleteTeam(null)}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Delete Team</h2>
              <button className={styles.modalCloseBtn} onClick={() => setDeleteTeam(null)}><X size={18} /></button>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--white-60)', marginBottom: '1rem' }}>
              Delete <strong style={{ color: 'var(--white-80)' }}>{deleteTeam.name}</strong>?
              This can only be done if no players are assigned to this team.
            </p>
            <div className={styles.modalFooter}>
              <button style={BTN_SECONDARY} onClick={() => setDeleteTeam(null)}>Cancel</button>
              <button style={BTN_DANGER} onClick={() => handleDeleteTeam(deleteTeam)} disabled={saving}>
                {saving ? 'Deleting…' : 'Delete Team'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRandomizeConfirm && (
        <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && setShowRandomizeConfirm(false)}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Randomize Players?</h2>
              <button className={styles.modalCloseBtn} onClick={() => setShowRandomizeConfirm(false)}><X size={18} /></button>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--white-60)', marginBottom: '1rem' }}>
              This will assign <strong style={{ color: 'var(--white-80)' }}>{pool.length} player{pool.length !== 1 ? 's' : ''}</strong> to{' '}
              <strong style={{ color: 'var(--white-80)' }}>{divTeams.length} team{divTeams.length !== 1 ? 's' : ''}</strong> randomly.
              Already-assigned players are not affected.
            </p>
            <div className={styles.modalFooter}>
              <button style={BTN_SECONDARY} onClick={() => setShowRandomizeConfirm(false)}>Cancel</button>
              <button style={BTN_PRIMARY} onClick={handleRandomize}>Randomize</button>
            </div>
          </div>
        </div>
      )}

      {showClearConfirm && (
        <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && setShowClearConfirm(false)}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Clear All Assignments?</h2>
              <button className={styles.modalCloseBtn} onClick={() => setShowClearConfirm(false)}><X size={18} /></button>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--white-60)', marginBottom: '1rem' }}>
              This will remove all <strong style={{ color: 'var(--white-80)' }}>{assignedCount} player assignment{assignedCount !== 1 ? 's' : ''}</strong> for{' '}
              {selectedDiv?.name}. Any in-progress draft will also be cleared. This cannot be undone.
            </p>
            <div className={styles.modalFooter}>
              <button style={BTN_SECONDARY} onClick={() => setShowClearConfirm(false)}>Cancel</button>
              <button style={BTN_DANGER} onClick={handleClearAll}>Clear All</button>
            </div>
          </div>
        </div>
      )}

      {/* Draft overlay */}
      {draftOpen && draft && (
        <DraftOverlay
          draft={draft}
          remainingPlayers={draftPlayers}
          teams={divTeams}
          saving={saving}
          onPick={id => draftAction({ action: 'pick', registrationId: id })}
          onUndo={() => draftAction({ action: 'undo' })}
          onFinalize={() => draftAction({ action: 'finalize' })}
          onClose={() => setDraftOpen(false)}
        />
      )}

      <FeedbackModal
        isOpen={feedback.isOpen}
        title={feedback.title}
        message={feedback.message}
        type={feedback.type}
        onClose={() => setFeedback(f => ({ ...f, isOpen: false }))}
      />
    </div>
  );
}
