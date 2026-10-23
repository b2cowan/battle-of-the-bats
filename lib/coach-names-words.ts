/**
 * lib/coach-names-words.ts — EVERY WORD OF "THE CLUB DECIDES WHO IS LISTED AS A COACH" (mig 352). Written by /marketing
 * 2026-10-23 — docs/projects/active/COACH_NAMES_CLUB_POLICY_COPY.md, which this mirrors. One home: the club's row, its two
 * windows, the admin's plain facts and the coach's five states never spell a thing twice. "Listed" / "not listed" and nothing
 * else. The notice's words are `lib/coach-names-notice.ts`'s.
 *
 * ⚠ The apostrophes are straight on the club's side (the Public site editor's words file does the same) and CURLY on the
 * coach's side (the Team settings door's neighbours are curly).
 */
import type { CoachNamesPolicy } from './coach-names-policy';

export const COACH_NAMES_WORDS = {
  rowTitle: 'Coaches on team pages',
  lead: "Who is listed under Coaches on each team's public page. It is the same for every team. A listing shows a name and a role, never an email address, a phone number or a player.",
  hint: "A coach with no name on file is left out. Names show only while the team has a live season. The same choice decides whether a team's tryout page names its head coach.",
  groupLabel: 'Who is listed under Coaches',
  ownerSentence: 'The owner chooses who is listed.',
  listedLabel: 'Listed',
  chooseLabel: 'Choose for themselves',
  notNow: 'Not now',
  listThem: 'List them',
  saveFailed: "Couldn't save your changes. Try again.",
} as const;

/** The four choices, in the order the row lists them: its name (also the closed summary) and the line under it. */
export const COACH_NAMES_CHOICES: ReadonlyArray<{ value: CoachNamesPolicy; name: string; sub: string }> = [
  { value: 'coaches_choose', name: 'Coaches choose', sub: 'Each coach decides whether their own name shows. Everyone starts not listed.' },
  { value: 'heads_always', name: 'Head coaches always', sub: 'Every head coach is listed. Assistant coaches and other staff choose for themselves.' },
  { value: 'heads_and_assistants_always', name: 'Head and assistant coaches always', sub: 'Every head coach and assistant coach is listed. Team managers, treasurers and helpers choose for themselves.' },
  { value: 'none', name: 'No coach names', sub: 'Nobody is listed, whatever a coach has chosen. Their choices are kept and apply again if you change this.' },
];

export function coachNamesChoiceName(policy: CoachNamesPolicy): string {
  return COACH_NAMES_CHOICES.find(c => c.value === policy)?.name ?? COACH_NAMES_CHOICES[0].name;
}

/** What an admin who is not the owner reads: who is listed, and who still chooses for themselves (null = no second fact). */
export function coachNamesAdminFacts(policy: CoachNamesPolicy): { listed: string; choose: string | null } {
  switch (policy) {
    case 'heads_always': return { listed: 'Every head coach', choose: 'Assistant coaches and other staff' };
    case 'heads_and_assistants_always': return { listed: 'Every head coach and assistant coach', choose: 'Team managers, treasurers and helpers' };
    case 'none': return { listed: 'No one', choose: null };
    default: return { listed: 'Coaches who switch their own name on', choose: null };
  }
}

// ── The two windows that ask first ───────────────────────────────────────────────────────────────────────────────

export interface NewlyListedCounts { people: number; heads: number; assistants: number; teams: number }

const noun = (n: number, one: string, many: string) => (n === 1 ? one : many);
const coaches = (n: number, role: string) => `${n} ${role} ${noun(n, 'coach', 'coaches')}`;

/**
 * The ask-first window for an "always" choice, from the REAL counts of people it newly lists; null when it has nothing to
 * ask (a choice that only takes names away or hands the choice back, or one that newly lists no one — it saves at once).
 * The title follows who is actually being listed: heads alone, assistants alone (going from Head coaches always to Head and
 * assistant coaches always), or both.
 */
export function coachNamesWindow(candidate: CoachNamesPolicy, n: NewlyListedCounts): { title: string; body: string } | null {
  if (candidate !== 'heads_always' && candidate !== 'heads_and_assistants_always') return null;
  const heads = n.heads;
  const assistants = candidate === 'heads_and_assistants_always' ? n.assistants : 0;
  if (heads + assistants === 0) return null;
  const teams = `${n.teams} ${noun(n.teams, 'team', 'teams')}`;
  const where = n.teams === 1 ? "their team's public page" : "their teams' public pages";
  const tail = 'with their name and role. Each one gets a notice and can read it in Team settings.';
  let who: string;
  let title: string;
  if (heads > 0 && assistants > 0) {
    who = `${coaches(heads, 'head')} and ${coaches(assistants, 'assistant')}, on ${teams},`;
    title = 'List head and assistant coaches on team pages?';
  } else if (heads > 0) {
    who = `${coaches(heads, 'head')} on ${teams}`;
    title = 'List every head coach on team pages?';
  } else {
    who = `${coaches(assistants, 'assistant')} on ${teams}`;
    title = 'List assistant coaches on team pages?';
  }
  return { title, body: `${who} will be listed under Coaches on ${where}, ${tail}` };
}

// ── The coach's row in Team settings (five states) ───────────────────────────────────────────────────────────────

export interface CoachNameRowWords {
  /** The sentence under the label. */
  description: string;
  /** The plain text that replaces the switch where the club has decided; null where the switch stays. */
  controlText: string | null;
}

/** The coach's row, from what the SERVER computed (the client never decides who is listed). */
export function coachNameRowWords(p: { policy: CoachNamesPolicy; ownSwitchApplies: boolean; listedByClub: boolean }): CoachNameRowWords {
  if (!p.ownSwitchApplies) {
    if (!p.listedByClub) return { description: 'Your club isn’t listing coach names on public pages.', controlText: 'Not listed by your club' };
    return {
      description: p.policy === 'heads_always'
        ? 'Your club lists every head coach, with your name and role. Nothing else.'
        : 'Your club lists every head coach and assistant coach, with your name and role. Nothing else.',
      controlText: 'Listed by your club',
    };
  }
  if (p.policy === 'heads_always') {
    return { description: 'Your club lists every head coach. For other staff it’s your choice. Your name and role only.', controlText: null };
  }
  if (p.policy === 'heads_and_assistants_always') {
    return { description: 'Your club lists every head coach and assistant coach. For other staff it’s your choice. Your name and role only.', controlText: null };
  }
  return { description: 'Your name and role only.', controlText: null };
}
