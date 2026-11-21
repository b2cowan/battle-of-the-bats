/**
 * WHAT A HOUSE-LEAGUE SIGN-UP'S DOCUMENT TICKS SAY, in one place (Board Ready Stage 4). The old `league_registrations.waiver_accepted_at`
 * is set only when a document asked "I have read and agree", so a season whose only document is "I have read …" left it empty and
 * the three staff readers (the child page, the Children queue's duplicate cards, the Families export) said nothing. They read the
 * ticks instead: `club_form_ticks` rows, one per document ticked.
 *
 * Pure — no database. The read is `readTickSummaries` (./club-form-tick-summary-read.ts).
 *
 * A registration with no tick has NO summary: "not recorded", never "not accepted".
 */

/** The ticked words that read as agreement (lib/club-form.ts `tickSentence`: "I have read and agree to {doc}."). */
const AGREED_PREFIX = 'I have read and agree';

export interface TickRow {
  subject_id: string;
  sentence: string;
  ticked_at: string | null;
}

export interface TickSummary {
  /** The EARLIEST tick of the registration — the day the family sat down and did it. */
  at: string;
  /** True when ANY tick's sentence begins "I have read and agree"; false when every tick is only "I have read …". */
  agreed: boolean;
}

const time = (at: string) => Date.parse(at) || 0;

/** One summary per registration that has at least one dated tick. */
export function summariseTicks(rows: readonly TickRow[]): Map<string, TickSummary> {
  const out = new Map<string, TickSummary>();
  for (const r of rows) {
    if (!r.ticked_at) continue;
    const agreed = String(r.sentence ?? '').startsWith(AGREED_PREFIX);
    const cur = out.get(r.subject_id);
    if (!cur) { out.set(r.subject_id, { at: r.ticked_at, agreed }); continue; }
    if (time(r.ticked_at) < time(cur.at)) cur.at = r.ticked_at;
    if (agreed) cur.agreed = true;
  }
  return out;
}

/** The Children queue's detail words: "Agreed to documents on {date}" / "Documents ticked on {date}". */
export const documentsTickLine = (agreed: boolean, date: string) => (agreed ? `Agreed to documents on ${date}` : `Documents ticked on ${date}`);
