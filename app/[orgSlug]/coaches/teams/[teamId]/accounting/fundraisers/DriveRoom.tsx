'use client';
/**
 * THE DRIVE'S ROOM — what a fundraiser shows once its row opens (List · Room · Question Phase B,
 * 2026-09-02; the ruled mockup is artifact `11607f0a` §2, "The drive's room"). The shell is
 * `RoomShell`, owned by the panel; this module is the room's BODY (the entries table with its
 * Edit and Remove doors), the two Questions the room asks (the compact entry correction, and the
 * Edit-drive sheet), and the chip the row and the header share.
 *
 * ⚠⚠ ENTRIES-FIRST, carried from the band (2026-08-31): the table draws the ENTRIES — money that
 * exists, largest first — with an inactive player's entry visible and marked, never a
 * roster-projected board with dashes for the eleven who hadn't taken part. That projection once
 * hid an entry whose player left the roster while its dollars stayed on the books, which made a
 * drive undeletable with a refusal pointing at rows nobody could see. "Who hasn't yet" is the
 * facts line's fraction plus the Record window's own player list.
 *
 * ⚠ THE INLINE EDITOR AND ITS LOCKOUT ARE GONE. The band's `EntryEditor` lived inside a
 * dismissible fold and had to freeze every other door on the drive while it was open ("one act at
 * a time"). A correction is a QUESTION now — a small modal off the row, with its own discard
 * guard and busy gate — so nothing on the room has to step back while it is asked.
 *
 * ⚖ Remove stays live on a CLOSED drive; Edit does too, for corrections. Closing means "no more
 * money comes in" — a statement about recording, not correcting — so only the Record door dies
 * with the drive. Had Remove followed a closed gate, a closed drive's entries could never be
 * unwound and the whole-drive delete would refuse with directions nobody could follow.
 */
import { useEffect, useState, type ReactNode } from 'react';
import styles from '../../../../coaches.module.css';
import QuestionShell from '@/components/coaches/QuestionShell';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { useLatestRef } from '@/components/coaches/useLatestRef';
import TagSearchCombobox, { MONEY_TAG_MANAGE } from '@/components/coaches/TagSearchCombobox';
import { formatStoredDate } from '@/lib/timezone';
import { moneyMovedMaxDate } from '@/lib/money-date-guards';
import { writeFailure } from '@/lib/coach-sandbox-refusal';
import type { RepTeamTag } from '@/lib/types';
import { fmt } from '@/lib/coach-money-summary';
import { TagChips } from './TagChips';
import type { DriveEntryRow, Fundraiser, RoomRecord } from './types';

/** A drive's state chip — the same on its row and in its room's header, so the two never disagree. */
export function DriveStatusChip({ active }: { active: boolean }) {
  return (
    <span className={`${styles.badge} ${active ? styles.badgeActive : styles.badgeArchived}`}>
      {active ? 'Active' : 'Closed'}
    </span>
  );
}

/** The quiet facts line under the tiles — what the columns and tiles can't say: the participation
 *  fraction, the dates, the description, the tags. FACTS ONLY (the 2026-08-29 meta-line ruling),
 *  never a sentence restating a tile. */
function driveFacts(d: Fundraiser, record: RoomRecord, moneyTags: RepTeamTag[]): ReactNode {
  const loggedActive = record.entries.filter(en => en.playerActive).length;
  const dates = d.startDate && d.endDate
    ? `${formatStoredDate(d.startDate, { withYear: false })} → ${formatStoredDate(d.endDate, { withYear: false })}`
    : d.startDate ? `From ${formatStoredDate(d.startDate, { withYear: false })}`
    : d.endDate ? `Until ${formatStoredDate(d.endDate, { withYear: false })}`
    : null;
  return (
    <>
      <strong>{loggedActive} of {record.rosterCount}</strong> players logged
      {dates && <> · {dates}</>}
      {d.description && <> · {d.description}</>}
      <TagChips tagIds={d.tagIds} moneyTags={moneyTags} />
    </>
  );
}

/**
 * The room's body: the entries table. The panel owns the shell, the tiles, the doors and the
 * walk; this owns ONE write — Remove — and hands Edit up as a Question the panel opens.
 */
export function DriveRoomBody({
  orgSlug,
  teamId,
  drive,
  record,
  error,
  moneyTags,
  canWriteMoney,
  onChanged,
  onBusyChange,
  onFailure,
  onEditEntry,
}: {
  orgSlug: string;
  teamId: string;
  drive: Fundraiser;
  /** Null while the room's own read is in flight. */
  record: RoomRecord | null;
  error: string;
  moneyTags: RepTeamTag[];
  canWriteMoney: boolean;
  /** Money moved — re-read the room and bump the hub. */
  onChanged: () => void;
  /** A write is in flight — joins the room's busy gate. */
  onBusyChange: (busy: boolean) => void;
  /** A refused act (the payout floor's 409) — shown by the panel where it survives this body. */
  onFailure: (message: string) => void;
  onEditEntry: (entry: DriveEntryRow) => void;
}) {
  const confirmDialog = useConfirm();
  const [removingId, setRemovingId] = useState<string | null>(null);
  /* Busy is reported BY VALUE from the one write this body owns, so no hand-set true/false pair can
     clear a sibling's gate (`/review`, 2026-09-02); the cleanup releases it through the LATEST
     callback when the body unmounts. */
  const busyRef = useLatestRef(onBusyChange);
  const busy = removingId !== null;
  useEffect(() => { busyRef.current(busy); }, [busy, busyRef]);
  useEffect(() => () => busyRef.current(false), [busyRef]);

  /**
   * Remove one entry (R5-A, owner-ruled 2026-08-30). The drive's only unwind door — a drive credit
   * carries its provenance and the dues drawer refuses to touch it, pointing back here. The
   * confirm states BOTH figures (standing rule: a money dialog names dollars). ⚠ The refusal
   * (the payout floor's 409) is raised to the panel so it is read in the room, not lost with a
   * closed confirm — the §125 walk's "the modal goes away but the payment does not" finding.
   */
  async function removeEntry(entry: DriveEntryRow) {
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
    setRemovingId(entry.id);
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${drive.id}/entries/${entry.id}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        onFailure(writeFailure(res, await res.json().catch(() => ({})), 'That entry could not be removed.'));
        return;
      }
      onChanged();
    } finally {
      setRemovingId(null);
    }
  }

  if (error) return <p className={styles.errorText} role="alert">{error}</p>;
  if (!record) return <p className={styles.mutedInline}>Loading…</p>;

  return (
    <>
      <p className={styles.roomFacts}>{driveFacts(drive, record, moneyTags)}</p>
      {record.entries.length === 0 ? (
        <p className={styles.mutedInline} style={{ margin: 0 }}>
          Nothing logged yet.{canWriteMoney && drive.isActive && <> Press <strong>Record</strong> to log what a player raised.</>}
        </p>
      ) : (
        <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
          <table className={styles.table} aria-label="Entries">
            <thead>
              <tr>
                <th className={styles.th}>Player</th>
                <th className={styles.th}>Received</th>
                <th className={`${styles.th} ${styles.thNum}`}>Amount</th>
                <th className={`${styles.th} ${styles.thNum}`}>Credit</th>
                <th className={styles.th} aria-label="Row actions" />
              </tr>
            </thead>
            <tbody>
              {record.entries.map(en => (
                <tr key={en.id} className={styles.tr}>
                  {/* No `data-label` — the player's name is this card's title (§134 walk). */}
                  <td className={`${styles.td} ${styles.cardStackCell}`}>
                    <span className={styles.playerName}>{en.playerName}</span>
                    {!en.playerActive && <span className={styles.mutedInline}> · no longer on roster</span>}
                    {en.notes && <span className={styles.listRowSub}>{en.notes}</span>}
                  </td>
                  <td className={styles.td} data-label="Received">
                    {formatStoredDate(en.effectiveDate, { withYear: false })}
                  </td>
                  <td className={`${styles.td} ${styles.tdNum}`} data-label="Amount" style={{ color: 'var(--success-light)', fontWeight: 700 }}>
                    {fmt(en.amountRaised)}
                  </td>
                  <td className={`${styles.td} ${styles.tdNum}`} data-label="Credit">
                    {en.rebateAmount > 0.005
                      ? <span style={{ color: 'var(--home-plum)', fontWeight: 600 }}>{fmt(en.rebateAmount)}</span>
                      : <span className={styles.mutedInline}>—</span>}
                  </td>
                  <td className={`${styles.td} ${styles.cardActionCell}`}>
                    {canWriteMoney && (
                      <span className={styles.listRowActions}>
                        <button
                          type="button"
                          className={`${styles.btnGhost} ${styles.compactAction}`}
                          onClick={() => onEditEntry(en)}
                          aria-label={`Edit the ${fmt(en.amountRaised)} logged for ${en.playerName}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={`${styles.btnGhost} ${styles.compactAction}`}
                          style={{ color: 'var(--danger)' }}
                          disabled={removingId === en.id}
                          onClick={() => void removeEntry(en)}
                          aria-label={`Remove the ${fmt(en.amountRaised)} logged for ${en.playerName}`}
                        >
                          {removingId === en.id ? 'Removing…' : 'Remove'}
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/**
 * THE ENTRY CORRECTION — a compact Question: the amount, the day it arrived, a note. Corrections
 * only; new money goes through the recording conversation. Mounted keyed by the entry, so a
 * switch of record can never leak one entry's half-typed figure into another's.
 *
 * ⚠⚠ THE DATE THE COACH SEES, NEVER TODAY (/review, 2026-08-23 — Critical; carried from the band
 * verbatim). A pre-mig-261 row stores no date and the register dates it by its creation day;
 * pre-filling TODAY meant editing an old entry's AMOUNT silently moved its ledger row and the
 * family's credit into this month. What is shown is what is already true, and an untouched box
 * sends nothing — `entry.effectiveDate` is both the pre-fill and the baseline.
 */
export function DriveEntryQuestion({
  orgSlug,
  teamId,
  driveId,
  entry,
  onSaved,
  onClose,
  tabActive,
}: {
  orgSlug: string;
  teamId: string;
  driveId: string;
  entry: DriveEntryRow;
  onSaved: () => void;
  onClose: () => void;
  tabActive: boolean;
}) {
  const [amount, setAmount] = useState(String(entry.amountRaised));
  const [date, setDate] = useState(entry.effectiveDate);
  const [notes, setNotes] = useState(entry.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dirty = amount !== String(entry.amountRaised) || date !== entry.effectiveDate || notes !== (entry.notes ?? '');
  const close = useDiscardGuard({ dirty, close: onClose, noun: 'change to this entry' });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (isNaN(n) || n <= 0) { setError('Enter an amount greater than zero.'); return; }
    if (!date) { setError('Enter the date the money arrived.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${driveId}/entries/${entry.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          /* The date ONLY when the coach actually changed it — sending back the pre-filled value
             would ask the server to re-date the ledger row and the family credit on every save. */
          body: JSON.stringify({
            amountRaised: n,
            notes: notes.trim() || null,
            ...(date && date !== entry.effectiveDate ? { receivedDate: date } : {}),
          }),
        },
      );
      if (!res.ok) throw new Error(writeFailure(res, await res.json().catch(() => ({})), 'Save failed'));
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setSaving(false);
    }
  }

  return (
    <QuestionShell
      open={tabActive}
      onClose={() => { void close(); }}
      ariaLabel={`Edit what ${entry.playerName} raised`}
      title="Edit entry"
      subtitle={entry.playerName}
      busy={saving}
      leaveGuard={{ dirty, tabActive, message: "You haven't saved this correction. Leave without saving it?" }}
    >
      <form onSubmit={save}>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="drive-entry-amount">Amount raised *</label>
            <input
              id="drive-entry-amount"
              className={styles.input}
              type="number" min={0} step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="drive-entry-date">Date received *</label>
            <input
              id="drive-entry-date"
              className={styles.input}
              type="date" max={moneyMovedMaxDate()}
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
          <div className={`${styles.field} ${styles.formGridFull}`}>
            <label className={styles.label} htmlFor="drive-entry-notes">Notes</label>
            <input
              id="drive-entry-notes"
              className={styles.input}
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <p className={`${styles.formHint} ${styles.formHintConsequence} ${styles.formGridFull}`}>
            The books entry and the family&apos;s credit follow the new figure
            {date !== entry.effectiveDate ? ' and the new date' : ''}. Nothing else moves.
          </p>
          {error && <p className={`${styles.errorText} ${styles.formGridFull}`}>{error}</p>}
        </div>
        <div className={styles.modalFooter}>
          {/* Dead while a save is in flight: the PATCH cannot be recalled, and a Cancel that unmounted
              the form mid-save let the edit land anyway after the coach believed it was abandoned. */}
          <button type="button" className={styles.btnGhost} onClick={() => { void close(); }} disabled={saving}>Cancel</button>
          <button type="submit" className={styles.btnPrimary} disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </QuestionShell>
  );
}

/**
 * EDIT DRIVE — the setup sheet (the drill-in's Settings sheet, under the house verb since §121).
 * A Question: name, description, credit %, status, dates, tags. ⚠ NO DELETE HERE ANY MORE — the
 * guarded delete moved to the room's foot (a record has one delete door, not two).
 */
export function EditDriveSheet({
  orgSlug,
  teamId,
  drive,
  moneyTags,
  onCreateTag,
  onManageChanged,
  onSaved,
  onClose,
  tabActive,
}: {
  orgSlug: string;
  teamId: string;
  drive: Fundraiser;
  moneyTags: RepTeamTag[];
  onCreateTag: (name: string) => Promise<RepTeamTag | null>;
  onManageChanged: () => void;
  onSaved: () => void;
  onClose: () => void;
  tabActive: boolean;
}) {
  const [name, setName] = useState(drive.name);
  const [desc, setDesc] = useState(drive.description ?? '');
  const [rebate, setRebate] = useState(String(drive.playerRebatePercent));
  const [start, setStart] = useState(drive.startDate ?? '');
  const [end, setEnd] = useState(drive.endDate ?? '');
  const [active, setActive] = useState(drive.isActive);
  const [tags, setTags] = useState<string[]>(drive.tagIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dirty = name !== drive.name
    || desc !== (drive.description ?? '')
    || rebate !== String(drive.playerRebatePercent)
    || start !== (drive.startDate ?? '')
    || end !== (drive.endDate ?? '')
    || active !== drive.isActive
    // Compared as SETS — the picker appends and the server returns its own order.
    || tags.length !== drive.tagIds.length
    || tags.some(id => !drive.tagIds.includes(id));
  const close = useDiscardGuard({ dirty, close: onClose, noun: 'change to the fundraiser' });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    const pct = Number(rebate);
    if (isNaN(pct) || pct < 0 || pct > 100) { setError('Player credit % must be between 0 and 100.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${drive.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: desc.trim() || null,
          playerRebatePercent: pct,
          startDate: start || null,
          endDate: end || null,
          isActive: active,
          tagIds: tags,
        }),
      });
      if (!res.ok) throw new Error(writeFailure(res, await res.json().catch(() => ({})), 'Save failed'));
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setSaving(false);
    }
  }

  return (
    <QuestionShell
      open={tabActive}
      onClose={() => { void close(); }}
      ariaLabel={`Edit ${drive.name}`}
      title="Edit fundraiser"
      busy={saving}
      scroll
      leaveGuard={{ dirty, tabActive, message: "You haven't saved your changes to this fundraiser. Leave without saving them?" }}
    >
      <form onSubmit={save}>
        <div className={styles.formGrid}>
          <div className={`${styles.field} ${styles.formGridFull}`}>
            <label className={styles.label}>Name *</label>
            <input className={styles.input} type="text" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className={`${styles.field} ${styles.formGridFull}`}>
            <label className={styles.label}>Description</label>
            <textarea className={styles.textarea} value={desc} onChange={e => setDesc(e.target.value)} rows={2} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Player credit %</label>
            <input className={styles.input} type="number" min={0} max={100} step="0.01" value={rebate} onChange={e => setRebate(e.target.value)} />
            <p className={styles.formHint}>Only applies to new entries — existing entries keep their snapshotted rate</p>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Status</label>
            <select className={styles.select} value={active ? 'active' : 'closed'} onChange={e => setActive(e.target.value === 'active')}>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Start Date</label>
            <input className={styles.input} type="date" value={start} onChange={e => setStart(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>End Date</label>
            <input className={styles.input} type="date" value={end} onChange={e => setEnd(e.target.value)} />
          </div>
          <div className={`${styles.field} ${styles.formGridFull}`}>
            <label className={styles.label}>Tags</label>
            <TagSearchCombobox
              library={moneyTags}
              selectedIds={tags}
              onChange={setTags}
              onCreate={onCreateTag}
              placeholder="Type to find or create a money tag…"
              manage={{ ...MONEY_TAG_MANAGE, teamId, basePath: `/api/coaches/${orgSlug}/teams/${teamId}/expense-tags` }}
              onManageChanged={onManageChanged}
            />
          </div>
        </div>
        {error && <p className={styles.errorText} style={{ marginTop: '0.75rem' }}>{error}</p>}
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnGhost} onClick={() => { void close(); }} disabled={saving}>Cancel</button>
          <button type="submit" className={styles.btnPrimary} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </QuestionShell>
  );
}
