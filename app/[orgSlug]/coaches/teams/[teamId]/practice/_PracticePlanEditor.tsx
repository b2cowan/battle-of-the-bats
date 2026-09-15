'use client';
import { useMemo, useRef, useState } from 'react';
import {
  ChevronDown, ChevronRight, ChevronUp, Library, Pencil, Plus, Repeat, Shuffle, Trash2, Users, X,
} from 'lucide-react';
import {
  MAX_BLOCKS, MAX_COACHING_POINTS, MAX_DESCRIPTION_LEN, MAX_GROUPS, MAX_MINUTES, MAX_SHORT_TEXT_LEN,
  MAX_STATIONS_PER_BLOCK, MAX_TEXT_LEN, MAX_TITLE_LEN,
  blockAsksForTeaching, blockRotates, computeRotation, defaultIntervalMinutes, describeSplit, drawGroups,
  formatDuration, groupLabel, newPracticePlanId, practiceKitBag, resolveStationTeaching,
  settleBlockKit, startingGroupsForStation, tagNamesById, walkBlockClocks,
  type BlockClock, type DrawMode, type PracticeGroup, type PracticePlan, type PracticePlanBlock,
  type PracticeRotation, type PracticeStation,
} from '@/lib/rep-practice-plan';
import {
  UNTAGGED_FILTER, collectTags, detachStationFromDrill,
  drillToStation, filterTagged, sortDrillsForPicker, stationToDrillInput,
  type DrillInput, type RepTeamDrill,
} from '@/lib/rep-drills';
import TagPicker, { type PickableTag } from '@/components/coaches/TagPicker';
import PracticeTagPicker from '@/components/coaches/PracticeTagPicker';
import type { TagManageConfig } from '@/components/coaches/TagSearchCombobox';
import { playerDisplayName } from '@/lib/coach-roster-name';
import { useDialogFloor } from '@/components/coaches/useDialogFloor';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import type { RepAttendanceStatus, RepDevelopmentGoalStatus } from '@/lib/types';
import styles from '../../../coaches.module.css';

/**
 * The practice-plan builder (slice 1a).
 *
 * ⚠ EVERY sub-component here is declared at MODULE level, never inside the parent. A component
 * defined in a render body is a NEW component type on every render, so React unmounts and
 * remounts its whole subtree — which on a screen made of text inputs means losing focus on every
 * single keystroke. (The Development hub paid for the same lesson through positional
 * reconciliation.) Prop threading is the price of a form that can actually be typed into.
 *
 * Two rules from the plan doc show up as UI constraints rather than data ones:
 *  • Roster ORDER, everywhere, with no sort control offered anywhere, ever (§4).
 *  • Reorder with buttons, never drag — gloves and phones defeat drag (the Roster lesson).
 *
 * ⚠ **ONE editor, two callers** (Phase 3). The practice page passes a roster; the plan-template
 * room passes `withoutPeople`, because a template carries the shape and the teaching and the
 * practice supplies the people. Building a second editor for the template room would have split
 * the behaviour of every block, station, rotation and drill-picker control in two — which is why
 * frame 03's "New template at zero" ruling was the biggest reuse decision in this phase.
 *
 * ⚠ `withoutPeople` REMOVES the people controls; it never disables them. A control that exists
 * only to refuse should not exist.
 */

export type PracticeRosterPlayer = {
  id: string;
  playerFirstName: string;
  playerLastName: string;
  playerNumber: string | null;
};

export type PracticeFocusGoal = {
  id: string;
  playerId: string;
  focusArea: string;
  status: RepDevelopmentGoalStatus;
  /**
   * ONE optional grouping tag (D16, mig 221). ⚠ Used ONLY to soften an area that doesn't match
   * tonight — never to hide a row, never to reorder one, and an UNTAGGED area always reads as
   * relevant. The focus text itself stays the coach's own specific words and is never replaced.
   */
  tagId: string | null;
  tagName: string | null;
};

type AttachTarget =
  | { kind: 'block'; blockId: string }
  | { kind: 'station'; blockId: string; stationId: string }
  | { kind: 'group'; blockId: string; groupId: string };


/** Replied yes = attending or arriving late. Only these enter a random draw (D21); everyone
 *  else is NAMED rather than silently dropped. */
const REPLIED_YES: RepAttendanceStatus[] = ['attending', 'late'];

/** A new block's length until the coach types one — the ghost row promises it ("15 min"), and
 *  un-pressing "Rest of practice" returns to it (stage 2, D5): never to "no length". */
const DEFAULT_BLOCK_MINUTES = 15;
/** The clock row's quick lengths (stage 2, D5) — fifteen is what nearly every block starts as,
 *  and these are most of the rest; anything else is typed. */
const QUICK_MINUTES = [5, 10, 15, 20, 30] as const;

/**
 * What waits behind a door on an open block (practices re-evaluation stage 2, owner ruling D1,
 * 2026-09-15). A block opens to its title, the clock row, What you're doing, What you're watching
 * for and its Players line; everything else is a quiet door at the foot that becomes the field
 * when pressed. Shown = holds content ∨ opened this time. `teaching` is not a door the line offers
 * — it is the latch that keeps the two teaching fields on screen while a coach clears them on a
 * one-station block (D7 would otherwise pull the fields out from under the last keystroke).
 */
type BlockDoor = 'teaching' | 'points' | 'staff' | 'equipment' | 'stations';
const NO_DOORS: ReadonlySet<BlockDoor> = new Set();

/**
 * What a block HOLDS behind each door — the one answer both readers share: the editor seeds the
 * open set from it when a block opens (so removing the last chip or the last line never makes
 * the field vanish under the coach's hands), and the open body reads it to decide what shows.
 */
function blockHolds(block: PracticePlanBlock): Record<BlockDoor, boolean> {
  return {
    teaching: blockAsksForTeaching(block),
    // By CONTENT, as the teaching predicate reads it — a stray space is not a point (/review, 2026-09-15).
    points: !!block.coachingPoints?.some(p => p.trim()),
    staff: !!(block.staffTagIds?.length || block.staff?.length),
    equipment: !!block.equipmentTagIds?.length,
    stations: !!block.stations?.length,
  };
}
const doorsHolding = (block: PracticePlanBlock): BlockDoor[] =>
  (Object.entries(blockHolds(block)) as [BlockDoor, boolean][]).filter(([, held]) => held).map(([door]) => door);

// ── Small shared controls (module level — see the header note) ────────────────

function FieldLabel({ children, onRemove, removeLabel }: {
  children: React.ReactNode;
  /** A quiet "×" beside the label, in the row instead of a line of its own (owner ask,
   *  2026-09-15) — only for a field that is itself an addition the coach opened; it closes the
   *  door, it never deletes data, so it is only ever passed while the field holds nothing. */
  onRemove?: () => void;
  removeLabel?: string;
}) {
  if (!onRemove) return <span className={styles.ppFieldLabel}>{children}</span>;
  return (
    <span className={styles.ppFieldLabelRow}>
      <span className={styles.ppFieldLabel}>{children}</span>
      <button type="button" className={styles.ppIconBtn} aria-label={removeLabel ?? 'Remove'} onClick={onRemove}>
        <X size={13} />
      </button>
    </span>
  );
}

/**
 * A fold's head on the sheet — "About this practice", "What everyone's working on".
 *
 * A controlled toggle BUTTON (chevron · title · summary) with the trash as its SIBLING, never a
 * button inside a native <summary>: two interactive controls nested is invalid content, and the
 * preventDefault/stopPropagation it forces would have to be copied for every icon the head ever
 * gains (/simplify, 2026-09-14). `onToggle` absent = a static line (the template room's stub).
 * One head for both rooms, so the title, the count and the trash can never drift apart.
 */
function FoldHead({
  title, summary, summaryClassName, open, onToggle, onRemove, removeLabel,
}: {
  title: string;
  summary?: string;
  summaryClassName?: string;
  open?: boolean;
  onToggle?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const inner = (
    <>
      {onToggle && <ChevronRight size={14} aria-hidden className={styles.ppFoldChevron} />}
      <span className={styles.ppFoldTitle}>{title}</span>
      {summary && <span className={summaryClassName ?? styles.ppFoldCount}>{summary}</span>}
    </>
  );
  return (
    <div className={styles.ppFoldHead}>
      {onToggle
        ? <button type="button" className={styles.ppFoldToggle} aria-expanded={open} onClick={onToggle}>{inner}</button>
        : <span className={styles.ppFoldToggle} data-static>{inner}</span>}
      {onRemove && (
        <button type="button" className={`${styles.ppIconBtn} ${styles.ppFoldRemove}`} aria-label={removeLabel} onClick={onRemove}>
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

/**
 * ⚠ The label is "Coaching points", NOT "What to watch for" (owner ruling 2026-08-01).
 *
 * The old label collided with the field screen's "What you're watching for", which is the GOAL —
 * two different fields with near-identical names, one screen apart. One name per idea: the goal is
 * "what you're watching for" everywhere, and this numbered list is "Coaching points" everywhere,
 * which is already what the run screen, the drill record and the plan doc call it.
 *
 * ⚠ Two shapes for one idea, for one stage (stage 2, D10): the BLOCK's points are one field, one
 * per line (`CoachingPointsField` below); a STATION keeps these numbered rows until stage 3 draws
 * the station. The drill library's editor keeps its rows for the same reason.
 */
function CoachingPoints({
  points, readOnly, onSet,
}: { points?: string[]; readOnly: boolean; onSet: (next: string[]) => void }) {
  const current = points ?? [];
  return (
    <div className={styles.ppField}>
      <FieldLabel>Coaching points</FieldLabel>
      {current.map((point, i) => (
        <div key={i} className={styles.ppPointRow}>
          <span className={styles.ppPointNum}>{i + 1}</span>
          <input className={styles.input} value={point} maxLength={MAX_SHORT_TEXT_LEN} disabled={readOnly}
            onChange={e => onSet(current.map((p, j) => (j === i ? e.target.value : p)))}
            aria-label={`Coaching point ${i + 1}`} />
          {!readOnly && (
            <button type="button" className={styles.ppIconBtn} aria-label={`Remove point ${i + 1}`}
              onClick={() => onSet(current.filter((_, j) => j !== i))}><X size={14} /></button>
          )}
        </div>
      ))}
      {!readOnly && current.length < MAX_COACHING_POINTS && (
        <button type="button" className={styles.ppAddInline} onClick={() => onSet([...current, ''])}>
          <Plus size={13} aria-hidden /> Add a point
        </button>
      )}
    </div>
  );
}

/** One line of text → the stored list: one point per line, capped as the sanitiser caps it, so
 *  what the coach sees typing is what saves. Windows line ends are tolerated. Empty → no points. */
function splitPoints(text: string): string[] {
  if (text === '') return [];
  return text.split(/\r?\n/).slice(0, MAX_COACHING_POINTS).map(line => line.slice(0, MAX_SHORT_TEXT_LEN));
}

/**
 * The BLOCK's coaching points as ONE field, one point per line (stage 2, owner ruling D10,
 * 2026-09-15). The numbered rows — an input, a number, a remove button and an add link per point —
 * were a form inside the form and most of what an open block's height was; the field screen and
 * the sheet already print the points as a list. Stored exactly as before (a list, capped at
 * eight, each line capped): the split happens at patch time and the sanitiser is unchanged.
 */
function CoachingPointsField({
  points, readOnly, autoFocus, onSet, onRemove, removeLabel,
}: {
  points?: string[]; readOnly: boolean; autoFocus?: boolean; onSet: (next: string[]) => void;
  onRemove?: () => void; removeLabel?: string;
}) {
  const current = points ?? [];
  return (
    /* ⚠ A `<div>`, not the usual `<label>` wrapper (owner catch, 2026-09-15) — the same reason the
       Minutes field above uses one: a native `<label>` with TWO labelable children (this field's
       new remove button, plus the textarea) forwards a click ANYWHERE inside it, including one
       that lands on the textarea, to its first labelable descendant — the button — so typing a
       click into the textarea closed the field instead of focusing it. `aria-label` replaces the
       accessible name the implicit label association used to give the textarea for free. */
    <div className={styles.ppField}>
      <FieldLabel onRemove={onRemove} removeLabel={removeLabel}>Coaching points</FieldLabel>
      <textarea className={styles.textarea} rows={Math.max(2, current.length)} value={current.join('\n')}
        disabled={readOnly} autoFocus={autoFocus} aria-label="Coaching points"
        maxLength={MAX_COACHING_POINTS * (MAX_SHORT_TEXT_LEN + 1)}
        placeholder="One per line — the two or three things you want to see"
        onChange={e => onSet(splitPoints(e.target.value))} />
      {/* ⚠ FOUND, NOT CAUSED, BY THIS SESSION (/review): at the cap, Enter simply stops doing
          anything — `splitPoints` drops a line past MAX_COACHING_POINTS silently, and the
          textarea's own `maxLength` is a character ceiling, not a line one, so it never engages
          first. A coach had no way to tell "nothing happened" from "I hit the limit". This is the
          missing half of that: the row-numbered predecessor disabled its own "Add a point" button
          at the same cap; a single textarea has no such button to disable, so the explanation has
          to live here instead. */}
      {!readOnly && current.length >= MAX_COACHING_POINTS && (
        <span className={styles.formHint}>
          That&apos;s the most you can keep on one block ({MAX_COACHING_POINTS}) — remove a line to add another.
        </span>
      )}
    </div>
  );
}

function PlayerPickerButton({
  count, readOnly, onOpen,
}: { count: number; readOnly: boolean; onOpen: () => void }) {
  return (
    <button type="button" className={styles.ppPickBtn} disabled={readOnly} onClick={onOpen}>
      <Users size={13} aria-hidden />
      {count > 0 ? `${count} player${count === 1 ? '' : 's'}` : 'Choose players'}
    </button>
  );
}

// ── Station ──────────────────────────────────────────────────────────────────

/**
 * The DRILL half of a station, rendered as TEXT rather than as disabled inputs.
 *
 * ⚠ **Read-only is the point, not a limitation** (owner ruling 2026-08-01): *"if I load a drill and
 * completely change everything about it, then I didn't run the same drill."* A drill is an IDENTITY
 * CLAIM, so "used 8x" has to mean eight of the same thing — and locking these fields is what makes
 * that count real data rather than noise.
 *
 * Text, not greyed-out boxes: a stack of disabled inputs reads as broken on a phone, and rendering
 * the words plainly makes a drill-backed station visibly a different shape from one a coach typed —
 * shorter, more readable, and honestly distinguishable at a glance.
 */
function DrillFacts({ station, equipmentTags }: { station: PracticeStation; equipmentTags?: PickableTag[] }) {
  const { description, goal, coachingPoints, setup } = station;
  // Kit can be legacy NAMES, library IDS (mig 272 drills store ids only), or mid-migration both —
  // resolve for display, de-duplicated, never written back.
  const idNames = (station.equipmentTagIds ?? [])
    .map(id => equipmentTags?.find(t => t.id === id)?.name)
    .filter((n): n is string => !!n);
  const equipment = [...new Set([...(station.equipment ?? []), ...idNames])];
  return (
    <>
      {description && (
        <div className={styles.ppField}>
          <FieldLabel>What you&apos;re doing</FieldLabel>
          <p className={styles.ppReadTxt}>{description}</p>
        </div>
      )}
      {goal && (
        <div className={styles.ppField}>
          <FieldLabel>What you&apos;re watching for</FieldLabel>
          <p className={styles.ppReadTxt}>{goal}</p>
        </div>
      )}
      {coachingPoints?.length ? (
        <div className={styles.ppField}>
          <FieldLabel>Coaching points</FieldLabel>
          <ol className={styles.ppReadPoints}>
            {coachingPoints.map((point, i) => <li key={i}>{point}</li>)}
          </ol>
        </div>
      ) : null}
      {setup && (
        <div className={styles.ppField}>
          <FieldLabel>Setup</FieldLabel>
          <p className={styles.ppReadTxt}>{setup}</p>
        </div>
      )}
      {equipment?.length ? (
        <div className={styles.ppFieldRow}>
          <FieldLabel>Equipment</FieldLabel>
          <div className={styles.ppChipWrap}>
            {equipment.map(e => <span key={e} className={styles.ppChip}>{e}</span>)}
          </div>
        </div>
      ) : null}
    </>
  );
}

function StationCard({
  station, index, isRotation, startingGroups, readOnly, withoutPeople,
  staffTags, onCreateStaffTag, equipmentTags, onCreateEquipmentTag,
  staffManage, onStaffTagsChanged, equipmentManage, onEquipmentTagsChanged,
  nameOf, onPatch, onRemove, onOpenPicker, onDetach, onSwapDrill, onPromote,
}: {
  station: PracticeStation;
  index: number;
  isRotation: boolean;
  /** In a rotation, which group(s) begin here — the station's answer to "who do I start with?". */
  startingGroups: PracticeGroup[];
  readOnly: boolean;
  /** A TEMPLATE has no roster and no staff — the practice supplies both. See the module header. */
  withoutPeople: boolean;
  staffTags: PickableTag[];
  onCreateStaffTag?: (name: string) => Promise<PickableTag | null>;
  equipmentTags: PickableTag[];
  onCreateEquipmentTag?: (name: string) => Promise<PickableTag | null>;
  staffManage?: TagManageConfig;
  onStaffTagsChanged?: () => void;
  equipmentManage?: TagManageConfig;
  onEquipmentTagsChanged?: () => void;
  nameOf: (playerId: string) => string;
  onPatch: (patch: Partial<PracticeStation>) => void;
  onRemove: () => void;
  onOpenPicker: () => void;
  /** "Edit just for this practice" — keeps every word, drops the drill identity. */
  onDetach: () => void;
  onSwapDrill: () => void;
  /** "Save to my drills…" — offered only on a station the coach typed themselves (D18). */
  onPromote?: () => void;
}) {
  // Two DIFFERENT kinds of not-editable, deliberately never conflated:
  //   readOnly  → this viewer may not write the plan at all (an assistant).
  //   fromDrill → the drill's own words are locked because it is still that drill.
  // They never compose: the drill half is rendered as TEXT when `fromDrill`, so the editable
  // branch below is reached only when it is false and `readOnly` is the whole answer there.
  const fromDrill = !!station.drillId;

  return (
    <div className={styles.ppStation}>
      <div className={styles.ppStationHead}>
        <span className={styles.ppStationNum}>{index + 1}</span>
        {fromDrill ? (
          <span className={styles.ppStationNameRead}>{station.name}</span>
        ) : (
          <input className={`${styles.input} ${styles.ppStationName}`} value={station.name} disabled={readOnly}
            maxLength={MAX_TITLE_LEN} placeholder="Station name"
            aria-label={`Station ${index + 1} name`} onChange={e => onPatch({ name: e.target.value })} />
        )}
        {!readOnly && (
          <button type="button" className={styles.ppIconBtn} aria-label={`Remove station ${index + 1}`}
            onClick={onRemove}><Trash2 size={14} /></button>
        )}
      </div>

      <div className={styles.ppStationBody}>
        {fromDrill ? (
          <>
            {/* Quiet, and it STAYS for the life of the station — it records where this came from,
                which remains true however the practice goes. Nothing renders from the drill row
                itself, so there is no "edited" state to track. */}
            <p className={styles.ppFromDrill}>
              <Library size={12} aria-hidden /> From your drills
              {station.drillTags?.length ? ` · ${station.drillTags.join(' · ')}` : ''}
            </p>
            <DrillFacts station={station} equipmentTags={equipmentTags} />
            {!readOnly && (
              <div className={styles.ppDrillActions}>
                {/* ⚠ Detaching is the HONEST act, not a workaround. It keeps every word and hands
                    the coach full editing without leaving the plan at 9pm — and the count stays
                    truthful precisely BECAUSE the edit breaks the link. */}
                <button type="button" className={styles.ppAddInline} onClick={onDetach}>
                  <Pencil size={12} aria-hidden /> Edit just for this practice
                </button>
                <button type="button" className={styles.ppAddInline} onClick={onSwapDrill}>
                  <Repeat size={12} aria-hidden /> Swap drill
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <label className={styles.ppField}>
              <FieldLabel>What you&apos;re doing</FieldLabel>
              <textarea className={styles.textarea} rows={2} value={station.description ?? ''} disabled={readOnly}
                maxLength={MAX_TEXT_LEN}
                placeholder="What happens at this station"
                onChange={e => onPatch({ description: e.target.value })} />
            </label>
            <label className={styles.ppField}>
              <FieldLabel>What you&apos;re watching for</FieldLabel>
              <input className={styles.input} value={station.goal ?? ''} disabled={readOnly}
                maxLength={MAX_TEXT_LEN} placeholder="What good looks like here"
                onChange={e => onPatch({ goal: e.target.value })} />
            </label>
            <label className={styles.ppField}>
              <FieldLabel>Setup</FieldLabel>
              <textarea className={styles.textarea} rows={2} value={station.setup ?? ''} disabled={readOnly}
                maxLength={MAX_TEXT_LEN}
                placeholder="How it's laid out — where things go, and how far apart"
                onChange={e => onPatch({ setup: e.target.value })} />
            </label>
            <PracticeTagPicker label="Equipment" all={equipmentTags} ids={station.equipmentTagIds ?? []}
              legacyNames={station.equipment} disabled={readOnly} onCreate={onCreateEquipmentTag}
              manage={equipmentManage} onManageChanged={onEquipmentTagsChanged}
              onChange={next => onPatch({ equipmentTagIds: next })}
              emptyHint="No equipment yet — type an item to add your first one." />
          </>
        )}

        {/* ⚠ A template stores no staff and no players — the practice supplies both, which is what
            lets one template work in April with twelve and July with nine. The controls are absent
            rather than disabled: a control that exists only to refuse should not exist. */}
        {!withoutPeople && (
          <PracticeTagPicker label="Who runs it" all={staffTags} ids={station.staffTagIds ?? []}
            legacyNames={station.staff} disabled={readOnly} onCreate={onCreateStaffTag}
            manage={staffManage} onManageChanged={onStaffTagsChanged}
            onChange={next => onPatch({ staffTagIds: next })}
            emptyHint="No staff yet — type a name to add your first one." />
        )}

        {/* People live at exactly ONE level. In a rotation that level is the block's groups, so the
            station shows which group it STARTS with rather than offering a second, contradictory
            roster. Everywhere else the station owns its own list. */}
        {!withoutPeople && (isRotation ? (
          <div className={styles.ppFieldRow}>
            <FieldLabel>Starts with</FieldLabel>
            {startingGroups.length === 0 ? (
              <span className={styles.ppRailNone}>No group starts here — add groups above.</span>
            ) : (
              <div className={styles.ppChipWrap}>
                {startingGroups.map(g => (
                  <span key={g.id} className={styles.ppChip}>
                    {g.name}
                    {g.playerIds.length > 0 && <span className={styles.ppChipCount}>{g.playerIds.length}</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className={styles.ppFieldRow}>
            <FieldLabel>Who&apos;s at it</FieldLabel>
            <div className={styles.ppChipWrap}>
              {(station.playerIds ?? []).map(pid => <span key={pid} className={styles.ppChip}>{nameOf(pid)}</span>)}
              <PlayerPickerButton count={station.playerIds?.length ?? 0} readOnly={readOnly} onOpen={onOpenPicker} />
            </div>
          </div>
        ))}

        {/* Rendered above by DrillFacts when this station came from one. */}
        {!fromDrill && (
          <CoachingPoints points={station.coachingPoints} readOnly={readOnly}
            onSet={next => onPatch({ coachingPoints: next })} />
        )}

        {/* ⚠ ALWAYS editable, even on a drill-backed station — this is the one field that must
            never travel back to the library, so it is also the one that must never be locked. It
            absorbs most "one word different tonight" cases with no detaching at all.

            ⚠ Absent on a TEMPLATE for exactly the same reason it is absent on a drill: "just for
            tonight" is the one field that must never travel in either direction. A template is
            every future Tuesday, which is the opposite of tonight. */}
        {!withoutPeople && (
          <label className={styles.ppField}>
            <FieldLabel>Just for tonight</FieldLabel>
            <input className={styles.input} value={station.note ?? ''} disabled={readOnly} maxLength={MAX_TEXT_LEN}
              placeholder="A one-off note for this practice" onChange={e => onPatch({ note: e.target.value })} />
          </label>
        )}

        {!isRotation && !withoutPeople && (
          <label className={styles.ppField}>
            <FieldLabel>Rotation note</FieldLabel>
            <input className={styles.input} value={station.rotationNote ?? ''} disabled={readOnly}
              maxLength={MAX_SHORT_TEXT_LEN} placeholder="Informal — e.g. swap halfway"
              onChange={e => onPatch({ rotationNote: e.target.value })} />
          </label>
        )}

        {/* D18 — explicit promotion, never automatic. Offered only on a station the coach wrote
            themselves, and only once it has a name worth saving: auto-saving every station fills
            the library with five near-identical "Warm-up" rows in a season and makes the picker
            slower than typing. */}
        {!readOnly && !fromDrill && onPromote && station.name.trim() && (
          <div className={styles.ppDrillActions}>
            <button type="button" className={styles.ppAddInline} onClick={onPromote}>
              <Library size={12} aria-hidden /> Save to my drills…
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Rotation ─────────────────────────────────────────────────────────────────

function RotationPanel({
  rotation, stations, blockMinutes, stationCount, blockStartMs, drawPool, notReplied, showNotReplied,
  readOnly, withoutPeople, nameOf, onSetRotation, onOpenGroupPicker,
}: {
  rotation: PracticeRotation;
  stations?: PracticeStation[];
  /** The rotation has no length of its own — it runs for exactly as long as its block. */
  blockMinutes: number | null;
  stationCount: number;
  blockStartMs?: number;
  drawPool: PracticeRosterPlayer[];
  notReplied: PracticeRosterPlayer[];
  showNotReplied: boolean;
  readOnly: boolean;
  /**
   * ⚠ A TEMPLATE keeps the rotation's SHAPE — how often groups move is part of how the practice
   * runs, and it is worth saving. It never keeps the GROUPS, because groups are children. So this
   * panel keeps its interval control and drops everything below it.
   */
  withoutPeople: boolean;
  nameOf: (playerId: string) => string;
  onSetRotation: (patch: Partial<PracticeRotation>) => void;
  onOpenGroupPicker: (groupId: string) => void;
}) {
  const [drawMode, setDrawMode] = useState<DrawMode>('groups');
  /** Null = follow the station count, which is the sensible default: one group per station.
   *  Once the coach types a number it is theirs and stops moving. */
  const [drawN, setDrawN] = useState<number | null>(null);
  const drawCount = drawN ?? Math.max(1, stationCount);
  const grid = computeRotation(rotation, stations, blockMinutes, blockStartMs);
  const intervalShown = rotation.intervalMinutes ?? defaultIntervalMinutes(blockMinutes, stationCount);

  return (
    <div className={styles.ppRotation}>
      {/* No 'runs for' here: the rotation lasts as long as the block, and storing that twice only
          let the two numbers disagree. Left alone, each round is the block split evenly across the
          stations — everyone gets one turn each — and it keeps following as they change. */}
      <label className={styles.ppRotationTimes}>
        <FieldLabel>Groups move every</FieldLabel>
        <span className={styles.ppRangeWrap}>
          <input className={`${styles.input} ${styles.ppMinutes}`} type="number" min={1} max={600}
            inputMode="numeric" disabled={readOnly} value={intervalShown ?? ''}
            aria-label="Minutes between moves" placeholder="—"
            onChange={e => onSetRotation({ intervalMinutes: e.target.value ? Number(e.target.value) : null })} />
          <span className={styles.ppUnit}>min</span>
        </span>
      </label>

      {/* ⚠ A template stops here. Everything below assigns children to groups, and a template
          supplies no children — the plan it starts draws its own groups from that night's roster,
          which is exactly what lets one template work in April with twelve and July with nine. */}
      {withoutPeople && (
        <p className={styles.formHint}>
          Groups are drawn on the practice itself — a template keeps the shape, not the players.
        </p>
      )}

      {/* ── Groups (D21) — the two ways to make them, said separately rather than crammed into
          one row where nothing explained what the controls belonged to. ── */}
      {!withoutPeople && <div className={styles.ppGroupsHead}><FieldLabel>Groups</FieldLabel></div>}
      {!readOnly && !withoutPeople && (
        <div className={styles.ppGroupWays}>
          <div className={styles.ppGroupWay}>
            <span className={styles.ppGroupWayLabel}>Draw them at random</span>
            <div className={styles.ppGroupWayControls}>
              <select className={styles.input} value={drawMode} aria-label="Draw by"
                onChange={e => setDrawMode(e.target.value as DrawMode)}>
                <option value="groups">How many groups</option>
                <option value="perGroup">Players per group</option>
              </select>
              <input className={`${styles.input} ${styles.ppCount}`} type="number" min={1} max={MAX_GROUPS}
                inputMode="numeric" value={drawCount} aria-label="Number for the draw"
                onChange={e => setDrawN(Math.max(1, Number(e.target.value) || 1))} />
              <button type="button" className={styles.btnSecondary}
                onClick={() => onSetRotation({
                  groups: drawGroups(drawPool.map(p => p.id), drawMode, drawCount),
                  groupSource: 'random',
                })}>
                <Shuffle size={13} aria-hidden /> {rotation.groupSource === 'random' ? 'Draw again' : 'Draw'}
              </button>
            </div>
          </div>
          <div className={styles.ppGroupWay}>
            <span className={styles.ppGroupWayLabel}>Or build them yourself</span>
            <button type="button" className={styles.btnGhost} disabled={rotation.groups.length >= MAX_GROUPS}
              onClick={() => onSetRotation({
                groups: [...rotation.groups, { id: newPracticePlanId(), name: groupLabel(rotation.groups.length), playerIds: [] }],
                groupSource: 'manual',
              })}>
              <Plus size={13} aria-hidden /> Add a group
            </button>
          </div>
        </div>
      )}

      {!withoutPeople && (rotation.groups.length === 0 ? (
        <p className={styles.formHint}>
          Pick the groups yourself, or draw them at random. A draw is deliberately simple — it shuffles and
          deals, and never sorts anyone by ability.
        </p>
      ) : (
        <>
          <p className={styles.ppSplitNote}>{describeSplit(rotation.groups)}</p>
          {/* Who was left out of a draw is NAMED, never silently dropped (D21). */}
          {rotation.groupSource === 'random' && showNotReplied && notReplied.length > 0 && (
            <p className={styles.formHint}>
              Not in the draw (hasn&apos;t replied yes): {notReplied.map(p => playerDisplayName(p)).join(', ')}.
            </p>
          )}
          <div className={styles.ppGroupList}>
            {rotation.groups.map(group => (
              <div key={group.id} className={styles.ppGroup}>
                <div className={styles.ppGroupHead}>
                  <input className={`${styles.input} ${styles.ppGroupName}`} value={group.name} disabled={readOnly}
                    maxLength={60} aria-label="Group name"
                    onChange={e => onSetRotation({
                      groups: rotation.groups.map(g => (g.id === group.id ? { ...g, name: e.target.value } : g)),
                    })} />
                  {!readOnly && (
                    <button type="button" className={styles.ppIconBtn} aria-label={`Remove ${group.name}`}
                      onClick={() => onSetRotation({ groups: rotation.groups.filter(g => g.id !== group.id) })}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className={styles.ppChipWrap}>
                  {group.playerIds.map(pid => <span key={pid} className={styles.ppChip}>{nameOf(pid)}</span>)}
                  <PlayerPickerButton count={group.playerIds.length} readOnly={readOnly}
                    onOpen={() => onOpenGroupPicker(group.id)} />
                </div>
              </div>
            ))}
          </div>
        </>
      ))}

      {/* ── The computed grid — the one artifact a shared document cannot produce ── */}
      <div className={styles.ppGridWrap}>
        <FieldLabel>Where everyone is</FieldLabel>
        {grid.roundsList.length > 0 && (
          <div className={styles.ppGridScroll}>
            <table className={styles.ppGrid}>
              <thead>
                <tr>
                  <th scope="col">Round</th>
                  {grid.roundsList[0].cells.map(cell => <th key={cell.groupId} scope="col">{cell.groupName}</th>)}
                </tr>
              </thead>
              <tbody>
                {grid.roundsList.map(round => (
                  <tr key={round.round}>
                    <th scope="row">
                      {round.round}
                      {round.startLabel && <span className={styles.ppGridTime}>{round.startLabel}</span>}
                    </th>
                    {round.cells.map(cell => <td key={cell.groupId}>{cell.stationName || '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Plain statements about what the arithmetic actually does. A mismatch is STATED —
            never tidied away by inventing a round or dropping a station (D25). */}
        {grid.notes.length > 0 && (
          <ul className={styles.ppNotes}>{grid.notes.map((note, i) => <li key={i}>{note}</li>)}</ul>
        )}
      </div>
    </div>
  );
}

// ── Block ────────────────────────────────────────────────────────────────────

// ── The drill picker (Phase 2) ────────────────────────────────────────────────

/**
 * "From your drills" / "Write one" — the sheet that turns authoring into four taps.
 *
 * ⚠ **Preview before adding earns its place BECAUSE the drill arrives read-only.** A coach cannot
 * quietly fix the words afterwards (they would have to detach), so being able to read the whole
 * thing before committing is the difference between four taps and an undo.
 *
 * ⚠ **"Write one" is byte-for-byte the old behaviour.** A coach who never touches the library
 * loses nothing and is never nagged toward it — and on an EMPTY library this sheet opens straight
 * onto "Write one", so a new coach never meets a blank list first.
 */
function DrillPickerSheet({
  drills, title, writeLabel, onPick, onWriteOne, onClose,
}: {
  drills: RepTeamDrill[];
  title: string;
  writeLabel: string;
  onPick: (drill: RepTeamDrill) => void;
  onWriteOne: () => void;
  onClose: () => void;
}) {
  const hasDrills = drills.length > 0;
  const [tab, setTab] = useState<'drills' | 'write'>(hasDrills ? 'drills' : 'write');
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const drillTags = useMemo(() => collectTags(drills), [drills]);
  // The SAME predicate the library room uses — one rule, so the two lists can't drift.
  const shown = useMemo(
    () => filterTagged(sortDrillsForPicker(drills), query, tagFilter),
    [drills, query, tagFilter],
  );

  const preview = previewId ? drills.find(d => d.id === previewId) ?? null : null;

  /* The portal's dialog floor (stage 2, D9): Escape closes, Tab stays inside, focus returns to the
     link that opened this. Mounted only while open, so the floor is armed for its whole life. */
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFloor(true, panelRef, { onClose });

  return (
    <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        className={`${styles.modal} ${styles.modalScrollBody}`}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{title}</h3>
          <button type="button" className={styles.modalCloseBtn} aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {preview ? (
          <div className={styles.ppDrillPreview}>
            <p className={styles.ppFieldLabel}>Preview — nothing added yet</p>
            <p className={styles.ppDrillPreviewName}>{preview.name}</p>
            {preview.description && <p className={styles.ppReadTxt}><b>Doing:</b> {preview.description}</p>}
            {preview.goal && <p className={styles.ppReadTxt}><b>Watching for:</b> {preview.goal}</p>}
            {preview.coachingPoints.length > 0 && (
              <ol className={styles.ppReadPoints}>
                {preview.coachingPoints.map((p, i) => <li key={i}>{p}</li>)}
              </ol>
            )}
            {preview.setup && <p className={styles.ppReadTxt}><b>Setup:</b> {preview.setup}</p>}
            {preview.equipment.length > 0 && (
              <p className={styles.ppReadTxt}><b>Equipment:</b> {preview.equipment.join(' · ')}</p>
            )}
            <div className={styles.modalFooter}>
              <button type="button" className={styles.btnGhost} onClick={() => setPreviewId(null)}>Back</button>
              <button type="button" className={styles.btnPrimary} onClick={() => onPick(preview)}>
                Add to the practice
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.ppDrillTabs} role="tablist">
              <button type="button" role="tab" aria-selected={tab === 'drills'} disabled={!hasDrills}
                className={styles.ppDrillTab} data-on={tab === 'drills' ? 'on' : undefined}
                onClick={() => setTab('drills')}>From your drills</button>
              <button type="button" role="tab" aria-selected={tab === 'write'}
                className={styles.ppDrillTab} data-on={tab === 'write' ? 'on' : undefined}
                onClick={() => setTab('write')}>Write one</button>
            </div>

            {tab === 'write' ? (
              <div className={styles.ppDrillWrite}>
                <p className={styles.formHint}>
                  {hasDrills
                    ? 'Write it here and it stays with this practice. You can save it to your drills afterwards.'
                    : 'You haven’t saved any drills yet. Write this one here — you can save it to your drills afterwards, and picking it next time takes four taps.'}
                </p>
                <button type="button" className={styles.btnPrimary} onClick={onWriteOne}>{writeLabel}</button>
              </div>
            ) : (
              <>
                <div className={styles.ppDrillFilters}>
                  <input className={styles.input} value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="Search…" aria-label="Search drills" />
                  <div className={styles.ppSuggestWrap}>
                    <button type="button" className={styles.ppSuggestChip} data-on={tagFilter == null ? 'on' : undefined}
                      onClick={() => setTagFilter(null)}>All</button>
                    {drillTags.map(t => (
                      <button key={t.id} type="button" className={styles.ppSuggestChip}
                        data-on={tagFilter === t.id ? 'on' : undefined} onClick={() => setTagFilter(t.id)}>{t.name}</button>
                    ))}
                    {/* ⚠ Always offered when it applies, so a drill can never become unreachable
                        simply by carrying no tags. */}
                    {drills.some(d => d.tags.length === 0) && (
                      <button type="button" className={styles.ppSuggestChip}
                        data-on={tagFilter === UNTAGGED_FILTER ? 'on' : undefined}
                        onClick={() => setTagFilter(UNTAGGED_FILTER)}>No tags</button>
                    )}
                  </div>
                </div>

                <div className={styles.ppPickList}>
                  {shown.length === 0 && <p className={styles.formHint}>No drills match that.</p>}
                  {shown.map(drill => (
                    <div key={drill.id} className={styles.ppDrillRow}>
                      <div className={styles.ppDrillRowMain}>
                        <span className={styles.ppDrillRowName}>
                          {drill.name}
                          {/* Shared club drills are marked and lead — a coach should meet the
                              club's answer before their own variation. */}
                          {drill.teamId === null && <span className={styles.ppSharedChip}>Club</span>}
                        </span>
                        <span className={styles.ppDrillRowMeta}>
                          {[drill.tags.map(t => t.name).join(' · ') || null, drill.usualMinutes ? `${drill.usualMinutes} min` : null]
                            .filter(Boolean).join(' · ')}
                        </span>
                      </div>
                      <div className={styles.ppDrillRowActions}>
                        <button type="button" className={styles.ppAddInline} onClick={() => setPreviewId(drill.id)}>
                          Preview
                        </button>
                        <button type="button" className={styles.btnSecondary} onClick={() => onPick(drill)}>Add</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * "Save to my drills…" (D18) — asks EXACTLY ONE question, and even that one is optional.
 *
 * Anything more and a coach mid-plan simply won't do it. The sentence names what does NOT travel,
 * because that is the one thing that could surprise someone at this moment.
 */
function PromoteDrillDialog({
  stationName, tags, onCreateTag, busy, error, onSave, onClose, manage, onManageChanged,
}: {
  stationName: string;
  tags: PickableTag[];
  onCreateTag: (name: string) => Promise<PickableTag | null>;
  busy: boolean;
  error: string;
  onSave: (tagIds: string[]) => void;
  onClose: () => void;
  manage?: TagManageConfig;
  onManageChanged?: () => void;
}) {
  const [tagIds, setTagIds] = useState<string[]>([]);
  /* The dialog floor (D9), busy-gated: while the drill is saving the sheet holds, so a write is
     never torn down under its own request. The tag list inside claims its own Escape while open
     (`escapeOwnership.ts`) — it closes itself, not the sheet. */
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFloor(true, panelRef, { onClose, busy });
  return (
    <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Save to my drills"
        aria-busy={busy || undefined} className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Save &ldquo;{stationName}&rdquo; to your drills</h3>
          <button type="button" className={styles.modalCloseBtn} aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className={styles.ppDrillWrite}>
          <TagPicker
            label="Tags — one question, and it's optional"
            all={tags}
            selected={tagIds}
            onChange={setTagIds}
            onCreate={onCreateTag}
            manage={manage} onManageChanged={onManageChanged}
          />
          <p className={styles.formHint}>
            The setup, coaching points and equipment come with it. Who ran it and who was at it stay
            with tonight&apos;s practice.
          </p>
          {error && <p className={styles.errorText}>{error}</p>}
        </div>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnGhost} onClick={onClose}>Cancel</button>
          <button type="button" className={styles.btnPrimary} disabled={busy} onClick={() => onSave(tagIds)}>
            {busy ? 'Saving…' : 'Save to my drills'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * ONE block on the timeline (practices re-evaluation stage 1 · The blank page, owner ruling D2,
 * 2026-09-14): its gutter cell — the start time, and its length in small — and beside it either a
 * ROW (a button that opens it) or the block OPEN IN PLACE, on the paper ground. One block is open
 * at a time; the editor owns which.
 *
 * The block's anatomy (stage 2 · The block, owner rulings D1–D11, 2026-09-15):
 *   · SHUT — title (+ the Rotation tag) · first line (read through a sole station, so a
 *     drill-placed row reads its drill) · "3 stations" when it has them · Whole team or "6 players"
 *     · nothing else. No count of coaching points (§133: a fact the coach gets by opening the thing
 *     needs no label promising it).
 *   · OPEN — title · the clock row (quick lengths · minutes · Rest of practice · "ends 7:15 p.m.")
 *     · What you're doing · What you're watching for · Players (Whole team until names are chosen)
 *     — then what the block holds, then the doors at the foot. A block with exactly one station and
 *     no words of its own asks for no teaching (D7): it opens onto the station's read-only text.
 *     Kit lives at the activity's level (D11): the block's while it has no stations.
 *   · The station card, the rotation panel and the drill sheet's contents are stage 3's and 4's —
 *     untouched here.
 */
function BlockCard({
  block, index, blockCount, clock, blockStartMs, open, focusTitle, openDoors, readOnly, withoutPeople,
  restTakenElsewhere, drawPool, notReplied,
  showNotReplied, staffTags, onCreateStaffTag, equipmentTags, onCreateEquipmentTag, nameOf,
  staffManage, onStaffTagsChanged, equipmentManage, onEquipmentTagsChanged,
  onOpen, onClose, onOpenDoor, onCloseDoor, onMove, onDelete, onPatch, onOpenPicker, onAddStation, onDetachStation,
  onSwapStation, onPromoteStation,
}: {
  block: PracticePlanBlock;
  index: number;
  blockCount: number;
  clock?: BlockClock;
  blockStartMs?: number;
  open: boolean;
  /** A block the coach JUST added lands with its title focused; a row they opened to read does not. */
  focusTitle: boolean;
  /** The doors standing open on THIS block while it is open — the editor owns the set (D1). */
  openDoors: ReadonlySet<BlockDoor>;
  readOnly: boolean;
  /** A TEMPLATE has no roster and no staff — the practice supplies both. */
  withoutPeople: boolean;
  /** Another block already claims "rest of practice" (D13 allows exactly one). */
  restTakenElsewhere: boolean;
  drawPool: PracticeRosterPlayer[];
  notReplied: PracticeRosterPlayer[];
  showNotReplied: boolean;
  staffTags: PickableTag[];
  onCreateStaffTag?: (name: string) => Promise<PickableTag | null>;
  equipmentTags: PickableTag[];
  onCreateEquipmentTag?: (name: string) => Promise<PickableTag | null>;
  staffManage?: TagManageConfig;
  onStaffTagsChanged?: () => void;
  equipmentManage?: TagManageConfig;
  onEquipmentTagsChanged?: () => void;
  nameOf: (playerId: string) => string;
  onOpen: () => void;
  onClose: () => void;
  onOpenDoor: (door: BlockDoor) => void;
  /** The other direction — only ever legal while `blockHolds` says the door is still empty. */
  onCloseDoor: (door: BlockDoor) => void;
  onMove: (delta: number) => void;
  onDelete: () => void;
  onPatch: (patch: Partial<PracticePlanBlock>) => void;
  onOpenPicker: (target: AttachTarget) => void;
  /** Opens the drill sheet for this block. `swapStationId` replaces rather than appends. */
  onAddStation: (swapStationId?: string) => void;
  onDetachStation: (stationId: string) => void;
  onSwapStation: (stationId: string) => void;
  onPromoteStation: (stationId: string) => void;
}) {
  const stationCount = block.stations?.length ?? 0;
  // ONE answer to "does this rotate", shared with the sanitiser, the grid and the printed sheet.
  const isRotation = blockRotates(block);
  /* A block only gains a stored rotation once the coach touches one. Until then this stand-in
     renders the empty controls — so adding a second station reveals the rotation immediately,
     without a write the coach didn't ask for. It seeds the total from the block's own length,
     which is what they just typed, and leaves the interval blank so the grid asks for it rather
     than inventing a round length. */
  const rotation: PracticeRotation = block.rotation ?? { intervalMinutes: null, groups: [], groupSource: 'manual' };
  const label = block.title || `Block ${index + 1}`;
  const stations = block.stations ?? [];

  const patchStation = (stationId: string, patch: Partial<PracticeStation>) =>
    onPatch({ stations: stations.map(s => (s.id === stationId ? { ...s, ...patch } : s)) });

  /* The gutter — the block's start in the org's clock, its length in small. A template has no
     clock (no start), so the gutter carries the length alone. Read aloud: it is the only place the
     block's time lives now that the head has given it up. */
  const gutterLength = formatDuration(block.duration);
  const gutter = (
    <div className={styles.ppTlGutter}>
      {clock ? clock.startLabel : gutterLength || '—'}
      {clock && <small>{block.duration.restOfPractice ? 'rest' : gutterLength || 'no length'}</small>}
    </div>
  );

  if (!open) {
    /* The shut row (D6): the first line reads THROUGH a sole station — the run screen's rule, "with
       one station the station is the block" — so a drill-placed row says what the block is; with
       two or more, the block's own line is the circuit's intro. "3 stations" only when it has them
       (one station is the block, not a count); who, in the block's own word — Whole team, or the
       names chosen — only where the block itself holds the people (no stations, not a template). */
    const sole = stationCount === 1 ? block.stations![0] : null;
    const firstLine = sole ? resolveStationTeaching(sole, block).description : block.description;
    /* The row's second line (owner ask, 2026-09-15, revising D6 the same day it shipped): "what
       you're watching for" sits beside "what you're doing" on every other surface that teaches
       this block — the station card, the field screen, the printed sheet, the drill preview the
       coach just read. The shut row was the one place that only ever said half of it. Setup,
       equipment and coaching points stay OFF this row on purpose — they're prep-day logistics, not
       the flow a coach is reading, and they already have a home (the practice's own Equipment
       shelf, and the open block's own fields) — repeating them here is the height regression D6
       was built to avoid. */
    const watchingFor = sole ? resolveStationTeaching(sole, block).goal : block.goal;
    const playerCount = block.playerIds?.length ?? 0;
    const rowMeta = [
      stationCount >= 2 ? `${stationCount} stations` : null,
      withoutPeople || stationCount > 0 ? null : playerCount > 0 ? `${playerCount} player${playerCount === 1 ? '' : 's'}` : 'Whole team',
    ].filter(Boolean).join(' · ');
    return (
      <div className={styles.ppTlRow}>
        {gutter}
        {/* The row's accessible name is its CONTENT — title, first line, watching for, who — with a
            hidden "Open" verb in front; an aria-label would replace all of that with the title
            alone (/review, 2026-09-14). The gutter before it carries the time. */}
        <button type="button" className={styles.ppTlClosed} aria-expanded={false} onClick={onOpen}>
          <span className="sr-only">Open </span>
          <span className={styles.ppTlTitle}>
            {block.title || <span className={styles.ppTlUntitled}>{label}</span>}
            {isRotation && <span className={styles.ppShapeTag}><Repeat size={11} aria-hidden /> Rotation</span>}
          </span>
          {firstLine && <span className={styles.ppTlDesc}>{firstLine}</span>}
          {watchingFor && <span className={styles.ppTlWatch}><b>Watching for:</b> {watchingFor}</span>}
          {rowMeta && <span className={styles.ppTlMeta}>{rowMeta}</span>}
        </button>
      </div>
    );
  }

  /* The open body (D1): what shows = what the block holds ∨ a door opened this time (the set is
     seeded with what it held when it opened, so clearing a field never removes it mid-edit).
     "Does this block ask for teaching of its own" (D7) is the one predicate the shut row above
     and this body both turn on — the row through a sole station's words, the body through the
     fields it offers — so the two can never disagree about what a block is. The Players line
     is always on a block that holds its own people; a template has none. */
  const held = blockHolds(block);
  const playerCount = block.playerIds?.length ?? 0;
  const isRest = !!block.duration.restOfPractice;
  const showTeaching = held.teaching || openDoors.has('teaching');
  const showPoints = showTeaching && (held.points || openDoors.has('points'));
  const showStaff = !withoutPeople && (held.staff || openDoors.has('staff'));
  const showPlayers = !withoutPeople && stationCount === 0;
  const showKit = stationCount === 0 && (held.equipment || openDoors.has('equipment'));
  const showStations = held.stations || openDoors.has('stations');
  const doors: { id: BlockDoor; label: string }[] = [
    showTeaching && !showPoints ? { id: 'points', label: 'Coaching points' } : null,
    !withoutPeople && !showStaff ? { id: 'staff', label: 'Staff' } : null,
    stationCount === 0 && !showKit ? { id: 'equipment', label: 'Equipment' } : null,
    !showStations ? { id: 'stations', label: 'Stations' } : null,
  ].filter((d): d is { id: BlockDoor; label: string } => !!d);
  /** The three closable doors' onRemove/removeLabel/autoFocus, in one place instead of a
   *  near-identical ternary at each of the three call sites below (/simplify, 2026-09-15).
   *  `onRemove` is only ever live while the door is still empty — closing it, never deleting
   *  held data. */
  const doorProps = (door: BlockDoor, doorLabel: string) => ({
    onRemove: !readOnly && !held[door] ? () => onCloseDoor(door) : undefined,
    removeLabel: `Remove ${doorLabel}`,
    autoFocus: openDoors.has(door) && !held[door],
  });
  const pointsDoor = doorProps('points', 'Coaching points');
  const staffDoor = doorProps('staff', 'Staff');
  const equipmentDoor = doorProps('equipment', 'Equipment');

  return (
    <div className={styles.ppTlRow}>
      {gutter}
      <div className={styles.ppTlOpen}>
      <div className={styles.ppBlockHead}>
        {/* Reorder with BUTTONS, never drag — gloves and phones defeat drag (the Roster lesson). */}
        <div className={styles.ppBlockOrder}>
          <button type="button" className={styles.ppIconBtn} aria-label={`Move ${label} up`}
            disabled={readOnly || index === 0} onClick={() => onMove(-1)}><ChevronUp size={16} /></button>
          <button type="button" className={styles.ppIconBtn} aria-label={`Move ${label} down`}
            disabled={readOnly || index === blockCount - 1} onClick={() => onMove(1)}><ChevronDown size={16} /></button>
        </div>

        <div className={styles.ppBlockTitleWrap}>
          <input className={`${styles.input} ${styles.ppBlockTitle}`} value={block.title} disabled={readOnly}
            maxLength={MAX_TITLE_LEN}
            placeholder="What are we doing?"
            autoFocus={focusTitle}
            aria-label={`Block ${index + 1} title`} onChange={e => onPatch({ title: e.target.value })} />
          {/* The clock left this line for the gutter (stage 1); the shape tag stays with the title. */}
          {isRotation && (
            <span className={styles.ppBlockClock}>
              <span className={styles.ppShapeTag}><Repeat size={11} aria-hidden /> Rotation</span>
            </span>
          )}
        </div>

        <button type="button" className={styles.ppIconBtn} aria-expanded
          aria-label={`Close ${label}`} onClick={onClose}>
          <ChevronUp size={16} />
        </button>
        {!readOnly && (
          <button type="button" className={styles.ppIconBtn} aria-label={`Delete ${label}`} onClick={onDelete}>
            <Trash2 size={15} />
          </button>
        )}
      </div>

      <div className={styles.ppBlockBody}>
        {/* ── The clock row (D4 · D5): quick lengths · the minutes · Rest of practice · "ends …" ──
            ⚠ RANGES WERE REMOVED (owner, 2026-08-01). A block that might run 25 or 35 minutes
            makes the next block's start time unknowable — the one question this running clock
            exists to answer. A coach who wants slack types one number with the slack in it.
            A chip is on when the minutes equal it; any other number is typed and no chip is on.
            Only ONE block per plan may be "rest of practice" (D13): when another holds it the chip
            is ABSENT, not disabled with a hover title (invisible on a phone). Un-pressing Rest
            returns the default length, never "no length" — a null stalls the clock at this block.
            The consequence, "ends 7:15 p.m.", is the gutter's own walk (`clock.endLabel`); the
            open block repeats the START nowhere — the gutter has it. A template has no clock. */}
        <div className={styles.ppField}>
          <FieldLabel>Minutes</FieldLabel>
          <div className={styles.ppClockRow}>
            {!readOnly && QUICK_MINUTES.map(n => {
              const on = !isRest && block.duration.minutes === n;
              return (
                <button key={n} type="button" className={styles.ppQuickChip} aria-pressed={on}
                  data-on={on ? 'on' : undefined} aria-label={`${n} minutes`}
                  onClick={() => onPatch({ duration: { minutes: n } })}>{n}</button>
              );
            })}
            <input className={`${styles.input} ${styles.ppMinutes}`} type="number" min={1} max={MAX_MINUTES}
              inputMode="numeric" disabled={readOnly || isRest}
              value={isRest ? '' : block.duration.minutes ?? ''} aria-label="Minutes"
              onChange={e => onPatch({
                duration: { minutes: e.target.value ? Number(e.target.value) : null },
              })} />
            <span className={styles.ppUnit}>min</span>
            {!readOnly && !restTakenElsewhere && (
              <>
                <span className={styles.ppClockSep} aria-hidden>·</span>
                <button type="button" className={styles.ppQuickChip} aria-pressed={isRest}
                  data-on={isRest ? 'on' : undefined}
                  onClick={() => onPatch({
                    duration: isRest ? { minutes: DEFAULT_BLOCK_MINUTES } : { minutes: null, restOfPractice: true },
                  })}>Rest of practice</button>
              </>
            )}
            {clock?.endLabel && (
              <span className={styles.ppClockEnds}>{isRest ? 'runs to' : 'ends'} {clock.endLabel}</span>
            )}
          </div>
        </div>

        {/* ── The two teaching fields (D2 · D3) — two fields, not one notes area: the "watching
            for" line is what the field screen prints in bold at arm's length, and older plans
            read through a field-by-field fallback. The station's words, the drill library's
            words, the field screen's words; the stored keys stay `description` / `goal`. Absent
            on a block with exactly one station and no words of its own (D7) — the station's
            read-only text under Stations IS the block's teaching then. */}
        {showTeaching && (
          <>
            <label className={styles.ppField}>
              <FieldLabel>What you&apos;re doing</FieldLabel>
              <textarea className={styles.textarea} rows={2} value={block.description ?? ''} disabled={readOnly}
                maxLength={MAX_TEXT_LEN} placeholder="What happens, and how it's set up"
                onChange={e => onPatch({ description: e.target.value })} />
            </label>
            <label className={styles.ppField}>
              <FieldLabel>What you&apos;re watching for</FieldLabel>
              <input className={styles.input} value={block.goal ?? ''} disabled={readOnly} maxLength={MAX_TEXT_LEN}
                placeholder="What good looks like here" onChange={e => onPatch({ goal: e.target.value })} />
            </label>
          </>
        )}

        {/* ── What the block holds, in a fixed order (D1): Coaching points · Staff · Players ·
            Equipment · the rotation · Stations. A section renders when it has content or its door
            was opened this time; the doors for the rest wait at the foot. ── */}
        {showPoints && (
          <CoachingPointsField points={block.coachingPoints} readOnly={readOnly}
            onSet={next => onPatch({ coachingPoints: next })} {...pointsDoor} />
        )}

        {showStaff && (
          <div className={styles.ppField}>
            {/* The label draws its own quiet "×" (owner ask, 2026-09-15); the picker below
                prints no label of its own — the same "caller prints its own heading" shape the
                plan-level Equipment field already uses, which keeps the door state machine
                local to this one consumer instead of widening the shared picker's contract. */}
            <FieldLabel onRemove={staffDoor.onRemove} removeLabel={staffDoor.removeLabel}>Staff</FieldLabel>
            <PracticeTagPicker all={staffTags} ids={block.staffTagIds ?? []}
              legacyNames={block.staff} disabled={readOnly} onCreate={onCreateStaffTag}
              manage={staffManage} onManageChanged={onStaffTagsChanged}
              onChange={next => onPatch({ staffTagIds: next })}
              emptyHint="No staff yet — type a name to add your first one."
              /* A block that already carries a drill (its own card, own fields) can push this
                 door well down the sheet — opening it with no signal left the field off the
                 top of the screen (owner catch, 2026-09-15). Focusing it here scrolls it into
                 view for free, the same way Coaching points' autoFocus already does. */
              autoFocus={staffDoor.autoFocus} />
          </div>
        )}

        {/* People live at exactly ONE level. With stations, they belong to the stations (or to
            the rotation's groups) — so the block-level line disappears rather than offering a
            second answer nobody can reconcile. Every block that holds its own people SAYS who
            (D1, owner 2026-09-15): "Whole team" until names are chosen, never a number — names
            are what the sheet and the field screen print, and "how many are here" is
            attendance's question, answered on the field screen. */}
        {showPlayers && (
          <div className={styles.ppFieldRow}>
            <FieldLabel>Players</FieldLabel>
            {playerCount > 0 ? (
              <div className={styles.ppChipWrap}>
                {block.playerIds!.map(pid => <span key={pid} className={styles.ppChip}>{nameOf(pid)}</span>)}
                <PlayerPickerButton count={playerCount} readOnly={readOnly}
                  onOpen={() => onOpenPicker({ kind: 'block', blockId: block.id })} />
              </div>
            ) : (
              <div className={styles.ppWhoLine}>
                <b>Whole team</b>
                {!readOnly && (
                  <span className={styles.ppTlQuietAlt}>
                    {'\u00A0· '}
                    <button type="button" className={styles.ppTlQuietLink}
                      onClick={() => onOpenPicker({ kind: 'block', blockId: block.id })}>Choose players…</button>
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Kit lives at exactly ONE level — the activity's (D11), the same law as people: the
            block's while it has no stations, each station's once it has them. What is chosen
            here rises into the bag under "About this practice" and prints beside this block. */}
        {showKit && (
          <div className={styles.ppField}>
            <FieldLabel onRemove={equipmentDoor.onRemove} removeLabel={equipmentDoor.removeLabel}>Equipment</FieldLabel>
            <PracticeTagPicker all={equipmentTags} ids={block.equipmentTagIds ?? []}
              disabled={readOnly} onCreate={onCreateEquipmentTag}
              manage={equipmentManage} onManageChanged={onEquipmentTagsChanged}
              onChange={next => onPatch({ equipmentTagIds: next })}
              emptyHint="No equipment yet — type an item to add your first one."
              autoFocus={equipmentDoor.autoFocus} />
          </div>
        )}

        {isRotation && (
          <RotationPanel
            rotation={rotation}
            stations={block.stations}
            blockMinutes={block.duration.minutes ?? null}
            stationCount={stationCount}
            blockStartMs={blockStartMs}
            drawPool={drawPool}
            notReplied={notReplied}
            showNotReplied={showNotReplied}
            readOnly={readOnly}
            withoutPeople={withoutPeople}
            nameOf={nameOf}
            onSetRotation={patch => onPatch({ rotation: { ...rotation, ...patch } })}
            onOpenGroupPicker={groupId => onOpenPicker({ kind: 'group', blockId: block.id, groupId })}
          />
        )}

        {/* ⚠ Stage 3's drawing, behind stage 2's door: the section as it always was (its head with
            "Groups rotate between them" once there are two, and "+ Add a station" → the drill
            sheet), the station card untouched. The one question this stage sends there: does a
            block's SOLE station flatten into the block, or keep its card? */}
        {showStations && (
        <div className={styles.ppStations}>
          <div className={styles.ppStationsHead}>
            <FieldLabel>Stations</FieldLabel>
            {/* One toggle instead of two kinds of block. It only appears once there are two
                stations to move between — one station with groups queued behind it is a queue,
                not a rotation. Rotation is the DEFAULT because that is how the reference
                practice actually runs. */}
            {stationCount >= 2 && (
              <label className={styles.ppRestToggle}>
                <input type="checkbox" checked={isRotation} disabled={readOnly}
                  onChange={e => onPatch({ rotates: e.target.checked })} />
                <span>Groups rotate between them</span>
              </label>
            )}
            {/* ⚠ Adding a SECOND station is how a rotation gets made — the picker is therefore
                also the carousel builder, with no second kind of block anywhere in the model. */}
            {!readOnly && stations.length < MAX_STATIONS_PER_BLOCK && (
              <button type="button" className={styles.ppAddInline} onClick={() => onAddStation()}>
                <Plus size={13} aria-hidden /> Add a station
              </button>
            )}
          </div>
          {stations.map((station, i) => (
            <StationCard
              key={station.id}
              station={station}
              index={i}
              isRotation={isRotation}
              startingGroups={startingGroupsForStation(block.rotation, stationCount, i)}
              readOnly={readOnly}
              withoutPeople={withoutPeople}
              staffTags={staffTags} onCreateStaffTag={onCreateStaffTag}
              equipmentTags={equipmentTags} onCreateEquipmentTag={onCreateEquipmentTag}
              staffManage={staffManage} onStaffTagsChanged={onStaffTagsChanged}
              equipmentManage={equipmentManage} onEquipmentTagsChanged={onEquipmentTagsChanged}
              nameOf={nameOf}
              onPatch={patch => patchStation(station.id, patch)}
              onRemove={() => onPatch({ stations: stations.filter(s => s.id !== station.id) })}
              onOpenPicker={() => onOpenPicker({ kind: 'station', blockId: block.id, stationId: station.id })}
              onDetach={() => onDetachStation(station.id)}
              onSwapDrill={() => onSwapStation(station.id)}
              onPromote={() => onPromoteStation(station.id)}
            />
          ))}
        </div>
        )}

        {/* ── The doors, at the foot (D1) — one quiet line in the ghost row's voice, not a "+"
            beside each label, so the fields read as a document and the doors as its margin.
            Only what the block does not hold yet; a viewer who cannot write gets no doors. */}
        {!readOnly && doors.length > 0 && (
          <div className={styles.ppDoorsLine}>
            {doors.map((door, i) => (
              <span key={door.id} className={styles.ppTlQuietAlt}>
                {i > 0 ? '\u00A0· ' : ''}
                <button type="button" className={styles.ppTlQuietLink} onClick={() => onOpenDoor(door.id)}>
                  + {door.label}
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

// ── The editor ───────────────────────────────────────────────────────────────

interface Props {
  plan: PracticePlan;
  onChange: (next: PracticePlan) => void;
  roster: PracticeRosterPlayer[];
  /** Empty (and the rail hidden) when the caller lacks `notes` — the text never reaches them. */
  goals: PracticeFocusGoal[];
  canViewFocus: boolean;
  attendance: { playerId: string; status: RepAttendanceStatus }[];
  canViewAttendance: boolean;
  /**
   * The team's whole 'staff'/'equipment' vocabularies (mig 266) — owned by the page, exactly like
   * `focusTags` below. REPLACED the free-text suggestion lists (`staffSuggestions`/
   * `equipmentSuggestions`) this prop pair used to be: those were scraped from past plans' typed
   * words with no real backing list; these are the real, mintable library `PracticeTagPicker` reads.
   */
  staffTags?: PickableTag[];
  onCreateStaffTag?: (name: string) => Promise<PickableTag | null>;
  equipmentTags?: PickableTag[];
  onCreateEquipmentTag?: (name: string) => Promise<PickableTag | null>;
  /**
   * The manage door for each vocabulary (One Tag Idiom P3) + the page's library refreshes.
   * Direct-callback props, never object members — the react-hooks refs lint's event-handler rule.
   */
  staffManage?: TagManageConfig;
  onStaffTagsChanged?: () => void;
  equipmentManage?: TagManageConfig;
  onEquipmentTagsChanged?: () => void;
  focusManage?: TagManageConfig;
  onFocusTagsChanged?: () => void;
  /** This team's own drills PLUS the club's shared set, already merged by the API. */
  drills: RepTeamDrill[];
  /** Saves a promoted station to the library (D18). Absent for a viewer who can't write drills. */
  onCreateDrill?: (input: DrillInput) => Promise<{ ok: boolean; error?: string }>;
  /**
   * The team's whole 'focus' vocabulary — owned by the page, like `drills`, not fetched here.
   *
   * ⚠ Every tag the team has, NOT only those already on a drill. Deriving the picker's list from
   * what is on screen would hide vocabulary a focus area or a template already uses and quietly
   * invite the coach to mint a duplicate — the exact drift tags exist to prevent.
   */
  focusTags?: PickableTag[];
  onCreateFocusTag?: (name: string) => Promise<PickableTag | null>;
  /**
   * What THIS practice is about, in the team's shared vocabulary (Phase 3).
   *
   * ⚠ Not part of the plan's jsonb — a plan's tags are rows in `rep_team_event_tags`, told apart
   * from a game's tags by the tag's kind, so the page owns them and saves them separately.
   * Omitted entirely by the template room, whose tags live on the template row instead.
   */
  planTagIds?: string[];
  onChangePlanTags?: (next: string[]) => void;
  eventStartsAt: string;
  eventEndsAt: string | null;
  readOnly: boolean;
  /**
   * ⚠ Editing a TEMPLATE, not a practice: no roster, no staff, no groups, no "just for tonight".
   * The controls are ABSENT, not disabled — see the module header.
   */
  withoutPeople?: boolean;
  /**
   * "Start this plan from…" — the blank page's quiet alternative beside the first block (stage 1,
   * D5). The PAGE owns the picker; the editor only offers the door, and only while there is no
   * block: once a coach has written one, copying a template over it is no longer a start.
   */
  onStartFrom?: () => void;
}

export default function PracticePlanEditor({
  plan, onChange, roster, goals, canViewFocus, attendance, canViewAttendance,
  drills, onCreateDrill,
  focusTags = [], onCreateFocusTag, planTagIds, onChangePlanTags,
  staffTags = [], onCreateStaffTag, equipmentTags = [], onCreateEquipmentTag,
  staffManage, onStaffTagsChanged, equipmentManage, onEquipmentTagsChanged,
  focusManage, onFocusTagsChanged,
  eventStartsAt, eventEndsAt, readOnly, withoutPeople = false, onStartFrom,
}: Props) {
  const [attach, setAttach] = useState<AttachTarget | null>(null);
  /**
   * ONE block open at a time (stage 1, D2) — the rest read as rows. Nothing is open on arrival:
   * the page reads as the sheet, and the coach opens the block they are working on. A block the
   * coach just ADDED opens with its title focused (`freshId`); one they opened to read does not
   * grab the keyboard.
   */
  const [openId, setOpenId] = useState<string | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  /**
   * The doors standing open on the open block (stage 2, D1) — one open block, one set, reset in
   * the same place `openId` is set (`openBlock`), seeded with what the block already holds so a
   * field the coach empties stays on screen until the block closes. A door opened and left empty
   * is a door again on reload: the sanitiser stores no empty list, which is today's behaviour —
   * nothing is lost, and nothing here "fixes" it.
   */
  const [openDoors, setOpenDoors] = useState<ReadonlySet<BlockDoor>>(NO_DOORS);
  const openBlock = (block: PracticePlanBlock | null, fresh = false) => {
    setOpenId(block?.id ?? null);
    setFreshId(fresh && block ? block.id : null);
    setOpenDoors(block ? new Set(doorsHolding(block)) : NO_DOORS);
  };
  const openDoor = (door: BlockDoor) => setOpenDoors(prev => new Set([...prev, door]));
  /**
   * The other direction (owner ask, 2026-09-15): a door opened by mistake and left empty had no
   * way back except closing and reopening the whole block. This only ever removes UI state — the
   * door itself — never data: it is offered exactly where `blockHolds` already says the door has
   * nothing behind it, so there is nothing here for it to delete.
   */
  const closeDoor = (door: BlockDoor) => setOpenDoors(prev => {
    if (!prev.has(door)) return prev;
    const next = new Set(prev);
    next.delete(door);
    return next;
  });
  /**
   * The two folds' bodies are not rendered while shut: the rail is a roster's worth of rows and
   * chips, rebuilt on every keystroke otherwise for content nobody is looking at (the file's own
   * rule for its dialogs). Controlled state carries the disclosure (`FoldHead` — a toggle button
   * with the trash as a sibling), and whether to build what is inside. "About" is shut by default
   * (stage 1, D4); the rail is OPEN whenever it
   * renders — it is only on the sheet because the coach put it there (2026-09-14).
   */
  const [aboutOpen, setAboutOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  /**
   * Which drill sheet is open, and what it will do with the pick.
   *   · `{ kind: 'block' }`                → a new block whose single station is that drill
   *   · `{ kind: 'station', blockId }`     → another station on an existing block
   *   · `{ kind: 'station', …, swapId }`   → replace that station, keeping its position
   */
  const [drillSheet, setDrillSheet] = useState<
    | { kind: 'block' }
    | { kind: 'station'; blockId: string; swapId?: string }
    | null
  >(null);
  const [promoting, setPromoting] = useState<{ blockId: string; stationId: string } | null>(null);
  const [promoteBusy, setPromoteBusy] = useState(false);
  const [promoteError, setPromoteError] = useState('');
  // Register with the shared overlay stack: hides the mobile bottom nav while a sheet is up (so a
  // mis-tap can't land on a nav tab underneath it) and locks the page behind it.
  useOverlayOpen(!!attach || !!drillSheet || !!promoting);

  // Keyed on plan.blocks, NOT the whole plan: typing in "Tonight's goal" replaces the plan object
  // but changes no block, and re-running this would rebuild an Intl formatter per block per
  // keystroke. The rotation grid's round times come from the SAME walk (clock.startMs) rather
  // than a second hand-maintained copy of it — an earlier duplicate had already drifted on how
  // "rest of practice" advances the cursor. The walk also says where it stopped, which is the
  // "+ Add a block" row's gutter — when the next block would start.
  const walk = useMemo(
    () => walkBlockClocks(plan.blocks, eventStartsAt, eventEndsAt),
    [plan.blocks, eventStartsAt, eventEndsAt],
  );
  const clockByBlock = useMemo(() => new Map(walk.clocks.map(c => [c.blockId, c])), [walk]);
  const nextStartLabel = walk.nextStartLabel;

  /** Which block (if any) already claims "rest of practice" — D13 allows exactly one per plan. */
  const restBlockId = plan.blocks.find(b => b.duration.restOfPractice)?.id ?? null;

  const goalsByPlayer = useMemo(() => {
    const map = new Map<string, PracticeFocusGoal[]>();
    for (const g of goals) {
      if (g.status !== 'working') continue; // ACTIVE focus areas only — never achieved/parked
      const list = map.get(g.playerId) ?? [];
      list.push(g);
      map.set(g.playerId, list);
    }
    return map;
  }, [goals]);

  /**
   * What kind of practice this is — DERIVED from the drills in it (D16), unioned with whatever the
   * coach typed under "Kind of practice".
   *
   * Derived rather than asked, which is the whole reason the drill library came before the plan
   * library: a practice's type falls out of what is actually in it instead of being one more field
   * to fill in on a couch. The typed tags stay because a coach may plan a whole practice without
   * touching the library, and the rail must work for them too.
   */
  const { practiceCategories, derivedCategories } = useMemo(() => {
    // ONE walk of the blocks, producing both answers: the derived list the rail SHOWS, and the
    // lookup it MATCHES against (which also folds in the tags the coach put on the practice).
    const derived: string[] = [];
    const seen = new Map<string, string>();
    const add = (v: string | null | undefined, isDerived: boolean) => {
      const s = v?.trim();
      if (!s) return;
      const key = s.toLowerCase();
      if (seen.has(key)) return;
      seen.set(key, s);
      if (isDerived) derived.push(s);
    };
    for (const block of plan.blocks) for (const s of block.stations ?? []) for (const t of s.drillTags ?? []) add(t, true);
    // The practice's own tags — what the coach SAID it is about, on top of what the drills imply.
    for (const id of planTagIds ?? []) add(focusTags.find(t => t.id === id)?.name, false);
    // ⚠ The legacy free-text "kind of practice" (slice 1a). READ, never written and never migrated:
    // a plan typed before tags existed must keep matching the rail on the words it was given. The
    // control that wrote these is gone — there is now ONE way to say what a practice is about.
    for (const t of plan.practiceTypes ?? []) add(t, false);
    return { practiceCategories: seen, derivedCategories: derived };
  }, [plan.blocks, plan.practiceTypes, planTagIds, focusTags]);

  /**
   * Does this focus area match what tonight is about?
   *
   * ⚠ **DIM, NEVER HIDE** (owner ruling, confirming D16 and §4). This returns false only to soften
   * a chip — nothing anywhere removes a row. A player whose only focus areas are off-type must
   * never vanish from a coverage list, because that is precisely the child most likely to be
   * overlooked. And an UNTAGGED area always reads as relevant: the product does not know that it
   * isn't, so it must not imply that it isn't.
   */
  const focusMatches = (goal: PracticeFocusGoal): boolean => {
    if (practiceCategories.size === 0) return true; // nothing to filter against yet
    const c = goal.tagName?.trim().toLowerCase();
    if (!c) return true;
    return practiceCategories.has(c);
  };

  /**
   * A player's focus areas, clustered by category rather than laid out flat (owner-approved
   * mockup, 2026-09-15): tonight's own category(ies) print in full — the actual words, which are
   * the one thing worth reading — everything else collapses to a single quiet badge per category,
   * carrying the count and expandable on demand. STILL DIM, NEVER HIDE: a category with nothing
   * tonight loses none of its goals, it just stops being the thing printed in full. Order is each
   * category's first appearance in the player's own goals, matching `focusMatches`'s own rule that
   * nothing here is ever re-sorted by relevance.
   */
  const groupFocusGoals = (playerGoals: PracticeFocusGoal[]) => {
    // A Map already iterates in first-insertion order, which IS the order rule above — no
    // separate order array needed.
    const byKey = new Map<string, { label: string; goals: PracticeFocusGoal[]; led: boolean }>();
    for (const g of playerGoals) {
      const label = g.tagName?.trim() || 'General';
      const key = label.toLowerCase();
      let group = byKey.get(key);
      if (!group) {
        group = { label, goals: [], led: focusMatches(g) };
        byKey.set(key, group);
      }
      group.goals.push(g);
    }
    return [...byKey.values()];
  };

  const attendanceByPlayer = useMemo(
    () => new Map(attendance.map(a => [a.playerId, a.status])),
    [attendance],
  );
  const playerById = useMemo(() => new Map(roster.map(p => [p.id, p])), [roster]);
  const rosterOrder = useMemo(() => roster.map(p => p.id), [roster]);

  // Only players who replied yes enter a draw; the rest are named, never silently dropped (D21).
  // With no attendance visibility (or none taken yet) the draw uses the whole roster rather than
  // drawing from nobody.
  const repliedYes = useMemo(
    () => roster.filter(p => REPLIED_YES.includes(attendanceByPlayer.get(p.id) ?? 'unknown')),
    [roster, attendanceByPlayer],
  );
  const notReplied = useMemo(
    () => roster.filter(p => !REPLIED_YES.includes(attendanceByPlayer.get(p.id) ?? 'unknown')),
    [roster, attendanceByPlayer],
  );
  const attendanceKnown = canViewAttendance && repliedYes.length > 0;
  const drawPool = attendanceKnown ? repliedYes : roster;

  const nameOf = (playerId: string) => {
    const p = playerById.get(playerId);
    return p ? playerDisplayName(p) : 'Player';
  };

  /* Every change to the blocks goes through the same kit-settling pass the server runs (D11), so
     the coach SEES kit move the moment a station arrives — onto that station, or up into the
     practice's list — rather than watching it vanish until a reload (the save's response is not
     applied back to local state). One pass, two callers; the screen and the column agree. */
  const setBlocks = (blocks: PracticePlanBlock[]) => onChange(settleBlockKit({ ...plan, blocks }));
  const patchBlock = (blockId: string, patch: Partial<PracticePlanBlock>) =>
    setBlocks(plan.blocks.map(b => (b.id === blockId ? { ...b, ...patch } : b)));

  /**
   * ONE kind of block. Whether its stations rotate is a toggle inside it, not a decision the coach
   * has to make before they've typed anything — they rarely know yet, and rotation is the common
   * case anyway, so it defaults on the moment a second station appears.
   */
  function addBlock() {
    if (plan.blocks.length >= MAX_BLOCKS) return;
    const block: PracticePlanBlock = {
      id: newPracticePlanId(),
      title: '',
      duration: { minutes: DEFAULT_BLOCK_MINUTES },
    };
    setBlocks([...plan.blocks, block]);
    // The ghost row becomes the block: it opens in place, title ready to type into (stage 1, D5).
    openBlock(block, true);
  }


  /**
   * A picked drill becomes a BLOCK: the block takes the drill's name and usual length, and the
   * drill itself becomes that block's single station.
   *
   * ⚠ This is "a drill is one activity — one station's worth" made literal. With one station
   * `blockRotates` is false, so a single picked drill is simply a stretch of practice; adding a
   * second drill to the same block is what turns it into a carousel.
   */
  function addBlockFromDrill(drill: RepTeamDrill) {
    // A plan that filled up under the open sheet (another tab's autosave) closes it rather than
    // leaving a picker whose every pick does nothing.
    if (plan.blocks.length >= MAX_BLOCKS) { setDrillSheet(null); return; }
    const block: PracticePlanBlock = {
      id: newPracticePlanId(),
      title: drill.name,
      duration: { minutes: drill.usualMinutes ?? DEFAULT_BLOCK_MINUTES },
      stations: [drillToStation(drill, newPracticePlanId)],
    };
    setBlocks([...plan.blocks, block]);
    /* Lands SHUT (owner ask, 2026-09-15, revising the earlier "opens in place" call) — the sheet
       the coach just closed showed the drill's full teaching, setup and equipment a breath ago;
       reopening the same block here would only show it all again. The shut row's own "Watching
       for" line (above) is now enough of a receipt that it landed right. */
    openBlock(null);
    setDrillSheet(null);
  }

  /** Append a drill as another station — or replace one in place when swapping. */
  function addStationFromDrill(blockId: string, drill: RepTeamDrill, swapId?: string) {
    const block = plan.blocks.find(b => b.id === blockId);
    if (!block) return;
    const stations = block.stations ?? [];
    const fresh = drillToStation(drill, newPracticePlanId);
    if (swapId) {
      // ⚠ Keep the ORIGINAL station id. The rotation grid and every "who starts here" read key on
      // it, so minting a new one would silently detach the station from its own carousel position.
      patchBlock(blockId, { stations: stations.map(s => (s.id === swapId ? { ...fresh, id: s.id } : s)) });
    } else {
      if (stations.length >= MAX_STATIONS_PER_BLOCK) return;
      patchBlock(blockId, { stations: [...stations, fresh] });
    }
    setDrillSheet(null);
  }

  function addBlankStation(blockId: string, swapId?: string) {
    const block = plan.blocks.find(b => b.id === blockId);
    if (!block) return;
    const stations = block.stations ?? [];
    if (swapId) {
      // Swapping to "write one" detaches in place, keeping the words the coach can now edit.
      patchBlock(blockId, {
        stations: stations.map(s => (s.id === swapId ? detachStationFromDrill(s) : s)),
      });
    } else {
      if (stations.length >= MAX_STATIONS_PER_BLOCK) return;
      patchBlock(blockId, { stations: [...stations, { id: newPracticePlanId(), name: '' }] });
    }
    setDrillSheet(null);
  }

  /**
   * "Edit just for this practice" — keeps every word, drops the drill identity.
   *
   * The whole point of the read-only rule: a coach who changes a drill's words did not run that
   * drill, so the station stops counting toward its use count at the same moment it becomes
   * editable. No confirm — nothing is lost, and asking would make the honest path feel expensive.
   */
  function detachStation(blockId: string, stationId: string) {
    const block = plan.blocks.find(b => b.id === blockId);
    if (!block) return;
    patchBlock(blockId, {
      stations: (block.stations ?? []).map(s => (s.id === stationId ? detachStationFromDrill(s) : s)),
    });
  }

  async function promoteStation(tagIds: string[]) {
    if (!promoting || !onCreateDrill) return;
    const block = plan.blocks.find(b => b.id === promoting.blockId);
    const station = block?.stations?.find(s => s.id === promoting.stationId);
    if (!station) { setPromoting(null); return; }
    setPromoteBusy(true); setPromoteError('');
    // A drill's own equipment field is separate from mig 266's library (drills never adopted it —
    // see the plan doc's scope) and only reads the legacy string. Resolve current tag names onto
    // it first, or a station edited under the new picker would promote with equipment silently gone.
    const equipmentByIdForPromote = new Map(equipmentTags.map(t => [t.id, t.name]));
    const resolvedStation = station.equipmentTagIds?.length
      ? { ...station, equipment: station.equipmentTagIds.map(id => equipmentByIdForPromote.get(id)).filter((n): n is string => !!n) }
      : station;
    const result = await onCreateDrill(stationToDrillInput(resolvedStation, tagIds));
    setPromoteBusy(false);
    if (!result.ok) { setPromoteError(result.error ?? 'Could not save that drill.'); return; }
    // ⚠ Promotion COPIES. Tonight's station is deliberately left exactly as it is — it does not
    // become drill-backed and therefore does not become read-only under the coach's hands.
    setPromoting(null);
  }

  function moveBlock(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= plan.blocks.length) return;
    const next = plan.blocks.slice();
    [next[index], next[target]] = [next[target], next[index]];
    setBlocks(next);
  }

  function togglePlayer(target: AttachTarget, playerId: string) {
    const toggle = (ids: string[] = []) =>
      ids.includes(playerId) ? ids.filter(p => p !== playerId) : [...ids, playerId];
    // Stored in ROSTER ORDER, never tap order — so no list anywhere can imply a ranking (§4).
    const inRosterOrder = (ids: string[]) => rosterOrder.filter(pid => ids.includes(pid));
    const block = plan.blocks.find(b => b.id === target.blockId);
    if (!block) return;

    if (target.kind === 'block') {
      patchBlock(block.id, { playerIds: inRosterOrder(toggle(block.playerIds)) });
    } else if (target.kind === 'station') {
      patchBlock(block.id, {
        stations: (block.stations ?? []).map(s =>
          (s.id === target.stationId ? { ...s, playerIds: inRosterOrder(toggle(s.playerIds)) } : s)),
      });
    } else if (block.rotation) {
      // ⚠ A player belongs to exactly ONE group. Adding them here takes them OUT of any other
      // group in this rotation — otherwise one child stands at two stations in the same round,
      // and the grid renders both. (The server enforces the same rule on save.)
      const isAdding = !(block.rotation.groups.find(g => g.id === target.groupId)?.playerIds ?? []).includes(playerId);
      patchBlock(block.id, {
        rotation: {
          ...block.rotation,
          groupSource: 'manual', // hand-editing a drawn group makes it a chosen group
          groups: block.rotation.groups.map(g => {
            if (g.id === target.groupId) return { ...g, playerIds: inRosterOrder(toggle(g.playerIds)) };
            if (!isAdding) return g;
            return g.playerIds.includes(playerId)
              ? { ...g, playerIds: g.playerIds.filter(pid => pid !== playerId) }
              : g;
          }),
        },
      });
    }
  }

  function selectedIdsFor(target: AttachTarget): string[] {
    const block = plan.blocks.find(b => b.id === target.blockId);
    if (!block) return [];
    if (target.kind === 'block') return block.playerIds ?? [];
    if (target.kind === 'station') return block.stations?.find(s => s.id === target.stationId)?.playerIds ?? [];
    return block.rotation?.groups.find(g => g.id === target.groupId)?.playerIds ?? [];
  }

  /**
   * Does the thing this picker is assigning to still exist?
   *
   * Deleting the block, station or group while its picker is open would otherwise leave a
   * dead-end dialog: every tap silently does nothing, because there is nothing left to assign
   * to. Derived rather than cleared in each delete handler, so it holds for any future path
   * that removes a target — the modal simply closes itself, which is the right answer.
   */
  function attachTargetExists(target: AttachTarget): boolean {
    const block = plan.blocks.find(b => b.id === target.blockId);
    if (!block) return false;
    if (target.kind === 'block') return true;
    if (target.kind === 'station') return !!block.stations?.some(s => s.id === target.stationId);
    return !!block.rotation?.groups.some(g => g.id === target.groupId);
  }

  const pickerTarget = attach && attachTargetExists(attach) ? attach : null;
  const selectedIds = pickerTarget ? selectedIdsFor(pickerTarget) : [];
  /* The roster picker's dialog floor (stage 2, D9) — armed while it is open; Escape closes it
     and hands focus back to the "Choose players…" that opened it. ⚠ Escape never closes an open
     BLOCK: a row is not a sheet, and the floor is mounted on the sheets alone. */
  const pickerPanelRef = useRef<HTMLDivElement>(null);
  useDialogFloor(!!pickerTarget, pickerPanelRef, { onClose: () => setAttach(null) });

  /** For a GROUP picker: which other group each player is currently in, so choosing them reads as
   *  a move rather than a surprise. Empty for block/station pickers. */
  const otherGroupByPlayer = useMemo(() => {
    const map = new Map<string, string>();
    if (pickerTarget?.kind !== 'group') return map;
    const rotation = plan.blocks.find(b => b.id === pickerTarget.blockId)?.rotation;
    for (const g of rotation?.groups ?? []) {
      if (g.id === pickerTarget.groupId) continue;
      for (const pid of g.playerIds) map.set(pid, g.name);
    }
    return map;
  }, [pickerTarget, plan.blocks]);

  /* The BAG (stage 2, D11): the practice's equipment line is the union of the coach's own list and
     every block's and station's kit, derived at read time — `practiceKitBag`, the same walk the
     printed sheet's head uses. Keyed on the blocks, so a chip chosen on a block rises at once; the
     walk is a handful of id lookups. */
  const { practiceTypes, equipmentTagIds, equipment } = plan;
  const kitBag = useMemo(
    () => practiceKitBag({ version: plan.version, blocks: plan.blocks, equipmentTagIds, equipment }, equipmentTags),
    [plan.version, plan.blocks, equipmentTagIds, equipment, equipmentTags],
  );
  /* "About this practice" — the fold's HEAD line says what is inside it: the practice's tags
     (the same resolver the printed sheet uses, plus a pre-tags plan's legacy words), then the bag.
     When nothing is set yet the line is EMPTY — the "tags · equipment" placeholder went with the
     owner's 2026-09-14 pass; the fold's title says what it holds.
     ⚠ The description is NOT folded into this line — a paragraph still does not belong beside the
     title on a one-line head — but it is not hidden either (owner catch, 2026-09-15, after
     watching a written description vanish behind a closed fold): it prints as its OWN truncated
     line under the head, the same one-line-ellipsis treatment a closed practice block already
     gives its own note. See the description preview beside `ppAboutBody` below. */
  const aboutSummary = useMemo(() => {
    const tags = [...tagNamesById(planTagIds, focusTags), ...(practiceTypes ?? [])];
    return [tags.join(' · '), kitBag.all.join(', ')].filter(Boolean).join(' · ');
  }, [planTagIds, focusTags, practiceTypes, kitBag]);

  /* The rail's closed line — "1 of 12 has a focus area". Nobody is hidden by the fold: the count
     is the roster, and the word for zero is a sentence rather than a figure. */
  const railCountLine = useMemo(() => {
    const withFocus = roster.filter(p => (goalsByPlayer.get(p.id)?.length ?? 0) > 0).length;
    return roster.length === 0 ? 'no players on the roster yet'
      : withFocus === 0 ? 'nobody has a focus area yet'
        : `${withFocus} of ${roster.length} ${withFocus === 1 ? 'has' : 'have'} a focus area`;
  }, [roster, goalsByPlayer]);

  const firstBlock = plan.blocks.length === 0;
  /* "What everyone's working on" is an ADDITION to a plan, never a standing part of the sheet
     (owner ruling 2026-09-14, revising stage 1's D1/D6 shut fold): a team that never uses goals
     never sees a "nobody has a focus area yet" line on every practice. The flag is shape — a
     template carries it, and offers it — so the template room offers the addition without
     reading anyone's goals; the plan room offers it only to a coach who may read them. */
  const focusIncluded = plan.includeFocusAreas === true;
  const canOfferFocus = !readOnly && !focusIncluded && (withoutPeople || canViewFocus);
  // Open on arrival EVERY time it is added — `railOpen` outlives a remove, so a section shut,
  // removed and added again would otherwise come back shut (/review, 2026-09-14).
  const addFocus = () => { setRailOpen(true); onChange({ ...plan, includeFocusAreas: true }); };
  /* The ghost row's quiet alternatives: "start this plan from…" on the blank page only (D5); the
     drill library whenever the team has one (stage 4 rules where the library lives after this).
     ⚠ "What everyone's working on" USED TO live here too, and moved (owner catch, 2026-09-15): the
     other two alternatives fill in the block you are about to add: this one adds a whole-practice
     section that renders nowhere near that block, so bundling it here put the invitation and the
     thing it opens in two different places on the sheet. It now sits in its own row, where the
     section itself appears once added — see the quiet "+" beside the focus rail's spot below. */
  const ghostAlternatives = [
    firstBlock && onStartFrom ? { label: 'start this plan from…', onClick: onStartFrom } : null,
    drills.length > 0 ? { label: 'a drill from your library', onClick: () => setDrillSheet({ kind: 'block' }) } : null,
  ].filter((a): a is { label: string; onClick: () => void } => !!a);
  const removeFocus = () => {
    const next = { ...plan };
    delete next.includeFocusAreas;
    onChange(next);
  };

  return (
    <div className={styles.ppDocBody}>
      {/* ── The goal, one line above the timeline (stage 1, D4) ──
          The one thing worth saying about the whole practice, where the sheet prints it. A
          template's is "Goal:" — there is no tonight for it. */}
      <div className={styles.ppGoalLine}>
        <span className={styles.ppGoalKicker}>{withoutPeople ? 'Goal:' : 'Tonight:'}</span>
        {readOnly ? (
          <span className={plan.goal ? styles.ppGoalRead : styles.ppGoalNone}>{plan.goal || 'No goal written'}</span>
        ) : (
          <input className={styles.ppGoalInput} value={plan.goal ?? ''} maxLength={MAX_TEXT_LEN}
            placeholder="What the whole practice is for"
            aria-label={withoutPeople ? 'Goal' : "Tonight's goal"}
            onChange={e => onChange({ ...plan, goal: e.target.value })} />
        )}
      </div>

      {/* ── "About this practice" — tags and equipment, folded (stage 1, D4) ──
          Order and weight, not removal: the sheet prints both and the rail softens by tag, so they
          stay; they are simply no longer the first thing a coach is asked before writing a minute. */}
      <div className={styles.ppAbout}>
        <FoldHead title="About this practice" summary={aboutSummary || undefined} summaryClassName={styles.ppAboutSummary}
          open={aboutOpen} onToggle={() => setAboutOpen(o => !o)} />
        {/* Closed, the fold still reads like a closed BLOCK (owner catch, 2026-09-15): a written
            description does not disappear just because the fold is shut, it truncates to one line
            the same way a block's own note does when its row is closed. */}
        {!aboutOpen && plan.description && (
          <p className={styles.ppAboutPreview}>{plan.description}</p>
        )}
        {aboutOpen && <div className={styles.ppAboutBody}>
          {/* The paragraph under the goal's headline (owner ask 2026-09-14): what the practice is,
              in the coach's own words. Shape — a template keeps it, the sheet prints it. */}
          <div className={styles.ppFieldRow}>
            <FieldLabel>Description</FieldLabel>
            {readOnly ? (
              <p className={plan.description ? styles.ppAboutRead : styles.ppAboutNone}>{plan.description || 'No description written'}</p>
            ) : (
              <textarea className={styles.textarea} rows={3} value={plan.description ?? ''}
                maxLength={MAX_DESCRIPTION_LEN} aria-label="Description"
                placeholder={withoutPeople ? 'What this template is, and when to reach for it' : "What tonight's practice is, in your own words"}
                onChange={e => onChange({ ...plan, description: e.target.value })} />
            )}
          </div>
          {/**
           * ⚠ **What this practice is about — TAGS, replacing slice 1a's free-text "Kind of
           * practice"** (owner ruling 2026-08-01: categories became tags).
           *
           * The free-text version was a SECOND vocabulary sitting beside the one the drills and
           * the focus areas already share, so "Hitting" typed here could never match "Hitting"
           * chosen there. These are the same tags, which is exactly what makes the focus rail
           * below soften truthfully and what makes "show me every hitting practice I've run"
           * answerable at all.
           *
           * Absent in the template room, whose tags live on the template row: asking the same
           * question in two places is how the two answers start disagreeing.
           */}
          {onChangePlanTags && (
            <>
              <TagPicker
                label="What this practice is about"
                all={focusTags}
                selected={planTagIds ?? []}
                onChange={onChangePlanTags}
                onCreate={readOnly ? undefined : onCreateFocusTag}
                // The same quiet manage door Equipment carries below — two tag groups, one grammar.
                manage={focusManage} onManageChanged={onFocusTagsChanged}
                disabled={readOnly}
                emptyHint="No tags yet — type a word to make your first one."
              />
              {/* ⚠ Read-only, and only on a plan written before tags existed. Never editable and
                  never migrated: the coach's old words keep matching the rail, and there is
                  exactly ONE control for saying what a practice is about. */}
              {(plan.practiceTypes?.length ?? 0) > 0 && (
                <div className={styles.ppFieldRow}>
                  <FieldLabel>Also tagged</FieldLabel>
                  <div className={styles.ppChipWrap}>
                    {plan.practiceTypes!.map(t => <span key={t} className={styles.ppChip}>{t}</span>)}
                  </div>
                </div>
              )}
            </>
          )}
          {/* The bag's derived half, said where the coach is looking (D11): what rose from the
              blocks and stations below is shown here and removed THERE — the picker under it holds
              only the extras that belong to no block, the rule the practice's tags already follow
              ("from the drills in this practice"). Both live under ONE "Equipment" heading (owner
              catch, 2026-09-15) — the derived line used to float between the tags above and the
              picker below with no heading of its own, reading as a trailing note on "What this
              practice is about" rather than the start of Equipment. */}
          <div className={styles.ppField}>
            <FieldLabel>Equipment</FieldLabel>
            {kitBag.fromBlocks.length > 0 && (
              <p className={styles.ppRailDerived}>
                {kitBag.fromBlocks.join(' · ')} <span>— from the blocks below</span>
              </p>
            )}
            <PracticeTagPicker all={equipmentTags} ids={plan.equipmentTagIds ?? []}
              legacyNames={plan.equipment} disabled={readOnly} onCreate={onCreateEquipmentTag}
              manage={equipmentManage} onManageChanged={onEquipmentTagsChanged}
              onChange={next => onChange({ ...plan, equipmentTagIds: next })}
              emptyHint={kitBag.fromBlocks.length > 0
                ? 'Anything else to bring that belongs to no block — water, the first-aid kit.'
                : 'No equipment yet — type an item to add your first one.'} />
          </div>
        </div>}
      </div>

      {/* ── The timeline (stage 1, D2 · D5) ──
          A gutter of start times down the left, blocks as rows beside it, and after the last one
          the ghost row: the page's ONE lime while the plan is blank ("+ Add the first block"),
          a quiet "+ Add a block" after that. */}
      <div className={styles.ppTl}>
        {plan.blocks.map((block, i) => (
          <BlockCard
            key={block.id}
            block={block}
            index={i}
            blockCount={plan.blocks.length}
            clock={clockByBlock.get(block.id)}
            // From the SAME clock walk as the gutter — never a second copy of the arithmetic.
            blockStartMs={clockByBlock.get(block.id)?.startMs}
            open={openId === block.id}
            focusTitle={freshId === block.id}
            openDoors={openId === block.id ? openDoors : NO_DOORS}
            readOnly={readOnly}
            withoutPeople={withoutPeople}
            restTakenElsewhere={restBlockId != null && restBlockId !== block.id}
            drawPool={drawPool}
            notReplied={notReplied}
            showNotReplied={attendanceKnown}
            staffTags={staffTags} onCreateStaffTag={onCreateStaffTag}
            equipmentTags={equipmentTags} onCreateEquipmentTag={onCreateEquipmentTag}
            staffManage={staffManage} onStaffTagsChanged={onStaffTagsChanged}
            equipmentManage={equipmentManage} onEquipmentTagsChanged={onEquipmentTagsChanged}
            nameOf={nameOf}
            onOpen={() => openBlock(block)}
            onClose={() => openBlock(null)}
            onOpenDoor={openDoor}
            onCloseDoor={closeDoor}
            onMove={delta => moveBlock(i, delta)}
            onDelete={() => setBlocks(plan.blocks.filter(b => b.id !== block.id))}
            onPatch={patch => patchBlock(block.id, patch)}
            onOpenPicker={setAttach}
            onAddStation={swapId => setDrillSheet({ kind: 'station', blockId: block.id, swapId })}
            onDetachStation={stationId => detachStation(block.id, stationId)}
            onSwapStation={stationId => setDrillSheet({ kind: 'station', blockId: block.id, swapId: stationId })}
            onPromoteStation={stationId => {
              setPromoteError('');
              setPromoting({ blockId: block.id, stationId });
            }}
          />
        ))}

        {!readOnly && plan.blocks.length < MAX_BLOCKS && (
          <div className={styles.ppTlRow}>
            <div className={styles.ppTlGutter}>
              {nextStartLabel ?? ''}
              {nextStartLabel && <small>{firstBlock ? 'start' : 'next'}</small>}
            </div>
            <div className={styles.ppTlGhost}>
              {/* The ghost row IS the next block: pressing it writes one at the time in the gutter,
                  open in place, its title ready to type. The lime rule — one earned action per
                  screen — is why the first block is lime and every later one is not. */}
              <button type="button" className={firstBlock ? styles.btnPrimary : styles.btnSecondary} onClick={addBlock}>
                <Plus size={14} aria-hidden /> {firstBlock ? 'Add the first block' : 'Add a block'}
              </button>
              <span className={styles.ppTlQuiet}>
                {DEFAULT_BLOCK_MINUTES} min
                {ghostAlternatives.map((alt, i) => (
                  <span key={alt.label} className={styles.ppTlQuietAlt}>
                    {/* A no-break space leads the separator: the span is an inline-block (so the
                        phrase wraps as a unit) and an ordinary leading space would collapse. */}
                    {'\u00A0· '}{i === 0 ? 'or ' : ''}
                    <button type="button" className={styles.ppTlQuietLink} onClick={alt.onClick}>{alt.label}</button>
                  </span>
                ))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── The focus rail, an ADDITION to the plan (owner ruling 2026-09-14) ──
          On the sheet only once the coach put it there (the ghost row's quiet link), open on
          arrival, collapsible, with one quiet way off again. In the template room it is a stub —
          a template carries the shape, and the people belong to the practice. On a plan it is the
          same rail as ever — roster ORDER, always, no sort control, ever; focus areas quoted
          verbatim from the shipped development records, never recomputed, never scored, never
          re-ordered, and no per-player figure ever rendered beside another child's. A coach who
          may not read goals sees nothing here even when the plan carries the section. */}
      {/* The invitation sits exactly where the section it adds will render (owner catch,
          2026-09-15) — not bundled into the block ghost row above, which is about filling in the
          block you're adding, not about a whole-practice section that lives down here. */}
      {canOfferFocus && (
        <div className={styles.ppFold}>
          {/* The exact size and spacing of the fold header it becomes on click (owner catch,
              2026-09-15) — same classes FoldHead itself renders, a "+" standing in for the
              chevron a real toggle would carry. The quiet-link size used to sit here read as a
              different, bigger control than the row it turns into a breath later. */}
          <div className={styles.ppFoldHead}>
            <button type="button" className={styles.ppFoldToggle} onClick={addFocus}>
              <Plus size={14} aria-hidden className={styles.ppFoldChevron} />
              <span className={styles.ppFoldTitle}>What everyone&apos;s working on</span>
            </button>
          </div>
        </div>
      )}
      {focusIncluded && withoutPeople && (
        <div className={styles.ppFold}>
          <FoldHead title="What everyone's working on"
            summary="· plans started from this template list everyone's focus areas"
            onRemove={readOnly ? undefined : removeFocus}
            removeLabel="Remove What everyone's working on from this template" />
        </div>
      )}
      {focusIncluded && !withoutPeople && canViewFocus && (
        <div className={styles.ppFold}>
          <FoldHead title="What everyone's working on" summary={`· ${railCountLine}`}
            open={railOpen} onToggle={() => setRailOpen(o => !o)}
            onRemove={readOnly ? undefined : removeFocus}
            removeLabel="Remove What everyone's working on from this plan" />
          {railOpen && <div className={styles.ppFoldBody} aria-label="Focus areas">
            {/* The derived line, so it is obvious WHY some categories lead — and obvious that
                the answer came from the practice rather than from a judgement about a child. */}
            {derivedCategories.length > 0 && (
              <p className={styles.ppRailDerived}>
                Tonight: {derivedCategories.join(' · ')} <span>— from the drills in this practice</span>
              </p>
            )}
            {roster.length === 0 ? (
              <p className={styles.formHint}>No players on the roster yet.</p>
            ) : (
              <ul className={styles.ppRailList}>
                {/* ⚠ ROSTER ORDER, every player, always. No sort control, no reordering by
                    relevance, and nothing is filtered OUT — the only thing tonight's categories
                    change is which category prints in full versus collapses to a count. */}
                {roster.map(player => {
                  const playerGoals = goalsByPlayer.get(player.id) ?? [];
                  const groups = groupFocusGoals(playerGoals);
                  const led = groups.filter(g => g.led);
                  const rest = groups.filter(g => !g.led);
                  return (
                    <li key={player.id} className={styles.ppRailRow}>
                      <span className={styles.ppRailName}>{playerDisplayName(player)}</span>
                      {playerGoals.length === 0 ? (
                        <span className={styles.ppRailNone}>Nothing set yet</span>
                      ) : (
                        <span className={styles.ppRailClusters}>
                          {led.map(group => (
                            <span key={group.label} className={styles.ppRailLed}>
                              <span className={styles.ppRailLedCat}>{group.label}</span>
                              <ul className={styles.ppRailLedList}>
                                {group.goals.map(g => <li key={g.id}>{g.focusArea}</li>)}
                              </ul>
                            </span>
                          ))}
                          {rest.length > 0 && (
                            <span className={styles.ppRailRestRow}>
                              {/* A category with nothing tonight still shows — as a count, not the
                                  written-out sentences (DIM, NEVER HIDE, carried down to the
                                  category level). Native disclosure: tap to read the words. */}
                              {rest.map(group => (
                                <details key={group.label} className={styles.ppRailBadge}>
                                  <summary>{group.label} · {group.goals.length}</summary>
                                  <ul>
                                    {group.goals.map(g => <li key={g.id}>{g.focusArea}</li>)}
                                  </ul>
                                </details>
                              ))}
                            </span>
                          )}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>}
        </div>
      )}

      {/* ── The roster picker — roster order, attendance as context. A player's focus areas
          used to print under the name here (D27, 2026-08); the owner removed them 2026-09-15:
          choosing who is at a block is a roster question, and one player's line under twelve
          names read as a stray note. The rail under the plan is where focus areas are read. ── */}
      {pickerTarget && (
        <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) setAttach(null); }}>
          <div ref={pickerPanelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Choose players"
            className={`${styles.modal} ${styles.modalScrollBody}`}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Choose players</h3>
              <button type="button" className={styles.modalCloseBtn} aria-label="Close" onClick={() => setAttach(null)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.ppPickList}>
              {roster.length === 0 && <p className={styles.formHint}>No players on the roster yet.</p>}
              {roster.map(player => {
                const selected = selectedIds.includes(player.id);
                const status = attendanceByPlayer.get(player.id);
                return (
                  <button key={player.id} type="button" className={styles.ppPickRow} aria-pressed={selected}
                    onClick={() => togglePlayer(pickerTarget, player.id)}>
                    <span className={styles.ppPickCheck} data-on={selected ? 'on' : undefined} aria-hidden />
                    <span className={styles.ppPickBody}>
                      <span className={styles.ppPickName}>
                        {playerDisplayName(player)}
                        {canViewAttendance && status && status !== 'unknown' && (
                          <span className={styles.ppPickStatus}>
                            {status === 'attending' ? 'In' : status === 'late' ? 'Late' : 'Out'}
                          </span>
                        )}
                        {otherGroupByPlayer.has(player.id) && (
                          <span className={styles.ppPickStatus}>in {otherGroupByPlayer.get(player.id)}</span>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className={styles.modalFooter}>
              {/* The way BACK to "Whole team" (owner, 2026-09-15): the block's line returns to
                  that word when every name is cleared, and unticking twelve names one at a time
                  was the only way to clear them. One press, the picker closes on the answer.
                  A block's picker only — a station or a group has no "whole team" to return to. */}
              {pickerTarget.kind === 'block' && selectedIds.length > 0 && (
                <button type="button" className={styles.btnGhost}
                  onClick={() => { patchBlock(pickerTarget.blockId, { playerIds: [] }); setAttach(null); }}>
                  Whole team
                </button>
              )}
              <button type="button" className={styles.btnPrimary} onClick={() => setAttach(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ── The drill picker (Phase 2) ── */}
      {drillSheet && (
        <DrillPickerSheet
          drills={drills}
          title={
            drillSheet.kind === 'block' ? 'Add a block'
              : drillSheet.swapId ? 'Swap this drill'
                : 'Add a station'
          }
          writeLabel={
            drillSheet.kind === 'block' ? 'Write a block'
              : drillSheet.swapId ? 'Write this one myself'
                : 'Write a station'
          }
          onPick={drill => {
            if (drillSheet.kind === 'block') addBlockFromDrill(drill);
            else addStationFromDrill(drillSheet.blockId, drill, drillSheet.swapId);
          }}
          onWriteOne={() => {
            if (drillSheet.kind === 'block') { addBlock(); setDrillSheet(null); }
            else addBlankStation(drillSheet.blockId, drillSheet.swapId);
          }}
          onClose={() => setDrillSheet(null)}
        />
      )}

      {/* ── "Save to my drills…" (D18) ── */}
      {promoting && (() => {
        const station = plan.blocks
          .find(b => b.id === promoting.blockId)?.stations
          ?.find(s => s.id === promoting.stationId);
        // Deleting the station while its dialog is open would otherwise leave a dead end — the
        // same self-closing rule `attachTargetExists` applies to the roster picker.
        if (!station) return null;
        return (
          <PromoteDrillDialog
            stationName={station.name}
            tags={focusTags}
            onCreateTag={onCreateFocusTag ?? (async () => null)}
            manage={focusManage} onManageChanged={onFocusTagsChanged}
            busy={promoteBusy}
            error={promoteError}
            onSave={promoteStation}
            onClose={() => setPromoting(null)}
          />
        );
      })()}
    </div>
  );
}
