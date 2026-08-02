'use client';
import { useId, useMemo, useState } from 'react';
import {
  ChevronDown, ChevronUp, Library, Pencil, Plus, Repeat, Shuffle, Trash2, Users, X,
} from 'lucide-react';
import {
  MAX_BLOCKS, MAX_COACHING_POINTS, MAX_GROUPS, MAX_SHORT_TEXT_LEN, MAX_STAFF_PER_ITEM,
  MAX_STATIONS_PER_BLOCK, MAX_TAGS_PER_ITEM, MAX_TEXT_LEN, MAX_TITLE_LEN,
  blockRotates, computeBlockClocks, computeRotation, defaultIntervalMinutes, describeSplit, drawGroups, groupLabel,
  newPracticePlanId, startingGroupsForStation,
  type BlockClock, type DrawMode, type PracticeGroup, type PracticePlan, type PracticePlanBlock,
  type PracticeRotation, type PracticeStation,
} from '@/lib/rep-practice-plan';
import {
  UNTAGGED_FILTER, collectTags, detachStationFromDrill,
  drillToStation, filterTagged, sortDrillsForPicker, stationToDrillInput,
  type DrillInput, type RepTeamDrill,
} from '@/lib/rep-drills';
import TagPicker, { type PickableTag } from '@/components/coaches/TagPicker';
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

/**
 * ⚠ The label is "Coaching points", NOT "What to watch for" (owner ruling 2026-08-01).
 *
 * The old label collided with the field screen's "What you're watching for", which is the GOAL —
 * two different fields with near-identical names, one screen apart. One name per idea: the goal is
 * "what you're watching for" everywhere, and this numbered list is "Coaching points" everywhere,
 * which is already what the run screen, the drill record and the plan doc call it.
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
function DrillFacts({ station }: { station: PracticeStation }) {
  const { description, goal, coachingPoints, setup, equipment } = station;
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
  station, index, isRotation, startingGroups, readOnly, staffSuggestions, equipmentSuggestions,
  nameOf, onPatch, onRemove, onOpenPicker, onDetach, onSwapDrill, onPromote,
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
            <DrillFacts station={station} />
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
            <TagChips label="Equipment" values={station.equipment} suggestions={equipmentSuggestions}
              readOnly={readOnly} onSet={next => onPatch({ equipment: next })} placeholder="Add kit…" />
          </>
        )}

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

        {/* Rendered above by DrillFacts when this station came from one. */}
        {!fromDrill && (
          <CoachingPoints points={station.coachingPoints} readOnly={readOnly}
            onSet={next => onPatch({ coachingPoints: next })} />
        )}

        {/* ⚠ ALWAYS editable, even on a drill-backed station — this is the one field that must
            never travel back to the library, so it is also the one that must never be locked. It
            absorbs most "one word different tonight" cases with no detaching at all. */}
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

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label={title}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`${styles.modal} ${styles.modalScrollBody}`}>
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
  stationName, tags, onCreateTag, busy, error, onSave, onClose,
}: {
  stationName: string;
  tags: PickableTag[];
  onCreateTag: (name: string) => Promise<PickableTag | null>;
  busy: boolean;
  error: string;
  onSave: (tagIds: string[]) => void;
  onClose: () => void;
}) {
  const [tagIds, setTagIds] = useState<string[]>([]);
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Save to my drills"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
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

function BlockCard({
  block, index, blockCount, clock, blockStartMs, collapsed, readOnly, restTakenElsewhere, drawPool, notReplied,
  showNotReplied, staffSuggestions, equipmentSuggestions, nameOf,
  onToggleCollapse, onMove, onDelete, onPatch, onOpenPicker, onAddStation, onDetachStation, onSwapStation,
  onPromoteStation,
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
  /** Opens the drill sheet for this block. `swapStationId` replaces rather than appends. */
  onAddStation: (swapStationId?: string) => void;
  onDetachStation: (stationId: string) => void;
  onSwapStation: (stationId: string) => void;
  onPromoteStation: (stationId: string) => void;
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
                staffSuggestions={staffSuggestions}
                equipmentSuggestions={equipmentSuggestions}
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
  eventStartsAt: string;
  eventEndsAt: string | null;
  readOnly: boolean;
}

export default function PracticePlanEditor({
  plan, onChange, roster, goals, canViewFocus, attendance, canViewAttendance,
  staffSuggestions, equipmentSuggestions, practiceTypeSuggestions, drills, onCreateDrill,
  focusTags = [], onCreateFocusTag,
  eventStartsAt, eventEndsAt, readOnly,
}: Props) {
  const [attach, setAttach] = useState<AttachTarget | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
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
    // lookup it MATCHES against (which also folds in whatever the coach typed by hand).
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
    for (const t of plan.practiceTypes ?? []) add(t, false);
    return { practiceCategories: seen, derivedCategories: derived };
  }, [plan.blocks, plan.practiceTypes]);

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


  /**
   * A picked drill becomes a BLOCK: the block takes the drill's name and usual length, and the
   * drill itself becomes that block's single station.
   *
   * ⚠ This is "a drill is one activity — one station's worth" made literal. With one station
   * `blockRotates` is false, so a single picked drill is simply a stretch of practice; adding a
   * second drill to the same block is what turns it into a carousel.
   */
  function addBlockFromDrill(drill: RepTeamDrill) {
    if (plan.blocks.length >= MAX_BLOCKS) return;
    setBlocks([...plan.blocks, {
      id: newPracticePlanId(),
      title: drill.name,
      duration: { minutes: drill.usualMinutes ?? 15 },
      stations: [drillToStation(drill, newPracticePlanId)],
    }]);
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
    const result = await onCreateDrill(stationToDrillInput(station, tagIds));
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
          <div className={styles.ppAddRow}>
            <button type="button" className={styles.btnSecondary} onClick={() => setDrillSheet({ kind: 'block' })}>
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
            {/* The derived line, so it is obvious WHY some chips are softened — and obvious that
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
                    change is how strongly a chip is drawn. */}
                {roster.map(player => {
                  const playerGoals = goalsByPlayer.get(player.id) ?? [];
                  return (
                    <li key={player.id} className={styles.ppRailRow}>
                      <span className={styles.ppRailName}>{playerDisplayName(player)}</span>
                      {playerGoals.length === 0 ? (
                        <span className={styles.ppRailNone}>Nothing set yet</span>
                      ) : (
                        <span className={styles.ppChipWrap}>
                          {playerGoals.map(g => (
                            <span key={g.id} className={styles.ppFocusChip}
                              data-off={focusMatches(g) ? undefined : 'off'}>
                              {g.focusArea}
                            </span>
                          ))}
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
