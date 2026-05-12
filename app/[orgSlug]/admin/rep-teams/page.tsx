'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Users, X, Archive, Link2, DollarSign } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import FeedbackModal from '@/components/FeedbackModal';
import HelpCallout from '@/components/help/HelpCallout';
import styles from './rep-teams.module.css';
import type { RepTeam, RepProgramYear } from '@/lib/types';

function slugify(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', active: 'Active', completed: 'Completed', archived: 'Archived',
};
const STATUS_CSS: Record<string, string> = {
  draft: styles.badgeDraft, active: styles.badgeActive,
  completed: styles.badgeCompleted, archived: styles.badgeArchived,
};

interface TeamSummary {
  team: RepTeam;
  activeYear: { id: string; name: string; year: number; status: string } | null;
  rosterCount: number;
  pendingTryouts: number;
}

interface TeamForm {
  name: string; slug: string; sport: string;
  ageGroup: string; description: string; color: string;
}

const BLANK_FORM: TeamForm = {
  name: '', slug: '', sport: 'softball', ageGroup: '', description: '', color: '',
};

export default function RepTeamsPage() {
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const base = `/${currentOrg?.slug ?? ''}/admin`;
  const canWrite = userRole === 'owner' || userRole === 'admin';

  const [summaries, setSummaries] = useState<TeamSummary[]>([]);
  const [fetching, setFetching] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<TeamForm>(BLANK_FORM);
  const [slugEdited, setSlugEdited] = useState(false);
  const [creating, setCreating] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<TeamSummary | null>(null);
  const [archiving, setArchiving] = useState(false);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'success' | 'danger'>('success');
  const [feedbackMsg, setFeedbackMsg] = useState('');

  function showFeedback(type: 'success' | 'danger', msg: string) {
    setFeedbackType(type); setFeedbackMsg(msg); setFeedbackOpen(true);
  }

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/admin/rep-teams/teams');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setSummaries(data.teams ?? []);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to load teams.');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { if (currentOrg) load(); }, [currentOrg, load]);

  function handleNameChange(name: string) {
    setForm(f => ({ ...f, name, slug: slugEdited ? f.slug : slugify(name) }));
  }

  function handleSlugChange(slug: string) {
    setSlugEdited(true);
    setForm(f => ({ ...f, slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '') }));
  }

  function openCreate() {
    setForm(BLANK_FORM); setSlugEdited(false); setCreateOpen(true);
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.slug.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/rep-teams/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim(),
          sport: form.sport || 'softball',
          ageGroup: form.ageGroup.trim() || null,
          description: form.description.trim() || null,
          color: form.color.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create team');
      setCreateOpen(false);
      await load();
      showFeedback('success', `Team "${form.name}" created.`);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to create team.');
    } finally {
      setCreating(false);
    }
  }

  async function handleArchive() {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/admin/rep-teams/teams/${archiveTarget.team.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to archive team');
      setArchiveTarget(null);
      await load();
      showFeedback('success', `"${archiveTarget.team.name}" archived.`);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to archive team.');
    } finally {
      setArchiving(false);
    }
  }

  if (loading) return <p className={styles.muted}>Loading…</p>;

  if (!userRole || !hasCapability(userRole, userCapabilities, 'module_rep_teams')) {
    return (
      <div className={styles.accessDenied}>
        <Users size={32} />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have access to the Rep Teams module. Contact your organization owner to enable it.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><Users size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Rep Teams</h1>
            <p className={styles.pageSub}>{currentOrg?.name} — all teams</p>
          </div>
        </div>
        {canWrite && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link
              href={`${base}/rep-teams/rename-slugs`}
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            >
              <Link2 size={14} /> Rename Team URLs
            </Link>
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              + Add Team
            </button>
          </div>
        )}
      </div>

      {/* Quick-access nav */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <Link
          href={`${base}/rep-teams/allocations`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(var(--blueprint-blue-rgb),0.2)',
            borderRadius: 8, padding: '0.6rem 1rem',
            color: 'rgba(255,255,255,0.7)', fontSize: '0.88rem', fontWeight: 600,
            textDecoration: 'none', transition: 'background 0.15s',
          }}
        >
          <DollarSign size={15} style={{ color: 'var(--logic-lime,#a3e635)' }} />
          Cost Allocations
        </Link>
        <Link
          href={`${base}/rep-teams/documents`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(var(--blueprint-blue-rgb),0.2)',
            borderRadius: 8, padding: '0.6rem 1rem',
            color: 'rgba(255,255,255,0.7)', fontSize: '0.88rem', fontWeight: 600,
            textDecoration: 'none', transition: 'background 0.15s',
          }}
        >
          Document Templates
        </Link>
      </div>

      <p className={styles.sectionTitle}>Teams</p>

      {fetching ? (
        <p className={styles.muted}>Loading…</p>
      ) : summaries.length === 0 ? (
        <div>
          <HelpCallout
            variant="info"
            title="Get started with Rep Teams"
            body="Rep teams are competitive travel teams managed through the franchise model — the org creates and oversees teams, coaches operate them day-to-day. Create your first team to get started."
          />
          {canWrite && (
            <p>
              <button type="button" className="btn btn-secondary" style={{ marginTop: '0.25rem' }} onClick={openCreate}>
                Add your first team
              </button>
            </p>
          )}
        </div>
      ) : (
        <div className={styles.teamGrid}>
          {summaries.map(s => (
            <TeamCard
              key={s.team.id}
              summary={s}
              base={base}
              canWrite={canWrite}
              onArchive={() => setArchiveTarget(s)}
            />
          ))}
        </div>
      )}

      {/* Create Team modal */}
      {createOpen && (
        <div className={styles.modalOverlay} onClick={() => setCreateOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Add Team</h3>
              <button className={styles.modalCloseBtn} onClick={() => setCreateOpen(false)}><X size={16} /></button>
            </div>

            <div className={styles.formGrid}>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="rt-name">Team Name <span style={{ color: '#f87171' }}>*</span></label>
                <input id="rt-name" className={styles.input} type="text" value={form.name}
                  onChange={e => handleNameChange(e.target.value)} placeholder="e.g. U13A" maxLength={100} autoFocus />
              </div>

              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="rt-slug">Slug <span style={{ color: '#f87171' }}>*</span></label>
                <input id="rt-slug" className={styles.input} type="text" value={form.slug}
                  onChange={e => handleSlugChange(e.target.value)} placeholder="e.g. u13a" />
                <p className={styles.hint}>Used in public URLs. Lowercase letters, numbers, and hyphens only.</p>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="rt-sport">Sport</label>
                <select id="rt-sport" className={styles.select} value={form.sport}
                  onChange={e => setForm(f => ({ ...f, sport: e.target.value }))}>
                  <option value="softball">Softball</option>
                  <option value="baseball">Baseball</option>
                  <option value="hockey">Hockey</option>
                  <option value="soccer">Soccer</option>
                  <option value="basketball">Basketball</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="rt-age-group">Age Group</label>
                <input id="rt-age-group" className={styles.input} type="text" value={form.ageGroup}
                  onChange={e => setForm(f => ({ ...f, ageGroup: e.target.value }))}
                  placeholder="e.g. U13, U15, Senior" maxLength={30} />
              </div>

              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="rt-desc">Description</label>
                <textarea id="rt-desc" className={styles.textarea} value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description" rows={2} />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="rt-color">Colour (hex)</label>
                <input id="rt-color" className={styles.input} type="text" value={form.color}
                  onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  placeholder="#3b82f6" maxLength={7} />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className="btn btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleCreate}
                disabled={creating || !form.name.trim() || !form.slug.trim()}>
                {creating ? 'Creating…' : 'Create Team'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive confirm */}
      {archiveTarget && (
        <div className={styles.confirmOverlay} onClick={() => setArchiveTarget(null)}>
          <div className={styles.confirmBox} onClick={e => e.stopPropagation()}>
            <p className={styles.confirmTitle}>Archive "{archiveTarget.team.name}"?</p>
            <p className={styles.confirmMsg}>
              The team will be marked as alumni and hidden from the active list. All program years,
              rosters, and history are preserved and the public page remains accessible.
            </p>
            <p className={styles.confirmMsg} style={{ marginTop: '-0.5rem' }}>
              <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Tip:</strong> If you want to reuse
              this team&apos;s URL slug for an incoming cohort, use{' '}
              <Link href={`${base}/rep-teams/rename-slugs`} style={{ color: 'var(--blueprint-blue, #4fa3e0)' }}>
                Rename Team URLs
              </Link>{' '}
              first to give this team a permanent cohort-based slug (e.g. <code style={{ fontSize: '0.8em', opacity: 0.7 }}>2025-u19-grads</code>).
            </p>
            <div className={styles.confirmActions}>
              <button type="button" className="btn btn-ghost" onClick={() => setArchiveTarget(null)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={handleArchive} disabled={archiving}>
                {archiving ? 'Archiving…' : 'Archive Team'}
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

function TeamCard({ summary, base, canWrite, onArchive }: {
  summary: TeamSummary;
  base: string;
  canWrite: boolean;
  onArchive: () => void;
}) {
  const { team, activeYear, rosterCount, pendingTryouts } = summary;
  const href = `${base}/rep-teams/teams/${team.id}`;

  return (
    <div className={styles.teamCard}>
      <div className={styles.teamCardTop}>
        {team.color && (
          <span className={styles.colorSwatch} style={{ background: team.color }} />
        )}
        <span className={styles.teamName}>{team.name}</span>
      </div>

      <div className={styles.teamMeta}>
        {team.ageGroup && (
          <span className={`${styles.badge} ${styles.badgeAgeGroup}`}>{team.ageGroup}</span>
        )}
        {activeYear && (
          <span className={`${styles.badge} ${STATUS_CSS[activeYear.status] ?? styles.badgeDraft}`}>
            {activeYear.name} — {STATUS_LABEL[activeYear.status] ?? activeYear.status}
          </span>
        )}
      </div>

      <div className={styles.teamStats}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Roster</span>
          <span className={styles.statValue}>{rosterCount}</span>
        </div>
        {pendingTryouts > 0 && (
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Pending</span>
            <span className={styles.statValue}>{pendingTryouts}</span>
          </div>
        )}
      </div>

      <div className={styles.teamCardActions}>
        <Link href={href} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
          View Team →
        </Link>
        {canWrite && (
          <button type="button" onClick={onArchive}
            className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem', opacity: 0.5 }}
            title="Archive team">
            <Archive size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
