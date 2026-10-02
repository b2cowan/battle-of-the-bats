'use client';
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core';
import {
  ArrowLeft, Check, ChevronLeft, ChevronRight, ChevronUp, GripVertical, Library, Pencil, Plus, Repeat, Trash2, Users, X,
} from 'lucide-react';
import {
  MAX_BLOCKS, MAX_COACHING_POINTS, MAX_DESCRIPTION_LEN, MAX_GROUPS, MAX_MINUTES, MAX_SHORT_TEXT_LEN,
  MAX_STATIONS_PER_BLOCK, MAX_TEXT_LEN, MAX_TITLE_LEN,
  arrangeGroup, blockAsksForTeaching, blockOwnGroupingId, blockRotates, collapseSoleStation, computeRotation, copyGrouping,
  defaultIntervalMinutes, dropEmptyStations,
  describeRounds, describeSplit, forgetArrangement, formatDuration, groupNames, groupingById, groupingShape, groupingUses,
  groupingWords, isPairSet, newGrouping, newPracticePlanId, nextGroupingName, practiceKitBag,
  resolveStationTeaching, mergedTagNames, rotationByStation, settlePlanLevels, splitBlockIntoStations, stationLabel,
  soleStationOf, stationIsEmpty, stationWalk, blockWalk, tagNamesById, unplacedInSet, walkBlockClocks,
  type BlockClock, type GroupingElsewhere, type GroupingUse, type PracticeGrouping, type PracticePlan, type PracticePlanBlock,
  type PracticeRotation, type PracticeStation,
} from '@/lib/rep-practice-plan';
import PracticeGroupsRoom, { type DrawChoice } from '@/components/coaches/PracticeGroupsRoom';
import { CoachToolbarMenu, CoachToolbarMenuHeading, CoachToolbarMenuItem, CoachToolbarMenuSeparator } from '@/components/coaches/CoachToolbarMenu';
import {
  MAX_DRILLS_PER_TEAM, MAX_DRILL_NAME_LEN,
  blockToDrillInput, detachStationFromDrill, drillToStation, emptyDrillDraft, filterTagged, libraryLimitLine, libraryNameMatch,
  refreshBlockFromDrill, refreshStationFromDrill, sortDrillsForPicker, stationToDrillInput,
  type DrillInput, type DrillReach, type RepTeamDrill,
} from '@/lib/rep-drills';
import {
  MAX_CIRCUITS_PER_TEAM, MAX_CIRCUIT_NAME_LEN,
  circuitToBlock, pointStationsAtDrills, tickRowsFor, fromDrillsLine, blockToCircuitShape,
  type CircuitInput, type RepTeamCircuit, type TickRow,
} from '@/lib/rep-circuits';
import SaveOverQuestion, { SaveOverMatchLine } from '@/components/coaches/SaveOverQuestion';
import { useBackStep } from '@/components/coaches/useBackStep';
import TagPicker, { type PickablePerson, type PickableTag } from '@/components/coaches/TagPicker';
import PracticeTagPicker from '@/components/coaches/PracticeTagPicker';
import type { TagManageConfig } from '@/components/coaches/TagSearchCombobox';
import {
  CoachingPointsField, FieldLabel, OPEN_DOOR, ReadChips, ReadField, TeachingFacts, TeachingFields, type TeachingDoor,
} from '@/components/coaches/PracticeFields';
import {
  LibraryList, LibraryCard, LibraryFilterBar, drillCardFacts, circuitCardFacts, drillCardLine, circuitCardLine,
  DrillPreviewBody, CircuitPreviewBody,
} from '@/components/coaches/LibraryRow';
import DrillSheet from '@/components/coaches/DrillSheet';
import CoachScrollX from '@/components/coaches/CoachScrollX';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { RoomWalkNav, type RoomNav } from '@/components/coaches/RoomShell';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { formatInOrgZone } from '@/lib/timezone';
import { playerDisplayName } from '@/lib/coach-roster-name';
import { useDialogFloor } from '@/components/coaches/useDialogFloor';
import { practiceStarted } from '@/lib/practice-state';
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
 *  • **Buttons everywhere; drag as an addition on desktop, with a mouse — never the only way.**
 *    (Practices re-evaluation stage 4, owner ruling L2, 2026-09-16 — the rule reworded once for the
 *    groups room, the rotation grid and the library. It was "reorder with buttons, never drag":
 *    gloves and phones defeat drag, and they still do — on touch nothing lifts, the ▲▼ pair and
 *    the sheets stay. A plan is written at a desk; the field and the phone keep their buttons.)
 *
 * ⚠ **ONE editor, three callers** (Phase 3; stage 4). The practice page passes a roster; the
 * plan-template room passes `withoutPeople`, because a template carries the shape and the teaching
 * and the practice supplies the people; the circuit editor passes `soloBlock` too — the block
 * alone on a sheet, no clock, no people. Building a second editor for either would have split the
 * behaviour of every block, station, rotation and drill-picker control in two — which is why
 * frame 03's "New template at zero" ruling was the biggest reuse decision in Phase 3.
 *
 * ⚠ `withoutPeople` REMOVES the people controls; it never disables them. A control that exists
 * only to refuse should not exist.
 *
 * ── Drag (stage 4, L2) — ONE `DndContext` over the sheet and the docked library panel ──
 *  · A drill row from the panel lifts (mouse only, after six pixels). Its targets: the GAPS
 *    between rows and under the last one (a new block at that index — titled by the drill, its
 *    usual minutes or 15, shut), and the OPEN block's station door ("+ Add a station" on a circuit,
 *    "+ Stations" on a block with none or one) — the drop follows D13 exactly as the sheet's pick
 *    does. A filled column is never a target (no silent swap); a shut block is never a target.
 *  · A circuit row lifts the same way and lands in a GAP only — a circuit is a block, never a
 *    station of one.
 *  · A block lifts by its GUTTER (the clock cell is the handle; the ▲▼ pair stays) and lands in a
 *    gap. The plan changes on the DROP and never on hover; a drop anywhere that is not a target
 *    snaps back and changes nothing (`pointerWithin` — the target is what the pointer is over).
 *  · A station lifts by its GRIP (2026-09-24 — the block's grip one level down) and lands in a slot
 *    between its own block's columns; a block gap never takes it, and it never leaves its block.
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

/* The roster picker's two targets. A GROUP is no longer one of them (stage 3 revision, D10,
   2026-09-16): a group's people are arranged in the groups room, where a chip MOVES between
   columns — the checklist was four steps for a job that is one move. */
type AttachTarget =
  | { kind: 'block'; blockId: string }
  | { kind: 'station'; blockId: string; stationId: string };


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
 *
 * ⚠ WITH EXACTLY ONE STATION, THE STATION IS THE BLOCK (stage 3, owner ruling D1, 2026-09-15): the
 * "Stations" head and the numbered card are gone, and the station's own lines read as the block's
 * — so the doors `points` · `equipment` · `setup` (a WRITTEN sole station's), `staff` (the sole
 * station's who-runs-it, unless the block already holds its own) and `note` (its "Just for
 * tonight") open the STATION's fields. `stations` is the door to a second station (the drill
 * sheet directly — there is no section head left to open).
 */
type BlockDoor = 'teaching' | 'points' | 'staff' | 'equipment' | 'setup' | 'note' | 'stations';
const NO_DOORS: ReadonlySet<BlockDoor> = new Set();
/** The word each closable door's "×" names — "Remove Coaching points". */
const DOOR_LABELS: Record<Exclude<BlockDoor, 'teaching' | 'stations'>, string> = {
  points: 'Coaching points', staff: 'Staff', equipment: 'Equipment', setup: 'Setup', note: 'Just for tonight',
};
/** The doors that mean a DIFFERENT field once a block has exactly one station (D1) — re-seeded when
 *  its station count changes; the rest keep the coach's own open/shut. */
const SHAPE_DEPENDENT_DOORS: ReadonlySet<BlockDoor> = new Set(['points', 'setup', 'equipment', 'staff']);

/** …and that station when the coach WROTE it — its fields are editable lines of the block; a
 *  drill-backed sole station's words are read-only text and hold nothing to open. */
const soleWrittenStationOf = (block: Pick<PracticePlanBlock, 'stations'>): PracticeStation | null => {
  const sole = soleStationOf(block);
  return sole && !sole.drillId ? sole : null;
};
const hasStaff = (o: Pick<PracticeStation, 'staffTagIds' | 'staff'>) => !!(o.staffTagIds?.length || o.staff?.length);
// By CONTENT, as the teaching predicate reads it — a stray space is not a point (/review, 2026-09-15).
const hasPoints = (points?: string[]) => !!points?.some(p => p.trim());

/**
 * What a block HOLDS behind each door — the one answer both readers share: the editor seeds the
 * open set from it when a block opens (so removing the last chip or the last line never makes
 * the field vanish under the coach's hands), and the open body reads it to decide what shows.
 * Read THROUGH a sole station where the door is the station's (see `BlockDoor`).
 */
function blockHolds(block: PracticePlanBlock): Record<BlockDoor, boolean> {
  const sole = soleStationOf(block);
  const written = soleWrittenStationOf(block);
  return {
    teaching: blockAsksForTeaching(block),
    points: sole ? hasPoints(written?.coachingPoints) : hasPoints(block.coachingPoints),
    staff: hasStaff(block) || (!!sole && hasStaff(sole)),
    equipment: sole ? !!(written?.equipmentTagIds?.length || written?.equipment?.length) : !!block.equipmentTagIds?.length,
    setup: !!written?.setup?.trim(),
    note: !!sole?.note?.trim(),
    stations: !!block.stations?.length,
  };
}
const doorsHolding = (block: PracticePlanBlock): BlockDoor[] =>
  (Object.entries(blockHolds(block)) as [BlockDoor, boolean][]).filter(([, held]) => held).map(([door]) => door);

// ── Small shared controls (module level — see the header note) ────────────────

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

/** The roster door beside a Players line. ABSENT in read mode (stage 6, R2) — the chips or
 *  "Whole team" beside it already say who, and a disabled button says only "not for you". */
function PlayerPickerButton({
  count, readOnly, onOpen,
}: { count: number; readOnly: boolean; onOpen: () => void }) {
  if (readOnly) return null;
  return (
    <button type="button" className={styles.ppPickBtn} onClick={onOpen}>
      <Users size={13} aria-hidden />
      {count > 0 ? `${count} player${count === 1 ? '' : 's'}` : 'Choose players'}
    </button>
  );
}

// ── Station ──────────────────────────────────────────────────────────────────

/*
 * The DRILL half of a station renders as TEXT rather than as disabled inputs — `TeachingFacts`
 * from the shared module (it was this file's `DrillFacts` until stage 6 made the same face the
 * READ mode of every field, 2026-09-18).
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

/** The optional fields a station offers behind a door when it is flattened into its block (D1). */
type StationDoor = 'points' | 'setup' | 'equipment' | 'staff' | 'note';
/** One answer per optional station field — the shared module's own door shape (`TeachingDoor`:
 *  whether it is on screen, and its label's quiet × / autofocus), so the station's five and the
 *  block's own doors read one type. */
type DoorProps = Omit<TeachingDoor, 'show'>;

/**
 * A station's FIELDS — the one body both places a station is edited share (practices re-evaluation
 * stage 3, owner rulings D1 · D4 · D7, 2026-09-15): the station modal, where every field is simply
 * shown (a modal has its own room), and the block itself when the station is its ONLY one, where
 * the fields read as the block's own lines and follow the block's door idiom (`doors`: a field
 * with content is always shown; an empty one waits at the foot). One order for both, so a coach
 * who learns the modal knows the flattened block — WHO, THEN WHAT (owner, 2026-09-20): staff ·
 * players · what you're doing · watching for · coaching points · setup · equipment · just for
 * tonight · save to my drills. The practice's half first because it is the half the coach fills
 * at 9pm (the drill's words are usually already written, and locked on a drill-backed station),
 * and because the printed sheet and the field screen already read a station that way — the
 * staff · players line under the name, the words below. Staff had sat sixth, under the modal's
 * fold, behind three multi-line boxes it is filled more often than.
 *
 * Two DIFFERENT kinds of not-editable, deliberately never conflated:
 *   readOnly  → this viewer may not write the plan at all (an assistant).
 *   fromDrill → the drill's own words are locked because it is still that drill (D20).
 * They never compose: the drill half is rendered as TEXT when `fromDrill`, so the editable branch
 * is reached only when it is false and `readOnly` is the whole answer there.
 *
 * ⚠ "Rotation note" is gone (D4): it was the answer for a block that does not rotate, and tonight's
 * note already holds it. The stored key stays readable; nothing migrates.
 */
function StationFields({
  station, block, sole, isRotation, readOnly, withoutPeople, doors, sets, roster, notRepliedIds,
  staffTags, onCreateStaffTag, staffPeople, onPickStaffPerson, equipmentTags, onCreateEquipmentTag,
  staffManage, onStaffTagsChanged, equipmentManage, onEquipmentTagsChanged,
  nameOf, onPatch, onOpenPicker, onDetach, onSwapDrill, onPromote,
}: {
  station: PracticeStation;
  block: PracticePlanBlock;
  /** Flattened into the block — the block's ONLY station (D1). */
  sole: boolean;
  isRotation: boolean;
  readOnly: boolean;
  /** A TEMPLATE has no roster and no staff — the practice supplies both. See the module header. */
  withoutPeople: boolean;
  /** Tonight's sets and their doors (G1–G8) — a station that does not rotate splits as a block does. */
  sets: SetsWiring;
  roster: PracticeRosterPlayer[];
  notRepliedIds: ReadonlySet<string>;
  /** The block's door idiom when flattened: which optional fields are on screen, and each label's
   *  quiet × / autofocus. Absent in the modal, where every field shows. */
  doors?: (door: StationDoor) => TeachingDoor;
  staffTags: PickableTag[];
  onCreateStaffTag?: (name: string) => Promise<PickableTag | null>;
  /** The staff picker's "People on this team" group (mig 303) — absent on a read-only surface. */
  staffPeople?: readonly PickablePerson[];
  onPickStaffPerson?: (person: PickablePerson) => Promise<PickableTag | null>;
  equipmentTags: PickableTag[];
  onCreateEquipmentTag?: (name: string) => Promise<PickableTag | null>;
  staffManage?: TagManageConfig;
  onStaffTagsChanged?: () => void;
  equipmentManage?: TagManageConfig;
  onEquipmentTagsChanged?: () => void;
  nameOf: (playerId: string) => string;
  onPatch: (patch: Partial<PracticeStation>) => void;
  onOpenPicker: () => void;
  /** "Edit just for this practice" — keeps every word, drops the drill identity. */
  onDetach: () => void;
  onSwapDrill: () => void;
  /** "Save to my drills…" — offered only on a station the coach typed themselves (D18). */
  onPromote?: () => void;
}) {
  const fromDrill = !!station.drillId;
  const door = (id: StationDoor): TeachingDoor => (doors ? doors(id) : OPEN_DOOR);
  const staff = door('staff'), note = door('note');
  const playerCount = station.playerIds?.length ?? 0;
  // The set this station uses ("Batteries" at the bullpen) — only where a station's people live.
  const stationSet = isRotation ? undefined : groupingById(sets.groupings, station.groupingId);
  const target: SetTarget = { kind: 'station', blockId: block.id, stationId: station.id };
  /* ONE word for the people line — "Staff" — on a block and on a station alike (owner, 2026-09-20):
     the door that opens this line already said "+ Staff", and the field it opened said something
     else. The one place two Staff rows can now stand on a single flattened block is a block that
     holds staff of its own AND on its sole station (a lead set on a circuit, then trimmed to one
     station) — rare, legacy-shaped, and staff is not moved between levels on the way past. */
  const drillActions = !readOnly && (
    <>
      {/* ⚠ Detaching is the HONEST act, not a workaround. It keeps every word and hands the coach
          full editing without leaving the plan at 9pm — and the count stays truthful precisely
          BECAUSE the edit breaks the link. */}
      <button type="button" className={styles.ppAddInline} onClick={onDetach}>
        <Pencil size={12} aria-hidden /> Edit just for this practice
      </button>
      <button type="button" className={styles.ppAddInline} onClick={onSwapDrill}>
        <Repeat size={12} aria-hidden /> Swap drill
      </button>
    </>
  );

  return (
    <>
      {/* ⚠ A template stores no staff and no players — the practice supplies both, which is what
          lets one template work in April with twelve and July with nine. The controls are absent
          rather than disabled: a control that exists only to refuse should not exist. */}
      {/* Read (stage 6, R2): who runs it as chips when someone does — the picker's own disabled
          face — and absent when nobody is named (the modal shows every door, so without this an
          empty read station would print a label over nothing). */}
      {!withoutPeople && staff.show && (!readOnly || hasStaff(station)) && (
        <div className={styles.ppField}>
          <FieldLabel onRemove={staff.onRemove} removeLabel={staff.removeLabel}>Staff</FieldLabel>
          <PracticeTagPicker all={staffTags} ids={station.staffTagIds ?? []}
            legacyNames={station.staff} disabled={readOnly} onCreate={onCreateStaffTag}
            people={staffPeople} onPickPerson={onPickStaffPerson}
            manage={readOnly ? undefined : staffManage} onManageChanged={onStaffTagsChanged}
            onChange={next => onPatch({ staffTagIds: next })}
            emptyHint="No staff yet — pick someone on the team, or type a name." placeholder="Add staff…"
            autoFocus={staff.autoFocus} />
        </div>
      )}

      {/* People live at exactly ONE level. In a rotation that level is the block's groups (listed
          under the grid), so a rotating station offers no roster of its own — and no "Starts with"
          either: the grid's first row says who starts here (D6), and pairs inside an arriving group
          are the tonight note's to say (G4). Everywhere else the station owns its people — its
          names, or one of tonight's sets (G1–G8: "Split into groups…" is the block's door, one
          level down); flattened into its block it reads as the block's Players line (Whole team
          until names are chosen). Read, a station in a non-rotating circuit that names nobody has
          no line — the roster door was the only thing on it. A template shows a set's SHAPE only. */}
      {!isRotation && (!withoutPeople || stationSet) && (!readOnly || playerCount > 0 || sole || stationSet) && (
        <div className={styles.ppFieldRow}>
          <FieldLabel>Players</FieldLabel>
          {stationSet ? (
            <SetReadBack set={stationSet} target={target} wiring={sets} readOnly={readOnly} withoutPeople={withoutPeople}
              roster={roster} notRepliedIds={notRepliedIds} nameOf={nameOf} />
          ) : (
            <PeopleLine target={target} playerIds={station.playerIds} wholeTeamWord={sole} readOnly={readOnly}
              wiring={sets} nameOf={nameOf} onOpenPicker={onOpenPicker} />
          )}
        </div>
      )}

      {fromDrill ? (
        <>
          {/* Quiet, and it STAYS for the life of the station — it records where this came from,
              which remains true however the practice goes. Nothing renders from the drill row
              itself, so there is no "edited" state to track. Flattened into its block (D1) the
              line also carries the two doors, where the block's own words would sit — and the
              drill's NAME, because nothing else on a flattened block says it: the block's title
              is the drill's only when the block was placed from it, and a drill added to a written
              block or swapped in keeps the block's own title (/review, 2026-09-15). The modal's
              head says the name, so the line there does not. */}
          <p className={`${styles.ppFromDrill} ${sole ? styles.ppFromDrillLine : ''}`}>
            <Library size={12} aria-hidden /> From your drills
            {sole && station.name.trim() ? ` · ${station.name}` : ''}
            {station.drillTags?.length ? ` · ${station.drillTags.join(' · ')}` : ''}
            {sole && drillActions}
          </p>
          <TeachingFacts values={station} equipmentTags={equipmentTags} />
          {!sole && drillActions && <div className={styles.ppDrillActions}>{drillActions}</div>}
        </>
      ) : (
        /* The five teaching fields from the shared module (stage 4, L6 — the drill sheet reads the
           same list, so the two shapes cannot drift on order or words); the block's door idiom
           rides in through `doors` when the station is flattened. */
        <TeachingFields
          values={station} readOnly={readOnly} noun="station" doingPlaceholder="What happens at this station"
          doors={door} maxText={MAX_TEXT_LEN} maxPoints={MAX_COACHING_POINTS} maxPointLen={MAX_SHORT_TEXT_LEN}
          equipmentTags={equipmentTags} onCreateEquipmentTag={onCreateEquipmentTag}
          equipmentManage={equipmentManage} onEquipmentTagsChanged={onEquipmentTagsChanged}
          onPatch={patch => onPatch(patch as Partial<PracticeStation>)}
        />
      )}

      {/* ⚠ ALWAYS editable, even on a drill-backed station — this is the one field that must never
          travel back to the library, so it is also the one that must never be locked. It absorbs
          most "one word different tonight" cases with no detaching at all.
          ⚠ Absent on a TEMPLATE for exactly the same reason it is absent on a drill: "just for
          tonight" is the one field that must never travel in either direction. Read: the note as
          text under the same label, when there is one. */}
      {!withoutPeople && note.show && readOnly && <ReadField label="Just for tonight" text={station.note} />}
      {!withoutPeople && note.show && !readOnly && (
        <div className={styles.ppField}>
          <FieldLabel onRemove={note.onRemove} removeLabel={note.removeLabel}>Just for tonight</FieldLabel>
          <input className={styles.input} value={station.note ?? ''} maxLength={MAX_TEXT_LEN}
            aria-label="Just for tonight" autoFocus={note.autoFocus}
            placeholder="A one-off note for this practice" onChange={e => onPatch({ note: e.target.value })} />
        </div>
      )}

      {/* D18 — explicit promotion, never automatic. Offered only on a station the coach wrote
          themselves, and only once it has a name worth saving (a sole station's name is its
          block's title — the station IS the block): auto-saving every station fills the library
          with five near-identical "Warm-up" rows in a season and makes the picker slower than
          typing. */}
      {!readOnly && !fromDrill && onPromote && (station.name.trim() || (sole && block.title.trim())) && (
        <div className={styles.ppDrillActions}>
          <button type="button" className={styles.ppAddInline} onClick={onPromote}>
            <Library size={12} aria-hidden /> Save to my drills…
          </button>
        </div>
      )}
    </>
  );
}

/**
 * The stations as COLUMNS under their block (stage 3, owner ruling D2, 2026-09-15): each its name,
 * who runs it, tonight's note and the first line of what happens there — the whole evening in one
 * screen, nothing opened. A column is a door: press it and the station opens as a modal (D4).
 * "+ Add a station" is the last column. Three fit comfortably, four are tight, five and more wrap
 * to a second row rather than shrink under the tap floor; on a phone the columns stack as rows.
 *
 * The move control lives on the column's own foot (owner, on the built draw, 2026-09-15 — it had
 * sat in the modal's head, where a second pair of horizontal arrows beside the foot's stepper read
 * as "which way do I go", not "move this"). Since 2026-09-24 it is the BLOCK'S GRIP, one level
 * down (owner: "this should be drag and drop just like blocks are"): the ‹ › pair became the ⠿ —
 * drag it to a slot between two columns, or tap it for Move earlier · Move later. A column is
 * therefore a FRAME holding the door (a button named by its content) and the grip beside its
 * "Open ›" — the grip can't sit inside the door, because a button can't hold a button.
 */
/** The small olive "you" beside a block or station that is the reader's (mig 303). */
function YouMark() {
  return <span className={styles.ppYouMark} aria-label="Yours">you</span>;
}

function StationColumns({
  blockId, stations, readOnly, phone = false, staffTags, mineStations, whoOf, onOpen, onMove, onAdd,
}: {
  blockId: string;
  stations: PracticeStation[];
  /** Who is at each station of a block that does NOT rotate — "Batteries · 3 pairs", "4 players"
   *  (G4, 2026-09-28): there the station holds its people, so its column says who they are. Absent in
   *  a circuit, where the grid under the columns says who is where each round. */
  whoOf?: (station: PracticeStation) => string;
  readOnly: boolean;
  /** The block's phone sheet — the stations as ONE list of rows (practice plans on a phone, S1). */
  phone?: boolean;
  staffTags: PickableTag[];
  /** The reader's own stations, by identity — the "you" mark and the olive edge. */
  mineStations: ReadonlySet<string>;
  onOpen: (stationId: string) => void;
  onMove: (stationId: string, delta: number) => void;
  onAdd: () => void;
}) {
  /* ⚠ ON A PHONE A STATION IS ONE ROW (practice plans on a phone, stage 2 · S1 = A, owner
     2026-09-24). The desk's column, stacked, was a 115–138px card whose last line held only the
     word "Open ›"; three stations and the add card took 463px of a 697px sheet and pushed the
     rotation, the groups and "Edit groups ›" under the bar. The row is the block list's: the name,
     then ONE line of facts — who runs it (every name; it wraps, never "…") and "Just for tonight"
     (the note field's own label) when there is a note — a chevron, the whole row the door. The
     note's WORDS are one tap in, on the station's screen. The grip sits at the row's LEFT edge
     while writing, the side the block list keeps its own. Decided in JS by the sheet's `phone`:
     the row and the column differ in structure (the grip's place, which lines exist). */
  /* One reading of each station for both shapes: its facts, its name, and its drag handles — the
     column's two halves as landing slots (so a slot is never a 10px strip) and the grip. */
  const cells = stations.map((station, i) => {
    const label = stationLabel(station, i);
    const mine = mineStations.has(station.id);
    const nameClass = phone ? styles.ppStRowName : styles.ppStColName;
    return {
      station, mine,
      who: mergedTagNames(station.staff, station.staffTagIds, staffTags),
      people: whoOf?.(station) ?? '',
      name: (
        <span className={station.name.trim() ? nameClass : `${nameClass} ${styles.ppTlUntitled}`}>
          {label}{mine && <YouMark />}
        </span>
      ),
      handles: !readOnly && (<>
        <StationSlot blockId={blockId} index={i} side="before" />
        <StationSlot blockId={blockId} index={i + 1} side="after" />
        <StationGrip blockId={blockId} stationId={station.id} index={i} count={stations.length} label={label}
          onMove={delta => onMove(station.id, delta)} />
      </>),
    };
  });
  const canAdd = !readOnly && stations.length < MAX_STATIONS_PER_BLOCK;
  if (phone) {
    return (
      <div className={`${styles.ppStCols} ${styles.ppStList}`}>
        {cells.map(({ station, mine, who, people, name, handles }) => {
          const tonight = !!station.note?.trim();
          return (
            <div key={station.id} id={`station-${station.id}`} className={styles.ppStCol} data-mine={mine ? 'mine' : undefined}>
              {handles}
              {/* Named by its content with an "Open" verb in front — the block row's rule. */}
              <button type="button" className={styles.ppStRowDoor} data-station-door aria-haspopup="dialog" onClick={() => onOpen(station.id)}>
                <span className="sr-only">Open </span>
                <span className={styles.ppStRowText}>
                  {name}
                  {(who.length > 0 || people || tonight) && (
                    <span className={styles.ppStRowFacts}>
                      {[who.join(', '), people].filter(Boolean).join(' · ')}
                      {(who.length > 0 || !!people) && tonight && ' · '}
                      {tonight && <span className={styles.ppStRowTonight}>{DOOR_LABELS.note}</span>}
                    </span>
                  )}
                </span>
                <ChevronRight size={18} aria-hidden className={styles.ppStRowChevron} />
              </button>
            </div>
          );
        })}
        {canAdd && (
          <StationDropTarget blockId={blockId} className={styles.ppStColAddWrap}>
            {() => (
              <button type="button" className={styles.ppStRowAdd} data-pp-add-station={blockId} onClick={onAdd}>
                + Add a station
              </button>
            )}
          </StationDropTarget>
        )}
      </div>
    );
  }
  return (
    <div className={styles.ppStCols}>
      {cells.map(({ station, mine, who, people, name, handles }) => (
        <div key={station.id} id={`station-${station.id}`} className={styles.ppStCol} data-mine={mine ? 'mine' : undefined}>
          <button type="button" className={styles.ppStColDoor} data-station-door onClick={() => onOpen(station.id)}>
            {name}
            {who.length > 0 && <span className={styles.ppStColLine}>{who.join(' · ')}</span>}
            {people && <span className={styles.ppStColLine}>{people}</span>}
            {station.note && <span className={styles.ppStColNote}>Tonight: {station.note}</span>}
            {station.description && <span className={styles.ppStColFirst}>{station.description}</span>}
            <span className={styles.ppStColOpen}>Open ›</span>
          </button>
          {handles}
        </div>
      ))}
      {canAdd && (
        /* The one drop target inside an open circuit (stage 4, L2): a drill carried over it fills
           it green and lands as the next column. The written columns beside it are never targets
           — a drop that replaced one would be a silent swap, and Swap drill stays a door. */
        <StationDropTarget blockId={blockId} className={styles.ppStColAddWrap}>
          {over => (
            <button type="button" className={styles.ppStColAdd} data-pp-add-station={blockId} onClick={onAdd}>
              <span className={styles.ppStColOpen}>+ Add a station</span>
              <span className={styles.ppStColFirst}>{over ? 'drop to add it here' : 'a drill, or write one'}</span>
            </button>
          )}
        </StationDropTarget>
      )}
    </div>
  );
}

/**
 * The open block's station door as a DROP TARGET for a drill (stage 4, L2): "+ Add a station" on a
 * circuit, the "+ Stations" door on a block with none or one. Lit only while a DRILL is lifted — a
 * circuit is a block and never a station of one, so it does not light this. The drop follows
 * D13 exactly as the sheet's pick does (`addStationFromDrill`).
 */
function StationDropTarget({ blockId, className, children }: {
  blockId: string;
  className?: string;
  children: (over: boolean) => ReactNode;
}) {
  const { setNodeRef, isOver, active } = useDroppable({ id: `station:${blockId}`, data: { kind: 'station', blockId } });
  const lifted = (active?.data.current as DragData | undefined)?.kind === 'drill';
  return (
    <div ref={setNodeRef} className={className} data-target={lifted ? 'on' : undefined} data-over={lifted && isOver ? 'on' : undefined}>
      {children(lifted && isOver)}
    </div>
  );
}

/**
 * A station's GRIP — the block gutter's grip, one level down (owner, 2026-09-24: "this should be
 * drag and drop just like blocks are"). The same two gestures on the one glyph: press and drag is
 * the drag (a mouse after six pixels; a finger after the quarter-second hold, on a writing phone
 * only — `touchGrip`), press and let go is the menu. Move earlier · Move later, never "left /
 * right" or "up / down": the columns stand side by side at a desk and stack on a phone, and the
 * order the words name is the same either way. The column fades while it is carried (CSS `:has`).
 */
function StationGrip({ blockId, stationId, index, count, label, onMove }: {
  blockId: string;
  stationId: string;
  index: number;
  count: number;
  label: string;
  onMove: (delta: number) => void;
}) {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `station:${blockId}:${stationId}`, data: { kind: 'station', blockId, stationId, index, label } satisfies DragData,
  });
  return (
    <span ref={setNodeRef} {...listeners} className={styles.ppStColMove} data-lifted={isDragging ? 'on' : undefined}>
      <CoachToolbarMenu label={`Move ${label}`} variant="glyph" icon={<GripVertical size={16} aria-hidden />}>
        <CoachToolbarMenuItem label="Move earlier" disabled={index === 0} onSelect={() => onMove(-1)} />
        <CoachToolbarMenuItem label="Move later" disabled={index === count - 1} onSelect={() => onMove(1)} />
      </CoachToolbarMenu>
    </span>
  );
}

/**
 * Half a station column as a landing SLOT for a carried station — `index` is the position the
 * station lands in front of (0 … n), so the two halves either side of a gap name the same slot and
 * draw their line on the same pixel. The block's gap rule, one level down: lit only for a station
 * of THIS block, never for its own two slots (a drop there is no move), and the plan changes on the
 * drop, never on hover. `pointer-events: none` — the kit measures it; the door under it still clicks.
 */
function StationSlot({ blockId, index, side }: { blockId: string; index: number; side: 'before' | 'after' }) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: `station-slot:${blockId}:${index}:${side}`, data: { kind: 'stationSlot', blockId, index } satisfies DropData,
  });
  const lifted = active?.data.current as DragData | undefined;
  const applies = lifted?.kind === 'station' && lifted.blockId === blockId && index !== lifted.index && index !== lifted.index + 1;
  return (
    <span ref={setNodeRef} className={styles.ppStColSlot} data-side={side}
      data-target={applies ? 'on' : undefined} data-over={applies && isOver ? 'on' : undefined} aria-hidden />
  );
}

/** What is being carried — a panel row (a drill or a circuit), a block by its gutter, or a station
 *  by its grip. */
type DragData =
  | { kind: 'drill'; drill: RepTeamDrill }
  | { kind: 'circuit'; circuit: RepTeamCircuit }
  | { kind: 'block'; blockId: string; index: number; label: string }
  | { kind: 'station'; blockId: string; stationId: string; index: number; label: string };
/** Where it can land — a gap between rows (index = the position the new or moved block takes),
 *  the open block's station door, or a slot between its station columns. */
type DropData =
  | { kind: 'gap'; index: number }
  | { kind: 'station'; blockId: string }
  | { kind: 'stationSlot'; blockId: string; index: number };

/**
 * A GAP between two rows — and under the last one — as a drop target (stage 4, L2). Collapsed to
 * nothing until something compatible is lifted; then a band the pointer can find, with a line
 * that says where the block would land and when it would start. A block dragged by its gutter
 * lights every gap but its own two (dropping there is no move). Nothing here mutates the plan —
 * the editor's `onDragEnd` does, on the drop.
 */
function GapTarget({ index, startLabel, blockCount }: { index: number; startLabel: string | null; blockCount: number }) {
  const { setNodeRef, isOver, active } = useDroppable({ id: `gap:${index}`, data: { kind: 'gap', index } });
  const lifted = active?.data.current as DragData | undefined;
  // One reading of what is carried: does this gap take it, and what the line would say. A station
  // moves inside its own block only — a gap between blocks never takes one.
  const carried = !lifted || lifted.kind === 'station' ? null
    : lifted.kind === 'block'
      ? { applies: index !== lifted.index && index !== lifted.index + 1, words: [`Move ${lifted.label} here`] }
      : {
        applies: blockCount < MAX_BLOCKS,
        words: [
          'New block here',
          lifted.kind === 'drill' ? lifted.drill.name : lifted.circuit.name,
          `${(lifted.kind === 'drill' ? lifted.drill.usualMinutes : lifted.circuit.block.duration.minutes) ?? DEFAULT_BLOCK_MINUTES} min`,
        ],
      };
  const applies = !!carried?.applies;
  return (
    <div ref={setNodeRef} className={styles.ppTlGap} data-target={applies ? 'on' : undefined} data-over={applies && isOver ? 'on' : undefined} aria-hidden>
      <span className={styles.ppTlGapGutter} />
      <span className={styles.ppTlGapLine}>
        {/* "▸ New block here · 5:11 p.m. · Probe drill · 20 min" — the start after the verb. */}
        {carried && applies && isOver && (
          <span className={styles.ppTlGapWords}>▸ {[carried.words[0], startLabel, ...carried.words.slice(1)].filter(Boolean).join(' · ')}</span>
        )}
      </span>
    </div>
  );
}

/**
 * A station, OPEN — as a modal over the sheet (stage 3, owner ruling D4 as REVISED, 2026-09-15).
 *
 * Drawn first as a column widening in place, its siblings folding to their heads; revised on the
 * owner's read of the built draw. "A row opens in place so a coach can see where they are in the
 * sequence" is true of a BLOCK, which runs before and after its neighbours in time, and false of a
 * STATION, which merely shares a clock with the ones beside it — once that reason was gone the
 * modal was strictly better for a card this deep: no dead columns, no inline scroll fighting the
 * page's, full width to work in. What a modal owes back is "what else is running tonight": the
 * foot's stepper — the money room's own Prev / Next (`RoomWalkNav`, `stationWalk`) — carries it,
 * stopping at the ends, never wrapping; ← / → step too (never while typing).
 *
 * The head IS the station's name (typeable for a written station, text for a drill) and nothing
 * else: the reorder arrows it carried at first left for the column's foot (owner, on the built
 * draw, 2026-09-15) — a second pair of horizontal arrows in one dialog, one moving the station and
 * one moving the coach, could not be told apart; the stepper is now the only arrows in here. The
 * foot: Delete this station, then the stepper. On the shared dialog floor with every other sheet
 * on this page (stage 2, D9): Escape closes, Tab is trapped, focus returns to the column that
 * opened it.
 */
function StationModal({
  block, station, readOnly, focusName = false, onStartFromDrill, onTouched, onEdit, onDoneEditing, withoutPeople,
  sets, roster, notRepliedIds,
  staffTags, onCreateStaffTag, staffPeople, onPickStaffPerson, equipmentTags, onCreateEquipmentTag,
  staffManage, onStaffTagsChanged, equipmentManage, onEquipmentTagsChanged,
  nameOf, onPatch, onDelete, onStep, onClose, onOpenPicker, onDetach, onSwapDrill, onPromote, onAddStation,
}: {
  block: PracticePlanBlock;
  station: PracticeStation;
  readOnly: boolean;
  /** The LAST station's way on (owner, 2026-09-28 — "rather than just having a dead end"): the
   *  walk's "End" becomes "+ Add a station", the block's own add. Absent while reading and on a
   *  full block, where "End" stays. */
  onAddStation?: () => void;
  /** A station the coach JUST ADDED opens with the cursor in its name (practice plans on a phone,
   *  S2 — the new block's title rule, one level down). */
  focusName?: boolean;
  /** "Start from a drill ›" under the name — offered while the coach is still on the station they
   *  just added (S2 · K4 one level down), typed-on or not: the editor asks first when there is
   *  anything to lose (§231 walk). The pick takes this station's place, keeping its id. */
  onStartFromDrill?: () => void;
  /** The coach typed something on this station — anything (S4): it is theirs now, and never removed
   *  as "left empty". Counted from the typing itself, not from what was saved, because a new staff
   *  name is created over the network and lands a moment after the keystrokes that asked for it. */
  onTouched?: () => void;
  /** The head's Edit / Done editing (`SheetEditToggle`) — the page's doors; this station stays open. */
  onEdit?: () => void;
  onDoneEditing?: () => void;
  withoutPeople: boolean;
  /** Tonight's sets (G1–G8) — the station's Players line offers them where its people live. */
  sets: SetsWiring;
  roster: PracticeRosterPlayer[];
  notRepliedIds: ReadonlySet<string>;
  staffTags: PickableTag[];
  onCreateStaffTag?: (name: string) => Promise<PickableTag | null>;
  /** The staff picker's "People on this team" group (mig 303) — absent on a read-only surface. */
  staffPeople?: readonly PickablePerson[];
  onPickStaffPerson?: (person: PickablePerson) => Promise<PickableTag | null>;
  equipmentTags: PickableTag[];
  onCreateEquipmentTag?: (name: string) => Promise<PickableTag | null>;
  staffManage?: TagManageConfig;
  onStaffTagsChanged?: () => void;
  equipmentManage?: TagManageConfig;
  onEquipmentTagsChanged?: () => void;
  nameOf: (playerId: string) => string;
  onPatch: (patch: Partial<PracticeStation>) => void;
  onDelete: () => void;
  onStep: (stationId: string) => void;
  onClose: () => void;
  onOpenPicker: () => void;
  onDetach: () => void;
  onSwapDrill: () => void;
  onPromote?: () => void;
}) {
  const stations = block.stations ?? [];
  const index = stations.indexOf(station);
  const isRotation = blockRotates(block);
  const label = stationLabel(station, index);
  const walk = stationWalk(stations, station.id);
  /* On a phone the foot's walk is compact and the next station is named in full at the body's end
     (§227, option C — the block sheet's answer, one level down). The desk keeps the named pair. */
  const phone = useIsPhone();
  const nextStation = walk.next ? stations.find(s => s.id === walk.next!.id) : undefined;
  const nextWho = nextStation ? mergedTagNames(nextStation.staff, nextStation.staffTagIds, staffTags).join(', ') : '';
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFloor(true, panelRef, {
    onClose,
    walk: { prev: walk.prev?.id ?? null, next: walk.next?.id ?? null, onSelect: onStep },
    // The drill too: "Start from a drill ›" unmounts under the pick, and the picker's floor hands
    // focus back to it — detached — so the panel re-seats focus when the station becomes the drill.
    focusKey: `${station.id}:${station.drillId ?? ''}`,
  });
  /* A just-added station: the cursor in its name. `autoFocus` alone loses it — the floor seats focus
     on the panel, and in the dev build's double-mounted effects its cleanup hands focus back to the
     opener first (the new block's title, §6.5). Declared AFTER the floor, so it runs last in either
     build. Keyed on the station, so a step to a neighbour never pulls the cursor back here. */
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusName) nameRef.current?.focus();
  }, [focusName, station.id]);
  const fromDrill = !!station.drillId;

  return (
    <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${label} — station ${index + 1} of ${stations.length}`}
        className={`${styles.modal} ${styles.modalWide} ${styles.modalScrollBody} ${styles.ppStationModal}`}>
        {/* The one anatomy (owner, §227 walk 2026-09-24): the head says where you are — the block
            sheet's eyebrow, one level down — and carries Edit / Done editing; the NAME leads the
            body, as the block's title leads its sheet. */}
        <CoachModalHeader onClose={onClose} closeAriaLabel="Close" title={
          <span className={styles.ppBlockSheetEyebrow}>
            <b>Station {index + 1} of {stations.length}</b>
            <span>{block.title.trim() || 'This block'}</span>
          </span>
        }>
          {/* The bin comes in to the LEFT of the toggle, never in its place: ✎ and ✓ hold the same spot,
              so the finger that tapped ✎ is resting on ✓ — not on a bin that just arrived under it
              (§227 walk, 2026-09-24). The bin's slot is always in the list, so the toggle is one
              element throughout and keeps focus. */}
          {!readOnly && (
            <SheetDeleteButton label={label} onDelete={onDelete}
              message={`Removes it from ${block.title.trim() || 'this block'}. This can't be undone.`} />
          )}
          {/* ✎ Edit / ✓ Done editing on a PHONE only (owner, 2026-09-28: "done editing in desktop can
              live only above the main sheet" — then, asked, no Edit either). A phone's form covers
              the toolbar, so it carries the toggle (R3); a desk's sits over the sheet, whose toolbar
              holds both words — as a desk's open block already has no toggle of its own. Keeping ✎
              alone on a desk would put the bin, which arrives as editing starts, under the pointer
              that pressed ✎ (measured: ✎ 920–991, click 956, bin 947–991 at 1440) — the §227 rule. */}
          {phone && <SheetEditToggle readOnly={readOnly} onEdit={onEdit} onDoneEditing={onDoneEditing} />}
        </CoachModalHeader>

        <div className={`${styles.scrollPane} ${styles.ppStationBody}`} onInput={onTouched}>
          {/* Keyed on the station, so a step (Prev / Next, ← / →) starts the fields fresh: the two
              pickers keep a typed-but-unchosen search as local state, and with Staff now the first
              field a "jen" typed on station 1 carried into station 2's box (/review, 2026-09-20).
              The PANEL is not keyed — the floor's own focus-on-step rule depends on it staying. */}
          {/* The name: text for a drill's and when read (stage 6, R2), a box to type into otherwise. */}
          {fromDrill || readOnly
            ? <p className={styles.ppStationName}>{label}</p>
            : (
              <input ref={nameRef} className={`${styles.input} ${styles.ppStationTitle}`} value={station.name}
                maxLength={MAX_TITLE_LEN} placeholder="Station name" aria-label="Station name"
                onChange={e => onPatch({ name: e.target.value })} />
            )}
          {onStartFromDrill && !readOnly && (
            <button type="button" className={`${styles.ppTlQuietLink} ${styles.ppBlockSheetFromDrill}`} onClick={onStartFromDrill}>
              <Library size={12} aria-hidden /> Start from a drill ›
            </button>
          )}
          <StationFields
            key={station.id}
            station={station} block={block} sole={false} isRotation={isRotation}
            readOnly={readOnly} withoutPeople={withoutPeople}
            sets={sets} roster={roster} notRepliedIds={notRepliedIds}
            staffTags={staffTags} onCreateStaffTag={onCreateStaffTag} staffPeople={staffPeople} onPickStaffPerson={onPickStaffPerson}
            equipmentTags={equipmentTags} onCreateEquipmentTag={onCreateEquipmentTag}
            staffManage={staffManage} onStaffTagsChanged={onStaffTagsChanged}
            equipmentManage={equipmentManage} onEquipmentTagsChanged={onEquipmentTagsChanged}
            nameOf={nameOf} onPatch={onPatch} onOpenPicker={onOpenPicker}
            onDetach={onDetach} onSwapDrill={onSwapDrill} onPromote={onPromote}
          />
          {phone && (
            <WalkOnward walk={{ ...walk, noun: 'stations', onSelect: onStep }} noun="station"
              kicker="Next station" meta={nextWho || null} onAdd={onAddStation} />
          )}
        </div>

        {/* The foot: the walk ALONE, at every width — the block sheet's own foot. ⚠ NO "Done" HERE: it
            left the phone on the §231 walk (owner 2026-09-25) and the desk on 2026-09-28 (owner, on a
            desk screenshot: "why do we have 2 done buttons?"). It only closed — the head's × / ← and
            Escape already do, and the plan autosaves — and it sat under ✓ "Done editing", which does
            the opposite: ✓ ends editing and keeps the station open, Done closed it and kept editing. */}
        {walk.total > 1 && (
          <div className={`${styles.modalFooter} ${styles.ppSheetFoot}`}>
            <RoomWalkNav nav={{ ...walk, noun: 'stations', onSelect: onStep }} compact={phone}
              end={onAddStation && { label: 'Add a station', onSelect: onAddStation }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Rotation ─────────────────────────────────────────────────────────────────

/**
 * The rotation as ONE line between the block's words and its columns (stage 3, owner ruling D3,
 * 2026-09-15): whether the groups rotate (a pressed chip — un-press it and the stations run
 * separately, each with its own Players line), how often, and what that makes of the block's
 * length said honestly ("3 rounds of 15 = 45 min"; "45 does not divide by 20 — 2 rounds and 5 min
 * over", never tidied — `describeRounds`). The stacked panel this replaces put all of it, and the
 * grid, ABOVE the stations it was about.
 *
 * The line keeps only its CLOCK (stage 3 revision, owner ruling D9 · D12, 2026-09-16): the draw —
 * the count, the pool word and the button — lives in the groups room behind "Edit groups ›"
 * under the grid, beside the groups it deals. The trade, named once: a first draw is open · Draw ·
 * Done rather than one press here.
 *
 * No 'runs for' here: the rotation lasts as long as the block, and storing that twice only let the
 * two numbers disagree. Left alone, each round is the block split evenly across the stations —
 * everyone gets one turn each — and it keeps following as they change.
 */
function RotationStrip({
  isRotation, rotation, blockMinutes, stationCount, readOnly, onToggle, onSetRotation,
}: {
  isRotation: boolean;
  rotation: PracticeRotation;
  blockMinutes: number | null;
  /** The NAMED stations — the stops the arithmetic counts (`computeRotation` skips an unnamed one),
   *  so the strip's sentence and the grid under it can never disagree (/review, 2026-09-15). */
  stationCount: number;
  readOnly: boolean;
  onToggle: (rotates: boolean) => void;
  onSetRotation: (patch: Partial<PracticeRotation>) => void;
}) {
  const intervalShown = rotation.intervalMinutes ?? defaultIntervalMinutes(blockMinutes, stationCount);
  const rounds = describeRounds(blockMinutes, intervalShown);

  /* Read (stage 6, R2): the line as a FACT — "Groups rotate · every 15 min · 3 rounds of 15 =
     45 min" — the same words the pressed chip and the box spell out, with nothing to press. A
     circuit that does not rotate says nothing here: each column carries its own players. */
  if (readOnly) {
    if (!isRotation) return null;
    return (
      <p className={`${styles.ppRotStrip} ${styles.ppRotStripRead}`}>
        <span className={styles.ppRotFact}><Repeat size={11} aria-hidden /> Groups rotate</span>
        {intervalShown != null && (
          <>
            <span className={styles.ppClockSep} aria-hidden>·</span>
            <span>every {intervalShown} min</span>
          </>
        )}
        {rounds && (
          <>
            <span className={styles.ppClockSep} aria-hidden>·</span>
            <span className={styles.ppRotRounds}>{rounds}</span>
          </>
        )}
      </p>
    );
  }

  return (
    <div className={styles.ppRotStrip}>
      <button type="button" className={styles.ppQuickChip} aria-pressed={isRotation}
        data-on={isRotation ? 'on' : undefined} onClick={() => onToggle(!isRotation)}>
        <Repeat size={11} aria-hidden /> Groups rotate
      </button>
      {isRotation && (
        <>
          <span className={styles.ppClockSep} aria-hidden>·</span>
          <label className={styles.ppRotEvery}>
            <span>every</span>
            <input className={`${styles.input} ${styles.ppMinutes} ${styles.ppRotMinutes}`} type="number" min={1} max={MAX_MINUTES}
              inputMode="numeric" value={intervalShown ?? ''}
              aria-label="Minutes between moves" placeholder="—"
              onChange={e => onSetRotation({ intervalMinutes: e.target.value ? Number(e.target.value) : null })} />
            <span>min</span>
          </label>
          {rounds && (
            <>
              <span className={styles.ppClockSep} aria-hidden>·</span>
              <span className={styles.ppRotRounds}>{rounds}</span>
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Under the columns: the grid TURNED to them (stage 3, owner ruling D6, 2026-09-15) — rounds as
 * rows with their clock, the stations as columns in the same order as the cards above, each cell
 * the group there then; reading down a column is one station's evening, across a row is where
 * everyone stands at 7:50. The first row is who starts where, so no station repeats it. Then the
 * honest statements (D25 — a mismatch is STATED, never tidied away by inventing a round or
 * dropping a station), then the groups READ BACK — one quiet line each, the names not in a group
 * on their own line, and "Edit groups ›" as the one door (stage 3 revision, owner rulings D9 ·
 * D11, 2026-09-16 — "once leaving the modal do we have a view of the groups?"). Nothing here
 * changes anything; the groups room is the only editor. `computeRotation` is untouched: the same
 * cells, re-keyed (`rotationByStation`).
 */
function RotationBoard({
  blockId, rotation, set, sets, stations, blockMinutes, blockStartMs, readOnly, withoutPeople, shapeNoun = 'a template', roster, notRepliedIds,
  nameOf, onSetRotation,
}: {
  blockId: string;
  rotation: PracticeRotation;
  /** The set that rotates here (G3) — absent until the coach chooses or draws one. */
  set: PracticeGrouping | undefined;
  sets: SetsWiring;
  stations: PracticeStation[];
  blockMinutes: number | null;
  blockStartMs?: number;
  readOnly: boolean;
  withoutPeople: boolean;
  /** The word for what carries no people — "a template", or "a circuit" in the circuit editor (L9). */
  shapeNoun?: string;
  /** Tonight's roster in roster order — the read-out's "Not in a group" line is roster minus groups. */
  roster: PracticeRosterPlayer[];
  /** Who has NOT replied yes, when attendance is known — named as such, never silently dropped (D21). */
  notRepliedIds: ReadonlySet<string>;
  nameOf: (playerId: string) => string;
  /** The grid's own writes (D14): one hand move, or back to the standard rotation. */
  onSetRotation: (patch: Partial<PracticeRotation>) => void;
}) {
  // The arithmetic reads the rotation's clock and arrangement with the SET's groups (G3).
  const input = { intervalMinutes: rotation.intervalMinutes, arrangement: rotation.arrangement, groups: set?.groups ?? [] };
  const grid = computeRotation(input, stations, blockMinutes, blockStartMs);
  const turned = rotationByStation(grid, stations);
  const target: SetTarget = { kind: 'rotation', blockId };

  /* ── The grid as a starting point (D14) ──
     A group in a cell is a pill: tap it for "Move to <station> · Sits this round out" (the phone
     and keyboard path), or drag it along its row on a desktop. `arrangeGroup` is the whole write.
     A change to the stations, groups or clock under a hand-arranged grid drops the arrangement in
     the settle pass; the board notices the drop and SAYS SO — reset and stated, never silently. */
  const canArrange = !readOnly && !withoutPeople && turned.rows.length > 0;
  const arrange = (round: number, groupId: string, stationId: string | null) => {
    const next = arrangeGroup(input, stations, blockMinutes, round, groupId, stationId);
    if (next !== input) onSetRotation({ arrangement: next.arrangement });
  };
  const forgotByCoach = useRef(false);
  const forget = () => { forgotByCoach.current = true; setResetNote(false); onSetRotation({ arrangement: forgetArrangement(rotation).arrangement }); };
  const [resetNote, setResetNote] = useState(false);
  const hadArrangement = useRef(!!rotation.arrangement);
  useEffect(() => {
    const has = !!rotation.arrangement;
    if (hadArrangement.current && !has && !forgotByCoach.current) setResetNote(true);
    if (has) setResetNote(false);
    forgotByCoach.current = false;
    hadArrangement.current = has;
  }, [rotation.arrangement]);
  const anyOut = turned.rows.some(r => r.out.length > 0);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
  );
  const [lifted, setLifted] = useState<{ round: number; groupId: string; name: string } | null>(null);
  /* ≤640 the grid scrolls inside `CoachScrollX`, which SAYS so when it must (phone practice plans ·
     T1, owner ruling 2026-09-24 — the bespoke scroller swiped silently, the rule's one breach). The
     desk keeps its own scroller: the ruling was "phones only", and a swipe chip names a gesture a
     mouse cannot make (the component's own G3 note). Asked only where a grid can render. */
  const phone = useIsPhone(!withoutPeople);
  const onDragStart = (e: DragStartEvent) => {
    const d = e.active.data.current as { round: number; groupId: string; name: string } | undefined;
    setLifted(d ?? null);
  };
  const onDragEnd = (e: DragEndEvent) => {
    setLifted(null);
    const d = e.active.data.current as { round: number; groupId: string } | undefined;
    const target = e.over?.data.current as { round: number; stationId: string | null } | undefined;
    if (!d || !target || target.round !== d.round) return;
    arrange(d.round, d.groupId, target.stationId);
  };
  /* The rounds line ("3 rounds of 15 min.") is the strip's now (D3, `describeRounds`); the
     statements under the grid are the ones the strip cannot say — who shares, who never reaches,
     what is still missing (D25, their exact words). */
  const notes = grid.notes.filter(n => n !== grid.roundsNote);

  /* ⚠ A template stops at the strip's clock. Everything below assigns children to groups, and a
     template supplies no children — the plan it starts draws its own groups from that night's
     roster, which is exactly what lets one template work in April with twelve and July with nine. */
  if (withoutPeople) {
    return <p className={styles.formHint}>Groups are drawn on the practice itself — {shapeNoun} keeps the shape, not the players.</p>;
  }

  const gridTable = (
    <table className={`${styles.ppGrid} ${styles.ppGridCols}${canArrange ? ` ${styles.ppGridPills}` : ''}`} data-lifting={lifted ? 'on' : undefined}>
      <thead>
        <tr>
          <th scope="col"><span className="sr-only">Round</span></th>
          {turned.stations.map(s => <th key={s.id} scope="col">{s.name}</th>)}
          {anyOut && <th scope="col" className={styles.ppGridOutHead}>Sitting out</th>}
        </tr>
      </thead>
      <tbody>
        {turned.rows.map(row => (
          <tr key={row.round}>
            <th scope="row">{row.startLabel ?? `Round ${row.round}`}</th>
            {row.cellGroups.map((here, i) => (
              <GridCell key={turned.stations[i].id} round={row.round} stationId={turned.stations[i].id} canArrange={canArrange}>
                {here.length === 0 && <span className={styles.ppGridNone}>—</span>}
                {here.map(g => (
                  canArrange
                    ? <GridPill key={g.id} round={row.round} group={g} at={turned.stations[i].id} stations={turned.stations} onArrange={arrange} />
                    : <span key={g.id} className={styles.ppGridName}>{g.name}</span>
                ))}
              </GridCell>
            ))}
            {anyOut && (
              <GridCell round={row.round} stationId={null} canArrange={canArrange}>
                {row.out.length === 0 && <span className={styles.ppGridNone}>—</span>}
                {row.out.map(g => (
                  canArrange
                    ? <GridPill key={g.id} round={row.round} group={g} at={null} stations={turned.stations} onArrange={arrange} />
                    : <span key={g.id} className={styles.ppGridName}>{g.name}</span>
                ))}
              </GridCell>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );

  const gridBody = canArrange ? (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setLifted(null)}>
      {gridTable}
      {typeof document !== 'undefined' && createPortal(
        <DragOverlay dropAnimation={null} zIndex={1200}>
          {lifted && <span className={`${styles.ppChip} ${styles.ppGroupChipLifted}`}><GripVertical size={13} aria-hidden /> {lifted.name}</span>}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  ) : gridTable;

  return (
    <div className={styles.ppRotBoard}>
      {turned.rows.length > 0 && (phone
        ? <CoachScrollX hint="Swipe the table to see every station" frame={false}>{gridBody}</CoachScrollX>
        : <div className={styles.ppGridScroll}>{gridBody}</div>
      )}
      {/* Plain statements about what THESE cells do — dealt or arranged. A mismatch is STATED —
          never tidied away by inventing a round or dropping a station (D25). */}
      {notes.length > 0 && (
        <ul className={styles.ppNotes}>{notes.map((note, i) => <li key={i}>{note}</li>)}</ul>
      )}
      {/* Hand-arranged (D14): said, with the one way back. And when the arrangement was dropped
          because the count changed under it: said too, until the coach has read it. */}
      {grid.arranged && (
        <p className={`${styles.ppGroupReadLine} ${styles.ppGroupReadQuiet}`}>
          <span>Hand-arranged — the groups no longer move one station on each round.</span>
          {!readOnly && (
            <>
              <span className={styles.ppClockSep} aria-hidden>·</span>
              <button type="button" className={styles.ppTlQuietLink} onClick={forget}>Back to the standard rotation ›</button>
            </>
          )}
        </p>
      )}
      {resetNote && !grid.arranged && (
        <p className={`${styles.ppGroupReadLine} ${styles.ppGroupReadQuiet}`} role="status">
          <span>Back to the standard rotation — the stations, groups or timing changed under your arrangement.</span>
          <span className={styles.ppClockSep} aria-hidden>·</span>
          <button type="button" className={styles.ppTlQuietLink} onClick={() => setResetNote(false)}>OK</button>
        </p>
      )}

      {/* ── The groups, read back (D9 · D11) — the circuit's SET now (G3, 2026-09-28): a read, not an
          editor; the room behind "Edit groups ›" is the only place anyone moves. With no set yet, one
          door — "Choose groups…" — offers tonight's sets FIRST (a second circuit of the night uses the
          first one's groups: F02's whole fix), then a new draw, then another practice's (G6). The
          honest split line stays over the names (D25's rule for an uneven draw). ── */}
      {!set ? (
        <p className={styles.ppGroupReadLine}>
          {/* Read (stage 6), the fact without the promise: a record's groups are not "yet". */}
          <span className={styles.ppRailNone}>{readOnly ? 'No groups' : 'No groups yet'}</span>
          {!readOnly && (
            <>
              <span className={styles.ppClockSep} aria-hidden>·</span>
              <GroupsMenu label="Choose groups…" target={target} wiring={sets} />
            </>
          )}
        </p>
      ) : (
        <div className={styles.ppGroupRead}>
          {set.groups.some(g => g.playerIds.length > 0) && <p className={styles.ppSplitNote}>{describeSplit(set.groups)}</p>}
          <SetReadBack set={set} target={target} wiring={sets} readOnly={readOnly} withoutPeople={withoutPeople}
            roster={roster} notRepliedIds={notRepliedIds} nameOf={nameOf} />
        </div>
      )}
    </div>
  );
}


/** A cell of the grid as a DROP target for its own round (D14) — `stationId` null is the
 *  "Sitting out" column. Rows are rounds and a pill never leaves its row: a drop on another
 *  round's cell is not a target at all, so the cell shows nothing and the drop does nothing. */
function GridCell({ round, stationId, canArrange, children }: {
  round: number;
  stationId: string | null;
  canArrange: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: `${round}:${stationId ?? 'out'}`, data: { round, stationId }, disabled: !canArrange,
  });
  const sameRound = (active?.data.current as { round?: number } | undefined)?.round === round;
  return (
    <td ref={setNodeRef} data-over={isOver && sameRound ? 'on' : undefined} data-target={active && sameRound ? 'on' : undefined}
      className={stationId === null ? styles.ppGridOutCell : undefined}>
      <span className={styles.ppGridCellWrap}>{children}</span>
    </td>
  );
}

/**
 * A group in a cell (D14): the portal's action menu in its chip skin — "Move to <each other
 * station this round>", then "Sits this round out" — AND a drag handle along its row. The same
 * two-ways-one-chip shape the groups room uses; the tap is the whole path on a phone and for a
 * keyboard. Drag activates after six pixels or a quarter-second press, and a drag's drop never
 * opens the menu (the kit swallows that click).
 *
 * ≤640 the pill is a soft TILE with no grip (phone practice plans · T2, owner ruling 2026-09-24):
 * the grip's width is most of what pushed a third station off a phone, and the tap menu is the
 * phone's path anyway. Decided in the stylesheet (`.ppGridTile` / `.ppGridGrip`), so the desk's pill
 * is untouched and no chip opens a media listener of its own.
 */
function GridPill({ round, group, at, stations, onArrange }: {
  round: number;
  group: { id: string; name: string };
  /** The station the pill stands at, or null in the "Sitting out" column. */
  at: string | null;
  stations: { id: string; name: string }[];
  onArrange: (round: number, groupId: string, stationId: string | null) => void;
}) {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `${round}:${group.id}`, data: { round, groupId: group.id, name: group.name },
  });
  const others = stations.filter(s => s.id !== at);
  return (
    <span ref={setNodeRef} {...listeners} className={styles.ppGroupChip} data-lifted={isDragging ? 'on' : undefined}>
      <CoachToolbarMenu label={group.name} variant="chip" triggerClassName={styles.ppGridTile}
        icon={<GripVertical size={13} aria-hidden className={styles.ppGridGrip} />}>
        {others.map(s => (
          <CoachToolbarMenuItem key={s.id} label={`Move to ${s.name}`} onSelect={() => onArrange(round, group.id, s.id)} />
        ))}
        {at !== null && others.length > 0 && <CoachToolbarMenuSeparator />}
        {at !== null && <CoachToolbarMenuItem label="Sits this round out" onSelect={() => onArrange(round, group.id, null)} />}
      </CoachToolbarMenu>
    </span>
  );
}

// ── Sets of groups on the practice (groups at every level, owner rulings G1–G8, 2026-09-28) ──
//
// A set is the PRACTICE's (`plan.groupings`); a block with no stations, a station that does not
// rotate and a circuit's rotation each POINT at one. Nothing on screen says "level": a Players line
// says who is in THIS block ("In pairs · Throwing partners"), the Groups fold under the goal says
// who is with whom TONIGHT, and a shared set says where else it is used — the whole answer to
// "which groups win?" is that a place only ever holds one. docs/projects/active/COACH_PRACTICE_GROUPS_PLAN.md.

/** A place that can hold a set — a block (no stations), a station (the block's only one, or one of
 *  several that do not rotate), or a circuit's rotation. */
/** What a place holds: its own names, or the set it points at — never both (the one-level law). */
type Holding = { playerIds?: string[]; groupingId?: string };

type SetTarget =
  | { kind: 'block'; blockId: string }
  | { kind: 'station'; blockId: string; stationId: string }
  | { kind: 'rotation'; blockId: string };

/**
 * Everything a Players line, a station and a circuit's board need to offer tonight's sets — ONE
 * bundle threaded from the editor, so the three places can never offer them differently.
 */
type SetsWiring = {
  groupings: readonly PracticeGrouping[];
  uses: ReadonlyMap<string, GroupingUse[]>;
  /** Another practice this season holds a set with anyone in it (G6). */
  canCopyFromPractice: boolean;
  onUse: (target: SetTarget, setId: string) => void;
  /** "New groups…" — a new set on the practice, this place pointing at it, the room open on it. */
  onNew: (target: SetTarget) => void;
  /** “From another practice…” — onto a place, or (from the fold) onto the practice alone. */
  onFromPractice: (target: SetTarget | null) => void;
  /** Opens the room on a set — from a place (the copy door needs to know which) or from the fold. */
  onEdit: (target: SetTarget | null, setId: string) => void;
  /** Leave the set: back to the whole team, or to choosing players (a block or a station); a
   *  circuit's "No groups". The set stays on the practice's list for whatever else uses it. */
  onLeave: (target: SetTarget, then: 'team' | 'choose') => void;
};

/** "used in Warm-up and Partner throwing" — the menu's and the read-back's one phrasing. */
function usedInWords(uses: readonly GroupingUse[] | undefined, except?: SetTarget): string {
  const others = (uses ?? []).filter(u => !except || !sameTarget(u, except));
  const labels = others.map(u => u.label);
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}
/** Is this use the place `target` names? A circuit's rotation and its block are one place. */
function sameTarget(use: GroupingUse, target: SetTarget): boolean {
  if (use.blockId !== target.blockId) return false;
  return target.kind === 'station' ? use.stationId === target.stationId : !use.stationId;
}

/**
 * The door to tonight's sets (G2 — on the line that already says who): "Split into groups…" on a
 * Players line, "Change…" beside a set in use, "Choose groups ›" on a circuit with none. The
 * portal's own action menu (a drawer on a phone): reuse FIRST — the second block of the night asks
 * "same pairs?", not "draw again?" — then New groups…, then From another practice… (G6), and, beside
 * a set in use, the way back out.
 */
function GroupsMenu({ label, target, current, wiring }: {
  label: string;
  target: SetTarget;
  /** The set this place uses now — left out of the list, and the menu offers the way out of it. */
  current?: string;
  wiring: SetsWiring;
}) {
  const others = wiring.groupings.filter(s => s.id !== current);
  /* A set lasts as long as something uses it (owner ruling 2026-09-28): when THIS place is its last
     use, every choice below leaves it and it goes from the list — said before the choice, never after. */
  const currentSet = current ? wiring.groupings.find(s => s.id === current) : undefined;
  const leavingRemoves = !!currentSet && !currentSet.standing && (wiring.uses.get(currentSet.id)?.length ?? 0) <= 1;
  return (
    <span className={styles.ppGroupsMenu}>
      <CoachToolbarMenu label={label} triggerClassName={styles.ppGroupsDoor} drawerOnPhone drawerTitle="Groups">
        {leavingRemoves && (
          <p className={styles.ppGroupsMenuNote}>
            “{currentSet!.name.trim() || 'These groups'}” is only used here — choosing anything below removes it from tonight’s groups.
          </p>
        )}
        {others.length > 0 && <CoachToolbarMenuHeading>Use groups from tonight</CoachToolbarMenuHeading>}
        {others.map(s => {
          const where = usedInWords(wiring.uses.get(s.id));
          return (
            <CoachToolbarMenuItem key={s.id} label={s.name.trim() || 'Unnamed groups'}
              hint={[groupingShape(s), where ? `used in ${where}` : 'not used yet'].join(' · ')}
              onSelect={() => wiring.onUse(target, s.id)} />
          );
        })}
        {others.length > 0 && <CoachToolbarMenuSeparator />}
        <CoachToolbarMenuItem label="New groups…" onSelect={() => wiring.onNew(target)} />
        {wiring.canCopyFromPractice && (
          <CoachToolbarMenuItem label="From another practice…" onSelect={() => wiring.onFromPractice(target)} />
        )}
        {current && <CoachToolbarMenuSeparator />}
        {current && target.kind !== 'rotation' && (
          <>
            <CoachToolbarMenuItem label="Whole team" hint="no groups" onSelect={() => wiring.onLeave(target, 'team')} />
            <CoachToolbarMenuItem label="Choose players…" hint="no groups" onSelect={() => wiring.onLeave(target, 'choose')} />
          </>
        )}
        {current && target.kind === 'rotation' && (
          <CoachToolbarMenuItem label="No groups" onSelect={() => wiring.onLeave(target, 'team')} />
        )}
      </CoachToolbarMenu>
    </span>
  );
}

/**
 * A set READ BACK where it is used (G1 · G5) — a read, not an editor: the set's name and shape with
 * Change…, then its groups (pairs on ONE line — "Avery & Gray · Blake & Harper"; groups one line
 * each), then who it is for and not in it (D21: named, never silently dropped), then the room's door
 * and — only when the set is shared — where else it is used, the warning before any edit.
 * Read-only (a viewer, a record) keeps the words and loses the doors; a template keeps the SHAPE
 * ("in pairs · drawn on the practice") — a template carries no players.
 */
function SetReadBack({ set, target, wiring, readOnly, withoutPeople, roster, notRepliedIds, nameOf }: {
  set: PracticeGrouping;
  target: SetTarget;
  wiring: SetsWiring;
  readOnly: boolean;
  withoutPeople: boolean;
  roster: PracticeRosterPlayer[];
  notRepliedIds: ReadonlySet<string>;
  nameOf: (playerId: string) => string;
}) {
  const words = groupingWords(set);
  const pairs = isPairSet(set);
  const filled = set.groups.filter(g => g.playerIds.length > 0);
  const elsewhere = usedInWords(wiring.uses.get(set.id), target);
  if (withoutPeople) {
    return (
      <p className={styles.ppGroupReadLine}>
        <b>{set.name.trim() || 'Unnamed groups'}</b>
        <span className={styles.ppClockSep} aria-hidden>·</span>
        <span className={styles.ppGroupReadQuiet}>{words.inWord.toLowerCase()} · drawn on the practice</span>
      </p>
    );
  }
  const unplaced = unplacedInSet(set, roster);
  const replied = unplaced.filter(p => !notRepliedIds.has(p.id));
  const notReplied = unplaced.filter(p => notRepliedIds.has(p.id));
  const names = (people: PracticeRosterPlayer[]) => people.map(p => playerDisplayName(p)).join(', ');
  const editWord = `Edit ${words.many} ›`;
  return (
    <div className={styles.ppGroupRead} data-set-read={set.id}>
      <p className={styles.ppGroupReadLine}>
        <b>{set.name.trim() || 'Unnamed groups'}</b>
        <span className={styles.ppClockSep} aria-hidden>·</span>
        <span className={styles.ppGroupReadQuiet}>{groupingShape(set)}</span>
        {!readOnly && (
          <>
            <span className={styles.ppClockSep} aria-hidden>·</span>
            <GroupsMenu label="Change…" target={target} current={set.id} wiring={wiring} />
          </>
        )}
      </p>
      {pairs && filled.length > 0 && (
        <p className={styles.ppGroupReadLine}>{filled.map(g => groupNames(g, nameOf, true)).filter(Boolean).join(' · ')}</p>
      )}
      {!pairs && filled.map(group => (
        <p key={group.id} className={styles.ppGroupReadLine}>
          <b>{group.name || 'Unnamed group'}</b>
          <span className={styles.ppClockSep} aria-hidden>·</span>
          {groupNames(group, nameOf, false)}
        </p>
      ))}
      {filled.length > 0 && unplaced.length > 0 && (
        <p className={`${styles.ppGroupReadLine} ${styles.ppGroupReadQuiet}`}>
          <b>{words.notIn}</b>
          <span className={styles.ppClockSep} aria-hidden>·</span>
          {replied.length > 0 && names(replied)}
          {replied.length > 0 && notReplied.length > 0 && <span className={styles.ppClockSep} aria-hidden>·</span>}
          {notReplied.length > 0 && (
            <>{names(notReplied)} <i>({notReplied.length === 1 ? "hasn't" : "haven't"} replied yes)</i></>
          )}
        </p>
      )}
      {(!readOnly || elsewhere) && (
        <p className={styles.ppGroupReadLine}>
          {!readOnly && (
            <button type="button" className={styles.ppTlQuietLink} onClick={() => wiring.onEdit(target, set.id)}>
              {filled.length === 0 ? `Draw the ${words.many} ›` : editWord}
            </button>
          )}
          {elsewhere && (
            <span className={styles.ppGroupReadQuiet}>
              {!readOnly && <span className={styles.ppClockSep} aria-hidden>·</span>}
              also used in {elsewhere}
            </span>
          )}
        </p>
      )}
    </div>
  );
}

/**
 * A place's WHO when it holds no set: "Whole team · Choose players… · Split into groups…", or the
 * chosen players as chips with "Split them into groups…" (the draw then deals only from them).
 * The block's line and a station's, one component — G2's door is the same door at both levels.
 */
function PeopleLine({ target, playerIds, wholeTeamWord, readOnly, wiring, nameOf, onOpenPicker }: {
  target: SetTarget;
  playerIds: readonly string[] | undefined;
  /** "Whole team" — only where the level can mean it (a block, or the station that IS its block). */
  wholeTeamWord: boolean;
  readOnly: boolean;
  wiring: SetsWiring;
  nameOf: (playerId: string) => string;
  onOpenPicker: () => void;
}) {
  const count = playerIds?.length ?? 0;
  // After "Whole team · Choose players…" the door is one more phrase on the line (" · " before it);
  // after the chips it stands on its own, as the picker button beside it does.
  const split = (afterWords: boolean) => !readOnly && (
    <span className={styles.ppTlQuietAlt}>
      {afterWords ? ' · ' : ''}
      <GroupsMenu label={count > 0 ? 'Split them into groups…' : 'Split into groups…'} target={target} wiring={wiring} />
    </span>
  );
  if (count > 0) {
    return (
      <div className={styles.ppChipWrap}>
        {playerIds!.map(pid => <span key={pid} className={styles.ppChip}>{nameOf(pid)}</span>)}
        <PlayerPickerButton count={count} readOnly={readOnly} onOpen={onOpenPicker} />
        {split(false)}
      </div>
    );
  }
  if (wholeTeamWord) {
    return (
      <div className={styles.ppWhoLine}>
        <b>Whole team</b>
        {!readOnly && (
          <span className={styles.ppTlQuietAlt}>
            {' · '}
            <button type="button" className={styles.ppTlQuietLink} onClick={onOpenPicker}>Choose players…</button>
          </span>
        )}
        {split(true)}
      </div>
    );
  }
  return (
    <div className={styles.ppChipWrap}>
      <PlayerPickerButton count={0} readOnly={readOnly} onOpen={onOpenPicker} />
      {split(false)}
    </div>
  );
}

/**
 * TONIGHT'S GROUPS — the practice level (G1 · G7), under the goal and "About this practice". Every
 * set made tonight, whichever block made it: its name and shape, its names, where it is used, and
 * the room's door. Before any set exists the fold is ONE quiet line, "+ Groups for tonight" — the
 * grammar of the focus section's invitation — so a coach who thinks "groups for the night" first
 * finds it where the night's things are, and a coach who never groups anyone sees one line.
 * Read-only (a viewer, a record) and in a template it lists without doors.
 */
function GroupsFold({ groupings, wiring, readOnly, withoutPeople, roster, notRepliedIds, nameOf, open, onToggle, onMake }: {
  groupings: readonly PracticeGrouping[];
  wiring: SetsWiring;
  readOnly: boolean;
  withoutPeople: boolean;
  roster: PracticeRosterPlayer[];
  notRepliedIds: ReadonlySet<string>;
  nameOf: (playerId: string) => string;
  open: boolean;
  onToggle: () => void;
  /** "+ Make groups" / "+ Groups for tonight" — a new set, used by nothing yet, the room open on it. */
  onMake: () => void;
}) {
  const writable = !readOnly && !withoutPeople;
  if (groupings.length === 0) {
    if (!writable) return null;
    return (
      <div className={styles.ppFold} data-groups-fold>
        <div className={styles.ppFoldHead}>
          <button type="button" className={styles.ppFoldToggle} onClick={onMake}>
            <Plus size={14} aria-hidden className={styles.ppFoldChevron} />
            <span className={styles.ppFoldTitle}>Groups for tonight</span>
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className={styles.ppFold} data-groups-fold>
      <FoldHead title="Groups" summary={`· ${groupings.length} for ${withoutPeople ? 'this template' : 'tonight'}`}
        open={open} onToggle={onToggle} />
      {open && (
        <div className={`${styles.ppFoldBody} ${styles.ppSetList}`}>
          {groupings.map(set => {
            const words = groupingWords(set);
            const pairs = isPairSet(set);
            const filled = set.groups.filter(g => g.playerIds.length > 0);
            const where = usedInWords(wiring.uses.get(set.id));
            const unplaced = withoutPeople ? [] : unplacedInSet(set, roster);
            return (
              <div key={set.id} className={styles.ppSetRow}>
                <div className={styles.ppSetRowHead}>
                  <b>{set.name.trim() || 'Unnamed groups'}</b>
                  <span className={styles.ppGroupReadQuiet}>
                    {withoutPeople ? `${words.inWord.toLowerCase()} · drawn on the practice` : groupingShape(set)}
                  </span>
                  {writable && (
                    <button type="button" className={`${styles.ppTlQuietLink} ${styles.ppSetRowEdit}`}
                      onClick={() => wiring.onEdit(null, set.id)}>
                      {filled.length === 0 ? `Draw the ${words.many} ›` : 'Edit ›'}
                    </button>
                  )}
                </div>
                {!withoutPeople && filled.length > 0 && (
                  <p className={styles.ppGroupReadLine}>
                    {pairs
                      ? filled.map(g => groupNames(g, nameOf, true)).filter(Boolean).join(' · ')
                      : filled.map(g => `${g.name} · ${groupNames(g, nameOf, false)}`).join(' — ')}
                  </p>
                )}
                {filled.length > 0 && unplaced.length > 0 && (
                  <p className={`${styles.ppGroupReadLine} ${styles.ppGroupReadQuiet}`}>
                    {words.notIn} · {unplaced.map(p => playerDisplayName(p)).join(', ')}
                    {unplaced.some(p => notRepliedIds.has(p.id)) && <i> (some haven&apos;t replied yes)</i>}
                  </p>
                )}
                <p className={`${styles.ppGroupReadLine} ${styles.ppGroupReadQuiet}`}>
                  {where ? `Used in ${where}` : 'Not used by any block yet'}
                </p>
              </div>
            );
          })}
          {writable && (
            <p className={styles.ppGroupReadLine}>
              <button type="button" className={styles.ppTlQuietLink} onClick={onMake}>+ Make groups</button>
              {wiring.canCopyFromPractice && (
                <>
                  <span className={styles.ppClockSep} aria-hidden>·</span>
                  <button type="button" className={styles.ppTlQuietLink}
                    onClick={() => wiring.onFromPractice(null)}>From another practice…</button>
                </>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * "Groups from another practice" (G6 — D21's third way, "same groups as last practice", ruled
 * 2026-07-31 and first built here): every set with anyone in it that another practice this season
 * holds, newest first, each with its names and "Use these". It COPIES — a plan belongs to one
 * practice (D7), so a change tonight never rewrites Tuesday — and anyone no longer on the roster is
 * left behind. The pitcher-and-catcher win: batteries are made once a season, not once a practice.
 */
function GroupsFromPracticeSheet({ sets, nameOf, onPick, onClose }: {
  sets: readonly GroupingElsewhere[];
  nameOf: (playerId: string) => string;
  onPick: (from: GroupingElsewhere) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFloor(true, panelRef, { onClose });
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q ? sets.filter(s => `${s.set.name} ${s.eventName}`.toLowerCase().includes(q)) : sets;
  const dayOf = (iso: string | null) => (iso ? formatInOrgZone(iso, { weekday: 'short', month: 'short', day: 'numeric' }) : '');
  return (
    <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Groups from another practice"
        className={`${styles.modal} ${styles.modalScrollBody}`}>
        <CoachModalHeader onClose={onClose} closeAriaLabel="Close" title="Groups from another practice" />
        <div className={`${styles.scrollPane} ${styles.ppGroupsBody}`}>
          {sets.length > 4 && (
            <input className={styles.input} type="search" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search practices or groups" aria-label="Search practices or groups" />
          )}
          {shown.length === 0 && <p className={styles.formHint}>Nothing matches “{query}”.</p>}
          {shown.map(from => {
            const pairs = isPairSet(from.set);
            const filled = from.set.groups.filter(g => g.playerIds.length > 0);
            const line = pairs
              ? filled.map(g => groupNames(g, nameOf, true)).filter(Boolean).join(' · ')
              : filled.map(g => `${g.name} · ${groupNames(g, nameOf, false)}`).join(' — ');
            return (
              <div key={`${from.eventId}:${from.set.id}`} className={styles.ppSetPick}>
                <div className={styles.ppSetPickBody}>
                  <b>{from.set.name.trim() || 'Unnamed groups'}</b>
                  <span className={styles.ppGroupReadQuiet}> · {groupingShape(from.set)} · {dayOf(from.startsAt) || from.eventName}</span>
                  {line && <p className={styles.ppGroupReadLine}>{line}</p>}
                </div>
                <button type="button" className={styles.btnSecondary} onClick={() => onPick(from)}>Use these</button>
              </div>
            );
          })}
          <p className={styles.formHint}>Newest first, this season only. Anyone no longer on the team is left behind.</p>
        </div>
      </div>
    </div>
  );
}

// ── Block ────────────────────────────────────────────────────────────────────

// ── The drill picker (Phase 2) ────────────────────────────────────────────────

/**
 * "From your drills" / "From your circuits" / "Write one" — the sheet that puts a library thing on
 * the page for anyone without a mouse on a wide desktop: the phone, the tablet, the keyboard, and
 * "+ Stations" / "Swap drill" at every width (stage 4, L5 keeps it whole).
 *
 * ⚠ **Preview before adding earns its place BECAUSE the drill arrives read-only.** A coach cannot
 * quietly fix the words afterwards (they would have to detach), so being able to read the whole
 * thing before committing is the difference between four taps and an undo. Since stage 4 (L3) the
 * row opens IN PLACE as the Preview — the same card the docked panel and the tab's phone reflow
 * use — with "Add to the practice" under it.
 *
 * ⚠ **"Write one" is byte-for-byte the old behaviour.** A coach who never touches the library
 * loses nothing and is never nagged toward it — and on an EMPTY library this sheet opens straight
 * onto "Write one", so a new coach never meets a blank list first.
 *
 * ⚠ "From your circuits" is offered for a BLOCK only (stage 4, L9): a circuit is a block, never a
 * station of one, so "Add a station" and "Swap drill" keep their two tabs.
 */
function DrillPickerSheet({
  drills, circuits, title, writeLabel, equipmentTags, onPick, onPickCircuit, onWriteOne, onClose,
}: {
  drills: RepTeamDrill[];
  /** Offered only when this pick makes a BLOCK; absent for a station or a swap. */
  circuits?: RepTeamCircuit[];
  title: string;
  writeLabel: string;
  equipmentTags: PickableTag[];
  onPick: (drill: RepTeamDrill) => void;
  onPickCircuit?: (circuit: RepTeamCircuit) => void;
  /** Absent when "Start from a drill ›" opens this from INSIDE a station being written — a "Write
   *  one" tab there would be the screen underneath it (S2). */
  onWriteOne?: () => void;
  onClose: () => void;
}) {
  const hasDrills = drills.length > 0;
  const hasCircuits = !!circuits && circuits.length > 0 && !!onPickCircuit;
  const [tab, setTab] = useState<'drills' | 'circuits' | 'write'>(hasDrills ? 'drills' : hasCircuits ? 'circuits' : 'write');
  // One face and nothing to switch to — no tab row.
  const tabbed = !!onWriteOne || (!!circuits && !!onPickCircuit);

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

        {tabbed && (
          <div className={styles.ppDrillTabsWrap}>
            <div className={`${styles.segChoice} ${styles.segChoiceFull}`} role="tablist">
              <button type="button" role="tab" aria-selected={tab === 'drills'} disabled={!hasDrills}
                className={`${styles.segBtn}${tab === 'drills' ? ` ${styles.segBtnActive}` : ''}`}
                onClick={() => setTab('drills')}>From your drills</button>
              {circuits && onPickCircuit && (
                <button type="button" role="tab" aria-selected={tab === 'circuits'} disabled={!hasCircuits}
                  className={`${styles.segBtn}${tab === 'circuits' ? ` ${styles.segBtnActive}` : ''}`}
                  onClick={() => setTab('circuits')}>From your circuits</button>
              )}
              {onWriteOne && (
                <button type="button" role="tab" aria-selected={tab === 'write'}
                  className={`${styles.segBtn}${tab === 'write' ? ` ${styles.segBtnActive}` : ''}`}
                  onClick={() => setTab('write')}>Write one</button>
              )}
            </div>
          </div>
        )}

        {tab === 'write' && onWriteOne ? (
          <div className={styles.ppDrillWrite}>
            <p className={styles.formHint}>
              {hasDrills
                ? 'Write it here and it stays with this practice. You can save it to your drills afterwards.'
                : 'You haven’t saved any drills yet. Write this one here — you can save it to your drills afterwards, and it’s there next time.'}
            </p>
            <button type="button" className={styles.btnPrimary} onClick={onWriteOne}>{writeLabel}</button>
          </div>
        ) : tab === 'circuits' && circuits && onPickCircuit ? (
          <div className={styles.ppPickList}>
            <LibraryBrowser kind="circuits" circuits={circuits} equipmentTags={equipmentTags} addLabel="Add" onAddCircuit={onPickCircuit} />
          </div>
        ) : (
          <div className={styles.ppPickList}>
            <LibraryBrowser kind="drills" drills={drills} equipmentTags={equipmentTags} addLabel="Add" onAddDrill={onPick} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The card LIST with its search box and tag chips — the one browser the picker sheet and the
 * docked panel share (stage 4, L3 · L5: "one card, three homes" — the tab's phone reflow is the
 * third). The same search-and-filter predicate as the tabs (`filterTagged`), the same sort
 * (`sortDrillsForPicker`: club first, then A–Z; circuits A–Z), so no two lists can drift. A row
 * opens in place as the Preview; `handle` wires the grip when the caller can drag (the panel, with
 * a mouse). Nothing here mutates the plan — Add and the drop are the caller's.
 */
function LibraryBrowser({
  kind, drills = [], circuits = [], equipmentTags, addLabel, onAddDrill, onAddCircuit, draggable,
}: {
  kind: 'drills' | 'circuits';
  /** Only the face being shown needs its list and its Add — the picker sheet shows one at a time. */
  drills?: RepTeamDrill[];
  circuits?: RepTeamCircuit[];
  equipmentTags: PickableTag[];
  addLabel: string;
  onAddDrill?: (drill: RepTeamDrill) => void;
  onAddCircuit?: (circuit: RepTeamCircuit) => void;
  /** The docked panel's rows lift (mouse only); the picker's never do. */
  draggable?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<Set<string>>(() => new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const items: readonly { tags: { id: string; name: string }[] }[] = kind === 'drills' ? drills : circuits;
  const shownDrills = useMemo(
    () => (kind === 'drills' ? filterTagged(sortDrillsForPicker(drills), query, tagFilter) : []),
    [kind, drills, query, tagFilter],
  );
  const shownCircuits = useMemo(
    () => (kind === 'circuits' ? filterTagged([...circuits].sort((a, b) => a.name.localeCompare(b.name)), query, tagFilter) : []),
    [kind, circuits, query, tagFilter],
  );
  const noun = kind === 'drills' ? 'drills' : 'circuits';
  return (
    <>
      <LibraryFilterBar items={items} noun={noun} query={query} tagFilter={tagFilter} onQuery={setQuery} onTagFilter={setTagFilter} />
      <LibraryList>
        {shownDrills.length === 0 && shownCircuits.length === 0 && <p className={styles.formHint}>No {noun} match that.</p>}
        {shownDrills.map(drill => (
          <LibraryPanelRow key={drill.id} kind="drill" drill={drill} equipmentTags={equipmentTags}
            open={openId === drill.id} onToggle={() => setOpenId(id => (id === drill.id ? null : drill.id))}
            addLabel={addLabel} onAdd={() => onAddDrill?.(drill)} draggable={!!draggable} />
        ))}
        {shownCircuits.map(circuit => (
          <LibraryPanelRow key={circuit.id} kind="circuit" circuit={circuit} equipmentTags={equipmentTags}
            open={openId === circuit.id} onToggle={() => setOpenId(id => (id === circuit.id ? null : circuit.id))}
            addLabel={addLabel} onAdd={() => onAddCircuit?.(circuit)} draggable={!!draggable} />
        ))}
      </LibraryList>
    </>
  );
}

/**
 * The DOCKED LIBRARY panel (stage 4, L5) — beside the sheet on a wide desktop, on demand and
 * remembered. Not a second library: the same rows the Drills tab shows, in the card face the tab
 * uses at 390 — search, the tag chips, a row per drill with a grip and an Add, a row that opens in
 * place as the Preview, "+ New drill" at its foot. Its head switches Drills · Circuits once the
 * team has a circuit (L9); a circuit row drags into a gap only. Templates are not in it.
 */
function LibraryPanel({
  drills, circuits, equipmentTags, canWrite, circuitsHref, onAddDrill, onAddCircuit, onNewDrill, onClose,
}: {
  drills: RepTeamDrill[];
  circuits: RepTeamCircuit[];
  equipmentTags: PickableTag[];
  canWrite: boolean;
  circuitsHref: string;
  onAddDrill: (drill: RepTeamDrill) => void;
  onAddCircuit: (circuit: RepTeamCircuit) => void;
  onNewDrill: () => void;
  onClose: () => void;
}) {
  const hasCircuits = circuits.length > 0;
  const [face, setFace] = useState<'drills' | 'circuits'>('drills');
  const shown = hasCircuits ? face : 'drills';
  return (
    <aside className={styles.ppLibrary} aria-label="Your library" data-testid="library-panel">
      <div className={styles.ppLibraryHead}>
        <span className={styles.ppLibraryTitle}>{hasCircuits ? 'Your library' : 'Your drills'}</span>
        <button type="button" className={styles.ppIconBtn} aria-label="Close the library" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      {hasCircuits && (
        <div className={styles.ppDrillTabsWrap}>
          <div className={`${styles.segChoice} ${styles.segChoiceFull}`} role="tablist" aria-label="Drills or circuits">
            <button type="button" role="tab" aria-selected={shown === 'drills'}
              className={`${styles.segBtn}${shown === 'drills' ? ` ${styles.segBtnActive}` : ''}`}
              onClick={() => setFace('drills')}>
              Drills <span className={styles.ppLibraryCount}>{drills.length}</span>
            </button>
            <button type="button" role="tab" aria-selected={shown === 'circuits'}
              className={`${styles.segBtn}${shown === 'circuits' ? ` ${styles.segBtnActive}` : ''}`}
              onClick={() => setFace('circuits')}>
              Circuits <span className={styles.ppLibraryCount}>{circuits.length}</span>
            </button>
          </div>
        </div>
      )}
      <div className={styles.ppLibraryBody}>
        {shown === 'drills' && drills.length === 0 ? (
          <p className={styles.formHint}>No drills yet — write one here, or save a block you like from the plan.</p>
        ) : (
          <LibraryBrowser kind={shown} drills={drills} circuits={circuits} equipmentTags={equipmentTags}
            addLabel="Add" onAddDrill={onAddDrill} onAddCircuit={onAddCircuit} draggable />
        )}
      </div>
      {canWrite && (
        <div className={styles.ppLibraryFoot}>
          {shown === 'drills' ? (
            <button type="button" className={styles.ppAddInline} onClick={onNewDrill}><Plus size={13} aria-hidden /> New drill</button>
          ) : (
            <a className={styles.ppAddInline} href={circuitsHref}><Plus size={13} aria-hidden /> New circuit</a>
          )}
        </div>
      )}
    </aside>
  );
}

/** One row of the browser — a drill's or a circuit's card, with its grip when it can be carried. */
function LibraryPanelRow({
  kind, drill, circuit, equipmentTags, open, onToggle, addLabel, onAdd, draggable,
}: {
  kind: 'drill' | 'circuit';
  drill?: RepTeamDrill;
  circuit?: RepTeamCircuit;
  equipmentTags: PickableTag[];
  open: boolean;
  onToggle: () => void;
  addLabel: string;
  onAdd: () => void;
  draggable: boolean;
}) {
  const id = kind === 'drill' ? `drill:${drill!.id}` : `circuit:${circuit!.id}`;
  const name = kind === 'drill' ? drill!.name : circuit!.name;
  const data: DragData = kind === 'drill' ? { kind: 'drill', drill: drill! } : { kind: 'circuit', circuit: circuit! };
  const { setNodeRef, listeners, isDragging } = useDraggable({ id, data, disabled: !draggable });
  const line = kind === 'drill' ? { text: drillCardLine(drill!), quiet: false } : circuitCardLine(circuit!);
  return (
    <LibraryCard
      name={name}
      tags={kind === 'drill' ? drill!.tags : circuit!.tags}
      shared={kind === 'drill' && drill!.teamId === null}
      facts={kind === 'drill' ? drillCardFacts(drill!) : circuitCardFacts(circuit!)}
      line={line.text} quietLine={line.quiet}
      lifted={isDragging}
      grip={draggable ? (
        <span ref={setNodeRef} {...listeners} className={styles.libCardGrip} aria-label={`Drag ${name}`} title={`Drag ${name}`}>
          <GripVertical size={14} aria-hidden />
        </span>
      ) : undefined}
      open={open} onToggle={onToggle}
      actions={<button type="button" className={styles.libCardAdd} onClick={onAdd}>+ {addLabel}</button>}
    >
      {kind === 'drill' ? <DrillPreviewBody drill={drill!} equipmentTags={equipmentTags} /> : <CircuitPreviewBody circuit={circuit!} />}
      <div className={styles.libCardFoot}>
        <button type="button" className={styles.btnPrimary} onClick={onAdd}>Add to the practice</button>
      </div>
    </LibraryCard>
  );
}

/** One of the team's OWN library items a save window can save over (save-over D1). */
interface SaveOverTarget {
  id: string;
  name: string;
  /** Its tags now — the picker starts from these once the name matches (D6). */
  tagIds: string[];
  /** Its Now line in the question. */
  now: string;
}

/** "Stable base, shorter distance · 4 coaching points · Balls · Throwing, Warm-up" — a drill in one
 *  line, for the save question's Now and After. */
function drillFactsLine(
  description: string | null | undefined, points: readonly string[] | null | undefined,
  kit: readonly string[], tagNames: readonly string[],
): string {
  const first = description?.trim().split('\n')[0];
  const n = points?.length ?? 0;
  return [
    first || null,
    n ? `${n} coaching point${n === 1 ? '' : 's'}` : null,
    kit.length ? kit.join(', ') : null,
    tagNames.length ? tagNames.join(', ') : null,
  ].filter(Boolean).join(' · ') || 'No words written yet';
}

/** "25 min · 4 stations · Fielding" — the library card's shape line plus the tags, for the save question. */
function circuitFactsLine(block: PracticePlanBlock, tagNames: readonly string[]): string {
  return [circuitCardFacts({ block }), tagNames.join(', ')].filter(Boolean).join(' · ');
}

/** How many of a drill's upcoming places the question names before "and N more". */
const REACH_SHOWN = 6;

/**
 * "Upcoming practices pick it up" — what saving over a drill reaches (owner ruling D3, 2026-10-02):
 * this team's practices that haven't started and still have the drill linked, then its templates
 * and circuits (D7). The past is named as kept, because that is the first thing a coach wonders.
 */
function DrillReachNote({ reach }: { reach: { reach: DrillReach | null } | null }) {
  const r = reach?.reach;
  const items = r ? [
    ...r.practices.map(p => `${formatInOrgZone(p.startsAt, { weekday: 'short', month: 'short', day: 'numeric' })} · ${p.name}`),
    ...r.templates.map(n => `The template ${n}`),
    ...r.circuits.map(n => `The circuit ${n}`),
  ] : [];
  const more = items.length - REACH_SHOWN;
  return (
    <div className={styles.ppSaveReach}>
      <p className={styles.ppSaveReachHead}>Upcoming practices pick it up</p>
      {!reach ? <p className={styles.formHint}>Checking…</p>
        : !r ? <p className={styles.formHint}>Every upcoming practice that uses it.</p>
        : items.length === 0 ? <p className={styles.formHint}>No upcoming practice uses it yet.</p>
        : (
          <ul className={styles.ppSaveReachList}>
            {items.slice(0, REACH_SHOWN).map((t, i) => <li key={i}>{t}</li>)}
            {more > 0 && <li>and {more} more</li>}
          </ul>
        )}
      <p className={styles.formHint}>Past practices keep the version they ran.</p>
    </div>
  );
}

/**
 * "Save to my drills…" (D18; a bare written block too since stage 4's L1) and "Save to my
 * circuits…" (stage 4, L9) — ONE dialog, the word by shape.
 *
 * ⚖ **THE NAME DECIDES** (save-over, owner rulings D1 · D5, 2026-10-02). A Name field, filled in
 * with the station's name or the block's title: a new name saves a new one, and a name matching one
 * of the team's OWN drills or circuits (capitals and spaces aside — the database's rule; a club drill
 * is never matched, D12) turns the button into the red "Update “X”…". That opens the question as a
 * second view INSIDE this window (`SaveOverQuestion`) with its own Back step — never a pop-up. The
 * name is also what fixed bug 1 (D4): an untitled block used to promise "Block 3" and send nothing.
 *
 * ⚖ **TAGS** (D2 · D6): whatever is picked here is what the saved one carries. Once the name matches,
 * the picker starts from that item's own tags (until the coach picks), so an Update nobody meant as
 * a re-tag never wipes them.
 *
 * ⚖ **A NEW ONE PAST THE LIMIT IS STOPPED HERE** (D4, bug 2): the window says so and Save stays off,
 * so a circuit's ticked stations are never made into drills for a circuit that is then refused. An
 * Update adds nothing, so it works at any limit.
 *
 * Anything more and a coach mid-plan simply won't do it. The sentence names what travels and what
 * does NOT, because that is the one thing that could surprise someone at this moment.
 *
 * ⚠ The TICK is the owner's scenario (L9): "also save its N written stations as drills" — ticked,
 * the drills are created FIRST and the saved circuit's stations point at them; tonight's block is
 * left exactly as it is. Off by default.
 *
 * ⚠ The tick is a LIST once it is on (the save-dialog follow-up, owner rulings S1–S3, 2026-09-17).
 * Shut, the dialog is exactly the one-tick dialog above — the typed stations' names in a run after
 * the label, nothing asked of a coach who does not tick. The first press on the master turns the
 * run into a row per typed station, all on, and the master becomes tri-state (a dash while some are
 * off; a press on it turns everything on, or everything off). The rows stay once opened, so
 * nothing collapses under the cursor. A typed station whose name the library already holds is a
 * row WITH A NOTE, not a missing name (S2): kept ticked, the circuit's station becomes that drill;
 * unticked, tonight's words stay as a plain station. One quiet line names the stations that came
 * from drills and says they stay linked (S3) — it is the answer to "does it know", and it is absent
 * when every station was typed.
 */
function PromoteDialog({
  kind, defaultName, sentence, tags, onCreateTag, tick, busy, error, onSave, onClose, manage, onManageChanged,
  targets, limitLine, after, loadReach,
}: {
  kind: 'drill' | 'circuit';
  /** The station's name or the block's title — empty for an untitled block, which then asks (D4). */
  defaultName: string;
  /** What travels and what stays — the caller's, because a station, a bare block and a circuit
   *  each give a different thing (a block its minutes; a circuit its stations and the groups). */
  sentence: string;
  tags: PickableTag[];
  onCreateTag: (name: string) => Promise<PickableTag | null>;
  /** The circuit's second question — a row per typed station (S1 · S2) and the from-drills line (S3). */
  tick?: { rows: TickRow[]; fromLine: string | null };
  busy: boolean;
  error: string;
  /** The team's OWN active items of this kind — what a typed name can match (D1, D12). */
  targets: SaveOverTarget[];
  /** Set when a NEW one would pass the team's limit — said here, and Save stays off (D4). */
  limitLine: string | null;
  /** The question's After line, from the tags as picked. */
  after: (tagIds: string[]) => string;
  /** A drill's reach (D3) — absent for a circuit, whose update reaches the library only (D10). */
  loadReach?: (id: string) => Promise<DrillReach | null>;
  /** The name, the tags chosen, the typed stations kept ticked (a circuit) — and the item being
   *  saved over, or null for a new one. */
  onSave: (name: string, tagIds: string[], pickedStationIds: string[], update: SaveOverTarget | null) => void;
  onClose: () => void;
  manage?: TagManageConfig;
  onManageChanged?: () => void;
}) {
  const [name, setName] = useState(defaultName);
  /**
   * The tags the coach picked, and WHICH item they were picked against (its id, or '' for a new
   * one). Until the coach picks for the item the name matches now, the tags are that item's own
   * (D6) — so picks made against "A" never ride along when the name is retyped to match "B".
   */
  const [tagPick, setTagPick] = useState<{ for: string; tagIds: string[] } | null>(null);
  /** The typed stations kept ticked (by station id); empty = the master is off. */
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  /** True once the master has been pressed — from then on the run of names is a list of rows. */
  const [rowsOpen, setRowsOpen] = useState(false);
  /** The item the question is about — set by "Update “X”…", cleared by Back / Keep it. */
  const [updating, setUpdating] = useState<SaveOverTarget | null>(null);
  const [reach, setReach] = useState<{ id: string; reach: DrillReach | null } | null>(null);
  /* The dialog floor (D9), busy-gated: while the save is in flight the sheet holds, so a write is
     never torn down under its own request. The tag list inside claims its own Escape while open
     (`escapeOwnership.ts`) — it closes itself, not the sheet. */
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFloor(true, panelRef, { onClose, busy });
  const backToForm = () => setUpdating(null);
  useBackStep(!!updating, backToForm);
  /* The question's reach, read when it opens; a late answer for an item no longer asked about is
     dropped by the id it carries. */
  useEffect(() => {
    if (!updating || !loadReach) return;
    let live = true;
    void loadReach(updating.id).then(r => { if (live) setReach({ id: updating.id, reach: r }); });
    return () => { live = false; };
  }, [updating, loadReach]);
  const noun = kind === 'drill' ? 'drills' : 'circuits';
  const match = libraryNameMatch(targets, name);
  const matchKey = match?.id ?? '';
  const tagIds = tagPick && tagPick.for === matchKey ? tagPick.tagIds : (match?.tagIds ?? []);
  const rows = tick?.rows ?? [];
  const allPicked = rows.length > 0 && rows.every(r => picked.has(r.station.id));
  const somePicked = rows.some(r => picked.has(r.station.id));
  const pickedIds = rows.filter(r => picked.has(r.station.id)).map(r => r.station.id);
  /* The master's dash — `indeterminate` is a DOM property, not an attribute, so it is set by hand. */
  const masterRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (masterRef.current) masterRef.current.indeterminate = somePicked && !allPicked; }, [somePicked, allPicked, updating]);
  function pressMaster() {
    setRowsOpen(true);
    setPicked(allPicked ? new Set() : new Set(rows.map(r => r.station.id)));
  }
  function toggleRow(id: string) {
    setPicked(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  return (
    <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Save to my ${noun}`}
        aria-busy={busy || undefined} className={styles.modal}>
        <div className={styles.modalHeader}>
          {/* On the question the bar is a Back that names where it goes (the portal's labelled back). */}
          {updating ? (
            <button type="button" className={`${styles.modalBackBtn} ${styles.modalBackLabelled}`}
              aria-label={`Back to Save to my ${noun}`} disabled={busy} onClick={backToForm}>
              <ArrowLeft size={20} aria-hidden /><span className={styles.modalBackWord}>Save to my {noun}</span>
            </button>
          ) : <h3 className={styles.modalTitle}>Save to my {noun}</h3>}
          {/* Busy-gated like Escape and the backdrop: closed mid-save, the editor would be editable
              again while the save is still landing, and the follow-up (followDrill) would lay the
              plan as it was BEFORE those edits back over them. */}
          <button type="button" className={styles.modalCloseBtn} aria-label="Close" disabled={busy} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {updating ? (
          <div className={styles.ppDrillWrite}>
            <SaveOverQuestion
              question={`Update “${updating.name}”?`}
              sub={kind === 'drill'
                ? 'Its words, coaching points, equipment and tags become tonight’s.'
                : 'Its stations, their setup, points and kit, and its tags become this block’s.'}
              now={updating.now} after={after(tagIds)}
              confirmLabel={kind === 'drill' ? 'Update drill' : 'Update circuit'} busyLabel="Updating…" busy={busy} error={error}
              onConfirm={() => onSave(updating.name, tagIds, pickedIds, updating)} onBack={backToForm}>
              {kind === 'drill'
                ? <DrillReachNote reach={reach && reach.id === updating.id ? reach : null} />
                : <p className={styles.formHint}>Practices that already used it keep theirs. The next time you place it, it’s this version.</p>}
            </SaveOverQuestion>
          </div>
        ) : (
          <>
            <div className={styles.ppDrillWrite}>
              <label className={styles.ppField}>
                <span className={styles.ppFieldLabel}>Name</span>
                <input className={styles.input} value={name} autoFocus
                  maxLength={kind === 'drill' ? MAX_DRILL_NAME_LEN : MAX_CIRCUIT_NAME_LEN}
                  placeholder={kind === 'drill' ? 'What would you call this drill?' : 'What would you call this circuit?'}
                  onChange={e => setName(e.target.value)} />
              </label>
              {match && <SaveOverMatchLine>You already have a {kind} called this. Saving updates it.</SaveOverMatchLine>}
              {!match && limitLine && <SaveOverMatchLine>{limitLine}</SaveOverMatchLine>}
              <TagPicker
                label="Tags — optional"
                all={tags}
                selected={tagIds}
                onChange={next => setTagPick({ for: matchKey, tagIds: next })}
                onCreate={onCreateTag}
                manage={manage} onManageChanged={onManageChanged}
              />
              {kind === 'circuit' && rows.length > 0 && (
                <label className={styles.ppTickRow}>
                  <input ref={masterRef} type="checkbox" checked={allPicked} onChange={pressMaster} />
                  <span>
                    Also save {rows.length === 1 ? 'its 1 written station' : `its ${rows.length} written stations`} as drills, with these tags
                    {!rowsOpen && <span className={styles.ppTickNames}> — {rows.map(r => r.station.name.trim()).join(' · ')}</span>}
                  </span>
                </label>
              )}
              {kind === 'circuit' && rowsOpen && rows.length > 0 && (
                <div className={styles.ppTickRows} role="group" aria-label="Stations to save as drills">
                  {rows.map(({ station, existing }) => (
                    /* The label is the NAME alone; the S2 note is described-by, so a screen reader hears
                       "Cone weave, checkbox" and then the note — not a sentence-long control name. The
                       separator is real text (hidden on a phone, where the note drops under the name)
                       rather than generated content, which some readers voice and others skip. */
                    <div key={station.id} className={`${styles.ppTickRow} ${styles.ppTickSub}`}>
                      <input id={`tick-${station.id}`} type="checkbox" checked={picked.has(station.id)} onChange={() => toggleRow(station.id)}
                        aria-describedby={existing ? `tick-note-${station.id}` : undefined} />
                      <span>
                        <label htmlFor={`tick-${station.id}`}>{station.name.trim()}</label>
                        {existing && (
                          <>
                            <span className={styles.ppTickSep} aria-hidden="true"> · </span>
                            <span id={`tick-note-${station.id}`} className={styles.ppTickNames}>already in {existing.teamId === null ? 'the club’s' : 'your'} drills — the circuit uses that one, with its words</span>
                          </>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {kind === 'circuit' && tick?.fromLine && <p className={styles.ppTickFrom}>{tick.fromLine}</p>}
              <p className={styles.formHint}>{sentence}</p>
              {error && <p className={styles.errorText}>{error}</p>}
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.btnGhost} onClick={onClose}>Cancel</button>
              {match ? (
                <button type="button" className={styles.btnDanger} disabled={busy} onClick={() => setUpdating(match)}>
                  Update &ldquo;{match.name}&rdquo;…
                </button>
              ) : (
                <button type="button" className={styles.btnPrimary} disabled={busy || !name.trim() || !!limitLine}
                  onClick={() => onSave(name.trim(), tagIds, pickedIds, null)}>
                  {busy ? 'Saving…' : `Save to my ${noun}`}
                </button>
              )}
            </div>
          </>
        )}
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
/** True while a block is exactly what `addBlock` made — an id, an empty title, the default length,
 *  and nothing else set (an empty list or empty string counts as unset). */
function isUntouchedNewBlock(block: PracticePlanBlock): boolean {
  return Object.entries(block).every(([key, value]) => {
    if (key === 'id') return true;
    if (key === 'title') return !String(value ?? '').trim();
    if (key === 'duration') {
      const d = value as PracticePlanBlock['duration'];
      return !d.restOfPractice && d.minutes === DEFAULT_BLOCK_MINUTES;
    }
    return value == null || value === '' || (Array.isArray(value) && value.length === 0);
  });
}

/**
 * When a dialog closes, focus the row of the thing it LAST showed — not the door that first opened
 * it (the floor's own restore, captured once for a whole walk), and never a row that no longer
 * exists: a block or station deleted from its own screen took its row with it and left focus on
 * <body> (/review, 2026-09-23). `resolve` names the row, or a fallback when it is gone. Runs after
 * the floor's cleanup (a parent's effects after its children's), and only when EVERY open dialog
 * holds the target (the block's phone sheet holds its stations) — a dialog that took over in the
 * same commit ("Start from a drill" hands straight to the drill sheet) keeps focus, whatever order
 * the dialogs mount in. `resolve` must be stable.
 */
function useFocusLastShownOnClose(shownKey: string | null, resolve: (key: string) => HTMLElement | null) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (shownKey) { last.current = shownKey; return; }
    const key = last.current;
    last.current = null;
    const target = key ? resolve(key) : null;
    if (!target) return;
    for (const dialog of document.querySelectorAll('[role="dialog"][aria-modal="true"]')) {
      if (!dialog.contains(target)) return;
    }
    target.focus();
  }, [shownKey, resolve]);
}
/** A block's sheet closed: its row in the list, else the add row (deleting the only block). */
function blockRowFor(blockId: string): HTMLElement | null {
  return document.getElementById(`block-${blockId}`)?.querySelector<HTMLElement>('button')
    ?? document.querySelector<HTMLElement>('[data-pp-add-row]');
}
/** A station's screen closed (the key is `[blockId, stationId]`): its row's door, else the block's
 *  add control — "+ Add a station", or "+ Stations" once the block collapsed back to none (D13's
 *  reverse unmounts the one and mounts the other, so the floor's restore target is detached) — else,
 *  reading (no add control), the block itself: its phone sheet, or its card's first button. */
function stationDoorFor(key: string): HTMLElement | null {
  const [blockId, stationId] = JSON.parse(key) as [string, string];
  return document.getElementById(`station-${stationId}`)?.querySelector<HTMLElement>('[data-station-door]')
    ?? document.querySelector<HTMLElement>(`[data-pp-add-station="${CSS.escape(blockId)}"]`)
    ?? document.querySelector<HTMLElement>('[data-block-sheet]')
    ?? document.getElementById(`block-${blockId}`)?.querySelector<HTMLElement>('button')
    ?? null;
}

/**
 * ⚠ ON A PHONE A BLOCK EDITS ON ITS OWN SCREEN (practice plans on a phone, stage 1, owner ruling
 * K2 = A, 2026-09-23). In the timeline the open card was nested three deep — the sheet, the spine,
 * the card — and each layer took its padding: a 197px writing column on a 390px phone, a 106px
 * title, and a 1,013px form that pushed every block under it 895px down. So at ≤640 the timeline
 * shows every block SHUT and the open one renders here instead, as a full-screen sheet — the shape
 * the block's own station form already had one level down (`StationModal`): the fields at the
 * sheet's full width, the block's place and clock in the head, Move up · Move down · Delete beside
 * them (K3 — the reorder pair left the gutter, which is what let the clock column narrow), and a
 * pinned foot that walks the blocks without going back to the list. The way back is the head's ←
 * (and the phone's back gesture) — the foot's Done left on the §231 walk (see the foot).
 *
 * The BODY is `BlockCard`'s own, byte for byte — this component is only the container, so a field
 * can never exist in one presentation and not the other. The desktop and the 641–768 band keep
 * the block open in place, exactly as the practices re-evaluation ruled it.
 */
/**
 * The next stop, named IN FULL at the end of a phone sheet's body (§227 walk, owner 2026-09-23 —
 * option C). The phone foot's walk is compact ("‹ 2 of 3 ›"), because a named pair got ~7 letters
 * a name at 390; a coach reaches the end of a block when they are done writing it, which is when
 * they step on — so that is where "Next · 11:45 p.m. · Small-sided game" is read, as a row that
 * wraps rather than cuts. The way back is a quiet link under it. Both steps go through the walk's
 * own `onSelect`, so they are exactly the foot's arrows.
 */
function WalkOnward({ walk, noun, kicker, meta, onAdd }: {
  walk: RoomNav;
  noun: 'block' | 'station';
  /** "Next · 11:45 p.m." — the destination's clock where it has one. */
  kicker: string;
  /** One quiet line under the name — the block's length, the station's people. */
  meta?: string | null;
  /** At the last stop, the row adds one instead of saying there is none (the foot's `end`, in full).
   *  It stands even when the walk is ONE stop long — the plan's first block, just made, is exactly
   *  where the coach reaches for the next (the foot stays away: there is nothing to walk). */
  onAdd?: () => void;
}) {
  if (walk.total <= 1 && !onAdd) return null;
  return (
    <div className={styles.ppWalkOnward} data-walk-onward>
      {walk.next ? (
        <button type="button" className={styles.ppWalkNext} onClick={() => walk.onSelect(walk.next!.id)}>
          <span className={styles.ppWalkNextText}>
            <span className={styles.ppWalkNextKicker}>{kicker}</span>
            <span className={styles.ppWalkNextName}>{walk.next.label}</span>
            {meta && <span className={styles.ppWalkNextMeta}>{meta}</span>}
          </span>
          <ChevronRight size={16} aria-hidden />
        </button>
      ) : onAdd ? (
        <button type="button" className={styles.ppWalkNext} onClick={onAdd}>
          <span className={styles.ppWalkNextText}>
            <span className={styles.ppWalkNextKicker}>That’s the last {noun}</span>
            <span className={styles.ppWalkNextName}>Add a {noun}</span>
          </span>
          <Plus size={16} aria-hidden />
        </button>
      ) : (
        <p className={styles.ppWalkEnd}>That’s the last {noun}.</p>
      )}
      {walk.prev && (
        <button type="button" className={styles.ppWalkBack} onClick={() => walk.onSelect(walk.prev!.id)}>
          <ChevronLeft size={14} aria-hidden /> Back to {walk.prev.label}
        </button>
      )}
    </div>
  );
}

/**
 * ONE ANATOMY FOR THE TWO SHEETS (owner, §227 walk 2026-09-24 — "aren't they effectively the
 * same?"). The block sheet and the station form grew a week apart from two different drawings and
 * put the same things in different places. Both now read: the head — back · where you are · this
 * toggle · the bin (while editing); the body — the name first, the fields, the next stop; the foot —
 * the walk (and, on a desk only, Done — on a phone the head's ← is the one way back, §231 walk).
 *
 * The toggle is the toolbar's Edit / Done editing, one button that flips in place (so focus stays
 * on it): ✎ while reading, ✓ while writing. ON A PHONE IT IS THE GLYPH ALONE (owner, §227 walk
 * 2026-09-24: "just the pencil and checkbox is fine for mobile") — the words stay as its accessible
 * name, and on a desk they stay on screen. It edits the whole PLAN — the sheet stays open either
 * way. Absent where the page gives no door (a viewer, the template and circuit editors, the
 * closed-season reader).
 */
function SheetEditToggle({ readOnly, onEdit, onDoneEditing }: {
  readOnly: boolean;
  onEdit?: () => void;
  onDoneEditing?: () => void;
}) {
  const act = readOnly ? onEdit : onDoneEditing;
  if (!act) return null;
  return (
    <button type="button" className={`${styles.btnSecondary} ${styles.ppSheetEditDoor}`}
      aria-label={readOnly ? 'Edit' : 'Done editing'} data-on={readOnly ? undefined : 'on'} onClick={act}>
      {readOnly ? <Pencil size={15} aria-hidden /> : <Check size={16} aria-hidden />}
      <span className={styles.ppSheetEditWord} aria-hidden>{readOnly ? 'Edit' : 'Done editing'}</span>
    </button>
  );
}

/**
 * The head's bin, beside ✓ while editing (owner, §227 walk 2026-09-24: "so the user doesn't have to
 * go digging for the delete"). ⚠ IT ASKS FIRST, and that is the price of the place: a delete here is
 * immediate and autosaved with no undo — a block goes with every station in it — and the bin now
 * sits a thumb's width from ✓. The question names what goes, in the portal's own confirm.
 */
function SheetDeleteButton({ label, message, onDelete }: { label: string; message: string; onDelete: () => void }) {
  const confirm = useConfirm();
  return (
    <button type="button" className={styles.ppIconBtn} aria-label={`Delete ${label}`}
      onClick={async () => {
        const ok = await confirm({ title: `Delete ${label}?`, message, confirmText: 'Delete', cancelText: 'Keep it', tone: 'danger' });
        if (ok) onDelete();
      }}>
      <Trash2 size={15} />
    </button>
  );
}

function BlockSheet({
  bodyKey, label, eyebrow, walk, onward, onAdd, readOnly, onEdit, onDoneEditing, deleteMessage, onDelete, onClose, children,
}: {
  bodyKey: string;
  label: string;
  /** "Block 2 of 3" and the block's start ("11:00 p.m."; absent for a template, which has no clock). */
  eyebrow: { place: string; clock: string | null };
  walk: RoomNav;
  /** The next block's clock and length, for the full-name row at the body's end (`WalkOnward`). */
  onward: { kicker: string; meta: string | null };
  /** The LAST block's way on — the list's own "+ Add a block" (owner, 2026-09-28: "it's the same
   *  workflow" as the station form's). Absent while reading and on a full plan. */
  onAdd?: () => void;
  readOnly: boolean;
  /** The head's Edit / Done editing (`SheetEditToggle`) — the page's doors, absent where it gives none. */
  onEdit?: () => void;
  onDoneEditing?: () => void;
  /** What the delete question says goes — "Removes it from the plan, with its 3 stations." */
  deleteMessage: string;
  onDelete: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFloor(true, panelRef, {
    onClose,
    walk: { prev: walk.prev?.id ?? null, next: walk.next?.id ?? null, onSelect: walk.onSelect },
    focusKey: `${walk.index}:${label}`,
  });
  return (
    <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${label} — ${eyebrow.place}${eyebrow.clock ? ` · ${eyebrow.clock}` : ''}`}
        className={`${styles.modal} ${styles.modalWide} ${styles.modalScrollBody} ${styles.ppStationModal} ${styles.ppBlockSheet}`}
        data-block-sheet>
        <CoachModalHeader onClose={onClose} closeAriaLabel="Close" title={
          <span className={styles.ppBlockSheetEyebrow}>
            <b>{eyebrow.place}</b>
            {eyebrow.clock && <span>{eyebrow.clock}</span>}
          </span>
        }>
          {/* ⚠ No Move up · Move down here (stage 1b, R4 — revising K3): a block is moved from the
              LIST, by the grip on its row, where the other blocks and their times stay in view. The
              head carries Edit / Done editing, and the bin while editing — which asks first. */}
          {/* The bin comes in to the LEFT of the toggle, never in its place: ✎ and ✓ hold the same spot,
              so the finger that tapped ✎ is resting on ✓ — not on a bin that just arrived under it
              (§227 walk, 2026-09-24). The bin's slot is always in the list, so the toggle is one
              element throughout and keeps focus. */}
          {!readOnly && <SheetDeleteButton label={label} message={deleteMessage} onDelete={onDelete} />}
          <SheetEditToggle readOnly={readOnly} onEdit={onEdit} onDoneEditing={onDoneEditing} />
        </CoachModalHeader>
        <div className={`${styles.scrollPane} ${styles.ppStationBody}`}>
          {/* Keyed on the block, so a step starts the fields fresh (a picker's typed-but-unchosen
              search is local state — the station modal's /review lesson); the PANEL is not keyed,
              so the floor, its focus rule and its history step stay armed across the walk. */}
          <div key={bodyKey} className={`${styles.ppTlOpen} ${styles.ppBlockSheetBody}`}>{children}</div>
          <WalkOnward walk={walk} noun="block" kicker={onward.kicker} meta={onward.meta} onAdd={onAdd} />
        </div>
        {/* ⚠ NO "Done" IN THIS FOOT (§231 walk, owner 2026-09-25). It only closed the sheet — the
            head's ← and the phone's back gesture already do — and while writing it sat under the
            head's ✓ "Done editing", which does the opposite: ✓ ends editing and keeps the block
            open, Done left the block and kept editing. The foot is the walk alone, and a plan of
            one block has nothing to walk to. */}
        {walk.total > 1 && (
          <div className={styles.modalFooter}>
            <RoomWalkNav nav={walk} compact end={onAdd && { label: 'Add a block', onSelect: onAdd }} />
          </div>
        )}
      </div>
    </div>
  );
}

function BlockCard({
  block, index, blockCount, clock, clockPreview = false, blockStartMs, open, focusTitle, openDoors, readOnly, withoutPeople, solo,
  phone = false, sheet, onStartFromDrill,
  restTakenElsewhere, roster, notRepliedIds, sets,
  staffTags, onCreateStaffTag, staffPeople, onPickStaffPerson, mineBlocks, mineStations, equipmentTags, onCreateEquipmentTag, nameOf,
  staffManage, onStaffTagsChanged, equipmentManage, onEquipmentTagsChanged,
  onOpen, onClose, onOpenDoor, onCloseDoor, onMove, onDelete, onPatch, onOpenPicker, onAddStation, onDetachStation,
  onSwapStation, onPromoteStation, onPromoteBlock, onPromoteCircuit, onOpenStation, onPatchStation, onMoveStation,
}: {
  block: PracticePlanBlock;
  index: number;
  blockCount: number;
  clock?: BlockClock;
  /** The gutter shows a PREVIEWED start that differs from today's (a block is being carried, R4). */
  clockPreview?: boolean;
  blockStartMs?: number;
  open: boolean;
  /** The circuit editor: the block ALONE on a sheet — no collapse, no bin, no clock, no drag; the
   *  header's Retire is the only way out (stage 4, L9). */
  solo?: boolean;
  /** ≤640 (practice plans on a phone, K1): the shut row carries facts, not cut sentences, and no
   *  reorder pair — the pair lives on the block sheet's head. */
  phone?: boolean;
  /** Render the OPEN block as the phone's full-screen sheet (K2) rather than a card in the spine. */
  sheet?: { walk: RoomNav; onward: { kicker: string; meta: string | null }; onAdd?: () => void; onEdit?: () => void; onDoneEditing?: () => void };
  /** "Start from a drill ›" inside a just-added block's sheet while the coach is still on it (K4 —
   *  the editor asks first when there is anything to lose, §231 walk) — absent otherwise. */
  onStartFromDrill?: () => void;
  /** A block the coach JUST added lands with its title focused; a row they opened to read does not. */
  focusTitle: boolean;
  /** The doors standing open on THIS block while it is open — the editor owns the set (D1). */
  openDoors: ReadonlySet<BlockDoor>;
  readOnly: boolean;
  /** A TEMPLATE has no roster and no staff — the practice supplies both. */
  withoutPeople: boolean;
  /** Another block already claims "rest of practice" (D13 allows exactly one). */
  restTakenElsewhere: boolean;
  /** Tonight's roster in roster order — the groups read-out names who is in no group. */
  roster: PracticeRosterPlayer[];
  /** Who has NOT replied yes, when attendance is known (empty otherwise). */
  notRepliedIds: ReadonlySet<string>;
  /** Tonight's sets and their doors (G1–G8) — the Players lines, the stations and the circuit's board. */
  sets: SetsWiring;
  staffTags: PickableTag[];
  onCreateStaffTag?: (name: string) => Promise<PickableTag | null>;
  /** The staff picker's "People on this team" group (mig 303) — absent on a read-only surface. */
  staffPeople?: readonly PickablePerson[];
  onPickStaffPerson?: (person: PickablePerson) => Promise<PickableTag | null>;
  /** The reader's own blocks and stations, by identity — the "you" marks. */
  mineBlocks: ReadonlySet<string>;
  mineStations: ReadonlySet<string>;
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
  /** "Save to my drills…" on a BARE WRITTEN block (stage 4, L1) — absent for a viewer who can't
   *  write drills, or in a room with no library to save to. */
  onPromoteBlock?: () => void;
  /** "Save to my circuits…" on a block WITH stations (stage 4, L9) — the same door, the word by shape. */
  onPromoteCircuit?: () => void;
  /** Opens a station as a modal (D4) — the editor owns which one is open. */
  onOpenStation: (stationId: string) => void;
  /** The editor's one station patch (the modal writes through it too). */
  onPatchStation: (stationId: string, patch: Partial<PracticeStation>) => void;
  /** Reorders a station within this block — the grip's menu on the column's foot (the drag drops
   *  through the editor's `onDragEnd`). */
  onMoveStation: (stationId: string, delta: number) => void;
}) {
  const stationCount = block.stations?.length ?? 0;
  // ONE answer to "does this rotate", shared with the sanitiser, the grid and the printed sheet.
  const isRotation = blockRotates(block);
  /* A block only gains a stored rotation once the coach touches one. Until then this stand-in
     renders the empty controls — so adding a second station reveals the rotation immediately,
     without a write the coach didn't ask for. It seeds the total from the block's own length,
     which is what they just typed, and leaves the interval blank so the grid asks for it rather
     than inventing a round length. */
  const rotation: PracticeRotation = block.rotation ?? { intervalMinutes: null };
  const label = block.title || `Block ${index + 1}`;
  const stations = block.stations ?? [];
  // The set the block's own line holds (no stations, or the station that IS the block), and the
  // set its circuit rotates (G1–G8) — each read from the practice's list, never stored twice.
  const ownSet = groupingById(sets.groupings, blockOwnGroupingId(block));
  const circuitSet = isRotation ? groupingById(sets.groupings, block.rotation?.groupingId) : undefined;
  /** A block's who-word when it uses a set: "In pairs · Throwing partners". */
  const setWho = (set: PracticeGrouping) => `${groupingWords(set).inWord} · ${set.name.trim() || 'unnamed'}`;


  /* The gutter — the block's start in the org's clock, its length in small, and under them the
     reorder pair. A template has no clock (no start), so the gutter carries the length alone. Read
     aloud: it is the only place the block's time lives now that the head has given it up.
     The pair moved here from the open head (owner, on the built draw, 2026-09-15): the spine is
     the one thing a block has whether it is shut or open, so a coach reorders the evening without
     opening a row — the head had made "move this" cost a click and a scroll. Buttons, never drag
     (gloves and phones defeat drag — the Roster lesson). Absent, not disabled, on a read-only plan
     and while there is one block: nothing to reorder is not a locked control. */
  const gutterLength = formatDuration(block.duration);
  /* THE GRIP UNDER THE TIME — one handle, every width (owner, §227 walk 2026-09-24: "replace the
     up/down on desktop with the :: so both the desktop and mobile use drag and drop"). The gutter
     is the block's drag handle (stage 4, L2): a mouse lifts it after six pixels, a finger after a
     quarter-second hold (phones only — see `touchGrip`). Under the time sits the GRIP, which is also
     a menu: a click or a tap opens Move up · Move down — the groups room's chip rule, where the
     tap always works and the drag is the shortcut, and L2's "buttons everywhere" kept by the menu
     rather than by a pair of arrows. It replaced the desk's ▲▼ pair and the phone's own grip
     column (stage 1b, R4), so the row gets its width back. The list is where a move is judged: the
     other blocks and their times stay in view. Absent on a read-only plan, with one block, on the
     circuit editor's lone block, and on the sheet's copy of a block (registered under its own id
     so the list row's handle is not replaced by a disabled twin). */
  const canMove = !readOnly && !solo && !sheet && blockCount > 1;
  const { setNodeRef: setHandleRef, listeners: handleListeners, isDragging } = useDraggable({
    id: `block:${block.id}${sheet ? ':sheet' : ''}`, data: { kind: 'block', blockId: block.id, index, label } satisfies DragData, disabled: !canMove,
  });
  /* A block just added opens its SHEET with the cursor in the title (K4). `autoFocus` alone lost it:
     the sheet's dialog floor seats focus on the panel whenever focus is outside it, and in the dev
     build's double-mounted effects the floor's first cleanup hands focus back to "+ Add a block"
     before the second mount re-seats it on the panel. This effect runs after the floor's (a parent's
     effects run after its children's), so the title wins in either build.
     ⚠ ONCE PER BLOCK, keyed on the block's id — NEVER on `sheet` itself (owner-visible, 2026-09-28).
     `sheet` is a fresh object every render, so keyed on it this ran after EVERY keystroke: on a just-
     added block, typing in "What happens" put one letter there and sent the rest into the title
     (measured: "abc" → "a" in the field, "bc" on the title). The id is what makes a step from one new
     block to the next (the last block's "+ Add a block") place the cursor again. */
  const titleRef = useRef<HTMLInputElement>(null);
  const inSheet = !!sheet;
  useEffect(() => {
    if (inSheet && open && focusTitle) titleRef.current?.focus();
  }, [inSheet, open, focusTitle, block.id]);
  const lengthWord = block.duration.restOfPractice ? 'Rest of practice' : gutterLength;
  const gutter = (
    <div ref={setHandleRef} {...(canMove ? handleListeners : {})}
      className={`${styles.ppTlGutter}${canMove ? ` ${styles.ppTlGutterHandle}` : ''}`}
      data-lifted={isDragging ? 'on' : undefined} data-preview={clockPreview ? 'on' : undefined}>
      {/* A template has no clock, so the gutter carries the length — on a phone's 5rem column
          "Rest of practice" is the short "rest" the dated gutter already prints (/review, 2026-09-23). */}
      {clock ? clock.startLabel : phone && block.duration.restOfPractice ? 'rest' : gutterLength || '—'}
      {/* On a phone the length rides the row's facts line instead (K1) — the column narrows to the clock. */}
      {clock && !phone && <small>{block.duration.restOfPractice ? 'rest' : gutterLength || 'no length'}</small>}
      {/* The grip is INSIDE the handle, unshielded: pressing it and moving is the drag; pressing
          it and letting go is the menu (the kit swallows the click after a real drag). */}
      {canMove && (
        <span className={styles.ppTlMove}>
          <CoachToolbarMenu label={`Move ${label}`} variant="glyph" icon={<GripVertical size={16} aria-hidden />}>
            <CoachToolbarMenuItem label="Move up" disabled={index === 0} onSelect={() => onMove(-1)} />
            <CoachToolbarMenuItem label="Move down" disabled={index === blockCount - 1} onSelect={() => onMove(1)} />
          </CoachToolbarMenu>
        </span>
      )}
    </div>
  );
  /* A block placed from a circuit says so — one quiet line that stays through every edit (the
     template's rule, one level down; stage 4, L9). The name is the snapshot taken at placement. */
  const provenance = block.circuitName ? (
    <p className={styles.ppFromCircuit}>
      <Library size={12} aria-hidden /> Started from <strong>{block.circuitName}</strong> · changes here stay here
    </p>
  ) : null;

  if (!open) {
    /* The shut row (D6): the first line reads THROUGH a sole station — the run screen's rule, "with
       one station the station is the block" — so a drill-placed row says what the block is; with
       two or more, the block's own line is the circuit's intro. "3 stations" only when it has them
       (one station is the block, not a count); who, in the block's own word — Whole team, or the
       names chosen — only where the block itself holds the people (no stations, not a template). */
    const sole = soleStationOf(block);
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
    /* On a phone (K1) the row is the title and ONE line of facts that fit — the length (the gutter
       gave it up), who runs it, then the count — and never a cut sentence: at 234px "Dynamic
       warm-up, then partn…" said nothing the title did not. The words are one tap away in the sheet. */
    const phoneFacts = phone ? [
      clock ? lengthWord || null : null,
      withoutPeople ? null : (mergedTagNames((sole ?? block).staff, (sole ?? block).staffTagIds, staffTags)[0] ?? null),
    ] : [];
    // Who, in the block's own word (G1): the set it uses ("In pairs · Throwing partners") where the
    // block holds its people; a circuit's set after its station count.
    const rowMeta = [
      ...phoneFacts,
      stationCount >= 2 ? `${stationCount} stations` : null,
      circuitSet ? circuitSet.name.trim() || null : null,
      ownSet ? setWho(ownSet)
        : withoutPeople || stationCount > 0 ? null : playerCount > 0 ? `${playerCount} player${playerCount === 1 ? '' : 's'}` : 'Whole team',
    ].filter(Boolean).join(' · ');
    // The reader's block (mig 303): its own staff, or — when the station is the block — that
    // station's. A block whose people live on its stations wears the mark on the columns, not here.
    const mine = mineBlocks.has(block.id) || (!!sole && mineStations.has(sole.id));
    return (
      <div className={styles.ppTlRow} id={`block-${block.id}`}>
        {gutter}
        {/* The row's accessible name is its CONTENT — title, first line, watching for, who — with a
            hidden "Open" verb in front; an aria-label would replace all of that with the title
            alone (/review, 2026-09-14). The gutter before it carries the time. */}
        <button type="button" className={`${styles.ppTlClosed}${phone ? ` ${styles.ppTlClosedPhone}` : ''}`}
          {...(phone ? { 'aria-haspopup': 'dialog' as const } : { 'aria-expanded': false })} onClick={onOpen}>
          <span className="sr-only">Open </span>
          <span className={styles.ppTlTitle}>
            {block.title || <span className={styles.ppTlUntitled}>{label}</span>}
            {isRotation && <span className={styles.ppShapeTag}><Repeat size={11} aria-hidden /> Rotation</span>}
            {mine && <YouMark />}
          </span>
          {!phone && firstLine && <span className={styles.ppTlDesc}>{firstLine}</span>}
          {!phone && watchingFor && <span className={styles.ppTlWatch}><b>Watching for:</b> {watchingFor}</span>}
          {rowMeta && <span className={styles.ppTlMeta}>{rowMeta}</span>}
          {phone && <ChevronRight size={18} aria-hidden className={styles.ppTlRowChevron} />}
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
  /* Three shapes, one body (stage 3, D1 · D2): no stations — the block is the activity and holds
     its own people and kit; ONE station — the station IS the block, its lines read as the block's
     own (`StationFields`, flattened, on the block's door idiom); two or more — the block's words
     are the circuit's intro, then the rotation strip, the columns and the grid. */
  const sole = soleStationOf(block);
  const soleWritten = !!soleWrittenStationOf(block);
  const isRest = !!block.duration.restOfPractice;
  const shows = (door: BlockDoor) => held[door] || openDoors.has(door);
  const showTeaching = shows('teaching');
  // A template shows a set's SHAPE on the line ("in pairs · drawn on the practice") and nothing else.
  const showPlayers = stationCount === 0 && (!withoutPeople || !!ownSet);
  const blockTarget: SetTarget = { kind: 'block', blockId: block.id };
  /* Every optional field, one row each: whether the block's SHAPE offers it at all, and whether
     it is on screen (held ∨ opened this time). A door at the foot is a field that applies and is
     not showing; the field renders when it is showing — one table, so the two can never disagree
     (a field with no door and no field would be unreachable; both would be a duplicate). With a
     sole station the points · setup · equipment · staff · note rows are the STATION's (D1); the
     block's own points and staff then show only while held — read below as `own*`. */
  type Row = { id: Exclude<BlockDoor, 'teaching' | 'stations'>; label: string; applies: boolean; showing: boolean };
  const row = (id: Row['id'], applies: boolean, showing = applies && shows(id)): Row =>
    ({ id, label: DOOR_LABELS[id], applies, showing });
  // In the FIELDS' order — who, then what (owner, 2026-09-20) — so the foot's doors read as the
  // sheet does: + Staff first, then the words' additions, then tonight's note.
  const rows: Row[] = [
    // The block's own staff line is offered while it has no stations or several; with ONE the door
    // is the station's who-runs-it, and only while the block holds no staff of its own. Held
    // content always shows, at either level — the one row whose showing is not "applies ∧ open".
    row('staff', !withoutPeople && (sole ? !hasStaff(block) : true),
      !withoutPeople && (sole ? hasStaff(sole) || (!hasStaff(block) && shows('staff')) : shows('staff'))),
    // With a sole written station its points are the block's points — offered only while the
    // block holds none of its own (the same rule as staff), so the sheet never shows a points
    // field AND a "+ Coaching points" door for one block; held content shows at either level.
    row('points', sole ? soleWritten && !hasPoints(block.coachingPoints) : showTeaching,
      sole ? soleWritten && (hasPoints(sole.coachingPoints) || (!hasPoints(block.coachingPoints) && shows('points'))) : showTeaching && shows('points')),
    row('setup', soleWritten),
    row('equipment', sole ? soleWritten : stationCount === 0),
    row('note', !withoutPeople && !!sole),
  ];
  const showing = Object.fromEntries(rows.map(r => [r.id, r.showing])) as Record<Row['id'], boolean>;
  const ownPoints = sole ? hasPoints(block.coachingPoints) : showing.points;
  const ownStaff = !withoutPeople && (sole ? hasStaff(block) : showing.staff);
  const showKit = !sole && showing.equipment;
  const doors: { id: BlockDoor; label: string }[] = [
    ...rows.filter(r => r.applies && !r.showing),
    // A second station un-flattens the block into columns; from two on, "+ Add a station" is the last column.
    ...(stationCount <= 1 ? [{ id: 'stations' as const, label: 'Stations' }] : []),
  ];
  /** Every closable door's onRemove/removeLabel/autoFocus, in one place instead of a near-identical
   *  ternary at each call site (/simplify, 2026-09-15). `onRemove` is only ever live while the door
   *  is still empty — closing it, never deleting held data. */
  const doorProps = (door: Row['id']): DoorProps => ({
    onRemove: !readOnly && !held[door] ? () => onCloseDoor(door) : undefined,
    removeLabel: `Remove ${DOOR_LABELS[door]}`,
    autoFocus: openDoors.has(door) && !held[door],
  });
  const stationDoor = (door: StationDoor): TeachingDoor => ({ show: showing[door], ...doorProps(door) });
  const pointsDoor = doorProps('points');
  const staffDoor = doorProps('staff');
  const equipmentDoor = doorProps('equipment');
  /* "+ Stations" opens the drill sheet DIRECTLY — with no section head left to open (D1 · D2) the
     door and the sheet are one tap; the door stays mounted while the pick is made, so Escape has
     something to return focus to. */
  const openDoor = (door: BlockDoor) => (door === 'stations' ? onAddStation() : onOpenDoor(door));
  /* The library door by shape (L1 · L9) — see the doors line below. */
  const promoteDoor = (() => {
    if (stationCount === 0) return block.title.trim() && onPromoteBlock ? { label: 'Save to my drills…', onClick: onPromoteBlock } : null;
    if (stationCount >= 2) return onPromoteCircuit ? { label: 'Save to my circuits…', onClick: onPromoteCircuit } : null;
    return null;                                                        // one station: the station's own door (D1)
  })();

  /* Read (stage 6, R2): the title as the shut row prints it — text, the rotation tag beside it —
     never a greyed box. The clock left this line for the gutter (stage 1); the ROTATION tag left it
     at stage 3 — an open rotating block carries the pressed "Groups rotate" chip on its strip a few
     lines down, so the tag said the same thing twice. The shut row keeps it (D6). */
  const titleEl = readOnly ? (
    <span className={styles.ppTlTitle}>
      {block.title || <span className={styles.ppTlUntitled}>{label}</span>}
      {isRotation && <span className={styles.ppShapeTag}><Repeat size={11} aria-hidden /> Rotation</span>}
    </span>
  ) : (
    <input ref={titleRef} className={`${styles.input} ${styles.ppBlockTitle}`} value={block.title}
      maxLength={MAX_TITLE_LEN}
      placeholder="What are we doing?"
      autoFocus={focusTitle}
      aria-label={`Block ${index + 1} title`} onChange={e => onPatch({ title: e.target.value })} />
  );

  const body = (
      <div className={styles.ppBlockBody}>
        {/* On the phone's sheet the title leads the body at the sheet's full width (K2) — the head
            holds the block's place and clock instead. */}
        {sheet && <div className={styles.ppBlockSheetTitle}>{titleEl}</div>}
        {/* K4: a block just added from "+ Add a block" is blank; its library path is one quiet door
            under the title, and only while there is nothing to lose. */}
        {sheet && onStartFromDrill && (
          <button type="button" className={`${styles.ppTlQuietLink} ${styles.ppBlockSheetFromDrill}`} onClick={onStartFromDrill}>
            <Library size={12} aria-hidden /> Start from a drill ›
          </button>
        )}
        {provenance}
        {/* ── The clock row (D4 · D5): quick lengths · the minutes · Rest of practice · "ends …" ──
            ⚠ RANGES WERE REMOVED (owner, 2026-08-01). A block that might run 25 or 35 minutes
            makes the next block's start time unknowable — the one question this running clock
            exists to answer. A coach who wants slack types one number with the slack in it.
            A chip is on when the minutes equal it; any other number is typed and no chip is on.
            Only ONE block per plan may be "rest of practice" (D13): when another holds it the chip
            is ABSENT, not disabled with a hover title (invisible on a phone). Un-pressing Rest
            returns the default length, never "no length" — a null stalls the clock at this block.
            The consequence, "ends 7:15 p.m.", is the gutter's own walk (`clock.endLabel`); the
            open block repeats the START nowhere — the gutter has it. A template has no clock.
            Read (stage 6, R2): no clock row at all — the gutter already says the start and the
            length, and "ends 7:15 p.m." is the next row's start. */}
        {!readOnly && (
        <div className={styles.ppField}>
          <FieldLabel>Minutes</FieldLabel>
          <div className={styles.ppClockRow}>
            {QUICK_MINUTES.map(n => {
              const on = !isRest && block.duration.minutes === n;
              return (
                <button key={n} type="button" className={styles.ppQuickChip} aria-pressed={on}
                  data-on={on ? 'on' : undefined} aria-label={`${n} minutes`}
                  onClick={() => onPatch({ duration: { minutes: n } })}>{n}</button>
              );
            })}
            <input className={`${styles.input} ${styles.ppMinutes}`} type="number" min={1} max={MAX_MINUTES}
              inputMode="numeric" disabled={isRest}
              value={isRest ? '' : block.duration.minutes ?? ''} aria-label="Minutes"
              onChange={e => onPatch({
                duration: { minutes: e.target.value ? Number(e.target.value) : null },
              })} />
            <span className={styles.ppUnit}>min</span>
            {!restTakenElsewhere && (
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
        )}

        {ownStaff && (
          <div className={styles.ppField}>
            {/* The label draws its own quiet "×" (owner ask, 2026-09-15); the picker below
                prints no label of its own — the same "caller prints its own heading" shape the
                plan-level Equipment field already uses, which keeps the door state machine
                local to this one consumer instead of widening the shared picker's contract. */}
            <FieldLabel onRemove={staffDoor.onRemove} removeLabel={staffDoor.removeLabel}>Staff</FieldLabel>
            <PracticeTagPicker all={staffTags} ids={block.staffTagIds ?? []}
              legacyNames={block.staff} disabled={readOnly} onCreate={onCreateStaffTag}
              people={staffPeople} onPickPerson={onPickStaffPerson}
              manage={readOnly ? undefined : staffManage} onManageChanged={onStaffTagsChanged}
              onChange={next => onPatch({ staffTagIds: next })}
              emptyHint="No staff yet — pick someone on the team, or type a name." placeholder="Add staff…"
              /* A block that already carries a drill (its own card, own fields) can push this
                 door well down the sheet — opening it with no signal left the field off the
                 top of the screen (owner catch, 2026-09-15). Focusing it here scrolls it into
                 view for free, the same way Coaching points' autoFocus already does. */
              autoFocus={staffDoor.autoFocus} />
          </div>
        )}

        {/* People live at exactly ONE level. With stations, they belong to the stations (or to
            the rotation's groups) — so the block-level line disappears rather than offering a
            second answer nobody can reconcile; and they MOVE there when a station arrives (D8),
            never vanish. Every block that holds its own people SAYS who (D1, owner 2026-09-15):
            "Whole team" until names are chosen, never a number — names are what the sheet and
            the field screen print, and "how many are here" is attendance's question, answered on
            the field screen. */}
        {showPlayers && (
          <div className={styles.ppFieldRow}>
            <FieldLabel>Players</FieldLabel>
            {ownSet ? (
              <SetReadBack set={ownSet} target={blockTarget} wiring={sets} readOnly={readOnly} withoutPeople={withoutPeople}
                roster={roster} notRepliedIds={notRepliedIds} nameOf={nameOf} />
            ) : (
              <PeopleLine target={blockTarget} playerIds={block.playerIds} wholeTeamWord readOnly={readOnly}
                wiring={sets} nameOf={nameOf} onOpenPicker={() => onOpenPicker({ kind: 'block', blockId: block.id })} />
            )}
          </div>
        )}

        {/* ── The two teaching fields (D2 · D3) — two fields, not one notes area: the "watching
            for" line is what the field screen prints in bold at arm's length, and older plans
            read through a field-by-field fallback. The station's words, the drill library's
            words, the field screen's words; the stored keys stay `description` / `goal`. Absent
            on a block with exactly one station and no words of its own (D7) — the station's
            read-only text under Stations IS the block's teaching then. Read (stage 6, R2): the
            same two, as text under their labels, each absent when empty. */}
        {showTeaching && readOnly && (
          <>
            <ReadField label="What you're doing" text={block.description} />
            <ReadField label="What you're watching for" text={block.goal} />
          </>
        )}
        {showTeaching && !readOnly && (
          <>
            <label className={styles.ppField}>
              <FieldLabel>What you&apos;re doing</FieldLabel>
              <textarea className={styles.textarea} rows={2} value={block.description ?? ''}
                maxLength={MAX_TEXT_LEN} placeholder="What happens, and how it's set up"
                onChange={e => onPatch({ description: e.target.value })} />
            </label>
            <label className={styles.ppField}>
              <FieldLabel>What you&apos;re watching for</FieldLabel>
              <input className={styles.input} value={block.goal ?? ''} maxLength={MAX_TEXT_LEN}
                placeholder="What good looks like here" onChange={e => onPatch({ goal: e.target.value })} />
            </label>
          </>
        )}

        {/* ── What the block holds, in a fixed order — WHO, THEN WHAT (owner, 2026-09-20; it was
            D1's Coaching points · Staff · Players · Equipment): Staff · Players ABOVE the two
            teaching fields, then Coaching points · Equipment · then its stations (stage 3) — the
            station modal's order (staff · players · the words), the printed sheet's and the
            field screen's, so a sheet with a written block and a drill block reads Staff in ONE
            place. A section renders when it has content or its door was opened this time; the
            doors for the rest wait at the foot. ── */}
        {ownPoints && (
          <CoachingPointsField points={block.coachingPoints} readOnly={readOnly}
            maxPoints={MAX_COACHING_POINTS} maxLen={MAX_SHORT_TEXT_LEN} noun="block"
            onSet={next => onPatch({ coachingPoints: next })} {...(sole ? {} : pointsDoor)} />
        )}

        {/* Kit lives at exactly ONE level — the activity's (D11), the same law as people: the
            block's while it has no stations, each station's once it has them. What is chosen
            here rises into the bag under "About this practice" and prints beside this block. */}
        {showKit && readOnly && <ReadChips label="Equipment" names={tagNamesById(block.equipmentTagIds, equipmentTags)} />}
        {showKit && !readOnly && (
          <div className={styles.ppField}>
            <FieldLabel onRemove={equipmentDoor.onRemove} removeLabel={equipmentDoor.removeLabel}>Equipment</FieldLabel>
            <PracticeTagPicker all={equipmentTags} ids={block.equipmentTagIds ?? []}
              onCreate={onCreateEquipmentTag}
              manage={equipmentManage} onManageChanged={onEquipmentTagsChanged}
              onChange={next => onPatch({ equipmentTagIds: next })}
              emptyHint="No equipment yet — type an item to add your first one."
              autoFocus={equipmentDoor.autoFocus} />
          </div>
        )}

        {/* ── ONE station: the station IS the block (stage 3, owner ruling D1, 2026-09-15). No
            "Stations" head, no numbered card, no second trash — the drill's provenance line and
            read-only words (or a written station's fields) sit where the block's own words would,
            who runs it · who's at it · just for tonight are the block's own lines, its kit is the
            block's. A second station un-flattens it into columns; title and minutes never detach
            the drill. The station's own name is not asked here — the block's title is its name. */}
        {sole && (
          <StationFields
            station={sole} block={block} sole isRotation={false}
            readOnly={readOnly} withoutPeople={withoutPeople}
            doors={stationDoor} sets={sets} roster={roster} notRepliedIds={notRepliedIds}
            staffTags={staffTags} onCreateStaffTag={onCreateStaffTag} staffPeople={staffPeople} onPickStaffPerson={onPickStaffPerson}
            equipmentTags={equipmentTags} onCreateEquipmentTag={onCreateEquipmentTag}
            staffManage={staffManage} onStaffTagsChanged={onStaffTagsChanged}
            equipmentManage={equipmentManage} onEquipmentTagsChanged={onEquipmentTagsChanged}
            nameOf={nameOf}
            onPatch={patch => onPatchStation(sole.id, patch)}
            onOpenPicker={() => onOpenPicker({ kind: 'station', blockId: block.id, stationId: sole.id })}
            onDetach={() => onDetachStation(sole.id)}
            onSwapDrill={() => onSwapStation(sole.id)}
            onPromote={() => onPromoteStation(sole.id)}
          />
        )}

        {/* ── TWO OR MORE: the rotation as one line, the stations as columns, the grid turned to
            them (stage 3, owner rulings D2 · D3 · D5 · D6, 2026-09-15). "Groups rotate" is a
            pressed chip — rotation is the DEFAULT because that is how the reference practice runs;
            un-press it and the stations run separately, each with its own Players line in its
            modal. Adding a SECOND station is how a rotation gets made — the picker is the carousel
            builder, with no second kind of block anywhere in the model. */}
        {stationCount >= 2 && (
          <>
            <RotationStrip
              isRotation={isRotation}
              rotation={rotation}
              blockMinutes={block.duration.minutes ?? null}
              stationCount={stations.filter(s => s.name.trim()).length}
              readOnly={readOnly}
              onToggle={rotates => onPatch({ rotates })}
              onSetRotation={patch => onPatch({ rotation: { ...rotation, ...patch } })}
            />
            <StationColumns
              blockId={block.id}
              stations={stations}
              readOnly={readOnly}
              phone={!!sheet}
              staffTags={staffTags}
              mineStations={mineStations}
              whoOf={isRotation || withoutPeople ? undefined : station => {
                const set = groupingById(sets.groupings, station.groupingId);
                if (set) return `${set.name.trim() || 'Groups'} · ${groupingShape(set)}`;
                const n = station.playerIds?.length ?? 0;
                return n > 0 ? `${n} player${n === 1 ? '' : 's'}` : '';
              }}
              onOpen={onOpenStation}
              onMove={onMoveStation}
              onAdd={() => onAddStation()}
            />
            {isRotation && (
              <RotationBoard
                blockId={block.id}
                rotation={rotation}
                set={circuitSet}
                sets={sets}
                stations={stations}
                blockMinutes={block.duration.minutes ?? null}
                blockStartMs={blockStartMs}
                readOnly={readOnly}
                withoutPeople={withoutPeople}
                shapeNoun={solo ? 'a circuit' : 'a template'}
                roster={roster}
                notRepliedIds={notRepliedIds}
                nameOf={nameOf}
                onSetRotation={patch => onPatch({ rotation: { ...rotation, ...patch } })}
              />
            )}
          </>
        )}

        {/* ── The doors, at the foot (D1) — one quiet line in the ghost row's voice, not a "+"
            beside each label, so the fields read as a document and the doors as its margin.
            Only what the block does not hold yet; a viewer who cannot write gets no doors. */}
        {!readOnly && (doors.length > 0 || promoteDoor) && (
          <div className={styles.ppDoorsLine}>
            {doors.map((door, i) => {
              const button = (
                <button type="button" className={styles.ppTlQuietLink} onClick={() => openDoor(door.id)}
                  data-pp-add-station={door.id === 'stations' ? block.id : undefined}>
                  + {door.label}
                </button>
              );
              return (
                <span key={door.id} className={styles.ppTlQuietAlt}>
                  {i > 0 ? '\u00A0· ' : ''}
                  {/* "+ Stations" is the drop target for a drill on a block with none or one (L2 —
                      the drop follows D13 exactly as the door's sheet does). */}
                  {door.id === 'stations'
                    ? <StationDropTarget blockId={block.id} className={styles.ppDoorTarget}>{() => button}</StationDropTarget>
                    : button}
                </span>
              );
            })}
            {/* The library door, at the right end of the line, the word by SHAPE (stage 4, L1 · L9):
                "Save to my drills…" on a titled block with no stations — the activity (D13 made it
                the only written shape below a circuit); "Save to my circuits…" on a block with
                stations. Never on a block placed from a circuit (it is one already), and a block
                with ONE station keeps the station's own door (the station IS the block, D1). */}
            {promoteDoor && (
              <span className={`${styles.ppTlQuietAlt} ${styles.ppDoorsLibrary}`}>
                <button type="button" className={styles.ppTlQuietLink} onClick={promoteDoor.onClick}>
                  <Library size={12} aria-hidden /> {promoteDoor.label}
                </button>
              </span>
            )}
          </div>
        )}
      </div>
  );

  /* What the delete question says goes — the phone sheet's bin and the desk card's bin ask the same. */
  const deleteMessage = `Removes it from the plan${stationCount >= 2 ? `, with its ${stationCount} stations` : ''}. This can't be undone.`;

  if (sheet) {
    return (
      <BlockSheet
        bodyKey={block.id}
        label={label}
        eyebrow={{ place: `Block ${index + 1} of ${blockCount}`, clock: clock?.startLabel ?? null }}
        walk={sheet.walk}
        onward={sheet.onward}
        onAdd={sheet.onAdd}
        readOnly={readOnly}
        onEdit={sheet.onEdit}
        onDoneEditing={sheet.onDoneEditing}
        deleteMessage={deleteMessage}
        onDelete={onDelete}
        onClose={onClose}
      >
        {body}
      </BlockSheet>
    );
  }

  return (
    <div className={styles.ppTlRow}>
      {gutter}
      <div className={styles.ppTlOpen}>
      <div className={styles.ppBlockHead}>
        {/* The head is the title, the collapse and the bin. The reorder pair left it for the
            gutter (above), where the shut row has it too. */}
        <div className={styles.ppBlockTitleWrap}>{titleEl}</div>

        {!solo && (
          <button type="button" className={styles.ppIconBtn} aria-expanded
            aria-label={`Close ${label}`} onClick={onClose}>
            <ChevronUp size={16} />
          </button>
        )}
        {/* The desk's bin asks too (owner, 2026-09-24): the same no-undo delete as the phone sheet's,
            which already asked — one question, whichever width the coach deletes from. */}
        {!readOnly && !solo && <SheetDeleteButton label={label} message={deleteMessage} onDelete={onDelete} />}
      </div>
      {body}
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
  /** Saves a promoted station — or a bare written block (L1) — to the library (D18). Absent for a
   *  viewer who can't write drills. Resolves with the drill it made, so a circuit's tick can point
   *  its stations at the drills it just created. */
  onCreateDrill?: (input: DrillInput) => Promise<{ ok: boolean; error?: string; drill?: RepTeamDrill }>;
  /** The team's circuits (stage 4, L9) — the panel's second face and the picker's third tab. */
  circuits?: RepTeamCircuit[];
  /** Saves a circuit (L9). Absent for a viewer who can't write, and in the circuit editor itself. */
  onCreateCircuit?: (input: CircuitInput) => Promise<{ ok: boolean; error?: string }>;
  /**
   * SAVE OVER (COACH_PRACTICE_SAVE_OVER_PLAN.md, D1, 2026-10-02) — the plan page's, and only there.
   * A drill saved over is re-copied by the server into what hasn't happened yet (D3); the resolve
   * carries the drill as saved, even when that walk fell short, so this page can follow it too.
   */
  onUpdateDrill?: (drillId: string, input: DrillInput) => Promise<{ ok: boolean; error?: string; drill?: RepTeamDrill }>;
  /** What saving over a drill would reach — the question's "Upcoming practices pick it up" (D3). */
  loadDrillReach?: (drillId: string) => Promise<DrillReach | null>;
  /** A circuit saved over changes the library only — never a block already placed from it (D10). */
  onUpdateCircuit?: (circuitId: string, input: { tagIds: string[]; block: PracticePlanBlock }) => Promise<{ ok: boolean; error?: string }>;
  /**
   * The DOCKED LIBRARY (stage 4, L5) — the plan page's, and only there: `canDock` is the page's
   * width decision (a working column of 1,156px or more), `docked` the coach's remembered choice,
   * and `panelHost` the element beside the sheet the panel renders into (a portal — the page owns
   * the pair's layout, the editor owns the one drag context over both). Absent in the template
   * room and the circuit editor, where the ghost row's link opens the sheet as it always did.
   */
  library?: {
    /** The page's width decision — a working column of 1,156px or more. */
    canDock: boolean;
    /** Docked NOW — the page's one answer (its width, the coach's remembered choice, its own gates). */
    docked: boolean;
    onDock: (docked: boolean) => void;
    panelHost: HTMLElement | null;
    /** The Circuits tab, for the panel's "+ New circuit" — a circuit is made in its own editor. */
    circuitsHref: string;
  };
  /** The circuit editor (L9): ONE block, always open, on its own — no goal, no folds, no ghost row. */
  soloBlock?: boolean;
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
  /**
   * ⚠ READ MODE IS A FACE, NOT A DISABLED FORM (practices re-evaluation stage 6, owner ruling R2,
   * 2026-09-18). A viewer who may not write — an assistant on a live plan, and everyone on a
   * finished practice's record — reads the same sheet: shut rows that OPEN to read (the block's
   * words, its stations as columns, the rotation line as a fact, the grid, the groups — the paper's
   * order), a station's five fields as the modal, read-only; no ghost row, no gaps, no gutter
   * arrows, no doors at a block's foot, no "+ What everyone's working on", no pickers' search
   * boxes, no greyed inputs anywhere. ONE editor, one mode — the record's face, the assistant's
   * face and the closed-season reader all mount this with `readOnly`; a second renderer of the
   * shut row, the column or the grid is the drift this prop exists to prevent.
   */
  readOnly: boolean;
  /**
   * ✎ in a block's and a station's head while READING (practice plans on a phone, stage 1b, R3 —
   * "basically every screen should have an edit button"): the reader who may write switches the
   * whole plan to writing from where they are, and the block or station they were reading stays
   * open, now as its form. Absent for anyone who may not write, and on every writing surface.
   */
  onEdit?: () => void;
  /** ✓ Done editing in the same place while writing (owner, §227 walk 2026-09-24) — back to reading. */
  onDoneEditing?: () => void;
  /**
   * The sheet is a finished practice's RECORD (stage 6, R1 · R2): the goal line reads "Goal:" —
   * the paper's own word (it prints GOAL) — where the live page says "Tonight:", so the record
   * and the print agree; an unwritten goal reads as silence, never as the future-tense placeholder.
   * Read-only by construction (the pages pass both); the word is the only thing it changes.
   */
  record?: boolean;
  /** An id for the goal line's input — the plan page focuses it after "Edit the plan" (stage 6). */
  goalInputId?: string;
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
  /**
   * The season's staff as people (mig 303) — the staff pickers' first group — and how to mint a
   * word linked to one; absent on a read-only surface, the template room and the circuit editor.
   */
  staffPeople?: readonly PickablePerson[];
  onPickStaffPerson?: (person: PickablePerson) => Promise<PickableTag | null>;
  /** The reader's own blocks and stations, decided server-side by identity — the "you" marks. */
  viewerBlockIds?: readonly string[];
  viewerStationIds?: readonly string[];
  /**
   * Every set with anyone in it that ANOTHER practice this season holds, newest first — "From another
   * practice…" (G6, groups at every level 2026-09-28). The page's; absent in the template room and
   * the circuit editor, where the door is absent too.
   */
  groupingsElsewhere?: readonly GroupingElsewhere[];
}

export default function PracticePlanEditor({
  plan, onChange, roster, goals, canViewFocus, attendance, canViewAttendance,
  drills, onCreateDrill, circuits = [], onCreateCircuit, onUpdateDrill, loadDrillReach, onUpdateCircuit, library, soloBlock = false,
  focusTags = [], onCreateFocusTag, planTagIds, onChangePlanTags,
  staffTags = [], onCreateStaffTag, equipmentTags = [], onCreateEquipmentTag,
  staffManage, onStaffTagsChanged, equipmentManage, onEquipmentTagsChanged,
  focusManage, onFocusTagsChanged,
  eventStartsAt, eventEndsAt, readOnly, onEdit, onDoneEditing, record = false, goalInputId, withoutPeople = false, onStartFrom,
  staffPeople = [], onPickStaffPerson, viewerBlockIds, viewerStationIds, groupingsElsewhere = [],
}: Props) {
  const confirm = useConfirm();
  const [attach, setAttach] = useState<AttachTarget | null>(null);
  // The reader's own levels (mig 303), as the rows keep them.
  const mineBlocks = useMemo(() => new Set(viewerBlockIds ?? []), [viewerBlockIds]);
  const mineStations = useMemo(() => new Set(viewerStationIds ?? []), [viewerStationIds]);
  /**
   * The THREE callers' shapes, decided once (stage 4): the practice (everything), the template
   * (`withoutPeople` — no roster, staff, groups, "just for tonight") and the circuit editor
   * (`soloBlock`, always with `withoutPeople` — ONE block alone on a sheet, no goal, no folds, no
   * ghost row, no drag, no "Rest of practice", and no library door: a circuit is not saved from
   * itself). Every render site below reads these, never the raw flags.
   */
  const layout = {
    /** The goal line, the About fold, the focus rail's offer — a practice's or a template's. */
    sheet: !soloBlock,
    /** The ghost row, the gaps a drag lands in, the gutter as a handle. */
    timeline: !readOnly && !soloBlock,
    /** "Rest of practice" is a length only a practice can promise. */
    restOffered: !soloBlock,
    /** The library door by shape (L1 · L9). In practice the plan page's alone: the template room
        passes no library hooks (a template is scaffolding already — its blocks are saved from the
        plan they start), and the circuit editor is the one block itself. */
    promote: !soloBlock,
  };
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
    // `at`: where the new block lands — the end unless the sheet's "Start from a drill" is standing
    // in for a new block the coach had already moved (/review, 2026-09-23). `replaceId`: that block —
    // the pick takes its place, keeping its id; it stays in the plan until then (§231 walk).
    | { kind: 'block'; at?: number; replaceId?: string }
    // `startFrom`: opened by a just-added station's "Start from a drill ›" (S2) — drills only, and
    // the pick takes that station's place (`swapId` is the station).
    | { kind: 'station'; blockId: string; swapId?: string; startFrom?: boolean }
    | null
  >(null);
  /**
   * What the library door is saving (D18 · L1 · L9): a written STATION, a bare written BLOCK (as a
   * drill), or a block with stations (as a CIRCUIT). One dialog, the word by shape.
   */
  const [promoting, setPromoting] = useState<
    | { kind: 'station'; blockId: string; stationId: string }
    | { kind: 'block'; blockId: string }
    | { kind: 'circuit'; blockId: string }
    | null
  >(null);
  const [promoteBusy, setPromoteBusy] = useState(false);
  const [promoteError, setPromoteError] = useState('');
  /** The docked panel's "+ New drill" — the same sheet the Drills tab opens (L5 · L6). */
  const [newDrill, setNewDrill] = useState<DrillInput | null>(null);
  const [newDrillBusy, setNewDrillBusy] = useState(false);
  const [newDrillError, setNewDrillError] = useState('');
  /**
   * What is being carried (stage 4, L2) — for the overlay under the pointer. Mouse only, lifting
   * after six pixels: a click on a panel row still opens it, a click on an arrow in the gutter is
   * still a click, and on touch nothing lifts at all (the sheet and the pair are the path).
   */
  const [lifted, setLifted] = useState<DragData | null>(null);
  /* ≤640 while writing, a finger lifts a block or a station too — by its GRIP only (stage 1b, R4;
     stations 2026-09-24): nothing else in this drag context has listeners on a phone (the library
     panel is a desk's), and the hold is a quarter second, so a swipe that starts on a grip still
     scrolls the page. Asked in the circuit editor as well — its lone block has no grip, but its
     stations do. */
  const touchGrip = useIsPhone(!readOnly);
  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 6 } });
  /* ⚠ ALWAYS TWO SENSORS. The kit keys an effect on the sensor list, so a list that grows and
     shrinks with the width ("the final argument passed to useEffect changed size") crashed the page
     the moment the window crossed 640 (owner, §227 walk, 2026-09-24). The touch sensor is always
     registered; off a writing phone its constraint can never be met, so on a tablet nothing lifts
     by touch — exactly as before stage 1b. */
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: touchGrip ? { delay: 250, tolerance: 6 } : { distance: Number.POSITIVE_INFINITY },
  });
  const dragSensors = useSensors(mouseSensor, touchSensor);
  /** The gap under a carried block — what the start times preview (R4 · frame 4). */
  const [overGap, setOverGap] = useState<number | null>(null);
  /**
   * The station OPEN as a modal (stage 3, D4) — one at a time, the editor's to say which, so the
   * stepper in its foot can swap the station while the modal stays mounted (the room's own idiom).
   * Derived to null when the station is gone (deleted from the modal itself, or under it by an
   * autosave from another tab) so a dead-end dialog never stands over the sheet.
   */
  // `fresh`: opened by adding it — the cursor goes to its name (S2). A step to a neighbour drops it.
  const [openStation, setOpenStation] = useState<{ blockId: string; stationId: string; fresh?: boolean } | null>(null);
  /**
   * The stations ADDED this visit (practice plans on a phone, stage 2 · S4 = A, owner 2026-09-24).
   * One tap now makes a station and opens it, so a station started by mistake would be common —
   * and a blank station is KEPT by the save (measured: it survives a reload, counted in the list
   * and the walk, skipped by the rotation). When its screen closes, any of these still holding
   * nothing at all goes, with no question: nothing is lost. Only these — a blank station already
   * in the plan is the coach's, and is left alone. Forgotten on that close.
   */
  const [freshStations, setFreshStations] = useState<ReadonlySet<string>>(() => new Set());
  /**
   * The GROUPS ROOM — one set at a time (D9; groups at every level, G1–G8, 2026-09-28): the set,
   * the place it was opened from (the room's "Make a separate copy for …" is that place's), and, for
   * a set THIS visit just made, what that place held before — a room closed with nobody placed in
   * the new set puts the place back and the set goes (practice plans on a phone S4's rule, one level
   * over: a door opened by mistake costs nothing). `note` is the copied set's one line (G6).
   */
  const [openSet, setOpenSet] = useState<{
    setId: string;
    from: SetTarget | null;
    made?: { held: Holding | null };
    note?: string;
  } | null>(null);
  /** "From another practice…" (G6) — onto a place, or (from the fold) onto the practice alone. */
  const [fromPractice, setFromPractice] = useState<{ target: SetTarget | null } | null>(null);
  /** The Groups fold under the goal — open whenever it renders, until the coach shuts it. */
  const [groupsOpen, setGroupsOpen] = useState(true);

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
  /* While a BLOCK is carried over a gap, the clocks of the plan as it WOULD be (stage 1b, R4 —
     "moving the position … without seeing the other blocks limits my visibility into its impact"):
     the same walk over the reordered list, so every gutter and the gap's own line read the times
     the drop would give — and a block moved DOWN no longer claims the start time of the block it
     lands in front of (it gives its own minutes back first). Null the moment nothing would move. */
  const previewClocks = useMemo(() => {
    if (lifted?.kind !== 'block' || overGap === null) return null;
    const from = plan.blocks.findIndex(b => b.id === lifted.blockId);
    const to = overGap > from ? overGap - 1 : overGap;
    if (from < 0 || to === from) return null;
    const next = plan.blocks.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return new Map(walkBlockClocks(next, eventStartsAt, eventEndsAt).clocks.map(c => [c.blockId, c]));
  }, [lifted, overGap, plan.blocks, eventStartsAt, eventEndsAt]);
  /** A gap's start line: the carried block's own previewed start over the gap it would land in. */
  const gapStartLabel = (gap: number, fallback: string | null) =>
    previewClocks && overGap === gap && lifted?.kind === 'block'
      ? previewClocks.get(lifted.blockId)?.startLabel ?? fallback
      : fallback;
  // ⚠ NO NOW-MARKER (owner, 2026-09-17, with the P10 no-clock ruling). Stage 5's P9 put "now" over
  // the clock in the running block's gutter, by the PLAN — and the plan's clock is exactly the
  // thing P10 ruled does not know where the practice is. The sheet is a plan, never a clock.

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
  /* Who has not replied yes — named as such in the read-out and the room (D21). Empty while
     attendance is unknown, so nobody is singled out on a night nothing has been taken. */
  const notRepliedIds = useMemo(
    () => new Set(attendanceKnown ? notReplied.map(p => p.id) : []),
    [attendanceKnown, notReplied],
  );

  const nameOf = (playerId: string) => {
    const p = playerById.get(playerId);
    return p ? playerDisplayName(p) : 'Player';
  };

  /* Every change to the blocks goes through the same settling passes the server runs — kit (D11)
     and people (stage 3, D8) — so the coach SEES names and kit move the moment a station arrives
     (onto that station; into the first draw when rotating turns on; back onto the stations when it
     turns off) rather than watching them vanish until a reload (the save's response is not applied
     back to local state). One pass, two callers; the screen and the column agree. */
  const setBlocks = (blocks: PracticePlanBlock[]) => {
    const next = settlePlanLevels({ ...plan, blocks });
    onChange(next);
    /* A block whose SHAPE changed under its open doors — a station arrived or left — re-seeds the
       doors whose field changed identity with it: with one station `points` · `setup` ·
       `equipment` · `staff` read the STATION's fields (D1), so a 'points' opened for the block's
       own held points would otherwise open the station's empty points field the moment the
       station landed. A door the shape does not re-aim (`note`, the teaching latch) stays as the
       coach left it. */
    if (openId) {
      const before = plan.blocks.find(b => b.id === openId)?.stations?.length ?? 0;
      const after = next.blocks.find(b => b.id === openId);
      if (after && (after.stations?.length ?? 0) !== before) {
        setOpenDoors(prev => new Set([...[...prev].filter(d => !SHAPE_DEPENDENT_DOORS.has(d)), ...doorsHolding(after)]));
      }
    }
  };
  const patchBlock = (blockId: string, patch: Partial<PracticePlanBlock>) =>
    setBlocks(plan.blocks.map(b => (b.id === blockId ? { ...b, ...patch } : b)));
  const patchStation = (blockId: string, stationId: string, patch: Partial<PracticeStation>) => {
    const block = plan.blocks.find(b => b.id === blockId);
    if (!block) return;
    patchBlock(blockId, { stations: (block.stations ?? []).map(s => (s.id === stationId ? { ...s, ...patch } : s)) });
  };
  /** Move earlier · Move later — the station grip's menu (the pair on the column's foot until
   *  2026-09-24; it had been the modal's head). The grid and every group key on the station's ID,
   *  so moving it never detaches it from its carousel position. */
  const moveStation = (blockId: string, stationId: string, delta: number) => {
    const block = plan.blocks.find(b => b.id === blockId);
    const stations = block?.stations ?? [];
    const at = stations.findIndex(s => s.id === stationId);
    const target = at + delta;
    if (at < 0 || target < 0 || target >= stations.length) return;
    const next = stations.slice();
    [next[at], next[target]] = [next[target], next[at]];
    patchBlock(blockId, { stations: next });
  };
  /** The grip's DROP — `slot` is the position the station lands in front of (0 … n), the way
   *  `moveBlockTo` reads a gap; a slot beside the station's own place moves nothing. */
  const moveStationTo = (blockId: string, stationId: string, slot: number) => {
    const block = plan.blocks.find(b => b.id === blockId);
    const stations = block?.stations ?? [];
    const from = stations.findIndex(s => s.id === stationId);
    const to = slot > from ? slot - 1 : slot;
    if (from < 0 || to === from || to < 0 || to >= stations.length) return;
    const next = stations.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    patchBlock(blockId, { stations: next });
  };
  /** Delete from the modal (D4) — the head's bin has already asked (`SheetDeleteButton`).
   *  ⚠ THE MODAL CLOSES, back to the block and its stations (§231 walk, owner 2026-09-25: "when I
   *  delete a station I should be navigated back to the block viewing the stations, not navigated
   *  back to another station"). It used to STEP to a neighbour (/review, 2026-09-15 — so a close
   *  would not drop focus on the page body), which read as being sent somewhere else; the close's
   *  one focus rule (`stationDoorFor`) now answers that — the row is gone, so the add control.
   *  A delete IS a close, so S4's rule runs on the same pass: fresh stations still holding nothing
   *  go too, in ONE write — a second pass through `dropFreshEmptyStations` would read this render's
   *  plan, the deleted station still in it, and write it back. */
  const deleteStation = (blockId: string, stationId: string) => {
    const block = plan.blocks.find(b => b.id === blockId);
    if (!block) return;
    const remaining = (block.stations ?? []).filter(s => s.id !== stationId);
    // Down to ONE written station on a block with no words of its own: the survivor's words come
    // back up and the block is the activity again — D13's reverse. `collapseSoleStation` holds
    // the one rule (nothing merges, nothing drops) and hands the block back unchanged otherwise.
    const next = dropEmptyStations(collapseSoleStation({ ...block, stations: remaining }), freshStations);
    setBlocks(plan.blocks.map(b => (b.id === blockId ? next : b)));
    // Every station of this block is settled now — nothing left to track (S4).
    const inBlock = new Set((block.stations ?? []).map(s => s.id));
    setFreshStations(prev => new Set([...prev].filter(id => !inBlock.has(id))));
    setOpenStation(null);
  };

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
  function addBlockFromDrill(drill: RepTeamDrill, at: number = plan.blocks.length, replaceId?: string) {
    // A plan that filled up under the open sheet (another tab's autosave) closes it rather than
    // leaving a picker whose every pick does nothing. A REPLACEMENT adds no block, so it is never full.
    if (!replacesABlock(replaceId) && plan.blocks.length >= MAX_BLOCKS) { setDrillSheet(null); return; }
    const block: PracticePlanBlock = {
      id: newPracticePlanId(),
      title: drill.name,
      duration: { minutes: drill.usualMinutes ?? DEFAULT_BLOCK_MINUTES },
      stations: [drillToStation(drill, newPracticePlanId)],
    };
    insertBlock(block, at, replaceId);
  }

  /**
   * A circuit becomes a whole BLOCK (stage 4, L9): titled by the circuit, its minutes, its station
   * columns, the rotation's clock as saved, the groups EMPTY (people never travel) — and, opened,
   * fully editable with the provenance line. `circuitToBlock` mints the ids and stamps the id and
   * name; a station that came from a drill still reads "From your drills" inside it.
   */
  function addBlockFromCircuit(circuit: RepTeamCircuit, at: number = plan.blocks.length, replaceId?: string) {
    if (!replacesABlock(replaceId) && plan.blocks.length >= MAX_BLOCKS) { setDrillSheet(null); return; }
    insertBlock(circuitToBlock(circuit, newPracticePlanId), at, replaceId);
  }

  /** The pick REPLACES only while its block is still in the plan (/review, §231 walk): one that
   *  vanished under the picker (another tab's autosave) makes the pick an ordinary insert, which the
   *  block limit must still govern — the server keeps the first MAX_BLOCKS by position and would
   *  drop whichever block landed last, silently. */
  function replacesABlock(replaceId: string | undefined): boolean {
    return !!replaceId && plan.blocks.some(b => b.id === replaceId);
  }

  /** A library thing lands at `at` — the end for the panel's Add and the sheet, a gap for a drop —
   *  or, from a new block's "Start from a drill ›" (`replaceId`), takes that block's place and its
   *  id, so the row focus returns to on close is the pick's (§231 walk). A block that vanished under
   *  the picker (another tab's autosave) makes it an ordinary insert at `at`. */
  function insertBlock(block: PracticePlanBlock, at: number, replaceId?: string) {
    const next = plan.blocks.slice();
    const replacing = replaceId ? next.findIndex(b => b.id === replaceId) : -1;
    if (replacing >= 0) next[replacing] = { ...block, id: replaceId! };
    else next.splice(Math.max(0, Math.min(at, next.length)), 0, block);
    setBlocks(next);
    /* Lands SHUT (owner ask, 2026-09-15, revising the earlier "opens in place" call) — the sheet
       the coach just closed showed the drill's full teaching, setup and equipment a breath ago;
       reopening the same block here would only show it all again. The shut row's own "Watching
       for" line (above) is now enough of a receipt that it landed right. */
    openBlock(null);
    setDrillSheet(null);
  }

  /** A block dropped in a gap (L2) — `gap` is the position it takes among the OTHER blocks. The
      block is found by ID at the drop, never by the index the lift captured — the file's rule for
      every target (a plan can change shape under a pointer). */
  function moveBlockTo(blockId: string, gap: number) {
    const from = plan.blocks.findIndex(b => b.id === blockId);
    if (from < 0) return;
    const to = gap > from ? gap - 1 : gap;
    if (to === from) return;
    const next = plan.blocks.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setBlocks(next);
  }

  /* ── The drop (L2): the ONE place a drag changes the plan. Every target is exact — a gap takes a
     new block at that index (a drill's, a circuit's) or the moved block; the open block's station
     door takes a DRILL by D13's rule through the same path the sheet's pick takes; a slot between
     station columns takes a station of that same block. A drop with no target under the pointer
     does nothing at all. ── */
  const onDragStart = (e: DragStartEvent) => setLifted((e.active.data.current as DragData | undefined) ?? null);
  const onDragOver = (e: DragOverEvent) => {
    const where = e.over?.data.current as DropData | undefined;
    setOverGap(where?.kind === 'gap' ? where.index : null);
  };
  const onDragEnd = (e: DragEndEvent) => {
    setOverGap(null);
    setLifted(null);
    const what = e.active.data.current as DragData | undefined;
    const where = e.over?.data.current as DropData | undefined;
    if (!what || !where) return;
    if (where.kind === 'stationSlot') {
      if (what.kind === 'station' && what.blockId === where.blockId) moveStationTo(where.blockId, what.stationId, where.index);
      return;
    }
    if (where.kind === 'gap') {
      if (what.kind === 'drill') addBlockFromDrill(what.drill, where.index);
      else if (what.kind === 'circuit') addBlockFromCircuit(what.circuit, where.index);
      else if (what.kind === 'block') moveBlockTo(what.blockId, where.index);
      return;
    }
    // The station door: a drill only, and only the open block's (the target renders there alone).
    if (what.kind === 'drill') addStationFromDrill(where.blockId, what.drill);
  };

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
      // A WRITTEN block's first station makes two (D13) — its words become station 1, the drill
      // station 2. `splitBlockIntoStations` is the whole decision; a wordless block or a circuit
      // simply gains the station.
      setBlocks(plan.blocks.map(b => (b.id === blockId ? splitBlockIntoStations(b, fresh) : b)));
      // Asked for from INSIDE this block's station form (the last station's "+ Add a station"):
      // the form steps to the drill it just added, as "Write a station" steps to the blank one —
      // left behind on the station before, the coach would have to find what they asked for.
      if (openStation?.blockId === blockId) setOpenStation({ blockId, stationId: fresh.id });
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
      // The same D13 split for a written station: the block's words become station 1, the blank
      // station 2 — "+ Stations" means you now have two.
      const made: PracticeStation = { id: newPracticePlanId(), name: '' };
      const split = splitBlockIntoStations(block, made);
      setBlocks(plan.blocks.map(b => (b.id === blockId ? split : b)));
      /* ⚠ AND IT OPENS (practice plans on a phone, stage 2 · S2 = A, owner 2026-09-24). "Write a
         station" used to add a blank card and open nothing — five taps to the first letter. The
         station it makes opens now, the cursor in its name, at every width. Every station the split
         made is FRESH (S4): D13's station 1 carries the block's words, so it is never "untouched". */
      const before = new Set(stations.map(s => s.id));
      const fresh = (split.stations ?? []).filter(s => !before.has(s.id)).map(s => s.id);
      setFreshStations(prev => new Set([...prev, ...fresh]));
      setOpenStation({ blockId, stationId: made.id, fresh: true });
    }
    setDrillSheet(null);
  }

  /**
   * The station's screen CLOSES (←, Done, Escape, the scrim, the phone's Back) — and a station added
   * this visit that still holds nothing at all goes with it (stage 2 · S4 = A, owner 2026-09-24).
   * Every one of the block's fresh stations, not only the one on screen: D13 on a block with no
   * words makes TWO blanks, and the second may never have been opened. Removed through
   * `collapseSoleStation`, so leaving the new second station of a split untouched puts the block
   * back exactly as it was (D13's reverse). A STEP (‹ ›) removes nothing — the count under the
   * coach's thumb never renumbers mid-walk; the close settles it. "Nothing at all" is field by
   * field (`stationIsEmpty`), so kit or people the settle pass moved onto a new station keep
   * it — the collapse carries them home rather than a removal dropping them — and a station the
   * coach typed anything into is no longer fresh (`onTouched`), so a staff name still being
   * created when they close keeps its station (/review, 2026-09-24).
   * ⚠ Only while WRITING: reading, the page's `onChange` is a no-op, so a removal there would be
   * lost AND forget the ids. The station head's "Done editing" drops first (`doneEditingStation`).
   */
  const dropFreshEmptyStations = (blockId: string): PracticePlanBlock | undefined => {
    if (readOnly || freshStations.size === 0) return undefined;
    const block = plan.blocks.find(b => b.id === blockId);
    if (!block) return undefined;
    const inBlock = new Set((block.stations ?? []).map(s => s.id));
    setFreshStations(prev => new Set([...prev].filter(id => !inBlock.has(id))));
    const next = dropEmptyStations(block, freshStations);
    if (next !== block) setBlocks(plan.blocks.map(b => (b.id === block.id ? next : b)));
    return next;
  };
  const closeStation = () => {
    setOpenStation(null);
    if (openStation) dropFreshEmptyStations(openStation.blockId);
  };
  const doneEditingStation = onDoneEditing && (() => {
    const next = openStation ? dropFreshEmptyStations(openStation.blockId) : undefined;
    // The station on screen was the empty new one: it went, so its screen goes with it.
    if (next && openStation && !next.stations?.some(s => s.id === openStation.stationId)) setOpenStation(null);
    onDoneEditing();
  });
  /** The coach typed on this station — it is theirs now (S4). */
  const touchStation = (stationId: string) => setFreshStations(prev => {
    if (!prev.has(stationId)) return prev;
    const next = new Set(prev);
    next.delete(stationId);
    return next;
  });

  // ── Tonight's sets (groups at every level, owner rulings G1–G8, 2026-09-28) ──────────────────
  // Every write goes through `commitSets` — the sets and the blocks in ONE change, through the same
  // settling passes as `setBlocks`, so the screen and the column agree on who is where.

  /** The practice's sets, and where each is used (the fold, the menus, the room's "Used in …"). */
  const groupings = useMemo(() => plan.groupings ?? [], [plan.groupings]);
  const uses = useMemo(() => groupingUses({ blocks: plan.blocks }), [plan.blocks]);
  const rosterIdSet = useMemo(() => new Set(roster.map(p => p.id)), [roster]);

  const commitSets = (nextSets: readonly PracticeGrouping[], blocks: PracticePlanBlock[] = plan.blocks) => {
    const next: PracticePlan = { ...plan, blocks };
    if (nextSets.length) next.groupings = [...nextSets];
    else delete next.groupings;
    onChange(settlePlanLevels(next));
  };
  /** What `target` holds right now, or null when the place is gone. */
  const holdingOf = (target: SetTarget): Holding | null => {
    const block = plan.blocks.find(b => b.id === target.blockId);
    if (!block) return null;
    if (target.kind === 'block') return { playerIds: block.playerIds, groupingId: block.groupingId };
    if (target.kind === 'rotation') return { groupingId: block.rotation?.groupingId };
    const station = block.stations?.find(s => s.id === target.stationId);
    return station ? { playerIds: station.playerIds, groupingId: station.groupingId } : null;
  };
  /** The blocks with `target` holding `holding` — its names OR its set, the other key cleared. */
  const blocksWith = (target: SetTarget, holding: Holding, blocks: PracticePlanBlock[] = plan.blocks) => blocks.map(b => {
    if (b.id !== target.blockId) return b;
    if (target.kind === 'block') return { ...b, playerIds: holding.playerIds, groupingId: holding.groupingId };
    if (target.kind === 'rotation') return { ...b, rotation: { ...(b.rotation ?? { intervalMinutes: null }), groupingId: holding.groupingId } };
    return {
      ...b,
      stations: (b.stations ?? []).map(st => (st.id === target.stationId
        ? { ...st, playerIds: holding.playerIds, groupingId: holding.groupingId } : st)),
    };
  });
  /** Everyone in a set, in roster order — who a place keeps as a plain list when it leaves the set. */
  const membersOf = (set: PracticeGrouping | undefined) => rosterOrder.filter(pid => set?.groups.some(g => g.playerIds.includes(pid)));
  /** A place by its name — "Partner throwing", "Warm up pitchers → Bullpen" (the room's copy door). */
  const placeLabel = (target: SetTarget, setId: string) => {
    const use = (uses.get(setId) ?? []).find(u => sameTarget(u, target));
    return use?.label ?? (plan.blocks.find(b => b.id === target.blockId)?.title.trim() || 'this block');
  };
  /** The room's draw when a set has never been drawn: one group per named station for a circuit;
   *  PAIRS for a block or a station that is one activity (G5); three groups for the night's own. */
  const defaultDrawFor = (target: SetTarget | null): DrawChoice => {
    if (target?.kind === 'rotation') {
      const named = plan.blocks.find(b => b.id === target.blockId)?.stations?.filter(s => s.name.trim()).length ?? 0;
      return { mode: 'groups', n: Math.max(2, Math.min(named, MAX_GROUPS)) };
    }
    return target ? { mode: 'perGroup', n: 2 } : { mode: 'groups', n: 3 };
  };

  /** "Use groups from tonight" — the place points at a set that is already there (G1). */
  const pointAtSet = (target: SetTarget, setId: string) => commitSets(groupings, blocksWith(target, { groupingId: setId }));
  /**
   * "New groups…" / "+ Groups for tonight" — a new, empty set; the place (when there is one) points
   * at it at once, and the room opens on it. A place that had CHOSEN players makes a set for them
   * alone ("Split them into groups…": the draw deals only from them). Named in the place's words —
   * "Pairs" where the draw opens on pairs, "Groups" elsewhere — the coach types over it.
   */
  const newSet = (target: SetTarget | null) => {
    const held = target ? holdingOf(target) : null;
    const draw = defaultDrawFor(target);
    const pairs = draw.mode === 'perGroup' && draw.n === 2;
    // The set carries its SHAPE from the start (pairs, or so many groups), so its words are right
    // before the first draw; one made from the Groups list itself may stand with nothing using it.
    const set = newGrouping(nextGroupingName(groupings, pairs ? 'Pairs' : 'Groups'), {
      forPlayerIds: held?.groupingId ? undefined : held?.playerIds,
      draw,
      standing: !target,
    });
    commitSets([...groupings, set], target ? blocksWith(target, { groupingId: set.id }) : plan.blocks);
    setOpenSet({ setId: set.id, from: target, made: { held } });
  };
  /** Every change in the room writes the set whole. */
  const changeSet = (next: PracticeGrouping) => commitSets(groupings.map(s => (s.id === next.id ? next : s)));
  /**
   * Leave a set (the menu's way out): a block or a station back to the whole team, or to choosing
   * players — starting from the set's own people, the picker open on them; a circuit to no groups.
   * The set stays on the practice's list for whatever else uses it.
   */
  const leaveSet = (target: SetTarget, then: 'team' | 'choose') => {
    const set = groupingById(groupings, holdingOf(target)?.groupingId);
    const names = then === 'choose' ? membersOf(set) : undefined;
    commitSets(groupings, blocksWith(target, { playerIds: names?.length ? names : undefined }));
    if (then === 'choose' && target.kind !== 'rotation') setAttach(target);
  };
  /** "Make a separate copy for Partner throwing" (G1) — the copy takes this place, the room follows. */
  const copySetFor = (target: SetTarget, setId: string) => {
    const set = groupingById(groupings, setId);
    if (!set) return;
    const copy = copyGrouping(set, { name: nextGroupingName(groupings, `${set.name.trim() || 'Groups'} (copy)`) });
    commitSets([...groupings, copy], blocksWith(target, { groupingId: copy.id }));
    setOpenSet({ setId: copy.id, from: target });
  };
  /**
   * Delete a set (the room asks first). People MOVE, never vanish (D8): a block or a station that
   * used it keeps the same players as a plain list; a circuit goes back to no groups.
   */
  const deleteSet = (setId: string) => {
    const set = groupingById(groupings, setId);
    const names = membersOf(set);
    let blocks = plan.blocks;
    for (const use of uses.get(setId) ?? []) {
      const target: SetTarget = use.rotates ? { kind: 'rotation', blockId: use.blockId }
        : use.stationId ? { kind: 'station', blockId: use.blockId, stationId: use.stationId }
          : { kind: 'block', blockId: use.blockId };
      blocks = blocksWith(target, use.rotates || names.length === 0 ? {} : { playerIds: names }, blocks);
    }
    commitSets(groupings.filter(s => s.id !== setId), blocks);
    setOpenSet(null);
  };
  /**
   * "From another practice…" (G6) — a COPY of that practice's set joins tonight's (a plan belongs to
   * one practice, D7), with anyone off tonight's roster left behind; the place points at it and the
   * room opens on it, one line saying where it came from and who in it hasn't replied yes.
   */
  const adoptFromPractice = (target: SetTarget | null, from: GroupingElsewhere) => {
    const copied = copyGrouping(from.set, {
      name: nextGroupingName(groupings, from.set.name.trim() || 'Groups'), groupSource: 'previous', rosterIds: rosterIdSet,
    });
    // Brought in from the Groups list (no place yet): it stands on the list until something uses it.
    const copy: PracticeGrouping = target ? copied : { ...copied, standing: true };
    commitSets([...groupings, copy], target ? blocksWith(target, { groupingId: copy.id }) : plan.blocks);
    const day = from.startsAt ? formatInOrgZone(from.startsAt, { weekday: 'short', month: 'short', day: 'numeric' }) : from.eventName;
    const waiting = membersOf(copy).filter(pid => notRepliedIds.has(pid)).map(nameOf);
    const waitingLine = waiting.length === 0 ? ''
      : ` ${waiting.join(', ')} ${waiting.length === 1 ? 'hasn’t' : 'haven’t'} replied yes for tonight — still placed, shown dashed.`;
    setFromPractice(null);
    setOpenSet({ setId: copy.id, from: target, note: `Copied from ${day}.${waitingLine}` });
  };
  /**
   * The room CLOSES — and a set this visit just made that still places nobody goes, the place back
   * as it was (a "New groups…" pressed by mistake costs nothing). Only while writing.
   */
  const closeSet = () => {
    const made = openSet?.made;
    const set = openSet ? groupingById(groupings, openSet.setId) : undefined;
    const from = openSet?.from ?? null;
    setOpenSet(null);
    if (readOnly || !made || !set || set.groups.some(g => g.playerIds.length > 0)) return;
    const blocks = from && made.held && holdingOf(from)?.groupingId === set.id ? blocksWith(from, made.held) : plan.blocks;
    commitSets(groupings.filter(s => s.id !== set.id), blocks);
  };
  const setsWiring: SetsWiring = {
    groupings,
    uses,
    canCopyFromPractice: !withoutPeople && groupingsElsewhere.length > 0,
    onUse: pointAtSet,
    onNew: newSet,
    onFromPractice: target => setFromPractice({ target }),
    onEdit: (target, setId) => setOpenSet({ setId, from: target }),
    onLeave: leaveSet,
  };

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

  /**
   * The name a station promotes under: its own — or, for a block's ONLY station, the block's title
   * (stage 3, D1: the station IS the block, and the flattened body never asks for a second name).
   */
  function promoteName(block: PracticePlanBlock, station: PracticeStation): string {
    return station.name.trim() || (soleStationOf(block) === station ? block.title.trim() : '');
  }

  /**
   * Kit resolved to NAMES for a drill's own equipment field (the legacy string list). A drill's
   * field is separate from mig 266's library and only reads the string; resolving current tag
   * names first is what stops a station or block edited under the new picker promoting with its
   * equipment silently gone. Legacy names already on the row ride along.
   */
  const kitNamesOf = (o: { equipment?: string[]; equipmentTagIds?: string[] }): string[] =>
    mergedTagNames(o.equipment, o.equipmentTagIds, equipmentTags);
  /** The library's ACTIVE drills — what the circuit's tick reads a typed name against (S2). */
  const activeDrills = useMemo(() => drills.filter(d => d.isActive), [drills]);

  /** The drill a written STATION or a bare written BLOCK would become — one reader per shape. */
  function drillInputFor(block: PracticePlanBlock, station: PracticeStation | null, tagIds: string[]): DrillInput {
    if (station) {
      return stationToDrillInput({ ...station, name: promoteName(block, station), equipment: kitNamesOf(station) }, tagIds);
    }
    // L1: title → name, the words and points, the kit, and the block's MINUTES as "usually".
    // The kit's ids travel too, as a station's do (`stationToDrillInput`): without them an Update
    // from a bare block would leave the drill holding only a name snapshot of kit it held by id.
    return { ...blockToDrillInput(block, kitNamesOf(block), tagIds), equipmentTagIds: block.equipmentTagIds ?? [] };
  }

  async function promoteToDrill(name: string, tagIds: string[], update: SaveOverTarget | null) {
    if (promoteBusy || !promoting || promoting.kind === 'circuit') return;
    const save = update ? onUpdateDrill : onCreateDrill;
    if (!save) return;
    const block = plan.blocks.find(b => b.id === promoting.blockId);
    const station = promoting.kind === 'station' ? block?.stations?.find(s => s.id === promoting.stationId) ?? null : null;
    if (!block || (promoting.kind === 'station' && !station)) { setPromoting(null); return; }
    setPromoteBusy(true); setPromoteError('');
    // An update keeps the drill's own spelling, and — from a station, which has no such number —
    // its "usually" (a bare block brings its minutes, as its save always has).
    const input: DrillInput = { ...drillInputFor(block, station, tagIds), name: update ? update.name : name };
    if (update && station) input.usualMinutes = drills.find(d => d.id === update.id)?.usualMinutes ?? null;
    const result = update ? await onUpdateDrill!(update.id, input) : await onCreateDrill!(input);
    setPromoteBusy(false);
    // Followed even when the server's walk fell short (the drill itself is saved) — see followDrill.
    if (update && result.drill) followDrill(result.drill, station?.id ?? null);
    if (!result.ok) { setPromoteError(result.error ?? 'Could not save that drill.'); return; }
    // ⚠ A NEW drill COPIES: tonight's station or block is left exactly as it is — it does not
    // become drill-backed and so does not turn read-only under the coach's hands. An UPDATE is
    // different (D9): tonight's station is that drill again, so `followDrill` relinks it.
    setPromoting(null);
  }

  /**
   * After a drill is saved over (owner rulings D3 · D9, 2026-10-02): the station it was saved from
   * rejoins it — it IS that drill now — and, while this practice hasn't started, every other station
   * on this plan still linked to it takes the new version, exactly as the server has just done to the
   * team's other upcoming practices. Done HERE as well because this page's autosave writes the whole
   * plan back: without it the next save would put tonight's old words over the server's walk. A
   * practice that has started keeps what it ran, apart from the station the coach just saved.
   */
  function followDrill(drill: RepTeamDrill, savedStationId: string | null) {
    const upcoming = !practiceStarted(eventStartsAt, Date.now());
    let changed = false;
    const blocks = plan.blocks.map(b => {
      const relinked = savedStationId && b.stations?.some(s => s.id === savedStationId)
        ? { ...b, stations: b.stations.map(s => (s.id === savedStationId ? refreshStationFromDrill(s, drill) : s)) }
        : b;
      const next = upcoming ? refreshBlockFromDrill(relinked, drill).block : relinked;
      if (next !== b) changed = true;
      return next;
    });
    // A bare block saved as a drill links nothing, so there may be nothing to follow — and an
    // unchanged plan must not cost an autosave.
    if (changed) setBlocks(blocks);
  }

  /**
   * "Save to my circuits…" (L9). The TICK creates the written stations as drills FIRST, through the
   * same create the station's promote uses, and only then is the circuit stored with its stations
   * pointing at them — so the drills' counts work, and next time the circuit is placed its stations
   * arrive drill-backed. A station whose create fails stops the save with the error; nothing on
   * tonight's plan changes either way.
   *
   * ⚠ Only the stations the coach KEPT TICKED are touched (S1). A ticked row whose name the library
   * already holds is not created again — the circuit's station is pointed at the existing drill and
   * rebuilt from it (S2), which is also what a save that failed midway needs on its retry: the
   * drills it did create are in `drills` by then (the page folds each create in at once), so their
   * rows re-open as "already in your drills" and the retry links rather than duplicates. An
   * unticked row is left exactly as typed, linked to nothing.
   */
  async function promoteToCircuit(name: string, tagIds: string[], pickedStationIds: string[], update: SaveOverTarget | null) {
    if (promoteBusy || !promoting || promoting.kind !== 'circuit' || !(update ? onUpdateCircuit : onCreateCircuit)) return;
    const block = plan.blocks.find(b => b.id === promoting.blockId);
    if (!block) { setPromoting(null); return; }
    setPromoteBusy(true); setPromoteError('');
    let shape = blockToCircuitShape(block);
    if (pickedStationIds.length > 0 && onCreateDrill) {
      const kept = new Set(pickedStationIds);
      /* Keyed by the row's STATION id — the row's own station and no other, so a hidden same-named
         twin (one row per name) is left exactly as typed rather than rebuilt alongside. */
      const link = new Map<string, RepTeamDrill>();
      for (const { station, existing } of tickRowsFor(block, activeDrills)) {
        if (!kept.has(station.id)) continue;
        if (existing) { link.set(station.id, existing); continue; }
        const result = await onCreateDrill(stationToDrillInput({ ...station, equipment: kitNamesOf(station) }, tagIds));
        if (!result.ok || !result.drill) {
          setPromoteBusy(false);
          setPromoteError(result.error ?? `Could not save “${station.name}” as a drill.`);
          return;
        }
        link.set(station.id, result.drill);
      }
      shape = pointStationsAtDrills(shape, link);
    }
    // The NAME is the window's (D4, bug 1 — never the block's title, which may be empty). An update
    // keeps the circuit's own name and replaces its shape and tags (D2).
    const result = update
      ? await onUpdateCircuit!(update.id, { tagIds, block: shape })
      : await onCreateCircuit!({ name, tagIds, block: shape });
    setPromoteBusy(false);
    if (!result.ok) { setPromoteError(result.error ?? 'Could not save that circuit.'); return; }
    // ⚠ Copies, either way. Tonight's block stays exactly as it was — its stations do not become
    // drill-backed on the page, and an update never reaches a block already placed (D10).
    setPromoting(null);
  }

  /** "+ New drill" at the docked panel's foot — the one sheet the Drills tab opens (L5 · L6). */
  async function saveNewDrill() {
    if (!newDrill || !onCreateDrill) return;
    setNewDrillBusy(true); setNewDrillError('');
    const result = await onCreateDrill(newDrill);
    setNewDrillBusy(false);
    if (!result.ok) { setNewDrillError(result.error ?? 'Could not save that drill.'); return; }
    setNewDrill(null);
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
    // A place that uses a set LEAVES it on the first tick (the picker opened from "Choose players…"
    // on its menu): its names start as the set's people, and the set stays on the practice's list.
    const names = (level: { playerIds?: string[]; groupingId?: string }) =>
      (level.groupingId ? membersOf(groupingById(groupings, level.groupingId)) : level.playerIds);

    if (target.kind === 'block') {
      patchBlock(block.id, { playerIds: inRosterOrder(toggle(names(block))), groupingId: undefined });
    } else {
      patchBlock(block.id, {
        stations: (block.stations ?? []).map(s =>
          (s.id === target.stationId ? { ...s, playerIds: inRosterOrder(toggle(names(s))), groupingId: undefined } : s)),
      });
    }
    // A GROUP's people are moved in the groups room, one chip at a time (`movePlayerToGroup` —
    // a player belongs to exactly ONE group, and the room keeps that the way the picker did).
  }

  function selectedIdsFor(target: AttachTarget): string[] {
    const block = plan.blocks.find(b => b.id === target.blockId);
    if (!block) return [];
    const level = target.kind === 'block' ? block : block.stations?.find(s => s.id === target.stationId);
    if (!level) return [];
    // A place using a set shows the set's people ticked — the first tick makes them its own list.
    return level.groupingId ? membersOf(groupingById(groupings, level.groupingId)) : level.playerIds ?? [];
  }

  /**
   * Does the thing this picker is assigning to still exist?
   *
   * Deleting the block or station while its picker is open would otherwise leave a dead-end
   * dialog: every tap silently does nothing, because there is nothing left to assign to.
   * Derived rather than cleared in each delete handler, so it holds for any future path that
   * removes a target — the modal simply closes itself, which is the right answer.
   */
  function attachTargetExists(target: AttachTarget): boolean {
    const block = plan.blocks.find(b => b.id === target.blockId);
    if (!block) return false;
    if (target.kind === 'block') return true;
    return !!block.stations?.some(s => s.id === target.stationId);
  }

  /* ⚠ EVERY WRITING DIALOG RESOLVES TO NOTHING IN READ MODE (stage 6, /review 2026-09-18). The
     editor is keyed per practice, not per mode, and `readOnly` can flip TRUE under an open dialog
     without a remount: the plan page reads the record boundary from its minute clock, so a picker
     or the groups room left open past three hours after the practice's end would otherwise stay
     up — the picker still able to write a player onto a record, the room's scroll lock outliving
     the room it belonged to (its JSX is gated on `!readOnly`; its lock was not). Resolved here, in
     the same place a vanished target already closes them, so the lock and the dialog agree. The
     station modal is the one that stays: it has a read face of its own. */
  const pickerTarget = !readOnly && attach && attachTargetExists(attach) ? attach : null;
  const selectedIds = pickerTarget ? selectedIdsFor(pickerTarget) : [];
  /** The picker is a sole station's — the block's own Players line, one level down (D1). */
  const pickerIsSoleStation = pickerTarget?.kind === 'station'
    && soleStationOf(plan.blocks.find(b => b.id === pickerTarget.blockId) ?? {})?.id === pickerTarget.stationId;
  /* The station modal's target, resolved the same way — gone means closed. */
  const openStationBlock = openStation ? plan.blocks.find(b => b.id === openStation.blockId) : undefined;
  const openStationRow = openStation ? openStationBlock?.stations?.find(s => s.id === openStation.stationId) : undefined;
  /* "Start from a drill ›" (S2) — offered while the coach is still ON the station they just added
     (`openStation.fresh`: a step away, or a close, ends it) and it is not a drill yet.
     ⚠ NOT "while it holds nothing" (§231 walk, owner 2026-09-25: "if I start typing something by
     accident I can't get back to loading a drill"). One stray keystroke took the door away for good.
     It stays, and when the station holds anything the coach is ASKED first — the pick replaces the
     whole station (name, staff, words), keeping only its place. */
  const offerStartFromDrill = !!openStation?.fresh && !!openStationRow && !readOnly && !openStationRow.drillId && drills.length > 0;
  const startStationFromDrill = async () => {
    if (!openStation || !openStationRow) return;
    // Asked when it HOLDS anything, or the coach has TYPED anything (S4's touch, counted on input):
    // a new staff name is saved a moment after the keystrokes that asked for it (/review, §231).
    if (!stationIsEmpty(openStationRow) || !freshStations.has(openStationRow.id)) {
      const ok = await confirm({
        title: 'Replace this station with a drill?',
        message: 'The drill you pick takes this station’s place — what you’ve written here goes.',
        confirmText: 'Choose a drill',
        cancelText: 'Keep it',
      });
      if (!ok) return;
    }
    setDrillSheet({ kind: 'station', blockId: openStation.blockId, swapId: openStation.stationId, startFrom: true });
  };
  /* The groups room's set, resolved the same way — a set deleted under the room (another tab's
     autosave) closes it rather than leaving a room with nothing to arrange; and never in read mode
     (the room writes). The same for the "From another practice" sheet. */
  const openSetRow = readOnly || withoutPeople || !openSet ? undefined : groupingById(plan.groupings, openSet.setId);
  const fromPracticeOpen = !readOnly && !withoutPeople && !!fromPractice;
  const openDrillSheet = readOnly ? null : drillSheet;
  const openPromoting = readOnly ? null : promoting;
  const openNewDrill = readOnly ? null : newDrill;
  // Register with the shared overlay stack: hides the mobile bottom nav while a sheet is up (so a
  // mis-tap can't land on a nav tab underneath it) and locks the page behind it. Read the RESOLVED
  // targets, not the raw state: a station or a picker target that vanished under its dialog
  // (another tab's autosave) unmounts the dialog, and the lock must go with it (/review, 2026-09-15).
  /* ⚠ THE PHONE'S BLOCK SHEET (practice plans on a phone, K2, 2026-09-23). At ≤640 the open block
     is a full-screen sheet over the list rather than a card inside the spine. The circuit editor's
     lone block stays on its page — it has no list to leave. Decided in JS, not CSS: the two
     presentations differ in STRUCTURE (a row plus a dialog vs a card), which a stylesheet cannot do. */
  const phoneSheet = useIsPhone(!soloBlock); // `false` answers false — the circuit editor never asks
  /* "+ Add a station" — ONE behaviour for the block's add control and the last station's walk
     (owner, 2026-09-28), so the two can never add differently. On a phone it makes the station and
     opens it — no chooser first (S2 = A: the block's own K4, one level down; the library is "Start
     from a drill ›" inside it). A desk keeps the chooser as its first stop: it has the library
     panel to drag from as well. */
  const addStationTo = (blockId: string) => (phoneSheet
    ? addBlankStation(blockId)
    : setDrillSheet({ kind: 'station', blockId }));
  const sheetIndex = phoneSheet && openId ? plan.blocks.findIndex(b => b.id === openId) : -1;
  const sheetBlock = sheetIndex >= 0 ? plan.blocks[sheetIndex] : undefined;
  useOverlayOpen(!!pickerTarget || !!openDrillSheet || !!openPromoting || !!openStationRow || !!openSetRow || fromPracticeOpen || !!openNewDrill || !!sheetBlock);
  /* When the block's sheet closes, the list picks out the block the coach was LAST on (K2); gone →
     the add row. */
  useFocusLastShownOnClose(sheetBlock?.id ?? null, blockRowFor);
  /* The same for a STATION's screen (stage 2): the station LAST shown, else — S4 removed it, or its
     bin did — the block's add control. */
  useFocusLastShownOnClose(
    openStationRow && openStation ? JSON.stringify([openStation.blockId, openStationRow.id]) : null,
    stationDoorFor,
  );
  /* The roster picker's dialog floor (stage 2, D9) — armed while it is open; Escape closes it
     and hands focus back to the "Choose players…" that opened it. ⚠ Escape never closes an open
     BLOCK: a row is not a sheet, and the floor is mounted on the sheets alone. */
  const pickerPanelRef = useRef<HTMLDivElement>(null);
  useDialogFloor(!!pickerTarget, pickerPanelRef, { onClose: () => setAttach(null) });

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
  const focusIncluded = plan.includeFocusAreas === true && layout.sheet;
  const canOfferFocus = !readOnly && layout.sheet && !focusIncluded && (withoutPeople || canViewFocus);
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
  /* "a drill from your library" DOCKS the library on a wide desktop (stage 4, L5 — the ghost row's
     own words do the toggle's job on the blank page, which has no toolbar yet) and opens the
     sheet everywhere else, so one link means one thing. Kept while docked: it is the keyboard's
     path to a new block, and one door too many is cheaper than a missing one. */
  const docked = !!library?.docked;
  const openLibrary = () => {
    if (library?.canDock) library.onDock(true);
    else setDrillSheet({ kind: 'block' });
  };
  const ghostAlternatives = [
    firstBlock && onStartFrom ? { label: 'start this plan from…', onClick: onStartFrom } : null,
    drills.length > 0 || circuits.length > 0 ? { label: 'a drill from your library', onClick: openLibrary } : null,
  ].filter((a): a is { label: string; onClick: () => void } => !!a);
  const removeFocus = () => {
    const next = { ...plan };
    delete next.includeFocusAreas;
    onChange(next);
  };

  /* One block's wiring, shared by its row in the timeline and — on a phone — the sheet it opens
     into, so the two can never be wired differently. `open` / `openDoors` / `phone` / `sheet` are
     the caller's: they are the only things the two presentations decide differently. */
  const blockCardProps = (block: PracticePlanBlock, i: number) => ({
    block,
    index: i,
    blockCount: plan.blocks.length,
    // The gutter reads the PREVIEW while a block is carried over a gap (R4), and says which moved.
    clock: (previewClocks ?? clockByBlock).get(block.id),
    clockPreview: !!previewClocks && previewClocks.get(block.id)?.startLabel !== clockByBlock.get(block.id)?.startLabel,
    // From the SAME clock walk as the gutter — never a second copy of the arithmetic.
    blockStartMs: clockByBlock.get(block.id)?.startMs,
    solo: soloBlock,
    focusTitle: freshId === block.id,
    readOnly,
    withoutPeople,
    restTakenElsewhere: !layout.restOffered || (restBlockId != null && restBlockId !== block.id),
    roster,
    notRepliedIds,
    staffTags, onCreateStaffTag, staffPeople, onPickStaffPerson,
    mineBlocks, mineStations,
    equipmentTags, onCreateEquipmentTag,
    staffManage, onStaffTagsChanged,
    equipmentManage, onEquipmentTagsChanged,
    nameOf,
    onOpen: () => openBlock(block),
    onClose: () => openBlock(null),
    onOpenDoor: openDoor,
    onCloseDoor: closeDoor,
    onMove: (delta: number) => moveBlock(i, delta),
    onDelete: () => {
      setBlocks(plan.blocks.filter(b => b.id !== block.id));
      if (openId === block.id) openBlock(null);
    },
    onPatch: (patch: Partial<PracticePlanBlock>) => patchBlock(block.id, patch),
    onOpenPicker: setAttach,
    onAddStation: (swapId?: string) => (swapId
      ? setDrillSheet({ kind: 'station', blockId: block.id, swapId })
      : addStationTo(block.id)),
    onDetachStation: (stationId: string) => detachStation(block.id, stationId),
    onSwapStation: (stationId: string) => setDrillSheet({ kind: 'station', blockId: block.id, swapId: stationId }),
    onPromoteStation: (stationId: string) => {
      setPromoteError('');
      setPromoting({ kind: 'station', blockId: block.id, stationId });
    },
    // The library door by shape (L1 · L9) — absent for a viewer who can't write to the
    // library, and inside the circuit editor (a circuit is not saved from itself).
    onPromoteBlock: onCreateDrill && layout.promote ? () => { setPromoteError(''); setPromoting({ kind: 'block', blockId: block.id }); } : undefined,
    onPromoteCircuit: onCreateCircuit && layout.promote ? () => { setPromoteError(''); setPromoting({ kind: 'circuit', blockId: block.id }); } : undefined,
    onOpenStation: (stationId: string) => setOpenStation({ blockId: block.id, stationId }),
    onPatchStation: (stationId: string, patch: Partial<PracticeStation>) => patchStation(block.id, stationId, patch),
    onMoveStation: (stationId: string, delta: number) => moveStation(block.id, stationId, delta),
    sets: setsWiring,
  });

  /* The sheet's walk (K2): the neighbouring blocks by their titles, the arrows stopping at the ends.
     A step re-opens through `openBlock`, so the doors re-seed exactly as a tap on the row would. */
  const sheetWalk: RoomNav | null = sheetBlock ? {
    ...blockWalk(plan.blocks, sheetBlock.id),
    noun: 'blocks',
    onSelect: id => openBlock(plan.blocks.find(b => b.id === id) ?? null),
  } : null;
  /* The row at the sheet's end names the next block with its clock and length (§227, option C) —
     the clock the timeline's gutter prints, absent on a template (it has none). */
  const nextSheetBlock = sheetWalk?.next ? plan.blocks.find(b => b.id === sheetWalk.next!.id) : undefined;
  const nextSheetClock = nextSheetBlock ? clockByBlock.get(nextSheetBlock.id)?.startLabel : undefined;
  const sheetOnward = {
    kicker: nextSheetClock ? `Next · ${nextSheetClock}` : 'Next',
    meta: nextSheetBlock ? formatDuration(nextSheetBlock.duration) || null : null,
  };
  /* The foot of the timeline: the ghost row, or — on a phone once the plan has a block — one row (K4). */
  const canAddBlock = layout.timeline && plan.blocks.length < MAX_BLOCKS;
  const phoneAddRow = phoneSheet && !firstBlock;
  /* K4: a block JUST added from "+ Add a block" offers the library under its title — while the
     coach is still ON it (`freshId`: a step to another block, or a close, ends it).
     ⚠ NOT "while it is blank" (§231 walk, owner 2026-09-25 — the station's rule one level up: "if I
     start typing something by accident I can't get back to loading a drill"). It stays, and when the
     block holds anything the coach is ASKED first. "Blank" is still UNTOUCHED SINCE IT WAS ADDED,
     field by field (/review, 2026-09-23: players, staff, a length chip or coaching points set before
     a title count as work), so the question comes whenever anything at all would go.
     ⚠ THE BLOCK STAYS until a pick lands: the picker opens OVER the sheet and the pick replaces the
     block in place (`replaceId`). It used to delete the block on the tap, which was harmless only
     while nothing could be lost — now a closed picker must leave the block exactly as it was. */
  const offerSheetFromDrill = !!sheetBlock && freshId === sheetBlock.id && !readOnly && (drills.length > 0 || circuits.length > 0);
  const startSheetFromDrill = offerSheetFromDrill ? async () => {
    const block = sheetBlock!;
    if (!isUntouchedNewBlock(block)) {
      const ok = await confirm({
        title: 'Replace this block with a drill?',
        message: 'What you pick takes this block’s place — what you’ve written here goes.',
        confirmText: 'Choose a drill',
        cancelText: 'Keep it',
      });
      if (!ok) return;
    }
    setDrillSheet({ kind: 'block', at: sheetIndex, replaceId: block.id });
  } : undefined;

  /* "About this practice" — ONE fold, rendered in one of two places. On a phone it waits UNDER the
     plan (practice plans on a phone, stage 4 · N3 = A, owner 2026-09-25): measured, the fold was
     87px above the first block in a real week (its title, its tags and kit wrapping to a second
     line, one cut line of description) and, with the rest of the head, pushed the plan under the
     tab bar. It is what the plan is ABOUT; the blocks are the plan. Decided in JS (`phoneSheet`),
     never CSS `order`, so the reading and focus order are the order a coach sees. */
  const aboutAfterPlan = phoneSheet;
  // Built only where it can render (`layout.sheet`): the circuit editor re-renders on every
  // keystroke and never shows it.
  const aboutFold = layout.sheet && (
    <div className={`${styles.ppAbout}${aboutAfterPlan ? ` ${styles.ppAboutAfter}` : ''}`}>
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
        {/* Read (stage 6, R2): a field with nothing chosen is ABSENT — a disabled picker with no
            chips is a label over nothing. The tags print as chips through the picker's own
            disabled face (chips, no search box), the same face the paper prints from. */}
        {onChangePlanTags && (!readOnly || (planTagIds?.length ?? 0) > 0) && (
          <>
            <TagPicker
              label="What this practice is about"
              all={focusTags}
              selected={planTagIds ?? []}
              onChange={onChangePlanTags}
              onCreate={readOnly ? undefined : onCreateFocusTag}
              // The same quiet manage door Equipment carries below — two tag groups, one grammar.
              manage={readOnly ? undefined : focusManage} onManageChanged={onFocusTagsChanged}
              disabled={readOnly}
              emptyHint="No tags yet — type a word to make your first one."
            />
          </>
        )}
        {/* ⚠ Read-only, and only on a plan written before tags existed. Never editable and
            never migrated: the coach's old words keep matching the rail, and there is
            exactly ONE control for saying what a practice is about. */}
        {onChangePlanTags && (plan.practiceTypes?.length ?? 0) > 0 && (
          <div className={styles.ppFieldRow}>
            <FieldLabel>Also tagged</FieldLabel>
            <div className={styles.ppChipWrap}>
              {plan.practiceTypes!.map(t => <span key={t} className={styles.ppChip}>{t}</span>)}
            </div>
          </div>
        )}
        {/* The bag's derived half, said where the coach is looking (D11): what rose from the
            blocks and stations below is shown here and removed THERE — the picker under it holds
            only the extras that belong to no block, the rule the practice's tags already follow
            ("from the drills in this practice"). Both live under ONE "Equipment" heading (owner
            catch, 2026-09-15) — the derived line used to float between the tags above and the
            picker below with no heading of its own, reading as a trailing note on "What this
            practice is about" rather than the start of Equipment. */}
        {/* Read (stage 6, R2): the bag as one line of chips when there is a bag, the field absent
            when there is not — the derived half and the extras read as one list, which is what
            the paper prints. */}
        {readOnly ? (
          <ReadChips label="Equipment" names={kitBag.all} />
        ) : (
          <div className={styles.ppField}>
            <FieldLabel>Equipment</FieldLabel>
            {kitBag.fromBlocks.length > 0 && (
              <p className={styles.ppRailDerived}>
                {kitBag.fromBlocks.join(' · ')} <span>— from the blocks below</span>
              </p>
            )}
            <PracticeTagPicker all={equipmentTags} ids={plan.equipmentTagIds ?? []}
              legacyNames={plan.equipment} onCreate={onCreateEquipmentTag}
              manage={equipmentManage} onManageChanged={onEquipmentTagsChanged}
              onChange={next => onChange({ ...plan, equipmentTagIds: next })}
              emptyHint={kitBag.fromBlocks.length > 0
                ? 'Anything else to bring that belongs to no block — water, the first-aid kit.'
                : 'No equipment yet — type an item to add your first one.'} />
          </div>
        )}
      </div>}
    </div>
  );

  return (
    /* ONE drag context over the sheet AND the docked panel (which portals into the page's host
       beside the sheet — React context crosses a portal). `pointerWithin`: the target is what the
       pointer is over, so a drop on a block row, a column or the page is a drop on nothing. */
    <DndContext sensors={dragSensors} collisionDetection={pointerWithin}
      onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => { setLifted(null); setOverGap(null); }}>
    <div className={styles.ppDocBody} data-lifting={lifted ? lifted.kind : undefined}>
      {layout.sheet && (<>
      {/* ── The goal, one line above the timeline (stage 1, D4) ──
          The one thing worth saying about the whole practice, where the sheet prints it. A
          template's is "Goal:" — there is no tonight for it — and so is a RECORD's (stage 6, R2):
          the paper's word, so the record and the print agree. Read, an unwritten goal is silence
          stated in the muted ink ("Nothing written for this one."), never the placeholder's
          future tense. */}
      <div className={styles.ppGoalLine}>
        <span className={styles.ppGoalKicker}>{withoutPeople || record ? 'Goal:' : 'Tonight:'}</span>
        {readOnly ? (
          <span className={plan.goal ? styles.ppGoalRead : styles.ppGoalNone}>{plan.goal || 'Nothing written for this one.'}</span>
        ) : (
          <input id={goalInputId} className={styles.ppGoalInput} value={plan.goal ?? ''} maxLength={MAX_TEXT_LEN}
            placeholder="What the whole practice is for"
            aria-label={withoutPeople ? 'Goal' : "Tonight's goal"}
            onChange={e => onChange({ ...plan, goal: e.target.value })} />
        )}
      </div>

      {/* ── "About this practice" — tags and equipment, folded (stage 1, D4) ──
          Order and weight, not removal: the sheet prints both and the rail softens by tag, so they
          stay; they are simply no longer the first thing a coach is asked before writing a minute.
          ⚠ ≤640 it waits UNDER the plan (practice plans on a phone, stage 4 · N3 = A, 2026-09-25) —
          see `aboutFold` above the return for why. */}
      {!aboutAfterPlan && aboutFold}

      {/* ── Tonight's groups (G1 · G7) — the practice level, under the goal and About (on a phone,
          where About waits under the plan, straight under the goal). ── */}
      <GroupsFold groupings={groupings} wiring={setsWiring} readOnly={readOnly} withoutPeople={withoutPeople}
        roster={roster} notRepliedIds={notRepliedIds} nameOf={nameOf}
        open={groupsOpen} onToggle={() => setGroupsOpen(o => !o)} onMake={() => newSet(null)} />
      </>)}

      {/* ── The timeline (stage 1, D2 · D5) ──
          A gutter of start times down the left, blocks as rows beside it, and after the last one
          the ghost row: the page's ONE lime while the plan is blank ("+ Add the first block"),
          a quiet "+ Add a block" after that. Between the rows, and under the last, the GAPS a
          drag lands in (stage 4, L2) — nothing until something is lifted. */}
      <div className={styles.ppTl}>
        {plan.blocks.map((block, i) => (
          <Fragment key={block.id}>
          {layout.timeline && (
            <GapTarget index={i} startLabel={gapStartLabel(i, clockByBlock.get(block.id)?.startLabel ?? null)} blockCount={plan.blocks.length} />
          )}
          {/* ≤640: every block reads SHUT here and the open one renders as the sheet below (K2). */}
          <BlockCard {...blockCardProps(block, i)}
            open={soloBlock || (!phoneSheet && openId === block.id)}
            openDoors={soloBlock || (!phoneSheet && openId === block.id) ? openDoors : NO_DOORS}
            phone={phoneSheet} />
          </Fragment>
        ))}
        {layout.timeline && (
          <GapTarget index={plan.blocks.length} startLabel={gapStartLabel(plan.blocks.length, nextStartLabel ?? null)} blockCount={plan.blocks.length} />
        )}

        {/* ≤640, once the plan has a block (K4): ONE 44px row under the plan's end time. Its two
            alternatives moved into the new block's sheet ("Start from a drill ›"); the blank plan
            keeps its lime ghost row and "start this plan from…" — that screen was not redrawn. */}
        {canAddBlock && phoneAddRow && (
          <div className={styles.ppTlRow}>
            <div className={styles.ppTlGutter}>{nextStartLabel ?? ''}</div>
            <button type="button" className={styles.ppTlAddRow} data-pp-add-row onClick={addBlock}>
              <Plus size={15} aria-hidden /> Add a block
            </button>
          </div>
        )}
        {canAddBlock && !phoneAddRow && (
          <div className={styles.ppTlRow}>
            <div className={styles.ppTlGutter}>
              {nextStartLabel ?? ''}
              {nextStartLabel && <small>{firstBlock ? 'start' : 'next'}</small>}
            </div>
            <div className={styles.ppTlGhost}>
              {/* The ghost row IS the next block: pressing it writes one at the time in the gutter,
                  open in place, its title ready to type. The lime rule — one earned action per
                  screen — is why the first block is lime and every later one is not. */}
              {/* `data-pp-add-row` here too: deleting the ONLY block from its phone sheet lands focus on
                  this row, since the plan is blank again (/review, 2026-09-23). */}
              <button type="button" className={firstBlock ? styles.btnPrimary : styles.btnSecondary} data-pp-add-row onClick={addBlock}>
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

      {/* ≤640 (stage 4 · N3): About under the last block, before the players' focus rail — About is
          the plan's, the rail the players'. The template editor inherits it (the same editor). */}
      {aboutAfterPlan && aboutFold}

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

      {/* ── The phone's block sheet (K2) — mounted BEFORE the station modal, the groups room, the
          picker and the drill sheet, so every door inside the block opens OVER it. ── */}
      {sheetBlock && sheetWalk && (
        /* NOT keyed on the block: a step keeps ONE sheet mounted, so its dialog floor and its
           history step (the phone's Back) stay armed across the walk instead of re-arming per block. */
        <BlockCard {...blockCardProps(sheetBlock, sheetIndex)}
          open
          openDoors={openDoors}
          phone
          sheet={{ walk: sheetWalk, onward: sheetOnward, onAdd: !readOnly && canAddBlock ? addBlock : undefined, onEdit, onDoneEditing }}
          onStartFromDrill={startSheetFromDrill && (() => void startSheetFromDrill())} />
      )}

      {/* ── A station, open as a modal (stage 3, D4) — mounted BEFORE the picker and the drill sheet
          so either opens OVER it (Choose players and Swap drill are doors inside the modal). ── */}
      {openStation && openStationBlock && openStationRow && (
        <StationModal
          block={openStationBlock}
          station={openStationRow}
          readOnly={readOnly}
          focusName={!!openStation.fresh && !readOnly}
          onStartFromDrill={offerStartFromDrill ? () => void startStationFromDrill() : undefined}
          onTouched={() => touchStation(openStation.stationId)}
          onEdit={onEdit}
          onDoneEditing={doneEditingStation}
          withoutPeople={withoutPeople}
          sets={setsWiring} roster={roster} notRepliedIds={notRepliedIds}
          staffTags={staffTags} onCreateStaffTag={onCreateStaffTag} staffPeople={staffPeople} onPickStaffPerson={onPickStaffPerson}
          equipmentTags={equipmentTags} onCreateEquipmentTag={onCreateEquipmentTag}
          staffManage={staffManage} onStaffTagsChanged={onStaffTagsChanged}
          equipmentManage={equipmentManage} onEquipmentTagsChanged={onEquipmentTagsChanged}
          nameOf={nameOf}
          onPatch={patch => patchStation(openStation.blockId, openStation.stationId, patch)}
          onDelete={() => deleteStation(openStation.blockId, openStation.stationId)}
          onStep={stationId => setOpenStation({ blockId: openStation.blockId, stationId })}
          onClose={closeStation}
          onOpenPicker={() => setAttach({ kind: 'station', blockId: openStation.blockId, stationId: openStation.stationId })}
          onDetach={() => detachStation(openStation.blockId, openStation.stationId)}
          onSwapDrill={() => setDrillSheet({ kind: 'station', blockId: openStation.blockId, swapId: openStation.stationId })}
          onPromote={() => { setPromoteError(''); setPromoting({ kind: 'station', blockId: openStation.blockId, stationId: openStation.stationId }); }}
          onAddStation={!readOnly && (openStationBlock.stations?.length ?? 0) < MAX_STATIONS_PER_BLOCK
            ? () => addStationTo(openStation.blockId) : undefined}
        />
      )}

      {/* ── The groups room (stage 3 revision, D9 · D10 · D11 · D12; every level, G1–G8) — one of
          tonight's sets is drawn and arranged here; the places that use it only read it back. Never
          for a template (a template carries no people) and never while reading. ── */}
      {openSet && openSetRow && (
        <PracticeGroupsRoom
          set={openSetRow}
          uses={uses.get(openSetRow.id) ?? []}
          defaultDraw={defaultDrawFor(openSet.from)}
          roster={roster}
          notReplied={notRepliedIds}
          drawPool={drawPool}
          attendanceKnown={attendanceKnown}
          nameOf={nameOf}
          note={openSet.note}
          onChange={changeSet}
          copyFor={openSet.from ? { label: placeLabel(openSet.from, openSetRow.id), onCopy: () => copySetFor(openSet.from!, openSetRow.id) } : undefined}
          onDelete={() => deleteSet(openSetRow.id)}
          onClose={closeSet}
        />
      )}

      {/* ── "From another practice…" (G6) — copies one of another practice's sets onto tonight. ── */}
      {fromPracticeOpen && fromPractice && (
        <GroupsFromPracticeSheet
          sets={groupingsElsewhere}
          nameOf={nameOf}
          onPick={from => adoptFromPractice(fromPractice.target, from)}
          onClose={() => setFromPractice(null)}
        />
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
                  A block's picker — or its ONLY station's, which IS the block (stage 3, D1); a
                  station among several or a group has no "whole team" to return to. */}
              {(pickerTarget.kind === 'block' || pickerIsSoleStation) && selectedIds.length > 0 && (
                <button type="button" className={styles.btnGhost}
                  onClick={() => {
                    if (pickerTarget.kind === 'station') patchStation(pickerTarget.blockId, pickerTarget.stationId, { playerIds: [], groupingId: undefined });
                    else patchBlock(pickerTarget.blockId, { playerIds: [], groupingId: undefined });
                    setAttach(null);
                  }}>
                  Whole team
                </button>
              )}
              <button type="button" className={styles.btnPrimary} onClick={() => setAttach(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ── The drill picker (Phase 2; the circuits tab at stage 4) ── */}
      {openDrillSheet && (
        <DrillPickerSheet
          drills={drills}
          circuits={openDrillSheet.kind === 'block' ? circuits : undefined}
          equipmentTags={equipmentTags}
          title={
            openDrillSheet.kind === 'block' ? (openDrillSheet.replaceId ? 'Start from a drill' : 'Add a block')
              : openDrillSheet.startFrom ? 'Start from a drill'
                : openDrillSheet.swapId ? 'Swap this drill'
                  : 'Add a station'
          }
          writeLabel={
            openDrillSheet.kind === 'block' ? 'Write a block'
              : openDrillSheet.swapId ? 'Write this one myself'
                : 'Write a station'
          }
          onPick={drill => {
            if (openDrillSheet.kind === 'block') addBlockFromDrill(drill, openDrillSheet.at, openDrillSheet.replaceId);
            else addStationFromDrill(openDrillSheet.blockId, drill, openDrillSheet.swapId);
          }}
          onPickCircuit={openDrillSheet.kind === 'block' ? circuit => addBlockFromCircuit(circuit, openDrillSheet.at, openDrillSheet.replaceId) : undefined}
          // From inside the station or block being written there is nothing to "write one" into but itself.
          onWriteOne={(openDrillSheet.kind === 'station' && openDrillSheet.startFrom) || (openDrillSheet.kind === 'block' && openDrillSheet.replaceId) ? undefined : () => {
            if (openDrillSheet.kind === 'block') { addBlock(); setDrillSheet(null); }
            else addBlankStation(openDrillSheet.blockId, openDrillSheet.swapId);
          }}
          onClose={() => setDrillSheet(null)}
        />
      )}

      {/* ── "Save to my drills…" / "Save to my circuits…" (D18 · L1 · L9) ── */}
      {openPromoting && (() => {
        const block = plan.blocks.find(b => b.id === openPromoting.blockId);
        // Deleting the block or station while its dialog is open would otherwise leave a dead end
        // — the same self-closing rule `attachTargetExists` applies to the roster picker.
        if (!block) return null;
        // The block's minutes as "usually", named in the sentence — none for a rest-of-practice block.
        const usually = block.duration.restOfPractice || !block.duration.minutes ? '' : `, and ${block.duration.minutes} min as how long it usually runs`;
        const names = (ids: readonly string[]) => tagNamesById(ids, focusTags);
        if (openPromoting.kind === 'station' || openPromoting.kind === 'block') {
          const station = openPromoting.kind === 'station' ? block.stations?.find(s => s.id === openPromoting.stationId) ?? null : null;
          if (openPromoting.kind === 'station' ? !station : (block.stations?.length ?? 0) > 0) return null;
          // The team's OWN active drills — a club drill is never saved over from a team (D12).
          const own = activeDrills.filter(d => d.teamId !== null);
          const draft = drillInputFor(block, station, []);
          return (
            <PromoteDialog kind="drill" defaultName={station ? promoteName(block, station) : block.title.trim()}
              sentence={station
                ? 'The setup, coaching points and equipment come with it. Who ran it and who was at it stay with tonight’s practice.'
                : `The coaching points and equipment come with it${usually}. Who was at it stays with tonight’s practice.`}
              targets={own.map(d => ({
                id: d.id, name: d.name, tagIds: d.tags.map(t => t.id),
                now: drillFactsLine(d.description, d.coachingPoints, kitNamesOf(d), d.tags.map(t => t.name)),
              }))}
              limitLine={own.length >= MAX_DRILLS_PER_TEAM ? libraryLimitLine(MAX_DRILLS_PER_TEAM, 'drills', 'Update', 'Drills') : null}
              after={tagIds => drillFactsLine(draft.description, draft.coachingPoints, draft.equipment ?? [], names(tagIds))}
              loadReach={loadDrillReach}
              tags={focusTags} onCreateTag={onCreateFocusTag ?? (async () => null)}
              manage={focusManage} onManageChanged={onFocusTagsChanged}
              busy={promoteBusy} error={promoteError}
              onSave={(name, tagIds, _picked, update) => void promoteToDrill(name, tagIds, update)} onClose={() => setPromoting(null)} />
          );
        }
        if ((block.stations?.length ?? 0) < 2) return null;
        const activeCircuits = circuits.filter(c => c.isActive);
        return (
          <PromoteDialog kind="circuit" defaultName={block.title.trim()}
            sentence={`The stations, their setup, points and kit come with it${usually}. Who runs each station, who’s at it and the groups stay with tonight’s practice.`}
            tick={{ rows: onCreateDrill ? tickRowsFor(block, activeDrills) : [], fromLine: fromDrillsLine(block) }}
            targets={activeCircuits.map(c => ({
              id: c.id, name: c.name, tagIds: c.tags.map(t => t.id), now: circuitFactsLine(c.block, c.tags.map(t => t.name)),
            }))}
            limitLine={activeCircuits.length >= MAX_CIRCUITS_PER_TEAM ? libraryLimitLine(MAX_CIRCUITS_PER_TEAM, 'circuits', 'Update', 'Circuits') : null}
            after={tagIds => circuitFactsLine(block, names(tagIds))}
            tags={focusTags} onCreateTag={onCreateFocusTag ?? (async () => null)}
            manage={focusManage} onManageChanged={onFocusTagsChanged}
            busy={promoteBusy} error={promoteError}
            onSave={(name, tagIds, picked, update) => void promoteToCircuit(name, tagIds, picked, update)} onClose={() => setPromoting(null)} />
        );
      })()}

      {/* ── "+ New drill" from the docked panel — the one drill sheet (L5 · L6) ── */}
      {openNewDrill && (
        <DrillSheet
          draft={openNewDrill} isNew
          tags={focusTags} onCreateTag={onCreateFocusTag ?? (async () => null)}
          equipmentTags={equipmentTags} onCreateEquipmentTag={onCreateEquipmentTag}
          focusManage={focusManage} onFocusTagsChanged={onFocusTagsChanged}
          equipmentManage={equipmentManage} onEquipmentTagsChanged={onEquipmentTagsChanged}
          busy={newDrillBusy} error={newDrillError}
          onChange={setNewDrill} onSubmit={saveNewDrill} onClose={() => setNewDrill(null)}
        />
      )}

      {/* ── The DOCKED LIBRARY (stage 4, L5) — the phone's card list beside the sheet, rendered into
          the page's host through a portal so the page keeps the pair's layout and this editor
          keeps the one drag context. Drills · Circuits as its head once circuits exist; no
          templates in it (a template applies to a blank plan — "start this plan from…" is one
          link away on the ghost row). ── */}
      {docked && library?.panelHost && createPortal(
        <LibraryPanel
          drills={drills} circuits={circuits} equipmentTags={equipmentTags}
          canWrite={!!onCreateDrill}
          circuitsHref={library.circuitsHref}
          onAddDrill={drill => addBlockFromDrill(drill)}
          onAddCircuit={circuit => addBlockFromCircuit(circuit)}
          onNewDrill={() => { setNewDrillError(''); setNewDrill(emptyDrillDraft()); }}
          onClose={() => library.onDock(false)}
        />,
        library.panelHost,
      )}

      {/* The carried thing, under the pointer — portaled to the body so the sheet's own clipping
          cannot cut it (the standing `modalScrollBody` trap). */}
      {typeof document !== 'undefined' && createPortal(
        <DragOverlay dropAnimation={null} zIndex={1200}>
          {lifted && (
            <span className={styles.ppDragGhost}>
              <GripVertical size={13} aria-hidden />
              {lifted.kind === 'drill' ? lifted.drill.name : lifted.kind === 'circuit' ? lifted.circuit.name : lifted.label}
            </span>
          )}
        </DragOverlay>,
        document.body,
      )}
    </div>
    </DndContext>
  );
}
