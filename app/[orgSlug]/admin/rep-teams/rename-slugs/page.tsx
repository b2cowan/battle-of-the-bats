'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Link2 } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import FeedbackModal from '@/components/FeedbackModal';
import styles from '../rep-teams.module.css';
import type { RepTeam } from '@/lib/types';

const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

function validateSlug(s: string): string | null {
  if (!s.trim()) return 'Required';
  if (s.length < 3) return 'Min 3 characters';
  if (s.length > 80) return 'Max 80 characters';
  if (!SLUG_RE.test(s)) return 'Lowercase letters, numbers, and hyphens only. Cannot start or end with a hyphen.';
  return null;
}

interface TeamRow {
  team: RepTeam;
}

export default function RenameSlugPage() {
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  const orgParam = currentOrg?.slug ? `&orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  const base = `/${currentOrg?.slug ?? ''}/admin`;
  const canWrite = userRole === 'owner' || userRole === 'admin';

  const [rows, setRows] = useState<TeamRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [slugMap, setSlugMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'success' | 'danger'>('success');
  const [feedbackMsg, setFeedbackMsg] = useState('');

  function showFeedback(type: 'success' | 'danger', msg: string) {
    setFeedbackType(type); setFeedbackMsg(msg); setFeedbackOpen(true);
  }

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch(`/api/admin/rep-teams/teams?archived=true${orgParam}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      const loaded: TeamRow[] = (data.teams ?? []).map((s: any) => ({ team: s.team }));
      setRows(loaded);
      const initial: Record<string, string> = {};
      for (const { team } of loaded) initial[team.id] = team.slug;
      setSlugMap(initial);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to load teams.');
    } finally {
      setFetching(false);
    }
  }, [orgParam]);

  useEffect(() => { if (currentOrg) load(); }, [currentOrg, load]);

  // Per-field errors: format + duplicates-within-batch
  const fieldErrors = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    // Format validation
    for (const [teamId, slug] of Object.entries(slugMap)) {
      const err = validateSlug(slug);
      if (err) out[teamId] = err;
    }
    // Duplicate detection across new slugs
    const counts: Record<string, string[]> = {};
    for (const [teamId, slug] of Object.entries(slugMap)) {
      if (!counts[slug]) counts[slug] = [];
      counts[slug].push(teamId);
    }
    for (const [slug, ids] of Object.entries(counts)) {
      if (ids.length > 1) {
        for (const id of ids) out[id] = `"${slug}" is used by more than one team`;
      }
    }
    return out;
  }, [slugMap]);

  const changedRenames = useMemo(() => {
    return rows
      .filter(({ team }) => slugMap[team.id] !== undefined && slugMap[team.id] !== team.slug)
      .map(({ team }) => ({ teamId: team.id, newSlug: slugMap[team.id] }));
  }, [rows, slugMap]);

  const hasErrors = Object.keys(fieldErrors).length > 0;
  const canSave = canWrite && !hasErrors && changedRenames.length > 0 && !saving;

  function handleSlugChange(teamId: string, value: string) {
    setSaved(false);
    setSlugMap(prev => ({
      ...prev,
      [teamId]: value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
    }));
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/rep-teams/bulk-rename-slugs${orgQuery}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ renames: changedRenames }),
      });
      const data = await res.json();
      if (res.status === 400 && data.errors) {
        showFeedback('danger', 'Some slugs are invalid. Check the highlighted fields.');
        return;
      }
      if (res.status === 409 && data.errors) {
        showFeedback('danger', 'One or more slugs conflict with existing teams. Check the highlighted fields.');
        return;
      }
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setSaved(true);
      await load();
      showFeedback('success', `${data.updated} team URL${data.updated !== 1 ? 's' : ''} updated.`);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className={styles.muted}>Loading…</p>;

  if (!userRole || !hasCapability(userRole, userCapabilities, 'module_rep_teams')) {
    return (
      <div className={styles.accessDenied}>
        <Link2 size={32} />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have access to the Rep Teams module.</p>
      </div>
    );
  }

  const activeRows = rows.filter(r => !r.team.isArchived);
  const archivedRows = rows.filter(r => r.team.isArchived);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.breadcrumb} style={{ marginBottom: '0.75rem' }}>
        <Link href={`${base}/rep-teams`}><ArrowLeft size={12} style={{ marginRight: '0.2rem' }} />Rep Teams</Link>
      </div>

      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><Link2 size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Rename Team URLs</h1>
            <p className={styles.pageSub}>{currentOrg?.name}</p>
          </div>
        </div>
      </div>

      <p className={styles.introNote}>
        Update public URL slugs for all teams at once. All changes are applied together — no team&apos;s
        URL is vacated until every new URL is ready, so there are no broken links during the rotation.
        Only rows you change will be saved.
      </p>

      {fetching ? (
        <p className={styles.muted}>Loading teams…</p>
      ) : rows.length === 0 ? (
        <p className={styles.muted}>No teams found.</p>
      ) : (
        <>
          {activeRows.length > 0 && (
            <>
              <div className={styles.renameSectionLabel}>Active Teams</div>
              <div className={styles.renameList}>
                {activeRows.map(({ team }) => (
                  <TeamSlugRow
                    key={team.id}
                    team={team}
                    orgSlug={currentOrg?.slug ?? ''}
                    value={slugMap[team.id] ?? team.slug}
                    error={fieldErrors[team.id]}
                    onChange={v => handleSlugChange(team.id, v)}
                    readOnly={!canWrite}
                  />
                ))}
              </div>
            </>
          )}

          {archivedRows.length > 0 && (
            <>
              <div className={styles.renameSectionLabel}>Archived Teams</div>
              <div className={styles.renameList}>
                {archivedRows.map(({ team }) => (
                  <TeamSlugRow
                    key={team.id}
                    team={team}
                    orgSlug={currentOrg?.slug ?? ''}
                    value={slugMap[team.id] ?? team.slug}
                    error={fieldErrors[team.id]}
                    onChange={v => handleSlugChange(team.id, v)}
                    readOnly={!canWrite}
                  />
                ))}
              </div>
            </>
          )}

          {canWrite && (
            <div className={styles.saveBar}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={!canSave}
              >
                {saving ? 'Saving…' : 'Save All Renames'}
              </button>
              <span className={styles.changeCount}>
                {changedRenames.length === 0
                  ? 'No changes'
                  : `${changedRenames.length} team${changedRenames.length !== 1 ? 's' : ''} will be renamed`}
              </span>
              {saved && (
                <span style={{ fontSize: '0.85rem', color: 'var(--logic-lime)' }}>
                  ✓ Saved
                </span>
              )}
            </div>
          )}
        </>
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

function TeamSlugRow({
  team,
  orgSlug,
  value,
  error,
  onChange,
  readOnly,
}: {
  team: RepTeam;
  orgSlug: string;
  value: string;
  error: string | undefined;
  onChange: (v: string) => void;
  readOnly: boolean;
}) {
  const changed = value !== team.slug;
  const rowClass = [
    styles.renameRow,
    error ? styles.renameRowError : changed ? styles.renameRowChanged : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rowClass}>
      {/* Left: team identity */}
      <div className={styles.renameTeamInfo}>
        <div className={styles.renameTeamName}>
          {team.color && (
            <span
              style={{
                width: 10, height: 10, borderRadius: 2,
                background: team.color, flexShrink: 0,
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            />
          )}
          {team.name}
          {team.division && (
            <span className={`${styles.badge} ${styles.badgeDivision}`}>{team.division}</span>
          )}
          {team.isArchived && (
            <span className={`${styles.badge} ${styles.badgeArchived}`}>Archived</span>
          )}
        </div>
        <span className={styles.renameCurrentSlug}>
          current: /{orgSlug}/teams/{team.slug}
        </span>
      </div>

      {/* Right: new slug input + preview */}
      <div className={styles.renameInputGroup}>
        <label className={styles.label} style={{ marginBottom: '0.2rem' }}>
          New URL Slug
        </label>
        <input
          className={`${styles.input}${error ? ` ${styles.inputError ?? ''}` : ''}`}
          style={error ? { borderColor: '#f87171' } : undefined}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          readOnly={readOnly}
          maxLength={80}
          spellCheck={false}
        />
        {error ? (
          <p className={styles.renameInputError}>{error}</p>
        ) : (
          <span className={`${styles.renamePreview}${changed ? ` ${styles.renamePreviewChanged}` : ''}`}>
            /{orgSlug}/teams/{value || '…'}
          </span>
        )}
      </div>
    </div>
  );
}
