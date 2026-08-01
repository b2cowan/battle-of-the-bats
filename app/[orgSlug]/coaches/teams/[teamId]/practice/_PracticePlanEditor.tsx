'use client';
import { useId, useMemo, useState } from 'react';
import {
  ChevronDown, ChevronUp, Plus, Repeat, Shuffle, Trash2, Users, X,
} from 'lucide-react';
import {
  MAX_BLOCKS, MAX_COACHING_POINTS, MAX_GROUPS, MAX_SHORT_TEXT_LEN, MAX_STAFF_PER_ITEM,
  MAX_STATIONS_PER_BLOCK, MAX_TAGS_PER_ITEM, MAX_TEXT_LEN, MAX_TITLE_LEN,
  blockRotates, computeBlockClocks, computeRotation, defaultIntervalMinutes, describeSplit, drawGroups, groupLabel,
  newPracticePlanId, startingGroupsForStation,
  type BlockClock, type DrawMode, type PracticeGroup, type PracticePlan, type PracticePlanBlock,
  type PracticeRotation, type PracticeStation,
} from '@/lib/rep-practice-plan';
import { playerDisplayName } from '@/lib/coach-roster-name';
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
};

type AttachTarget =
  | { kind: 'block'; blockId: string }
  | { kind: 'station'; blockId: string; stationId: string }
  | { kind: 'group'; blockId: string; groupId: string };


/** Replied yes = attending or arriving late. Only these enter a random draw (D21); everyone
 *  else is NAMED rather than silently dropped. */
const REPLIED_YES: RepAttendanceStatus[] = ['attending', 'late'];

/** How many previously-used labels to offer inline before it becomes a wall of chips. */
const MAX_VISIBLE_SUGGESTIONS = 8;

// ── Small shared controls (module level — see the header note) ────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className={styles.ppFieldLabel}>{children}</span>;
}

/**
 * One reusable-label control, used for staff (D12), equipment and practice types.
 *
 * ⚠ Every list it edits is a LABEL. A staff entry carries no account, no invitation and no
 * capability whatsoever — the reference practice names an outside instructor and a PD coach who
 * aren't portal users at all, which is exactly why a picker limited to team coaches fails. The
 * suggestions come from what this team has typed before, so the vocabulary is theirs and a typo
 * stops being offered as soon as no plan uses it.
 */
function TagChips({
  label, values, suggestions, readOnly, onSet, placeholder, max = MAX_TAGS_PER_ITEM, width = '9rem',
}: {
  label: string;
  values?: string[];
  suggestions: string[];
  readOnly: boolean;
  onSet: (next: string[]) => void;
  placeholder: string;
  max?: number;
  width?: string;
}) {
  const [draft, setDraft] = useState('');
  const listId = useId();
  const current = values ?? [];
  const unused = suggestions.filter(s => !current.some(c => c.toLowerCase() === s.toLowerCase()));
  const add = () => {
    const value = draft.trim();
    if (!value || current.length >= max) { setDraft(''); return; }
    if (!current.some(n => n.toLowerCase() === value.toLowerCase())) onSet([...current, value]);
    setDraft('');
  };
  return (
    <div className={styles.ppFieldRow}>
      <FieldLabel>{label}</FieldLabel>
      <div className={styles.ppChipWrap}>
        {current.map(value => (
          <span key={value} className={styles.ppChip}>
            {value}
            {!readOnly && (
              <button type="button" className={styles.ppChipX} aria-label={`Remove ${value}`}
                onClick={() => onSet(current.filter(n => n !== value))}><X size={11} /></button>
            )}
          </span>
        ))}
        {!readOnly && current.length < max && (
          <>
            {/* .inlineField is the portal's primitive for exactly this shape — a fixed-width
                control in a dense row that goes full width at 640. Composing it (rather than
                hand-rolling both rules again) is what the CSS file's own header asks for. */}
            <input className={`${styles.input} ${styles.inlineField}`}
              style={{ '--inline-field-w': width } as React.CSSProperties}
              list={listId} value={draft}
              onChange={e => setDraft(e.target.value)} onBlur={add}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
              placeholder={placeholder} maxLength={MAX_TITLE_LEN} aria-label={label} />
            <datalist id={listId}>{suggestions.map(s => <option key={s} value={s} />)}</datalist>
          </>
        )}
      </div>
      {/* ⚠ The suggestions have to be VISIBLE to read as a picker. A datalist alone looks exactly
          like a plain text box until you happen to type a matching letter, so the control was
          being taken for free text. These are what this team has used before — tap to add. */}
      {!readOnly && current.length < max && unused.length > 0 && (
        <div className={styles.ppSuggestWrap}>
          {unused.slice(0, MAX_VISIBLE_SUGGESTIONS).map(s => (
            <button key={s} type="button" className={styles.ppSuggestChip}
              onClick={() => onSet([...current, s])}>
              <Plus size={10} aria-hidden />{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CoachingPoints({
  points, readOnly, onSet,
}: { points?: string[]; readOnly: boolean; onSet: (next: string[]) => void }) {
  const current = points ?? [];
  return (
    <div className={styles.ppField}>
      <FieldLabel>What to watch for</FieldLabel>
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

function StationCard({
  station, index, isRotation, startingGroups, readOnly, staffSuggestions, equipmentSuggestions,
  nameOf, onPatch, onRemove, onOpenPicker,
}: {
  station: PracticeStation;
  index: number;
  isRotation: boolean;
  /** In a rotation, which group(s) begin here — the station's answer to "who do I start with?". */
  startingGroups: PracticeGroup[];
  readOnly: boolean;
  staffSuggestions: string[];
  equipmentSuggestions: string[];
  nameOf: (playerId: string) => string;
  onPatch: (patch: Partial<PracticeStation>) => void;
  onRemove: () => void;
  onOpenPicker: () => void;
}) {
  return (
    <div className={styles.ppStation}>
      <div className={styles.ppStationHead}>
        <span className={styles.ppStationNum}>{index + 1}</span>
        <input className={`${styles.input} ${styles.ppStationName}`} value={station.name} disabled={readOnly}
          maxLength={MAX_TITLE_LEN} placeholder="Station name"
          aria-label={`Station ${index + 1} name`} onChange={e => onPatch({ name: e.target.value })} />
        <input className={`${styles.input} ${styles.ppCount}`} type="number" min={1} max={99} inputMode="numeric"
          disabled={readOnly} value={station.count ?? ''} placeholder="#"
          aria-label={`How many of station ${index + 1}`}
          onChange={e => onPatch({ count: e.target.value ? Number(e.target.value) : null })} />
        {!readOnly && (
          <button type="button" className={styles.ppIconBtn} aria-label={`Remove station ${index + 1}`}
            onClick={onRemove}><Trash2 size={14} /></button>
        )}
      </div>

      <div className={styles.ppStationBody}>
        <label className={styles.ppField}>
          <FieldLabel>Setup</FieldLabel>
          <textarea className={styles.textarea} rows={2} value={station.setup ?? ''} disabled={readOnly}
            maxLength={MAX_TEXT_LEN}
            placeholder="How it's laid out — where things go, and how far apart"
            onChange={e => onPatch({ setup: e.target.value })} />
        </label>
        <TagChips label="Equipment" values={station.equipment} suggestions={equipmentSuggestions}
          readOnly={readOnly} onSet={next => onPatch({ equipment: next })} placeholder="Add kit…" />

        <TagChips label="Who runs it" values={station.staff} suggestions={staffSuggestions}
          readOnly={readOnly} onSet={next => onPatch({ staff: next })} placeholder="Add a name…"
          max={MAX_STAFF_PER_ITEM} />

        {/* People live at exactly ONE level. In a rotation that level is the block's groups, so the
            station shows which group it STARTS with rather than offering a second, contradictory
            roster. Everywhere else the station owns its own list. */}
        {isRotation ? (
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
        )}

        <CoachingPoints points={station.coachingPoints} readOnly={readOnly}
          onSet={next => onPatch({ coachingPoints: next })} />

        <label className={styles.ppField}>
          <FieldLabel>Just for tonight</FieldLabel>
          <input className={styles.input} value={station.note ?? ''} disabled={readOnly} maxLength={MAX_TEXT_LEN}
            placeholder="A one-off note for this practice" onChange={e => onPatch({ note: e.target.value })} />
        </label>

        {!isRotation && (
          <label className={styles.ppField}>
            <FieldLabel>Rotation note</FieldLabel>
            <input className={styles.input} value={station.rotationNote ?? ''} disabled={readOnly}
              maxLength={MAX_SHORT_TEXT_LEN} placeholder="Informal — e.g. swap halfway"
              onChange={e => onPatch({ rotationNote: e.target.value })} />
          </label>
        )}
      </div>
    </div>
  );
}

// ── Rotation ─────────────────────────────────────────────────────────────────

function RotationPanel({
  rotation, stations, blockMinutes, stationCount, blockStartMs, drawPool, notReplied, showNotReplied,
  readOnly, nameOf, onSetRotation, onOpenGroupPicker,
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

      {/* ── Groups (D21) — the two ways to make them, said separately rather than crammed into
          one row where nothing explained what the controls belonged to. ── */}
      <div className={styles.ppGroupsHead}><FieldLabel>Groups</FieldLabel></div>
      {!readOnly && (
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

      {rotation.groups.length === 0 ? (
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
      )}

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

function BlockCard({
  block, index, blockCount, clock, blockStartMs, collapsed, readOnly, restTakenElsewhere, drawPool, notReplied,
  showNotReplied, staffSuggestions, equipmentSuggestions, nameOf,
  onToggleCollapse, onMove, onDelete, onPatch, onOpenPicker,
}: {
  block: PracticePlanBlock;
  index: number;
  blockCount: number;
  clock?: BlockClock;
  blockStartMs?: number;
  collapsed: boolean;
  readOnly: boolean;
  /** Another block already claims "rest of practice" (D13 allows exactly one). */
  restTakenElsewhere: boolean;
  drawPool: PracticeRosterPlayer[];
  notReplied: PracticeRosterPlayer[];
  showNotReplied: boolean;
  staffSuggestions: string[];
  equipmentSuggestions: string[];
  nameOf: (playerId: string) => string;
  onToggleCollapse: () => void;
  onMove: (delta: number) => void;
  onDelete: () => void;
  onPatch: (patch: Partial<PracticePlanBlock>) => void;
  onOpenPicker: (target: AttachTarget) => void;
}) {
  const isOpen = !collapsed;
  const stationCount = block.stations?.length ?? 0;
  // ONE answer to "does this rotate", shared with the sanitiser, the grid and the printed sheet.
  const isRotation = blockRotates(block);
  /* A block only gains a stored rotation once the coach touches one. Until then this stand-in
     renders the empty controls — so adding a second station reveals the rotation immediately,
     without a write the coach didn't ask for. It seeds the total from the block's own length,
     which is what they just typed, and leaves the interval blank so the grid asks for it rather
     than inventing a round length. */
  const rotation: PracticeRotation = block.rotation ?? { intervalMinutes: null, groups: [], groupSource: 'manual' };
  const label = block.title || `block ${index + 1}`;
  const stations = block.stations ?? [];

  const patchStation = (stationId: string, patch: Partial<PracticeStation>) =>
    onPatch({ stations: stations.map(s => (s.id === stationId ? { ...s, ...patch } : s)) });

  return (
    <div className={styles.ppBlock}>
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
            aria-label={`Block ${index + 1} title`} onChange={e => onPatch({ title: e.target.value })} />
          <span className={styles.ppBlockClock}>
            {clock && (
              <>
                {clock.startLabel}
                {clock.endLabel ? `–${clock.endLabel}` : ''}
              </>
            )}
            {isRotation && <span className={styles.ppShapeTag}><Repeat size={11} aria-hidden /> Rotation</span>}
          </span>
        </div>

        <button type="button" className={styles.ppIconBtn} aria-expanded={isOpen}
          aria-label={isOpen ? `Collapse ${label}` : `Expand ${label}`} onClick={onToggleCollapse}>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {!readOnly && (
          <button type="button" className={styles.ppIconBtn} aria-label={`Delete ${label}`} onClick={onDelete}>
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className={styles.ppBlockBody}>
          {/* ── How long the block runs (D13): a number, or 'rest of practice'. ──
              ⚠ RANGES WERE REMOVED (owner, 2026-08-01). A block that might run 25 or 35 minutes
              makes the next block's start time unknowable — the one question this running clock
              exists to answer. A coach who wants slack types one number with the slack in it. */}
          <div className={styles.ppDuration}>
            <label className={styles.ppField}>
              <FieldLabel>Minutes</FieldLabel>
              <input className={`${styles.input} ${styles.ppMinutes}`} type="number" min={1} max={600}
                inputMode="numeric" disabled={readOnly || !!block.duration.restOfPractice}
                value={block.duration.minutes ?? ''} aria-label="Minutes"
                onChange={e => onPatch({
                  duration: { ...block.duration, minutes: e.target.value ? Number(e.target.value) : null },
                })} />
            </label>
            {/* Only ONE block per plan may be "rest of practice" (D13). The server enforces it,
                so without this the coach could tick a second box and watch autosave silently
                revert it a second later with no explanation. Say why instead. */}
            <label className={styles.ppRestToggle}
              title={restTakenElsewhere ? 'Another block is already set to run for the rest of practice.' : undefined}>
              <input type="checkbox" checked={!!block.duration.restOfPractice}
                disabled={readOnly || restTakenElsewhere}
                onChange={e => onPatch({
                  duration: e.target.checked ? { minutes: null, restOfPractice: true } : { minutes: null },
                })} />
              <span>Rest of practice</span>
            </label>
          </div>

          <label className={styles.ppField}>
            <FieldLabel>Description</FieldLabel>
            <textarea className={styles.textarea} rows={2} value={block.description ?? ''} disabled={readOnly}
              maxLength={MAX_TEXT_LEN} placeholder="What happens, and how it's set up"
              onChange={e => onPatch({ description: e.target.value })} />
          </label>
          <label className={styles.ppField}>
            <FieldLabel>Goal</FieldLabel>
            <input className={styles.input} value={block.goal ?? ''} disabled={readOnly} maxLength={MAX_TEXT_LEN}
              placeholder="What this is for" onChange={e => onPatch({ goal: e.target.value })} />
          </label>

          <TagChips label="Staff" values={block.staff} suggestions={staffSuggestions} readOnly={readOnly}
            onSet={next => onPatch({ staff: next })} placeholder="Add a name…" max={MAX_STAFF_PER_ITEM} />

          {/* People live at exactly ONE level. With stations, they belong to the stations (or to
              the rotation's groups) — so the block-level list disappears rather than offering a
              second answer nobody can reconcile. */}
          {stationCount === 0 && (
            <div className={styles.ppFieldRow}>
              <FieldLabel>Players</FieldLabel>
              <div className={styles.ppChipWrap}>
                {(block.playerIds ?? []).map(pid => <span key={pid} className={styles.ppChip}>{nameOf(pid)}</span>)}
                <PlayerPickerButton count={block.playerIds?.length ?? 0} readOnly={readOnly}
                  onOpen={() => onOpenPicker({ kind: 'block', blockId: block.id })} />
              </div>
            </div>
          )}

          <CoachingPoints points={block.coachingPoints} readOnly={readOnly}
            onSet={next => onPatch({ coachingPoints: next })} />

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
              nameOf={nameOf}
              onSetRotation={patch => onPatch({ rotation: { ...rotation, ...patch } })}
              onOpenGroupPicker={groupId => onOpenPicker({ kind: 'group', blockId: block.id, groupId })}
            />
          )}

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
              {!readOnly && stations.length < MAX_STATIONS_PER_BLOCK && (
                <button type="button" className={styles.ppAddInline}
                  onClick={() => onPatch({ stations: [...stations, { id: newPracticePlanId(), name: '' }] })}>
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
                staffSuggestions={staffSuggestions}
                equipmentSuggestions={equipmentSuggestions}
                nameOf={nameOf}
                onPatch={patch => patchStation(station.id, patch)}
                onRemove={() => onPatch({ stations: stations.filter(s => s.id !== station.id) })}
                onOpenPicker={() => onOpenPicker({ kind: 'station', blockId: block.id, stationId: station.id })}
              />
            ))}
          </div>
        </div>
      )}
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
  staffSuggestions: string[];
  equipmentSuggestions: string[];
  practiceTypeSuggestions: string[];
  eventStartsAt: string;
  eventEndsAt: string | null;
  readOnly: boolean;
}

export default function PracticePlanEditor({
  plan, onChange, roster, goals, canViewFocus, attendance, canViewAttendance,
  staffSuggestions, equipmentSuggestions, practiceTypeSuggestions, eventStartsAt, eventEndsAt, readOnly,
}: Props) {
  const [attach, setAttach] = useState<AttachTarget | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // Register with the shared overlay stack: hides the mobile bottom nav while the picker sheet is
  // up (so a mis-tap can't land on a nav tab underneath it) and locks the page behind it.
  useOverlayOpen(!!attach);

  // Keyed on plan.blocks, NOT the whole plan: typing in "Tonight's goal" replaces the plan object
  // but changes no block, and re-running this would rebuild an Intl formatter per block per
  // keystroke. The rotation grid's round times come from the SAME walk (clock.startMs) rather
  // than a second hand-maintained copy of it — an earlier duplicate had already drifted on how
  // "rest of practice" advances the cursor.
  const clocks = useMemo(
    () => computeBlockClocks(plan.blocks, eventStartsAt, eventEndsAt),
    [plan.blocks, eventStartsAt, eventEndsAt],
  );
  const clockByBlock = useMemo(() => new Map(clocks.map(c => [c.blockId, c])), [clocks]);

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

  const setBlocks = (blocks: PracticePlanBlock[]) => onChange({ ...plan, blocks });
  const patchBlock = (blockId: string, patch: Partial<PracticePlanBlock>) =>
    setBlocks(plan.blocks.map(b => (b.id === blockId ? { ...b, ...patch } : b)));

  /**
   * ONE kind of block. Whether its stations rotate is a toggle inside it, not a decision the coach
   * has to make before they've typed anything — they rarely know yet, and rotation is the common
   * case anyway, so it defaults on the moment a second station appears.
   */
  function addBlock() {
    if (plan.blocks.length >= MAX_BLOCKS) return;
    setBlocks([...plan.blocks, {
      id: newPracticePlanId(),
      title: '',
      duration: { minutes: 15 },
    }]);
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

  return (
    <div className={styles.ppLayout}>
      <div className={styles.ppMain}>
        <div className={styles.ppHeaderCard}>
          <label className={styles.ppField}>
            <FieldLabel>Tonight&apos;s goal</FieldLabel>
            <input className={styles.input} value={plan.goal ?? ''} disabled={readOnly} maxLength={MAX_TEXT_LEN}
              placeholder="What the whole practice is for"
              onChange={e => onChange({ ...plan, goal: e.target.value })} />
          </label>
          {/* Coach-typed, never a fixed list — "Hitting / Fielding / Pitching" is one sport talking,
              and this platform serves several. A label for now: it does not filter the focus rail
              until focus areas carry a category (Phase 2), and when it does they will DIM, not hide. */}
          <TagChips label="Kind of practice" values={plan.practiceTypes} suggestions={practiceTypeSuggestions}
            readOnly={readOnly} placeholder="e.g. what you're focusing on…" width="11rem"
            onSet={next => onChange({ ...plan, practiceTypes: next })} />
          <TagChips label="Equipment" values={plan.equipment} suggestions={equipmentSuggestions}
            readOnly={readOnly} placeholder="Add kit…"
            onSet={next => onChange({ ...plan, equipment: next })} />
        </div>

        {plan.blocks.map((block, i) => (
          <BlockCard
            key={block.id}
            block={block}
            index={i}
            blockCount={plan.blocks.length}
            clock={clockByBlock.get(block.id)}
            // From the SAME clock walk as the block header — never a second copy of the arithmetic.
            blockStartMs={clockByBlock.get(block.id)?.startMs}
            collapsed={!!collapsed[block.id]}
            readOnly={readOnly}
            restTakenElsewhere={restBlockId != null && restBlockId !== block.id}
            drawPool={drawPool}
            notReplied={notReplied}
            showNotReplied={attendanceKnown}
            staffSuggestions={staffSuggestions}
            equipmentSuggestions={equipmentSuggestions}
            nameOf={nameOf}
            onToggleCollapse={() => setCollapsed(c => ({ ...c, [block.id]: !c[block.id] }))}
            onMove={delta => moveBlock(i, delta)}
            onDelete={() => setBlocks(plan.blocks.filter(b => b.id !== block.id))}
            onPatch={patch => patchBlock(block.id, patch)}
            onOpenPicker={setAttach}
          />
        ))}

        {!readOnly && plan.blocks.length < MAX_BLOCKS && (
          <div className={styles.ppAddRow}>
            <button type="button" className={styles.btnSecondary} onClick={addBlock}>
              <Plus size={14} aria-hidden /> Add a block
            </button>
          </div>
        )}
      </div>

      {/* ── The focus rail — the reason this beats a blank form (§4.1) ──
          Roster ORDER, always. No sort control, ever. Focus areas are quoted verbatim from the
          shipped development records — never recomputed, never scored, never re-ordered, and no
          per-player figure is ever rendered beside another child's. */}
      {canViewFocus && (
        <aside className={styles.ppRail} aria-label="Focus areas">
          <div className={styles.ppRailInner}>
            <h2 className={styles.ppRailTitle}>What everyone&apos;s working on</h2>
            {roster.length === 0 ? (
              <p className={styles.formHint}>No players on the roster yet.</p>
            ) : (
              <ul className={styles.ppRailList}>
                {roster.map(player => {
                  const playerGoals = goalsByPlayer.get(player.id) ?? [];
                  return (
                    <li key={player.id} className={styles.ppRailRow}>
                      <span className={styles.ppRailName}>{playerDisplayName(player)}</span>
                      {playerGoals.length === 0 ? (
                        <span className={styles.ppRailNone}>Nothing set yet</span>
                      ) : (
                        <span className={styles.ppChipWrap}>
                          {playerGoals.map(g => <span key={g.id} className={styles.ppFocusChip}>{g.focusArea}</span>)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      )}

      {/* ── The roster picker — roster order, focus areas inline, attendance as context ── */}
      {pickerTarget && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Choose players"
          onClick={e => { if (e.target === e.currentTarget) setAttach(null); }}>
          <div className={`${styles.modal} ${styles.modalScrollBody}`}>
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
                const playerGoals = goalsByPlayer.get(player.id) ?? [];
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
                      {canViewFocus && playerGoals.length > 0 && (
                        <span className={styles.ppChipWrap}>
                          {playerGoals.map(g => <span key={g.id} className={styles.ppFocusChip}>{g.focusArea}</span>)}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.btnPrimary} onClick={() => setAttach(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
