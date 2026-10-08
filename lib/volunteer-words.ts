import type { VolunteerJob } from './volunteer-jobs';

/**
 * A VOLUNTEER'S WORDS — /marketing 2026-10-07 (Tournament admin redesign Stage 6). One home, so the
 * invite, Members, the emails, the accept page and the Workspaces card say a volunteer's job the same
 * way. The role itself is "Volunteer" (`ROLE_LABEL.official`, lib/member-access.ts); "Scorekeeper" and
 * "Gate" are the two JOB names — the tabs, the Account sheet, the Staff kit's cards.
 *
 * Client-safe: no imports beyond the job type.
 */

/** The two jobs' names, as a volunteer's tabs, Account sheet and the Staff kit cards say them. */
export const VOLUNTEER_DUTY = { scoring: 'Scorekeeper', gate: 'Gate' } as const;

/** The jobs a volunteer holds, in "Helping with" order, as names ("Scorekeeper · Gate"). */
export function volunteerDuties(job: VolunteerJob | null): string[] {
  if (job === 'both') return [VOLUNTEER_DUTY.scoring, VOLUNTEER_DUTY.gate];
  if (job === 'scoring') return [VOLUNTEER_DUTY.scoring];
  if (job === 'gate') return [VOLUNTEER_DUTY.gate];
  return [];
}

/** "Helping with" — the invite's and Manage's field (Scoring · The gate · Both). */
export const HELPING_WITH = {
  label: 'Helping with',
  option: { scoring: 'Scoring', gate: 'The gate', both: 'Both' } satisfies Record<VolunteerJob, string>,
  /** Under the field: what the volunteer will be able to do — true after the save, not a promise. */
  hint: {
    scoring: 'They’ll enter scores. They won’t see check-in.',
    gate: 'They’ll check teams in. They won’t see or enter scores.',
    both: 'They’ll enter scores and check teams in.',
  } satisfies Record<VolunteerJob, string>,
  /** The invite's tail (anyone who may invite may change it later — P1). Manage leaves it off. */
  changeLater: 'Change it any time in Members.',
  /** Manage, for an old volunteer row that holds neither job (only a hand-made override could). */
  none: 'Choose…',
} as const;

/** The member route's refusals (P1, P2). */
export const VOLUNTEER_REFUSAL = {
  noJob: 'A volunteer needs at least one job. To end their access, remove them.',
  ownerOnly: 'Only the owner can change this member’s access.',
} as const;

/** What the role opens, said to the invitee (the accept page, the invitation card) once the job is known. */
export const VOLUNTEER_OPENS: Record<VolunteerJob, string> = {
  // Straight apostrophes, as every role's sentence beside it in `roleOpensSentence`.
  scoring: "You'd enter game scores on game day, from your phone.",
  gate: "You'd check teams in at the gate on game day, from your phone.",
  both: "You'd enter game scores and check teams in at the gate on game day, from your phone.",
};

/** The invitation email's note, by job (a new account), and the "added" email's (an existing one). */
export const VOLUNTEER_EMAIL_NOTE: Record<'invite' | 'added', Record<VolunteerJob, string>> = {
  invite: {
    scoring: 'You’ll enter game scores from your phone. Once your account is set up, it opens straight to today’s games.',
    gate: 'You’ll check teams in at the gate from your phone. Once your account is set up, it opens straight to Check-in.',
    both: 'You’ll enter game scores and check teams in at the gate, from your phone. Once your account is set up, it opens straight to today’s games, one tap from Check-in.',
  },
  added: {
    scoring: 'Sign in to enter game scores. You’ll land on today’s games.',
    gate: 'Sign in to check teams in at the gate. You’ll land on Check-in.',
    both: 'Sign in to enter game scores and check teams in. You’ll land on today’s games, one tap from Check-in.',
  },
};

/** Every invitation email's two buttons, for every role (one spelling, sentence case). */
export const INVITE_EMAIL_ACTION = { accept: 'Accept invitation', signIn: 'Sign in' } as const;

/** The scorekeeper's words (Stage 6 V1 + V2). The game-state chips are `GAME_STATE_WORD` (lib/game-day-words). */
export const SCOREKEEPER_WORDS = {
  title: 'Field scores',
  sheetHead: 'Enter the score',
  /** The one lime, by what it will do. */
  submit: { review: 'Submit for review', final: 'Finalize score', correction: 'Save correction' },
  /** The note directly above it, said before the press. */
  note: {
    review: 'The organizer reviews this score before it’s final.',
    final: 'This score is final as soon as you save it.',
    correction: 'This replaces the score that’s waiting for the organizer.',
  },
  /** The floating notice after a save — what happened, to which game ("Wolves 7, Royals 4"). */
  saved: { review: (score: string) => `Sent for review · ${score}`, final: (score: string) => `Final · ${score}` },
  /** When the organizer sends a score back while the screen is open (A32) — news the volunteer didn't cause. */
  sentBack: (game: string) => `Sent back to score again · ${game}`,
  /** What a tap on a card does. */
  cardAction: {
    review: 'Enter score for review',
    final: 'Enter final score',
    correct: 'Correct the score',
    locked: 'Final score locked',
    cancelled: 'Cancelled game',
  },
  emptyNoGames: 'Try another date, or ask the organizer.',
  bothRequired: 'Both scores are required.',
} as const;

/** The gate's words around Stage 1's board (Stage 6 V3). */
export const GATE_WORDS = {
  title: 'Check-in',
  finished: 'This tournament is finished, so check-in is closed. Ask the organizer if a team still needs checking in.',
  draft: 'This tournament is still a draft, so check-in hasn’t opened. Ask the organizer if teams are arriving.',
  noEvents: 'No tournaments to check in for right now.',
} as const;

/** The organizer's Staff kit and the page it prints for the volunteer table (Stage 6 V7). */
export const STAFF_KIT_WORDS = {
  title: 'Staff kit',
  intro: 'Hand these to your volunteers. Each one signs in with the email you invited and sees only their job.',
  noEvent: 'Select a tournament to hand out volunteer links.',
  card: {
    scorekeeper: { title: VOLUNTEER_DUTY.scoring, blurb: 'Enter game scores from any field.' },
    gate: { title: VOLUNTEER_DUTY.gate, blurb: 'Check teams in as they arrive.' },
  },
  copy: 'Copy link',
  copied: 'Copied',
  open: 'Open',
  invite: 'Invite a volunteer',
  print: 'Print',
  /** The printed page: "{Club} · Volunteers", the event and its dates, the codes, three steps, a footer. */
  printEyebrow: (club: string) => (club ? `${club} · Volunteers` : 'Volunteers'),
  steps: [
    'Scan the code for your job with your phone’s camera.',
    'Sign in with the email the organizer invited.',
    'That’s it — your screen opens on today’s games or teams.',
  ],
  printedOn: (date: string) => `Printed ${date}`,
} as const;

/** The shells' hop to the other job — the header's door above 640, and the wrong-job wall's door. */
export const VOLUNTEER_HOP = { toGate: 'Check-in →', toScoring: 'Scorekeeper →' } as const;

/** The wall a volunteer meets on the other job's screen (a gate volunteer scanning the scorekeeper's code). */
export const VOLUNTEER_WALL = {
  label: 'No access',
  scoring: 'Scoring isn’t one of your jobs here. Ask the organizer if you should be entering scores.',
  gate: 'Check-in isn’t one of your jobs here. Ask the organizer if you should be checking teams in.',
} as const;

/** What a volunteer can open, as Members' list says it ("What they can open", and the phone row's short form). */
export const VOLUNTEER_ACCESS: Record<VolunteerJob | 'none', { long: string; short: string }> = {
  scoring: { long: 'Scores', short: 'scores' },
  gate: { long: 'The gate', short: 'the gate' },
  both: { long: 'Scores and the gate', short: 'scores and the gate' },
  none: { long: 'Nothing yet', short: 'nothing yet' },
};
