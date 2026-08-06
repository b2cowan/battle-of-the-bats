// ─────────────────────────────────────────────────────────────────────────────
// Ask the Front Office — THE QUESTION LIBRARY. Pure: no I/O, no React.
//
// One entry per question. The surface reads the library, so **the bar and the panel never change**
// when a question is added — they are fully generic over this registry.
//
// ⚠ **The ROUTE is not generic, and pretending otherwise is a trap.** The route fetches only what
// the asked question needs, via a handful of `if (question.id === …)` branches. A new question
// whose data no existing branch already loads NEEDS a new branch there. Miss that step and nothing
// shouts: the assemblers never throw on absent inputs (by design — they degrade to the honest empty
// state), so the unit tests still pass, the chip still renders, and every real request quietly
// answers "nothing recorded yet". If you add a question, add its fetch.
//
// The imperative dispatch is deliberate at this size: a declarative per-entry fetch spec would be
// real machinery (named dependencies, dedup, a resolver) bought for a library with a hard ceiling
// of eight — past which the answer is Phase B, not more chips.
//
// Every entry must declare all six of these, and the list is the discipline (ASK_FRONT_OFFICE_PLAN):
//   1. the chip a coach taps, in a coach's own words
//   2. who may ask it — which gates the chip AND is re-checked by the route
//   3. where the answer comes from, named specifically
//   4. the sentence, assembled from those records
//   5. the receipts, and which report they lead to
//   6. what it says when nothing is recorded, and what would fill it in
//
// ── The bar every question clears ────────────────────────────────────────────
// A coach would say this sentence to another coach, and every fact in it is provable one tap away
// in the receipts. Nothing here estimates, infers, projects, or compares to another team. A
// question that can only be answered by guessing does not go in the library — that line is the
// whole feature.
//
// ── Why the sentences are templates, not prose ───────────────────────────────
// The assemblers below look repetitive on purpose. Each branch is a claim the receipts can back;
// collapsing them into one clever formatter is how a sentence starts saying slightly more than the
// data knows. When Phase B lets a model choose WHICH question to run, these same assemblers still
// write the words — the model never authors a fact.
//
// Relative imports WITH the .ts extension so the unit tests run under plain `node --test`.
import type { CoachCapabilities } from './coach-capabilities.ts';
import { canViewMoney } from './coach-capabilities.ts';
import type { InsightReport } from './insight-findings.ts';
import { BENCH_MIN_GAMES, money, plural } from './insight-findings.ts';
import type { PositionRecency } from './coach-position-recency.ts';
import type { FamilyDuesRollup } from './coach-family-dues.ts';
import type { PracticeMissRanking } from './coach-practice-misses.ts';
import type { SeasonLineupAnalytics } from './lineup-season-analytics.ts';

/** Where a receipt leads. Reuses the Insights report vocabulary so both surfaces share one href
 *  map, plus the two destinations only a "what would fill this in" step needs. */
export type AskReport = InsightReport | 'schedule' | 'lineups';

export type AskQuestionId =
  | 'position_recency'
  | 'family_dues'
  | 'never_paid'
  | 'practice_misses'
  | 'playing_time'
  | 'arm_care';

export interface AskReceipt {
  /** The record itself. */
  text: string;
  /** Right-hand column — usually a date. Empty string renders as nothing. */
  meta: string;
  /** Present only on a "what would fill this in" step, never on a real receipt. */
  to?: AskReport;
}

export interface AskAnswer {
  questionId: AskQuestionId;
  /** The one sentence. Always present — an answer never renders blank. */
  sentence: string;
  /** Heading above the list. */
  receiptsLabel: string;
  receipts: AskReceipt[];
  report: AskReport;
  /** True when this is an honest "nothing recorded yet" rather than an answer about the team. */
  empty: boolean;
}

/** What an assembler returns. `questionId` and `report` are stamped on centrally from the registry
 *  entry, so a question can't declare one report on its chip and a different one on its answer. */
type AssembledAnswer = Omit<AskAnswer, 'questionId' | 'report'>;

export interface AskQuestionDef {
  id: AskQuestionId;
  /** The chip. */
  label: string;
  /** Where this answer's receipts lead. */
  report: AskReport;
  /** May this coach ask it at all? The chip is filtered by this AND the route re-checks it. */
  allows: (caps: CoachCapabilities) => boolean;
  /** Needs a position slot — the picker row opens under the chip. */
  needsPosition?: boolean;
  /** Only meaningful for a sport with a pitching role. */
  needsPitcher?: boolean;
}

/**
 * THE LIBRARY. Order is the order the chips appear in.
 *
 * ⚠ There is a practical ceiling of about eight. Past that the panel stops being a short list and
 * becomes a menu to read, which is a different interaction — and the signal that it is time for
 * the typed version rather than more chips.
 */
export const ASK_QUESTIONS: readonly AskQuestionDef[] = [
  {
    id: 'position_recency',
    label: "Who hasn't played a position lately?",
    report: 'playing-time',
    allows: caps => caps.lineups,
    needsPosition: true,
  },
  {
    id: 'family_dues',
    label: 'What does each family still owe?',
    report: 'money',
    allows: canViewMoney,
  },
  {
    id: 'never_paid',
    label: "Who hasn't paid anything yet?",
    report: 'money',
    allows: canViewMoney,
  },
  {
    id: 'practice_misses',
    label: "Who's missed the most practices?",
    // Keyed on the same grant the attendance route gates on — a second opinion here would let the
    // chip and the route disagree. ⚠ A1 (2026-08-03): both used to read roster visibility, because
    // the report lists players by name and names were grantable. They are baseline now, so both
    // moved to the duty the report is actually for.
    report: 'attendance',
    allows: caps => caps.attendance,
  },
  {
    id: 'playing_time',
    label: 'Is playing time even?',
    report: 'playing-time',
    allows: caps => caps.lineups,
  },
  {
    id: 'arm_care',
    label: 'Whose arm needs a rest?',
    report: 'playing-time',
    allows: caps => caps.lineups,
    needsPitcher: true,
  },
];

export const ASK_QUESTION_BY_ID = new Map(ASK_QUESTIONS.map(q => [q.id, q]));

/**
 * Where a report link goes, given the team's portal base path.
 *
 * ONE map, shared with the Insights findings strip (which had its own copy covering five of these
 * seven). Two maps over the same vocabulary is how a receipt and a finding end up pointing at
 * different pages for the same word.
 */
export function askReportHref(base: string, report: AskReport): string {
  switch (report) {
    case 'playing-time': return `${base}/history/playing-time`;
    case 'results':      return `${base}/history/results`;
    case 'attendance':   return `${base}/attendance`;
    case 'money':        return `${base}/accounting`;
    case 'development':  return `${base}/history/development`;
    case 'schedule':     return `${base}/schedule`;
    case 'lineups':      return `${base}/lineups`;
    // A new AskReport with no case here would otherwise return undefined and render href="undefined"
    // — a dead link — because tsconfig has no `noImplicitReturns` to catch the missing branch.
    // The team home is always a real page, so the worst case is a mildly wrong destination.
    default:             return base;
  }
}

/**
 * The chips THIS coach sees. A question they may not ask is absent — never greyed out, never an
 * error on tap. An empty result means the bar itself should not render: a door onto nothing is
 * worse than no door.
 */
export function visibleAskQuestions(
  caps: CoachCapabilities,
  opts: { hasPitcherPosition: boolean; hasFieldPositions: boolean },
): AskQuestionDef[] {
  return ASK_QUESTIONS.filter(q => {
    if (!q.allows(caps)) return false;
    if (q.needsPitcher && !opts.hasPitcherPosition) return false;
    if (q.needsPosition && !opts.hasFieldPositions) return false;
    return true;
  });
}

// ── Words ────────────────────────────────────────────────────────────────────

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "July 12" / "Jul 12" from a `YYYY-MM-DD` org-zone day.
 *
 * Formatted from the parts, never via `new Date(string).toLocaleDateString()`: production runs in
 * UTC and a coach's phone does not, and a receipt that says Jul 11 next to a game played Jul 12 is
 * the one thing a receipt may never do.
 */
export function formatDayWords(day: string, style: 'long' | 'short' = 'long'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day ?? '');
  if (!m) return day ?? '';
  const month = Number(m[2]) - 1;
  const names = style === 'long' ? MONTHS_LONG : MONTHS_SHORT;
  return `${names[month] ?? m[2]} ${Number(m[3])}`;
}

/**
 * A gap as a NOUN PHRASE: "today" / "yesterday" / "5 days" / "3 weeks". Weeks floor, so 20 days is
 * 2 weeks, not 3. Use where the sentence supplies its own preposition ("… 5 days ago").
 */
export function gapPhrase(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days`;
  const weeks = Math.floor(days / 7);
  return `${weeks} week${plural(weeks)}`;
}

/**
 * The same gap as a COMPLETE ADVERBIAL: "since yesterday" / "in 5 days" / "in 3 weeks".
 *
 * Exists because "in" doesn't fit every gap — `hasn't played catcher in ${gapPhrase(1)}` rendered
 * "hasn't played catcher in yesterday". The preposition has to vary with the phrase, so the phrase
 * owns it.
 */
export function sincePhrase(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'since yesterday';
  return `in ${gapPhrase(days)}`;
}

/** "Jordan" / "Jordan and Priya" / "Jordan, Priya and 2 others". */
function nameList(names: string[], max = 2): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length <= max) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const shown = names.slice(0, max);
  const rest = names.length - max;
  return `${shown.join(', ')} and ${rest} other${plural(rest)}`;
}

// ── The data each question reads ─────────────────────────────────────────────

/**
 * Everything the assemblers may read, all optional — the `FindingsInputs` shape, for the same
 * reason: a question whose data is absent produces its honest empty state rather than throwing,
 * so a partial fetch degrades one answer instead of the whole panel.
 */
export interface AskInputs {
  /** Lowercase plural period word from the Sport Pack ("innings"). */
  periodsWord: string;
  /** The position asked about, and its prose name — both from the Sport Pack. */
  position?: string | null;
  positionLabel?: string | null;
  positionRecency?: PositionRecency | null;
  family?: FamilyDuesRollup | null;
  neverPaid?: { names: string[]; outstanding: number; billedCount: number } | null;
  practices?: PracticeMissRanking | null;
  analytics?: SeasonLineupAnalytics | null;
  /** Prose name for the pitching role ("pitcher") — absent for a sport without one. */
  pitcherLabel?: string | null;
}

const RECEIPT_CAP = 6;

/**
 * The "nothing recorded yet" envelope, built once for all six questions.
 *
 * Unlike the answer sentences — which stay hand-written per question on purpose, because each one
 * is a distinct claim the receipts must back — this is the explicit NON-claim case and is one
 * uniform contract across the library (rule 6). Hand-copying its exact shape seven times was how a
 * future question would quietly ship with a missing next step or a stray `meta`.
 */
function nothingYet(sentence: string, next: { text: string; to: AskReport }): AssembledAnswer {
  return {
    empty: true,
    sentence,
    receiptsLabel: 'What would fill this in',
    receipts: [{ text: next.text, meta: '', to: next.to }],
  };
}

/**
 * Cap a receipt list **without ever dropping the record the sentence names.**
 *
 * ⚠ This is the feature's whole promise, and a plain `.slice(0, CAP)` broke it. The cited record is
 * usually the OLDEST relevant one — "Maya hasn't played catcher in 3 weeks" cites her last turn,
 * and every later appearance by a teammate sorts ahead of it — so on any position with six or more
 * appearances since, the sentence named a game whose receipt had been sliced off. A coach reading
 * "the last time was July 12" and finding no July 12 row would be right to stop trusting the box.
 *
 * `pinned` comes first in the list, then the highest-priority remainder, and the caller re-sorts
 * for display.
 */
function pinnedReceipts<T>(
  /** Candidates in PRIORITY order — what to keep when the cap bites. */
  all: readonly T[],
  isPinned: (item: T) => boolean,
  toReceipt: (item: T) => AskReceipt,
  /** How the kept rows are ORDERED for reading. Distinct from priority: pinning decides what
   *  survives the cap, this decides where it sits, so the list still scans in one direction. */
  displaySort: (a: T, b: T) => number,
): AskReceipt[] {
  const pinned = all.filter(isPinned);
  const rest = all.filter(item => !isPinned(item));
  return [...pinned, ...rest]
    .slice(0, Math.max(RECEIPT_CAP, pinned.length))
    .sort(displaySort)
    .map(toReceipt);
}

// ── The assemblers ───────────────────────────────────────────────────────────

function answerPositionRecency(inp: AskInputs): AssembledAnswer {
  const label = inp.positionLabel || inp.position || 'that position';
  const r = inp.positionRecency;

  if (!r || r.players.length === 0) {
    return nothingYet(
      `Nobody has been written in at ${label} in a saved lineup this season.`,
      { text: `Save a game lineup with someone at ${label}`, to: 'lineups' },
    );
  }

  const receiptsLabel = 'Receipts — from your saved lineups';
  const toReceipt = (a: (typeof r.appearances)[number]): AskReceipt => ({
    text: `${a.label} — ${a.name} at ${label}, ${a.innings} ${inp.periodsWord}`,
    meta: formatDayWords(a.day, 'short'),
  });
  const plainReceipts = r.appearances.slice(0, RECEIPT_CAP).map(toReceipt);

  const stalest = r.players[0];

  // Only one player has ever been there — a coverage fact, said as one.
  if (r.players.length === 1) {
    return {
      empty: false, receiptsLabel, receipts: plainReceipts,
      sentence: `Only ${stalest.name} has played ${label} this season — ${r.gamesCovered} game${plural(r.gamesCovered)}, most recently ${formatDayWords(stalest.lastDay)}.`,
    };
  }

  // Nobody is waiting: the longest gap is today, so "hasn't played" would be false.
  if (stalest.daysSince <= 0) {
    return {
      empty: false, receiptsLabel, receipts: plainReceipts,
      sentence: `Everyone who has played ${label} played there today — ${nameList(r.players.map(p => p.name))}.`,
    };
  }

  const covered = r.coveredSince.length > 0
    ? ` ${nameList(r.coveredSince)} ${r.coveredSince.length === 1 ? 'has' : 'have'} covered it since.`
    : '';
  const lastGame = r.appearances.find(a => a.playerId === stalest.playerId && a.day === stalest.lastDay);
  const where = lastGame ? ` ${lastGame.label}` : '';

  return {
    empty: false, receiptsLabel,
    // The named player's own last turn is pinned — it is the fact the sentence rests on — but the
    // list still reads most-recent-first like every other receipt list.
    receipts: pinnedReceipts(r.appearances, a => a === lastGame, toReceipt,
      (x, y) => y.day.localeCompare(x.day)),
    sentence: `${stalest.name} hasn't played ${label} ${sincePhrase(stalest.daysSince)} — the last time was ${formatDayWords(stalest.lastDay)}${where}.${covered}`,
  };
}

function answerFamilyDues(inp: AskInputs): AssembledAnswer {
  const f = inp.family;

  if (!f || f.familyCount === 0) {
    return nothingYet(
      'No dues plans have been set up yet this season, so there is nothing owing to report.',
      { text: 'Set up dues for your players in Money', to: 'money' },
    );
  }

  if (f.owing.length === 0) {
    return {
      empty: false,
      sentence: `Every family with a dues plan is paid up — all ${f.familyCount} of them.`,
      receiptsLabel: 'Receipts — from your dues ledger',
      receipts: [{ text: `${f.familyCount} famil${f.familyCount === 1 ? 'y' : 'ies'} fully paid`, meta: '—' }],
    };
  }

  // Name the two biggest in the sentence; the rest are a count, and all of them are receipts.
  const clause = (g: FamilyDuesRollup['owing'][number]) => {
    const verb = g.labelledByPlayer ? 'owes' : 'owe';
    const next = g.unpaid[0];
    const detail = next
      ? ` (installment ${next.index} of ${next.total}, due ${formatDayWords(next.dueDate)})`
      : '';
    return `${g.label} ${verb} ${money(g.outstanding)}${detail}`;
  };
  const namedFamilies = f.owing.slice(0, 2);
  const named = namedFamilies.map(clause);
  const rest = f.owing.length - named.length;
  const tail = rest > 0 ? `${named.join(', ')}, and ${rest} other famil${rest === 1 ? 'y' : 'ies'}` : named.join(' and ');

  // The installment each NAMED family's clause quotes is pinned. Without this, one family with six
  // or more unpaid installments filled the whole list and the second family the sentence named had
  // no receipt at all.
  const cited = new Set(namedFamilies.map(g => g.unpaid[0]).filter(Boolean));
  const receipts: AskReceipt[] = pinnedReceipts(
    f.owing.flatMap(g => g.unpaid.map(u => ({ g, u }))),
    ({ u }) => cited.has(u),
    ({ g, u }) => ({
      text: `${g.receiptLabel} — installment ${u.index} of ${u.total}, ${money(u.amount)}`,
      meta: `${u.overdue ? 'overdue ' : 'due '}${formatDayWords(u.dueDate, 'short')}`,
    }),
    (x, y) => x.u.dueDate.localeCompare(y.u.dueDate),
  );
  if (f.paidUpCount > 0 && receipts.length < RECEIPT_CAP) {
    receipts.push({ text: `${f.paidUpCount} of ${f.familyCount} families fully paid`, meta: '—' });
  }

  return {
    empty: false, receipts,
    receiptsLabel: 'Receipts — from your dues ledger',
    sentence: `${f.owing.length} famil${f.owing.length === 1 ? 'y' : 'ies'} still owe${f.owing.length === 1 ? 's' : ''} a combined ${money(f.totalOutstanding)}: ${tail}.`,
  };
}

function answerNeverPaid(inp: AskInputs): AssembledAnswer {
  const n = inp.neverPaid;

  if (!n || n.billedCount === 0) {
    return nothingYet(
      'No dues plans have been set up yet this season, so nobody is behind.',
      { text: 'Set up dues for your players in Money', to: 'money' },
    );
  }

  if (n.names.length === 0) {
    return {
      empty: false,
      sentence: `Every player with a dues plan has paid something — all ${n.billedCount} of them.`,
      receiptsLabel: 'Receipts — from your dues ledger',
      receipts: [{ text: `${n.billedCount} player${plural(n.billedCount)} with at least one payment recorded`, meta: '—' }],
    };
  }

  const count = n.names.length;
  return {
    empty: false,
    sentence: `${count} player${plural(count)} ha${count === 1 ? 's' : 've'}n't paid anything yet` +
      (n.outstanding > 0 ? ` — ${money(n.outstanding)} outstanding between them.` : '.'),
    receiptsLabel: 'Receipts — from your dues ledger',
    receipts: n.names.slice(0, RECEIPT_CAP).map(name => ({ text: name, meta: 'nothing recorded' })),
  };
}

function answerPracticeMisses(inp: AskInputs): AssembledAnswer {
  const p = inp.practices;

  if (!p || p.windowPractices === 0) {
    return nothingYet(
      'No attendance has been taken at a practice yet this season, so there is nothing to compare.',
      { text: 'Take attendance at one practice', to: 'schedule' },
    );
  }

  const leader = p.rows[0];
  const receiptsLabel = 'Receipts — from your attendance records';

  if (!leader || leader.missed === 0) {
    return {
      empty: false, receiptsLabel,
      sentence: `Nobody has missed a practice in the last ${p.windowPractices} — full attendance across the stretch.`,
      receipts: [{ text: `${p.windowPractices} practice${plural(p.windowPractices)} tracked`, meta: p.windowFrom ? `since ${formatDayWords(p.windowFrom, 'short')}` : '' }],
    };
  }

  const receipts: AskReceipt[] = leader.absences.slice(0, RECEIPT_CAP).map(a => ({
    text: `${a.label} — ${leader.name} absent`,
    meta: formatDayWords(a.day, 'short'),
  }));

  // Too few tracked sessions to call it a pattern — say so instead of implying one.
  if (!p.reliable) {
    return {
      empty: false, receiptsLabel, receipts,
      sentence: `${leader.name} has missed ${leader.missed} of the ${leader.known} practice${plural(leader.known)} they were marked for — too few tracked so far to call it a pattern.`,
    };
  }

  // A player marked for fewer sessions than the window gets their OWN denominator.
  const denom = leader.known < p.windowPractices
    ? `the ${leader.known} practice${plural(leader.known)} they were marked for`
    : `the last ${p.windowPractices} practices`;
  const weekday = leader.sameWeekday ? ` — all ${leader.sameWeekday}s` : '';
  const runnerUp = p.rows[1];
  const others = runnerUp
    ? ` Everyone else has missed ${runnerUp.missed} or fewer in the same stretch.`
    : '';

  return {
    empty: false, receiptsLabel, receipts,
    sentence: `${leader.name} has missed ${leader.missed} of ${denom}${weekday}.${others}`,
  };
}

function answerPlayingTime(inp: AskInputs): AssembledAnswer {
  const a = inp.analytics;

  if (!a || a.gamesWithLineup === 0) {
    return nothingYet(
      'No lineups have been saved yet this season, so playing time has nothing to measure.',
      { text: 'Save a lineup for one game', to: 'lineups' },
    );
  }
  if (a.gamesWithLineup < BENCH_MIN_GAMES) {
    return nothingYet(
      `Only ${a.gamesWithLineup} lineup${plural(a.gamesWithLineup)} saved so far — not enough to say whether playing time is even.`,
      { text: `Save ${BENCH_MIN_GAMES - a.gamesWithLineup} more lineup${plural(BENCH_MIN_GAMES - a.gamesWithLineup)}`, to: 'lineups' },
    );
  }

  const receiptsLabel = 'Receipts — from your saved lineups';
  const top = a.benchBalance[0];
  // Least field time first — the fairness order. The player the sentence names is PINNED, because
  // most bench time doesn't always mean least field time (a mid-season joiner plays fewer games of
  // both), so the named player could otherwise fall outside the cap and leave the claim unbacked.
  const receipts: AskReceipt[] = pinnedReceipts(
    [...a.fairPlay].sort((x, y) => x.fieldInnings - y.fieldInnings || x.name.localeCompare(y.name)),
    f => !!top && f.playerId === top.playerId,
    f => ({
      text: `${f.name} — ${f.fieldInnings} on field, ${f.benchInnings} on the bench`,
      meta: `${f.games} game${plural(f.games)}`,
    }),
    (x, y) => x.fieldInnings - y.fieldInnings || x.name.localeCompare(y.name),
  );
  if (!top) {
    return {
      empty: false, receiptsLabel, receipts,
      sentence: `Nobody has sat out in ${a.gamesWithLineup} saved lineups — everyone has been on the field the whole way.`,
    };
  }
  const gap = top.benchInnings - (a.benchBalance[1]?.benchInnings ?? 0);
  const b2b = top.backToBackGames > 0
    ? ` ${top.backToBackGames} of those were back-to-back games on the bench.`
    : '';

  if (gap <= 2) {
    return {
      empty: false, receiptsLabel, receipts,
      sentence: `Playing time is close — the most bench time anyone has is ${top.benchInnings} ${inp.periodsWord} (${top.name}), only ${gap} more than the next player.`,
    };
  }
  return {
    empty: false, receiptsLabel, receipts,
    sentence: `${top.name} has sat the most — ${top.benchInnings} ${inp.periodsWord} on the bench, ${gap} more than anyone else.${b2b}`,
  };
}

function answerArmCare(inp: AskInputs): AssembledAnswer {
  const rows = inp.analytics?.armCare ?? [];
  const label = inp.pitcherLabel || 'pitcher';

  if (rows.length === 0) {
    return nothingYet(
      `No saved lineup has anyone at ${label} yet this season.`,
      { text: 'Save a lineup with a pitching assignment', to: 'lineups' },
    );
  }

  const receiptsLabel = 'Receipts — from your saved lineups and your own caps';
  // Safety first: a cap the coach set themselves, exceeded.
  const over = [...rows].filter(r => r.overCapGames > 0).sort((a, b) => b.overCapGames - a.overCapGames);
  // Heaviest workload first, but whoever the sentence names is PINNED — a pitcher who went over
  // their cap in one short outing has few total innings, so they'd sort last and could be described
  // by the sentence while missing from the evidence under it.
  const cited = over[0] ?? [...rows].sort((a, b) => b.inningsPitched - a.inningsPitched)[0];
  const receipts: AskReceipt[] = pinnedReceipts(
    [...rows].sort((a, b) => b.inningsPitched - a.inningsPitched || a.name.localeCompare(b.name)),
    r => !!cited && r.playerId === cited.playerId,
    r => ({
      text: `${r.name} — ${r.inningsPitched} ${inp.periodsWord} across ${r.gamesPitched} game${plural(r.gamesPitched)}` +
        (r.perGameCap != null ? `, your cap ${r.perGameCap}/game` : ''),
      meta: r.overCapGames > 0 ? `${r.overCapGames} over cap` : '',
    }),
    (x, y) => y.inningsPitched - x.inningsPitched || x.name.localeCompare(y.name),
  );
  if (over.length > 0) {
    const o = over[0];
    const more = over.length > 1 ? ` ${over.length - 1} other${plural(over.length - 1)} went over too.` : '';
    return {
      empty: false, receiptsLabel, receipts,
      sentence: `${o.name} went over the per-game cap you set in ${o.overCapGames} game${plural(o.overCapGames)} — ${o.inningsPitched} ${inp.periodsWord} across ${o.gamesPitched} game${plural(o.gamesPitched)} this season.${more}`,
    };
  }

  // Nobody over a cap: the most recent outing is the honest "worth a look" fact, when we have it.
  const recent = inp.positionRecency && inp.positionRecency.position === inp.position
    ? inp.positionRecency.players.slice().sort((a, b) => a.daysSince - b.daysSince)[0]
    : null;
  const heaviest = [...rows].sort((a, b) => b.inningsPitched - a.inningsPitched)[0];
  const recentClause = recent
    ? ` ${recent.name} threw most recently — ${recent.lastInnings} ${inp.periodsWord} ${recent.daysSince <= 0 ? 'today' : `${gapPhrase(recent.daysSince)} ago`}.`
    : '';

  return {
    empty: false, receiptsLabel, receipts,
    sentence: `Nobody has gone over the per-game cap you set. ${heaviest.name} has thrown the most this season — ${heaviest.inningsPitched} ${inp.periodsWord} across ${heaviest.gamesPitched} game${plural(heaviest.gamesPitched)}.${recentClause}`,
  };
}

/**
 * Assemble the answer to one question. Never throws on missing data and never returns a blank
 * sentence: an absent source produces that question's empty state, which names what would fill it.
 */
export function assembleAskAnswer(id: AskQuestionId, inputs: AskInputs): AskAnswer {
  const assemble = (): AssembledAnswer => {
    switch (id) {
      case 'position_recency': return answerPositionRecency(inputs);
      case 'family_dues':      return answerFamilyDues(inputs);
      case 'never_paid':       return answerNeverPaid(inputs);
      case 'practice_misses':  return answerPracticeMisses(inputs);
      case 'playing_time':     return answerPlayingTime(inputs);
      case 'arm_care':         return answerArmCare(inputs);
    }
  };
  // The registry is the single source of both fields, so a question's chip and its answer can
  // never claim different reports — the assemblers no longer restate either one.
  return { questionId: id, report: ASK_QUESTION_BY_ID.get(id)!.report, ...assemble() };
}
