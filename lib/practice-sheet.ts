/**
 * The printed practice sheet's DATA — the plan on paper, assembled once for both pages that print
 * it: the plan page (live and as a record) and the closed-season reader (practices re-evaluation
 * stage 6, owner ruling R5, 2026-09-18 — the reader gained Print the sheet, and the builder moved
 * here from the plan page's `handlePrint` rather than being copied). Pure: it reads the plan, the
 * event and the team's libraries and returns what `downloadPracticeSheet` draws; the pages own the
 * fetches (the PDF settings) and the download.
 *
 * ⚠ ONE PASS, ONE BLOCK AT A TIME. The run sheet prints each rotation INSIDE the block it was
 * configured on (owner-approved structure, 2026-08-22), so the grid, its honest-arithmetic
 * statements and its group membership are assembled here beside that block's own prose — never
 * flattened into document-level lists that the sheet then has to re-associate.
 *
 * ⚠ Every clock on the paper comes from the SAME walk as the screen's time column
 * (`computeBlockClocks` → `clock.startMs`), never a second copy of the arithmetic — an earlier
 * duplicate had already drifted on how a "rest of practice" block advances the cursor, so the
 * sheet and the screen disagreed.
 *
 * ⚠ The sheet is subject to the same vocabulary rule as the screen — it describes what was
 * PLANNED, and says nothing about what was done.
 */
import type { PracticeSheetBlock, PracticeSheetOptions, PracticeSheetRotation, PracticeSheetStation, OrgPdfSettings } from './export';
import { playerDisplayName } from './coach-roster-name';
import { formatInOrgZone } from './timezone';
import { formatStoredClock } from './utils';
import { surfaceLabel } from './sports';
import {
  blockOwnPeople, blockRotates, computeBlockClocks, computeRotation, formatDuration, practiceKitBag,
  resolvePracticePlanTagNames, resolveStationTeaching, rotationByStation, soleStationOf, stationLabel, tagNamesById,
  type PracticePlan,
} from './rep-practice-plan';

/** "Tue, May 5, 2026" — the printed sheet's date, where the year matters. */
const fmtDate = (iso: string) =>
  formatInOrgZone(iso, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const fmtTime = (iso: string) => formatInOrgZone(iso, { hour: 'numeric', minute: '2-digit', hour12: true });

export type PracticeSheetInput = {
  plan: PracticePlan;
  event: {
    startsAt: string | null;
    endsAt?: string | null;
    arrivalTime?: string | null;
    location?: string | null;
    fieldNumber?: string | null;
  };
  teamName: string;
  /** The team's sport — a bare diamond number prints "Diamond 1" on the where-line (`surfaceLabel`). */
  sport: string | null | undefined;
  roster: { id: string; playerFirstName: string; playerLastName: string; playerNumber: string | null }[];
  /** The roster's ACTIVE focus areas — empty when the reader may not see them (the section is then absent). */
  goals: { playerId: string; focusArea: string; status: string }[];
  canViewFocus: boolean;
  /** The team's CURRENT 'staff'/'equipment' libraries (mig 266) — see `resolvePracticePlanTagNames`. */
  staffTags: readonly { id: string; name: string }[];
  equipmentTags: readonly { id: string; name: string }[];
  /** What the practice is about — its tag ids, named against the team's focus vocabulary. */
  planTagIds: readonly string[];
  focusTags: readonly { id: string; name: string }[];
  settings: OrgPdfSettings;
};

export function buildPracticeSheet(input: PracticeSheetInput): PracticeSheetOptions {
  const { plan, event, teamName, sport, roster, goals, canViewFocus, staffTags, equipmentTags, planTagIds, focusTags, settings } = input;
  // Resolved to CURRENT tag names (mig 266) — see `resolvePracticePlanTagNames`. The sheet, like
  // the run screen, only ever reads `.staff`/`.equipment` as plain strings; this is what lets a
  // station saved under the new picker still print who's running it and what to bring.
  const resolved = resolvePracticePlanTagNames(plan, staffTags, equipmentTags);
  const clocks = computeBlockClocks(resolved.blocks, event.startsAt ?? undefined, event.endsAt ?? null);
  const clockByBlock = new Map(clocks.map(c => [c.blockId, c]));
  const nameOf = (id: string) => {
    const p = roster.find(r => r.id === id);
    return p ? playerDisplayName(p) : '';
  };

  const blocks: PracticeSheetBlock[] = resolved.blocks.map(block => {
    const clock = clockByBlock.get(block.id);
    const time = clock ? `${clock.startLabel}${clock.endLabel ? `–${clock.endLabel}` : ''}` : '';
    // One vocabulary at both levels (stage 2, D3): the block's line says "Watch for:" as its
    // station lines below already do — the word the field screen prints in bold.
    // The block's kit (D11) prints beside the block, where a station's already prints; the
    // block has no legacy names field to resolve into, so its ids are named here directly.
    const blockKit = tagNamesById(block.equipmentTagIds, equipmentTags);
    const notes = [
      block.goal ? `Watch for: ${block.goal}` : '',
      block.description ?? '',
      blockKit.length ? `Equipment: ${blockKit.join(', ')}` : '',
      ...(block.coachingPoints ?? []).map((p, i) => `${i + 1}. ${p}`),
    ].filter(Boolean).join('\n');

    // Each station as a LABELLED BLOCK under the words (stage 5, P8) — the screen's column and
    // the modal's order, on paper: the name with "Run by" beside it, then what it says of its
    // own, then Setup · Equipment · Players · Tonight · Rotation as lines, then its points.
    // Never the " · "-joined prose run this used to be (it wrapped mid-item: "Run by Sam /
    // Assistant"), never columns.
    const stations: PracticeSheetStation[] = (block.stations ?? []).map((s, i) => {
      // ⚠ The SAME resolver the field screen uses. The sheet is what an assistant running the
      // tee station actually carries, so a station whose teaching came from a drill must print
      // it — and a plan written before the library existed must still print the block's.
      const { description, goal } = resolveStationTeaching(s, block);
      return {
        name: stationLabel(s, i),
        runBy: (s.staff ?? []).join(', '),
        // Only when the station says something the block hasn't already said above, so the
        // sheet doesn't print the same sentence twice for a single-station block — in the
        // block's own order: "Watch for:" first, then the doing line.
        words: [
          goal && goal !== block.goal ? `Watch for: ${goal}` : '',
          description && description !== block.description ? description : '',
        ].filter(Boolean),
        // The renderer prints a fact only when its value is there — a line is absent, never empty.
        facts: [
          ['Setup', s.setup ?? ''],
          // "Kit" was the pre-2026-08-01 name, and equipment is a LIST — the old template
          // interpolated the array itself, printing "Screen,Balls,Net" with no spaces.
          ['Equipment', (s.equipment ?? []).join(', ')],
          // The station's own people — and when the station IS the block (its sole station) and
          // names nobody, the block's word: "Whole team", as the field says for the same block.
          ['Players', (s.playerIds ?? []).map(nameOf).filter(Boolean).join(', ')
            || (soleStationOf(block) === s && !(s.playerIds ?? []).length ? 'Whole team' : '')],
          ['Tonight', s.note ?? ''],
          ['Rotation', s.rotationNote ?? ''],
        ],
        // Read from the STATION, not the resolver: the block's own points are already printed
        // once above, and re-printing them under every station would double them on the page.
        // (Comparing the resolver's array by identity worked, but only by accident of how the
        // fallback happens to return the same reference.)
        points: s.coachingPoints ?? [],
      };
    });

    // The rotation of THIS block, when it has one.
    //
    // ⚠ An UNFINISHED rotation still prints. `computeRotation` returns no rounds but a
    // statement saying what is missing ("Add how often groups move…") — the sheet used to
    // drop the whole thing, so a coach reading only the paper had no idea a station plan was
    // ever intended. It now prints the statement and whatever groups exist, with no grid.
    let rotation: PracticeSheetRotation | null = null;
    if (blockRotates(block) && block.rotation) {
      const grid = computeRotation(
        block.rotation, block.stations, block.duration.minutes ?? null, clock?.startMs,
      );
      // The grid TURNED to station columns (stage 5, P1 — the paper reads as the screen's board
      // has since D6): the block's named stations across, one row per round, the group(s) in
      // each cell. Assembled from the screen's own re-key (`rotationByStation`) — by station
      // ID, never by a cell's position — because a hand-arranged grid (D14) can put a group
      // anywhere in a round, share a station between two, leave one empty or sit a group out,
      // and the paper must print each exactly where the coach put it.
      const turned = rotationByStation(grid, block.stations);
      rotation = {
        stationNames: turned.stations.map(s => s.name),
        rounds: turned.rows.map(r => ({
          round: `${r.round}${r.startLabel ? ` (${r.startLabel})` : ''}`,
          groups: r.cells,
          out: r.out.map(o => o.name),
        })),
        notes: grid.notes,
        groups: block.rotation.groups.map(g => ({
          name: g.name,
          players: g.playerIds.map(nameOf).filter(Boolean).join(', '),
        })),
      };
    }

    // Whose line this is — the lib's one rule (`blockOwnPeople`): the block's own people, or
    // nothing when they live on its stations (a sole station's print under that station).
    const own = block.stations?.length ? undefined : blockOwnPeople(block);
    const players = (own ?? []).map(nameOf).filter(Boolean).join(', ');
    return {
      time,
      title: block.title || '(untitled)',
      duration: formatDuration(block.duration),
      staff: (block.staff ?? []).join(', '),
      // "Whole team" where the sheet printed nothing (stage 5, P5) — the plan page's own word
      // for a block that names nobody; a coach's list prints as written, because the record is
      // the coach's own list (the page keeps "12 players" apart from "Whole team" on purpose).
      players: players || (own && own.length === 0 ? 'Whole team' : ''),
      notes,
      stations,
      rotation,
    };
  });

  // ⚠ Focus areas print ONLY when the plan carries the section (the paper follows the screen —
  // 2026-09-14) AND the person generating the sheet can see them. An assistant without `notes`
  // gets the same sheet with the section absent — and the data never reached their browser in
  // the first place, so there is nothing here to forget to hide. The closed-season reader passes
  // no goals at all: its route never fetches them for a finished season.
  const focus = plan.includeFocusAreas && canViewFocus
    ? roster.map(p => ({
        player: playerDisplayName(p),
        // Separated by a middot, not a comma: a focus area is a SENTENCE ("Backhand pickups —
        // glove out front, working through the ball"), and joining two of them with a comma made
        // one player’s two goals read as a single run-on line on the printed sheet.
        focusAreas: goals.filter(g => g.playerId === p.id && g.status === 'working').map(g => g.focusArea).join('  ·  '),
      })).filter(row => row.focusAreas)
    : [];

  // ⚠ The arrival time is a STORED "HH:mm" and it printed raw — "Arrive 17:45" — for as long as
  // this sheet existed, the eighth hand-rolled clock the 2026-08-26 ruling found, unrendered
  // because the rendered check's fixture types its own "5:45 p.m." (stage 5, P2). The clock rule
  // has no paper carve-out: the same guard-then-format the Schedule reads the field through.
  const whereLabel = [
    event.startsAt ? fmtTime(event.startsAt) : '',
    event.arrivalTime ? `Arrive ${formatStoredClock(event.arrivalTime)}` : '',
    [event.location, surfaceLabel(sport, event.fieldNumber)].filter(Boolean).join(', '),
  ].filter(Boolean).join('  ·  ');

  return {
    teamName,
    dateLabel: event.startsAt ? fmtDate(event.startsAt) : '',
    whereLabel,
    goal: plan.goal ?? null,
    // What the practice is ABOUT: its tags now, plus any legacy free-text labels a plan
    // written before Phase 3 still carries.
    description: plan.description ?? null,
    practiceTypes: [...tagNamesById(planTagIds, focusTags), ...(plan.practiceTypes ?? [])],
    // The head prints the BAG (stage 2, D11) — everything the blocks and stations below need
    // plus the coach's extras — the same walk the sheet's About line reads on screen.
    equipment: practiceKitBag(plan, equipmentTags).all,
    blocks, focus, settings,
  };
}
