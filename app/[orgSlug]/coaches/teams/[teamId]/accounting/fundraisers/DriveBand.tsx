'use client';
/**
 * THE DRIVE BAND — a fundraiser opens IN PLACE (owner-ruled 2026-08-31, binding mockup: Artifact
 * "Fundraiser Drill-In Redesign" round 3; design-log entry the same day). Drives take the sponsor
 * band's construction: the list row, and — when open — a facts-only meta line, one SIBLING ROW per
 * logged entry sharing the parent table's columns, and the two doors (Record primary, Edit
 * secondary). The `?fundraiser=` drill-in state retired for drives with this file, as it already
 * had for sponsors (Direction A); `detail.tsx` was deleted the same day.
 *
 * ⚠⚠ ENTRIES-FIRST IS THE LOAD-BEARING CHANGE. The old board was roster-projected — one row per
 * ACTIVE player, dashes for the eleven who hadn't taken part — which is the entire reason a drive
 * needed a screen of its own, and it silently dropped an entry whose player later left the active
 * roster while its dollars stayed on the books (that once made a drive undeletable, with a refusal
 * pointing at rows the board could not show). The band draws the ENTRIES: money that exists,
 * largest first — which IS the leaderboard, wordlessly — with an inactive player's entry visible
 * and marked. "Who hasn't yet" is the meta line's fraction plus the Record window's own player
 * list (it only ever offers players with nothing logged; that is its rule, not an accident).
 *
 * ⚠ A MODAL WAS ASKED FOR AND REFUSED by the owner's own 2026-08-26 ruling (a modal is for a
 * QUESTION, not a working surface) — and Record opens the recording conversation, which would have
 * stacked a window on a window. The Edit sheet below IS a question-shaped form, so it stays modal.
 *
 * ⚠ THE EXPANSION IS SIBLING ROWS OF THIS TABLE, NOT A TABLE INSIDE IT (the §122 alignment
 * lesson, inherited from SponsorBand): an entry's amount is under **Amount** and its credit under
 * **Credits** because it is literally in those columns. The spanning rows come from BandRows.tsx,
 * which owns the column count.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Plus, Check, X, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import styles from '../../../../coaches.module.css';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import TagSearchCombobox, { MONEY_TAG_MANAGE } from '@/components/coaches/TagSearchCombobox';
import RecordEditorFooter from '@/components/coaches/RecordEditorFooter';
import { useRecordMoneySignal } from '@/lib/coach-record-money';
import { formatStoredDate } from '@/lib/timezone';
import { moneyMovedMaxDate } from '@/lib/money-date-guards';
import type { RepTeamTag } from '@/lib/types';
import { fmt } from '@/lib/coach-money-summary';
import { pluralize } from '@/lib/utils';
import { BandMessageRow, BandDoorsRow, BAND_COL_COUNT } from './BandRows';

export interface DriveRowData {
  id: string;
  name: string;
  description: string | null;
  playerRebatePercent: number;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  totalRaised: number;
  teamNet: number;
  totalCredits: number;
  tagIds: string[];
}

/** One logged entry, as the entries route's flat `entries` array serves it (2026-08-31). */
interface DriveEntryRow {
  id: string;
  playerId: string;
  playerName: string;
  /** False = the player has left the active roster; the entry stays on the board, marked. */
  playerActive: boolean;
  amountRaised: number;
  rebateAmount: number;
  notes: string | null;
  receivedDate: string | null;
  /** What the coach SEES this row dated — the stored date or the org-clock creation day. The
   *  ONLY value the inline editor may pre-fill (see `EntryEditor`). */
  effectiveDate: string;
}

interface DriveExpansion {
  entries: DriveEntryRow[];
  rosterCount: number;
}

export default function DriveBand({
  orgSlug,
  teamId,
  drives,
  moneyTags,
  canWriteMoney,
  onCreate,
  openId,
  onOpenChange,
  onChanged,
  onCreateTag,
  tabActive,
}: {
  orgSlug: string;
  teamId: string;
  /** ⚠ Memoised by the panel — this array is an effect dependency below, so a fresh reference on
   *  every parent render would re-fetch the open expansion on every keystroke in the create form. */
  drives: DriveRowData[];
  /** The team's money-tag vocabulary, for the Edit sheet's picker (mig 239). */
  moneyTags: RepTeamTag[];
  canWriteMoney: boolean;
  /** Opens the panel's New-fundraiser modal — the create door stays the panel's own form. */
  onCreate: () => void;
  /** The expanded drive — the tab's `?fundraiser=` key, shared with the sponsor band, so deep
   *  links (budget month doors, a family's dues drawer) land open. */
  openId: string | null;
  onOpenChange: (id: string | null) => void;
  /** Money moved — bump the hub. The panel's own bump listener re-reads the list, and the list
   *  reload re-reads this expansion; a second direct reload here would fetch everything twice. */
  onChanged: () => void;
  onCreateTag: (name: string) => Promise<RepTeamTag | null>;
  /** Is the Fundraisers tab on screen? See UnsavedChangesGuard's `interceptClicks`. */
  tabActive: boolean;
}) {
  const recordSignal = useRecordMoneySignal();
  const confirmDialog = useConfirm();

  // ── The expansion's own data: the entries + the roster count, fetched when a row opens.
  // Deps include `drives` (mirroring SponsorBand): when the list behind reloads on a money bump —
  // an amount recorded through the conversation, an import — the open expansion re-reads too.
  const [expanded, setExpanded] = useState<DriveExpansion | null>(null);
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const [expandError, setExpandError] = useState('');

  /* Stamp-and-drop — the Money-panel loading convention (lib/coach-money-refresh.tsx). Two
     expansion reads are routinely in flight together (a bump's re-read racing a toggle to another
     drive); without the stamp a slow OLD answer landed last, painted drive A's entries under drive
     B's row and left B on "Loading…" for good, since nothing would ever re-fire for it
     (/review, 2026-09-01, High). */
  const expansionSeq = useRef(0);
  const loadExpansion = useCallback(async (driveId: string) => {
    const seq = ++expansionSeq.current;
    setExpandError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${driveId}/entries`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const data = await res.json();
      if (seq !== expansionSeq.current) return; // an older answer loses
      setExpanded({
        entries: Array.isArray(data.entries) ? data.entries : [],
        rosterCount: Number(data.rosterCount ?? 0),
      });
      setExpandedFor(driveId);
    } catch (e) {
      if (seq !== expansionSeq.current) return;
      setExpandError(e instanceof Error ? e.message : 'This fundraiser could not be loaded.');
      setExpandedFor(driveId);
      setExpanded(null);
    }
  }, [orgSlug, teamId]);

  /* ⚠ THE JUST-DELETED ID MUST NOT BE RE-READ. `deleteDrive` clears the open id through a
     router.replace — an ASYNC URL change — while the bump it also sends lands in the same render
     pass, so for one pass `openId` can still name the deleted drive as the list reloads beneath
     it. The old drill-in guarded this with a ref for the same reason; the ordering alone is a
     coincidence of two async processes, not a guarantee (/review, 2026-09-01). */
  const deletedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (openId && openId !== deletedIdRef.current) void loadExpansion(openId);
    else { setExpanded(null); setExpandedFor(null); }
  }, [openId, loadExpansion, drives]);

  // ── Inline "Edit amount" (corrections only — recording goes through the conversation). The
  // editor owns its own fields (see `EntryEditor`); the band only remembers WHICH entry is open.
  const [editEntryId, setEditEntryId] = useState<string | null>(null);
  const [removingEntryId, setRemovingEntryId] = useState<string | null>(null);
  /**
   * ⚠⚠ A REFUSAL THE COACH CAN READ (owner, §125 walk 2026-09-01: "the modal goes away but the
   * payment does not, so it just seems like a bug"). Remove's failure path once wrote into the
   * inline EDITOR's error slot — which only renders while the editor is open, so the payout
   * floor's 409 (dollars + directions, the exact sentence §122 part E walks) vanished into state
   * nothing drew: the confirm closed, the row stayed, and the guard read as a defect. Its own row
   * in the expansion carries it now, and it stays on screen until the coach's next act.
   */
  const [actionError, setActionError] = useState('');

  /* The drill-in keyed its whole component on the drive id so one record could never inherit
   * another's half-typed form; here the editor unmounts with its row when the open drive changes,
   * so only the two flags need resetting by hand. */
  useEffect(() => {
    setEditEntryId(null);
    setActionError('');
  }, [openId]);

  /**
   * Remove one entry (R5-A, owner-ruled 2026-08-30, relocated from the drill-in). The drive's
   * only unwind door — a drive credit carries its provenance and the dues drawer refuses to touch
   * it, pointing back here. ⚠ LIVE EVEN ON A CLOSED DRIVE, unlike Edit amount beside it: closing
   * means "no more money comes in", a statement about recording, not correcting. The confirm
   * states BOTH figures (standing rule: a money dialog names dollars).
   */
  async function removeEntry(driveId: string, entry: DriveEntryRow) {
    setActionError('');
    const ok = await confirmDialog({
      title: 'Remove this entry?',
      message: `Takes the ${fmt(entry.amountRaised)} logged for ${entry.playerName} off the team’s books`
        + (entry.rebateAmount > 0.005
          ? `, and takes back the ${fmt(entry.rebateAmount)} it credited to their family.`
          : '. No family credit was earned on it.'),
      confirmText: `Remove ${fmt(entry.amountRaised)}`,
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    setRemovingEntryId(entry.id);
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${driveId}/entries/${entry.id}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        setActionError((await res.json().catch(() => ({}))).error ?? 'That entry could not be removed.');
        return;
      }
      /* The expansion re-reads NOW, not after the bump's list reload lands and re-triggers it —
         that path is two round trips, during which the row still showed the entry the coach had
         just removed (/review, 2026-09-01). The list reload will fetch it once more; with the
         stamp above, whichever answer is newer wins. One small GET is the price of no stale flash. */
      void loadExpansion(driveId);
      onChanged();
    } finally {
      setRemovingEntryId(null);
    }
  }

  // ── The Edit sheet (the drill-in's Settings sheet, renamed to the house verb — §121).
  const [editFor, setEditFor] = useState<DriveRowData | null>(null);
  const [edName, setEdName] = useState('');
  const [edDesc, setEdDesc] = useState('');
  const [edRebate, setEdRebate] = useState('');
  const [edStart, setEdStart] = useState('');
  const [edEnd, setEdEnd] = useState('');
  const [edActive, setEdActive] = useState(true);
  const [edTags, setEdTags] = useState<string[]>([]);
  const [edSaving, setEdSaving] = useState(false);
  const [edError, setEdError] = useState('');
  const [edDeleting, setEdDeleting] = useState(false);

  function openEdit(d: DriveRowData) {
    setEdName(d.name);
    setEdDesc(d.description ?? '');
    setEdRebate(String(d.playerRebatePercent));
    setEdStart(d.startDate ?? '');
    setEdEnd(d.endDate ?? '');
    setEdActive(d.isActive);
    setEdTags(d.tagIds);
    setEdError('');
    setEditFor(d);
  }

  const edDirty = Boolean(editFor && (
    edName !== editFor.name
    || edDesc !== (editFor.description ?? '')
    || edRebate !== String(editFor.playerRebatePercent)
    || edStart !== (editFor.startDate ?? '')
    || edEnd !== (editFor.endDate ?? '')
    || edActive !== editFor.isActive
    // Compared as SETS — the picker appends and the server returns its own order.
    || edTags.length !== editFor.tagIds.length
    || edTags.some(id => !editFor.tagIds.includes(id))
  ));
  const closeEdit = useDiscardGuard({
    dirty: edDirty,
    close: () => setEditFor(null),
    noun: 'change to the fundraiser',
  });

  useOverlayOpen(!!editFor);

  /**
   * What the delete has to answer for. ⚠ Counted from the EXPANSION, which Edit is only reachable
   * through (the door lives on an open row) — and the expansion now counts every entry regardless
   * of roster status, which is exactly what the server counts. The old board's hidden-entries
   * apology is gone because entries-first has no hidden entries.
   */
  const edEntryCount = editFor && expandedFor === editFor.id && expanded
    ? expanded.entries.length
    : (editFor && editFor.totalRaised > 0.005 ? 1 : 0);

  async function saveEditSheet(e: React.FormEvent) {
    e.preventDefault();
    if (!editFor) return;
    if (!edName.trim()) { setEdError('Name is required.'); return; }
    const rebate = Number(edRebate);
    if (isNaN(rebate) || rebate < 0 || rebate > 100) {
      setEdError('Player credit % must be between 0 and 100.');
      return;
    }
    setEdSaving(true);
    setEdError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${editFor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:                edName.trim(),
          description:         edDesc.trim() || null,
          playerRebatePercent: rebate,
          startDate:           edStart || null,
          endDate:             edEnd || null,
          isActive:            edActive,
          tagIds:              edTags,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      setEditFor(null);
      onChanged();
    } catch (err: any) {
      setEdError(err.message);
    } finally {
      setEdSaving(false);
    }
  }

  async function deleteDrive() {
    if (!editFor) return;
    setEdDeleting(true);
    setEdError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${editFor.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setEdError((await res.json().catch(() => ({}))).error ?? 'That fundraiser could not be deleted.');
        return;
      }
      /* Mark it dead FIRST (see `deletedIdRef` at the expansion effect), then collapse, then bump.
         The URL change behind `onOpenChange` is asynchronous, so the guard is what actually stops
         a refetch of the record just deleted; the ordering is tidiness on top. */
      deletedIdRef.current = editFor.id;
      setEditFor(null);
      onOpenChange(null);
      onChanged();
    } finally {
      setEdDeleting(false);
    }
  }

  /* Deep links land OPEN and IN VIEW: a budget month door or a dues drawer's "unwind it where it
     came from" arrives with `?fundraiser=` already set, possibly far down the page. `nearest`
     makes an ordinary click a no-op (the row is already on screen), so only real arrivals move.
     ⚠ On EVERY change of the open id, not once per mount: the hub keeps this tab mounted for the
     whole visit, so a once-flag scrolled the first arrival and silently skipped every later one
     (/review, 2026-09-01). `nearest` is what makes "every time" free. */
  const openRowRef = useRef<HTMLTableRowElement | null>(null);
  useEffect(() => {
    if (openId) openRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [openId]);

  /** The meta line — FACTS ONLY, never restating the columns above (ruling 2026-08-29): the
   *  credit rule, the participation fraction, the dates, the tags. */
  function metaLine(d: DriveRowData, x: DriveExpansion) {
    const loggedActive = x.entries.filter(en => en.playerActive).length;
    const dates = d.startDate && d.endDate
      ? `${formatStoredDate(d.startDate, { withYear: false })} → ${formatStoredDate(d.endDate, { withYear: false })}`
      : d.startDate ? `From ${formatStoredDate(d.startDate, { withYear: false })}`
      : d.endDate ? `Until ${formatStoredDate(d.endDate, { withYear: false })}`
      : null;
    const tags = d.tagIds
      .map(id => moneyTags.find(t => t.id === id))
      .filter((t): t is RepTeamTag => !!t);
    return (
      <>
        {d.playerRebatePercent > 0 && <>Credits families <strong>{d.playerRebatePercent}%</strong> · </>}
        <strong>{loggedActive} of {x.rosterCount}</strong> players logged
        {dates && <> · {dates}</>}
        {tags.map(t => (
          <span key={t.id} className={`${styles.tagComboChip} ${t.teamId === null ? styles.tagComboChipOrg : ''}`} style={{ marginLeft: '0.5rem' }}>
            {t.name}
          </span>
        ))}
      </>
    );
  }

  return (
    <section aria-label="Fundraisers">
      <div className={styles.panelToolbar} style={{ marginBottom: '0.5rem' }}>
        <h3 className={styles.panelSubhead}>Fundraisers</h3>
        {canWriteMoney && (
          <div className={styles.panelToolbarActions}>
            <button className={styles.btnSecondary} onClick={onCreate}>
              <Plus size={15} aria-hidden /> Fundraiser
            </button>
          </div>
        )}
      </div>

      {drives.length === 0 ? (
        <p className={styles.muted} style={{ margin: '0 0 0.5rem' }}>
          No drives yet.{canWriteMoney && <> Press <strong>+ Fundraiser</strong> to run one — the whole team takes part, and each player&rsquo;s share comes off their dues.</>}
        </p>
      ) : (
        <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
          <table className={styles.table}>
            <thead>
              {/* Six columns — BAND_COL_COUNT's other half. */}
              <tr>
                <th className={styles.th}>Name</th>
                <th className={`${styles.th} ${styles.thNum}`}>Amount</th>
                <th className={`${styles.th} ${styles.thNum}`}>Team keeps</th>
                <th className={`${styles.th} ${styles.thNum}`}>Credits</th>
                <th className={`${styles.th} ${styles.tdShrink}`}>Status</th>
                <th className={styles.th} aria-label="Row actions" />
              </tr>
            </thead>
            <tbody>
              {drives.map(d => {
                const open = openId === d.id;
                const x = open && expandedFor === d.id ? expanded : null;
                return (
                  <DriveRows
                    key={d.id}
                    d={d}
                    orgSlug={orgSlug}
                    teamId={teamId}
                    open={open}
                    openRowRef={open ? openRowRef : null}
                    expanded={x}
                    expandError={open ? expandError : ''}
                    actionError={open ? actionError : ''}
                    meta={x ? metaLine(d, x) : null}
                    canWriteMoney={canWriteMoney}
                    editEntryId={editEntryId}
                    removingEntryId={removingEntryId}
                    onToggle={() => onOpenChange(open ? null : d.id)}
                    onRecord={recordSignal ? () => recordSignal.request({ branch: 'drive', ids: { driveId: d.id } }) : null}
                    onEdit={() => openEdit(d)}
                    onStartEdit={en => { setActionError(''); setEditEntryId(en.id); }}
                    // Re-read now AND bump — see `removeEntry` for why the immediate read exists.
                    onEditSaved={() => { setEditEntryId(null); void loadExpansion(d.id); onChanged(); }}
                    onCancelEdit={() => setEditEntryId(null)}
                    onRemove={en => void removeEntry(d.id, en)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Edit fundraiser (the drill-in's Settings sheet, under the house verb) ── */}
      {editFor && (
        <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) closeEdit(); }}>
          <div className={`${styles.modal} ${styles.modalScrollBody}`}>
            <CoachModalHeader title="Edit fundraiser" onClose={closeEdit} titleTag="h2" closeIconSize={18} />
            <form onSubmit={saveEditSheet}>
              <div className={styles.formGrid}>
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>Name *</label>
                  <input className={styles.input} type="text" value={edName} onChange={e => setEdName(e.target.value)} required />
                </div>
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>Description</label>
                  <textarea className={styles.textarea} value={edDesc} onChange={e => setEdDesc(e.target.value)} rows={2} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Player credit %</label>
                  <input className={styles.input} type="number" min={0} max={100} step="0.01" value={edRebate} onChange={e => setEdRebate(e.target.value)} />
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--home-dim, rgba(255,255,255,0.3))' }}>
                    Only applies to new entries — existing entries keep their snapshotted rate
                  </p>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Status</label>
                  <select className={styles.select} value={edActive ? 'active' : 'closed'} onChange={e => setEdActive(e.target.value === 'active')}>
                    <option value="active">Active</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Start Date</label>
                  <input className={styles.input} type="date" value={edStart} onChange={e => setEdStart(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>End Date</label>
                  <input className={styles.input} type="date" value={edEnd} onChange={e => setEdEnd(e.target.value)} />
                </div>
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>Tags</label>
                  <TagSearchCombobox
                    library={moneyTags}
                    selectedIds={edTags}
                    onChange={setEdTags}
                    onCreate={onCreateTag}
                    placeholder="Type to find or create a money tag…"
                    manage={{ ...MONEY_TAG_MANAGE, teamId, basePath: `/api/coaches/${orgSlug}/teams/${teamId}/expense-tags` }}
                    onManageChanged={onChanged}
                  />
                </div>
              </div>
              {edError && <p className={styles.errorText} style={{ marginTop: '0.75rem' }}>{edError}</p>}

              {/* Delete (R5-A) — ON the closing row (owner 2026-08-30). Refuses while entries
                  exist; the softer tool is named in the same breath. Entries-first means the
                  refusal's directions are always followable — every entry is on the board. */}
              <RecordEditorFooter
                refusal={edEntryCount > 0
                  ? <>This fundraiser has <strong>{fmt(editFor.totalRaised)}</strong> logged across{' '}
                      {pluralize(edEntryCount, 'entry', 'entries')} — remove {edEntryCount === 1 ? 'it' : 'them'}{' '}
                      from its list first to delete it.
                      {edActive && <> If it&rsquo;s simply finished, set it to{' '}
                      <strong>Closed</strong> instead: closing keeps every credit.</>}</>
                  : null}
                confirmTitle={`Delete “${editFor.name}”?`}
                confirmBody={<>
                  Nothing has been logged against it, so <strong>no money moves</strong> and no family
                  credit changes. The fundraiser and its tags go.
                </>}
                deleting={edDeleting}
                onDelete={() => void deleteDrive()}
              >
                <button type="button" className={styles.btnGhost} onClick={closeEdit}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} disabled={edSaving || edDeleting}>
                  {edSaving ? 'Saving…' : 'Save changes'}
                </button>
              </RecordEditorFooter>
            </form>
          </div>
        </div>
      )}

      <UnsavedChangesGuard
        active={!!editFor && edDirty}
        interceptClicks={!!editFor && edDirty && tabActive}
        message="You haven't saved your changes to this fundraiser. Leave without saving them?"
      />
    </section>
  );
}

/** One drive: its list row, and — when open — the expansion rows beneath it. */
function DriveRows({
  d, orgSlug, teamId, open, openRowRef, expanded, expandError, actionError, meta, canWriteMoney,
  editEntryId, removingEntryId,
  onToggle, onRecord, onEdit, onStartEdit, onEditSaved, onCancelEdit, onRemove,
}: {
  d: DriveRowData;
  orgSlug: string;
  teamId: string;
  open: boolean;
  openRowRef: React.Ref<HTMLTableRowElement> | null;
  expanded: DriveExpansion | null;
  expandError: string;
  /** A refused act on this drive (the payout floor's 409) — drawn as its own row, never silent. */
  actionError: string;
  meta: React.ReactNode;
  canWriteMoney: boolean;
  editEntryId: string | null;
  removingEntryId: string | null;
  onToggle: () => void;
  /** Null = no recording conversation to open (no hub around this band). */
  onRecord: (() => void) | null;
  onEdit: () => void;
  onStartEdit: (entry: DriveEntryRow) => void;
  onEditSaved: () => void;
  onCancelEdit: () => void;
  onRemove: (entry: DriveEntryRow) => void;
}) {
  /* ⚖ ONE ACT AT A TIME (owner, 2026-09-01): while any entry's inline editor is open, every other
     door on the drive steps back — the sibling rows' Edit/Remove and the Record/Edit doors below.
     Pressing another Edit amount mid-type silently discarded the typing (one editor at a time),
     and Record/Edit would stack a window over a half-finished correction. Save or Cancel brings
     the doors back. Named once, used at every site. */
  const doorsLive = editEntryId === null;

  return (
    <>
      <tr
        ref={openRowRef ?? undefined}
        className={styles.tr}
        onClick={onToggle}
        style={{ cursor: 'pointer' }}
        aria-expanded={open}
      >
        <td className={`${styles.td} ${styles.cardStackCell}`} data-label="Name">
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flexWrap: 'wrap' }}>
            <TrendingUp size={15} aria-hidden style={{ color: 'var(--success-light)', flexShrink: 0 }} />
            {/* A real BUTTON, not the drill-in's Link: there is no page behind the name any more,
                and a row-level onClick alone is unreachable by keyboard and invisible to a screen
                reader (the old comment's own warning, now honoured by the toggle itself). */}
            <button
              type="button"
              className={`${styles.linkBtn} ${styles.playerNameLink}`}
              style={{ fontSize: 'var(--type-body)', textAlign: 'left' }}
              onClick={e => { e.stopPropagation(); onToggle(); }}
              aria-expanded={open}
            >
              {d.name}
            </button>
          </span>
        </td>
        <td className={`${styles.td} ${styles.tdNum}`} data-label="Amount" style={{ color: 'var(--success-light)', fontWeight: 700 }}>
          {fmt(d.totalRaised)}
        </td>
        <td className={`${styles.td} ${styles.tdNum}`} data-label="Team keeps" style={{ fontWeight: 700 }}>
          {fmt(d.teamNet)}
        </td>
        <td className={`${styles.td} ${styles.tdNum}`} data-label="Credits" style={{ color: d.totalCredits > 0.005 ? 'var(--home-plum)' : 'var(--home-dim, rgba(255,255,255,0.35))', fontWeight: 700 }}>
          {d.totalCredits > 0.005 ? fmt(d.totalCredits) : '—'}
        </td>
        <td className={`${styles.td} ${styles.tdShrink}`} data-label="Status">
          <span className={`${styles.badge} ${d.isActive ? styles.badgeActive : styles.badgeArchived}`}>
            {d.isActive ? 'Active' : 'Closed'}
          </span>
        </td>
        <td className={`${styles.td} ${styles.cardActionCell} ${styles.tdNum}`}>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={e => { e.stopPropagation(); onToggle(); }}
            aria-label={`${open ? 'Close' : 'Open'} ${d.name}`}
          >
            <span className={styles.cardActionLabel}>{open ? 'Close' : 'Open'}</span>
            {open ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
          </button>
        </td>
      </tr>

      {open && expandError && <BandMessageRow tone="error">{expandError}</BandMessageRow>}
      {open && actionError && <BandMessageRow tone="error">{actionError}</BandMessageRow>}
      {open && !expanded && !expandError && <BandMessageRow tone="muted">Loading…</BandMessageRow>}

      {open && expanded && (
        <tr className={styles.tr}>
          {/* Semantic meta ink, never the alpha/presentational ladder (08-18 ruling). */}
          <td className={`${styles.td} ${styles.bandSubCell}`} colSpan={BAND_COL_COUNT} style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
            {meta}
          </td>
        </tr>
      )}

      {/* The state sentence survives ONLY where dropping it leaves an expansion that reads as
          broken (the 08-29 ruling's guard) — a fresh drive with no rows and two buttons. */}
      {open && expanded && expanded.entries.length === 0 && (
        <BandMessageRow tone="muted">Nothing logged yet.</BandMessageRow>
      )}

      {open && expanded && expanded.entries.map(en => (
        editEntryId === en.id ? (
          <tr key={en.id} className={styles.tr}>
            <td className={`${styles.td} ${styles.bandSubCell}`} colSpan={BAND_COL_COUNT}>
              <EntryEditor
                orgSlug={orgSlug}
                teamId={teamId}
                driveId={d.id}
                entry={en}
                onSaved={onEditSaved}
                onCancel={onCancelEdit}
              />
            </td>
          </tr>
        ) : (
          <tr key={en.id} className={styles.tr}>
            <td className={`${styles.td} ${styles.bandSubCell}`} data-label="Player">
              <span className={styles.playerName}>{en.playerName}</span>
              <span className={styles.mutedInline}> · {formatStoredDate(en.effectiveDate, { withYear: false })}</span>
              {!en.playerActive && <span className={styles.mutedInline}> · no longer on roster</span>}
            </td>
            <td className={`${styles.td} ${styles.tdNum} ${styles.bandSubCell}`} data-label="Amount" style={{ color: 'var(--success-light)', fontWeight: 700 }}>
              {fmt(en.amountRaised)}
            </td>
            {/* Team keeps and Status are the DRIVE's facts, not the entry's — empty cells hold
                the columns open on a desktop and stand down in card mode (the sponsor rule). */}
            <td className={`${styles.td} ${styles.tdNum} ${styles.bandSubCell}`} data-label="Team keeps" />
            <td className={`${styles.td} ${styles.tdNum} ${styles.bandSubCell}`} data-label="Credits">
              {en.rebateAmount > 0.005
                ? <span style={{ color: 'var(--home-plum)', fontWeight: 600 }}>{fmt(en.rebateAmount)}</span>
                : <span className={styles.mutedInline}>—</span>}
            </td>
            <td className={`${styles.td} ${styles.tdShrink} ${styles.bandSubCell}`} data-label="Status" />
            <td className={`${styles.td} ${styles.cardActionCell} ${styles.bandSubCell}`}>
              {canWriteMoney && doorsLive && (
                <>
                  <button
                    className={styles.btnGhost}
                    onClick={e => { e.stopPropagation(); onStartEdit(en); }}
                    style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                    disabled={!d.isActive}
                    title={!d.isActive ? 'Fundraiser is closed' : undefined}
                  >
                    Edit amount
                  </button>
                  <button
                    className={styles.btnGhost}
                    onClick={e => { e.stopPropagation(); onRemove(en); }}
                    style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', color: 'var(--danger)' }}
                    disabled={removingEntryId === en.id}
                    aria-label={`Remove the ${fmt(en.amountRaised)} logged for ${en.playerName}`}
                  >
                    {removingEntryId === en.id ? 'Removing…' : 'Remove'}
                  </button>
                </>
              )}
            </td>
          </tr>
        )
      ))}

      {/* No Record door on a closed drive — closing means no new money; corrections (Edit amount
          is dead too, but Remove stays) still have their doors above. */}
      {open && expanded && canWriteMoney && doorsLive && (
        <BandDoorsRow onRecord={d.isActive ? onRecord : null} onEdit={onEdit} />
      )}
    </>
  );
}

/**
 * The inline "Edit amount" editor for ONE entry — amount, the day it arrived, a note. It owns its
 * own fields: mounting it is opening it, so a switch of the open drive (which unmounts the row)
 * can never leak one entry's half-typed figure into another's, the guarantee the drill-in used
 * to buy with a `key` on the whole component. Corrections only — new money goes through the
 * recording conversation.
 */
function EntryEditor({
  orgSlug,
  teamId,
  driveId,
  entry,
  onSaved,
  onCancel,
}: {
  orgSlug: string;
  teamId: string;
  driveId: string;
  entry: DriveEntryRow;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(String(entry.amountRaised));
  const [notes, setNotes] = useState(entry.notes ?? '');
  /* ⚠⚠ THE DATE THE COACH SEES, NEVER TODAY (/review, 2026-08-23 — Critical; carried from the
     drill-in verbatim). A pre-mig-261 row stores no date and the register dates it by its
     creation day; pre-filling TODAY meant editing an old entry's AMOUNT silently moved its ledger
     row and the family's credit into this month. What is shown is what is already true, and an
     untouched box sends nothing — `entry.effectiveDate` is both the pre-fill and the baseline. */
  const [date, setDate] = useState(entry.effectiveDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    const n = Number(amount);
    if (isNaN(n) || n < 0) { setError('Enter a valid amount (0 or more).'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${driveId}/entries/${entry.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          /* ⚠ THE DATE ONLY WHEN THE COACH ACTUALLY CHANGED IT — sending back the pre-filled
             value would ask the server to re-date the ledger row and the family credit on every
             save. Unchanged = omitted = nothing re-dated. */
          body: JSON.stringify({
            amountRaised: n,
            notes: notes || null,
            ...(date && date !== entry.effectiveDate ? { receivedDate: date } : {}),
          }),
        },
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      onSaved();
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div className={styles.stack640} style={{ alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
      <span className={styles.playerName} style={{ marginRight: '0.25rem' }}>{entry.playerName}</span>
      <input
        className={`${styles.input} ${styles.inlineField}`}
        style={{ '--inline-field-w': '90px' } as React.CSSProperties}
        type="number" min={0} step="0.01"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        placeholder="0.00"
        aria-label="Amount raised"
        autoFocus
      />
      <input
        className={`${styles.input} ${styles.inlineField}`}
        style={{ '--inline-field-w': '150px' } as React.CSSProperties}
        type="date" max={moneyMovedMaxDate()}
        value={date}
        onChange={e => setDate(e.target.value)}
        aria-label="Date received"
      />
      {/* Notes is the row's elastic field (owner, 2026-08-31): it takes whatever width the amount
          and date leave, which is also what pushes Save/Cancel to the row's right edge. The fixed
          --inline-field-w stays as the flex BASIS and as the phone width via .inlineField's own
          @640 rule. */}
      <input
        className={`${styles.input} ${styles.inlineField}`}
        style={{ '--inline-field-w': '150px', flex: '1 1 150px', minWidth: 0 } as React.CSSProperties}
        type="text"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        aria-label="Notes"
      />
      {error && <p className={styles.errorText} style={{ margin: 0, fontSize: '0.78rem' }}>{error}</p>}
      <button
        className={`${styles.btnPrimary} ${styles.block640} ${styles.compactAction}`}
        // marginLeft auto: when a narrow desktop wraps the buttons to their own line, they keep
        // the right edge; on the filled line notes' grow already puts them there, and the @640
        // full-width stack makes it a no-op.
        style={{ marginLeft: 'auto' }}
        disabled={saving}
        onClick={() => void save()}
      >
        <Check size={14} aria-hidden /> {saving ? 'Saving…' : 'Save'}
      </button>
      {/* Dead while a save is in flight: the PATCH cannot be recalled, and a Cancel that unmounted
          the editor mid-save let the edit land anyway after the coach believed it was abandoned
          (/review, 2026-09-01). */}
      <button className={`${styles.btnGhost} ${styles.block640} ${styles.compactAction}`} onClick={onCancel} disabled={saving}>
        <X size={14} aria-hidden /> Cancel
      </button>
    </div>
  );
}
