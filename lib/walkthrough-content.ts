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
  eyebrow: string;
  title: string;
  sub: string;
  /** The "n problems · 90 seconds · nothing to install" line under the hero CTAs. */
  meta: string;
  /** The demo door's label on this page (matches the persona pages' vocabulary). */
  doorLabel: string;
  panels: WalkthroughPanel[];
  closing: { eyebrow: string; title: string; body: string };
}

export const TOURNAMENT_WALKTHROUGH: Walkthrough = {
  persona: 'tournament',
  eyebrow: 'For tournament organizers · a 90-second walkthrough',
  title: 'The weekend the phone stayed in your pocket.',
  sub: 'Five jobs that stop being yours the day the tournament runs on FieldLogicHQ — shown on the real screens, not a brochure.',
  meta: '5 problems · 90 seconds · nothing to install',
  doorLabel: 'See it live — no sign-up →',
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
