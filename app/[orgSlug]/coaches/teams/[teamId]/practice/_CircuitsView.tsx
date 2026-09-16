'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { History, NotebookPen, Plus, Repeat } from 'lucide-react';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import { formatInOrgZone } from '@/lib/timezone';
import { filterTagged } from '@/lib/rep-drills';
import { templateUseLabel } from '@/lib/rep-plan-templates';
import { circuitLine, type RepTeamCircuitWithUsage } from '@/lib/rep-circuits';
import { LibraryFilterBar, LibraryTable, LibraryTableRow } from '@/components/coaches/LibraryRow';
import { PastSeasonImportDialog, usePastSeasonImport, type PastSeasonRow } from '@/components/coaches/PastSeasonImport';
import { circuitHref } from '@/lib/practice-plans-address';
import PracticePlansTabs from './_PracticePlansTabs';
import styles from '../../../coaches.module.css';

/**
 * The circuit library — the CIRCUITS TAB of the Practice plans room, the fourth tab and the third
 * size of reusable thing (practices re-evaluation stage 4, owner ruling L9, 2026-09-16; mig 302).
 * The same TABLE the Drills and Templates tabs stand on: Circuit (the name, its tags beside it,
 * the STATIONS' NAMES then how it rotates as its line — "Footwork ladder · Close control ·
 * Finishing · rotates every 15 min") · Usually (the block's minutes) · Started (the template's
 * kind of count — a circuit is scaffolding, and counts the plans it was placed on, never "used") ·
 * a chevron. **The row is the door** to the circuit's editor — the block alone on a sheet, no
 * clock, no people, Retire in its header.
 *
 * "New circuit ▾" holds the two creates its siblings do: Start from blank (the block alone on a
 * sheet, ready to type into) · Bring one forward from a past season (last year's multi-station
 * blocks, by title). Most circuits are made from a block's own door on the plan — *Save to my
 * circuits…* — which is why this tab's empty state says so.
 *
 * ⚠ A VIEW, not a page — the hub resolves the team and the gates; absent for a coach the read
 * would refuse. ⚠ Sorted by NAME, never by use. ⚠ "Started 8 plans", never "used 8×". ⚠ Retired,
 * not deleted. ⚠ Live-season only, no archive door — a circuit library is an INSTRUMENT.
 */

type ImportRow = PastSeasonRow & { name: string; block: unknown; line: string; planCount: number; lastPlannedAt: string | null };

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

const fmtDate = (iso: string) =>
  formatInOrgZone(iso, { day: 'numeric', month: 'short', year: 'numeric' });

export default function CircuitsView({ orgSlug, teamId }: { orgSlug: string; teamId: string }) {
  const router = useRouter();
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const apiBase = `/api/coaches/${orgSlug}/teams/${teamId}/development/circuits`;

  const [data, setData] = useState<{ circuits: RepTeamCircuitWithUsage[]; canWrite: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showRetired, setShowRetired] = useState(false);
  const [creating, setCreating] = useState(false);


  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const res = await fetch(`${apiBase}?all=1`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not load your circuits.');
      const json = await res.json();
      setData({ circuits: json.circuits ?? [], canWrite: !!json.canWrite });
    } catch (e) {
      setLoadError(errorMessage(e, 'Could not load your circuits.'));
    } finally {
      setLoading(false);
    }
  }, [apiBase]);
  useEffect(() => { load(); }, [load]);
  const importer = usePastSeasonImport<ImportRow>({
    readUrl: `${apiBase}/past-seasons`, rowsKey: 'circuits', createUrl: apiBase,
    bodyOf: row => ({ name: row.name, block: row.block, tagIds: [] }), onAdded: load, noun: 'circuit',
  });
  useOverlayOpen(importer.open);

  const circuits = useMemo(() => data?.circuits ?? [], [data]);
  const canWrite = !!data?.canWrite;

  const active = useMemo(() => circuits.filter(c => c.isActive), [circuits]);
  const retired = useMemo(() => circuits.filter(c => !c.isActive), [circuits]);
  // The SAME predicate every library list uses — one rule, so no two lists can drift.
  const shown = useMemo(() => filterTagged(active, query, tagFilter), [active, query, tagFilter]);

  /** "Start from blank" — the template's idiom: a row now, the editor at once. */
  async function newCircuit() {
    if (creating) return;
    setCreating(true); setLoadError('');
    try {
      const taken = new Set(active.map(c => c.name.toLowerCase()));
      let name = 'New circuit';
      for (let n = 2; taken.has(name.toLowerCase()); n += 1) name = `New circuit ${n}`;
      const res = await fetch(apiBase, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Could not start a circuit.');
      router.push(circuitHref(base, json.circuit.id));
    } catch (e) {
      setLoadError(errorMessage(e, 'Could not start a circuit.'));
      setCreating(false);
    }
  }


  const helpRequest = {
    module: 'coaches' as const,
    sectionIds: ['premium-circuit-library'],
    label: 'Circuits',
    fullGuideHref: `/${orgSlug}/coaches/help#premium-circuit-library`,
  };

  const headerCreate = canWrite && (
    <CoachToolbarMenu
      label="New circuit"
      icon={<Plus size={15} aria-hidden />}
      variant="primary"
      collapseOnPhone
    >
      <CoachToolbarMenuItem
        icon={<Plus size={15} aria-hidden />}
        label={creating ? 'Starting…' : 'Start from blank'}
        hint="A block with stations you build up yourself"
        disabled={creating}
        onSelect={newCircuit}
      />
      <CoachToolbarMenuItem
        icon={<History size={15} aria-hidden />}
        label="Bring one forward from a past season"
        hint="Copy a circuit you already ran"
        onSelect={importer.openImport}
      />
    </CoachToolbarMenu>
  );

  const row = (circuit: RepTeamCircuitWithUsage) => {
    // The stations' names are the browsable fact; the minutes and the template's kind of count —
    // plans it was placed on, in words, never a bare 0 — each read ONCE for both faces.
    const line = circuitLine(circuit.block);
    const usually = circuit.block.duration.minutes ? `${circuit.block.duration.minutes} min` : null;
    const started = templateUseLabel(circuit.planCount);
    return (
      <LibraryTableRow
        key={circuit.id}
        name={circuit.name}
        tags={circuit.tags}
        retired={!circuit.isActive}
        line={line || 'Nothing in it yet'}
        quietLine={!line}
        facts={[usually, started].filter(Boolean).join(' · ')}
        cells={[
          { label: 'Usually', value: usually ?? <span className={styles.devRowDash}>—</span>, shrink: true, data: true },
          { label: 'Started', value: circuit.lastPlannedAt ? `${started} · last ${fmtDate(circuit.lastPlannedAt)}` : started, shrink: true },
        ]}
        onOpen={() => router.push(circuitHref(base, circuit.id))}
        openLabel={`Open ${circuit.name}`}
      />
    );
  };
  const head = (
    <>
      <th className={styles.th}>Circuit</th>
      <th className={`${styles.th} ${styles.tdShrink}`}>Usually</th>
      <th className={`${styles.th} ${styles.tdShrink}`}>Started</th>
    </>
  );

  return (
    <div className={styles.page}>
      <CoachPageHeader
        icon={NotebookPen}
        title="Practice plans"
        actions={headerCreate || undefined}
        actionsPhoneInTitleRow
        actionsPhoneHidden={!canWrite}
        helpLabel="Circuits"
        help={helpRequest}
      />
      <PracticePlansTabs base={base} active="circuits" showLibrary />

      {loadError && <p className={styles.errorText} role="alert">{loadError}</p>}

      {loading ? (
        <div className={styles.loadingState}>Loading your circuits…</div>
      ) : circuits.length === 0 ? (
        <CoachEmptyState
          icon={<Repeat size={22} />}
          headline="No circuits yet"
          description="A circuit is a block with stations. Save one from a plan — open the block and choose Save to my circuits… — or build one here; then it drops onto any practice as a whole block."
          blocker={canWrite ? undefined : 'Managing circuits comes with Schedule: View + edit — ask your head coach.'}
          secondaryAction={canWrite ? { label: 'Add from a past season', onClick: importer.openImport } : undefined}
        >
          {canWrite && (
            <button type="button" className={styles.btnPrimary} disabled={creating} onClick={newCircuit}>
              <Plus size={14} aria-hidden /> {creating ? 'Starting…' : 'New circuit'}
            </button>
          )}
        </CoachEmptyState>
      ) : (
        <>
          <LibraryFilterBar items={active} noun="circuits" query={query} tagFilter={tagFilter} onQuery={setQuery} onTagFilter={setTagFilter} />

          {shown.length === 0 ? (
            <p className={styles.formHint}>No circuits match that.</p>
          ) : (
            <LibraryTable label="Circuits" head={head}>{shown.map(row)}</LibraryTable>
          )}

          {retired.length > 0 && (
            <div className={styles.ppRetiredWrap}>
              <button type="button" className={styles.ppAddInline} onClick={() => setShowRetired(s => !s)}>
                {showRetired ? 'Hide' : 'Show'} retired ({retired.length})
              </button>
              {showRetired && <LibraryTable label="Retired circuits" head={head}>{retired.map(row)}</LibraryTable>}
            </div>
          )}
        </>
      )}

      <PastSeasonImportDialog
        state={importer}
        hint="Blocks with stations you ran before, ready to become circuits. Adding one copies its stations into your library — nothing in the old practice changes, and no players come with it."
        emptyText="Nothing to bring forward — no practice from a past season had a block with stations."
        describe={row => ({
          name: row.name,
          facts: [`In ${row.planCount} plan${row.planCount === 1 ? '' : 's'}`, row.lastPlannedAt ? `last planned ${fmtDate(row.lastPlannedAt)}` : null].filter(Boolean).join(' · '),
          line: row.line,
        })}
      />
    </div>
  );
}
