'use client';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Archive, BookMarked, History, Plus, RotateCcw, Tags, X } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import CoachNotOnTeam from '@/components/coaches/CoachNotOnTeam';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import TagManagerModal from '@/components/coaches/TagManagerModal';
import TagPicker, { type PickableTag } from '@/components/coaches/TagPicker';
import { useFocusTags } from '@/components/coaches/use-focus-tags';
import CoachBackLink from '@/components/coaches/CoachBackLink';
import { formatInOrgZone } from '@/lib/timezone';
import { UNTAGGED_FILTER, collectTags, filterTagged } from '@/lib/rep-drills';
import {
  MAX_TEMPLATE_NAME_LEN, templateShapeLabel, templateUseLabel,
  type RepTeamPlanTemplateWithUsage,
} from '@/lib/rep-plan-templates';
import type { RepTeamTag } from '@/lib/types';
import styles from '../../../../coaches.module.css';

/**
 * The plan-template room (Practice Plans Phase 3, frames 01–03).
 *
 * ⚠ **ONE FLAT LIST, filtered by tag chips — never category groups.** Templates carry SEVERAL tags
 * now, so a grouped list would print the same template under two headings. "No tags" is always
 * offered when it applies, so a template can never become unreachable by having none.
 *
 * ⚠ **Sorted by NAME, never by use.** "Most used first" is a ranking, and the library must not
 * quietly tell a coach which of their own ideas is best — the instinct §4 applies to children,
 * applied one level out.
 *
 * ⚠ **"Started 8 plans", never "used 8×"** — a template's count is a fact about the PLANS it
 * produced, and nothing records what was actually run (D4). Zero renders as "Not started a plan
 * yet" in words, so an unused template never reads as a failing score.
 *
 * ⚠ **Retired, not deleted**, and a retired template dims in place rather than disappearing —
 * plans it already started keep reading exactly as written.
 *
 * ⚠ **No archive door.** This room is live-season only (owner ruling 2026-08-01) — a template
 * library is a reusable INSTRUMENT, and the Development hub hides its door in a completed season.
 * A coach loses nothing: templates are keyed by TEAM, so they cross a rollover on their own.
 *
 * ⚠ **An assistant with read access sees no Rename, Retire, New or Save controls at all** — absent,
 * not disabled.
 */

type ImportRow = {
  key: string;
  name: string;
  plan: unknown;
  shapeLabel: string;
  planCount: number;
  lastPlannedAt: string | null;
  alreadyInLibrary: boolean;
};

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

const fmtDate = (iso: string) =>
  formatInOrgZone(iso, { day: 'numeric', month: 'short', year: 'numeric' });

// ── Sub-components at MODULE level (never in a render body — a component declared inside one is a
// new type every render, so React remounts its subtree and a form loses focus every keystroke). ──

function TemplateRow({
  template, canWrite, busy, onRename, onRetire, onRestore, href,
}: {
  template: RepTeamPlanTemplateWithUsage;
  canWrite: boolean;
  busy: boolean;
  onRename: () => void;
  onRetire: () => void;
  onRestore: () => void;
  href: string;
}) {
  return (
    <div className={styles.ppDrillCard} data-retired={template.isActive ? undefined : 'retired'}>
      <div className={styles.ppDrillRowMain}>
        <span className={styles.ppDrillRowName}>
          <Link href={href} className={styles.ppTemplateLink}>{template.name}</Link>
          {!template.isActive && <span className={styles.ppSharedChip}>Retired</span>}
          {template.tags.length > 0 && (
            <span className={styles.tagReadRow}>
              {template.tags.map(t => <span key={t.id} className={styles.tagRead}>{t.name}</span>)}
            </span>
          )}
        </span>
        <span className={styles.ppDrillRowMeta}>
          {[
            templateShapeLabel(template.plan),
            // ⚠ PLANS, never practices (D4) — and written out, never a bare 0.
            templateUseLabel(template.planCount),
            template.lastPlannedAt ? `last planned ${fmtDate(template.lastPlannedAt)}` : null,
          ].filter(Boolean).join(' · ')}
        </span>
      </div>
      {canWrite && (
        <div className={styles.ppDrillRowActions}>
          {template.isActive ? (
            <>
              <button type="button" className={styles.ppAddInline} disabled={busy} onClick={onRename}>Rename</button>
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

function RenameDialog({
  template, tags, onCreateTag, busy, error, onSave, onClose,
}: {
  template: RepTeamPlanTemplateWithUsage;
  tags: PickableTag[];
  onCreateTag: (name: string) => Promise<PickableTag | null>;
  busy: boolean;
  error: string;
  onSave: (name: string, tagIds: string[]) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(template.name);
  const [tagIds, setTagIds] = useState<string[]>(template.tags.map(t => t.id));
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Rename template"
      onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`${styles.modal} ${styles.modalScrollBody}`}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Rename template</h3>
          <button type="button" className={styles.modalCloseBtn} aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className={styles.ppDrillWrite}>
          <label className={styles.ppField}>
            <span className={styles.ppFieldLabel}>Name</span>
            <input className={styles.input} value={name} maxLength={MAX_TEMPLATE_NAME_LEN} autoFocus
              onChange={e => setName(e.target.value)} />
          </label>
          <TagPicker label="Tags" all={tags} selected={tagIds} onChange={setTagIds} onCreate={onCreateTag}
            emptyHint="No tags yet — type a word to make your first one." />
          {error && <p className={styles.errorText} role="alert">{error}</p>}
          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnGhost} onClick={onClose}>Cancel</button>
            <button type="button" className={styles.btnPrimary} disabled={busy || !name.trim()}
              onClick={() => onSave(name.trim(), tagIds)}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CoachPlanTemplatesPage({
  params,
}: { params: Promise<{ orgSlug: string; teamId: string }> }) {
  const { orgSlug, teamId } = use(params);
  const router = useRouter();
  const { assignments, loading: ctxLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const apiBase = `/api/coaches/${orgSlug}/teams/${teamId}/development/plan-templates`;

  const [data, setData] = useState<{ templates: RepTeamPlanTemplateWithUsage[]; canWrite: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showRetired, setShowRetired] = useState(false);

  const [renaming, setRenaming] = useState<RepTeamPlanTemplateWithUsage | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const [importError, setImportError] = useState('');
  const [importingKey, setImportingKey] = useState<string | null>(null);

  const [tagManagerOpen, setTagManagerOpen] = useState(false);

  useOverlayOpen(!!renaming || importOpen || tagManagerOpen);

  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const res = await fetch(`${apiBase}?all=1`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not load your templates.');
      const json = await res.json();
      setData({ templates: json.templates ?? [], canWrite: !!json.canWrite });
    } catch (e) {
      setLoadError(errorMessage(e, 'Could not load your templates.'));
    } finally {
      setLoading(false);
    }
  }, [apiBase]);
  useEffect(() => { load(); }, [load]);

  // Memoised because `?? []` mints a NEW array on every render, which would make every memo below
  // recompute on every keystroke in the search box.
  const templates = useMemo(() => data?.templates ?? [], [data]);
  const canWrite = !!data?.canWrite;

  /**
   * The team's whole 'focus' vocabulary — NOT just the tags in use here.
   *
   * ⚠ Deliberately a separate fetch. The picker must offer every tag the team has, including ones
   * only a drill or a focus area uses; deriving it from what is on screen would hide vocabulary the
   * coach already created and invite them to mint a duplicate. The filter CHIPS below ARE derived
   * from what is on screen, which is a different question.
   */
  const { tags, createTag, reload: loadTags } = useFocusTags(orgSlug, teamId);

  const active = useMemo(() => templates.filter(t => t.isActive), [templates]);
  const retired = useMemo(() => templates.filter(t => !t.isActive), [templates]);
  const chipTags = useMemo(() => collectTags(active), [active]);

  // The SAME predicate the drill library and the in-plan picker use — one rule, three lists.
  const shown = useMemo(() => filterTagged(active, query, tagFilter), [active, query, tagFilter]);

  /**
   * "New template" is offered at ZERO as well as at one (owner ruling, frame 03).
   *
   * ⚠ The cost, accepted: the room owns a full block-and-station editor rather than a rename box,
   * because a template built from scratch has no practice to inherit a shape from. It creates the
   * row here and hands off to that editor — so a coach never faces a modal that asks them to
   * design a practice inside a dialog.
   */
  async function newTemplate() {
    if (creating) return;
    setCreating(true); setLoadError('');
    try {
      // A working name they will replace, so the editor opens on the shape rather than on a form.
      // The unique index is on ACTIVE names, so a second untitled one is numbered rather than
      // refused — a coach making two in a row must not meet a 409 for a name they never chose.
      const taken = new Set(active.map(t => t.name.toLowerCase()));
      let name = 'New template';
      for (let n = 2; taken.has(name.toLowerCase()); n += 1) name = `New template ${n}`;
      const res = await fetch(apiBase, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Could not start a template.');
      router.push(`${base}/development/templates/${json.template.id}`);
    } catch (e) {
      setLoadError(errorMessage(e, 'Could not start a template.'));
      setCreating(false);
    }
  }

  async function saveRename(name: string, tagIds: string[]) {
    if (!renaming) return;
    setFormBusy(true); setFormError('');
    try {
      const res = await fetch(`${apiBase}/${renaming.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, tagIds }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not save that.');
      setRenaming(null);
      await load();
    } catch (e) {
      setFormError(errorMessage(e, 'Could not save that.'));
    } finally {
      setFormBusy(false);
    }
  }

  async function setActiveState(id: string, isActive: boolean) {
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
      setImportRows(json.templates ?? []);
    } catch (e) {
      setImportError(errorMessage(e, 'Could not read your past seasons.'));
    }
  }

  async function importTemplate(row: ImportRow) {
    setImportingKey(row.key); setImportError('');
    try {
      const res = await fetch(apiBase, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: row.name, plan: row.plan, tagIds: [] }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not add that template.');
      // Marked in place rather than removed — a list that reshuffles under a coach's thumb while
      // they add three templates is how the wrong one gets tapped.
      setImportRows(rows => rows?.map(r => (r.key === row.key ? { ...r, alreadyInLibrary: true } : r)) ?? null);
      await load();
    } catch (e) {
      setImportError(errorMessage(e, 'Could not add that template.'));
    } finally {
      setImportingKey(null);
    }
  }

  const helpRequest = {
    module: 'coaches' as const,
    sectionIds: ['premium-plan-templates'],
    label: 'Plan templates',
    fullGuideHref: `/${orgSlug}/coaches/help#premium-plan-templates`,
  };

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  if (!assignment) {
    return <CoachNotOnTeam />;
  }

  const writeActions = canWrite && (
    <div className={styles.ppDrillRowActions}>
      <button type="button" className={styles.btnSecondary} onClick={() => setTagManagerOpen(true)}>
        <Tags size={14} aria-hidden /> Your tags
      </button>
      <button type="button" className={styles.btnSecondary} onClick={openImport}>
        <History size={14} aria-hidden /> Add from a past season
      </button>
      <button type="button" className={styles.btnPrimary} disabled={creating} onClick={newTemplate}>
        <Plus size={14} aria-hidden /> {creating ? 'Starting…' : 'New template'}
      </button>
    </div>
  );

  return (
    <div className={styles.page}>
      <CoachBackLink href={`${base}/development`}>Skills &amp; Goals</CoachBackLink>
      {/* Page-header ruling 2026-08-11: the blurb's promise ("next Tuesday starts from it") is
          already the empty state's description, where a coach with no templates reads it. */}
      <CoachPageHeader
        icon={BookMarked}
        title="Plan templates"
        helpLabel="Plan templates"
        help={helpRequest}
      />

      {loadError && <p className={styles.errorText} role="alert">{loadError}</p>}

      {loading ? (
        <div className={styles.loadingState}>Loading your templates…</div>
      ) : templates.length === 0 ? (
        /* ⚠ The empty state offers all THREE routes (owner ruling, frame 03): build one, pull one
           forward from a past season, or save one from a practice. Refusing to let a coach create
           one at zero while allowing it at one is an arbitrary rule rather than a principle. */
        <CoachEmptyState
          icon={<BookMarked size={22} />}
          headline="No templates yet"
          description="Build one here, or save a practice that went well as a template from the plan itself — then next Tuesday starts from it instead of an empty page."
          blocker={canWrite ? undefined : 'Your head coach manages the team’s templates.'}
          secondaryAction={canWrite ? { label: 'Add from a past season', onClick: openImport } : undefined}
        >
          {canWrite && (
            <button type="button" className={styles.btnPrimary} disabled={creating} onClick={newTemplate}>
              <Plus size={14} aria-hidden /> {creating ? 'Starting…' : 'New template'}
            </button>
          )}
        </CoachEmptyState>
      ) : (
        <>
          <div className={styles.ppDrillFilters}>
            <input className={styles.input} value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search templates…" aria-label="Search templates" />
            {writeActions}
          </div>

          {/* ⚠ ONE flat list narrowed by chips, never category headings — several tags per template
              would print the same template twice. */}
          <div className={styles.ppSuggestWrap}>
            <button type="button" className={styles.ppSuggestChip} data-on={tagFilter == null ? 'on' : undefined}
              onClick={() => setTagFilter(null)}>All <span>{active.length}</span></button>
            {chipTags.map(t => (
              <button key={t.id} type="button" className={styles.ppSuggestChip}
                data-on={tagFilter === t.id ? 'on' : undefined} onClick={() => setTagFilter(t.id)}>
                {t.name} <span>{active.filter(x => x.tags.some(tag => tag.id === t.id)).length}</span>
              </button>
            ))}
            {/* ⚠ Always offered when it applies — a template must never become unreachable simply
                by carrying no tags. */}
            {active.some(t => t.tags.length === 0) && (
              <button type="button" className={styles.ppSuggestChip}
                data-on={tagFilter === UNTAGGED_FILTER ? 'on' : undefined}
                onClick={() => setTagFilter(UNTAGGED_FILTER)}>
                No tags <span>{active.filter(t => t.tags.length === 0).length}</span>
              </button>
            )}
          </div>

          {shown.length === 0 ? (
            <p className={styles.formHint}>No templates match that.</p>
          ) : shown.map(template => (
            <TemplateRow key={template.id} template={template} canWrite={canWrite}
              busy={busyId === template.id}
              href={`${base}/development/templates/${template.id}`}
              onRename={() => { setFormError(''); setRenaming(template); }}
              onRetire={() => setActiveState(template.id, false)}
              onRestore={() => setActiveState(template.id, true)}
            />
          ))}

          {retired.length > 0 && (
            <div className={styles.ppRetiredWrap}>
              <button type="button" className={styles.ppAddInline} onClick={() => setShowRetired(s => !s)}>
                {showRetired ? 'Hide' : 'Show'} retired ({retired.length})
              </button>
              {showRetired && retired.map(template => (
                <TemplateRow key={template.id} template={template} canWrite={canWrite}
                  busy={busyId === template.id}
                  href={`${base}/development/templates/${template.id}`}
                  onRename={() => {}} onRetire={() => {}}
                  onRestore={() => setActiveState(template.id, true)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {renaming && (
        <RenameDialog template={renaming} tags={tags} onCreateTag={createTag}
          busy={formBusy} error={formError}
          onSave={saveRename} onClose={() => setRenaming(null)} />
      )}

      {/* ── "Add from a past season" — the archive ruling made concrete ── */}
      {importOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Add from a past season"
          onPointerDown={e => { if (e.target === e.currentTarget) setImportOpen(false); }}>
          <div className={`${styles.modal} ${styles.modalScrollBody}`}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Add from a past season</h3>
              <button type="button" className={styles.modalCloseBtn} aria-label="Close" onClick={() => setImportOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.ppDrillWrite}>
              <p className={styles.formHint}>
                Practices you ran before, ready to become templates. Adding one copies its shape into
                your library — nothing in the old practice changes, and no players come with it.
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
                    <span className={styles.ppDrillRowName}>{row.name}</span>
                    {/* ⚠ "planned", never "ran" — nothing records what actually happened. */}
                    <span className={styles.ppDrillRowMeta}>
                      {[
                        row.shapeLabel,
                        `In ${row.planCount} plan${row.planCount === 1 ? '' : 's'}`,
                        row.lastPlannedAt ? `last planned ${fmtDate(row.lastPlannedAt)}` : null,
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <div className={styles.ppDrillRowActions}>
                    {/* ⚠ Shown and greyed, never hidden — a coach scanning for a practice they
                        remember should find it and see WHY it isn't offered. */}
                    {row.alreadyInLibrary
                      ? <span className={styles.ppDrillRowMeta}>Already in your library</span>
                      : (
                        <button type="button" className={styles.btnSecondary} disabled={importingKey === row.key}
                          onClick={() => importTemplate(row)}>
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

      {/* ── The shared vocabulary: rename, and the merge that keeps history intact (frame 11) ──
          The SAME manager the schedule and the expenses screens already use, pointed at the focus
          routes. A merge here re-points every drill, template, tagged practice AND focus area at
          once, which is the whole reason this vocabulary became tags. */}
      {tagManagerOpen && (
        <TagManagerModal
          orgSlug={orgSlug}
          teamId={teamId}
          // ⚠ The team's OWN tags only. The club's shared words (teamId null) are an org admin's to
          // manage, and the team-scoped routes answer 404 on them — so listing them here would put
          // Rename and Merge buttons on screen that exist only to refuse.
          tags={(tags as RepTeamTag[]).filter(t => t.teamId === teamId)}
          basePath={`/api/coaches/${orgSlug}/teams/${teamId}/focus-tags`}
          title="Your tags"
          itemNoun="drill, template or focus area"
          onClose={() => setTagManagerOpen(false)}
          onChanged={() => { void loadTags(); void load(); }}
        />
      )}
    </div>
  );
}
