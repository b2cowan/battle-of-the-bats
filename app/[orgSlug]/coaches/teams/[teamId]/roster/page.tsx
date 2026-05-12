'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Users, ChevronRight, Plus, X } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import FeedbackModal from '@/components/FeedbackModal';
import HelpCallout from '@/components/help/HelpCallout';
import styles from '../../../coaches.module.css';
import type { RepRosterPlayer, RepProgramYear } from '@/lib/types';

const STATUS_CSS: Record<string, string> = {
  active:   styles.badgeActive,
  inactive: styles.badgeDraft,
};

interface AddForm {
  playerFirstName: string; playerLastName: string;
  playerDateOfBirth: string; playerNumber: string;
  guardianFirstName: string; guardianLastName: string;
  guardianEmail: string; guardianPhone: string;
  notes: string;
}

const BLANK: AddForm = {
  playerFirstName: '', playerLastName: '', playerDateOfBirth: '',
  playerNumber: '', guardianFirstName: '', guardianLastName: '',
  guardianEmail: '', guardianPhone: '', notes: '',
};

export default function RosterPage({
  params,
}: {
  params: { orgSlug: string; teamId: string };
}) {
  const { assignments, loading: assignmentsLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === params.teamId);

  const [players, setPlayers] = useState<RepRosterPlayer[]>([]);
  const [programYear, setProgramYear] = useState<RepProgramYear | null>(null);
  const [fetching, setFetching] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(BLANK);
  const [adding, setAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'success' | 'danger'>('success');
  const [feedbackMsg, setFeedbackMsg] = useState('');

  function showFeedback(type: 'success' | 'danger', msg: string) {
    setFeedbackType(type); setFeedbackMsg(msg); setFeedbackOpen(true);
  }

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch(`/api/coaches/${params.orgSlug}/teams/${params.teamId}/roster`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load roster');
      setPlayers(data.players ?? []);
      setProgramYear(data.programYear ?? null);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to load.');
    } finally {
      setFetching(false);
    }
  }, [params.orgSlug, params.teamId]);

  useEffect(() => { if (!assignmentsLoading) load(); }, [assignmentsLoading, load]);

  async function handleToggleStatus(player: RepRosterPlayer) {
    const newStatus = player.status === 'active' ? 'inactive' : 'active';
    setTogglingId(player.id);
    try {
      const res = await fetch(
        `/api/coaches/${params.orgSlug}/teams/${params.teamId}/roster/${player.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to update status');
      setPlayers(prev => prev.map(p => p.id === player.id ? data.player : p));
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to update status.');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleAdd() {
    if (!addForm.playerFirstName.trim() || !addForm.playerLastName.trim() ||
        !addForm.guardianFirstName.trim() || !addForm.guardianLastName.trim() ||
        !addForm.guardianEmail.trim()) return;

    setAdding(true);
    try {
      const res = await fetch(
        `/api/coaches/${params.orgSlug}/teams/${params.teamId}/roster`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerFirstName:   addForm.playerFirstName.trim(),
            playerLastName:    addForm.playerLastName.trim(),
            playerDateOfBirth: addForm.playerDateOfBirth || null,
            playerNumber:      addForm.playerNumber.trim() || null,
            guardianFirstName: addForm.guardianFirstName.trim(),
            guardianLastName:  addForm.guardianLastName.trim(),
            guardianEmail:     addForm.guardianEmail.trim(),
            guardianPhone:     addForm.guardianPhone.trim() || null,
            notes:             addForm.notes.trim() || null,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to add player');
      setAddOpen(false);
      setAddForm(BLANK);
      await load();
      showFeedback('success', `${addForm.playerFirstName} ${addForm.playerLastName} added to roster.`);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to add player.');
    } finally {
      setAdding(false);
    }
  }

  const base = `/${params.orgSlug}/coaches/teams/${params.teamId}`;

  if (assignmentsLoading) return <p className={styles.muted}>Loading…</p>;
  if (!assignment) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <Link href={`/${params.orgSlug}/coaches`}>Coaches Portal</Link>
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
              {assignment.teamName} — {programYear?.name ?? assignment.programYearName}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}
          onClick={() => { setAddForm(BLANK); setAddOpen(true); }}
        >
          <Plus size={14} /> Add Player
        </button>
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
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>#</th>
                <th className={styles.th}>Player</th>
                <th className={styles.th}>Guardian Email</th>
                <th className={styles.th}>Phone</th>
                <th className={styles.th}>Source</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {players.map(p => (
                <tr key={p.id} className={styles.tr}>
                  <td className={styles.td} style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', width: '40px' }}>
                    {p.playerNumber ?? <span style={{ opacity: 0.3 }}>—</span>}
                  </td>
                  <td className={styles.td}>
                    <span className={styles.playerName}>{p.playerFirstName} {p.playerLastName}</span>
                  </td>
                  <td className={styles.td} style={{ fontSize: '0.85rem' }}>
                    {p.guardianEmail
                      ? <a href={`mailto:${p.guardianEmail}`} style={{ color: 'var(--blueprint-blue,#4fa3e0)' }}>{p.guardianEmail}</a>
                      : <span style={{ opacity: 0.3 }}>—</span>}
                  </td>
                  <td className={styles.td} style={{ fontSize: '0.85rem' }}>
                    {p.guardianPhone ?? <span style={{ opacity: 0.3 }}>—</span>}
                  </td>
                  <td className={styles.td}>
                    <span className={`${styles.badge} ${p.source === 'tryout' ? styles.badgeTryout : styles.badgeManual}`}>
                      {p.source === 'tryout' ? 'Tryout' : 'Manual'}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <span className={`${styles.badge} ${STATUS_CSS[p.status] ?? styles.badgeDraft}`}>
                      {p.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ fontSize: '0.78rem', padding: '0.25rem 0.5rem', opacity: togglingId === p.id ? 0.5 : 1 }}
                        disabled={togglingId === p.id}
                        onClick={() => handleToggleStatus(p)}
                      >
                        {togglingId === p.id ? '…' : p.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <Link
                        href={`${base}/roster/${p.id}`}
                        className="btn btn-ghost"
                        style={{ fontSize: '0.78rem', padding: '0.25rem 0.5rem' }}
                      >
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add player modal */}
      {addOpen && (
        <div className={styles.modalOverlay} onClick={() => setAddOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Add Player</h3>
              <button className={styles.modalCloseBtn} onClick={() => setAddOpen(false)}><X size={16} /></button>
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
                  Last Name <span style={{ color: '#f87171' }}>*</span>
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
                <label className={styles.label} htmlFor="add-gfn">
                  Guardian First Name <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input id="add-gfn" className={styles.input} type="text"
                  value={addForm.guardianFirstName}
                  onChange={e => setAddForm(f => ({ ...f, guardianFirstName: e.target.value }))}
                  maxLength={60} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="add-gln">
                  Guardian Last Name <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input id="add-gln" className={styles.input} type="text"
                  value={addForm.guardianLastName}
                  onChange={e => setAddForm(f => ({ ...f, guardianLastName: e.target.value }))}
                  maxLength={60} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="add-gem">
                  Guardian Email <span style={{ color: '#f87171' }}>*</span>
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
              <button type="button" className="btn btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAdd}
                disabled={
                  adding ||
                  !addForm.playerFirstName.trim() || !addForm.playerLastName.trim() ||
                  !addForm.guardianFirstName.trim() || !addForm.guardianLastName.trim() ||
                  !addForm.guardianEmail.trim()
                }
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
    </div>
  );
}
