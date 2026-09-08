/**
 * lib/marketing-email-defaults.ts
 *
 * The CANONICAL registry for the founding-season marketing campaigns: their default copy, who
 * each one goes to, when it fires, and whether it is still live. This is the ONE place the
 * campaign set is declared — the send route, the audience map, the dashboard board and the
 * recipient-count map all derive from it.
 *
 * WHY IT LIVES IN CODE: the operator-editable copy lives in the DB (platform_email_templates),
 * but once an operator saves an override the original seed text is overwritten in that row.
 * To make "Reset to default" genuinely restore the original (not just clear a badge), the
 * default must be available at runtime — here. The DB row is the live/editable copy; this is
 * the immutable default. (Standard default+override model — no duplication of the SEND path,
 * which still reads the one DB row.)
 *
 * ⚠ WHY THE REGISTRY MOVED HERE (Founding Season 2027 Phase 1, 2026-09-07). The campaign SET
 * used to be declared five times — here, in the send route's key allowlist, in the audience map
 * in lib/email-sender.ts, in the per-key recipient counts in app/api/admin/email/route.ts, and
 * in the dashboard's own hardcoded board. Rewriting the campaigns for the summer-2027 calendar
 * found all five disagreeing: three campaigns pitched parked products, the "Confirm Send" dialog
 * quoted subject lines two rewrites out of date, and two campaigns showed "past due" for sends
 * that must never go out. Nothing could have caught that, because nothing compared the lists.
 * Now they are one list, and tests/unit/marketing-campaign-registry.test.ts fails the build if a
 * consumer ever grows its own copy again.
 *
 * ⚠ NEVER HAND-TYPE A FOUNDING SEASON DATE OR A PLAN PRICE in this file. Every one is derived
 * from lib/plan-config.ts below. The world this project replaced had two dozen hand-typed
 * "January 1, 2027"s across the app and all ten campaigns, and moving one date broke every one
 * of them silently.
 *
 * KEEP IN SYNC: the DB seed is GENERATED from this data, never hand-copied —
 * `node scripts/generate-campaign-reseed-migration.mjs` writes the reseed migration (the
 * migration-198 pattern: data-only, and it touches a row only while it is NOT
 * operator-customised, so a saved override always wins). Content is the block-markup understood
 * by lib/email-markup.ts.
 */

import {
  PLAN_CONFIG,
  formatPriceAmount,
  FOUNDING_SEASON_END_LABEL,
  FOUNDING_SEASON_SIGNUP_CLOSE_LABEL,
  FOUNDING_SEASON_FIRST_CHARGE_LABEL,
  FOUNDING_SEASON_YEAR_LABEL,
  FOUNDING_SEASON_NEXT_YEAR_LABEL,
  FOUNDING_SEASON_DECISION_MONTH_LABEL,
  FOUNDING_SEASON_AFTER_LINE,
  foundingSeasonOfferLine,
} from './plan-config';

// ── Derived words: plan names, prices, dates ──────────────────────────────────
// Every customer-visible number and date in the bodies below comes from one of these.

const PLUS = PLAN_CONFIG.tournament_plus.label;
const PORTAL = PLAN_CONFIG.team.label;
const CLUB = PLAN_CONFIG.club.label;
const FREE_PLAN = PLAN_CONFIG.tournament.label;

const PLUS_MONTHLY = `${formatPriceAmount(PLAN_CONFIG.tournament_plus.monthlyPrice)}/month`;
const PLUS_ANNUAL = `${formatPriceAmount(PLAN_CONFIG.tournament_plus.annualPrice)}/year`;
const PORTAL_MONTHLY = `${formatPriceAmount(PLAN_CONFIG.team.monthlyPrice)}/month`;
const PORTAL_ANNUAL = `${formatPriceAmount(PLAN_CONFIG.team.annualPrice)}/year`;

/** "your 2028 season" — what the end-of-season ask is actually about (D3, annual first). */
const NEXT_SEASON = `your ${FOUNDING_SEASON_NEXT_YEAR_LABEL} season`;

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
  // ── The founding-season lifecycle ───────────────────────────────────────────
  "founding_welcome": {
    label: "Founding — Welcome",
    description: `Sent to each new founding org owner at signup (transactional). Confirms free ${PLUS} through ${FOUNDING_SEASON_END_LABEL}.`,
    subject: `Your Founding Season starts now — free through ${FOUNDING_SEASON_END_LABEL}`,
    heading: "Your Founding Season starts now.",
    variables: ["firstName", "orgName", "setupUrl"],
    audience: 'founding',
    isTransactional: true,
    timing: { kind: 'trigger', when: 'At signup' },
    audienceLabel: 'Each new founding org owner (transactional)',
    body: `Hi {{firstName}},

You're in. **{{orgName}}** is set up on FieldLogicHQ, and **${PLUS} is free through ${FOUNDING_SEASON_END_LABEL}** — your whole ${FOUNDING_SEASON_YEAR_LABEL} season. Normally ${PLUS_MONTHLY}. No credit card.

::callout What ${PLUS} gives you
- Auto-scheduling across any number of fields and time slots
- Single and double-elimination brackets
- Team communications and announcements
- As many tournaments as you run — no cap
- Tournament archives — every past event preserved
::end

::button Set up your first tournament → | {{setupUrl}}

${FOUNDING_SEASON_AFTER_LINE}

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
    body: `Hi {{firstName}},

It's been **{{weeksPhrase}}** since **{{orgName}}** joined FieldLogicHQ.

::if hasActivity
::callout Season so far
You've run **{{tournamentsPhrase}}** — **{{gamesPhrase}} played**.
That's {{gameCount}} schedule exports and score entries you didn't have to do in a spreadsheet.
::end
::button Set up another tournament → | {{setupUrl}}
::else
You haven't run your first tournament yet — and you have your whole ${FOUNDING_SEASON_YEAR_LABEL} season on ${PLUS} to do it in.

If you have an event coming up, now's the time to set it up:
::button Set up a tournament → | {{setupUrl}}
::end

We're also curious: what's working, and what isn't? Reply and tell us.

${PLUS} is free for **{{orgName}}** through **${FOUNDING_SEASON_END_LABEL}**. ${FOUNDING_SEASON_AFTER_LINE}

— The FieldLogicHQ team`,
  },

  // ── The summer sequence: choose a plan for the next season ──────────────────
  // Three sends, from four months out to two weeks out, all keyed to the day the free season
  // ends. The card ask opens with the first of them (FOUNDING_SEASON_CARD_WINDOW_OPEN) —
  // nothing anywhere in the product asks for a card before it.
  "founding_renewal": {
    label: "Founding — Choose your plan",
    description: `Sent when the card window opens. Explains what happens on ${FOUNDING_SEASON_FIRST_CHARGE_LABEL} and opens the ${FOUNDING_SEASON_NEXT_YEAR_LABEL} plan choice, annual first.`,
    subject: `Your free season ends ${FOUNDING_SEASON_END_LABEL} — choose your ${FOUNDING_SEASON_NEXT_YEAR_LABEL} plan`,
    heading: `Your free season ends ${FOUNDING_SEASON_END_LABEL}.`,
    variables: ["firstName", "orgName", "hasHistory", "hasActive", "activePhrase", "hasPast", "pastPhrase", "billingUrl", "planCompareUrl"],
    audience: 'founding',
    timing: { kind: 'date', plannedSendDate: '2027-06-01' },
    audienceLabel: 'All founding season org owners',
    body: `Hi {{firstName}},

**{{orgName}}** has run on ${PLUS} at no cost since you joined. That free season ends on **${FOUNDING_SEASON_END_LABEL}** — and this is the early note, not the last one.

::callout.blue What you're choosing
A plan for ${NEXT_SEASON} — **annual or monthly**. ${PLUS} is **${PLUS_ANNUAL}** or **${PLUS_MONTHLY}**. Annual suits most seasons: a year of tournaments paid once, in the month you're already doing the budget.
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

You can add a card now and choose the plan later. Nothing is charged before **${FOUNDING_SEASON_FIRST_CHARGE_LABEL}**.

::button Add a payment method — takes 2 minutes → | {{billingUrl}}

**If ${PLUS} isn't right for ${FOUNDING_SEASON_NEXT_YEAR_LABEL}, there is nothing to cancel.** On ${FOUNDING_SEASON_FIRST_CHARGE_LABEL}, **{{orgName}}** moves to the free ${FREE_PLAN} plan and keeps everything it built.

::link See the plans → | {{planCompareUrl}}

Questions? Reply to this email.

— The FieldLogicHQ team`,
  },
  "founding_nudge": {
    label: "Founding — Plan reminder",
    description: `Sent two months before the free season ends. A short reminder for anyone who has not chosen a ${FOUNDING_SEASON_NEXT_YEAR_LABEL} plan yet.`,
    subject: `Still time to choose your ${FOUNDING_SEASON_NEXT_YEAR_LABEL} plan`,
    heading: `Still time to choose your ${FOUNDING_SEASON_NEXT_YEAR_LABEL} plan.`,
    variables: ["firstName", "orgName", "hasCard", "billingUrl"],
    audience: 'founding',
    timing: { kind: 'date', plannedSendDate: '2027-08-01' },
    audienceLabel: 'All founding season org owners',
    body: `Hi {{firstName}},

A short follow-up: **{{orgName}}**'s free season on ${PLUS} ends on **${FOUNDING_SEASON_END_LABEL}**.

::if hasCard
Your payment method is on file, so there is nothing to do today. In ${FOUNDING_SEASON_DECISION_MONTH_LABEL} you'll pick annual or monthly, and that is the whole decision.
::else
Nothing has been charged, and nothing will be before **${FOUNDING_SEASON_FIRST_CHARGE_LABEL}**. If you already know you're continuing, adding a card now takes two minutes and takes it off your list:
::button Add a payment method → | {{billingUrl}}
::end

::callout What it costs from ${FOUNDING_SEASON_FIRST_CHARGE_LABEL}
${PLUS} is **${PLUS_ANNUAL}** or **${PLUS_MONTHLY}**. The year is one payment, in the month you're planning the season anyway.
::end

If ${PLUS} isn't right for ${FOUNDING_SEASON_NEXT_YEAR_LABEL}, there is nothing to cancel. **{{orgName}}** moves to the free ${FREE_PLAN} plan and keeps everything it built.

— The FieldLogicHQ team`,
  },
  "founding_final": {
    label: "Founding — Final notice",
    description: `Sent about two weeks before the free season ends. The last note before ${FOUNDING_SEASON_FIRST_CHARGE_LABEL}.`,
    subject: `Last note before your free season ends ${FOUNDING_SEASON_END_LABEL}`,
    heading: `Your free season ends ${FOUNDING_SEASON_END_LABEL}.`,
    variables: ["firstName", "orgName", "hasCard", "billingUrl"],
    audience: 'founding',
    timing: { kind: 'date', plannedSendDate: '2027-09-15' },
    audienceLabel: 'All founding season org owners',
    body: `Hi {{firstName}},

This is the last note before **{{orgName}}**'s free season ends on **${FOUNDING_SEASON_END_LABEL}**.

::if hasCard
Your payment method is on file, so the only thing left is the choice itself: **${PLUS_ANNUAL}** or **${PLUS_MONTHLY}** from ${FOUNDING_SEASON_FIRST_CHARGE_LABEL}.
::button Choose your ${FOUNDING_SEASON_NEXT_YEAR_LABEL} plan → | {{billingUrl}}
::else
To keep ${PLUS} from ${FOUNDING_SEASON_FIRST_CHARGE_LABEL}, choose a plan for ${NEXT_SEASON}:
::button Choose your ${FOUNDING_SEASON_NEXT_YEAR_LABEL} plan → | {{billingUrl}}

**If you'd rather not continue, you don't have to do anything.** On ${FOUNDING_SEASON_FIRST_CHARGE_LABEL}, **{{orgName}}** moves to the free ${FREE_PLAN} plan — one active tournament, manual scheduling, no cost — and every team, score and archive you have built stays exactly where it is.
::end

Thank you for running your season with us. You were one of the first.

— The FieldLogicHQ team`,
  },

  // ── The acquisition push: the Coaches Portal, while the signup window is open ─
  "spotlight_coaches_org": {
    label: "Spotlight — Coaches Portal (to orgs)",
    description: `Sent to org owners during the signup window. Pitches the ${PORTAL} for the coaches on their teams.`,
    subject: `For the coaches on your teams — free through ${FOUNDING_SEASON_END_LABEL}`,
    heading: "For the coaches on your teams — a workspace that's actually theirs.",
    variables: ["firstName", "coachShareUrl", "interestUrl"],
    audience: 'founding',
    timing: { kind: 'date', plannedSendDate: '2026-10-01' },
    audienceLabel: 'Org owners',
    body: `Hi {{firstName}},

The coaches managing teams in your tournaments are tracking rosters in group texts, lineups in notes apps, and team fees in someone's head.

::callout The ${PORTAL} gives them one place for all of it
- Full roster management with season history
- Lineup builder — plan your starting lineup, export to PDF
- Team budget and player dues tracking
- Document management: consent forms, medical notes, eligibility files
::end

It works whether or not a coach's team is registered in a tournament you run on FieldLogicHQ. A coach can sign up on their own and run their team year-round.

${foundingSeasonOfferLine('team')} Normally ${PORTAL_MONTHLY} or ${PORTAL_ANNUAL} — or included when your organization is on ${CLUB}.

Know a coach who'd use it? They can start today:
::link Send them this link → | {{coachShareUrl}}

Want the details first?
::button See the ${PORTAL} → | {{interestUrl}}

— The FieldLogicHQ team`,
  },
  "spotlight_coaches_coach": {
    label: "Spotlight — Coaches Portal (to coaches)",
    description: `Sent to coach accounts during the signup window. Pitches the standalone ${PORTAL}.`,
    subject: `Your team's season workspace — free through ${FOUNDING_SEASON_END_LABEL}`,
    heading: "Your team's season workspace.",
    variables: ["firstName", "interestUrl"],
    audience: 'coaches',
    timing: { kind: 'date', plannedSendDate: '2026-10-01' },
    audienceLabel: 'Coach accounts (tournament participants)',
    body: `Hi {{firstName}},

You've been through a tournament on FieldLogicHQ. But managing your team between tournaments is still probably spread across your phone, your email, and your memory.

::callout The ${PORTAL} is built for exactly that
- Your full roster, season over season
- Lineups you can plan, save, and export to PDF
- Team budget: dues in, expenses out, who owes what
- Documents in one place — consent, medical, eligibility
::end

No organization account required. Your team's workspace, on your timeline.

${foundingSeasonOfferLine('team')} Normally ${PORTAL_MONTHLY} or ${PORTAL_ANNUAL}.

${FOUNDING_SEASON_AFTER_LINE}

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
    body: `Hi {{firstName}},

You're one of the first organizations running on FieldLogicHQ. Here's where things stand, and where they're going.

::callout What's live today
- **${FREE_PLAN}** — registration, manual scheduling, brackets, live scores and archives, free with no end date
- **${PLUS}** — everything above plus auto-scheduling, and as many tournaments as you run
- **The ${PORTAL}** — a full season workspace for one team: roster, lineups, budget, dues, documents
::end

${foundingSeasonOfferLine()}

::callout.blue What's coming
- More ways for families to follow their teams
- Deeper reporting on the money side of a season
- And more, shaped by what this first season has taught us
::end

You helped build this — by running real events on the platform and telling us what worked and what didn't.

If you know another tournament organizer or coach who should be here, the Founding Season is open until **${FOUNDING_SEASON_SIGNUP_CLOSE_LABEL}**:
::link Share FieldLogicHQ → | {{shareUrl}}

There is nothing to do about billing. ${FOUNDING_SEASON_AFTER_LINE}

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
    retired: { on: '2026-09-07', why: 'Club is a parked product' },
    body: "Hi {{firstName}},\n\nMost clubs are planning their September season right now.\nTryouts. Rep team rosters. League registrations. Budget prep.\n\nIf you're managing all of that across multiple tools — this is worth 15 minutes.\n\n::callout Club on FieldLogicHQ puts your entire organization in one place\n- Tournaments: same tools you're already using on your founding season\n- House League: registration, draft, schedule, standings, parent notifications — no manual emails\n- Rep Teams: tryouts, roster, lineups, and team budget — coaches run their own programs; your executive team gets the visibility\n- Accounting: org ledger, team invoicing, budget vs. actual\n::end\n\nYour executive team sees everything. Your coaches run their own teams.\nNobody is sending weekly update emails.\n\nClub is normally **from $219/month**, unlimited staff seats.\nAs a founding organization, **Club is free through December 31, 2026**.\n\nIf you're starting a September season, the time to set this up is now — not after you're three months in on the same old process.\n\n::button Start on Club — free through December 31 → | {{setupUrl}}\n\nQuestions about whether Club is right for **{{orgName}}**? Reply to this email.\n\n— The FieldLogicHQ team",
  },
  "spotlight_league": {
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
