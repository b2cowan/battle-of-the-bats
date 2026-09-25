'use client';
import { useMemo, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { resolveStationTeaching, type PracticePlanBlock, type PracticeStation, type RotationGrid } from '@/lib/rep-practice-plan';
import styles from '../../../coaches.module.css';

/**
 * "My station" (D28) — the assistant's version of the field screen.
 *
 * The owner's scenario, verbatim: *"a coach shows up assigned to a station but might not know what
 * they need to do or what they are focussing on."* So this screen answers, in this order, the three
 * things a station coach actually needs — **who is with me now and for how long · what am I doing ·
 * what am I watching for** — with tonight's note before them, then the coaching points, the setup,
 * and who arrives next. Nothing else.
 *
 * ⚠ READ-ONLY, like every other inch of the run (D4). There is no tick, no "we did this", no note
 * typed at the field. The screen moves; nothing is recorded.
 *
 * ⚠ WHERE EACH LINE COMES FROM (D27) — UPDATED IN PHASE 2. A station now carries its own
 * `description` and `goal`, because that is what a library drill supplies. This screen therefore
 * reads the STATION's words when it has them and FALLS BACK to the block's when it doesn't, via the
 * shared `resolveStationTeaching`. **Fall back, never replace, and never migrate:** every plan
 * written before the drill library existed has block-level teaching and no station-level teaching,
 * and it must keep reading correctly for ever.
 */

/**
 * WHAT A STATION SAYS, in the field's ONE order — shared by this screen and a plain stop (practice
 * plans on a phone, stage 3, owner 2026-09-25):
 *   · **tonight's note first** (M4) — the one line written for TONIGHT ("Only two ladders tonight —
 *     run it in pairs") changes how the station is run, so it is read before the lines written for
 *     every night. D28's order had it eighth, after the setup, the kit and who runs it — cut by the
 *     tab bar at 390 on an eight-word plan;
 *   · **the teaching, HEADED** (M2: "a stop reads like a station") — doing · watching for · points,
 *     D28's order (explain it, then coach it). A plain stop printed the same three resolved lines as
 *     two unlabelled paragraphs and a list, told apart only by weight;
 *   · **the setup and the kit**, set quieter.
 * A plain stop passes its block's ONE station (the station IS the block, D1 — a block built from a
 * drill keeps its words, setup, kit and note there), or none for a written block, whose words the
 * resolver falls back to.
 */
export function StationLines({ station, block }: { station: PracticeStation | null; block: PracticePlanBlock }) {
  const { description, goal, coachingPoints: points } = resolveStationTeaching(station ?? {}, block);
  return (
    <>
      {station?.note && (
        /* One-off, and never saved back to the station (D27). ⚠ Deliberately NOT attributed: the
           mockup drew "Note from Brett", but a plan stores the note and not who typed it, and
           inventing an author would be a fabrication on the one line a coach is most likely to act
           on. The label is the editor's own name for the field (stage 5 — one label, not three). */
        <div className={styles.ppStNote}>
          <p className={styles.ppStLbl}>Just for tonight</p>
          <p className={styles.ppStNoteTxt}>{station.note}</p>
        </div>
      )}

      <StationFactLine label="What you’re doing" text={description} loud />
      {/* The direct answer to "what am I watching for" — the reason this screen exists. From Phase 2
          it rides the DRILL, so it is written once and read by whoever is standing at the station. */}
      <StationFactLine label="What you’re watching for" text={goal} loud bold />
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

      <StationFactLine label="Setup" text={station?.setup} />
      <StationFactLine label="Equipment" text={station?.equipment?.join(' · ')} />
      {/* Here, not only on the station screen: a block with ONE station shows that station through
          its stop, and a rotation note is one of the words the editor keeps a lone station for
          (`collapseSoleStation`) — the paper prints it (/review, 2026-09-25). */}
      <StationFactLine label="Rotation" text={station?.rotationNote} />
    </>
  );
}

/** One headed line — the teaching set loud (`ppStTxt`), a reference line quieter. Nothing when empty. */
function StationFactLine({ label, text, loud, bold }: { label: string; text?: string; loud?: boolean; bold?: boolean }) {
  if (!text) return null;
  return (
    <div className={styles.ppStBlock}>
      <p className={styles.ppStLbl}>{label}</p>
      <p className={loud ? styles.ppStTxt : styles.ppStTxtSoft} style={bold ? { fontWeight: 700 } : undefined}>{text}</p>
    </div>
  );
}

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
  nameOf: (playerId: string) => string;
  onBack: () => void;
  /**
   * The run's own bar — the STOP's, rendered by the parent so there is ONE handler and one bar.
   *
   * ⚠ Deviation from the round-5 mockup, deliberate: that frame drew no controls at all. But the
   * person this screen exists for is the one standing at the station, and without a way to move
   * the round on they would have to back out to the station list, tap, and come back in — three
   * gloved taps, three times a practice. It records nothing, so D4 and D26 are untouched.
   * ⚠ AND IT GOES BOTH WAYS (stage 3, owner 2026-09-25): Back · Rotate now, exactly the stop's pair —
   * the forward button alone made an accidental Rotate now three taps to undo. How Back keeps this
   * station open is at the call site. On a PHONE the run's own foot moves it (stage 3b — "‹ Round 1"
   * · Rotate now over the block stepper) and this slot carries only a helper's line, with the words.
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

/**
 * Who arrives at this station after the round on screen, in the order they come — BY ROUND, never
 * by the plan's clock (P10): "6:10 p.m." was the round's planned start, and the rotation happens
 * when the coach taps, not when the plan said.
 */
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
      when: `Round ${r.round}`,
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
  const { station, stationIndex, block, rotating, round, grid, isMine, nameOf } = props;
  const name = station.name.trim() || `Station ${stationIndex + 1}`;

  // Memoised against the round: these three walk every round in the rotation and look up a name
  // per player, and they need redoing only when the round on screen changes.
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
      <h1 className={styles.ppStName}>{name}</h1>

      {/* The three facts a station coach needs, at the top, in this order. */}
      {here && (
        <div className={styles.ppStNow}>
          <p className={styles.ppStNowL}>{rotating ? 'With you now' : 'Who’s at it'}</p>
          <p className={styles.ppStNowG}>{here.label}</p>
          {here.players && <p className={styles.ppStNowP}>{here.players}</p>}
        </div>
      )}

      {/* Tonight's note, the headed teaching, the setup and the kit — the one order, shared with a
          plain stop (`StationLines`, the ONE resolver behind it). */}
      <StationLines station={station} block={block} />
      <StationFactLine label="Running it" text={station.staff?.join(' · ')} />

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
