'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pencil, Trash2, GitMerge, RotateCcw } from 'lucide-react';
import type { ComboTag } from '@/components/coaches/TagSearchCombobox';
import AwardIconPicker from '@/components/coaches/AwardIconPicker';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * THE tag manager's list — rename / merge / delete with team-scoped usage counts, shared rows
 * read-only. One manager, two frames (One Tag Idiom Q9 + Q1): `TagManagerDrawer` wraps this in
 * the right-hand sheet a picker's door opens; the Team settings Tags shelf renders it inline as
 * a library row's expansion. The behaviour must never fork between the frames, which is why it
 * lives here and not in either of them.
 *
 * ⚠⚠ **Self-fetching — the `tags` prop is only the first paint.** The 2026-09-01 review's one
 * High: composite hosts feed libraries with NO usage counts, and the delete dialog then claimed
 * "isn't used on anything yet" about a tag on a dozen records. The list re-reads `basePath` on
 * mount and after every act, which no host can starve; when a count is genuinely unknown (the
 * read failed) the delete sentence makes no count claim at all rather than a false one.
 *
 * ⚠ **Delete states the count and offers the way out LIVE** (the §122 grammar): "It's on 12
 * records — they keep everything but the label", with **Merge instead** a button in the same
 * dialog. The delete/merge CONFIRMS stay dialogs — they are questions (2026-08-26); the list
 * around them is the working surface.
 *
 * **Escape peels ONE layer** (confirm → inline edit), here because the layers are this
 * component's own state. With nothing left to peel it calls `onFullyDismiss` when the host gave
 * one (the drawer closes); inline on a page, with no host dismissal, the key is left alone so
 * the page still hears it. `dismissOneLayer()` on the ref lets a host's scrim run the same
 * grammar — a stray click must never eat a half-typed rename in one step.
 *
 * ⚠⚠ **`policy` is how awards join this ONE list rather than fork a sibling** (Awards Join the
 * One Tag Idiom Part B). Awards differ from every other tag library in exactly three declarable
 * ways: an icon rides with the name, "given N times" reads as the count noun (via the existing
 * `countNoun` prop — no policy field needed for that), and removing a USED chip offers merge or
 * retire instead of a bare delete. `policy.icon` and `policy.inUseRemove` are the only two knobs;
 * everything else — rename, merge, the confirm grammar's shared bones — stays one code path for
 * every library. **The behaviour must never fork between the drawer and the shelf**, which is
 * exactly why the knobs live here and not in either frame.
 */
export interface TagManagerListHandle {
  /** Peel one layer (confirm → rename → merge). Returns false when there was nothing to peel. */
  dismissOneLayer: () => boolean;
}

export interface TagManagerPolicy {
  /** The row carries an emoji, and rename edits name + icon together (awards only). */
  icon?: boolean;
  /** 'orphan' (default): delete always removes the tag outright, used or not — the label falls
   *  off whatever it was on. 'merge-or-retire' (awards, R2): an UNUSED chip still deletes
   *  outright, but a USED one refuses a bare delete and offers Merge or Retire instead — an
   *  award is a record key (rep_player_awards.award_type_id is NOT NULL + RESTRICT), not a label,
   *  so cascading or orphaning it would erase recognition a player actually received. Retired
   *  rows group below the active ones with a Restore control. */
  inUseRemove?: 'orphan' | 'merge-or-retire';
}

const TagManagerList = forwardRef<TagManagerListHandle, {
  teamId: string;
  /** First-paint library — own and org-shared. The list re-fetches `basePath` itself for counts. */
  tags: readonly ComboTag[];
  /** Singular noun for the merge sentence — "expense", "game", "plan or drill". */
  itemNoun: string;
  basePath: string;
  /** Formats a nonzero usage count — defaults to "on N records". */
  countNoun?: (n: number) => string;
  /** "N yours · M shared by your club" line above the rows — the drawer wants it, the shelf's row header already says it. */
  showSummary?: boolean;
  /** Per-library behaviour knobs — omit for the 'orphan' tag default. */
  policy?: TagManagerPolicy;
  onChanged: () => void;
  /** Host dismissal for an Escape with nothing left to peel (the drawer closes; inline hosts omit). */
  onFullyDismiss?: () => void;
}>(function TagManagerList({
  teamId, tags, itemNoun, basePath, countNoun, showSummary = true, policy, onChanged, onFullyDismiss,
}, ref) {
  const hasIcon = !!policy?.icon;
  const inUseRemove = policy?.inUseRemove ?? 'orphan';
  const [fresh, setFresh] = useState<ComboTag[] | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameEmoji, setRenameEmoji] = useState<string | null>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [confirmState, setConfirmState] = useState<
    | { kind: 'delete'; tag: ComboTag }
    | {
        kind: 'merge'; loser: ComboTag; winner: ComboTag;
        /** R5 preview (awards only) — absent for every other policy, or when the read failed. */
        preview?: { moved: number; dropped: number; collisions: { playerName: string; occasionLabel: string }[] } | null;
      }
    | null
  >(null);
  // First call wins — the confirm buttons null the dialog and fire in the same handler, and a
  // same-frame double-activation would otherwise send the request twice before `busyId` re-renders.
  const inFlightRef = useRef(false);

  /** The list's own read of its library — counts included, un-starveable by any host. */
  async function reload() {
    try {
      const res = await fetch(basePath);
      if (!res.ok) return; // keep whatever we have; unknown counts stay unknown, never claimed
      const data = await res.json().catch(() => null);
      if (data && Array.isArray(data.tags)) setFresh(data.tags as ComboTag[]);
    } catch {
      /* offline etc. — the prop keeps the list usable; the delete sentence claims no count */
    }
  }
  useEffect(() => {
    queueMicrotask(() => { void reload(); }); // deferred: the sync-in-effect lint rule cannot see through fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const library = fresh ?? tags;
  // isActive is undefined for every non-award library (they carry no such field at all), so this
  // split is a no-op everywhere except awards — retired rows only ever appear there.
  const own = library.filter(t => t.teamId !== null && t.isActive !== false).sort((a, b) => a.name.localeCompare(b.name));
  const retired = library.filter(t => t.teamId !== null && t.isActive === false).sort((a, b) => a.name.localeCompare(b.name));
  const shared = library.filter(t => t.teamId === null).sort((a, b) => a.name.localeCompare(b.name));
  void teamId; // scoping is the caller's basePath; teamId documents intent and anchors future use

  const fmtCount = countNoun ?? ((n: number) => `on ${n} record${n === 1 ? '' : 's'}`);

  function dismissOneLayer(): boolean {
    if (confirmState) { setConfirmState(null); return true; }
    if (renamingId) { setRenamingId(null); return true; }
    if (mergingId) { setMergingId(null); return true; }
    return false;
  }
  useImperativeHandle(ref, () => ({ dismissOneLayer }));

  // ⚠ Capture-phase so a host form underneath never hears Escape while a layer is up; left alone
  // (no stopPropagation) when there is nothing to peel AND no host dismissal — an inline list on
  // a page must not eat the page's own Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (confirmState || renamingId || mergingId) {
        e.stopPropagation();
        e.preventDefault();
        dismissOneLayer();
      } else if (onFullyDismiss) {
        e.stopPropagation();
        e.preventDefault();
        onFullyDismiss();
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmState, renamingId, mergingId, onFullyDismiss]);

  function startRename(tag: ComboTag) {
    setError('');
    setMergingId(null);
    setRenamingId(tag.id);
    setRenameDraft(tag.name);
    setRenameEmoji(tag.emoji ?? null);
  }

  async function saveRename(tagId: string) {
    const name = renameDraft.trim();
    if (!name || inFlightRef.current) return;
    inFlightRef.current = true;
    setError('');
    setBusyId(tagId);
    try {
      const res = await fetch(`${basePath}/${tagId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ...(hasIcon ? { emoji: renameEmoji } : {}) }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Rename failed');
      }
      setRenamingId(null);
      void reload();
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Rename failed');
    } finally {
      inFlightRef.current = false;
      setBusyId(null);
    }
  }

  /** Retire (awards only, merge-or-retire policy) — the "leaves the picker, stays on the
   *  record" exit inside the R2 remove dialog; Restore is its own one-tap action on the
   *  retired-group row, no confirm needed either way (both are reversible, unlike delete). */
  async function doRetire(tag: ComboTag) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setError('');
    setBusyId(tag.id);
    try {
      const res = await fetch(`${basePath}/${tag.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Retire failed');
      }
      void reload();
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Retire failed');
    } finally {
      inFlightRef.current = false;
      setBusyId(null);
    }
  }

  async function doRestore(tag: ComboTag) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setError('');
    setBusyId(tag.id);
    try {
      const res = await fetch(`${basePath}/${tag.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Restore failed');
      }
      void reload();
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Restore failed');
    } finally {
      inFlightRef.current = false;
      setBusyId(null);
    }
  }

  function startMerge(tag: ComboTag) {
    setError('');
    setRenamingId(null);
    setMergingId(tag.id);
    setMergeTargetId('');
  }

  async function doMerge(loser: ComboTag, winner: ComboTag) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setError('');
    setBusyId(loser.id);
    try {
      const res = await fetch(`${basePath}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winnerTagId: winner.id, loserTagId: loser.id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Merge failed');
      }
      setMergingId(null);
      void reload();
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Merge failed');
    } finally {
      inFlightRef.current = false;
      setBusyId(null);
    }
  }

  /** Reads the merge preview (R5) before the confirm opens, awards only — the sentence has to
   *  state the collision BEFORE the tap, not after. Every other policy skips the fetch entirely
   *  and opens the confirm with the generic sentence, unchanged. A failed preview still opens
   *  the confirm (no claim beats a false one) — the generic sentence covers that case too. */
  async function startMergeConfirm(loser: ComboTag, winner: ComboTag) {
    if (inUseRemove !== 'merge-or-retire') {
      setConfirmState({ kind: 'merge', loser, winner });
      return;
    }
    setBusyId(loser.id);
    try {
      const res = await fetch(`${basePath}/merge?winner=${winner.id}&loser=${loser.id}`);
      const preview = res.ok ? await res.json().catch(() => null) : null;
      setConfirmState({ kind: 'merge', loser, winner, preview });
    } finally {
      setBusyId(null);
    }
  }

  async function doDelete(tag: ComboTag) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setError('');
    setBusyId(tag.id);
    try {
      const res = await fetch(`${basePath}/${tag.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Delete failed');
      }
      void reload();
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      inFlightRef.current = false;
      setBusyId(null);
    }
  }

  const confirmDialog = confirmState && (
    <div className={styles.tagDrawerConfirm} role="alertdialog" aria-modal="true">
      <div className={styles.tagDrawerDialog}>
        {confirmState.kind === 'delete' ? (
          inUseRemove === 'merge-or-retire' ? (
            <>
              <h4>Remove &ldquo;{confirmState.tag.name}&rdquo;?</h4>
              {confirmState.tag.count == null ? (
                <p>No claim can be made about how often it&rsquo;s been given right now. <strong>Merge it into another award</strong> or <strong>retire it</strong> instead.</p>
              ) : confirmState.tag.count > 0 ? (
                <>
                  <p>
                    It&rsquo;s {fmtCount(confirmState.tag.count)}, and an award can&rsquo;t be taken off a
                    player without a name.
                  </p>
                  <p><strong>Merge it into another award</strong> and that player keeps their award under the other name. Or <strong>retire it</strong> — it leaves the picker but stays on the record.</p>
                </>
              ) : (
                <p>It hasn&rsquo;t been given yet, so nothing else changes.</p>
              )}
              <div className={styles.tagDrawerDialogActions}>
                <button type="button" className={styles.btnGhost} onClick={() => setConfirmState(null)}>Cancel</button>
                {(confirmState.tag.count == null || confirmState.tag.count > 0) && (
                  <>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      disabled={busyId === confirmState.tag.id}
                      onClick={() => { const t = confirmState.tag; setConfirmState(null); void doRetire(t); }}
                    >
                      Retire
                    </button>
                    {own.length > 1 && (
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => { const t = confirmState.tag; setConfirmState(null); startMerge(t); }}
                      >
                        Merge instead
                      </button>
                    )}
                  </>
                )}
                {(confirmState.tag.count == null || confirmState.tag.count === 0) && (
                  <button
                    type="button"
                    className={styles.btnDanger}
                    disabled={busyId === confirmState.tag.id}
                    onClick={() => { const t = confirmState.tag; setConfirmState(null); void doDelete(t); }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <h4>Delete &ldquo;{confirmState.tag.name}&rdquo;?</h4>
              {confirmState.tag.count == null ? (
                /* Count unknown (the list's own read failed) — no claim beats a false one. */
                <p>Anything tagged with it keeps everything but the label. If you&rsquo;d rather keep things grouped, <strong>merge it into another tag</strong> instead.</p>
              ) : confirmState.tag.count > 0 ? (
                <>
                  {/* R4/§122 grammar: the consequence, then the softer tool — offered live below. */}
                  <p>It&rsquo;s {fmtCount(confirmState.tag.count)} — they keep everything but the label.</p>
                  <p>If you&rsquo;d rather keep them grouped, <strong>merge it into another tag</strong> instead — nothing is lost that way.</p>
                </>
              ) : (
                <p>It isn&rsquo;t used on anything yet.</p>
              )}
              <div className={styles.tagDrawerDialogActions}>
                <button type="button" className={styles.btnGhost} onClick={() => setConfirmState(null)}>Cancel</button>
                {(confirmState.tag.count == null || confirmState.tag.count > 0) && own.length > 1 && (
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => { const t = confirmState.tag; setConfirmState(null); startMerge(t); }}
                  >
                    Merge instead
                  </button>
                )}
                <button
                  type="button"
                  className={styles.btnDanger}
                  disabled={busyId === confirmState.tag.id}
                  onClick={() => { const t = confirmState.tag; setConfirmState(null); void doDelete(t); }}
                >
                  Delete
                </button>
              </div>
            </>
          )
        ) : (
          <>
            <h4>Merge {inUseRemove === 'merge-or-retire' ? 'awards' : 'tags'}?</h4>
            {confirmState.preview ? (
              <>
                <p>
                  {confirmState.preview.moved} {itemNoun}{confirmState.preview.moved === 1 ? '' : 's'} become
                  &ldquo;{confirmState.winner.name}&rdquo;.
                </p>
                {confirmState.preview.dropped > 0 && (
                  <p>
                    {confirmState.preview.dropped} {confirmState.preview.dropped === 1 ? 'is' : 'are'} dropped —{' '}
                    {confirmState.preview.collisions.slice(0, 3).map((c, i) => (
                      <span key={i}>
                        {i > 0 ? '; ' : ''}
                        {c.playerName} would hold &ldquo;{confirmState.winner.name}&rdquo; twice {c.occasionLabel}
                      </span>
                    ))}
                    {confirmState.preview.collisions.length > 3 && ` and ${confirmState.preview.collisions.length - 3} more`}
                  </p>
                )}
              </>
            ) : (
              <p>
                Every {itemNoun} tagged &ldquo;{confirmState.loser.name}&rdquo; will be tagged
                &ldquo;{confirmState.winner.name}&rdquo; instead, and &ldquo;{confirmState.loser.name}&rdquo; will
                be removed. This can&rsquo;t be undone.
              </p>
            )}
            <div className={styles.tagDrawerDialogActions}>
              <button type="button" className={styles.btnGhost} onClick={() => setConfirmState(null)}>Cancel</button>
              <button
                type="button"
                className={styles.btnSecondary}
                disabled={busyId === confirmState.loser.id}
                onClick={() => { const s = confirmState; setConfirmState(null); void doMerge(s.loser, s.winner); }}
              >
                Merge
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {showSummary && (
        <p className={styles.tagDrawerWho}>
          {own.length} yours{shared.length > 0 ? ` · ${shared.length} shared by your club` : ''}
        </p>
      )}

      <div className={styles.tagDrawerRows}>
        {own.length === 0 ? (
          <p className={styles.formHint}>
            No tags yet. Add one while adding a {itemNoun} — it&rsquo;ll show up here to rename, merge, or delete.
          </p>
        ) : (
          own.map(tag => (
            <div key={tag.id} className={styles.tagDrawerRow}>
              {renamingId === tag.id ? (
                <>
                  {hasIcon && (
                    <button type="button" className={styles.awardEmojiPickBtn} onClick={() => setIconPickerOpen(true)}>
                      {renameEmoji || '🏅'}
                    </button>
                  )}
                  <input
                    className={`${styles.input} ${styles.tagDrawerRename}`}
                    value={renameDraft}
                    maxLength={40}
                    autoFocus
                    onChange={e => setRenameDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void saveRename(tag.id); }}
                  />
                  <div className={styles.tagDrawerActions}>
                    <button type="button" className={styles.btnSecondary} disabled={busyId === tag.id || !renameDraft.trim()} onClick={() => void saveRename(tag.id)}>Save</button>
                    <button type="button" className={styles.btnGhost} disabled={busyId === tag.id} onClick={() => setRenamingId(null)}>Cancel</button>
                  </div>
                  {hasIcon && iconPickerOpen && (
                    <AwardIconPicker
                      value={renameEmoji}
                      onClose={() => setIconPickerOpen(false)}
                      onSelect={emoji => { setRenameEmoji(emoji); setIconPickerOpen(false); }}
                    />
                  )}
                </>
              ) : mergingId === tag.id ? (
                <>
                  <select
                    className={`${styles.select} ${styles.tagDrawerRename}`}
                    value={mergeTargetId}
                    onChange={e => setMergeTargetId(e.target.value)}
                    autoFocus
                  >
                    <option value="">Merge &ldquo;{tag.name}&rdquo; into…</option>
                    {own.filter(t => t.id !== tag.id).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <div className={styles.tagDrawerActions}>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      disabled={busyId === tag.id || !mergeTargetId}
                      onClick={() => {
                        const winner = own.find(t => t.id === mergeTargetId);
                        if (winner) void startMergeConfirm(tag, winner);
                      }}
                    >
                      Merge
                    </button>
                    <button type="button" className={styles.btnGhost} disabled={busyId === tag.id} onClick={() => setMergingId(null)}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <span className={styles.tagDrawerName}>
                    <span className={`${styles.tagComboDot} ${styles.tagComboDotOwn}`} aria-hidden />
                    <b>{hasIcon && tag.emoji ? `${tag.emoji} ` : ''}{tag.name}</b>
                  </span>
                  <span className={`${styles.tagDrawerUse} ${tag.count === 0 ? styles.tagDrawerUseZero : ''}`}>
                    {tag.count == null ? '' : tag.count === 0 ? 'not used yet' : fmtCount(tag.count)}
                  </span>
                  <span className={styles.tagDrawerActions}>
                    <button type="button" title="Rename" aria-label={`Rename ${tag.name}`} disabled={!!busyId} onClick={() => startRename(tag)}><Pencil size={15} aria-hidden /></button>
                    {own.length > 1 && (
                      <button type="button" title="Merge into another tag" aria-label={`Merge ${tag.name} into another tag`} disabled={!!busyId} onClick={() => startMerge(tag)}><GitMerge size={15} aria-hidden /></button>
                    )}
                    <button
                      type="button"
                      title={inUseRemove === 'merge-or-retire' ? 'Remove' : 'Delete'}
                      aria-label={`${inUseRemove === 'merge-or-retire' ? 'Remove' : 'Delete'} ${tag.name}`}
                      disabled={!!busyId}
                      onClick={() => { setError(''); setConfirmState({ kind: 'delete', tag }); }}
                    ><Trash2 size={15} aria-hidden /></button>
                  </span>
                </>
              )}
            </div>
          ))
        )}

        {inUseRemove === 'merge-or-retire' && retired.length > 0 && (
          <div className={styles.tagDrawerShared}>
            <div className={styles.tagDrawerSharedLabel}>Retired ({retired.length})</div>
            {retired.map(tag => (
              <div key={tag.id} className={styles.tagDrawerRow}>
                <span className={styles.tagDrawerName} style={{ color: 'var(--white-45)', textDecoration: 'line-through' }}>
                  {hasIcon && tag.emoji ? `${tag.emoji} ` : ''}{tag.name}
                </span>
                <span className={styles.tagDrawerActions}>
                  <button type="button" title="Restore" aria-label={`Restore ${tag.name}`} disabled={!!busyId} onClick={() => void doRestore(tag)}><RotateCcw size={15} aria-hidden /></button>
                </span>
              </div>
            ))}
          </div>
        )}

        {shared.length > 0 && (
          <div className={styles.tagDrawerShared}>
            <div className={styles.tagDrawerSharedLabel}>Shared by your club</div>
            {shared.map(tag => (
              <div key={tag.id} className={styles.tagDrawerRow}>
                <span className={styles.tagDrawerName}>
                  <span className={`${styles.tagComboDot} ${styles.tagComboDotOrg}`} aria-hidden />
                  <b>{tag.name}</b>
                </span>
                <span className={styles.tagDrawerUse}>
                  {tag.count == null ? '' : tag.count === 0 ? 'not used yet' : fmtCount(tag.count)}
                </span>
              </div>
            ))}
            <p className={styles.tagDrawerNote}>
              Shared tags belong to every team — ask your club admin to rename or retire one.
            </p>
          </div>
        )}

        {error && <p className={styles.errorText}>{error}</p>}
      </div>

      {confirmDialog}
    </>
  );
});

export default TagManagerList;
