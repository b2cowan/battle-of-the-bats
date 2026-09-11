/**
 * What a practice's records SUPPORT saying about it (development lifecycle Phase 0, F03).
 *
 * ⚠ The Development report listed every practice with a plan OR a recap under a heading that said
 * they were run — with no look at the date. Next Tuesday's plan sat under "Practices you've run".
 * A past plan with no recap was listed the same way, and a saved plan does not establish that the
 * night happened as written. Only a RECAP describes what happened, because a coach sat down
 * afterwards and wrote it. Three states, three labels, and none of them says "run".
 *
 * Pure module — the board route stamps each practice with its state (ONE clock, the server's), and
 * the report renders the label from the same table, so the two can never drift.
 */

export type PracticeTruth = 'upcoming' | 'past-no-recap' | 'recap';

/**
 * Instants compared to an instant — never a date slice (`starts_at` is a timestamptz; slicing its
 * UTC date shifts an evening practice a day). A recap is the evidence whatever the calendar says.
 */
export function practiceTruth(
  practice: { startsAt: string; practiceRecap: string | null },
  now: Date = new Date(),
): PracticeTruth {
  if (practice.practiceRecap) return 'recap';
  const starts = new Date(practice.startsAt).getTime();
  return Number.isFinite(starts) && starts > now.getTime() ? 'upcoming' : 'past-no-recap';
}

/** The chip and the quiet line beneath it — the report's words, drawn once. */
export const PRACTICE_TRUTH_LABELS: Readonly<Record<PracticeTruth, { label: string; meta: string | null }>> = {
  upcoming: { label: 'Upcoming plan', meta: 'This practice has not happened yet.' },
  'past-no-recap': { label: 'Past plan · no recap', meta: 'The saved plan does not establish what happened.' },
  recap: { label: 'Recap recorded', meta: null },
};
