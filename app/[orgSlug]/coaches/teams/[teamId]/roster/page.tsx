'use client';
import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Users, ChevronRight, Plus, X, GripVertical, AlertTriangle } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCoaches } from '@/lib/coaches-context';
import { useOrg } from '@/lib/org-context';
import FeedbackModal from '@/components/FeedbackModal';
import HelpCallout from '@/components/help/HelpCallout';
import PositionSelect from '@/components/coaches/PositionSelect';
import UnsavedChangesGuard from '@/components/coaches/UnsavedChangesGuard';
import { teamInitials, teamColorFromName } from '@/lib/teamBadge';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
  downloadPDF, DEFAULT_PDF_SETTINGS, type OrgPdfSettings,
} from '@/lib/export';
import { hasPlanFeature } from '@/lib/plan-features';
import ExportMenu from '@/components/admin/ExportMenu';
import styles from '../../../coaches.module.css';
import type { RepRosterPlayer, RepProgramYear } from '@/lib/types';

const STATUS_CSS: Record<string, string> = {
  active:   styles.badgeActive,
  inactive: styles.badgeDraft,
};

// Rep teams don't carry a sport yet, so default to the softball/baseball diamond.
// When teams store a sport, source this from that instead of DEFAULT_SPORT.
const ROSTER_POSITIONS = getSportPack(DEFAULT_SPORT).positions;

// ── Export definition ─────────────────────────────────────────────────────────

const ROSTER_EXPORT_COLS: ExportColumnDef[] = [
  { label: '#',              key: 'playerNumber',      format: 'text' },
  { label: 'First Name',     key: 'playerFirstName',   format: 'text' },
  { label: 'Last Name',      key: 'playerLastName',    format: 'text' },
  { label: 'Primary Position', key: 'primaryPosition',  format: 'text' },
  { label: 'Secondary Position', key: 'secondaryPosition', format: 'text' },
  { label: 'Date of Birth',  key: 'playerDateOfBirth', format: 'date',     sensitive: true },
  { label: 'Guardian Name',  key: 'guardianName',      format: 'text',     sensitive: true },
  { label: 'Guardian Email', key: 'guardianEmail',     format: 'text',     sensitive: true },
  { label: 'Guardian Phone', key: 'guardianPhone',     format: 'text',     sensitive: true },
  { label: 'Status',         key: 'status',            format: 'text' },
  { label: 'Notes',          key: 'notes',             format: 'text',     sensitive: true },
];

interface AddForm {
  playerFirstName: string; playerLastName: string;
  playerDateOfBirth: string; playerNumber: string;
  primaryPosition: string; secondaryPosition: string;
  guardianFirstName: string; guardianLastName: string;
  guardianEmail: string; guardianPhone: string;
  notes: string;
}

const BLANK: AddForm = {
  playerFirstName: '', playerLastName: '', playerDateOfBirth: '',
  playerNumber: '', primaryPosition: '', secondaryPosition: '',
  guardianFirstName: '', guardianLastName: '',
  guardianEmail: '', guardianPhone: '', notes: '',
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

// Season labels are often auto-named with the team in them (e.g.
// "toronto blue jays5 2026"). The team name already appears in the breadcrumb,
// sidebar, and title — strip a leading team-name prefix so the subtitle doesn't stutter.
function seasonLabel(season: string | null | undefined, teamName: string): string {
  const s = (season ?? '').trim();
  if (!s) return '';
  const t = teamName.trim();
  if (t && s.toLowerCase().startsWith(t.toLowerCase())) {
    const stripped = s.slice(t.length).replace(/^[\s—–-]+/, '').trim();
    if (stripped) return stripped;
  }
  return s;
}

export default function RosterPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  const { assignments, loading: assignmentsLoading } = useCoaches();
  const { currentOrg } = useOrg();
  const assignment = assignments.find(a => a.teamId === teamId);

  const [players, setPlayers] = useState<RepRosterPlayer[]>([]);
  const [programYear, setProgramYear] = useState<RepProgramYear | null>(null);
  const [fetching, setFetching] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(BLANK);
  const [adding, setAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'success' | 'danger'>('success');
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // PDF settings — fetched once on mount; used in handleExportPDF
  const [pdfSettings, setPdfSettings] = useState<OrgPdfSettings | null>(null);
  const canUsePDF = currentOrg ? hasPlanFeature(currentOrg.planId, 'pdf_exports') : false;
  const [pdfWarningOpen, setPdfWarningOpen] = useState(false);

  function showFeedback(type: 'success' | 'danger', msg: string) {
    setFeedbackType(type); setFeedbackMsg(msg); setFeedbackOpen(true);
  }

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/roster`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load roster');
      setPlayers(data.players ?? []);
      setProgramYear(data.programYear ?? null);
    } catch (e: unknown) {
      showFeedback('danger', errorMessage(e, 'Failed to load.'));
    } finally {
      setFetching(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => { if (!assignmentsLoading) void Promise.resolve().then(load); }, [assignmentsLoading, load]);

  useEffect(() => {
    fetch('/api/admin/org/pdf-settings')
      .then(r => r.ok ? r.json() : {})
      .then(d => setPdfSettings(d as OrgPdfSettings))
      .catch(() => setPdfSettings(null));
  }, []);

  async function handleToggleStatus(player: RepRosterPlayer) {
    const newStatus = player.status === 'active' ? 'inactive' : 'active';
    setTogglingId(player.id);
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/roster/${player.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to update status');
      setPlayers(prev => prev.map(p => p.id === player.id ? data.player : p));
    } catch (e: unknown) {
      showFeedback('danger', errorMessage(e, 'Failed to update status.'));
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = players.findIndex(p => p.id === active.id);
    const newIndex = players.findIndex(p => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const prev = players;
    const next = arrayMove(players, oldIndex, newIndex);
    setPlayers(next); // optimistic
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/roster/reorder`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderedIds: next.map(p => p.id) }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Could not save the new order.');
      }
    } catch (e: unknown) {
      setPlayers(prev); // revert
      showFeedback('danger', errorMessage(e, 'Could not save the new order.'));
    }
  }

  async function handleAdd() {
    if (!addForm.playerFirstName.trim()) return; // first name required; last + guardian optional

    setAdding(true);
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/roster`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerFirstName:   addForm.playerFirstName.trim(),
            playerLastName:    addForm.playerLastName.trim() || null,
            playerDateOfBirth: addForm.playerDateOfBirth || null,
            playerNumber:      addForm.playerNumber.trim() || null,
            primaryPosition:   addForm.primaryPosition.trim() || null,
            secondaryPosition: addForm.secondaryPosition.trim() || null,
            guardianFirstName: addForm.guardianFirstName.trim() || null,
            guardianLastName:  addForm.guardianLastName.trim() || null,
            guardianEmail:     addForm.guardianEmail.trim() || null,
            guardianPhone:     addForm.guardianPhone.trim() || null,
            notes:             addForm.notes.trim() || null,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to add player');
      setAddOpen(false);
      setAddForm(BLANK);
      // Append the created player to local state (it appends server-side too) rather than refetching —
      // a refetch here could stomp an in-flight reorder's optimistic state.
      if (data.player) setPlayers(prev => [...prev, data.player]);
      showFeedback('success', `${[addForm.playerFirstName.trim(), addForm.playerLastName.trim()].filter(Boolean).join(' ')} added to roster.`);
    } catch (e: unknown) {
      showFeedback('danger', errorMessage(e, 'Failed to add player.'));
    } finally {
      setAdding(false);
    }
  }

  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const addDirty = addOpen && JSON.stringify(addForm) !== JSON.stringify(BLANK);
  function requestCloseAdd() {
    if (addDirty && !window.confirm('Discard this new player?')) return;
    setAddOpen(false);
  }

  // ── Export helpers ───────────────────────────────────────────────────────────

  function buildRosterExportSrc() {
    return players.map(p => ({
      playerNumber:      p.playerNumber ?? '',
      primaryPosition:   p.primaryPosition ?? '',
      secondaryPosition: p.secondaryPosition ?? '',
      playerFirstName:   p.playerFirstName,
      playerLastName:    p.playerLastName,
      playerDateOfBirth: p.playerDateOfBirth ?? '',
      guardianName:      [p.guardianFirstName, p.guardianLastName].filter(Boolean).join(' '),
      guardianEmail:     p.guardianEmail ?? '',
      guardianPhone:     p.guardianPhone ?? '',
      status:            p.status === 'active' ? 'Active' : 'Inactive',
      notes:             p.notes ?? '',
    }));
  }

  async function handleExportXLSX() {
    if (!players.length) return;
    const headers = serializeHeaders(ROSTER_EXPORT_COLS);
    const rows = serializeRows(buildRosterExportSrc(), ROSTER_EXPORT_COLS);
    await downloadXLSX(
      buildFilename({ org: currentOrg?.slug ?? orgSlug, dataset: 'roster', scope: assignment?.teamName ?? teamId }, 'xlsx'),
      headers, rows, 'Roster',
    );
  }

  async function handleExportXLSXWithSensitive() {
    if (!players.length) return;
    const headers = serializeHeaders(ROSTER_EXPORT_COLS, true);
    const rows = serializeRows(buildRosterExportSrc(), ROSTER_EXPORT_COLS, true);
    await downloadXLSX(
      buildFilename({ org: currentOrg?.slug ?? orgSlug, dataset: 'roster-with-contacts', scope: assignment?.teamName ?? teamId }, 'xlsx'),
      headers, rows, 'Roster',
    );
  }

  function handleExportCSV() {
    const headers = serializeHeaders(ROSTER_EXPORT_COLS);
    const rows = serializeRows(buildRosterExportSrc(), ROSTER_EXPORT_COLS);
    downloadCSVBlob(
      buildFilename({ org: currentOrg?.slug ?? orgSlug, dataset: 'roster', scope: assignment?.teamName ?? teamId }, 'csv'),
      generateCSV(headers, rows),
    );
  }

  async function doPdfExport() {
    if (!players.length) return;
    const settings: OrgPdfSettings = {
      ...DEFAULT_PDF_SETTINGS,
      ...(pdfSettings && Object.keys(pdfSettings).length > 0 ? pdfSettings : {}),
    };
    const includeGuardian = settings.includeGuardianContacts;
    const teamName = assignment?.teamName ?? teamId;
    const programYearName = programYear?.name ?? assignment?.programYearName ?? '';

    // Build PDF-specific headers — DOB always included; guardian columns conditional
    const pdfHeaders = [
      '#', 'First Name', 'Last Name', 'Primary', 'Secondary', 'Date of Birth',
      ...(includeGuardian ? ['Guardian Name', 'Guardian Email', 'Guardian Phone'] : []),
      'Status',
    ];

    const src = buildRosterExportSrc();
    const pdfRows = src.map(r => [
      r.playerNumber,
      r.playerFirstName,
      r.playerLastName,
      r.primaryPosition,
      r.secondaryPosition,
      r.playerDateOfBirth,
      ...(includeGuardian ? [r.guardianName, r.guardianEmail, r.guardianPhone] : []),
      r.status,
    ]);

    await downloadPDF(
      buildFilename({ org: currentOrg?.slug ?? orgSlug, dataset: 'roster', scope: teamName }, 'pdf'),
      'Team Roster',
      `${teamName} — ${programYearName}`,
      pdfHeaders,
      pdfRows,
      settings,
    );
  }

  async function handleExportPDF() {
    if (
      canUsePDF &&
      pdfSettings !== null &&
      Object.keys(pdfSettings).length === 0 &&
      !localStorage.getItem('flhq-pdf-setup-warned')
    ) {
      setPdfWarningOpen(true);
      return;
    }
    await doPdfExport();
  }

  if (assignmentsLoading) return <p className={styles.muted}>Loading…</p>;
  if (!assignment) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  // ── Roster summary + data-quality signals ─────────────────────────────────
  const activeCount = players.filter(p => p.status === 'active').length;
  const inactiveCount = players.length - activeCount;
  const season = seasonLabel(programYear?.name ?? assignment.programYearName, assignment.teamName);

  // Jersey numbers worn by more than one player (flagged inline, not blocked).
  const dupNumbers = (() => {
    const seen = new Set<string>();
    const dup = new Set<string>();
    for (const p of players) {
      const n = (p.playerNumber ?? '').trim();
      if (!n) continue;
      if (seen.has(n)) dup.add(n); else seen.add(n);
    }
    return dup;
  })();

  const missingPosition = players.filter(p => p.status === 'active' && !p.primaryPosition && !p.secondaryPosition).length;
  const missingContact = players.filter(p => p.status === 'active' && !p.guardianEmail && !p.guardianPhone).length;
  const nudgeParts: string[] = [];
  if (missingPosition) nudgeParts.push(`${missingPosition} without a position`);
  if (missingContact) nudgeParts.push(`${missingContact} without guardian contact`);
  const nudge = nudgeParts.length ? `${nudgeParts.join(' · ')} — open a player to fill in details` : '';

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <Link href={`/${orgSlug}/coaches`}>Coaches Portal</Link>
        <span><ChevronRight size={12} /></span>
        <Link href={base}>{assignment.teamName}</Link>
        <span><ChevronRight size={12} /></span>
        <span>Roster</span>
      </div>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><Users size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Roster</h1>
            <p className={styles.pageSub}>
              {activeCount} active {activeCount === 1 ? 'player' : 'players'}
              {inactiveCount > 0 ? ` · ${inactiveCount} inactive` : ''}
              {season ? ` · ${season} season` : ''}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <ExportMenu
            formats={['xlsx', 'csv', 'pdf']}
            onExportXLSX={handleExportXLSX}
            onExportCSV={handleExportCSV}
            onExportPDF={handleExportPDF}
            hasSensitiveOption={true}
            sensitiveOptionLabel="Excel with contact details"
            onExportXLSXWithSensitive={handleExportXLSXWithSensitive}
            planId={currentOrg?.planId}
            pdfFeatureKey="pdf_exports"
            disabled={players.length === 0}
          />
          <button
            type="button"
            className="btn btn-lime"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', padding: '0.34rem 0.8rem' }}
            onClick={() => { setAddForm(BLANK); setAddOpen(true); }}
          >
            <Plus size={13} /> Add Player
          </button>
        </div>
      </div>


      {fetching ? (
        <p className={styles.muted}>Loading…</p>
      ) : players.length === 0 ? (
        <HelpCallout
          variant="info"
          title="Your roster is empty"
          body="Players are added after tryout acceptance — contact your org admin if expected players are missing. You can also add players directly using the Add Player button above."
        />
      ) : (
        <>
          {(players.length >= 2 || nudge) && (
            <div className={styles.rosterMeta}>
              {players.length >= 2 ? (
                <span className={styles.rosterHint}>
                  <GripVertical size={13} /> Drag to set the order players appear in
                </span>
              ) : <span />}
              {nudge && <span className={styles.rosterNudge}>{nudge}</span>}
            </div>
          )}
          <DndContext id={`rep-roster-dnd-${teamId}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className={`${styles.tableWrap} ${styles.rosterWrap}`}>
              <table className={`${styles.table} ${styles.rosterTable}`}>
                <thead>
                  <tr>
                    <th className={styles.th} style={{ width: 28 }} aria-hidden />
                    <th className={styles.th}>#</th>
                    <th className={styles.th}>Player</th>
                    <th className={styles.th}>Positions</th>
                    <th className={styles.th}>Guardian</th>
                    <th className={styles.th}>Status</th>
                    <th className={styles.th} aria-hidden />
                  </tr>
                </thead>
                <tbody>
                  <SortableContext items={players.map(p => p.id)} strategy={verticalListSortingStrategy}>
                    {players.map(p => (
                      <SortableRow
                        key={p.id}
                        player={p}
                        base={base}
                        togglingId={togglingId}
                        onToggle={handleToggleStatus}
                        dragDisabled={players.length < 2}
                        isDuplicateNumber={!!p.playerNumber && dupNumbers.has(p.playerNumber.trim())}
                      />
                    ))}
                  </SortableContext>
                </tbody>
              </table>
            </div>
          </DndContext>
        </>
      )}

      {/* Add player modal */}
      <UnsavedChangesGuard active={addDirty} />

      {addOpen && (
        <div className={styles.modalOverlay} onClick={requestCloseAdd}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Add Player</h3>
              <button className={styles.modalCloseBtn} onClick={requestCloseAdd}><X size={16} /></button>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="add-pfn">
                  First Name <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input id="add-pfn" className={styles.input} type="text" autoFocus
                  value={addForm.playerFirstName}
                  onChange={e => setAddForm(f => ({ ...f, playerFirstName: e.target.value }))}
                  maxLength={60} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="add-pln">
                  Last Name <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>(optional)</span>
                </label>
                <input id="add-pln" className={styles.input} type="text"
                  value={addForm.playerLastName}
                  onChange={e => setAddForm(f => ({ ...f, playerLastName: e.target.value }))}
                  maxLength={60} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="add-dob">Date of Birth</label>
                <input id="add-dob" className={styles.input} type="date"
                  value={addForm.playerDateOfBirth}
                  onChange={e => setAddForm(f => ({ ...f, playerDateOfBirth: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="add-num">Jersey #</label>
                <input id="add-num" className={styles.input} type="text"
                  value={addForm.playerNumber}
                  onChange={e => setAddForm(f => ({ ...f, playerNumber: e.target.value }))}
                  maxLength={10} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="add-primary-position">Primary Position</label>
                <PositionSelect id="add-primary-position" positions={ROSTER_POSITIONS}
                  selectClass={styles.select} inputClass={styles.input}
                  value={addForm.primaryPosition}
                  onChange={v => setAddForm(f => ({ ...f, primaryPosition: v }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="add-secondary-position">Secondary Position</label>
                <PositionSelect id="add-secondary-position" positions={ROSTER_POSITIONS}
                  selectClass={styles.select} inputClass={styles.input}
                  value={addForm.secondaryPosition}
                  onChange={v => setAddForm(f => ({ ...f, secondaryPosition: v }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="add-gfn">
                  Guardian First Name <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>(optional)</span>
                </label>
                <input id="add-gfn" className={styles.input} type="text"
                  value={addForm.guardianFirstName}
                  onChange={e => setAddForm(f => ({ ...f, guardianFirstName: e.target.value }))}
                  maxLength={60} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="add-gln">
                  Guardian Last Name <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>(optional)</span>
                </label>
                <input id="add-gln" className={styles.input} type="text"
                  value={addForm.guardianLastName}
                  onChange={e => setAddForm(f => ({ ...f, guardianLastName: e.target.value }))}
                  maxLength={60} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="add-gem">
                  Guardian Email <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>(optional)</span>
                </label>
                <input id="add-gem" className={styles.input} type="email"
                  value={addForm.guardianEmail}
                  onChange={e => setAddForm(f => ({ ...f, guardianEmail: e.target.value }))}
                  maxLength={120} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="add-gph">Guardian Phone</label>
                <input id="add-gph" className={styles.input} type="tel"
                  value={addForm.guardianPhone}
                  onChange={e => setAddForm(f => ({ ...f, guardianPhone: e.target.value }))}
                  maxLength={20} />
              </div>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="add-notes">Notes</label>
                <textarea id="add-notes" className={styles.textarea} rows={2}
                  value={addForm.notes}
                  onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Position, experience, etc."
                  maxLength={500} />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className="btn btn-ghost" onClick={requestCloseAdd}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAdd}
                disabled={adding || !addForm.playerFirstName.trim()}
              >
                {adding ? 'Adding…' : 'Add Player'}
              </button>
            </div>
          </div>
        </div>
      )}

      <FeedbackModal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        title={feedbackType === 'success' ? 'Done' : 'Error'}
        message={feedbackMsg}
        type={feedbackType}
      />
      <FeedbackModal
        isOpen={pdfWarningOpen}
        onClose={() => { localStorage.setItem('flhq-pdf-setup-warned', '1'); setPdfWarningOpen(false); }}
        onConfirm={() => { localStorage.setItem('flhq-pdf-setup-warned', '1'); void doPdfExport(); }}
        title="PDF settings not configured"
        message="This export will use default FieldLogicHQ styling — no custom header, logo, or footer. Visit Org Settings → PDF Settings to customize all future exports."
        confirmText="Download anyway"
        cancelText="Not now"
        type="info"
      />
    </div>
  );
}

function SortableRow({
  player: p,
  base,
  togglingId,
  onToggle,
  dragDisabled,
  isDuplicateNumber,
}: {
  player: RepRosterPlayer;
  base: string;
  togglingId: string | null;
  onToggle: (player: RepRosterPlayer) => void;
  dragDisabled: boolean;
  isDuplicateNumber: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id, disabled: dragDisabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const fullName = [p.playerFirstName, p.playerLastName].filter(Boolean).join(' ');
  return (
    <tr ref={setNodeRef} style={style} className={styles.tr}>
      <td className={`${styles.td} ${styles.gripTd}`} style={{ width: 28, paddingLeft: '0.25rem', paddingRight: 0 }}>
        <button
          type="button"
          aria-label="Drag to reorder"
          disabled={dragDisabled}
          style={{ background: 'none', border: 'none', padding: 4, lineHeight: 0, cursor: dragDisabled ? 'default' : 'grab', color: 'rgba(255,255,255,0.35)', touchAction: 'none' }}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={15} />
        </button>
      </td>
      <td className={styles.td} data-label="#" style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', width: '52px' }}>
        {p.playerNumber
          ? (isDuplicateNumber
              ? <span className={styles.jerseyDup} title="Another player wears this number"><AlertTriangle size={12} /> {p.playerNumber}</span>
              : p.playerNumber)
          : <span className={styles.cellEmpty}>—</span>}
      </td>
      <td className={`${styles.td} ${styles.playerCellTd}`} data-label="Player">
        <span className={styles.playerCell}>
          <span className={styles.avatar} style={{ background: teamColorFromName(fullName) }} aria-hidden>
            {teamInitials(fullName)}
          </span>
          <Link href={`${base}/roster/${p.id}`} className={styles.playerNameLink}>{fullName}</Link>
        </span>
      </td>
      <td className={styles.td} data-label="Positions" style={{ fontSize: '0.85rem' }}>
        {[p.primaryPosition, p.secondaryPosition].filter(Boolean).join(' / ') || <span className={styles.cellEmpty}>—</span>}
      </td>
      <td className={styles.td} data-label="Guardian" style={{ fontSize: '0.85rem' }}>
        {(p.guardianEmail || p.guardianPhone)
          ? <span className={styles.guardianStack}>
              {p.guardianEmail
                ? <a href={`mailto:${p.guardianEmail}`} className={styles.guardianEmail}>{p.guardianEmail}</a>
                : <span className={styles.cellEmpty}>No email on file</span>}
              {p.guardianPhone && <span className={styles.guardianPhone}>{p.guardianPhone}</span>}
            </span>
          : <span className={styles.cellEmpty}>—</span>}
      </td>
      <td className={styles.td} data-label="Status">
        <span className={`${styles.badge} ${STATUS_CSS[p.status] ?? styles.badgeDraft}`}>
          {p.status === 'active' ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className={`${styles.td} ${styles.rowActionCell}`}>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ fontSize: '0.78rem', padding: '0.25rem 0.5rem', color: 'var(--white-45)', opacity: togglingId === p.id ? 0.5 : 1 }}
          disabled={togglingId === p.id}
          onClick={() => onToggle(p)}
        >
          {togglingId === p.id ? '…' : p.status === 'active' ? 'Deactivate' : 'Activate'}
        </button>
      </td>
    </tr>
  );
}
