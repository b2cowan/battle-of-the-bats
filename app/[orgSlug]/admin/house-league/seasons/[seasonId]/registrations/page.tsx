'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { X, Plus, ChevronLeft, Mail } from 'lucide-react';
import Link from 'next/link';
import { useOrg } from '@/lib/org-context';
import FeedbackModal from '@/components/FeedbackModal';
import HelpCallout from '@/components/help/HelpCallout';
import styles from '../../../house-league.module.css';
import type { LeagueRegistration, LeagueRegistrationStatus, LeagueDivision, LeagueTeam } from '@/lib/types';

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = 'pending_review' | 'active' | 'waitlisted' | 'declined_withdrawn' | 'all';

interface SeasonInfo {
  id: string;
  name: string;
  autoPromoteWaitlist: boolean;
}

interface ManualAddForm {
  divisionId: string;
  playerFirstName: string;
  playerLastName: string;
  playerDateOfBirth: string;
  playerJerseyPref: string;
  playerPositionPref: string;
  playerNotes: string;
  guardianFirstName: string;
  guardianLastName: string;
  guardianEmail: string;
  guardianPhone: string;
  status: LeagueRegistrationStatus;
}

const BLANK_FORM: ManualAddForm = {
  divisionId: '',
  playerFirstName: '',
  playerLastName: '',
  playerDateOfBirth: '',
  playerJerseyPref: '',
  playerPositionPref: '',
  playerNotes: '',
  guardianFirstName: '',
  guardianLastName: '',
  guardianEmail: '',
  guardianPhone: '',
  status: 'active',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

const REG_STATUS_LABEL: Record<LeagueRegistrationStatus, string> = {
  pending_review: 'Pending Review',
  active:         'Active',
  waitlisted:     'Waitlisted',
  declined:       'Declined',
  withdrawn:      'Withdrawn',
};

const REG_STATUS_STYLE: Record<LeagueRegistrationStatus, React.CSSProperties> = {
  pending_review: { background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)' },
  active:         { background: 'rgba(34,197,94,0.12)',  color: '#22C55E', border: '1px solid rgba(34,197,94,0.25)' },
  waitlisted:     { background: 'rgba(249,115,22,0.12)', color: '#F97316', border: '1px solid rgba(249,115,22,0.25)' },
  declined:       { background: 'rgba(239,68,68,0.08)',  color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' },
  withdrawn:      { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.08)' },
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: LeagueRegistrationStatus }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.2rem 0.55rem',
        borderRadius: 4,
        fontSize: '0.68rem',
        fontWeight: 700,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.06em',
        whiteSpace: 'nowrap' as const,
        ...REG_STATUS_STYLE[status],
      }}
    >
      {REG_STATUS_LABEL[status]}
    </span>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function RegistrationsPage() {
  const { currentOrg, userRole } = useOrg();
  const { seasonId } = useParams<{ seasonId: string }>();

  const isAdminOrOwner   = userRole === 'owner' || userRole === 'league_admin';
  const canManageRegs    = isAdminOrOwner || userRole === 'league_registrar';

  const [season,      setSeason]      = useState<SeasonInfo | null>(null);
  const [divisions,   setDivisions]   = useState<LeagueDivision[]>([]);
  const [regs,        setRegs]        = useState<LeagueRegistration[]>([]);
  const [fetching,    setFetching]    = useState(true);
  const [activeTab,   setActiveTab]   = useState<Tab>('pending_review');
  const [search,      setSearch]      = useState('');
  const [acting,      setActing]      = useState<string | null>(null); // regId being acted on

  // Manual add modal
  const [addOpen,     setAddOpen]     = useState(false);
  const [addForm,     setAddForm]     = useState<ManualAddForm>(BLANK_FORM);
  const [adding,      setAdding]      = useState(false);

  // Decline confirm
  const [confirmDeclineId, setConfirmDeclineId] = useState<string | null>(null);

  // Compose modal
  const [composeOpen,    setComposeOpen]    = useState(false);
  const [composeScope,   setComposeScope]   = useState<'all' | 'division' | 'team' | 'status'>('all');
  const [composeDivId,   setComposeDivId]   = useState('');
  const [composeTeamId,  setComposeTeamId]  = useState('');
  const [composeStatus,  setComposeStatus]  = useState<LeagueRegistrationStatus>('active');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeMessage, setComposeMessage] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [teams,          setTeams]          = useState<LeagueTeam[]>([]);
  const [teamsLoaded,    setTeamsLoaded]    = useState(false);

  // Feedback
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'success' | 'danger'>('success');
  const [feedbackMsg,  setFeedbackMsg]  = useState('');

  function showFeedback(type: 'success' | 'danger', msg: string) {
    setFeedbackType(type); setFeedbackMsg(msg); setFeedbackOpen(true);
  }

  const divisionName = useCallback((id: string | null) => {
    if (!id) return '—';
    return divisions.find(d => d.id === id)?.name ?? '—';
  }, [divisions]);

  // ── Data fetch ───────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!seasonId || !currentOrg) return;
    setFetching(true);
    try {
      const [seasonRes, regsRes] = await Promise.all([
        fetch(`/api/admin/house-league/seasons/${seasonId}`),
        fetch(`/api/admin/house-league/seasons/${seasonId}/registrations`),
      ]);
      const [seasonData, regsData] = await Promise.all([seasonRes.json(), regsRes.json()]);
      if (!seasonRes.ok) throw new Error(seasonData.error ?? 'Failed to load season');
      if (!regsRes.ok)   throw new Error(regsData.error  ?? 'Failed to load registrations');

      setSeason({
        id:                  seasonData.season.id,
        name:                seasonData.season.name,
        autoPromoteWaitlist: seasonData.season.autoPromoteWaitlist,
      });
      setDivisions(seasonData.divisions ?? []);
      setRegs(regsData.registrations ?? []);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to load.');
    } finally {
      setFetching(false);
    }
  }, [seasonId, currentOrg]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Derived lists ─────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return regs.filter(r => {
      if (!q) return true;
      return (
        r.playerFirstName.toLowerCase().includes(q) ||
        r.playerLastName.toLowerCase().includes(q)  ||
        r.guardianEmail.toLowerCase().includes(q)
      );
    });
  }, [regs, search]);

  const tabRegs = useMemo<LeagueRegistration[]>(() => {
    switch (activeTab) {
      case 'pending_review':      return filtered.filter(r => r.status === 'pending_review');
      case 'active':              return filtered.filter(r => r.status === 'active');
      case 'waitlisted':          return filtered
        .filter(r => r.status === 'waitlisted')
        .sort((a, b) => (a.waitlistPosition ?? 999) - (b.waitlistPosition ?? 999));
      case 'declined_withdrawn':  return filtered.filter(r => r.status === 'declined' || r.status === 'withdrawn');
      case 'all':                 return filtered;
    }
  }, [filtered, activeTab]);

  const recipientCount = useMemo(() => {
    switch (composeScope) {
      case 'all':      return regs.filter(r => r.status === 'active').length;
      case 'division': return composeDivId ? regs.filter(r => r.divisionId === composeDivId && r.status === 'active').length : 0;
      case 'team':     return composeTeamId ? regs.filter(r => r.teamId === composeTeamId).length : 0;
      case 'status':   return regs.filter(r => r.status === composeStatus).length;
    }
  }, [regs, composeScope, composeDivId, composeTeamId, composeStatus]);

  const counts = useMemo(() => ({
    pending_review:     regs.filter(r => r.status === 'pending_review').length,
    active:             regs.filter(r => r.status === 'active').length,
    waitlisted:         regs.filter(r => r.status === 'waitlisted').length,
    declined_withdrawn: regs.filter(r => r.status === 'declined' || r.status === 'withdrawn').length,
    all:                regs.length,
  }), [regs]);

  // Lazy-load teams when "By Team" scope is selected
  useEffect(() => {
    if (composeScope === 'team' && !teamsLoaded && seasonId) {
      fetch(`/api/admin/house-league/seasons/${seasonId}/teams`)
        .then(r => r.json())
        .then(d => { setTeams(d.teams ?? []); setTeamsLoaded(true); });
    }
  }, [composeScope, teamsLoaded, seasonId]);

  // ── Actions ───────────────────────────────────────────────────────────────────

  async function patchStatus(regId: string, status: LeagueRegistrationStatus) {
    setActing(regId);
    try {
      const res  = await fetch(`/api/admin/house-league/seasons/${seasonId}/registrations/${regId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Action failed');

      // Update local state
      setRegs(prev => {
        const next = prev.map(r => r.id === regId ? data.registration : r);
        // If a waitlist promotion occurred, update that reg too
        if (data.promoted) {
          return next.map(r => r.id === data.promoted.id ? data.promoted : r);
        }
        return next;
      });

      const label = REG_STATUS_LABEL[status];
      showFeedback('success', `Registration ${label.toLowerCase()}.${data.promoted ? ` ${data.promoted.playerFirstName} ${data.promoted.playerLastName} promoted from waitlist.` : ''}`);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Action failed.');
    } finally {
      setActing(null);
    }
  }

  async function toggleFeePaid(reg: LeagueRegistration) {
    try {
      const res  = await fetch(`/api/admin/house-league/seasons/${seasonId}/registrations/${reg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feePaid: !reg.registrationFeePaid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setRegs(prev => prev.map(r => r.id === reg.id ? data.registration : r));
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to update fee status.');
    }
  }

  async function handleManualAdd() {
    if (!addForm.divisionId || !addForm.playerFirstName || !addForm.playerLastName ||
        !addForm.guardianFirstName || !addForm.guardianLastName || !addForm.guardianEmail) {
      showFeedback('danger', 'Please fill in all required fields.');
      return;
    }
    setAdding(true);
    try {
      const res  = await fetch(`/api/admin/house-league/seasons/${seasonId}/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          divisionId:         addForm.divisionId,
          playerFirstName:    addForm.playerFirstName.trim(),
          playerLastName:     addForm.playerLastName.trim(),
          playerDateOfBirth:  addForm.playerDateOfBirth  || null,
          playerJerseyPref:   addForm.playerJerseyPref   || null,
          playerPositionPref: addForm.playerPositionPref || null,
          playerNotes:        addForm.playerNotes        || null,
          guardianFirstName:  addForm.guardianFirstName.trim(),
          guardianLastName:   addForm.guardianLastName.trim(),
          guardianEmail:      addForm.guardianEmail.trim(),
          guardianPhone:      addForm.guardianPhone      || null,
          status:             addForm.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to add registration');
      setRegs(prev => [data, ...prev]);
      setAddOpen(false);
      setAddForm(BLANK_FORM);
      showFeedback('success', `${addForm.playerFirstName} ${addForm.playerLastName} added.`);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to add registration.');
    } finally {
      setAdding(false);
    }
  }

  async function handleSendMessage() {
    if (!composeSubject.trim() || !composeMessage.trim()) {
      showFeedback('danger', 'Please fill in subject and message.');
      return;
    }
    if (recipientCount === 0) {
      showFeedback('danger', 'No recipients match this audience selection.');
      return;
    }
    setComposeSending(true);
    try {
      const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject:    composeSubject.trim(),
          message:    composeMessage.trim(),
          scope:      composeScope,
          divisionId: composeScope === 'division' ? composeDivId   : undefined,
          teamId:     composeScope === 'team'     ? composeTeamId  : undefined,
          status:     composeScope === 'status'   ? composeStatus  : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to send');
      setComposeOpen(false);
      setComposeSubject('');
      setComposeMessage('');
      showFeedback('success', `Sent to ${data.sent} guardian${data.sent !== 1 ? 's' : ''}.${data.skipped ? ` ${data.skipped} skipped.` : ''}`);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to send message.');
    } finally {
      setComposeSending(false);
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────────

  const orgSlug = currentOrg?.slug ?? '';

  function renderActions(reg: LeagueRegistration) {
    if (!canManageRegs) return null;
    const busy = acting === reg.id;

    if (activeTab === 'pending_review') {
      return (
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button
            className={styles.iconBtn}
            style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', color: '#22C55E', borderColor: 'rgba(34,197,94,0.3)' }}
            disabled={busy}
            onClick={() => patchStatus(reg.id, 'active')}
          >
            Approve
          </button>
          <button
            className={styles.iconBtn}
            style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', color: '#F59E0B', borderColor: 'rgba(245,158,11,0.3)' }}
            disabled={busy}
            onClick={() => patchStatus(reg.id, 'waitlisted')}
          >
            Waitlist
          </button>
          <button
            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
            style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
            disabled={busy}
            onClick={() => setConfirmDeclineId(reg.id)}
          >
            Decline
          </button>
        </div>
      );
    }

    if (activeTab === 'active') {
      return (
        <button
          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
          style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
          disabled={busy}
          onClick={() => setConfirmDeclineId(reg.id)}
        >
          Decline
        </button>
      );
    }

    if (activeTab === 'waitlisted') {
      return (
        <button
          className={styles.iconBtn}
          style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', color: '#22C55E', borderColor: 'rgba(34,197,94,0.3)' }}
          disabled={busy}
          onClick={() => patchStatus(reg.id, 'active')}
        >
          Promote
        </button>
      );
    }

    return null;
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (fetching) {
    return <p className={styles.muted}>Loading registrations…</p>;
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'pending_review',     label: 'Pending Review' },
    { key: 'active',             label: 'Active' },
    { key: 'waitlisted',         label: 'Waitlist' },
    { key: 'declined_withdrawn', label: 'Declined / Withdrawn' },
    { key: 'all',                label: 'All' },
  ];

  return (
    <div className={styles.page}>
      {/* ── Back + page header ────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <Link
            href={`/${orgSlug}/admin/house-league/seasons/${seasonId}`}
            style={{ color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', textDecoration: 'none' }}
          >
            <ChevronLeft size={16} />
          </Link>
          <div>
            <h1 className={styles.pageTitle}>Registrations</h1>
            {season && <p className={styles.pageSub}>{season.name}</p>}
          </div>
        </div>
        {isAdminOrOwner && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              className={styles.iconBtn}
              style={{ gap: '0.35rem', padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
              onClick={() => setComposeOpen(true)}
            >
              <Mail size={14} />
              Message Registrants
            </button>
            <button
              className={styles.iconBtn}
              style={{ gap: '0.35rem', padding: '0.45rem 0.85rem', fontSize: '0.85rem', color: 'var(--logic-lime, #a3e635)', borderColor: 'rgba(163,230,53,0.3)' }}
              onClick={() => { setAddForm(BLANK_FORM); setAddOpen(true); }}
            >
              <Plus size={14} />
              Add Registration
            </button>
          </div>
        )}
      </div>

      {/* ── Empty state help cue ──────────────────────────────────────────── */}
      {regs.length === 0 && !search && (
        <div style={{ marginBottom: '1.25rem' }}>
          <HelpCallout
            variant="info"
            title="No registrations yet"
            body="Registrations appear here as parents submit the public form. Review each one and approve, waitlist, or decline. Approved registrants are available for team assignment."
          />
        </div>
      )}

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '1rem' }}>
        <input
          className={styles.input}
          style={{ maxWidth: 360 }}
          placeholder="Search by player name or parent email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: '0' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--logic-lime, #a3e635)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--white-90, #f0f0f0)' : 'rgba(255,255,255,0.4)',
              fontWeight: activeTab === tab.key ? 700 : 400,
              fontSize: '0.85rem',
              padding: '0.5rem 0.75rem',
              cursor: 'pointer',
              marginBottom: '-1px',
              transition: 'color 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
            {counts[tab.key] > 0 && (
              <span style={{
                marginLeft: '0.4rem',
                background: activeTab === tab.key ? 'rgba(163,230,53,0.15)' : 'rgba(255,255,255,0.07)',
                color: activeTab === tab.key ? 'var(--logic-lime, #a3e635)' : 'rgba(255,255,255,0.4)',
                borderRadius: 4,
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.1rem 0.4rem',
              }}>
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      {tabRegs.length === 0 ? (
        <div className={styles.emptyState}>
          <p>{search ? 'No registrations match your search.' : 'No registrations in this tab.'}</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {[
                  'Player', 'Division', 'Guardian', 'Registered',
                  'Status',
                  'Fee Paid',
                  ...(activeTab !== 'declined_withdrawn' && canManageRegs ? ['Actions'] : []),
                ].map(h => (
                  <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabRegs.map(reg => (
                <tr
                  key={reg.id}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Player */}
                  <td style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 700, color: 'var(--white-90, #f0f0f0)' }}>
                      {reg.playerFirstName} {reg.playerLastName}
                    </span>
                    {activeTab === 'waitlisted' && reg.waitlistPosition !== null && (
                      <span style={{
                        marginLeft: '0.5rem',
                        background: 'rgba(249,115,22,0.15)',
                        color: '#F97316',
                        borderRadius: 4,
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.4rem',
                      }}>
                        #{reg.waitlistPosition}
                      </span>
                    )}
                  </td>

                  {/* Division */}
                  <td style={{ padding: '0.65rem 0.75rem', color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>
                    {divisionName(reg.divisionId)}
                  </td>

                  {/* Guardian */}
                  <td style={{ padding: '0.65rem 0.75rem' }}>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem' }}>{reg.guardianEmail}</div>
                    {reg.guardianPhone && (
                      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem' }}>{reg.guardianPhone}</div>
                    )}
                  </td>

                  {/* Registered at */}
                  <td style={{ padding: '0.65rem 0.75rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {formatDate(reg.registeredAt)}
                  </td>

                  {/* Status */}
                  <td style={{ padding: '0.65rem 0.75rem' }}>
                    <StatusBadge status={reg.status} />
                  </td>

                  {/* Fee Paid */}
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={reg.registrationFeePaid}
                      onChange={() => canManageRegs && toggleFeePaid(reg)}
                      disabled={!canManageRegs}
                      style={{ cursor: canManageRegs ? 'pointer' : 'default', accentColor: '#22C55E', width: 15, height: 15 }}
                      title={reg.registrationFeePaid ? 'Fee paid' : 'Fee not yet paid'}
                    />
                  </td>

                  {/* Actions */}
                  {activeTab !== 'declined_withdrawn' && canManageRegs && (
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      {renderActions(reg)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Decline confirm dialog ────────────────────────────────────────── */}
      {confirmDeclineId && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: 380 }}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Decline Registration</h2>
              <button className={styles.modalCloseBtn} onClick={() => setConfirmDeclineId(null)}>
                <X size={18} />
              </button>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', margin: '0 0 1.25rem' }}>
              This will send a decline email to the parent. The spot will{' '}
              {season?.autoPromoteWaitlist ? 'automatically be offered to the next person on the waitlist.' : 'remain open for manual waitlist management.'}
            </p>
            <div className={styles.modalFooter}>
              <button
                className={styles.iconBtn}
                onClick={() => setConfirmDeclineId(null)}
                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
              >
                Cancel
              </button>
              <button
                className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', color: '#f87171', borderColor: 'rgba(248,113,113,0.4)' }}
                disabled={acting === confirmDeclineId}
                onClick={async () => {
                  const id = confirmDeclineId;
                  setConfirmDeclineId(null);
                  await patchStatus(id, 'declined');
                }}
              >
                {acting === confirmDeclineId ? 'Declining…' : 'Decline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Manual add modal ─────────────────────────────────────────────── */}
      {addOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Add Registration</h2>
              <button className={styles.modalCloseBtn} onClick={() => setAddOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <p className={styles.sectionTitle} style={{ marginBottom: '0.75rem' }}>Player</p>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>First Name *</label>
                  <input className={styles.input} value={addForm.playerFirstName} onChange={e => setAddForm(f => ({ ...f, playerFirstName: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Last Name *</label>
                  <input className={styles.input} value={addForm.playerLastName} onChange={e => setAddForm(f => ({ ...f, playerLastName: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Date of Birth</label>
                  <input className={styles.input} type="date" value={addForm.playerDateOfBirth} onChange={e => setAddForm(f => ({ ...f, playerDateOfBirth: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Jersey # Pref</label>
                  <input className={styles.input} value={addForm.playerJerseyPref} onChange={e => setAddForm(f => ({ ...f, playerJerseyPref: e.target.value }))} />
                </div>
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>Position Pref</label>
                  <input className={styles.input} value={addForm.playerPositionPref} onChange={e => setAddForm(f => ({ ...f, playerPositionPref: e.target.value }))} />
                </div>
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>Player Notes</label>
                  <textarea className={styles.textarea} value={addForm.playerNotes} onChange={e => setAddForm(f => ({ ...f, playerNotes: e.target.value }))} />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <p className={styles.sectionTitle} style={{ marginBottom: '0.75rem' }}>Guardian / Parent</p>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>First Name *</label>
                  <input className={styles.input} value={addForm.guardianFirstName} onChange={e => setAddForm(f => ({ ...f, guardianFirstName: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Last Name *</label>
                  <input className={styles.input} value={addForm.guardianLastName} onChange={e => setAddForm(f => ({ ...f, guardianLastName: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Email *</label>
                  <input className={styles.input} type="email" value={addForm.guardianEmail} onChange={e => setAddForm(f => ({ ...f, guardianEmail: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Phone</label>
                  <input className={styles.input} value={addForm.guardianPhone} onChange={e => setAddForm(f => ({ ...f, guardianPhone: e.target.value }))} />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '0.5rem' }}>
              <p className={styles.sectionTitle} style={{ marginBottom: '0.75rem' }}>Assignment</p>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Division *</label>
                  <select className={styles.select} value={addForm.divisionId} onChange={e => setAddForm(f => ({ ...f, divisionId: e.target.value }))}>
                    <option value="">Select division…</option>
                    {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Status</label>
                  <select className={styles.select} value={addForm.status} onChange={e => setAddForm(f => ({ ...f, status: e.target.value as LeagueRegistrationStatus }))}>
                    <option value="active">Active</option>
                    <option value="pending_review">Pending Review</option>
                    <option value="waitlisted">Waitlisted</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.iconBtn} style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }} onClick={() => setAddOpen(false)} disabled={adding}>
                Cancel
              </button>
              <button
                className={styles.iconBtn}
                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', color: 'var(--logic-lime, #a3e635)', borderColor: 'rgba(163,230,53,0.3)' }}
                disabled={adding}
                onClick={handleManualAdd}
              >
                {adding ? 'Adding…' : 'Add Registration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Compose modal ─────────────────────────────────────────────────── */}
      {composeOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: 520 }}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Message Registrants</h2>
              <button className={styles.modalCloseBtn} onClick={() => setComposeOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.field} style={{ marginBottom: '1rem' }}>
              <label className={styles.label}>Audience</label>
              <select
                className={styles.select}
                value={composeScope}
                onChange={e => setComposeScope(e.target.value as typeof composeScope)}
              >
                <option value="all">All Active Registrants</option>
                <option value="division">By Division</option>
                <option value="team">By Team</option>
                <option value="status">By Status</option>
              </select>
            </div>

            {composeScope === 'division' && (
              <div className={styles.field} style={{ marginBottom: '1rem' }}>
                <label className={styles.label}>Division</label>
                <select className={styles.select} value={composeDivId} onChange={e => setComposeDivId(e.target.value)}>
                  <option value="">Select a division…</option>
                  {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}

            {composeScope === 'team' && (
              <div className={styles.field} style={{ marginBottom: '1rem' }}>
                <label className={styles.label}>Team</label>
                <select className={styles.select} value={composeTeamId} onChange={e => setComposeTeamId(e.target.value)}>
                  <option value="">Select a team…</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            {composeScope === 'status' && (
              <div className={styles.field} style={{ marginBottom: '1rem' }}>
                <label className={styles.label}>Status</label>
                <select className={styles.select} value={composeStatus} onChange={e => setComposeStatus(e.target.value as LeagueRegistrationStatus)}>
                  <option value="active">Active</option>
                  <option value="waitlisted">Waitlisted</option>
                  <option value="pending_review">Pending Review</option>
                  <option value="declined">Declined</option>
                </select>
              </div>
            )}

            <div
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                background: recipientCount > 0 ? 'rgba(163,230,53,0.07)' : 'rgba(255,255,255,0.04)',
                border: recipientCount > 0 ? '1px solid rgba(163,230,53,0.2)' : '1px solid rgba(255,255,255,0.07)',
                fontSize: '0.8rem',
                color: recipientCount > 0 ? '#a3e635' : 'rgba(255,255,255,0.35)',
                marginBottom: '1.25rem',
              }}
            >
              {recipientCount > 0
                ? `Sending to ${recipientCount} guardian${recipientCount !== 1 ? 's' : ''}`
                : 'No recipients match this selection'}
            </div>

            <div className={styles.field} style={{ marginBottom: '1rem' }}>
              <label className={styles.label}>Subject *</label>
              <input
                className={styles.input}
                placeholder="e.g. Season start reminder"
                value={composeSubject}
                onChange={e => setComposeSubject(e.target.value)}
              />
            </div>

            <div className={styles.field} style={{ marginBottom: '0.5rem' }}>
              <label className={styles.label}>Message *</label>
              <textarea
                className={styles.textarea}
                rows={6}
                placeholder="Write your message here…"
                value={composeMessage}
                onChange={e => setComposeMessage(e.target.value)}
              />
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.iconBtn}
                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                onClick={() => setComposeOpen(false)}
                disabled={composeSending}
              >
                Cancel
              </button>
              <button
                className={styles.iconBtn}
                style={{
                  fontSize: '0.875rem', padding: '0.5rem 1.25rem',
                  color: 'var(--logic-lime, #a3e635)',
                  borderColor: 'rgba(163,230,53,0.3)',
                  opacity: recipientCount === 0 ? 0.5 : 1,
                }}
                disabled={composeSending || recipientCount === 0}
                onClick={handleSendMessage}
              >
                {composeSending ? 'Sending…' : `Send to ${recipientCount}`}
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
