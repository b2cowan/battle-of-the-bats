'use client';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, History, Library, Plus, RotateCcw, X } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { formatInOrgZone } from '@/lib/timezone';
import {
  MAX_DRILL_MINUTES, MAX_DRILL_NAME_LEN, MAX_DRILL_POINTS,
  MAX_DRILL_POINT_LEN, MAX_DRILL_TEXT_LEN, UNTAGGED_FILTER, collectTags,
  filterTagged, sortDrillsForPicker,
  type DrillInput, type RepTeamDrillWithUsage,
} from '@/lib/rep-drills';
import TagPicker, { type PickableTag } from '@/components/coaches/TagPicker';
import CoachBackLink from '@/components/coaches/CoachBackLink';
import styles from '../../../../coaches.module.css';

/**
 * The drill library's own room (Practice Plans Phase 2, D15).
 *
 * ⚠ **Sorted by NAME, never by use.** A "most used" ordering is a ranking, and the library must not
 * quietly tell a coach which of their own ideas is best — the instinct §4 applies to children,
 * applied one level out. Shared club drills lead, then the team's own, each A–Z.
 *
 * ⚠ **"In 8 plans" is a fact about a DRILL** and is the one count this feature is allowed to show.
 * Zero renders as "Not in a plan yet" in words, so an unused drill never reads as a failing score.
 * ⚠ **PLANS, never practices** — nothing records what was actually run (D4), so "used 8×" would be
 * a claim the data cannot support.
 *
 * ⚠ **Nothing is seeded and no tag is supplied.** Every drill and tag here is coach-typed;
 * a "Hitting / Fielding / Pitching" list would be one sport talking to a platform serving many.
 * That binds the placeholders too, not just the data.
 *
 * ⚠ **No archive door.** This room is live-season only (owner ruling 2026-08-01) — the Development
 * hub hides its door in a completed season, and the API resolves live context regardless.
 */

type LoadState = { drills: RepTeamDrillWithUsage[]; canWrite: boolean };

type ImportRow = {
  key: string;
  drill: DrillInput;
  planCount: number;
  lastPlannedAt: string | null;
  alreadyInLibrary: boolean;
};

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

const emptyDraft = (): DrillInput => ({
  name: '', tagIds: [], usualMinutes: null, description: '', goal: '',
  coachingPoints: [], setup: '', equipment: [],
});

// ── Sub-components at MODULE level (never in a render body — a component declared inside one is a
// new type every render, so React remounts its subtree and a form loses focus every keystroke). ──

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className={styles.ppFieldLabel}>{children}</span>;
}

function DrillForm({
  draft, tags, onCreateTag, busy, error, submitLabel, onChange, onSubmit, onCancel,
}: {
  draft: DrillInput;
  tags: PickableTag[];
  onCreateTag: (name: string) => Promise<PickableTag | null>;
  busy: boolean;
  error: string;
  submitLabel: string;
  onChange: (next: DrillInput) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const points = draft.coachingPoints ?? [];
  const equipment = draft.equipment ?? [];
  const [equipDraft, setEquipDraft] = useState('');

  const addEquip = () => {
    const v = equipDraft.trim();
    if (v && !equipment.some(e => e.toLowerCase() === v.toLowerCase())) {
      onChange({ ...draft, equipment: [...equipment, v] });
    }
    setEquipDraft('');
  };

  return (
    <div className={styles.ppDrillWrite}>
      <label className={styles.ppField}>
        <FieldLabel>Name</FieldLabel>
        <input className={styles.input} value={draft.name} maxLength={MAX_DRILL_NAME_LEN} autoFocus
          placeholder="What do you call it?"
          onChange={e => onChange({ ...draft, name: e.target.value })} />
      </label>

      {/* Coach-typed vocabulary, offered from what they've already used — never a fixed list. The
          SAME tags a focus area can carry, which is what lets the two actually match. */}
      <TagPicker
        label="Tags"
        all={tags}
        selected={draft.tagIds ?? []}
        onChange={next => onChange({ ...draft, tagIds: next })}
        onCreate={onCreateTag}
        emptyHint="No tags yet — type a word to make your first one."
      />

      <div className={styles.ppDuration}>
        <label className={styles.ppField}>
          {/* ONE number. Ranges were removed at owner QA and are not returning via the library. */}
          <FieldLabel>Usually</FieldLabel>
          <input className={`${styles.input} ${styles.ppMinutes}`} type="number" min={1} max={MAX_DRILL_MINUTES}
            inputMode="numeric" value={draft.usualMinutes ?? ''} aria-label="Usual minutes"
            onChange={e => onChange({ ...draft, usualMinutes: e.target.value ? Number(e.target.value) : null })} />
        </label>
      </div>

      <label className={styles.ppField}>
        <FieldLabel>What you&apos;re doing</FieldLabel>
        <textarea className={styles.textarea} rows={2} value={draft.description ?? ''} maxLength={MAX_DRILL_TEXT_LEN}
          placeholder="How it runs"
          onChange={e => onChange({ ...draft, description: e.target.value })} />
      </label>

      <label className={styles.ppField}>
        <FieldLabel>What you&apos;re watching for</FieldLabel>
        <textarea className={styles.textarea} rows={2} value={draft.goal ?? ''} maxLength={MAX_DRILL_TEXT_LEN}
          placeholder="What good looks like"
          onChange={e => onChange({ ...draft, goal: e.target.value })} />
      </label>

      <div className={styles.ppField}>
        <FieldLabel>Coaching points</FieldLabel>
        {points.map((point, i) => (
          <div key={i} className={styles.ppPointRow}>
            <span className={styles.ppPointNum}>{i + 1}</span>
            <input className={styles.input} value={point} maxLength={MAX_DRILL_POINT_LEN}
              aria-label={`Coaching point ${i + 1}`}
              onChange={e => onChange({ ...draft, coachingPoints: points.map((p, j) => (j === i ? e.target.value : p)) })} />
            <button type="button" className={styles.ppIconBtn} aria-label={`Remove point ${i + 1}`}
              onClick={() => onChange({ ...draft, coachingPoints: points.filter((_, j) => j !== i) })}>
              <X size={14} />
            </button>
          </div>
        ))}
        {points.length < MAX_DRILL_POINTS && (
          <button type="button" className={styles.ppAddInline}
            onClick={() => onChange({ ...draft, coachingPoints: [...points, ''] })}>
            <Plus size={13} aria-hidden /> Add a point
          </button>
        )}
      </div>

      <label className={styles.ppField}>
        <FieldLabel>Setup</FieldLabel>
        <textarea className={styles.textarea} rows={2} value={draft.setup ?? ''} maxLength={MAX_DRILL_TEXT_LEN}
          placeholder="How it's laid out — where things go, and how far apart"
          onChange={e => onChange({ ...draft, setup: e.target.value })} />
      </label>

      <div className={styles.ppFieldRow}>
        <FieldLabel>Equipment</FieldLabel>
        <div className={styles.ppChipWrap}>
          {equipment.map(e => (
            <span key={e} className={styles.ppChip}>
              {e}
              <button type="button" className={styles.ppChipX} aria-label={`Remove ${e}`}
                onClick={() => onChange({ ...draft, equipment: equipment.filter(x => x !== e) })}>
                <X size={11} />
              </button>
            </span>
          ))}
          <input className={`${styles.input} ${styles.inlineField}`} value={equipDraft}
            placeholder="Add kit…" aria-label="Equipment" maxLength={MAX_DRILL_NAME_LEN}
            onChange={e => setEquipDraft(e.target.value)} onBlur={addEquip}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEquip(); } }} />
        </div>
      </div>

      {error && <p className={styles.errorText} role="alert">{error}</p>}

      <div className={styles.modalFooter}>
        <button type="button" className={styles.btnGhost} onClick={onCancel}>Cancel</button>
        <button type="button" className={styles.btnPrimary} disabled={busy || !draft.name.trim()} onClick={onSubmit}>
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </div>
  );
}

function DrillRow({
  drill, canWrite, busy, onEdit, onRetire, onRestore,
}: {
  drill: RepTeamDrillWithUsage;
  canWrite: boolean;
  busy: boolean;
  onEdit: () => void;
  onRetire: () => void;
  onRestore: () => void;
}) {
  const shared = drill.teamId === null;
  return (
    <div className={styles.ppDrillCard} data-retired={drill.isActive ? undefined : 'retired'}>
      <div className={styles.ppDrillRowMain}>
        <span className={styles.ppDrillRowName}>
          {drill.name}
          {shared && <span className={styles.ppSharedChip}>Club</span>}
          {drill.tags.length > 0 && (
            <span className={styles.tagReadRow}>
              {drill.tags.map(t => <span key={t.id} className={styles.tagRead}>{t.name}</span>)}
            </span>
          )}
        </span>
        <span className={styles.ppDrillRowMeta}>
          {[
            drill.usualMinutes ? `${drill.usualMinutes} min` : null,
            // ⚠ PLANS, never practices (D4) — and written out, never a bare 0, so an unused drill
            // is not made to read as a failing score.
            drill.planCount > 0
              ? `In ${drill.planCount} plan${drill.planCount === 1 ? '' : 's'}`
              : 'Not in a plan yet',
          ].filter(Boolean).join(' · ')}
        </span>
        {drill.description && <p className={styles.ppReadTxt}>{drill.description}</p>}
      </div>
      {/* ⚠ A club drill offers a coach NO controls at all — absent, not disabled. Only an org
          admin manages the shared set, and a disabled button would imply otherwise. */}
      {canWrite && !shared && (
        <div className={styles.ppDrillRowActions}>
          {drill.isActive ? (
            <>
              <button type="button" className={styles.ppAddInline} disabled={busy} onClick={onEdit}>Edit</button>
              <button type="button" className={styles.ppAddInline} disabled={busy} onClick={onRetire}>
                <Archive size={12} aria-hidden /> Retire
              </button>
            </>
          ) : (
            <button type="button" className={styles.ppAddInline} disabled={busy} onClick={onRestore}>
              <RotateCcw size={12} aria-hidden /> Restore
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function CoachDrillsPage({
  params,
}: { params: Promise<{ orgSlug: string; teamId: string }> }) {
  const { orgSlug, teamId } = use(params);
  const { assignments, loading: ctxLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const apiBase = `/api/coaches/${orgSlug}/teams/${teamId}/development/drills`;

  const [data, setData] = useState<LoadState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showRetired, setShowRetired] = useState(false);

  const [editing, setEditing] = useState<{ id: string | null; draft: DrillInput } | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const [importError, setImportError] = useState('');
  const [importingKey, setImportingKey] = useState<string | null>(null);

  useOverlayOpen(!!editing || importOpen);

  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const res = await fetch(`${apiBase}?all=1`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not load your drills.');
      const json = await res.json();
      setData({ drills: json.drills ?? [], canWrite: !!json.canWrite });
    } catch (e) {
      setLoadError(errorMessage(e, 'Could not load your drills.'));
    } finally {
      setLoading(false);
    }
  }, [apiBase]);
  useEffect(() => { load(); }, [load]);

  // Memoised because `?? []` mints a NEW array on every render, which would make every memo below
  // it (the chips, active, retired, the filtered list) recompute on every keystroke in the search
  // box — the walk of the whole library repeated per character.
  const drills = useMemo(() => data?.drills ?? [], [data]);
  const canWrite = !!data?.canWrite;

  /**
   * The team's whole 'focus' vocabulary — NOT just the tags currently in use.
   *
   * ⚠ Deliberately a separate fetch from the drills. The picker must offer every tag the team has,
   * including ones only a focus area or a template uses; deriving the list from the drills on screen
   * would quietly hide vocabulary the coach has already created and invite them to mint a duplicate.
   * The filter CHIPS below are derived from what is on screen, which is a different question.
   */
  const [tags, setTags] = useState<PickableTag[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/focus-tags`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setTags(json.tags ?? []);
      } catch { /* the picker degrades to "no tags yet"; the drill still saves */ }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, teamId]);

  const createTag = useCallback(async (name: string): Promise<PickableTag | null> => {
    const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/focus-tags`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const tag: PickableTag = json.tag;
    setTags(prev => (prev.some(t => t.id === tag.id) ? prev : [...prev, tag]));
    return tag;
  }, [orgSlug, teamId]);

  const chipTags = useMemo(() => collectTags(drills), [drills]);

  const active = useMemo(() => drills.filter(d => d.isActive), [drills]);
  const retired = useMemo(() => drills.filter(d => !d.isActive), [drills]);

  // The SAME predicate the in-plan picker uses — one rule, so the two lists can't drift.
  const shown = useMemo(
    () => filterTagged(sortDrillsForPicker(active), query, tagFilter),
    [active, query, tagFilter],
  );

  async function saveDrill() {
    if (!editing) return;
    setFormBusy(true); setFormError('');
    try {
      const res = await fetch(editing.id ? `${apiBase}/${editing.id}` : apiBase, {
        method: editing.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing.draft),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not save that drill.');
      setEditing(null);
      await load();
    } catch (e) {
      setFormError(errorMessage(e, 'Could not save that drill.'));
    } finally {
      setFormBusy(false);
    }
  }

  async function setActive(id: string, isActive: boolean) {
    setBusyId(id);
    try {
      const res = await fetch(`${apiBase}/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'That didn’t work.');
      await load();
    } catch (e) {
      setLoadError(errorMessage(e, 'That didn’t work.'));
    } finally {
      setBusyId(null);
    }
  }

  async function openImport() {
    setImportOpen(true); setImportError(''); setImportRows(null);
    try {
      const res = await fetch(`${apiBase}/past-seasons`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not read your past seasons.');
      const json = await res.json();
      setImportRows(json.drills ?? []);
    } catch (e) {
      setImportError(errorMessage(e, 'Could not read your past seasons.'));
    }
  }

  async function importDrill(row: ImportRow) {
    setImportingKey(row.key); setImportError('');
    try {
      const res = await fetch(apiBase, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row.drill),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not add that drill.');
      // Mark it in place rather than removing the row — a list that reshuffles under a coach's
      // thumb while they add three drills is how the wrong one gets tapped.
      setImportRows(rows => rows?.map(r => (r.key === row.key ? { ...r, alreadyInLibrary: true } : r)) ?? null);
      await load();
    } catch (e) {
      setImportError(errorMessage(e, 'Could not add that drill.'));
    } finally {
      setImportingKey(null);
    }
  }

  const helpRequest = {
    module: 'coaches' as const,
    sectionIds: ['premium-drill-library'],
    label: 'Your drills',
    fullGuideHref: `/${orgSlug}/coaches/help#premium-drill-library`,
  };

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  if (!assignment) {
    return <div className={styles.notAssigned}><h2>Team not found</h2><p>You are not assigned to this team.</p></div>;
  }

  const header = (
    <>
      <CoachBackLink href={`${base}/development`}>Development</CoachBackLink>
      {/* Page-header ruling 2026-08-11: the blurb's promise ("write it once, four taps after
          that") is already the empty state's description, where a coach with no drills reads it. */}
      <CoachPageHeader
        icon={Library}
        title="Your drills"
        helpLabel="Your drills"
        help={helpRequest}
      />
    </>
  );

  return (
    <div className={styles.page}>
      {header}

      {loadError && <p className={styles.errorText} role="alert">{loadError}</p>}

      {loading ? (
        <div className={styles.loadingState}>Loading your drills…</div>
      ) : drills.length === 0 ? (
        <CoachEmptyState
          icon={<Library size={22} />}
          headline="No drills yet"
          description="Save a drill once — the setup, what you're watching for, the coaching points — and adding it to a practice becomes four taps."
          blocker={canWrite ? undefined : 'Your head coach manages the team’s drills.'}
          secondaryAction={canWrite ? { label: 'Add from a past season', onClick: openImport } : undefined}
        >
          {canWrite && (
            <button type="button" className={styles.btnPrimary}
              onClick={() => { setFormError(''); setEditing({ id: null, draft: emptyDraft() }); }}>
              <Plus size={14} aria-hidden /> New drill
            </button>
          )}
        </CoachEmptyState>
      ) : (
        <>
          <div className={styles.ppDrillFilters}>
            <input className={styles.input} value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search drills…" aria-label="Search drills" />
            {canWrite && (
              <div className={styles.ppDrillRowActions}>
                <button type="button" className={styles.btnSecondary} onClick={openImport}>
                  <History size={14} aria-hidden /> Add from a past season
                </button>
                <button type="button" className={styles.btnPrimary}
                  onClick={() => { setFormError(''); setEditing({ id: null, draft: emptyDraft() }); }}>
                  <Plus size={14} aria-hidden /> New drill
                </button>
              </div>
            )}
          </div>

          <div className={styles.ppSuggestWrap}>
            <button type="button" className={styles.ppSuggestChip} data-on={tagFilter == null ? 'on' : undefined}
              onClick={() => setTagFilter(null)}>All <span>{active.length}</span></button>
            {chipTags.map(t => (
              <button key={t.id} type="button" className={styles.ppSuggestChip}
                data-on={tagFilter === t.id ? 'on' : undefined} onClick={() => setTagFilter(t.id)}>
                {t.name} <span>{active.filter(d => d.tags.some(x => x.id === t.id)).length}</span>
              </button>
            ))}
            {/* ⚠ Always offered when it applies — a drill must never become unreachable simply by
                carrying no tags. */}
            {active.some(d => d.tags.length === 0) && (
              <button type="button" className={styles.ppSuggestChip}
                data-on={tagFilter === UNTAGGED_FILTER ? 'on' : undefined}
                onClick={() => setTagFilter(UNTAGGED_FILTER)}>
                No tags <span>{active.filter(d => d.tags.length === 0).length}</span>
              </button>
            )}
          </div>

          {shown.length === 0 ? (
            <p className={styles.formHint}>No drills match that.</p>
          ) : shown.map(drill => (
            <DrillRow key={drill.id} drill={drill} canWrite={canWrite} busy={busyId === drill.id}
              onEdit={() => {
                setFormError('');
                setEditing({
                  id: drill.id,
                  draft: {
                    name: drill.name, tagIds: drill.tags.map(t => t.id), usualMinutes: drill.usualMinutes,
                    description: drill.description ?? '', goal: drill.goal ?? '',
                    coachingPoints: drill.coachingPoints, setup: drill.setup ?? '', equipment: drill.equipment,
                  },
                });
              }}
              onRetire={() => setActive(drill.id, false)}
              onRestore={() => setActive(drill.id, true)}
            />
          ))}

          {retired.length > 0 && (
            <div className={styles.ppRetiredWrap}>
              <button type="button" className={styles.ppAddInline} onClick={() => setShowRetired(s => !s)}>
                {showRetired ? 'Hide' : 'Show'} retired ({retired.length})
              </button>
              {showRetired && retired.map(drill => (
                <DrillRow key={drill.id} drill={drill} canWrite={canWrite} busy={busyId === drill.id}
                  onEdit={() => {}} onRetire={() => {}} onRestore={() => setActive(drill.id, true)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── New / edit ── */}
      {editing && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true"
          aria-label={editing.id ? 'Edit drill' : 'New drill'}
          onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className={`${styles.modal} ${styles.modalScrollBody}`}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{editing.id ? 'Edit drill' : 'New drill'}</h3>
              <button type="button" className={styles.modalCloseBtn} aria-label="Close" onClick={() => setEditing(null)}>
                <X size={18} />
              </button>
            </div>
            <DrillForm
              draft={editing.draft}
              tags={tags}
              onCreateTag={createTag}
              busy={formBusy}
              error={formError}
              submitLabel={editing.id ? 'Save' : 'Add drill'}
              onChange={draft => setEditing(e => (e ? { ...e, draft } : e))}
              onSubmit={saveDrill}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      )}

      {/* ── "Add from a past season" — the owner's archive ruling made concrete ── */}
      {importOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Add from a past season"
          onClick={e => { if (e.target === e.currentTarget) setImportOpen(false); }}>
          <div className={`${styles.modal} ${styles.modalScrollBody}`}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Add from a past season</h3>
              <button type="button" className={styles.modalCloseBtn} aria-label="Close" onClick={() => setImportOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.ppDrillWrite}>
              <p className={styles.formHint}>
                What you ran before, ready to become a drill. Adding one copies it into your library —
                nothing in the old practice changes.
              </p>
              {importError && <p className={styles.errorText} role="alert">{importError}</p>}
              {importRows === null && !importError && <p className={styles.formHint}>Looking…</p>}
              {importRows?.length === 0 && (
                <p className={styles.formHint}>
                  Nothing to bring forward — this team has no practice plans from a past season yet.
                </p>
              )}
              {importRows?.map(row => (
                <div key={row.key} className={styles.ppDrillCard} data-retired={row.alreadyInLibrary ? 'retired' : undefined}>
                  <div className={styles.ppDrillRowMain}>
                    <span className={styles.ppDrillRowName}>{row.drill.name}</span>
                    {/* ⚠ "planned", never "ran" — see the module header. */}
                    <span className={styles.ppDrillRowMeta}>
                      In {row.planCount} plan{row.planCount === 1 ? '' : 's'}
                      {row.lastPlannedAt
                        ? ` · last planned ${formatInOrgZone(row.lastPlannedAt, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}`
                        : ''}
                    </span>
                  </div>
                  <div className={styles.ppDrillRowActions}>
                    {/* ⚠ Shown and greyed, never hidden — a coach scanning for a drill they
                        remember should find it and see WHY it isn't offered. */}
                    {row.alreadyInLibrary
                      ? <span className={styles.ppDrillRowMeta}>Already in your library</span>
                      : (
                        <button type="button" className={styles.btnSecondary} disabled={importingKey === row.key}
                          onClick={() => importDrill(row)}>
                          {importingKey === row.key ? 'Adding…' : 'Add'}
                        </button>
                      )}
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.btnPrimary} onClick={() => setImportOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
