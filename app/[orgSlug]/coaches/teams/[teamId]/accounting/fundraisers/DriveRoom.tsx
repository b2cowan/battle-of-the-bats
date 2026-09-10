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
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import styles from '../../../../coaches.module.css';
import QuestionShell from '@/components/coaches/QuestionShell';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { useLatestRef } from '@/components/coaches/useLatestRef';
import TagSearchCombobox, { MONEY_TAG_MANAGE } from '@/components/coaches/TagSearchCombobox';
import { formatStoredDate } from '@/lib/timezone';
import { moneyMovedMaxDate } from '@/lib/money-date-guards';
import { writeFailure } from '@/lib/coach-sandbox-refusal';
import type { BudgetCategoryWithItems, RepTeamTag } from '@/lib/types';
import { fmt } from '@/lib/coach-money-summary';
import { RAISING_FOR_NUDGE, driveParticipants, driveLoggedPlayerCount } from '@/lib/coach-fundraising';
import { toggleKey } from '@/lib/toggle-key';
import { ChevronDown, ChevronRight } from 'lucide-react';
import RaisingForField, { storedRaisingFor } from '@/components/coaches/RaisingForField';
import type { BudgetItemSelection } from '@/components/accounting/BudgetItemPicker';
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
/** ⚠ EXPORTED because the room's facts now sit on the ACTION ROW, which the shell draws above the
 *  body (§135 walk, 2026-09-03) — so the panel that mounts the shell composes them, while the
 *  composing stays here with the room that owns the words. */
export function driveFacts(d: Fundraiser, record: RoomRecord, moneyTags: RepTeamTag[]): ReactNode {
  /* ⚠⚠ A TEAM ENTRY IS NEVER A PLAYER (owner ruling 2026-09-08). The fraction answers "how many of
     the team have logged something", so hoodie-table money — raised by nobody in particular —
     counts beside it rather than in it, or "2 of 14 players" quietly becomes 3 and a coach reads a
     player who has not taken part. The two are told apart by `playerId`, never by the absence of a
     name: the entries GET gives a team row the label "The whole team", so a name is always there. */
  const teamEntries = record.entries.filter(en => !en.playerId).length;
  /* ⚠⚠ DISTINCT PLAYERS, VIA THE PARTICIPANTS (mig 287) — this counted ENTRY ROWS, which was the
     same number only because the database allowed a player exactly one. A player who hands in twice
     is one player, and "3 of 12 players logged" must not tick to 4 because Avery came back with
     another envelope. `plus N team entries` above keeps counting ENTRIES, because that is what the
     words say and two hoodie tables really are two events. */
  const loggedActive = driveLoggedPlayerCount(record.entries);
  const dates = d.startDate && d.endDate
    ? `${formatStoredDate(d.startDate, { withYear: false })} → ${formatStoredDate(d.endDate, { withYear: false })}`
    : d.startDate ? `From ${formatStoredDate(d.startDate, { withYear: false })}`
    : d.endDate ? `Until ${formatStoredDate(d.endDate, { withYear: false })}`
    : null;
  return (
    <>
      <strong>{loggedActive} of {record.rosterCount}</strong> players logged
      {teamEntries > 0 && <> · plus <strong>{teamEntries}</strong> {teamEntries === 1 ? 'team entry' : 'team entries'}</>}
      {/* ⚠ EVERY NAMED WORD SPEAKS, the standard one included — plan §"Room facts line". An earlier
          draft of this comment claimed the standard word stayed silent; it never did, and nothing
          downstream wants it to. This is where a coach goes looking for the drive's money, and a
          line that speaks only sometimes cannot be read as an answer to "where does this land?".
          A LEGACY record (no word at all) gets the one nudge instead: it is the only place in the
          product a coach meets that state, and without it there is nothing to act on.
          ⚠ THE WORD ALONE HERE, the shelf too on the stated Record door (`raisingForFiling`) — this
          line already carries the fraction, the dates and the note, and it sits inside the shelf's
          own screen; the sheet that covers it does not. */}
      {d.budgetItemName
        ? <> · Raising for <strong>{d.budgetItemName}</strong></>
        : <> · <span className={styles.mutedInline}>{RAISING_FOR_NUDGE.fundraiser}</span></>}
      {dates && <> · {dates}</>}
      {d.description && <> · {d.description}</>}
      <TagChips tagIds={d.tagIds} moneyTags={moneyTags} />
    </>
  );
}

/**
 * WHO A BOARD ROW IS — the lead cell's contents, in one place because the two branches that draw it
 * must not drift apart: a folding participant and a one-entry one differ ONLY in what leads the
 * name, and the moment that is written twice they start differing in other things too.
 *
 * ⚠⚠ THE WRAPPER IS NOT DECORATION — IT IS WHAT KEEPS THE CHEVRON BESIDE THE NAME ON A PHONE. The
 * cell is `.cardStackCell`, which below 640 becomes `flex-direction: column` so a cell too big for
 * one label/value line stacks. Left as two siblings, the chevron and the name would stack: a 44px
 * empty box with the name underneath it, on every folding row of every drive. One inline-flex child
 * holding both is what the column then stacks, and the pair stays on its line at every width.
 *
 * ⚠ `lead` IS THREE STATES, NOT A BOOLEAN. 'chevron' is a real control; 'spacer' is an invisible
 * box that lines a one-entry name up with its folding neighbours; 'none' draws nothing at all,
 * which is what a drive with no folds anywhere gets — see `anyFold`.
 */
/**
 * WHAT A FAMILY EARNED, or a dash when nothing did — the Credit column's one cell.
 *
 * ⚠ ONE COPY, THREE ROWS (`/simplify`, 2026-09-10). It was written out byte-for-byte on the
 * one-entry row, the fold's summary row and every hand-in under it, so the credit threshold, the
 * plum ink and the dash fallback each had three edit sites and two chances to be missed. The
 * byte-for-byte rule this board is held to is about the ROW matching what shipped before the fold
 * existed — it never asked for a cell to be hand-copied, and `ParticipantWho` had already set the
 * precedent for lifting one out.
 */
function CreditCell({ amount }: { amount: number }) {
  return (
    <td className={`${styles.td} ${styles.tdNum}`} data-label="Credit">
      {amount > 0.005
        ? <span style={{ color: 'var(--home-plum)', fontWeight: 600 }}>{fmt(amount)}</span>
        : <span className={styles.mutedInline}>—</span>}
    </td>
  );
}

/**
 * EDIT AND REMOVE, on the hand-in they act on — the trailing cell of every row that carries them.
 *
 * ⚠ THE ONLY DIFFERENCE BETWEEN THE TWO CALL SITES IS ONE STRING, which is why this is shared
 * (`/simplify`, 2026-09-10): ~25 lines of identical wiring — the same handlers, the same busy gate,
 * the same classes — sat twice for the sake of an accessible name.
 *
 * ⚠⚠ AND THAT NAME IS LOAD-BEARING, so it stays a parameter rather than being derived here. A row
 * with ONE hand-in keeps exactly the label that shipped before the fold existed ("…logged for Avery
 * Test"); a hand-in UNDER a fold must name its DATE, because two hand-ins by one player otherwise
 * produce two controls with identical names the moment their amounts match, and a screen-reader
 * user has no way to tell them apart.
 */
function EntryActions({
  entry, describe, removing, onEdit, onRemove,
}: {
  entry: DriveEntryRow;
  /** Everything after "Edit the $X " — the caller owns the wording. */
  describe: string;
  removing: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <span className={styles.listRowActions}>
      <button
        type="button"
        className={`${styles.btnGhost} ${styles.compactAction}`}
        onClick={onEdit}
        aria-label={`Edit the ${fmt(entry.amountRaised)} ${describe}`}
      >
        Edit
      </button>
      <button
        type="button"
        className={`${styles.btnGhost} ${styles.compactAction}`}
        style={{ color: 'var(--danger)' }}
        disabled={removing}
        onClick={onRemove}
        aria-label={`Remove the ${fmt(entry.amountRaised)} ${describe}`}
      >
        {removing ? 'Removing…' : 'Remove'}
      </button>
    </span>
  );
}

function ParticipantWho({
  participant, lead, open, onToggle,
}: {
  participant: { playerName: string; playerActive: boolean };
  lead: 'chevron' | 'spacer' | 'none';
  /** Required by `lead: 'chevron'`, meaningless otherwise. */
  open?: boolean;
  onToggle?: () => void;
}) {
  /* ⚠⚠ NO WRAPPER AT ALL WHEN NOTHING LEADS THE NAME — this early return is the byte-for-byte
     promise, and leaving it out was a real regression (`/review`, regression lens, 2026-09-10).
     The wrapper below is `inline-flex`, and the cell it sits in (`.cardStackCell`) becomes a
     COLUMN flex below 640px — which blockifies its DIRECT children. Before this change the name
     and the "· no longer on roster" mark were two direct children, so on a phone the mark sat on
     its own line under the name. Routed through the wrapper they became one nested child and
     rendered inline instead: a visible difference, on a board with no fold anywhere, which is
     exactly the case the ruling says must be untouched.
     ⚠ The rendered gate could not catch it — the UAT fixture has no inactive player with an entry,
     so that state is never drawn. It was found by reading the two markups side by side. */
  if (lead === 'none') {
    return (
      <>
        <span className={styles.playerName}>{participant.playerName}</span>
        {!participant.playerActive && <span className={styles.mutedInline}> · no longer on roster</span>}
      </>
    );
  }
  return (
    <span className={styles.driveWho}>
      {lead === 'chevron' && (
        <button
          type="button"
          className={styles.moneyGridExpand}
          aria-expanded={!!open}
          aria-label={open
            ? `Hide ${participant.playerName}'s entries`
            : `Show ${participant.playerName}'s entries`}
          // Or the click runs both handlers and the row toggles twice — which reads as a row that
          // ignores you (the lesson the report's own fold rows record).
          onClick={e => { e.stopPropagation(); onToggle?.(); }}
        >
          {open ? <ChevronDown size={13} aria-hidden /> : <ChevronRight size={13} aria-hidden />}
        </button>
      )}
      {lead === 'spacer' && <span className={styles.moneyGridExpandSpacer} />}
      <span>
        <span className={styles.playerName}>{participant.playerName}</span>
        {!participant.playerActive && <span className={styles.mutedInline}> · no longer on roster</span>}
      </span>
    </span>
  );
}

/**
 * The room's body: the entries table. The panel owns the shell, the tiles, the doors and the
 * walk; this owns ONE write — Remove — and hands Edit up as a Question the panel opens.
 *
 * ⚠⚠ A ROW IS A PARTICIPANT, NOT AN ENTRY (mig 287, owner ruling 2026-09-10 on mockup `94c27428`).
 * A player — or the whole team — carrying their TOTAL, folding open onto each dated hand-in. The
 * grouping itself is `driveParticipants` in `lib/coach-fundraising.ts`; what lives here is the
 * drawing of it, and the one rule that governs the drawing: **a participant with one entry renders
 * exactly as it did before any of this existed.**
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
  /* WHICH PARTICIPANTS ARE OPEN. Collapsed by default: the row already carries the answer to "who
     raised what", and the hand-ins are the detail behind it. ⚠ A key left here after its
     participant drops back to one entry (its last-but-one hand-in removed) is harmless — the
     one-entry branch never asks. */
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());
  /* ⚠ `toggleKey`, not a hand-rolled Set copy (`/simplify`, 2026-09-10). That helper exists because
     six places in this hub had already grown byte-identical copies and drifted into two spellings;
     this was becoming a third. OPEN-set rather than closed-set, like the grids: a board opens
     compact and the coach asks for the detail. */
  const toggleParticipant = (key: string) => setOpenKeys(prev => toggleKey(prev, key));
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
      /* ⚠ THE DATE NAMES WHICH ENTRY (mig 287). Amount alone identified one uniquely while a player
         could have only one; after it, two $60 hand-ins by Avery produce two identical dialogs and
         the coach cannot tell which one they are about to unwind. Costs a single-entry drive
         nothing and makes every dialog say exactly what leaves the books. */
      message: `Takes the ${fmt(entry.amountRaised)} logged for ${entry.playerName} on ${formatStoredDate(entry.effectiveDate, { withYear: false })} off the team’s books`
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

  const participants = driveParticipants(record.entries);
  /* ⚠⚠ THE SPACER IS BOARD-WIDE, NOT ROW-WIDE, and that is the whole reason this boolean exists.
     A single-entry row gets an invisible 20px lead so its name lines up under the names of rows
     that DO carry a chevron (mockup §1: Casey and Devon are indented to match Avery). But a drive
     where nobody handed in twice has no chevron anywhere, so indenting every name would move the
     entire board sideways for no reason — and "visually identical to the drive that exists now" is
     the binding constraint on this design, not a preference. No fold on the board, no spacers. */
  const anyFold = participants.some(p => p.entries.length > 1);

  return (
    <>
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
              {participants.map(p => {
                /* ⚠⚠ ONE ENTRY = THE ROW THAT SHIPPED BEFORE ANY OF THIS EXISTED, and this branch
                   is the load-bearing constraint on the whole design (owner ruling 2026-09-10,
                   mockup `94c27428`). Date inline, Edit and Remove on the row, no chevron, no fold.
                   A drive where nobody handed in twice draws no spacers either (`anyFold` is false),
                   so it is byte-for-byte the board a coach already knows. **The fold is the
                   EXCEPTION speaking; it must cost the common case nothing.** If you find yourself
                   editing this branch, go back to the mockup — the change almost certainly belongs
                   in the branch below. */
                if (p.entries.length === 1) {
                  const en = p.entries[0]!;
                  return (
                    <tr key={p.key} className={styles.tr}>
                      {/* No `data-label` — the player's name is this card's title (§134 walk). */}
                      <td className={`${styles.td} ${styles.cardStackCell}`}>
                        <ParticipantWho participant={p} lead={anyFold ? 'spacer' : 'none'} />
                        {en.notes && <span className={styles.listRowSub}>{en.notes}</span>}
                      </td>
                      <td className={styles.td} data-label="Received">
                        {formatStoredDate(en.effectiveDate, { withYear: false })}
                      </td>
                      <td className={`${styles.td} ${styles.tdNum}`} data-label="Amount" style={{ color: 'var(--success-light)', fontWeight: 700 }}>
                        {fmt(en.amountRaised)}
                      </td>
                      <CreditCell amount={en.rebateAmount} />
                      <td className={`${styles.td} ${styles.cardActionCell}`}>
                        {canWriteMoney && (
                          /* ⚠ The label that shipped before the fold existed, unchanged — a
                             one-hand-in row has no ambiguity about which entry it means. */
                          <EntryActions
                            entry={en}
                            describe={`logged for ${en.playerName}`}
                            removing={removingId === en.id}
                            onEdit={() => onEditEntry(en)}
                            onRemove={() => void removeEntry(en)}
                          />
                        )}
                      </td>
                    </tr>
                  );
                }

                /* TWO OR MORE: the summary row carries the TOTAL and opens onto the hand-ins.
                   ⚠ NOTHING TO EDIT ON THIS ROW — the action cell is deliberately empty. A total is
                   not a thing a coach can correct; the entries under it are, and each carries its
                   own pair of doors. An empty `.td` draws no blank line on a phone (`td:empty`). */
                const open = openKeys.has(p.key);
                return (
                  <Fragment key={p.key}>
                    <tr
                      className={`${styles.tr} ${styles.rowTappable}`}
                      /* The row is the pointer/touch shortcut, the chevron is the SEMANTIC control
                         a keyboard and a screen reader reach the fold through — the split every
                         other folding money row in the portal uses. ⚠ Selecting text to copy a
                         figure must not fold the row: a click that ends a selection is a copy
                         gesture, not a tap (the same guard the reports carry). */
                      onClick={() => { if (window.getSelection()?.toString()) return; toggleParticipant(p.key); }}
                    >
                      <td className={`${styles.td} ${styles.cardStackCell}`}>
                        <ParticipantWho
                          participant={p}
                          lead="chevron"
                          open={open}
                          onToggle={() => toggleParticipant(p.key)}
                        />
                      </td>
                      {/* ⚠ THE MOST RECENT HAND-IN, not the first and not a range. The column
                          answers "when did money last come in from them", which is the question a
                          coach chasing a running drive is asking. */}
                      <td className={styles.td} data-label="Received">
                        {formatStoredDate(p.latestDate, { withYear: false })}
                      </td>
                      <td className={`${styles.td} ${styles.tdNum}`} data-label="Amount" style={{ color: 'var(--success-light)', fontWeight: 700 }}>
                        {fmt(p.total)}
                      </td>
                      {/* ⚠⚠ SUMMED FROM THE HAND-INS, NEVER RE-MULTIPLIED from the drive's current
                          rate. Each row carries the share stamped on it, so a share changed
                          mid-drive leaves two hand-ins legitimately on different rates — and the
                          whole team's rows are stamped 0% on purpose. See `driveParticipants`. */}
                      <CreditCell amount={p.credit} />
                      <td className={styles.td} />
                    </tr>
                    {open && p.entries.map(en => (
                      <tr key={en.id} className={`${styles.tr} ${styles.driveHandIn}`}>
                        {/* THE HAND-IN'S OWN IDENTITY IS ITS DATE, so it leads the row where the
                            participant's name leads theirs, indented under it — and the Received
                            column beside it stays empty rather than repeating it (mockup §1).
                            ⚠ A `<td>`, not the `<th scope="row">` the mockup's own HTML used: a
                            `th` inside `<tbody>` is untouched by the `.tableAsCards` card recipe
                            (which reflows `td` only), so it would keep `display: table-cell` and
                            break the card on a phone. What the `th` was really buying — telling two
                            hand-ins of one player apart — is bought properly by the buttons' own
                            labels below, which name the date. */}
                        <td className={`${styles.td} ${styles.driveHandInLead} ${styles.cardStackCell}`}>
                          <span>{formatStoredDate(en.effectiveDate, { withYear: false })}</span>
                          {en.notes && <span className={styles.listRowSub}>{en.notes}</span>}
                        </td>
                        <td className={styles.td} />
                        {/* Quiet ink, not the money green — the participant's TOTAL above is the
                            figure that reads at a glance, and its parts should not compete with it
                            (mockup §1: the sub-rows drop the money colour). */}
                        <td className={`${styles.td} ${styles.tdNum}`} data-label="Amount">
                          {fmt(en.amountRaised)}
                        </td>
                        <CreditCell amount={en.rebateAmount} />
                        <td className={`${styles.td} ${styles.cardActionCell}`}>
                          {canWriteMoney && (
                            /* ⚠⚠ THE DATE IS IN THE NAME, and that is not decoration. Two hand-ins
                               by one player produce two "Edit" buttons whose labels would otherwise
                               be identical the moment the amounts match — a screen-reader user
                               would meet two controls both called "Edit the $60.00 logged for Avery
                               Test" with no way to tell them apart. */
                            <EntryActions
                              entry={en}
                              describe={`${en.playerName} logged on ${formatStoredDate(en.effectiveDate, { withYear: false })}`}
                              removing={removingId === en.id}
                              onEdit={() => onEditEntry(en)}
                              onRemove={() => void removeEntry(en)}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
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
  categories,
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
  /** The team's budget taxonomy, for the "Raising for" picker (mig 285). */
  categories: BudgetCategoryWithItems[];
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
  /* ⚠ THE RECORD'S OWN WORD, NOT THE SHELF'S DEFAULT. An edit sheet pre-fills what is TRUE, so a
     legacy record opens with the field empty and its nudge still showing — the create form is where
     the standard word is suggested. Pre-filling a default here would turn "you never answered this"
     into "you answered it with our guess" on a save the coach made for another reason. */
  const [raisingFor, setRaisingFor] = useState<BudgetItemSelection | null>(storedRaisingFor(drive));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dirty = name !== drive.name
    || desc !== (drive.description ?? '')
    || rebate !== String(drive.playerRebatePercent)
    || start !== (drive.startDate ?? '')
    || end !== (drive.endDate ?? '')
    || active !== drive.isActive
    || (raisingFor?.itemId ?? null) !== drive.budgetItemId
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
          budgetItemId: raisingFor?.itemId ?? null,
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
          {/* Second field, under the name — the same position the create form puts it in, so the
              two forms read as one form (mockup 8aa1e633 screen D). */}
          <RaisingForField
            kind="fundraiser"
            categories={categories}
            value={raisingFor}
            onChange={setRaisingFor}
            orgSlug={orgSlug}
            teamId={teamId}
          />
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
