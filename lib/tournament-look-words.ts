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
    listFailed: "Couldn't check your tournaments. Try again.",
  } as const;
}

/**
 * A tournament's Look card on its Branding page (the drawing's tab 3, ruled 2026-11-02), for a tournament with a club
 * layer. The cases: A follows the club (the pill chosen), B its own look, C the club's *Always*. Tournament Plus (D) has
 * no club and says `PLAIN_LOOK_LINE` when nothing is saved.
 */
export function tournamentLookCardWords(noun: LookNoun) {
  const o = OF[noun];
  return {
    /** The first choice, a real one: chosen when nothing is saved. Also the card's summary under A and C. */
    pill: `${o.The} look`,
    coloursPart: 'Colours',
    typePart: 'Type',
    /** "Type: **Serif**, the club's" — the face's name goes between. */
    typeLine: { lead: 'Type: ', tail: `, ${o.the}` },
    /** "… The club sets it on its [Public site]." — a link only for those who may open the editor. */
    follow: { lead: `Follows ${o.the} look and changes when ${o.the} does. The ${noun} sets it on its `, door: 'Public site', tail: '.' },
    lock: `The ${noun} uses its look on every tournament: colours and type.`,
    /** For those who may edit the club's look; absent (not greyed) for anyone else. */
    change: `Change ${o.the} look`,
  } as const;
}

/** Tournament Plus with nothing saved (case D): the plain look, which the chosen FieldLogicHQ swatch shows. */
export const PLAIN_LOOK_LINE = 'FieldLogicHQ, the plain look. Pick a colour to make it yours.';

/** The Look card's preview of the band (ask 3): its heading and the line under it. */
export const LOOK_PREVIEW_WORDS = {
  heading: 'On a phone',
  caption: 'The real band, as it reads now. The door above opens the whole page.',
  label: 'Preview of the band families see on a phone',
} as const;

/** A piece of the question's sentence: plain words, or a tournament's name (set in italics). */
export type QuestionPiece = string | { name: string };

/** At most this many tournaments are named; the rest are counted ("and 4 more"), so the window stays one sentence. */
const NAMED = 3;

/**
 * The question before *Always* (the drawing's tab 2, ruled 2026-11-02): one sentence naming up to three tournaments with
 * colours of their own (the list arrives on now first, then by start date), "(on now)" after one on today, "and N more",
 * and the finished ones counted, never named. null when no tournament has colours of its own: nothing to ask.
 */
export function tournamentLookQuestion(
  noun: LookNoun,
  list: { current: ReadonlyArray<{ name: string; live: boolean }>; finished: number },
) {
  const o = OF[noun];
  const { current, finished } = list;
  if (current.length === 0 && finished === 0) return null;

  const shown = current.slice(0, NAMED);
  const more = current.length - shown.length;
  const finishedCount = `${finished} finished tournament${finished === 1 ? '' : 's'}`;
  const change = ` will change to ${o.the} colours and type`;
  const pieces: QuestionPiece[] = [];
  shown.forEach((t, i) => {
    if (i > 0) pieces.push(i === shown.length - 1 && !more ? ' and ' : ', ');
    pieces.push({ name: t.name });
    if (t.live) pieces.push(' (on now)');
  });
  if (more) pieces.push(` and ${more} more`);
  if (shown.length) pieces.push(`${change}${finished ? `, along with ${finishedCount}` : ''}.`);
  else pieces.push(`${finishedCount}${change}.`);

  return {
    title: `Always use ${o.the} look?`,
    // Adjacent words joined, so the sentence is a few pieces rather than one per comma.
    sentence: pieces.reduce<QuestionPiece[]>((acc, p) => {
      const last = acc[acc.length - 1];
      if (typeof p === 'string' && typeof last === 'string') acc[acc.length - 1] = last + p;
      else acc.push(p);
      return acc;
    }, []),
    kept: 'Their own looks are kept.',
    notNow: 'Not now',
    confirm: `Use ${o.the} look`,
  };
}
