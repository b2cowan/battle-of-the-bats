'use client';
import { use, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ListOrdered, Check } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import CoachNotOnTeam from '@/components/coaches/CoachNotOnTeam';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import {
  buildLineupRows, renumberBattingOrder, sortLineupRows, type LineupPlayerRow,
} from '@/lib/lineup-grid';
import LineupEditor from '../../_LineupEditor';
import styles from '../../../../../coaches.module.css';
import type {
  RepLineupMode, RepRosterPlayer, RepTeamLineupTemplate, RepProgramYear, LineupSettings,
} from '@/lib/types';

export default function TemplateBuilderPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string; templateId: string }>;
}) {
  const { orgSlug, teamId, templateId } = use(paramsPromise);
  const router = useRouter();
  const { assignments, loading: ctxLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const sportPack = getSportPack(assignment?.teamSport ?? DEFAULT_SPORT);
  const canLineups = assignment ? assignment.capabilities.lineups : true;
  const isNew = templateId === 'new';

  const [roster, setRoster] = useState<RepRosterPlayer[]>([]);
  const [seasonCaps, setSeasonCaps] = useState<LineupSettings | null>(null);
  const [name, setName] = useState('');
  const [lineupMode, setLineupMode] = useState<RepLineupMode>('everyone_bats');
  const [inningCount, setInningCount] = useState(sportPack.defaultPeriodCount);
  const [rows, setRows] = useState<LineupPlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadSeqRef = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    const isStale = () => seq !== loadSeqRef.current;
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/lineup-templates`);
      if (!res.ok) throw new Error('Could not load your roster');
      const data: { templates?: RepTeamLineupTemplate[]; players?: RepRosterPlayer[]; programYear?: RepProgramYear | null } = await res.json();
      if (isStale()) return;
      const players = data.players ?? [];
      setRoster(players);
      setSeasonCaps(data.programYear?.lineupSettings ?? null);
      if (isNew) {
        setName('');
        setLineupMode('everyone_bats');
        setInningCount(sportPack.defaultPeriodCount);
        setRows(renumberBattingOrder(sortLineupRows(buildLineupRows(players, [], 'everyone_bats')), 'everyone_bats'));
      } else {
        const t = (data.templates ?? []).find(x => x.id === templateId);
        if (!t) { setLoadError('Template not found.'); return; }
        const rosterById = new Map(players.map(p => [p.id, p]));
        const seed = t.entries.map(e => rosterById.get(e.playerId)).filter((p): p is RepRosterPlayer => !!p);
        setName(t.name);
        setLineupMode(t.lineupMode);
        setInningCount(t.inningCount);
        setRows(renumberBattingOrder(sortLineupRows(buildLineupRows(seed, t.entries, t.lineupMode)), t.lineupMode));
      }
    } catch (e) {
      if (isStale()) return;
      setLoadError(e instanceof Error ? e.message : 'Could not load this template');
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, [orgSlug, teamId, templateId, isNew, sportPack.defaultPeriodCount]);

  useEffect(() => {
    if (!ctxLoading && canLineups) void Promise.resolve().then(load);
  }, [ctxLoading, canLineups, load]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) { setError('Give the template a name.'); return; }
    if (rows.length === 0) { setError('Add at least one player.'); return; }
    setSaving(true);
    setError('');
    const entries = rows.map(row => ({
      playerId: row.player.id,
      battingOrder: lineupMode === 'nine_player' && !row.starter ? null : (Number(row.battingOrder) || null),
      starter: lineupMode === 'nine_player' ? row.starter : true,
      inningPositions: row.inningPositions,
    }));
    try {
      const res = await fetch(
        isNew
          ? `/api/coaches/${orgSlug}/teams/${teamId}/lineup-templates`
          : `/api/coaches/${orgSlug}/teams/${teamId}/lineup-templates/${templateId}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed, lineupMode, inningCount, entries }),
        },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Could not save the template');
      }
      router.push(`${base}/lineups`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the template');
      setSaving(false);
    }
  }

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  if (!assignment) {
    return <CoachNotOnTeam />;
  }

  const header = (
    <>
      {/* Page-header ruling 2026-08-11: the "reusable base lineup" blurb is deleted — the Lineups
          hub's Templates empty state teaches it, and this page is reached only from there. */}
      <CoachPageHeader
        icon={ListOrdered}
        title={isNew ? 'New template' : 'Edit template'}
        backTo={{ href: `${base}/lineups`, label: 'All lineups' }}
        actions={canLineups && !loading && !loadError ? (
          /* ⚠ A SAVE, NOT A CREATE — but it takes the header's primary geometry all the same,
             because the slot is what decides the size (plan §2.6, swept in Phase 4b). The inline
             flex/gap this replaces was the last hand-written sizing on a coach page header. */
          <button
            type="button"
            className={`${styles.btnPrimary} ${styles.headerPrimaryBtn}`}
            disabled={saving}
            onClick={handleSave}
          >
            <Check size={15} aria-hidden /> {saving ? 'Saving…' : 'Save template'}
          </button>
        ) : undefined}
        helpLabel="Lineup templates"
        help={{ module: 'coaches', sectionIds: ['premium-lineups'], fullGuideHref: `/${orgSlug}/coaches/help#premium-lineups` }}
      />
    </>
  );

  if (!canLineups) {
    return (
      <div className={`${styles.page} ${styles.pageWide}`}>{header}
        <div className={styles.emptyState}>
          <ListOrdered size={28} style={{ opacity: 0.3, margin: '0 auto 0.75rem', display: 'block' }} />
          <p className={styles.emptyStateTitle}>Lineups aren&apos;t enabled for you</p>
          <p className={styles.emptyStateSub}>Ask your head coach to grant lineup access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      {header}
      {loading ? (
        <div className={styles.loadingState}>Loading…</div>
      ) : loadError ? (
        <p className={styles.errorText}>{loadError}</p>
      ) : (
        <>
          <label className={styles.lineupControlLabel} style={{ maxWidth: '24rem', marginBottom: '1rem' }}>
            <span>Template name</span>
            <input className={styles.input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Gold medal game" maxLength={80} aria-label="Template name" />
          </label>
          {error && <p className={styles.errorText}>{error}</p>}
          <LineupEditor
            roster={roster}
            rows={rows}
            onRowsChange={setRows}
            lineupMode={lineupMode}
            onLineupModeChange={setLineupMode}
            inningCount={inningCount}
            onInningCountChange={setInningCount}
            sportPack={sportPack}
            seasonCaps={seasonCaps}
            addLabel="Add to template"
            notInHeading="Not in the template"
          />
        </>
      )}
    </div>
  );
}
