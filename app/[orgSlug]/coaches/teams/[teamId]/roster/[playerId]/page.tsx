'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import FeedbackModal from '@/components/FeedbackModal';
import PlayerDocumentsSection from '@/components/coaches/PlayerDocumentsSection';
import styles from '../../../../coaches.module.css';
import type { RepRosterPlayer } from '@/lib/types';

const STATUS_CSS: Record<string, string> = {
  active:   styles.badgeActive,
  inactive: styles.badgeDraft,
};

interface EditForm {
  playerFirstName: string; playerLastName: string;
  playerDateOfBirth: string; playerNumber: string;
  guardianFirstName: string; guardianLastName: string;
  guardianEmail: string; guardianPhone: string;
  notes: string; adminNotes: string;
}

function playerToForm(p: RepRosterPlayer): EditForm {
  return {
    playerFirstName:   p.playerFirstName,
    playerLastName:    p.playerLastName,
    playerDateOfBirth: p.playerDateOfBirth ?? '',
    playerNumber:      p.playerNumber ?? '',
    guardianFirstName: p.guardianFirstName ?? '',
    guardianLastName:  p.guardianLastName ?? '',
    guardianEmail:     p.guardianEmail ?? '',
    guardianPhone:     p.guardianPhone ?? '',
    notes:             p.notes ?? '',
    adminNotes:        p.adminNotes ?? '',
  };
}

export default function PlayerDetailPage({
  params,
}: {
  params: { orgSlug: string; teamId: string; playerId: string };
}) {
  const { assignments, loading: assignmentsLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === params.teamId);

  const [player, setPlayer] = useState<RepRosterPlayer | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'success' | 'danger'>('success');
  const [feedbackMsg, setFeedbackMsg] = useState('');

  function showFeedback(type: 'success' | 'danger', msg: string) {
    setFeedbackType(type); setFeedbackMsg(msg); setFeedbackOpen(true);
  }

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch(
        `/api/coaches/${params.orgSlug}/teams/${params.teamId}/roster/${params.playerId}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load player');
      setPlayer(data.player);
      setForm(playerToForm(data.player));
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to load.');
    } finally {
      setFetching(false);
    }
  }, [params.orgSlug, params.teamId, params.playerId]);

  useEffect(() => { if (!assignmentsLoading) load(); }, [assignmentsLoading, load]);

  const isDirty = player && form && (
    form.playerFirstName   !== player.playerFirstName   ||
    form.playerLastName    !== player.playerLastName    ||
    form.playerDateOfBirth !== (player.playerDateOfBirth ?? '') ||
    form.playerNumber      !== (player.playerNumber ?? '')      ||
    form.guardianFirstName !== (player.guardianFirstName ?? '') ||
    form.guardianLastName  !== (player.guardianLastName ?? '')  ||
    form.guardianEmail     !== (player.guardianEmail ?? '')     ||
    form.guardianPhone     !== (player.guardianPhone ?? '')     ||
    form.notes             !== (player.notes ?? '')             ||
    form.adminNotes        !== (player.adminNotes ?? '')
  );

  async function handleSave() {
    if (!form || !player) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/coaches/${params.orgSlug}/teams/${params.teamId}/roster/${params.playerId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerFirstName:    form.playerFirstName.trim(),
            playerLastName:     form.playerLastName.trim(),
            playerDateOfBirth:  form.playerDateOfBirth || null,
            playerNumber:       form.playerNumber.trim() || null,
            guardianFirstName:  form.guardianFirstName.trim(),
            guardianLastName:   form.guardianLastName.trim(),
            guardianEmail:      form.guardianEmail.trim(),
            guardianPhone:      form.guardianPhone.trim() || null,
            notes:              form.notes.trim() || null,
            adminNotes:         form.adminNotes.trim() || null,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');
      setPlayer(data.player);
      setForm(playerToForm(data.player));
      showFeedback('success', 'Player saved.');
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus() {
    if (!player) return;
    const newStatus = player.status === 'active' ? 'inactive' : 'active';
    setTogglingStatus(true);
    try {
      const res = await fetch(
        `/api/coaches/${params.orgSlug}/teams/${params.teamId}/roster/${params.playerId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to update status');
      setPlayer(data.player);
      setForm(playerToForm(data.player));
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to update status.');
    } finally {
      setTogglingStatus(false);
    }
  }

  const base = `/${params.orgSlug}/coaches/teams/${params.teamId}`;

  if (assignmentsLoading || fetching) return <p className={styles.muted}>Loading…</p>;
  if (!assignment) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }
  if (!player || !form) return <p className={styles.muted}>Player not found.</p>;

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <Link href={`/${params.orgSlug}/coaches`}>Coaches Portal</Link>
        <span><ChevronRight size={12} /></span>
        <Link href={base}>{assignment.teamName}</Link>
        <span><ChevronRight size={12} /></span>
        <Link href={`${base}/roster`}>Roster</Link>
        <span><ChevronRight size={12} /></span>
        <span>{player.playerFirstName} {player.playerLastName}</span>
      </div>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div>
            <h1 className={styles.pageTitle}>{player.playerFirstName} {player.playerLastName}</h1>
            <p className={styles.pageSub}>{assignment.teamName} — {assignment.programYearName}</p>
          </div>
        </div>
      </div>

      {/* Status row */}
      <div className={styles.statusRow}>
        <span className={styles.statusLabel}>Status</span>
        <span className={`${styles.badge} ${STATUS_CSS[player.status] ?? styles.badgeDraft}`}>
          {player.status === 'active' ? 'Active' : 'Inactive'}
        </span>
        <span className={`${styles.badge} ${player.source === 'tryout' ? styles.badgeTryout : styles.badgeManual}`}>
          {player.source === 'tryout' ? 'Tryout' : 'Manual'}
        </span>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ fontSize: '0.82rem', marginLeft: 'auto', opacity: togglingStatus ? 0.5 : 1 }}
          disabled={togglingStatus}
          onClick={handleToggleStatus}
        >
          {togglingStatus ? '…' : player.status === 'active' ? 'Deactivate' : 'Activate'}
        </button>
      </div>

      {/* Player info */}
      <div className={styles.detailSection}>
        <p className={styles.detailSectionTitle}>Player</p>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="pfn">First Name</label>
            <input id="pfn" className={styles.input} type="text"
              value={form.playerFirstName}
              onChange={e => setForm(f => f ? { ...f, playerFirstName: e.target.value } : f)}
              maxLength={60} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="pln">Last Name</label>
            <input id="pln" className={styles.input} type="text"
              value={form.playerLastName}
              onChange={e => setForm(f => f ? { ...f, playerLastName: e.target.value } : f)}
              maxLength={60} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="pdob">Date of Birth</label>
            <input id="pdob" className={styles.input} type="date"
              value={form.playerDateOfBirth}
              onChange={e => setForm(f => f ? { ...f, playerDateOfBirth: e.target.value } : f)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="pnum">Jersey #</label>
            <input id="pnum" className={styles.input} type="text"
              value={form.playerNumber}
              onChange={e => setForm(f => f ? { ...f, playerNumber: e.target.value } : f)}
              maxLength={10} />
          </div>
          <div className={`${styles.field} ${styles.formGridFull}`}>
            <label className={styles.label} htmlFor="pnotes">Notes</label>
            <textarea id="pnotes" className={styles.textarea} rows={2}
              value={form.notes}
              onChange={e => setForm(f => f ? { ...f, notes: e.target.value } : f)}
              maxLength={500} />
          </div>
        </div>
      </div>

      {/* Guardian info */}
      <div className={styles.detailSection}>
        <p className={styles.detailSectionTitle}>Guardian</p>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="gfn">First Name</label>
            <input id="gfn" className={styles.input} type="text"
              value={form.guardianFirstName}
              onChange={e => setForm(f => f ? { ...f, guardianFirstName: e.target.value } : f)}
              maxLength={60} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="gln">Last Name</label>
            <input id="gln" className={styles.input} type="text"
              value={form.guardianLastName}
              onChange={e => setForm(f => f ? { ...f, guardianLastName: e.target.value } : f)}
              maxLength={60} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="gem">Email</label>
            <input id="gem" className={styles.input} type="email"
              value={form.guardianEmail}
              onChange={e => setForm(f => f ? { ...f, guardianEmail: e.target.value } : f)}
              maxLength={120} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="gph">Phone</label>
            <input id="gph" className={styles.input} type="tel"
              value={form.guardianPhone}
              onChange={e => setForm(f => f ? { ...f, guardianPhone: e.target.value } : f)}
              maxLength={20} />
          </div>
        </div>
      </div>

      {/* Admin notes */}
      <div className={styles.detailSection}>
        <p className={styles.detailSectionTitle}>Admin Notes (private)</p>
        <textarea className={styles.textarea} rows={3}
          value={form.adminNotes}
          onChange={e => setForm(f => f ? { ...f, adminNotes: e.target.value } : f)}
          placeholder="Internal notes — not visible to families"
          maxLength={1000} />
      </div>

      {/* Save bar */}
      {isDirty && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button type="button" className="btn btn-ghost" onClick={() => setForm(playerToForm(player))}>
            Discard
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Documents */}
      <div className={styles.detailSection}>
        <PlayerDocumentsSection
          orgSlug={params.orgSlug}
          teamId={params.teamId}
          playerId={params.playerId}
        />
      </div>

      {/* Dues placeholder */}
      <div className={styles.detailSection}>
        <p className={styles.detailSectionTitle}>Dues</p>
        <p className={styles.detailPlaceholder}>Dues configuration and payment tracking coming in a future phase.</p>
      </div>

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
