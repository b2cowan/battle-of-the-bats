'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Users, X, ChevronRight } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import FeedbackModal from '@/components/FeedbackModal';
import styles from '../../rep-teams.module.css';
import type { RepTeam, RepProgramYear } from '@/lib/types';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', active: 'Active', completed: 'Completed', archived: 'Archived',
};
const STATUS_CSS: Record<string, string> = {
  draft: styles.badgeDraft, active: styles.badgeActive,
  completed: styles.badgeCompleted, archived: styles.badgeArchived,
};

interface ProgramYearWithCounts extends RepProgramYear {
  rosterCount: number;
  coachCount: number;
}

interface YearForm {
  name: string; year: string; tryoutOpen: boolean; tryoutDescription: string;
}

const BLANK_YEAR: YearForm = {
  name: '', year: String(new Date().getFullYear()), tryoutOpen: false, tryoutDescription: '',
};

export default function TeamOverviewPage({ params }: { params: { orgSlug: string; teamId: string } }) {
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const base = `/${currentOrg?.slug ?? ''}/admin`;
  const canWrite = userRole === 'owner' || userRole === 'admin';

  const [team, setTeam] = useState<RepTeam | null>(null);
  const [programYears, setProgramYears] = useState<ProgramYearWithCounts[]>([]);
  const [fetching, setFetching] = useState(true);
  const [addYearOpen, setAddYearOpen] = useState(false);
  const [yearForm, setYearForm] = useState<YearForm>(BLANK_YEAR);
  const [creating, setCreating] = useState(false);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'success' | 'danger'>('success');
  const [feedbackMsg, setFeedbackMsg] = useState('');

  function showFeedback(type: 'success' | 'danger', msg: string) {
    setFeedbackType(type); setFeedbackMsg(msg); setFeedbackOpen(true);
  }

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch(`/api/admin/rep-teams/teams/${params.teamId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setTeam(data.team);
      setProgramYears(data.programYears ?? []);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to load team.');
    } finally {
      setFetching(false);
    }
  }, [params.teamId]);

  useEffect(() => { if (currentOrg) load(); }, [currentOrg, load]);

  async function handleAddYear() {
    if (!yearForm.name.trim() || !yearForm.year) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/admin/rep-teams/teams/${params.teamId}/program-years`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: yearForm.name.trim(),
          year: parseInt(yearForm.year, 10),
          tryoutOpen: yearForm.tryoutOpen,
          tryoutDescription: yearForm.tryoutDescription.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create program year');
      setAddYearOpen(false);
      setYearForm(BLANK_YEAR);
      await load();
      showFeedback('success', `Program year "${yearForm.name}" created.`);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to create program year.');
    } finally {
      setCreating(false);
    }
  }

  if (loading || fetching) return <p className={styles.muted}>Loading…</p>;

  if (!userRole || !hasCapability(userRole, userCapabilities, 'module_rep_teams')) {
    return (
      <div className={styles.accessDenied}>
        <Users size={32} />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have access to the Rep Teams module.</p>
      </div>
    );
  }

  if (!team) {
    return <p className={styles.muted}>Team not found.</p>;
  }

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <Link href={`${base}/rep-teams`}>Rep Teams</Link>
        <span><ChevronRight size={12} /></span>
        <span>{team.name}</span>
      </div>

      {/* Page header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          {team.color && <span className={styles.colorSwatch} style={{ background: team.color, width: 20, height: 20 }} />}
          <div>
            <h1 className={styles.pageTitle}>{team.name}</h1>
            <p className={styles.pageSub}>
              {team.sport}{team.ageGroup ? ` · ${team.ageGroup}` : ''}
              {team.description ? ` — ${team.description}` : ''}
            </p>
          </div>
        </div>
        {canWrite && (
          <button type="button" className="btn btn-primary" onClick={() => { setYearForm(BLANK_YEAR); setAddYearOpen(true); }}>
            + Add Program Year
          </button>
        )}
      </div>

      {/* Program Years */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <p className={styles.sectionTitle} style={{ margin: 0 }}>Program Years</p>
        <Link
          href={`${base}/rep-teams/teams/${team.id}/history`}
          style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}
        >
          View history →
        </Link>
      </div>

      {programYears.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No program years yet.</p>
          {canWrite && (
            <button type="button" className="btn btn-secondary" style={{ marginTop: '0.75rem' }}
              onClick={() => { setYearForm(BLANK_YEAR); setAddYearOpen(true); }}>
              Add first program year
            </button>
          )}
        </div>
      ) : (
        <div className={styles.yearList}>
          {programYears.map(py => {
            const yearHref = `${base}/rep-teams/teams/${team.id}/program-years/${py.id}`;
            return (
              <div key={py.id} className={styles.yearCard}>
                <div className={styles.yearCardLeft}>
                  <span className={styles.yearCardName}>{py.name}</span>
                  <div className={styles.yearCardMeta}>
                    <span className={`${styles.badge} ${STATUS_CSS[py.status] ?? styles.badgeDraft}`}>
                      {STATUS_LABEL[py.status] ?? py.status}
                    </span>
                    {py.tryoutOpen && (
                      <span className={`${styles.badge} ${styles.badgeActive}`}>Tryouts Open</span>
                    )}
                    <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)' }}>
                      {py.rosterCount} players · {py.coachCount} coaches
                    </span>
                  </div>
                </div>
                <div className={styles.yearCardRight}>
                  <Link href={`${yearHref}/coaches`} className="btn btn-ghost"
                    style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}>
                    Coaches
                  </Link>
                  <Link href={yearHref} className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
                    View →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Program Year modal */}
      {addYearOpen && (
        <div className={styles.modalOverlay} onClick={() => setAddYearOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Add Program Year</h3>
              <button className={styles.modalCloseBtn} onClick={() => setAddYearOpen(false)}><X size={16} /></button>
            </div>

            <div className={styles.formGrid}>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="py-name">Label <span style={{ color: '#f87171' }}>*</span></label>
                <input id="py-name" className={styles.input} type="text" value={yearForm.name} autoFocus
                  onChange={e => setYearForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. 2025 Season" maxLength={100} />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="py-year">Calendar Year <span style={{ color: '#f87171' }}>*</span></label>
                <input id="py-year" className={styles.input} type="number" value={yearForm.year} min={2000} max={2100}
                  onChange={e => setYearForm(f => ({ ...f, year: e.target.value }))} />
              </div>

              <div className={styles.field} style={{ justifyContent: 'flex-end' }}>
                <label className={styles.label}>Tryouts Open</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={yearForm.tryoutOpen}
                    onChange={e => setYearForm(f => ({ ...f, tryoutOpen: e.target.checked }))} />
                  <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Open for tryout signups</span>
                </label>
              </div>

              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="py-desc">Tryout Description</label>
                <textarea id="py-desc" className={styles.textarea} value={yearForm.tryoutDescription} rows={2}
                  onChange={e => setYearForm(f => ({ ...f, tryoutDescription: e.target.value }))}
                  placeholder="Shown on the public tryout registration page" />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className="btn btn-ghost" onClick={() => setAddYearOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleAddYear}
                disabled={creating || !yearForm.name.trim() || !yearForm.year}>
                {creating ? 'Creating…' : 'Create Program Year'}
              </button>
            </div>
          </div>
        </div>
      )}

      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)}
        title={feedbackType === 'success' ? 'Done' : 'Error'} message={feedbackMsg} type={feedbackType} />
    </div>
  );
}
