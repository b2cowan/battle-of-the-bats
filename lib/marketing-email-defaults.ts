/**
 * lib/marketing-email-defaults.ts
 *
 * The registry of the platform's marketing-campaign emails: their default copy, who each one went
 * to, when it fired, and whether it is still live.
 *
 * ⚠ EVERY CAMPAIGN HERE IS RETIRED (2026-11-20, owner ruling 2026-11-19: the Founding Season was
 * removed). No campaign is planned, so the live set is empty: nothing can be sent from the console,
 * and the Campaigns page is a record (sent history and opt-outs). The copy is kept — never deleted —
 * so each template still reads as history on Email templates and "Reset to default" still restores
 * it. A data-only DELETE is invisible to every drift gate we have, so it would strand on production
 * unnoticed (see CLAUDE.md on migration 264).
 *
 * WHY IT LIVES IN CODE: the operator-editable copy lives in the DB (platform_email_templates), but
 * once an operator saves an override the original seed text is overwritten in that row. To make
 * "Reset to default" genuinely restore the original, the default must be available at runtime — here.
 *
 * The dates and words of the retired Founding Season copy are written out below as they were when the
 * emails were last live, rather than derived from lib/plan-config.ts (the constants they came from
 * are gone). Plan names and prices still derive from plan-config.
 *
 * Every campaign here is retired, so this copy is history: no reseed migration is generated from it any more (the
 * generator was removed 2026-11-20 with the Founding Season). A revived campaign needs new copy, a seed migration and a
 * live entry. Content is the block-markup understood by lib/email-markup.ts.
 */

import { PLAN_CONFIG, formatPriceAmount } from './plan-config';
import { BILLING_TAX_WORDS } from './billing-tax';

// ── The retired copy's frozen dates ───────────────────────────────────────────
// What the five lifecycle emails said when they were last live. Not derived from anything.

const FROZEN_END_LABEL = 'September 30, 2027';
const FROZEN_FIRST_CHARGE_LABEL = 'October 1, 2027';
const FROZEN_YEAR_LABEL = '2027';
const FROZEN_NEXT_YEAR_LABEL = '2028';
const FROZEN_DECISION_MONTH_LABEL = 'September 2027';
const FROZEN_AFTER_LINE =
  `In ${FROZEN_DECISION_MONTH_LABEL} you'll choose a plan for your ${FROZEN_NEXT_YEAR_LABEL} season. Nothing is charged before then, and there is nothing to cancel.`;

// ── Derived words: plan names, prices, dates ──────────────────────────────────
// Every customer-visible number and date in the bodies below comes from one of these.

const PLUS = PLAN_CONFIG.tournament_plus.label;
const PORTAL = PLAN_CONFIG.team.label;
const CLUB = PLAN_CONFIG.club.label;
const FREE_PLAN = PLAN_CONFIG.tournament.label;

const PLUS_MONTHLY = `${formatPriceAmount(PLAN_CONFIG.tournament_plus.monthlyPrice)}/month`;
const PLUS_ANNUAL = `${formatPriceAmount(PLAN_CONFIG.tournament_plus.annualPrice)}/year`;
/** GST/HST Stage 2 Part 4 (T4): a sentence that names the charge to come says it is before tax. */
const PLUS_TAX = BILLING_TAX_WORDS.plusTax;
const PORTAL_MONTHLY = `${formatPriceAmount(PLAN_CONFIG.team.monthlyPrice)}/month`;
const PORTAL_ANNUAL = `${formatPriceAmount(PLAN_CONFIG.team.annualPrice)}/year`;

/** "your 2028 season" — what the end-of-season ask is actually about (D3, annual first). */
const NEXT_SEASON = `your ${FROZEN_NEXT_YEAR_LABEL} season`;

/**
 * The three audience segments a marketing campaign can target. Resolved to real recipients by
 * the send route; counted for the dashboard by lib/email-sender.ts.
 */
export type MarketingAudience = 'founding' | 'not_on_club' | 'coaches';

/** How a campaign fires: on a planned calendar date, or on a system event. */
export type MarketingEmailTiming =
  | { kind: 'date'; plannedSendDate: string }
  | { kind: 'trigger'; when: string };

export type MarketingEmailDefault = {
  label: string;
  description: string;
  subject: string;
  heading: string;
  variables: string[];
  body: string;
  /** Which audience the send route resolves for this campaign. */
  audience: MarketingAudience;
  /** Planned send date (operator-editable) or the system event that fires it. */
  timing: MarketingEmailTiming;
  /** Who receives it, in one line, for the dashboard's Audience column. */
  audienceLabel: string;
  /** Transactional campaigns fire per-recipient and have no batch audience count. */
  isTransactional?: boolean;
  /**
   * A retired campaign keeps its copy (so it can be revived) but leaves the operator's board and
   * can no longer be sent. Retiring is deliberately NOT a row deletion: a data-only DELETE is
   * invisible to every drift gate we have, so it strands on production unnoticed (see CLAUDE.md
   * on migration 264).
   */
  retired?: { on: string; why: string };
};

export const MARKETING_EMAIL_DEFAULTS: Record<string, MarketingEmailDefault> = {
  // ── The Founding Season lifecycle — RETIRED 2026-11-20 ───────────────────────
  // The Founding Season was removed (owner 2026-11-19). All five leave the board and every send path
  // is deleted; the copy stays as history, in the words it last went out with.
  "founding_welcome": {
    label: "Founding — Welcome",
    description: `Sent to each new founding org owner at signup (transactional). Confirms free ${PLUS} through ${FROZEN_END_LABEL}.`,
    subject: `Your Founding Season starts now — free through ${FROZEN_END_LABEL}`,
    heading: "Your Founding Season starts now.",
    variables: ["firstName", "orgName", "setupUrl"],
    audience: 'founding',
    isTransactional: true,
    timing: { kind: 'trigger', when: 'At signup' },
    audienceLabel: 'Each new founding org owner (transactional)',
    retired: { on: '2026-11-20', why: 'The Founding Season was removed' },
    body: `Hi {{firstName}},

You're in. **{{orgName}}** is set up on FieldLogicHQ, and **${PLUS} is free through ${FROZEN_END_LABEL}** — your whole ${FROZEN_YEAR_LABEL} season. Normally ${PLUS_MONTHLY}. No credit card.

::callout What ${PLUS} gives you
- Auto-scheduling across any number of fields and time slots
- Single and double-elimination brackets
- Team communications and announcements
- As many tournaments as you run — no cap
- Tournament archives — every past event preserved
::end

::button Set up your first tournament → | {{setupUrl}}

${FROZEN_AFTER_LINE}

If anything doesn't work the way you'd expect, reply to this email. We read everything.

— The FieldLogicHQ team`,
  },
  "founding_checkin": {
    label: "Founding — Season Check-in",
    description: "Sent ~60 days after signup. Celebrates activity so far and nudges another tournament.",
    subject: "How's your season going?",
    heading: "How's your season going?",
    variables: ["firstName", "weeksPhrase", "orgName", "hasActivity", "tournamentsPhrase", "gamesPhrase", "gameCount", "setupUrl"],
    audience: 'founding',
    timing: { kind: 'trigger', when: '~Day 60 post-signup' },
    audienceLabel: 'Founding orgs, signed up 60+ days ago',
    retired: { on: '2026-11-20', why: 'The Founding Season was removed' },
    body: `Hi {{firstName}},

It's been **{{weeksPhrase}}** since **{{orgName}}** joined FieldLogicHQ.

::if hasActivity
::callout Season so far
You've run **{{tournamentsPhrase}}** — **{{gamesPhrase}} played**.
That's {{gameCount}} schedule exports and score entries you didn't have to do in a spreadsheet.
::end
::button Set up another tournament → | {{setupUrl}}
::else
You haven't run your first tournament yet — and you have your whole ${FROZEN_YEAR_LABEL} season on ${PLUS} to do it in.

If you have an event coming up, now's the time to set it up:
::button Set up a tournament → | {{setupUrl}}
::end

We're also curious: what's working, and what isn't? Reply and tell us.

${PLUS} is free for **{{orgName}}** through **${FROZEN_END_LABEL}**. ${FROZEN_AFTER_LINE}

— The FieldLogicHQ team`,
  },

  // ── The summer sequence: choose a plan for the next season (retired) ────────
  // Three sends, from four months out to two weeks out, all keyed to the day the free season ended.
  "founding_renewal": {
    label: "Founding — Choose your plan",
    description: `Sent when the card window opens. Explains what happens on ${FROZEN_FIRST_CHARGE_LABEL} and opens the ${FROZEN_NEXT_YEAR_LABEL} plan choice, annual first.`,
    subject: `Your free season ends ${FROZEN_END_LABEL} — choose your ${FROZEN_NEXT_YEAR_LABEL} plan`,
    heading: `Your free season ends ${FROZEN_END_LABEL}.`,
    variables: ["firstName", "orgName", "hasHistory", "hasActive", "activePhrase", "hasPast", "pastPhrase", "billingUrl", "planCompareUrl"],
    audience: 'founding',
    timing: { kind: 'date', plannedSendDate: '2027-06-01' },
    audienceLabel: 'All founding season org owners',
    retired: { on: '2026-11-20', why: 'The Founding Season was removed' },
    body: `Hi {{firstName}},

**{{orgName}}** has run on ${PLUS} at no cost since you joined. That free season ends on **${FROZEN_END_LABEL}** — and this is the early note, not the last one.

::callout.blue What you're choosing
A plan for ${NEXT_SEASON} — **annual or monthly**. ${PLUS} is **${PLUS_ANNUAL}** or **${PLUS_MONTHLY}** ${PLUS_TAX}. Annual suits most seasons: a year of tournaments paid once, in the month you're already doing the budget.
::end

::if hasHistory
::callout What {{orgName}} has built
::if hasActive
Your **{{activePhrase}}**, every registered team, every score and every archive carry over exactly as they are. Nothing moves.
::end
::if hasPast
Your **{{pastPhrase}}** stay in your archives on any plan, including the free one.
::end
::end
::end

You can add a card now and choose the plan later. Nothing is charged before **${FROZEN_FIRST_CHARGE_LABEL}**.

::button Add a payment method — takes 2 minutes → | {{billingUrl}}

**If ${PLUS} isn't right for ${FROZEN_NEXT_YEAR_LABEL}, there is nothing to cancel.** On ${FROZEN_FIRST_CHARGE_LABEL}, **{{orgName}}** moves to the free ${FREE_PLAN} plan and keeps everything it built.

::link See the plans → | {{planCompareUrl}}

Questions? Reply to this email.

— The FieldLogicHQ team`,
  },
  "founding_nudge": {
    label: "Founding — Plan reminder",
    description: `Sent two months before the free season ends. A short reminder for anyone who has not chosen a ${FROZEN_NEXT_YEAR_LABEL} plan yet.`,
    subject: `Still time to choose your ${FROZEN_NEXT_YEAR_LABEL} plan`,
    heading: `Still time to choose your ${FROZEN_NEXT_YEAR_LABEL} plan.`,
    variables: ["firstName", "orgName", "hasCard", "billingUrl"],
    audience: 'founding',
    timing: { kind: 'date', plannedSendDate: '2027-08-01' },
    audienceLabel: 'All founding season org owners',
    retired: { on: '2026-11-20', why: 'The Founding Season was removed' },
    body: `Hi {{firstName}},

A short follow-up: **{{orgName}}**'s free season on ${PLUS} ends on **${FROZEN_END_LABEL}**.

::if hasCard
Your payment method is on file, so there is nothing to do today. In ${FROZEN_DECISION_MONTH_LABEL} you'll pick annual or monthly, and that is the whole decision.
::else
Nothing has been charged, and nothing will be before **${FROZEN_FIRST_CHARGE_LABEL}**. If you already know you're continuing, adding a card now takes two minutes and takes it off your list:
::button Add a payment method → | {{billingUrl}}
::end

::callout What it costs from ${FROZEN_FIRST_CHARGE_LABEL}
${PLUS} is **${PLUS_ANNUAL}** or **${PLUS_MONTHLY}** ${PLUS_TAX}. The year is one payment, in the month you're planning the season anyway.
::end

If ${PLUS} isn't right for ${FROZEN_NEXT_YEAR_LABEL}, there is nothing to cancel. **{{orgName}}** moves to the free ${FREE_PLAN} plan and keeps everything it built.

— The FieldLogicHQ team`,
  },
  "founding_final": {
    label: "Founding — Final notice",
    description: `Sent about two weeks before the free season ends. The last note before ${FROZEN_FIRST_CHARGE_LABEL}.`,
    subject: `Last note before your free season ends ${FROZEN_END_LABEL}`,
    heading: `Your free season ends ${FROZEN_END_LABEL}.`,
    variables: ["firstName", "orgName", "hasCard", "billingUrl"],
    audience: 'founding',
    timing: { kind: 'date', plannedSendDate: '2027-09-15' },
    audienceLabel: 'All founding season org owners',
    retired: { on: '2026-11-20', why: 'The Founding Season was removed' },
    body: `Hi {{firstName}},

This is the last note before **{{orgName}}**'s free season ends on **${FROZEN_END_LABEL}**.

::if hasCard
Your payment method is on file, so the only thing left is the choice itself: **${PLUS_ANNUAL}** or **${PLUS_MONTHLY}** ${PLUS_TAX}, from ${FROZEN_FIRST_CHARGE_LABEL}.
::button Choose your ${FROZEN_NEXT_YEAR_LABEL} plan → | {{billingUrl}}
::else
To keep ${PLUS} from ${FROZEN_FIRST_CHARGE_LABEL}, choose a plan for ${NEXT_SEASON}:
::button Choose your ${FROZEN_NEXT_YEAR_LABEL} plan → | {{billingUrl}}

**If you'd rather not continue, you don't have to do anything.** On ${FROZEN_FIRST_CHARGE_LABEL}, **{{orgName}}** moves to the free ${FREE_PLAN} plan — one active tournament, manual scheduling, no cost — and every team, score and archive you have built stays exactly where it is.
::end

Thank you for running your season with us. You were one of the first.

— The FieldLogicHQ team`,
  },

  // ── The acquisition push — RETIRED 2026-10-26 ─────────────────────────────────
  // The Founding Season offer closed early (owner 2026-10-26, BUSINESS_DECISIONS), and all three of these
  // sell it (the season itself was then removed, 2026-11-19). They leave the board and the send route refuses them. The offer sentence is written out
  // verbatim as the database row holds it (mig 284) rather than derived from the close date, so moving
  // the date did not rewrite copy that is never sent again — the same rule as the retired Club spotlights.
  "spotlight_coaches_org": {
    label: "Spotlight — Coaches Portal (to orgs)",
    description: `Sent to org owners during the signup window. Pitches the ${PORTAL} for the coaches on their teams.`,
    subject: `For the coaches on your teams — free through ${FROZEN_END_LABEL}`,
    heading: "For the coaches on your teams — a workspace that's actually theirs.",
    variables: ["firstName", "coachShareUrl", "interestUrl"],
    audience: 'founding',
    timing: { kind: 'date', plannedSendDate: '2026-10-01' },
    audienceLabel: 'Org owners',
    retired: { on: '2026-10-26', why: 'The Founding Season offer closed early' },
    body: `Hi {{firstName}},

The coaches managing teams in your tournaments are tracking rosters in group texts, lineups in notes apps, and team fees in someone's head.

::callout The ${PORTAL} gives them one place for all of it
- Full roster management with season history
- Lineup builder — plan your starting lineup, export to PDF
- Team budget and player dues tracking
- Document management: consent forms, medical notes, eligibility files
::end

It works whether or not a coach's team is registered in a tournament you run on FieldLogicHQ. A coach can sign up on their own and run their team year-round.

The Premium Coaches Portal is free through September 30, 2027 when you sign up by December 31, 2026. No credit card. Normally ${PORTAL_MONTHLY} or ${PORTAL_ANNUAL} — or included when your organization is on ${CLUB}.

Know a coach who'd use it? They can start today:
::link Send them this link → | {{coachShareUrl}}

Want the details first?
::button See the ${PORTAL} → | {{interestUrl}}

— The FieldLogicHQ team`,
  },
  "spotlight_coaches_coach": {
    label: "Spotlight — Coaches Portal (to coaches)",
    description: `Sent to coach accounts during the signup window. Pitches the standalone ${PORTAL}.`,
    subject: `Your team's season workspace — free through ${FROZEN_END_LABEL}`,
    heading: "Your team's season workspace.",
    variables: ["firstName", "interestUrl"],
    audience: 'coaches',
    timing: { kind: 'date', plannedSendDate: '2026-10-01' },
    audienceLabel: 'Coach accounts (tournament participants)',
    retired: { on: '2026-10-26', why: 'The Founding Season offer closed early' },
    body: `Hi {{firstName}},

You've been through a tournament on FieldLogicHQ. But managing your team between tournaments is still probably spread across your phone, your email, and your memory.

::callout The ${PORTAL} is built for exactly that
- Your full roster, season over season
- Lineups you can plan, save, and export to PDF
- Team budget: dues in, expenses out, who owes what
- Documents in one place — consent, medical, eligibility
::end

No organization account required. Your team's workspace, on your timeline.

The Premium Coaches Portal is free through September 30, 2027 when you sign up by December 31, 2026. No credit card. Normally ${PORTAL_MONTHLY} or ${PORTAL_ANNUAL}.

${FROZEN_AFTER_LINE}

::button Start your ${PORTAL} → | {{interestUrl}}

— The FieldLogicHQ team`,
  },
  "spotlight_full_picture": {
    label: "Spotlight — The Full Picture",
    description: "Founding-season note: what's live, what's coming, and how long the window stays open.",
    subject: "Where FieldLogicHQ is headed — a note from the Founding Season",
    heading: "Where FieldLogicHQ is headed.",
    variables: ["firstName", "shareUrl"],
    audience: 'founding',
    timing: { kind: 'date', plannedSendDate: '2026-11-15' },
    audienceLabel: 'All founding season participants',
    retired: { on: '2026-10-26', why: 'The Founding Season offer closed early' },
    body: `Hi {{firstName}},

You're one of the first organizations running on FieldLogicHQ. Here's where things stand, and where they're going.

::callout What's live today
- **${FREE_PLAN}** — registration, manual scheduling, brackets, live scores and archives, free with no end date
- **${PLUS}** — everything above plus auto-scheduling, and as many tournaments as you run
- **The ${PORTAL}** — a full season workspace for one team: roster, lineups, budget, dues, documents
::end

Tournament Plus and the Premium Coaches Portal are free through September 30, 2027 when you sign up by December 31, 2026. No credit card.

::callout.blue What's coming
- More ways for families to follow their teams
- Deeper reporting on the money side of a season
- And more, shaped by what this first season has taught us
::end

You helped build this — by running real events on the platform and telling us what worked and what didn't.

If you know another tournament organizer or coach who should be here, the Founding Season is open until **December 31, 2026**:
::link Share FieldLogicHQ → | {{shareUrl}}

There is nothing to do about billing. ${FROZEN_AFTER_LINE}

— The FieldLogicHQ team`,
  },

  // ── Retired 2026-09-07 (Founding Season 2027 Phase 1) ───────────────────────
  // League and Club are PARKED products (BUSINESS_DECISIONS 2026-07-28), so we stopped selling
  // them. Their copy is kept verbatim, unrewritten, so a campaign can be revived the day a
  // product un-parks — but they leave the operator's board and the send route refuses them.
  // Their bodies still describe the January 2027 cliff; that is deliberate and harmless while
  // they are unsendable, and rewriting copy for a product we do not sell would be busywork.
  "spotlight_club": {
    label: "Spotlight — Club",
    description: "RETIRED 2026-09-07 — Club is a parked product. Kept for revival; not sendable.",
    subject: "Before your September season starts — Club is free through December 31",
    heading: "Before your September season starts — Club is free through December 31.",
    variables: ["firstName", "setupUrl", "orgName"],
    audience: 'founding',
    timing: { kind: 'date', plannedSendDate: '2026-08-01' },
    audienceLabel: 'Org owners',
    retired: { on: '2026-09-07', why: 'Club is a parked product' }, // spelling-ok: the body is the database row's, verbatim (mig 284); a retired send, never re-sent
    body: "Hi {{firstName}},\n\nMost clubs are planning their September season right now.\nTryouts. Rep team rosters. League registrations. Budget prep.\n\nIf you're managing all of that across multiple tools — this is worth 15 minutes.\n\n::callout Club on FieldLogicHQ puts your entire organization in one place\n- Tournaments: same tools you're already using on your founding season\n- House League: registration, draft, schedule, standings, parent notifications — no manual emails\n- Rep Teams: tryouts, roster, lineups, and team budget — coaches run their own programs; your executive team gets the visibility\n- Accounting: org ledger, team invoicing, budget vs. actual\n::end\n\nYour executive team sees everything. Your coaches run their own teams.\nNobody is sending weekly update emails.\n\nClub is normally **from $219/month**, unlimited staff seats.\nAs a founding organization, **Club is free through December 31, 2026**.\n\nIf you're starting a September season, the time to set this up is now — not after you're three months in on the same old process.\n\n::button Start on Club — free through December 31 → | {{setupUrl}}\n\nQuestions about whether Club is right for **{{orgName}}**? Reply to this email.\n\n— The FieldLogicHQ team",
  },
  "spotlight_league": { // spelling-ok: the label is the database row's, verbatim (migs 179, 284)
    label: "Spotlight — House League",
    description: "RETIRED 2026-09-07 — League is a parked product. Kept for revival; not sendable.",
    subject: "What running a house league actually looks like on FieldLogicHQ",
    heading: "What running a house league actually looks like on FieldLogicHQ.",
    variables: ["firstName", "orgName", "setupUrl"],
    audience: 'founding',
    timing: { kind: 'date', plannedSendDate: '2026-09-01' },
    audienceLabel: 'Org owners',
    retired: { on: '2026-09-07', why: 'League is a parked product' },
    body: "Hi {{firstName}},\n\nYou're running tournaments. But if **{{orgName}}** also runs a house league season — or if that's where you're headed — here's what that looks like.\n\n::callout From opening registration to final standings\n- Parents register players online. You set division limits; waitlists fill automatically.\n- Draft day uses a live board — pick order, team builds, no spreadsheet.\n- The schedule generates itself. Parents get automated game notifications without you sending a single email.\n- Standings update the moment scores are entered.\n::end\n\nNo parallel spreadsheets. No manual notifications. One dashboard.\n\nAvailable on the League Plus plan (**$89/month**) and Club plan (**from $219/month**).\nBoth are **free through December 31, 2026** for founding organizations.\n\nIf you're planning a league season:\n::button Get set up on League Plus — free through December 31 → | {{setupUrl}}\n\n— The FieldLogicHQ team",
  },
  "spotlight_club_last": {
    label: "Spotlight — Club (last call)",
    description: "RETIRED 2026-09-07 — Club is a parked product. Kept for revival; not sendable.",
    subject: "Last reminder — Club is still free through December 31",
    heading: "Last reminder — Club is still free through December 31.",
    variables: ["firstName", "orgName", "setupUrl"],
    audience: 'not_on_club',
    timing: { kind: 'date', plannedSendDate: '2026-10-15' },
    audienceLabel: 'Org owners not yet on Club plan',
    retired: { on: '2026-09-07', why: 'Club is a parked product' },
    body: "Hi {{firstName}},\n\nA quick follow-up to our August note about Club.\n\nIf **{{orgName}}** is running a house league, rep teams, or both alongside your tournaments — Club is free through December 31, 2026 as part of your founding season.\n\nAfter the new year, it's **from $219/month**. Starting now, it costs nothing.\n\nThe longer you wait to set it up, the deeper into the season you go on separate systems.\n\n::button Start on Club — free through December 31 → | {{setupUrl}}\n\n— The FieldLogicHQ team",
  },
};

/** The default copy for a marketing campaign key, or null if the key isn't a marketing campaign. */
export function getMarketingEmailDefault(key: string): MarketingEmailDefault | null {
  return MARKETING_EMAIL_DEFAULTS[key] ?? null;
}

/** Every campaign key, retired ones included — the full set of `marketing` template rows. */
export const ALL_MARKETING_EMAIL_KEYS: readonly string[] = Object.keys(MARKETING_EMAIL_DEFAULTS);

/**
 * The campaigns an operator can see and send today, in board order. A retired campaign keeps its
 * row (and its copy) but is absent from here, which is what removes it from the dashboard, the
 * recipient counts and the send route's allowlist in one move.
 */
export const LIVE_MARKETING_CAMPAIGNS: readonly (MarketingEmailDefault & { key: string })[] =
  Object.entries(MARKETING_EMAIL_DEFAULTS)
    .filter(([, c]) => !c.retired)
    .map(([key, c]) => ({ key, ...c }));

/** Live campaign keys — the send route's allowlist. A retired campaign can no longer be sent. */
export const LIVE_MARKETING_EMAIL_KEYS: readonly string[] = LIVE_MARKETING_CAMPAIGNS.map(c => c.key);

/** Which audience each LIVE marketing email sends to. */
export const MARKETING_EMAIL_AUDIENCE: Record<string, MarketingAudience> =
  Object.fromEntries(LIVE_MARKETING_CAMPAIGNS.map(c => [c.key, c.audience]));

/** The seeded planned send date for a campaign, or null for an event-triggered one. */
export function plannedSendDateFor(key: string): string | null {
  const timing = MARKETING_EMAIL_DEFAULTS[key]?.timing;
  return timing && timing.kind === 'date' ? timing.plannedSendDate : null;
}
