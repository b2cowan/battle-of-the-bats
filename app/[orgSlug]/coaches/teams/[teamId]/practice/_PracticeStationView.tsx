'use client';
import { useMemo, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { PracticePlanBlock, PracticeStation, RotationGrid } from '@/lib/rep-practice-plan';
import styles from '../../../coaches.module.css';

/**
 * "My station" (D28) — the assistant's version of the field screen.
 *
 * The owner's scenario, verbatim: *"a coach shows up assigned to a station but might not know what
 * they need to do or what they are focussing on."* So this screen answers, in this order, the three
 * things a station coach actually needs — **who is with me now and for how long · what am I doing ·
 * what am I watching for** — then the coaching points, the setup, tonight's note, and who arrives
 * next. Nothing else.
 *
 * ⚠ READ-ONLY, like every other inch of the run (D4). There is no tick, no "we did this", no note
 * typed at the field. The screen moves; nothing is recorded.
 *
 * ⚠ WHERE EACH LINE COMES FROM (D27). Slice 1a puts the *teaching* on the block (description and
 * goal) and the *station* holds its own coaching points, setup and tonight's note — so "what you're
 * doing" and "what you're watching for" read from the block. That is the seam Phase 2's drill
 * library lifts out; it is not a shortcut, and it must not be papered over by adding a second
 * description field to the station.
 */

type Props = {
  station: PracticeStation;
  stationIndex: number;
  block: PracticePlanBlock;
  /** Do this block's stations rotate? Always the answer from `blockRotates`, never re-derived. */
  rotating: boolean;
  /** The computed carousel, when this block has one. */
  grid: RotationGrid | null;
  /** 1-based round showing on the run screen, when this block is a rotation. */
  round: number | null;
  /** The reader is tagged on this station, so the screen greets them rather than describing it. */
  isMine: boolean;
  /** "4:12" / "+1:20", already formatted by the run screen so both clocks always agree. */
  clock: string | null;
  clockOver: boolean;
  nameOf: (playerId: string) => string;
  onBack: () => void;
  /**
   * The run's own advance control, rendered by the parent so there is ONE handler.
   *
   * ⚠ Deviation from the round-5 mockup, deliberate: that frame drew no controls at all. But the
   * person this screen exists for is the one standing at the station, and without a way to move
   * the round on they would have to back out to the station list, tap, and come back in — three
   * gloved taps, three times a practice. It is the same tap as "Rotate now" on the block screen
   * and it records nothing, so D4 and D26 are untouched.
   */
  actions?: ReactNode;
};

/**
 * What the three derived reads below actually need — deliberately NOT the whole `Props`.
 *
 * They are pure functions of the plan and the round; taking the component's props would drag a
 * callback and a ReactNode into their signature and force any future test of them to build a
 * component's worth of scaffolding to compute a string.
 */
type StationFacts = {
  station: PracticeStation;
  block: PracticePlanBlock;
  rotating: boolean;
  grid: RotationGrid | null;
  round: number | null;
  nameOf: (playerId: string) => string;
};

/** The players standing at this station right now, and under whose group name. */
type Present = { label: string; players: string };

function presentNow({ station, block, rotating, grid, round, nameOf }: StationFacts): Present | null {
  if (rotating && grid && round != null) {
    const cells = grid.roundsList[round - 1]?.cells ?? [];
    // ⚠ Both groups are named when two share a station — never one silently winning (§10.4 item 4).
    const here = cells.filter(c => c.stationId === station.id);
    if (here.length === 0) return null;
    const groups = block.rotation?.groups ?? [];
    return {
      label: here.map(c => c.groupName).join(' + '),
      players: here
        .flatMap(c => groups.find(g => g.id === c.groupId)?.playerIds ?? [])
        .map(nameOf).filter(Boolean).join(' · '),
    };
  }

  // Stations that don't rotate keep their own list — the one level people live at here.
  const ids = station.playerIds ?? [];
  if (ids.length === 0) return null;
  return { label: 'At this station', players: ids.map(nameOf).filter(Boolean).join(' · ') };
}

/** Who arrives at this station after the round on screen, in the order they come. */
type Arrival = { when: string; who: string };

function arrivals({ station, block, grid, round, nameOf }: StationFacts): Arrival[] {
  if (!grid || round == null) return [];
  const groups = block.rotation?.groups ?? [];
  const out: Arrival[] = [];
  for (const r of grid.roundsList) {
    if (r.round <= round) continue;
    const here = r.cells.filter(c => c.stationId === station.id);
    if (here.length === 0) continue;
    out.push({
      when: r.startLabel ?? `Round ${r.round}`,
      who: here.map(c => {
        const players = groups.find(g => g.id === c.groupId)?.playerIds ?? [];
        const names = players.map(nameOf).filter(Boolean).join(' · ');
        return names ? `${c.groupName} — ${names}` : c.groupName;
      }).join('  ·  '),
    });
  }
  return out;
}

/**
 * Has every group been through this station by the end?
 *
 * Asked so the closing line can be TRUE rather than reassuring. D25's honest-arithmetic rule
 * applies here as much as it does to the grid: with four stations and three rounds somebody never
 * reaches this one, and saying "everyone's been through" would be a small confident lie told to
 * the person best placed to notice it.
 */
function everyoneHasBeenThrough({ station, block, grid }: StationFacts): boolean {
  if (!grid || grid.roundsList.length === 0) return false;
  const groupCount = block.rotation?.groups.length ?? 0;
  if (groupCount === 0) return false;
  const visited = new Set<string>();
  for (const r of grid.roundsList) {
    for (const c of r.cells) if (c.stationId === station.id) visited.add(c.groupId);
  }
  return visited.size >= groupCount;
}

export default function PracticeStationView(props: Props) {
  const { station, stationIndex, block, rotating, round, grid, isMine, clock, clockOver, nameOf } = props;
  const name = station.name.trim() || `Station ${stationIndex + 1}`;
  const points = station.coachingPoints?.length ? station.coachingPoints : block.coachingPoints ?? [];

  /**
   * ⚠ Memoised against the ROUND, not the clock. `clock` changes once a second for the whole time
   * this screen is open; these three walk every round in the rotation and look up a name per
   * player. Recomputing them on each tick would be a full scan of the carousel per second to
   * render a number that is already sitting in a different paragraph.
   */
  const facts: StationFacts = useMemo(
    () => ({ station, block, rotating, grid, round, nameOf }),
    [station, block, rotating, grid, round, nameOf],
  );
  const here = useMemo(() => presentNow(facts), [facts]);
  const coming = useMemo(() => arrivals(facts), [facts]);
  const throughAll = useMemo(() => everyoneHasBeenThrough(facts), [facts]);

  return (
    <div className={styles.ppRunPage}>
      <div className={styles.ppRunBar}>
        <button type="button" className={styles.ppRunBackLink} onClick={props.onBack}>
          <ArrowLeft size={13} aria-hidden /> All stations
        </button>
        {rotating && round != null && grid ? <span><b>Round {round} of {grid.rounds}</b></span> : null}
      </div>

      <p className={styles.ppStEyebrow}>{isMine ? 'You’re running' : 'Station'}</p>
      <h1 className={styles.ppStName}>
        {name}{station.count ? ` ×${station.count}` : ''}
      </h1>

      {/* The three facts a station coach needs, at the top, in this order. */}
      {here && (
        <div className={styles.ppStNow}>
          <p className={styles.ppStNowL}>{rotating ? 'With you now' : 'Who’s at it'}</p>
          <p className={styles.ppStNowG}>{here.label}</p>
          {here.players && <p className={styles.ppStNowP}>{here.players}</p>}
          {clock && (
            <p className={styles.ppStNowT} data-over={clockOver ? 'over' : undefined}>
              {rotating
                ? (clockOver ? `${clock} — they were due to rotate` : `${clock} until they rotate`)
                : (clockOver ? `${clock} over` : `${clock} left`)}
            </p>
          )}
        </div>
      )}

      {block.description && (
        <div className={styles.ppStBlock}>
          <p className={styles.ppStLbl}>What you’re doing</p>
          <p className={styles.ppStTxt}>{block.description}</p>
        </div>
      )}

      {/* The direct answer to "what am I watching for" — the reason this screen exists. */}
      {block.goal && (
        <div className={styles.ppStBlock}>
          <p className={styles.ppStLbl}>What you’re watching for</p>
          <p className={styles.ppStTxt} style={{ fontWeight: 700 }}>{block.goal}</p>
        </div>
      )}

      {points.length > 0 && (
        <>
          <div className={styles.ppStDivider} />
          <div className={styles.ppStBlock} style={{ marginTop: 0 }}>
            <p className={styles.ppStLbl}>Coaching points</p>
            <ol className={styles.ppRunPoints}>
              {points.map((point, i) => <li key={i}>{point}</li>)}
            </ol>
          </div>
        </>
      )}

      {station.setup && (
        <div className={styles.ppStBlock}>
          <p className={styles.ppStLbl}>Setup</p>
          <p className={styles.ppStTxtSoft}>{station.setup}</p>
        </div>
      )}

      {station.equipment?.length ? (
        <div className={styles.ppStBlock}>
          <p className={styles.ppStLbl}>Equipment</p>
          <p className={styles.ppStTxtSoft}>{station.equipment.join(' · ')}</p>
        </div>
      ) : null}

      {station.staff?.length ? (
        <div className={styles.ppStBlock}>
          <p className={styles.ppStLbl}>Running it</p>
          <p className={styles.ppStTxtSoft}>{station.staff.join(' · ')}</p>
        </div>
      ) : null}

      {/* One-off, and never saved back to the station (D27). ⚠ Deliberately NOT attributed: the
          mockup drew "Note from Brett", but a plan stores the note and not who typed it, and
          inventing an author would be a fabrication on the one line a coach is most likely to
          act on. If attribution is wanted it is a model change, not a label change. */}
      {station.note && (
        <div className={styles.ppStNote}>
          <p className={styles.ppStLbl} style={{ marginBottom: '0.2rem' }}>Note for tonight</p>
          <p>{station.note}</p>
        </div>
      )}
      {station.rotationNote && (
        <div className={styles.ppStBlock}>
          <p className={styles.ppStLbl}>Rotation</p>
          <p className={styles.ppStTxtSoft}>{station.rotationNote}</p>
        </div>
      )}

      {/* ⚠ BOTH "no one else" branches stay in SCHEDULE language. "Everyone's been through" would
          be a claim about what HAPPENED, and this screen only ever knows what was PLANNED — the
          rotation can say every group is due to reach this station, never that they did. This is
          the one spot in the surface where the past tense would otherwise slip in. */}
      {rotating && round != null && (
        <div className={styles.ppStUp}>
          <p className={styles.ppStLbl}>Coming to you</p>
          {coming.length > 0
            ? coming.map((a, i) => (
              <div key={i} className={styles.ppStUpRow}><span>{a.when}</span><span>{a.who}</span></div>
            ))
            : (
              <p className={styles.ppStUpNone}>
                {throughAll
                  ? 'No one else — every group is due here by the end.'
                  : 'No one else is due at this station.'}
              </p>
            )}
        </div>
      )}

      {props.actions}
    </div>
  );
}
