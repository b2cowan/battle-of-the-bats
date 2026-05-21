'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ClipboardList, X, Plus, ChevronRight } from 'lucide-react';
import HelpCallout from '@/components/help/HelpCallout';
import HelpTooltip from '@/components/help/HelpTooltip';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import FeedbackModal from '@/components/FeedbackModal';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
} from '@/lib/export';
import ExportMenu from '@/components/admin/ExportMenu';
import styles from '../../../../../rep-teams.module.css';
import type { RepTryoutRegistration, RepTryoutRegistrationStatus } from '@/lib/types';

type Tab = 'pending_review' | 'offered' | 'accepted' | 'declined_withdrawn' | 'all';

const TAB_LABELS: Record<Tab, string> = {
  pending_review:    'Pending Review',
  offered:           'Offer Extended',
  accepted:          'Accepted',
  declined_withdrawn:'Declined / Withdrawn',
  all:               'All',
};

const STATUS_LABEL: Record<string, string> = {
  pending_review: 'Pending Review',
  offered:        'Offer Extended',
  accepted:       'Accepted',
  declined:       'Declined',
  withdrawn:      'Withdrawn',
};

const STATUS_CSS: Record<string, string> = {
  pending_review: styles.badgePendingReview,
  offered:        styles.badgeOffered,
  accepted:       styles.badgeActive,
  declined:       styles.badgeArchived,
  withdrawn:      styles.badgeDraft,
};

interface TeamYearInfo {
  team:        { id: string; name: string; slug: string };
  programYear: { id: string; name: string; tryoutOpen: boolean };
}

interface AddForm {
  playerFirstName: string; playerLastName: string;
  playerDateOfBirth: string; playerNotes: string;
  guardianFirstName: string; guardianLastName: string;
  guardianEmail: string; guardianPhone: string;
}

const BLANK: AddForm = {
  playerFirstName: '', playerLastName: '', playerDateOfBirth: '', playerNotes: '',
  guardianFirstName: '', guardianLastName: '', guardianEmail: '', guardianPhone: '',
};

// ── Export definition ─────────────────────────────────────────────────────────

const TRYOUT_EXPORT_COLS: ExportColumnDef[] = [
  { label: 'First Name',       key: 'playerFirstName',  format: 'text' },
  { label: 'Last Name',        key: 'playerLastName',   format: 'text' },
  { label: 'Date of Birth',    key: 'playerDateOfBirth',format: 'date',     sensitive: true },
  { label: 'Guardian Name',    key: 'guardianName',     format: 'text',     sensitive: true },
  { label: 'Guardian Email',   key: 'guardianEmail',    format: 'text',     sensitive: true },
  { label: 'Guardian Phone',   key: 'guardianPhone',    format: 'text',     sensitive: true },
  { label: 'Player Notes',     key: 'playerNotes',      format: 'text',     sensitive: true },
  { label: 'Admin Notes',      key: 'adminNotes',       format: 'text',     sensitive: true },
  { label: 'Submitted At',     key: 'submittedAt',      format: 'date' },
  { label: 'Status',           key: 'status',           format: 'text' },
];

export default function TryoutsPage({
  params,
}: {
  params: { orgSlug: string; teamId: string; yearId: string };
}) {
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const base = `/${currentOrg?.slug ?? ''}/admin`;
  const canWrite = userRole === 'owner' || userRole === 'admin';

  const [info, setInfo] = useState<TeamYearInfo | null>(null);
  const [registrations, setRegistrations] = useState<RepTryoutRegistration[]>([]);
  const [fetching, setFetching] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('pending_review');
  const [selected, setSelected] = useState<RepTryoutRegistration | null>(null);
  const [detailNotes, setDetailNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [togglingOpen, setTogglingOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(BLANK);
  const [adding, setAdding] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'success' | 'danger'>('success');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  function showFeedback(type: 'success' | 'danger', msg: string) {
    setFeedbackType(type); setFeedbackMsg(msg); setFeedbackOpen(true);
  }

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const [infoRes, regRes] = await Promise.all([
        fetch(`/api/admin/rep-teams/teams/${params.teamId}/program-years/${params.yearId}`),
        fetch(`/api/admin/rep-teams/teams/${params.teamId}/program-years/${params.yearId}/tryouts`),
      ]);
      const [infoData, regData] = await Promise.all([infoRes.json(), regRes.json()]);
      if (!infoRes.ok) throw new Error(infoData.error ?? 'Failed to load');
      if (!regRes.ok) throw new Error(regData.error ?? 'Failed to load registrations');
      setInfo({ team: infoData.team, programYear: infoData.programYear });
      setRegistrations(regData.registrations ?? []);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to load.');
    } finally {
      setFetching(false);
    }
  }, [params.teamId, params.yearId]);

  useEffect(() => { if (currentOrg) load(); }, [currentOrg, load]);

  useEffect(() => { setDetailNotes(selected?.adminNotes ?? ''); }, [selected?.id]);

  const filtered = useMemo(() => registrations.filter(r => {
    if (activeTab === 'all') return true;
    if (activeTab === 'declined_withdrawn') return r.status === 'declined' || r.status === 'withdrawn';
    return r.status === activeTab;
  }), [registrations, activeTab]);

  const counts = useMemo<Record<Tab, number>>(() => ({
    pending_review:    registrations.filter(r => r.status === 'pending_review').length,
    offered:           registrations.filter(r => r.status === 'offered').length,
    accepted:          registrations.filter(r => r.status === 'accepted').length,
    declined_withdrawn:registrations.filter(r => r.status === 'declined' || r.status === 'withdrawn').length,
    all:               registrations.length,
  }), [registrations]);

  async function handleAction(regId: string, newStatus: RepTryoutRegistrationStatus) {
    setActionLoading(regId);
    try {
      const res = await fetch(
        `/api/admin/rep-teams/teams/${params.teamId}/program-years/${params.yearId}/tryouts/${regId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Action failed');
      await load();
      setSelected(null);
      const msg =
        newStatus === 'offered'   ? 'Offer extended — guardian has been notified.' :
        newStatus === 'accepted'  ? 'Application accepted — player added to roster.' :
        newStatus === 'declined'  ? 'Application declined.' :
        newStatus === 'withdrawn' ? 'Marked as withdrawn.' : 'Updated.';
      showFeedback('success', msg);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Action failed.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSaveNotes() {
    if (!selected) return;
    setSavingNotes(true);
    try {
      const res = await fetch(
        `/api/admin/rep-teams/teams/${params.teamId}/program-years/${params.yearId}/tryouts/${selected.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminNotes: detailNotes }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save notes');
      setRegistrations(prev => prev.map(r => r.id === selected.id ? data.registration : r));
      setSelected(data.registration);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to save notes.');
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleToggleTryouts(open: boolean) {
    setTogglingOpen(true);
    try {
      const res = await fetch(
        `/api/admin/rep-teams/teams/${params.teamId}/program-years/${params.yearId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tryoutOpen: open }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to update');
      setInfo(prev => prev ? { ...prev, programYear: { ...prev.programYear, tryoutOpen: open } } : prev);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to update tryout registration status.');
    } finally {
      setTogglingOpen(false);
    }
  }

  async function handleManualAdd() {
    if (!addForm.playerFirstName.trim() || !addForm.playerLastName.trim() ||
        !addForm.guardianFirstName.trim() || !addForm.guardianLastName.trim() ||
        !addForm.guardianEmail.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(
        `/api/admin/rep-teams/teams/${params.teamId}/program-years/${params.yearId}/tryouts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerFirstName:  addForm.playerFirstName.trim(),
            playerLastName:   addForm.playerLastName.trim(),
            playerDateOfBirth: addForm.playerDateOfBirth || null,
            playerNotes:      addForm.playerNotes.trim() || null,
            guardianFirstName: addForm.guardianFirstName.trim(),
            guardianLastName:  addForm.guardianLastName.trim(),
            guardianEmail:    addForm.guardianEmail.trim(),
            guardianPhone:    addForm.guardianPhone.trim() || null,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to add applicant');
      setAddOpen(false);
      setAddForm(BLANK);
      await load();
      showFeedback('success', `${addForm.playerFirstName} ${addForm.playerLastName} added to Pending Review.`);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to add applicant.');
    } finally {
      setAdding(false);
    }
  }

  function handleCopyUrl() {
    if (!info?.team) return;
    const url = `${window.location.origin}/${params.orgSlug}/teams/${info.team.slug}/tryouts/${params.yearId}/register`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    });
  }

  // ── Export helpers ───────────────────────────────────────────────────────────

  function buildTryoutExportSrc() {
    return filtered.map(r => ({
      playerFirstName:  r.playerFirstName,
      playerLastName:   r.playerLastName,
      playerDateOfBirth: r.playerDateOfBirth ?? '',
      guardianName:     `${r.guardianFirstName} ${r.guardianLastName}`.trim(),
      guardianEmail:    r.guardianEmail,
      guardianPhone:    r.guardianPhone ?? '',
      playerNotes:      r.playerNotes ?? '',
      adminNotes:       r.adminNotes ?? '',
      submittedAt:      r.submittedAt.slice(0, 10),
      status:           STATUS_LABEL[r.status] ?? r.status,
    }));
  }

  async function handleExportXLSX() {
    if (!filtered.length) return;
    const headers = serializeHeaders(TRYOUT_EXPORT_COLS);
    const rows = serializeRows(buildTryoutExportSrc(), TRYOUT_EXPORT_COLS);
    await downloadXLSX(
      buildFilename({ org: currentOrg?.slug, dataset: 'tryouts', scope: info?.team?.name ?? params.teamId }, 'xlsx'),
      headers, rows, 'Tryout Applications',
    );
  }

  async function handleExportXLSXWithSensitive() {
    if (!filtered.length) return;
    const headers = serializeHeaders(TRYOUT_EXPORT_COLS, true);
    const rows = serializeRows(buildTryoutExportSrc(), TRYOUT_EXPORT_COLS, true);
    await downloadXLSX(
      buildFilename({ org: currentOrg?.slug, dataset: 'tryouts-with-contacts', scope: info?.team?.name ?? params.teamId }, 'xlsx'),
      headers, rows, 'Tryout Applications',
    );
  }

  function handleExportCSV() {
    const headers = serializeHeaders(TRYOUT_EXPORT_COLS);
    const rows = serializeRows(buildTryoutExportSrc(), TRYOUT_EXPORT_COLS);
    downloadCSVBlob(
      buildFilename({ org: currentOrg?.slug, dataset: 'tryouts', scope: info?.team?.name ?? params.teamId }, 'csv'),
      generateCSV(headers, rows),
    );
  }

  function handleExportPDF() {
    setFeedbackType('success');
    setFeedbackMsg('PDF export is coming soon.');
    setFeedbackOpen(true);
  }

  if (loading) return <p className={styles.muted}>Loading…</p>;

  if (!userRole || !hasCapability(userRole, userCapabilities, 'module_rep_teams')) {
    return (
      <div className={styles.accessDenied}>
        <ClipboardList size={32} />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have access to the Rep Teams module.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <Link href={`${base}/rep-teams`}>Rep Teams</Link>
        <span><ChevronRight size={12} /></span>
        {info?.team && (
          <Link href={`${base}/rep-teams/teams/${params.teamId}`}>{info.team.name}</Link>
        )}
        <span><ChevronRight size={12} /></span>
        {info?.programYear && (
          <Link href={`${base}/rep-teams/teams/${params.teamId}/program-years/${params.yearId}`}>
            {info.programYear.name}
          </Link>
        )}
        <span><ChevronRight size={12} /></span>
        <span>Tryouts</span>
      </div>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><ClipboardList size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Tryouts</h1>
            <p className={styles.pageSub}>{info?.team?.name} — {info?.programYear?.name}</p>
          </div>
        </div>
        {canWrite && (
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
              disabled={filtered.length === 0}
            />
            <button
              type="button"
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}
              onClick={() => { setAddForm(BLANK); setAddOpen(true); }}
            >
              <Plus size={14} /> Add Applicant
            </button>
          </div>
        )}
      </div>

      {fetching ? (
        <p className={styles.muted}>Loading…</p>
      ) : (
        <>
          {/* Open/Close toggle */}
          {canWrite && info?.programYear && (
            <div className={styles.tryoutToggleRow}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span className={styles.tryoutToggleLabel}>Registration</span>
                  <HelpTooltip
                    title="Tryout registration"
                    body="When tryouts are open, the public registration form is live on your org page. Applicants can register; you review and approve from the Tryouts tab."
                  />
                  <span className={`${styles.badge} ${info.programYear.tryoutOpen ? styles.badgeActive : styles.badgeDraft}`}>
                    {info.programYear.tryoutOpen ? 'Open' : 'Closed'}
                  </span>
                </div>
                {info.programYear.tryoutOpen && (
                  <div className={styles.tryoutUrlRow}>
                    <input
                      className={styles.tryoutUrlInput}
                      type="text"
                      readOnly
                      value={typeof window !== 'undefined'
                        ? `${window.location.origin}/${params.orgSlug}/teams/${info.team.slug}/tryouts/${params.yearId}/register`
                        : ''}
                      onClick={e => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                      onClick={handleCopyUrl}
                    >
                      {copiedUrl ? '✓ Copied' : 'Copy Link'}
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                className={`btn ${info.programYear.tryoutOpen ? 'btn-ghost' : 'btn-secondary'}`}
                style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                onClick={() => handleToggleTryouts(!info.programYear.tryoutOpen)}
                disabled={togglingOpen}
              >
                {togglingOpen ? '…' : info.programYear.tryoutOpen ? 'Close Registration' : 'Open Registration'}
              </button>
            </div>
          )}

          {registrations.length === 0 && (
            <HelpCallout
              variant="info"
              title="No applicants yet"
              body="Applicants appear here when the public tryout form is live. Review each one and offer, accept, or decline. Accepted players become available for the coach's roster."
            />
          )}

          {/* Tabs */}
          <div className={styles.tryoutTabs}>
            {(Object.entries(TAB_LABELS) as [Tab, string][]).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                className={`${styles.tryoutTab}${activeTab === tab ? ` ${styles.tryoutTabActive}` : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {label}
                {counts[tab] > 0 && (
                  <span className={styles.tryoutTabCount}>{counts[tab]}</span>
                )}
              </button>
            ))}
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className={styles.emptyState} style={{ padding: '2rem' }}>
              <p>No {activeTab !== 'all' ? TAB_LABELS[activeTab].toLowerCase() : ''} applications.</p>
            </div>
          ) : (
            <div className={styles.tryoutTableWrap}>
              <table className={styles.tryoutTable}>
                <thead>
                  <tr>
                    <th className={styles.tryoutTh}>Player</th>
                    <th className={styles.tryoutTh}>Date of Birth</th>
                    <th className={styles.tryoutTh}>Guardian Email</th>
                    <th className={styles.tryoutTh}>Submitted</th>
                    <th className={styles.tryoutTh}>Status</th>
                    {canWrite && <th className={styles.tryoutTh}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(reg => (
                    <tr
                      key={reg.id}
                      className={styles.tryoutTr}
                      onClick={() => setSelected(reg)}
                    >
                      <td className={styles.tryoutTd}>
                        <span className={styles.tryoutPlayerName}>
                          {reg.playerFirstName} {reg.playerLastName}
                        </span>
                      </td>
                      <td className={styles.tryoutTd} style={{ fontSize: '0.85rem' }}>
                        {reg.playerDateOfBirth
                          ? new Date(reg.playerDateOfBirth + 'T00:00:00').toLocaleDateString('en-CA')
                          : <span style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>}
                      </td>
                      <td className={styles.tryoutTd} style={{ fontSize: '0.85rem' }}>
                        {reg.guardianEmail}
                      </td>
                      <td className={styles.tryoutTd}>
                        <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>
                          {new Date(reg.submittedAt).toLocaleDateString('en-CA')}
                        </span>
                      </td>
                      <td className={styles.tryoutTd}>
                        <span className={`${styles.badge} ${STATUS_CSS[reg.status] ?? ''}`}>
                          {STATUS_LABEL[reg.status] ?? reg.status}
                        </span>
                      </td>
                      {canWrite && (
                        <td className={styles.tryoutTd} onClick={e => e.stopPropagation()}>
                          <div className={styles.tryoutActions}>
                            {reg.status === 'pending_review' && (
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}
                                disabled={actionLoading === reg.id}
                                onClick={() => handleAction(reg.id, 'offered')}
                              >
                                {actionLoading === reg.id ? '…' : 'Extend Offer'}
                              </button>
                            )}
                            {reg.status === 'offered' && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}
                                  disabled={actionLoading === reg.id}
                                  onClick={() => handleAction(reg.id, 'accepted')}
                                >
                                  {actionLoading === reg.id ? '…' : 'Accept'}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost"
                                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.5rem', color: '#f87171' }}
                                  disabled={actionLoading === reg.id}
                                  onClick={() => handleAction(reg.id, 'declined')}
                                >
                                  Decline
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Detail slide-over */}
      {selected && (
        <div className={styles.slideOverBackdrop} onClick={() => setSelected(null)}>
          <div className={styles.slideOverPanel} onClick={e => e.stopPropagation()}>
            <div className={styles.slideOverHeader}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: '#f0f0f0' }}>
                    {selected.playerFirstName} {selected.playerLastName}
                  </span>
                  <span className={`${styles.badge} ${STATUS_CSS[selected.status] ?? ''}`}>
                    {STATUS_LABEL[selected.status] ?? selected.status}
                  </span>
                </div>
                <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>
                  Submitted {new Date(selected.submittedAt).toLocaleDateString('en-CA')}
                </span>
              </div>
              <button className={styles.modalCloseBtn} onClick={() => setSelected(null)}>
                <X size={16} />
              </button>
            </div>

            <div className={styles.slideOverBody}>
              <div className={styles.slideOverSection}>
                <div className={styles.slideOverSectionTitle}>Player</div>
                <div className={styles.slideOverField}>
                  <span className={styles.slideOverFieldLabel}>Name</span>
                  <span>{selected.playerFirstName} {selected.playerLastName}</span>
                </div>
                {selected.playerDateOfBirth && (
                  <div className={styles.slideOverField}>
                    <span className={styles.slideOverFieldLabel}>Date of Birth</span>
                    <span>{new Date(selected.playerDateOfBirth + 'T00:00:00').toLocaleDateString('en-CA')}</span>
                  </div>
                )}
                {selected.playerNotes && (
                  <div className={styles.slideOverField}>
                    <span className={styles.slideOverFieldLabel}>Notes</span>
                    <span style={{ color: 'rgba(255,255,255,0.7)', whiteSpace: 'pre-wrap', fontSize: '0.88rem' }}>
                      {selected.playerNotes}
                    </span>
                  </div>
                )}
              </div>

              <div className={styles.slideOverSection}>
                <div className={styles.slideOverSectionTitle}>Guardian</div>
                <div className={styles.slideOverField}>
                  <span className={styles.slideOverFieldLabel}>Name</span>
                  <span>{selected.guardianFirstName} {selected.guardianLastName}</span>
                </div>
                <div className={styles.slideOverField}>
                  <span className={styles.slideOverFieldLabel}>Email</span>
                  <a href={`mailto:${selected.guardianEmail}`} style={{ color: 'var(--blueprint-blue, #4fa3e0)' }}>
                    {selected.guardianEmail}
                  </a>
                </div>
                {selected.guardianPhone && (
                  <div className={styles.slideOverField}>
                    <span className={styles.slideOverFieldLabel}>Phone</span>
                    <span>{selected.guardianPhone}</span>
                  </div>
                )}
              </div>

              <div className={styles.slideOverSection}>
                <div className={styles.slideOverSectionTitle}>Admin Notes (private)</div>
                <textarea
                  className={styles.textarea}
                  rows={3}
                  value={detailNotes}
                  onChange={e => setDetailNotes(e.target.value)}
                  placeholder="Internal notes — not visible to applicant"
                  readOnly={!canWrite}
                />
                {canWrite && detailNotes !== (selected.adminNotes ?? '') && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ marginTop: '0.5rem', fontSize: '0.82rem' }}
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                  >
                    {savingNotes ? 'Saving…' : 'Save Notes'}
                  </button>
                )}
              </div>

              {canWrite && (
                <div className={styles.slideOverSection}>
                  <div className={styles.slideOverSectionTitle}>Actions</div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {selected.status === 'pending_review' && (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={actionLoading === selected.id}
                          onClick={() => handleAction(selected.id, 'offered')}
                        >
                          {actionLoading === selected.id ? '…' : 'Extend Offer'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ color: '#f87171' }}
                          disabled={actionLoading === selected.id}
                          onClick={() => handleAction(selected.id, 'declined')}
                        >
                          Decline
                        </button>
                      </>
                    )}
                    {selected.status === 'offered' && (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={actionLoading === selected.id}
                          onClick={() => handleAction(selected.id, 'accepted')}
                        >
                          {actionLoading === selected.id ? '…' : 'Accept → Add to Roster'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ color: '#f87171' }}
                          disabled={actionLoading === selected.id}
                          onClick={() => handleAction(selected.id, 'declined')}
                        >
                          Decline
                        </button>
                      </>
                    )}
                    {(selected.status === 'pending_review' || selected.status === 'offered' || selected.status === 'accepted') && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ fontSize: '0.8rem', opacity: 0.55 }}
                        disabled={actionLoading === selected.id}
                        onClick={() => handleAction(selected.id, 'withdrawn')}
                      >
                        Mark Withdrawn
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual add modal */}
      {addOpen && (
        <div className={styles.modalOverlay} onClick={() => setAddOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Add Applicant</h3>
              <button className={styles.modalCloseBtn} onClick={() => setAddOpen(false)}><X size={16} /></button>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="add-pfn">
                  Player First Name <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  id="add-pfn" className={styles.input} type="text" autoFocus
                  value={addForm.playerFirstName}
                  onChange={e => setAddForm(f => ({ ...f, playerFirstName: e.target.value }))}
                  maxLength={60}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="add-pln">
                  Player Last Name <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  id="add-pln" className={styles.input} type="text"
                  value={addForm.playerLastName}
                  onChange={e => setAddForm(f => ({ ...f, playerLastName: e.target.value }))}
                  maxLength={60}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="add-dob">Date of Birth</label>
                <input
                  id="add-dob" className={styles.input} type="date"
                  value={addForm.playerDateOfBirth}
                  onChange={e => setAddForm(f => ({ ...f, playerDateOfBirth: e.target.value }))}
                />
              </div>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="add-pnotes">Player Notes</label>
                <textarea
                  id="add-pnotes" className={styles.textarea} rows={2}
                  value={addForm.playerNotes}
                  onChange={e => setAddForm(f => ({ ...f, playerNotes: e.target.value }))}
                  placeholder="Position preference, experience, etc."
                  maxLength={500}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="add-gfn">
                  Guardian First Name <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  id="add-gfn" className={styles.input} type="text"
                  value={addForm.guardianFirstName}
                  onChange={e => setAddForm(f => ({ ...f, guardianFirstName: e.target.value }))}
                  maxLength={60}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="add-gln">
                  Guardian Last Name <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  id="add-gln" className={styles.input} type="text"
                  value={addForm.guardianLastName}
                  onChange={e => setAddForm(f => ({ ...f, guardianLastName: e.target.value }))}
                  maxLength={60}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="add-gem">
                  Guardian Email <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  id="add-gem" className={styles.input} type="email"
                  value={addForm.guardianEmail}
                  onChange={e => setAddForm(f => ({ ...f, guardianEmail: e.target.value }))}
                  maxLength={120}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="add-gph">Guardian Phone</label>
                <input
                  id="add-gph" className={styles.input} type="tel"
                  value={addForm.guardianPhone}
                  onChange={e => setAddForm(f => ({ ...f, guardianPhone: e.target.value }))}
                  maxLength={20}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className="btn btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleManualAdd}
                disabled={
                  adding ||
                  !addForm.playerFirstName.trim() || !addForm.playerLastName.trim() ||
                  !addForm.guardianFirstName.trim() || !addForm.guardianLastName.trim() ||
                  !addForm.guardianEmail.trim()
                }
              >
                {adding ? 'Adding…' : 'Add Applicant'}
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
