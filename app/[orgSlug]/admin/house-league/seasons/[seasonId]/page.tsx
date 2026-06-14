'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, Users, Pencil, Trash2, X, Plus, ExternalLink } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import FeedbackModal from '@/components/FeedbackModal';
import { LeagueCapUpgradeModal } from '@/components/admin/LeagueCapUpgrade';
import { isFreeFloorLeague } from '@/lib/free-floor';
import { fireLeagueEvent } from '@/lib/league-events-client';
import HelpCallout from '@/components/help/HelpCallout';
import HelpTooltip from '@/components/help/HelpTooltip';
import styles from '../../house-league.module.css';
import type { LeagueSeason, LeagueSeasonStatus } from '@/lib/types';
import type { LeagueCapKind } from '@/lib/free-floor';

// ── Types ──────────────────────────────────────────────────────────────────────

interface DivisionWithStats {
  id: string;
  seasonId: string;
  name: string;
  capacity: number | null;
  sortOrder: number;
  createdAt: string;
  activeCount: number;
  waitlistCount: number;
  teamCount: number;
}

interface SeasonDetail {
  season: LeagueSeason;
  divisions: DivisionWithStats[];
  summary: {
    activeRegistrationCount: number;
    waitlistCount: number;
    pendingReviewCount: number;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

const STATUS_LABELS: Record<string, string> = {
  draft:                'Draft',
  registration_open:    'Registration Open',
  registration_closed:  'Registration Closed',
  active:               'Active',
  completed:            'Completed',
  archived:             'Archived',
};

const STATUS_CSS: Record<string, string> = {
  draft:                styles.statusDraft,
  registration_open:    styles.statusRegistrationOpen,
  registration_closed:  styles.statusRegistrationClosed,
  active:               styles.statusActive,
  completed:            styles.statusCompleted,
  archived:             styles.statusArchived,
};

// The next allowed transition for each status (single forward step)
const NEXT_TRANSITION: Record<string, { status: LeagueSeasonStatus; label: string } | null> = {
  draft:                { status: 'registration_open',   label: 'Open Registration' },
  registration_open:    { status: 'registration_closed', label: 'Close Registration' },
  registration_closed:  { status: 'active',              label: 'Activate Season' },
  active:               { status: 'completed',           label: 'Complete Season' },
  completed:            { status: 'archived',            label: 'Archive Season' },
  archived:             null,
};

// ── Edit season form ───────────────────────────────────────────────────────────

interface EditForm {
  name: string;
  division: string;
  description: string;
  seasonStartDate: string;
  seasonEndDate: string;
  registrationFee: string;
  registrationOpenAt: string;
  registrationCloseAt: string;
  waiverText: string;
  autoApproveUnderCapacity: boolean;
  autoPromoteWaitlist: boolean;
  autoGenerateFees: boolean;
}

function seasonToEditForm(s: LeagueSeason): EditForm {
  return {
    name:                     s.name,
    division:                 s.division ?? '',
    description:              s.description ?? '',
    seasonStartDate:          s.seasonStartDate ?? '',
    seasonEndDate:            s.seasonEndDate ?? '',
    registrationFee:          s.registrationFee != null ? String(s.registrationFee) : '',
    registrationOpenAt:       s.registrationOpenAt
      ? s.registrationOpenAt.slice(0, 16)
      : '',
    registrationCloseAt:      s.registrationCloseAt
      ? s.registrationCloseAt.slice(0, 16)
      : '',
    waiverText:               s.waiverText ?? '',
    autoApproveUnderCapacity: s.autoApproveUnderCapacity,
    autoPromoteWaitlist:      s.autoPromoteWaitlist,
    autoGenerateFees:         s.autoGenerateFees,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SeasonDetailPage() {
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const { seasonId } = useParams<{ seasonId: string }>();
  const base = `/${currentOrg?.slug ?? ''}/admin`;
  const isAdmin = userRole === 'owner' || userRole === 'league_admin';

  const [detail,    setDetail]    = useState<SeasonDetail | null>(null);
  const [fetching,  setFetching]  = useState(true);

  // Edit season modal
  const [editOpen,  setEditOpen]  = useState(false);
  const [editForm,  setEditForm]  = useState<EditForm | null>(null);
  const [saving,    setSaving]    = useState(false);

  // Add division modal
  const [addDivOpen,    setAddDivOpen]    = useState(false);
  const [newDivName,    setNewDivName]    = useState('');
  const [newDivCap,     setNewDivCap]     = useState('');
  const [addingDiv,     setAddingDiv]     = useState(false);
  const [capHit,        setCapHit]        = useState<LeagueCapKind | null>(null);

  // Edit division modal
  const [editDivId,     setEditDivId]     = useState<string | null>(null);
  const [editDivName,   setEditDivName]   = useState('');
  const [editDivCap,    setEditDivCap]    = useState('');
  const [savingDiv,     setSavingDiv]     = useState(false);

  // Delete division confirm
  const [deleteDivId,   setDeleteDivId]   = useState<string | null>(null);
  const [deletingDiv,   setDeletingDiv]   = useState(false);

  // Lifecycle transition
  const [transitioningTo, setTransitioningTo] = useState<LeagueSeasonStatus | null>(null);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'success' | 'danger'>('success');
  const [feedbackMsg,  setFeedbackMsg]  = useState('');

  function showFeedback(type: 'success' | 'danger', msg: string) {
    setFeedbackType(type); setFeedbackMsg(msg); setFeedbackOpen(true);
  }

  const load = useCallback(async () => {
    if (!seasonId) return;
    setFetching(true);
    try {
      const res  = await fetch(`/api/admin/house-league/seasons/${seasonId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setDetail(data);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to load season.');
    } finally {
      setFetching(false);
    }
  }, [seasonId]);

  useEffect(() => {
    if (currentOrg && seasonId) load();
  }, [currentOrg, seasonId, load]);

  // ── Edit season ──────────────────────────────────────────────────────────────

  function openEdit() {
    if (!detail) return;
    setEditForm(seasonToEditForm(detail.season));
    setEditOpen(true);
  }

  async function handleSave() {
    if (!editForm || !detail) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/house-league/seasons/${seasonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:                     editForm.name.trim() || undefined,
          division:                 editForm.division.trim() || null,
          description:              editForm.description.trim() || null,
          seasonStartDate:          editForm.seasonStartDate || null,
          seasonEndDate:            editForm.seasonEndDate   || null,
          registrationFee:          editForm.registrationFee ? parseFloat(editForm.registrationFee) : null,
          registrationOpenAt:       editForm.registrationOpenAt  ? editForm.registrationOpenAt  + ':00Z' : null,
          registrationCloseAt:      editForm.registrationCloseAt ? editForm.registrationCloseAt + ':00Z' : null,
          waiverText:               editForm.waiverText.trim() || null,
          autoApproveUnderCapacity: editForm.autoApproveUnderCapacity,
          autoPromoteWaitlist:      editForm.autoPromoteWaitlist,
          autoGenerateFees:         editForm.autoGenerateFees,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');
      setEditOpen(false);
      await load();
      showFeedback('success', 'Season updated.');
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to save season.');
    } finally {
      setSaving(false);
    }
  }

  // ── Lifecycle transition ─────────────────────────────────────────────────────

  async function handleTransition(newStatus: LeagueSeasonStatus) {
    setTransitioningTo(newStatus);
    try {
      const res = await fetch(`/api/admin/house-league/seasons/${seasonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to update status');
      await load();
      showFeedback('success', `Season is now ${STATUS_LABELS[newStatus] ?? newStatus}.`);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to update season status.');
    } finally {
      setTransitioningTo(null);
    }
  }

  // ── Add division ─────────────────────────────────────────────────────────────

  function openAddDiv() {
    setNewDivName('');
    setNewDivCap('');
    setAddDivOpen(true);
  }

  async function handleAddDivision() {
    if (!newDivName.trim()) return;
    setAddingDiv(true);
    try {
      const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/divisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:     newDivName.trim(),
          capacity: newDivCap ? parseInt(newDivCap, 10) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Free-floor cap hit → upgrade-aware modal instead of a generic error.
        if (data.capHit) { setAddDivOpen(false); setCapHit(data.capHit); return; }
        throw new Error(data.error ?? 'Failed to create division');
      }
      setAddDivOpen(false);
      await load();
      showFeedback('success', `Division "${newDivName}" added.`);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to add division.');
    } finally {
      setAddingDiv(false);
    }
  }

  // ── Edit division ────────────────────────────────────────────────────────────

  function openEditDiv(div: DivisionWithStats) {
    setEditDivId(div.id);
    setEditDivName(div.name);
    setEditDivCap(div.capacity != null ? String(div.capacity) : '');
  }

  async function handleSaveDivision() {
    if (!editDivId) return;
    setSavingDiv(true);
    try {
      const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/divisions/${editDivId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:     editDivName.trim() || undefined,
          capacity: editDivCap ? parseInt(editDivCap, 10) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save division');
      setEditDivId(null);
      await load();
      showFeedback('success', 'Division updated.');
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to update division.');
    } finally {
      setSavingDiv(false);
    }
  }

  // ── Delete division ──────────────────────────────────────────────────────────

  async function handleDeleteDivision() {
    if (!deleteDivId) return;
    setDeletingDiv(true);
    try {
      const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/divisions/${deleteDivId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete division');
      setDeleteDivId(null);
      await load();
      showFeedback('success', 'Division deleted.');
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to delete division.');
    } finally {
      setDeletingDiv(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) return <p className={styles.muted}>Loading…</p>;

  if (!userRole || !hasCapability(userRole, userCapabilities, 'module_house_league')) {
    return (
      <div className={styles.accessDenied}>
        <Users size={32} />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have access to the House League module. Contact your organization owner to enable it.</p>
      </div>
    );
  }

  if (fetching) return <p className={styles.muted}>Loading…</p>;
  if (!detail)  return <p className={styles.muted}>Season not found.</p>;

  const { season, divisions, summary } = detail;
  const nextTransition = NEXT_TRANSITION[season.status];

  return (
    <div className={styles.page}>
      {/* Back link */}
      <div style={{ marginBottom: '1rem' }}>
        <Link
          href={`${base}/house-league`}
          style={{ fontSize: '0.82rem', color: 'var(--white-40)', textDecoration: 'none' }}
        >
          ← All Seasons
        </Link>
      </div>

      {/* Season header */}
      <div className={styles.seasonHeader}>
        <div className={styles.seasonHeaderTop}>
          <div className={styles.seasonHeaderLeft}>
            <h1 className={styles.seasonHeaderName}>{season.name}</h1>
            <div className={styles.seasonHeaderBadges}>
              {season.division && (
                <span className={styles.divisionBadge}>{season.division}</span>
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <span className={`${styles.statusBadge} ${STATUS_CSS[season.status] ?? ''}`}>
                  {STATUS_LABELS[season.status] ?? season.status}
                </span>
                <HelpTooltip
                  title="Season statuses"
                  body="Draft: configuration only, not visible publicly. Registration Open: public form is live for parents. Registration Closed: building teams and schedule. Active: games underway. Completed: season is over. Archived: season is retired."
                />
              </span>
            </div>

            {/* Quick stats */}
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              {[
                { label: 'Active', value: summary.activeRegistrationCount },
                { label: 'Pending', value: summary.pendingReviewCount },
                { label: 'Waitlist', value: summary.waitlistCount },
                { label: 'Divisions', value: divisions.length },
              ].map(({ label, value }) =>
                value > 0 || label === 'Divisions' ? (
                  <div key={label} className={styles.statItem}>
                    <span className={styles.statLabel}>{label}</span>
                    <span className={styles.statValue}>{value}</span>
                  </div>
                ) : null,
              )}
            </div>
          </div>

          <div className={styles.seasonHeaderActions}>
            {/* Public-facing season page (schedule / standings / registration). Only live once the
                season leaves draft — the public route 404s on draft seasons. */}
            {season.status !== 'draft' && currentOrg?.slug && (
              <a
                href={`/${currentOrg.slug}/league/${season.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem' }}
                onClick={() => {
                  // §13 League Starter first-value signal (share). Gated to the free floor so the
                  // metric tracks free-tier sharing, not every house-league org. Fire-and-forget.
                  if (currentOrg && isFreeFloorLeague(currentOrg)) {
                    fireLeagueEvent('league_public_page_shared', { orgId: currentOrg.id, metadata: { seasonId: season.id } });
                  }
                }}
              >
                <ExternalLink size={13} style={{ marginRight: 4 }} />
                View public page
              </a>
            )}
            {isAdmin && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem' }}
                onClick={openEdit}
              >
                <Pencil size={13} style={{ marginRight: 4 }} />
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Dates row */}
        {(season.seasonStartDate || season.seasonEndDate || season.registrationOpenAt || season.registrationFee) && (
          <div className={styles.seasonDates}>
            {(season.seasonStartDate || season.seasonEndDate) && (
              <div className={styles.datePair}>
                <span className={styles.dateLabel}>Season Dates</span>
                <span className={styles.dateValue}>
                  {formatDate(season.seasonStartDate)} — {formatDate(season.seasonEndDate)}
                </span>
              </div>
            )}
            {season.registrationOpenAt && (
              <div className={styles.datePair}>
                <span className={styles.dateLabel}>Registration Opens</span>
                <span className={styles.dateValue}>{formatDate(season.registrationOpenAt)}</span>
              </div>
            )}
            {season.registrationCloseAt && (
              <div className={styles.datePair}>
                <span className={styles.dateLabel}>Registration Closes</span>
                <span className={styles.dateValue}>{formatDate(season.registrationCloseAt)}</span>
              </div>
            )}
            {season.registrationFee != null && (
              <div className={styles.datePair}>
                <span className={styles.dateLabel}>Registration Fee</span>
                <span className={styles.dateValue}>${season.registrationFee.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lifecycle controls — admin only */}
      {isAdmin && nextTransition && (
        <>
          {nextTransition.status === 'registration_open' && (
            <div style={{ marginBottom: '0.75rem' }}>
              <HelpCallout
                variant="tip"
                title="Opening registration publishes the public form"
                body="Once registration opens, parents can submit registrations online. You can close it again at any time from this page."
              />
            </div>
          )}
          <div className={styles.lifecycleBar}>
            <span className={styles.lifecycleLabel}>Status</span>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem' }}
              disabled={transitioningTo !== null}
              onClick={() => handleTransition(nextTransition.status)}
            >
              {transitioningTo ? 'Updating…' : nextTransition.label}
            </button>
            {season.status === 'draft' && divisions.length === 0 && (
              <span className={styles.lifecycleHint}>
                Add at least one division before opening registration.
              </span>
            )}
          </div>
        </>
      )}

      {/* Divisions section */}
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Divisions</span>
        {isAdmin && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }}
            onClick={openAddDiv}
          >
            <Plus size={13} style={{ marginRight: 3 }} />
            Add Division
          </button>
        )}
      </div>

      {divisions.length === 0 ? (
        <div className={styles.emptyState} style={{ padding: '2rem 1rem' }}>
          <p>No divisions yet.</p>
          {isAdmin && (
            <p>
              <button type="button" className="btn btn-secondary" style={{ marginTop: '0.5rem', fontSize: '0.82rem' }} onClick={openAddDiv}>
                Add your first division
              </button>
            </p>
          )}
        </div>
      ) : (
        <div className={styles.divisionGrid}>
          {divisions.map(div => (
            <DivisionCard
              key={div.id}
              div={div}
              seasonId={season.id}
              base={base}
              isAdmin={isAdmin}
              onEdit={() => openEditDiv(div)}
              onDelete={() => setDeleteDivId(div.id)}
            />
          ))}
        </div>
      )}

      {/* Edit Season modal */}
      {editOpen && editForm && (
        <div className={styles.modalOverlay} onClick={() => setEditOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Edit Season</h3>
              <button className={styles.modalCloseBtn} onClick={() => setEditOpen(false)}><X size={16} /></button>
            </div>

            <div className={styles.formGrid}>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="es-name">Name</label>
                <input
                  id="es-name"
                  className={styles.input}
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm(f => f && ({ ...f, name: e.target.value }))}
                  maxLength={120}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="es-age">Division</label>
                <input
                  id="es-age"
                  className={styles.input}
                  type="text"
                  value={editForm.division}
                  onChange={e => setEditForm(f => f && ({ ...f, division: e.target.value }))}
                  placeholder="e.g. U11, Adult"
                  maxLength={30}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="es-fee">Registration Fee (CAD)</label>
                <input
                  id="es-fee"
                  className={styles.input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.registrationFee}
                  onChange={e => setEditForm(f => f && ({ ...f, registrationFee: e.target.value }))}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="es-start">Season Start</label>
                <input
                  id="es-start"
                  className={styles.input}
                  type="date"
                  value={editForm.seasonStartDate}
                  onChange={e => setEditForm(f => f && ({ ...f, seasonStartDate: e.target.value }))}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="es-end">Season End</label>
                <input
                  id="es-end"
                  className={styles.input}
                  type="date"
                  value={editForm.seasonEndDate}
                  onChange={e => setEditForm(f => f && ({ ...f, seasonEndDate: e.target.value }))}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="es-reg-open">Registration Opens</label>
                <input
                  id="es-reg-open"
                  className={styles.input}
                  type="datetime-local"
                  value={editForm.registrationOpenAt}
                  onChange={e => setEditForm(f => f && ({ ...f, registrationOpenAt: e.target.value }))}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="es-reg-close">Registration Closes</label>
                <input
                  id="es-reg-close"
                  className={styles.input}
                  type="datetime-local"
                  value={editForm.registrationCloseAt}
                  onChange={e => setEditForm(f => f && ({ ...f, registrationCloseAt: e.target.value }))}
                />
              </div>

              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="es-desc">Description</label>
                <textarea
                  id="es-desc"
                  className={styles.textarea}
                  value={editForm.description}
                  onChange={e => setEditForm(f => f && ({ ...f, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="es-waiver">Waiver Text</label>
                <textarea
                  id="es-waiver"
                  className={styles.textarea}
                  value={editForm.waiverText}
                  onChange={e => setEditForm(f => f && ({ ...f, waiverText: e.target.value }))}
                  rows={4}
                  placeholder="Optional waiver shown on the public registration form"
                />
              </div>
            </div>

            <div className={styles.automationSection} style={{ marginTop: '1rem' }}>
              <p className={styles.automationSectionTitle}>Automation</p>
              {[
                {
                  key: 'autoApproveUnderCapacity' as const,
                  title: 'Auto-approve under capacity',
                  desc: 'New submissions go directly to Active status while a division has open spots.',
                },
                {
                  key: 'autoPromoteWaitlist' as const,
                  title: 'Auto-promote from waitlist',
                  desc: 'Automatically advance the next waitlisted player when a spot opens.',
                },
                {
                  key: 'autoGenerateFees' as const,
                  title: 'Auto-generate fee entries',
                  desc: 'Create an accounting entry when a registration is approved.',
                },
              ].map(({ key, title, desc }) => (
                <div key={key} className={styles.toggleRow}>
                  <div className={styles.toggleInfo}>
                    <div className={styles.toggleTitle}>{title}</div>
                    <div className={styles.toggleDesc}>{desc}</div>
                  </div>
                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      checked={editForm[key]}
                      onChange={e => setEditForm(f => f && ({ ...f, [key]: e.target.checked }))}
                    />
                    <span className={styles.toggleSlider} />
                  </label>
                </div>
              ))}
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditOpen(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !editForm.name.trim()}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Division modal */}
      {addDivOpen && (
        <div className={styles.modalOverlay} onClick={() => setAddDivOpen(false)}>
          <div className={styles.modal} style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Add Division</h3>
              <button className={styles.modalCloseBtn} onClick={() => setAddDivOpen(false)}><X size={16} /></button>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="div-name">Division Name <span style={{ color: '#f87171' }}>*</span></label>
              <input
                id="div-name"
                className={styles.input}
                type="text"
                value={newDivName}
                onChange={e => setNewDivName(e.target.value)}
                placeholder="e.g. Division A, East"
                maxLength={100}
                autoFocus
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="div-cap">Capacity (optional)</label>
              <input
                id="div-cap"
                className={styles.input}
                type="number"
                min="1"
                step="1"
                value={newDivCap}
                onChange={e => setNewDivCap(e.target.value)}
                placeholder="Leave blank for unlimited"
              />
              <p className={styles.hint}>Maximum number of active registrations for this division.</p>
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className="btn btn-ghost" onClick={() => setAddDivOpen(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAddDivision}
                disabled={addingDiv || !newDivName.trim()}
              >
                {addingDiv ? 'Adding…' : 'Add Division'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Division modal */}
      {editDivId && (
        <div className={styles.modalOverlay} onClick={() => setEditDivId(null)}>
          <div className={styles.modal} style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Edit Division</h3>
              <button className={styles.modalCloseBtn} onClick={() => setEditDivId(null)}><X size={16} /></button>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="ediv-name">Division Name</label>
              <input
                id="ediv-name"
                className={styles.input}
                type="text"
                value={editDivName}
                onChange={e => setEditDivName(e.target.value)}
                maxLength={100}
                autoFocus
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="ediv-cap">Capacity</label>
              <input
                id="ediv-cap"
                className={styles.input}
                type="number"
                min="1"
                step="1"
                value={editDivCap}
                onChange={e => setEditDivCap(e.target.value)}
                placeholder="Leave blank for unlimited"
              />
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditDivId(null)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveDivision}
                disabled={savingDiv || !editDivName.trim()}
              >
                {savingDiv ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Division confirm */}
      {deleteDivId && (
        <div className={styles.modalOverlay} onClick={() => setDeleteDivId(null)}>
          <div className={styles.modal} style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Delete Division</h3>
              <button className={styles.modalCloseBtn} onClick={() => setDeleteDivId(null)}><X size={16} /></button>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--white-70)', margin: '0 0 1rem' }}>
              Are you sure? This cannot be undone. Divisions with registrations cannot be deleted.
            </p>
            <div className={styles.modalFooter}>
              <button type="button" className="btn btn-ghost" onClick={() => setDeleteDivId(null)}>Cancel</button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteDivision}
                disabled={deletingDiv}
              >
                {deletingDiv ? 'Deleting…' : 'Delete Division'}
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

      {capHit && <LeagueCapUpgradeModal capHit={capHit} onClose={() => setCapHit(null)} orgId={currentOrg?.id} />}
    </div>
  );
}

// ── Division Card ──────────────────────────────────────────────────────────────

function DivisionCard({
  div,
  seasonId,
  base,
  isAdmin,
  onEdit,
  onDelete,
}: {
  div: DivisionWithStats;
  seasonId: string;
  base: string;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const seasonBase = `${base}/house-league/seasons/${seasonId}`;
  const pct = div.capacity ? Math.min(100, Math.round((div.activeCount / div.capacity) * 100)) : 0;
  const isFull = div.capacity != null && div.activeCount >= div.capacity;

  return (
    <div className={styles.divisionCard}>
      <div className={styles.divisionCardHeader}>
        <span className={styles.divisionName}>{div.name}</span>
        {isAdmin && (
          <div className={styles.divisionCardActions}>
            <button type="button" className={styles.iconBtn} onClick={onEdit} title="Edit division">
              <Pencil size={13} />
            </button>
            <button type="button" className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={onDelete} title="Delete division">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Capacity bar */}
      <div className={styles.capacityWrap}>
        <span className={styles.capacityLabel}>Registrations</span>
        {div.capacity != null ? (
          <>
            <div className={styles.capacityBar}>
              <div
                className={`${styles.capacityFill} ${isFull ? styles.capacityFillFull : ''}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={styles.capacityText}>
              {div.activeCount} / {div.capacity}
              {div.waitlistCount > 0 && ` · ${div.waitlistCount} waitlisted`}
            </span>
          </>
        ) : (
          <span className={styles.capacityText}>
            {div.activeCount} active
            {div.waitlistCount > 0 && ` · ${div.waitlistCount} waitlisted`}
          </span>
        )}
      </div>

      {/* Team count */}
      {div.teamCount > 0 && (
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Teams</span>
          <span className={styles.statValue}>{div.teamCount}</span>
        </div>
      )}

      {/* Sub-page links */}
      <div className={styles.divisionLinks}>
        <Link href={`${seasonBase}/registrations`} className={styles.divisionLink}>Registrations</Link>
        <Link href={`${seasonBase}/teams`}         className={styles.divisionLink}>Teams</Link>
        <Link href={`${seasonBase}/schedule`}      className={styles.divisionLink}>Schedule</Link>
        <Link href={`${seasonBase}/standings`}     className={styles.divisionLink}>Standings</Link>
        <Link href={`${seasonBase}/ledger`}        className={styles.divisionLink}>Ledger</Link>
      </div>
    </div>
  );
}
