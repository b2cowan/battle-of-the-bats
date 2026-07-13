// ─────────────────────────────────────────────────────────────────────────────
// Insight findings engine — the "What stands out" strip on the coach Insights
// dashboard. PURE (no I/O): takes already-fetched, already-shaped summaries and
// returns a ranked, capped list of plain-language findings.
//
// Binding rules (plan: COACH_LINEUPS_IA_AND_INSIGHTS_HUB_PLAN.md, Phase 2b):
//  • Rules are a REGISTRY — new features ship new rules, never new UI. A rule
//    whose input data is absent simply never fires (forward compatibility +
//    data honesty: no invented text, no zeros-as-content).
//  • Ordering is a HARDCODED priority ladder — safety → money → attendance →
//    fairness → good news — never a scoring model. New categories get an
//    explicit ladder slot.
//  • Capped at MAX_FINDINGS; more rules make the triage smarter, not the page
//    longer.
//  • Admission test: every sentence must be something a coach would say to
//    another coach, and must be verifiable one tap away in its linked report.
//  • WITHIN-season only — never a cross-season comparison (owner 2026-07-09:
//    youth seasons aren't comparable across years).
//  • Vocabulary routes through the Sport Pack (no hard-coded "innings").
// ─────────────────────────────────────────────────────────────────────────────
import type { SeasonLineupAnalytics } from './lineup-season-analytics';
// Relative WITH .ts extension so `node --test` can resolve it (allowImportingTsExtensions;
// same convention as lineup-season-analytics.ts → lineup-analysis.ts).
import { isNeverPaidPlayer } from './dues-status.ts';

export type InsightTier = 'safety' | 'money' | 'attendance' | 'fairness' | 'good-news';
export type InsightTone = 'warn' | 'info' | 'good';
/** Which report the finding links to (the page maps these to hrefs). */
export type InsightReport = 'playing-time' | 'results' | 'attendance' | 'money';

export interface InsightFinding {
  tier: InsightTier;
  tone: InsightTone;
  text: string;
  report: InsightReport;
}

/** Season game facts, already scoped to the coach's record categories. */
export interface FindingsGameSummary {
  wins: number;
  losses: number;
  ties: number;
  /** Current streak (most recent backwards). */
  streakType: 'win' | 'loss' | 'tie' | null;
  streakCount: number;
  /** Home/away split over finalized games with a known side; null when unknown. */
  home: { wins: number; losses: number; ties: number; games: number } | null;
  awayLosses: number;
  /** Results most-recent-first (up to ~10) — feeds momentum/milestone rules. */
  recentResults?: ('win' | 'loss' | 'tie')[];
}

export interface FindingsAttendanceRow {
  name: string;
  /** Per category; "known" excludes no-reply (upstream semantics). */
  games: { attended: number; known: number };
  practices: { attended: number; known: number };
}

export interface FindingsDuesSummary {
  neverPaidCount: number;
  /** Whole-team outstanding dollars (rounded upstream). */
  outstandingTotal: number;
  overdueCount: number;
  /** The nearest UPCOMING unpaid installment date, when one exists. `unpaidTotal` may be
   *  null when installment amounts aren't available — the sentence then omits the figure. */
  nextDue?: { dueDateISO: string; unpaidCount: number; unpaidTotal: number | null } | null;
}

/** Sport-pack words the sentences need (pass from getSportPack, don't import here). */
export interface FindingsVocab {
  /** e.g. "innings" / "quarters" (lowercase plural period word). */
  periodsWord: string;
  /** e.g. "run" / "point" (lowercase singular score unit). */
  scoreUnitWord: string;
}

export interface FindingsInputs {
  vocab: FindingsVocab;
  analytics?: SeasonLineupAnalytics | null;
  games?: FindingsGameSummary | null;
  attendance?: FindingsAttendanceRow[] | null;
  dues?: FindingsDuesSummary | null;
  /** "Today" as YYYY-MM-DD — passed in (never Date.now() here) so the engine stays pure
   *  and deterministic in tests. Only the dues-deadline rule reads it. */
  todayISO?: string;
}

export const MAX_FINDINGS = 6;

// Conservative thresholds — reuse the spirit of already-vetted product rules;
// a finding that fires on thin data erodes trust in the whole strip. The two
// attendance thresholds are EXPORTED so every surface (band, tiles, findings)
// judges reliability by the same bar and can never disagree.
export const ATTENDANCE_MIN_KNOWN = 4;      // don't judge reliability on <4 tracked sessions
export const ATTENDANCE_FLAG_BELOW = 0.6;   // flag under 60% of tracked sessions
const BENCH_MIN_GAMES = 3;           // fairness needs ≥3 saved lineups to mean anything
const BENCH_MIN_INNINGS = 6;         // and a real amount of bench time
const STREAK_MIN = 3;                // "won N straight" only from 3 up
const ROAD_SPLIT_MIN_LOSSES = 2;     // home/away story needs ≥2 losses, all away…
const ROAD_SPLIT_MIN_HOME_GAMES = 3; // …and a real home sample
const DUE_SOON_DAYS = 7;             // dues-deadline rule fires within a week of the due date
const SPLIT_GAP_PTS = 20;            // game-vs-practice split: gap ≥ 20 points…
const SPLIT_FLOOR = 0.7;             // …and the lagging category under 70%
const COVERAGE_MIN_PLAYERS = 6;      // coverage risk needs a real roster in the lineup data
const MOMENTUM_WINDOW = 6;           // "won 5 of your last 6"
const MOMENTUM_MIN_WINS = 5;
const MILESTONE_EVERY = 5;           // celebrate win #10, #15, #20…
const MILESTONE_MIN = 10;

const TIER_ORDER: InsightTier[] = ['safety', 'money', 'attendance', 'fairness', 'good-news'];

function plural(n: number, word = 's'): string {
  return n === 1 ? '' : word;
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-CA')}`;
}

function daysBetweenISO(fromISO: string, toISO: string): number | null {
  const a = new Date(`${fromISO}T00:00:00`);
  const b = new Date(`${toISO}T00:00:00`);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function weekdayOf(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-CA', { weekday: 'long' });
}

export function computeInsightFindings(inputs: FindingsInputs): InsightFinding[] {
  const out: InsightFinding[] = [];
  const { analytics, games, attendance, dues, vocab } = inputs;

  // ── SAFETY — pitchers over their arm-care cap (max 2 named) ──
  if (analytics && analytics.gamesWithLineup > 0) {
    const over = analytics.armCare.filter(r => r.overCapGames > 0).slice(0, 2);
    for (const r of over) {
      out.push({
        tier: 'safety',
        tone: 'warn',
        report: 'playing-time',
        text: `${r.name} went over the pitching cap in ${r.overCapGames} game${plural(r.overCapGames)}` +
          (r.perGameCap != null ? ` (${r.inningsPitched} ${vocab.periodsWord} pitched vs a cap of ${r.perGameCap}/game).` : '.'),
      });
    }
  }

  // ── MONEY — deadline proximity first (time-sensitive), then who hasn't paid ──
  if (dues) {
    const nd = dues.nextDue;
    if (nd && nd.unpaidCount > 0 && inputs.todayISO) {
      const days = daysBetweenISO(inputs.todayISO, nd.dueDateISO);
      if (days != null && days >= 0 && days <= DUE_SOON_DAYS) {
        const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : days === 7 ? 'in a week' : `on ${weekdayOf(nd.dueDateISO)}`;
        out.push({
          tier: 'money',
          tone: 'warn',
          report: 'money',
          text: `Next dues installment is due ${when} — ${nd.unpaidCount} player${plural(nd.unpaidCount)} unpaid` +
            (nd.unpaidTotal != null && nd.unpaidTotal > 0 ? ` (${money(nd.unpaidTotal)}).` : '.'),
        });
      }
    }
    if (dues.neverPaidCount > 0) {
      out.push({
        tier: 'money',
        tone: 'warn',
        report: 'money',
        text: `${dues.neverPaidCount} player${plural(dues.neverPaidCount)} ha${dues.neverPaidCount === 1 ? 's' : 've'}n't paid anything yet` +
          (dues.outstandingTotal > 0 ? ` — ${money(dues.outstandingTotal)} outstanding across the team.` : '.'),
      });
    } else if (dues.overdueCount > 0) {
      out.push({
        tier: 'money',
        tone: 'warn',
        report: 'money',
        text: `${dues.overdueCount} dues installment${plural(dues.overdueCount)} ${dues.overdueCount === 1 ? 'is' : 'are'} overdue.`,
      });
    }
  }

  // ── ATTENDANCE — the least-reliable tracked player (never judges 0/0) ──
  if (attendance && attendance.length > 0) {
    const tracked = attendance
      .map(r => ({ name: r.name, attended: r.games.attended + r.practices.attended, known: r.games.known + r.practices.known }))
      .filter(r => r.known >= ATTENDANCE_MIN_KNOWN)
      .map(r => ({ ...r, ratio: r.attended / r.known }))
      .sort((a, b) => a.ratio - b.ratio);
    const worst = tracked[0];
    if (worst && worst.ratio < ATTENDANCE_FLAG_BELOW) {
      out.push({
        tier: 'attendance',
        tone: 'warn',
        report: 'attendance',
        text: `${worst.name} has made ${worst.attended} of ${worst.known} tracked sessions this season.`,
      });
    }

    // Game-vs-practice split — the team shows up for one but not the other.
    const t = attendance.reduce(
      (acc, r) => ({
        g: { attended: acc.g.attended + r.games.attended, known: acc.g.known + r.games.known },
        p: { attended: acc.p.attended + r.practices.attended, known: acc.p.known + r.practices.known },
      }),
      { g: { attended: 0, known: 0 }, p: { attended: 0, known: 0 } },
    );
    if (t.g.known >= ATTENDANCE_MIN_KNOWN && t.p.known >= ATTENDANCE_MIN_KNOWN) {
      const gPct = t.g.attended / t.g.known;
      const pPct = t.p.attended / t.p.known;
      if (Math.abs(gPct - pPct) >= SPLIT_GAP_PTS / 100 && Math.min(gPct, pPct) < SPLIT_FLOOR) {
        const gameHigher = gPct >= pPct;
        out.push({
          tier: 'attendance',
          tone: 'warn',
          report: 'attendance',
          text: gameHigher
            ? `Game attendance is ${Math.round(gPct * 100)}%, but practices are at ${Math.round(pPct * 100)}%.`
            : `Practice attendance is ${Math.round(pPct * 100)}%, but games are at ${Math.round(gPct * 100)}%.`,
        });
      }
    }
  }

  // ── FAIRNESS — who's carried the bench (needs a real sample) ──
  if (analytics && analytics.gamesWithLineup >= BENCH_MIN_GAMES) {
    const top = analytics.benchBalance[0];
    if (top && top.benchInnings >= BENCH_MIN_INNINGS) {
      out.push({
        tier: 'fairness',
        tone: top.backToBackGames > 0 ? 'warn' : 'info',
        report: 'playing-time',
        text: `${top.name} has sat the bench most — ${top.benchInnings} ${vocab.periodsWord}` +
          (top.backToBackGames > 0 ? `, including ${top.backToBackGames} back-to-back game${plural(top.backToBackGames)}.` : ' so far.'),
      });
    }
  }

  // ── FAIRNESS — coverage risk: a field position only ONE player has covered ──
  if (analytics && analytics.gamesWithLineup >= BENCH_MIN_GAMES && analytics.positionVariety.length >= COVERAGE_MIN_PLAYERS) {
    const byPos = new Map<string, string[]>();
    for (const p of analytics.positionVariety) {
      for (const pos of p.positions) {
        if (/bench/i.test(pos)) continue;
        const arr = byPos.get(pos) ?? [];
        arr.push(p.name);
        byPos.set(pos, arr);
      }
    }
    const single = [...byPos.entries()].filter(([, names]) => names.length === 1).sort(([a], [b]) => a.localeCompare(b));
    if (single.length > 0) {
      const [pos, names] = single[0];
      const extra = single.length - 1;
      out.push({
        tier: 'fairness',
        tone: 'info',
        report: 'playing-time',
        text: `Only ${names[0]} has played ${pos} this season — one absence from a gap` +
          (extra > 0 ? ` (${extra} more position${plural(extra)} ${extra === 1 ? 'has' : 'have'} single coverage).` : '.'),
      });
    }
  }

  // ── GOOD NEWS — undefeated reused lineup ──
  if (analytics) {
    const hot = analytics.reusedLineups.find(r => r.scoredGames >= 2 && r.wins >= 2 && r.losses === 0);
    if (hot) {
      out.push({
        tier: 'good-news',
        tone: 'good',
        report: 'playing-time',
        text: `Your “${hot.label}” lineup is ${hot.wins}-0${hot.ties ? `-${hot.ties}` : ''} in the games you've used it.`,
      });
    }
  }

  // ── GOOD NEWS — every loss came on the road (and home is clean) ──
  if (games && games.home && games.losses >= ROAD_SPLIT_MIN_LOSSES &&
      games.awayLosses === games.losses && games.home.games >= ROAD_SPLIT_MIN_HOME_GAMES && games.home.losses === 0) {
    const h = games.home;
    out.push({
      tier: 'good-news',
      tone: 'info',
      report: 'results',
      text: `All ${games.losses} losses have come on the road — you're ${h.wins}-0${h.ties ? `-${h.ties}` : ''} at home.`,
    });
  }

  // ── GOOD NEWS — win streak ──
  const streakFired = !!games && games.streakType === 'win' && games.streakCount >= STREAK_MIN;
  if (games && streakFired) {
    out.push({
      tier: 'good-news',
      tone: 'good',
      report: 'results',
      text: `You've won ${games.streakCount} straight.`,
    });
  }

  // ── GOOD NEWS — momentum + milestones (suppressed when the streak already told it) ──
  if (games) {
    const recent = games.recentResults ?? [];
    const window = recent.slice(0, MOMENTUM_WINDOW);
    const recentWins = window.filter(r => r === 'win').length;
    const momentum = !streakFired && window.length === MOMENTUM_WINDOW && recentWins >= MOMENTUM_MIN_WINS;
    const milestone = games.wins >= MILESTONE_MIN && games.wins % MILESTONE_EVERY === 0 && recent[0] === 'win';
    if (momentum && milestone) {
      out.push({ tier: 'good-news', tone: 'good', report: 'results', text: `Won ${recentWins} of your last ${MOMENTUM_WINDOW} — and that was win #${games.wins} of the season.` });
    } else if (momentum) {
      out.push({ tier: 'good-news', tone: 'good', report: 'results', text: `You've won ${recentWins} of your last ${MOMENTUM_WINDOW}.` });
    } else if (milestone && !streakFired) {
      out.push({ tier: 'good-news', tone: 'good', report: 'results', text: `That's win #${games.wins} of the season.` });
    }
  }

  // Ladder order (stable within a tier: rule order above), then the hard cap.
  return out
    .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier))
    .slice(0, MAX_FINDINGS);
}

// ── Weekly digest ─────────────────────────────────────────────────────────────
export const DIGEST_MAX_SEGMENTS = 3;

/**
 * Pure title/body builder for the Sunday "week in review" notification. Leads with one
 * good-news segment when there is one (warmth first), then the top attention items in
 * ladder order. Returns null on a quiet week — a digest with nothing to say is never sent.
 */
export function formatInsightDigest(findings: InsightFinding[]): { title: string; body: string } | null {
  if (findings.length === 0) return null;
  const good = findings.find(f => f.tier === 'good-news');
  const rest = findings.filter(f => f !== good);
  const chosen = [good, ...rest].filter((f): f is InsightFinding => !!f).slice(0, DIGEST_MAX_SEGMENTS);
  const segment = (f: InsightFinding) => {
    const text = f.text.replace(/\.$/, '');
    return f.tone === 'warn' ? `⚠ ${text}` : text;
  };
  return { title: 'Your week in review', body: `${chosen.map(segment).join(' · ')}.` };
}

// ── Shared dues shaping ──────────────────────────────────────────────────────
export interface FindingsDuesRow {
  outstanding?: number;
  installments?: { paidAt: string | null; dueDate: string; amount?: number }[] | null;
}

/**
 * ONE shaping of per-player dues rows into the findings summary, shared by the Insights
 * dashboard (API rows) and the weekly digest job (db rows) so the two can never disagree.
 * Overdue compares YYYY-MM-DD strings against todayISO — midnight-truncation semantics
 * (an installment due today is not overdue yet), matching the Overview dues tile.
 */
export function summarizeDuesForFindings(rows: FindingsDuesRow[], todayISO: string): FindingsDuesSummary {
  let minDue: string | null = null;
  for (const p of rows) {
    for (const i of p.installments ?? []) {
      if (!i.paidAt && i.dueDate >= todayISO && (minDue === null || i.dueDate < minDue)) minDue = i.dueDate;
    }
  }
  const atMinDue = minDue
    ? rows.filter(p => (p.installments ?? []).some(i => !i.paidAt && i.dueDate === minDue))
    : [];
  const minDueTotal = minDue
    ? atMinDue.reduce((s, p) => s + (p.installments ?? []).filter(i => !i.paidAt && i.dueDate === minDue).reduce((x, i) => x + (i.amount ?? 0), 0), 0)
    : 0;
  return {
    outstandingTotal: Math.round(rows.reduce((s, p) => s + (p.outstanding ?? 0), 0)),
    overdueCount: rows.reduce((n, p) => n + (p.installments ?? []).filter(i => !i.paidAt && i.dueDate < todayISO).length, 0),
    neverPaidCount: rows.filter(isNeverPaidPlayer).length,
    nextDue: minDue ? { dueDateISO: minDue, unpaidCount: atMinDue.length, unpaidTotal: minDueTotal > 0 ? Math.round(minDueTotal) : null } : null,
  };
}
