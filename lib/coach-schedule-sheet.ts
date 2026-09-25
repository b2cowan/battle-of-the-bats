/**
 * THE EVENT SHEET'S DOOR ROWS — what each row SAYS, where the Lineup row GOES, and the address the
 * sheet and its views answer to (the Schedule deep dive, stage 1 · E1–E5, owner ruling 2026-09-25:
 * "as drawn"). React-free, so `node --test` reads it straight and the sheet cannot quietly
 * re-derive any of it inline.
 *
 *   · `attendanceRowWords` — the Attendance row's head and second line. The head carries the counts
 *                            ("Attendance · 10 in · 1 late · 1 out"); the line NAMES who is not
 *                            simply in — Out first, then Late, then No reply — so the coach reads
 *                            who is missing without opening anything (R2: a door names what is
 *                            behind it). Before anyone answers: "12 haven't replied — Avery, Blake,
 *                            Casey and 9 more"; once everyone is in: "All 12 in".
 *   · `lineupDoor`        — the Lineup row's destination, by the clock at every width (E3), and the
 *                            one exception E4 draws: a disagreement on a finished game opens the
 *                            builder, where the fix is.
 *   · `lineupRowWords`    — "No lineup yet" / "Has a lineup" / "Needs a look" with the warning (E4).
 *   · `scoutingRowWords`  — "Probe Rovers · 2-1 vs them · 3 notes" / "… · no games against them yet".
 *   · `sheetAddressFor` / `sheetViewFromTab` — the `?event=…&tab=…` grammar (E5), unchanged in shape.
 */

// ── The address (E5) ───────────────────────────────────────────────────────────────────────────

/** A view that opens INSIDE the sheet — the attendance room, or the scouting book's panel. */
export type SheetView = 'attendance' | 'scouting';

/**
 * `?tab=` → the view the sheet opens with. `attendance` is the room (the Overview's four links,
 * Insights' "Take attendance", the next-step card); `scouting` the book's panel (the masthead's
 * nudge, the Opponents card). `lineup` — the builder's way home (§222) — opens the sheet itself,
 * where the Lineup row sits on screen one; so does no tab at all.
 */
export function sheetViewFromTab(tab: string | null | undefined): SheetView | null {
  return tab === 'attendance' || tab === 'scouting' ? tab : null;
}

/** The address the open sheet — or the view open inside it — stands on. */
export function sheetAddressFor(base: string, eventId: string, view: SheetView | null): string {
  return `${base}/schedule?event=${eventId}${view ? `&tab=${view}` : ''}`;
}

// ── The names on a row ─────────────────────────────────────────────────────────────────────────

/**
 * ⚠ AT MOST THREE NAMES ON A ROW'S SECOND LINE, then "and N more" (the length rule stage 1 asked to
 * be pinned). Three names with their labels fit two lines at 360px — the narrowest width the portal
 * draws — for any roster of ordinary first names; the stylesheet clamps the line at two as the
 * belt for a roster of very long ones. The head carries the full counts, so the names only have to
 * say WHO, never how many.
 */
export const ROW_NAME_CAP = 3;

/** A player as a row names them. */
export interface RowPlayer {
  firstName: string;
  /** The jersey number, or null. */
  number: string | null;
}

/** "#12 Logan" — the number when there is one, and the first name. */
export function rowPlayerLabel(p: RowPlayer): string {
  return [p.number ? `#${p.number}` : '', p.firstName].filter(Boolean).join(' ') || '—';
}

/** "Avery", "Avery and Blake", "Avery, Blake and Casey", "Avery, Blake, Casey and 9 more". */
export function nameList(names: readonly string[], cap = ROW_NAME_CAP): string {
  if (names.length === 0) return '';
  if (names.length > cap) return `${names.slice(0, cap).join(', ')} and ${names.length - cap} more`;
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// ── Attendance (E1 · E2) ───────────────────────────────────────────────────────────────────────

export type AttendanceStatusValue = 'attending' | 'late' | 'absent' | 'unknown';

/** One piece of the Attendance row's second line, with the tone it is drawn in. */
export interface RowLinePart {
  text: string;
  tone: 'out' | 'late' | 'none' | null;
}

export interface RowWords {
  head: string;
  parts: RowLinePart[];
}

const COUNT_WORD: Record<AttendanceStatusValue, string> = {
  attending: 'in', late: 'late', absent: 'out', unknown: 'no reply',
};

/**
 * The Attendance row's words for one event's roster. Order of the line is the order a coach acts
 * on it: who is OUT, then who is LATE, then who has not answered; the names share one budget of
 * `ROW_NAME_CAP`; a group's names past it read "and N more", and a group it never reached is counted.
 */
export function attendanceRowWords(rows: readonly { player: RowPlayer; status: AttendanceStatusValue }[]): RowWords {
  const total = rows.length;
  if (total === 0) return { head: 'Attendance', parts: [{ text: 'No players on the roster yet', tone: null }] };
  const by: Record<AttendanceStatusValue, RowPlayer[]> = { attending: [], late: [], absent: [], unknown: [] };
  for (const r of rows) by[r.status].push(r.player);

  // Nobody has answered: name who has not, first names only (the drawn sentence).
  if (by.unknown.length === total) {
    const verb = total === 1 ? 'hasn’t' : 'haven’t';
    return { head: 'Attendance', parts: [{ text: `${total} ${verb} replied — ${nameList(by.unknown.map(p => p.firstName || rowPlayerLabel(p)))}`, tone: 'none' }] };
  }
  // Everyone gave the same answer: say so in one breath ("All 12 in").
  for (const s of ['attending', 'late', 'absent'] as const) {
    if (by[s].length === total) return { head: 'Attendance', parts: [{ text: `All ${total} ${COUNT_WORD[s]}`, tone: s === 'attending' ? null : s === 'late' ? 'late' : 'out' }] };
  }

  const head = ['Attendance', ...(['attending', 'late', 'absent', 'unknown'] as const)
    .filter(s => by[s].length > 0)
    .map(s => `${by[s].length} ${COUNT_WORD[s]}`)].join(' · ');
  const groups: { label: string; word: string; tone: RowLinePart['tone']; players: RowPlayer[] }[] = [
    { label: 'Out', word: COUNT_WORD.absent, tone: 'out', players: by.absent },
    { label: 'Late', word: COUNT_WORD.late, tone: 'late', players: by.late },
    { label: 'No reply', word: COUNT_WORD.unknown, tone: 'none', players: by.unknown },
  ];
  const parts: RowLinePart[] = [];
  let budget = ROW_NAME_CAP;
  for (const g of groups) {
    if (g.players.length === 0) continue;
    const shown = g.players.slice(0, Math.max(0, budget));
    budget -= shown.length;
    const rest = g.players.length - shown.length;
    // ⚠ "and N more" is only ever more of THAT answer — "Late: #2 Blake and 1 more" — and a group
    // the budget never reached is counted in its own words ("2 no reply"), in its own tone. Folding
    // every overflow into the last named group (/review, 2026-09-25) read three Late and No-reply
    // players as three more Late, and 3 Out + 2 Late as five Out, beside a head that said otherwise.
    parts.push({
      text: shown.length === 0
        ? `${g.players.length} ${g.word}`
        : `${g.label}: ${shown.map(rowPlayerLabel).join(', ')}${rest > 0 ? ` and ${rest} more` : ''}`,
      tone: g.tone,
    });
  }
  return { head, parts };
}

// ── Lineup (E3 · E4) ───────────────────────────────────────────────────────────────────────────

export type LineupDoor = 'builder' | 'game-day';

/**
 * WHERE THE LINEUP ROW GOES — by the clock, at every width (E3; the desk's "Edit in Lineups →" on
 * a started game was F07):
 *   · before first pitch, the builder;
 *   · from first pitch, Game day — the in-game adjustment surface (the inning stepper, subs, the
 *     bench), the same clock the sheet turns score-first on;
 *   · no lineup at all, the builder at any hour — there is nothing for a bench to run (the peek's
 *     "Build lineup →" did the same);
 *   · ⚠ a disagreement between attendance and the lineup on a game whose live window has CLOSED,
 *     the builder (E4: "the row opens the builder, where the fix is"). Outside its window Game day
 *     is a read-only recap, so the clock alone would send the coach to a page that cannot fix
 *     what the row just told them — the drawn case, vs Ridgeview on 4 May, is exactly that game.
 *     Inside the window the console IS where the fix is, so the clock stands.
 */
export function lineupDoor({ started, hasLineup, mismatch, liveWindow }: {
  started: boolean;
  hasLineup: boolean;
  mismatch: boolean;
  /** The game-day window holds right now (the console runs live, not as a recap). */
  liveWindow: boolean;
}): LineupDoor {
  if (!started || !hasLineup) return 'builder';
  if (mismatch && !liveWindow) return 'builder';
  return 'game-day';
}

/** Attendance and the saved lineup disagreeing: who is in but has no spot, who is out but has one. */
export interface LineupMismatch {
  coming: RowPlayer[];
  out: RowPlayer[];
}

/** The Lineup row's words. A disagreement is the line, in the warning tone (E4). */
export function lineupRowWords({ hasLineup, mismatch, door }: {
  hasLineup: boolean;
  mismatch: LineupMismatch | null;
  door: LineupDoor;
}): { head: string; line: string; warn: boolean } {
  if (mismatch && (mismatch.coming.length > 0 || mismatch.out.length > 0)) {
    const first = (ps: RowPlayer[]) => nameList(ps.map(p => p.firstName || rowPlayerLabel(p)));
    const is = (n: number) => (n === 1 ? 'is' : 'are');
    const sentences = [
      mismatch.coming.length > 0 ? `${first(mismatch.coming)} ${is(mismatch.coming.length)} in, but not in the lineup` : '',
      mismatch.out.length > 0 ? `${first(mismatch.out)} ${is(mismatch.out.length)} Out but in the lineup` : '',
    ].filter(Boolean);
    return { head: 'Lineup · Needs a look', line: sentences.join(' · '), warn: true };
  }
  if (!hasLineup) return { head: 'Lineup', line: 'No lineup yet', warn: false };
  return {
    head: 'Lineup · Has a lineup',
    line: door === 'game-day' ? 'Game day — the bench console' : 'The builder — order and positions',
    warn: false,
  };
}

// ── Scouting (E3) ──────────────────────────────────────────────────────────────────────────────

/** The Scouting row's second line, from the book's entry for this opponent (or none yet). */
export function scoutingRowWords(opponent: string, entry: {
  record: { wins: number; losses: number; ties: number };
  observationCount: number;
} | null | undefined, recordText: (r: { wins: number; losses: number; ties: number }) => string): string {
  const played = entry ? entry.record.wins + entry.record.losses + entry.record.ties : 0;
  const notes = entry?.observationCount ?? 0;
  return [
    opponent,
    played > 0 ? `${recordText(entry!.record)} vs them` : 'no games against them yet',
    notes > 0 ? `${notes} note${notes === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(' · ');
}
