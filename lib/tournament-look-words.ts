/**
 * lib/tournament-look-words.ts — EVERY WORD OF "WHO OWNS A TOURNAMENT'S LOOK" (Public tournament pages, Stage 1a; the
 * drawing's words, ruled 2026-11-02: docs/projects/active/PUBLIC_TOURNAMENT_STAGE1A_DRAWINGS.html). One home: the club's
 * Tournaments part, its question and the Branding page's Look card never spell a thing twice.
 *
 * The noun follows the plan, as the Public site editor's own words do (`public-site/page.tsx`): a club plan says "club",
 * League Plus says "league". Apostrophes are straight (the club editor's words file does the same).
 */
import type { TournamentLookPolicy } from './tournament-look';

export type LookNoun = 'club' | 'league';

/** The possessive, written out (never built on a noun — the possessive guard). */
const OF: Record<LookNoun, { the: string; The: string }> = {
  club: { the: "the club's", The: "The club's" },
  league: { the: "the league's", The: "The league's" },
};

/** The two choices, in the order the part lists them: the name and the line under it. */
export function tournamentLookChoices(noun: LookNoun): ReadonlyArray<{ value: TournamentLookPolicy; name: string; sub: string }> {
  const o = OF[noun];
  return [
    {
      value: 'club_default',
      name: `${o.The} look, unless a tournament chooses its own`,
      sub: `New tournaments wear ${o.the} colours and type. Whoever runs one can give it its own.`,
    },
    {
      value: 'always_club',
      name: `Always ${o.the} look`,
      sub: `Every tournament wears ${o.the} colours and type. Each keeps its own logo.`,
    },
  ];
}

export function tournamentLookWords(noun: LookNoun) {
  return {
    partTitle: 'Tournaments',
    hint: `Every tournament page says it is hosted by the ${noun}.`,
    /** Appended to the Look row's summary. */
    summary: { club_default: 'tournaments follow', always_club: 'every tournament' } satisfies Record<TournamentLookPolicy, string>,
  } as const;
}
