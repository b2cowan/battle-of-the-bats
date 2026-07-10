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
}

export interface FindingsAttendanceRow {
  name: string;
  /** Combined games+practices, "known" excludes no-reply (upstream semantics). */
  attended: number;
  known: number;
}

export interface FindingsDuesSummary {
  neverPaidCount: number;
  /** Whole-team outstanding dollars (rounded upstream). */
  outstandingTotal: number;
  overdueCount: number;
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

const TIER_ORDER: InsightTier[] = ['safety', 'money', 'attendance', 'fairness', 'good-news'];

function plural(n: number, word = 's'): string {
  return n === 1 ? '' : word;
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-CA')}`;
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

  // ── MONEY — who hasn't paid (never-paid first, else overdue installments) ──
  if (dues) {
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
  if (games && games.streakType === 'win' && games.streakCount >= STREAK_MIN) {
    out.push({
      tier: 'good-news',
      tone: 'good',
      report: 'results',
      text: `You've won ${games.streakCount} straight.`,
    });
  }

  // Ladder order (stable within a tier: rule order above), then the hard cap.
  return out
    .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier))
    .slice(0, MAX_FINDINGS);
}
