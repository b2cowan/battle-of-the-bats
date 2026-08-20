/**
 * THE WALKTHROUGH PANELS — the one place a pre-sales walkthrough's story is written.
 *
 * Plan: docs/projects/active/PRESALES_WALKTHROUGH_PLAN.md · approved mockup:
 * https://claude.ai/code/artifact/6f16bc17-d5f3-45b6-bd03-b6df54231f15
 *
 * One panel = one recognizable volunteer pain → one REAL screenshot (declared in
 * lib/marketing-shots.ts, captured from the demo world by scripts/capture-marketing-shots.mjs)
 * → one answer in brand voice → a quiet door into the live demo. The scroll page renders this
 * today; present mode (Phase 2) and the coach walkthrough (Phase 3) render the same shape.
 *
 * ── COPY RULES (binding — docs/agents/brand/BRAND_STRATEGY.md) ────────────────
 * Brand voice: practical, direct, warm; the forbidden-word list applies. Never a competitor
 * name — the villain is "the old way". Never a price on this surface; plan NAMES are required
 * where a feature is gated, in full ("Tournament Plus", never "Plus"). Pain vocabulary stays
 * consistent with lib/plan-article-content.ts painItems — same voice, no parallel bank.
 *
 * ⚠ Answers describe what the screen DOES; they never read the picture aloud. The demo worlds
 * re-anchor on a schedule, so any score or count in a capture is perishable — a sentence that
 * quotes one goes stale the day the world ticks. (The pain headline may stage a SCENE with
 * invented specifics — "eleven texts" — because it describes the old way, not our screen.)
 */

import type { Metadata } from 'next';
import { SEE_IT_LIVE_COACHES_PATH, SEE_IT_LIVE_PATH } from './sandbox-door';

export interface WalkthroughPanel {
  /** Joins the panel to its picture in lib/marketing-shots.ts (and names the demo screen). */
  shotId: string;
  /** The old-way headline, in the volunteer's own words. Staged, visceral, recognizable. */
  pain: string;
  /** What stops being their job. Present tense, specific mechanism, no superlatives. */
  answer: string;
  /** Set ONLY when the pictured feature is plan-gated — full canonical plan name, always. */
  planTag?: string;
}

export interface Walkthrough {
  /** Also the manifest persona and the asset folder. */
  persona: 'tournament' | 'coach';
  /** This page's own route — its canonical URL, and the address printed on the leave-behind. */
  path: string;
  seo: { title: string; description: string };
  eyebrow: string;
  title: string;
  sub: string;
  /** The "n problems · 90 seconds · nothing to install" line under the hero CTAs. */
  meta: string;
  /**
   * The demo door. Each sandbox keeps its OWN door constant (lib/sandbox-door.ts) rather than a
   * parameterized one — "which account does this sign in" stays a compile-time constant — so the
   * walkthrough names its world's door here rather than deriving one from `persona`.
   *
   * ⚠ The LABEL is the walkthrough's own, from the approved mockup, and deliberately does NOT
   * match the persona page's button for the same door (`/for-coaches` says "See it live →"; the
   * coach walkthrough says "See a coach's season →"). By the time a reader reaches this page they
   * have been shown particular screens, and the door promises the season those screens came from.
   * If that inconsistency is ever ruled against, the fix belongs on BOTH pages — the tournament
   * pair drifts the same way and always has.
   */
  door: { path: string; label: string };
  /**
   * The way back into the full persona page, for a reader who wants everything else. Href only —
   * the LABEL is the same sentence for every persona ("everything else *it* does" is deliberately
   * persona-agnostic), so it lives with the walkthrough's other invariant copy in the renderer
   * rather than being re-typed, and silently re-worded, once per persona.
   */
  back: { href: string };
  panels: WalkthroughPanel[];
  closing: { eyebrow: string; title: string; body: string };
}

/** The page's <head>, derived from the same object the body renders. */
export function walkthroughMetadata(w: Walkthrough): Metadata {
  return {
    title: w.seo.title,
    description: w.seo.description,
    alternates: { canonical: w.path },
  };
}

export const TOURNAMENT_WALKTHROUGH: Walkthrough = {
  persona: 'tournament',
  path: '/for-tournament-organizers/walkthrough',
  seo: {
    title: 'The 90-Second Walkthrough for Tournament Organizers — FieldLogicHQ',
    description:
      'Five jobs that stop being yours the day the tournament runs on FieldLogicHQ — live scores families check themselves, volunteer score entry, one-action rain delays, self-building brackets, and registration health. Real screens, not a brochure.',
  },
  eyebrow: 'For tournament organizers · a 90-second walkthrough',
  title: 'The weekend the phone stayed in your pocket.',
  sub: 'Five jobs that stop being yours the day the tournament runs on FieldLogicHQ — shown on the real screens, not a brochure.',
  meta: '5 problems · 90 seconds · nothing to install',
  door: { path: SEE_IT_LIVE_PATH, label: 'See it live — no sign-up →' },
  back: { href: '/for-tournament-organizers' },
  panels: [
    {
      shotId: 'fan-live-score',
      pain: 'Saturday, 2:14 PM — eleven texts asking for the score.',
      answer:
        'Families follow their team on the tournament’s public site — live scores, schedule, and standings, no account, no app store. You never answer that text again.',
    },
    {
      shotId: 'scorekeeper-view',
      pain: 'You’re chained to the scoring laptop while the tournament happens outside.',
      answer:
        'Any volunteer enters scores from the field through Scorekeeper View — a link and a QR code from the Staff Kit, no admin access, nothing they can break. You walk the diamonds.',
    },
    {
      shotId: 'rain-delay',
      pain: 'Rain at 9 AM. Forty coaches to call, one at a time.',
      answer:
        'Rain delay re-times the whole day and hands you one notice — pinned as a banner on the public schedule, pushed to followers’ phones, sent to every coach. One action, not forty calls.',
      planTag: 'Rain delay re-timing is part of Tournament Plus',
    },
    {
      shotId: 'playoff-bracket',
      pain: 'The bracket lives on a whiteboard, and the seeds keep changing.',
      answer:
        'The Playoff Wizard builds the bracket from live standings, and it fills itself in as games end. A big division splits into Gold and Silver tiers in one click. Every plan gets the inline bracket editor.',
      planTag: 'Playoff Wizard is part of Tournament Plus',
    },
    {
      shotId: 'registration-health',
      pain: 'A team’s payment fell through — and you find out at the gate.',
      answer:
        'Registration Health scores the whole field weeks out — who’s paid, whose email bounces, who still needs a decision — and every tile clicks through to the exact teams.',
      // The Payments tile shows a badge instead of numbers on the free plan
      // (lib/help-content/tournaments.tsx) — same disclosure rule as the other gated panels.
      planTag: 'Payment tracking is part of Tournament Plus',
    },
  ],
  closing: {
    eyebrow: 'That was the pitch. Here’s the proof.',
    title: 'Walk the real thing — it’s running right now.',
    // "Photographed … not a mockup" + "the demo is the live thing" keeps this page's images
    // clearly distinct from /demos' own claim ("not recordings or screenshots") — that page
    // vouches the DEMO is live; this line vouches the PICTURES are real, then hands over.
    body: 'Every picture above is the real FieldLogicHQ software, photographed on a live demo tournament we operate ourselves — not a mockup. And the demo itself is running right now: walk into the same tournament, nothing to sign up for, nothing you can break.',
  },
};

export const COACH_WALKTHROUGH: Walkthrough = {
  persona: 'coach',
  path: '/for-coaches/walkthrough',
  seo: {
    title: 'The 90-Second Walkthrough for Head Coaches — FieldLogicHQ',
    // ⚠ Describes the panels that EXIST. The mockup's third panel (game day) is not built —
    // see the plan's P3 note — so this line must not promise it.
    description:
      'The team money that stops being yours to carry the day your team runs on FieldLogicHQ — every family’s dues on one page, and the season squared up from the real ledger. Real screens, not a brochure.',
  },
  eyebrow: 'For head coaches · a 90-second walkthrough',
  title: 'Run the team. Keep your evenings.',
  sub: 'The jobs the Coaches Portal takes off your plate — shown on the real screens a coach uses, not a brochure.',
  meta: '2 problems · 90 seconds · nothing to install',
  door: { path: SEE_IT_LIVE_COACHES_PATH, label: 'See a coach’s season →' },
  back: { href: '/for-coaches' },
  panels: [
    {
      shotId: 'coach-player-dues',
      pain: 'Team fees live in your head, and the e-transfers arrive with no name on them.',
      // ⚠ The mockup said "automatic overdue reminders". The scheduled sweep
      // (lib/dues-reminders.ts, ticked daily by pg_cron) runs two waves 30 and 7 days BEFORE an
      // installment is due — ahead of the date, not after it — and it is on for a new team
      // (rep_program_years.auto_reminders_enabled DEFAULT true). The never-paid nudge stays
      // deliberately manual because it has no sent-stamp, so it is NOT what "one button" means
      // here: that is the toolbar's **Send Due Reminders**, which chases everyone past due or
      // due within three days, partial payers included. Do not conflate the two buttons.
      //
      // ⚠ "or waits for season's end" is not hedging for its own sake. Credits meeting bills is
      // a per-team setting (rep_program_years.credit_application): two of its three modes reduce
      // the bill, and `keep_separate` deliberately does not ("Credits don't reduce bills —
      // settled at season's end"). Unqualified, this sentence would be false for any team on
      // that mode. The demo world pins the default, so the PICTURE stays true either way.
      answer:
        'Player Dues puts every family on one page — what they were charged, what they have paid, what is left, and who has fallen behind. Reminders go out on their own ahead of each installment’s due date, and one button chases whoever is still behind. Money a family raised fundraising comes off their own bill, or waits for season’s end — your call. (The free portal keeps its Fees tool: charge the team, mark who has paid.)',
      planTag: 'Player Dues is part of the Premium Coaches Portal',
    },
    {
      shotId: 'coach-season-settlement',
      pain: 'It’s October, and you owe eleven families a refund you can’t calculate.',
      // ⚠⚠ THE MOCKUP'S CLAIM WAS FALSE AND IS NOT WRITTEN HERE. It read "won't let you close
      // the books until every family is made whole" — but closing a season WARNS and never
      // blocks (owner ruling 2026-08-18, CLAUDE.md; the PATCH handler does a bare status flip
      // with zero money checks, and CloseSeasonModal's primary button is never disabled by
      // money). What DOES refuse is the settlement sheet's bulk payout — disabled until
      // closeOutBlockers().canClose, i.e. dues collected, enough cash held, and nothing left
      // pending with the club. That is the honest, and better, version of the same promise.
      answer:
        'Season settlement works it out from the season’s real ledger — what the team is holding, each family’s even share, who is owed money back and who still owes. It names every reason the books are not ready to close, and keeps the pay-everyone button locked until they are.',
      planTag: 'Season settlement is part of the Premium Coaches Portal',
    },
  ],
  closing: {
    eyebrow: 'That was the pitch. Here’s the proof.',
    title: 'Sit in a coach’s seat — the season is running right now.',
    // Same division of labour as the tournament closing: this line vouches the PICTURES are
    // real, then hands over to the demo. "A season" not "a team" — the sandbox runs five teams,
    // one per phase of the year, and the pictures above are taken on the phase each screen
    // belongs to.
    body: 'Every picture above is the real FieldLogicHQ software, photographed on a demo club we run ourselves — not a mockup. The demo is running right now, and it is a whole year you can walk: tryout day, mid-season, the off-season books, and a season already closed.',
  },
};
