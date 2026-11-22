/**
 * Plan & billing vocabulary, keyed by concept (PLAN_AND_BILLING_COPY.md).
 * Part 1 prepares the ruled vocabulary for the shared body; owner decisions are in plan section 9.
 * Existing free-time, Stripe-fee, availability and status builders remain their own single sources.
 */
import {
  formatPriceAmount, formatAnnualSavings, gatedPlanTag, gatedPlanNote,
  PLAN_CONFIG, type BillingCycle,
} from './plan-config';
import { clubTrialLine } from './plan-trial-line';
import { possessive, pluralize, joinWithAnd } from './utils';
import { formatStoredDate } from './timezone';
import { subscriptionStatusLabel, NO_LIMIT } from './platform-labels';
import { freeTimeCopy } from './free-time-copy';
import { portalFreeTimeCopy, KEEP_PREMIUM_LINE, PORTAL_FREE_TIME_HOSTING_LINE } from './portal-free-time';
import { PLAN_BILLING_TITLE } from './plan-billing-title';
import type { OrgPlan as OrgPlanKey } from './types';
import { STATUS_WORD } from './tournament-status-words';
import { BILLING_TAX_WORDS } from './billing-tax';
import { BILLING_DOOR_ALERT_WORDS } from './billing-door-alert';

const day = (iso: string) => formatStoredDate(iso, { longMonth: true });
/** "November 30" — a date the sentence has already given with its year. */
const dayOnly = (iso: string) => formatStoredDate(iso, { longMonth: true, withYear: false });
/** The day the data clock runs out, counted from the end date — `retentionUntilFrom` in lib/plan-ending.ts on the server,
 *  which adds whole UTC days (here too, whatever the browser's zone). It cannot be imported: plan-ending imports these words. */
const retainedUntil = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();
/** The door that undoes a waiting cancel (Plans end at renewal, Stage 0 ruling 2): "Keep {Plan}", and "Keep Premium" for a Coaches Portal. */
const keepDoor = (plan: OrgPlanKey) => plan === 'team' ? 'Keep Premium' : `Keep ${PLAN_CONFIG[plan].label}`;
/** "Choose 1 tournament to keep active." — the Downgrade window's choice, its dated form, and the server's refusal. */
const chooseCount = (count: number) => `Choose ${pluralize(count, 'tournament')} to keep active.`;
// The team-count ruling (BUSINESS_DECISIONS 2026-11-19; words `/marketing`): a Club band's limit is the teams given a portal.
const WITH_PORTAL = `with a ${PLAN_CONFIG.team.label}`;
/** What a move up (and a start's wait) promises stays put. */
const MOVE_KEEPS = 'Your events, teams and staff stay where they are.';
const HOUSE_LEAGUE_UNLIMITED = 'House league teams are unlimited.';
const LOST_KEPT = 'Saved branding is kept; public tournament pages use FieldLogicHQ defaults until you upgrade again.';
/** "On December 5 the rest move to archive retention for 90 days." — undated, or naming the tournaments once the choice is made. */
const W_REST = (days: number, iso: string | null = null, names: readonly string[] = []) =>
  `${iso ? `On ${dayOnly(iso)} the rest` : 'The rest'} move to archive retention for ${days} days${names.length ? `: ${joinWithAnd(names)}` : ''}.`;
/** S4 Part 3: "goes back to free Tournament Plus through September 30, 2027" (no end date: "…goes back to free Tournament Plus"). */
const goesBackTo = (plan: OrgPlanKey, lastDay: string | null) =>
  `goes back to free ${PLAN_CONFIG[plan].label}${lastDay ? ` through ${day(lastDay)}` : ''}`;
const cycle = (value: BillingCycle) => value === 'annual' ? 'yearly' : 'monthly';
const period = (value: BillingCycle) => value === 'annual' ? 'year' : 'month';
const price = (amount: number, billing: BillingCycle) => amount === 0 ? formatPriceAmount(amount) : `${formatPriceAmount(amount)} CAD / ${period(billing)}`;
const perTeam = 'per team';
const coachMonthlyPrice = () => `${price(PLAN_CONFIG.team.monthlyPrice, 'monthly')} ${perTeam}`;

/** Stage 0 Part 6: what the subscription charges (cents), in the same words as `price` ("$29 CAD / month", "$34.50 …"). */
const paidPrice = (cents: number, billing: BillingCycle) => cents % 100 === 0 ? price(cents / 100, billing)
  : `$${(cents / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CAD / ${period(billing)}`;
/** The next charge for a plan: its subscription's own recorded charge (in CAD, the only currency these words say), else the
 *  price list. One rule for the billing page's Keep window and the Keep email (Plans end at renewal, Part C). */
/** Cents as a charge is quoted in the windows ("$133.00 CAD"): the same figure the move window draws with Intl. */
const cents = (amount: number, currency: string) =>
  `$${(amount / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency.toUpperCase()}`;
const PLUS_TAX = BILLING_TAX_WORDS.plusTax;
const PRICES_PLUS_TAX = BILLING_TAX_WORDS.pricesPlusTax;
/** A past-due account's end date (Plans end at renewal, Stage 3 F2): Stripe's retries can end it before the date. */
const SOONER = 'or sooner if your last payment can’t be collected';
const charge = (plan: OrgPlanKey, billing: BillingCycle, cents?: number | null, currency?: string | null) => currency === 'cad' && cents != null
  ? paidPrice(cents, billing)
  : price(billing === 'annual' ? PLAN_CONFIG[plan].annualPrice : PLAN_CONFIG[plan].monthlyPrice, billing);

export const PLAN_BILLING_WORDS = {
  /** The spoken label of the Plan & billing door's pill (rail + phone More) — Fee invoice alerts Part 2; the object lives in
   *  the tiny `billing-door-alert` module so the rail's bundle does not pull this whole file. */
  billingDoorAlert: BILLING_DOOR_ALERT_WORDS,
  coverage: {
    eyebrow: 'Plan',
    title: (club: string) => `Covered by ${club}`,
    body: 'Your club pays for this team’s Coaches Portal. There is nothing to manage here.',
  },
  coachUpsell: {
    perTeam,
    normally: () => `normally ${coachMonthlyPrice()}`,
    shelf: () => `Premium is ${coachMonthlyPrice()} ${PLUS_TAX}.`,
    ceiling: () => `${coachMonthlyPrice()} ${PLUS_TAX}, cancel any time.`,
  },
  page: {
    title: PLAN_BILLING_TITLE, eyebrow: 'Organization', loading: 'Loading plan & billing…',
    lockedTitle: 'Billing access required',
    lockedBody: (org: string) => `Only ${possessive(org)} owner can see and change the plan and how it’s paid.`,
    sections: { plan: 'Your plan', usage: "What's in use", change: 'Change plan', included: "What's included", cancel: 'Reduce or cancel' },
  },
  plan: {
    free: 'Free', monthly: 'Monthly', annual: 'Yearly', billing: 'Billing', unavailable: 'Billing status unavailable',
    price,
    paidPrice, charge,
    fromPrice: (amount: number) => amount === 0 ? formatPriceAmount(amount) : `From ${formatPriceAmount(amount)} CAD / month ${PLUS_TAX}`,
    billed: (billing: BillingCycle) => `billed ${cycle(billing)}`,
    renews: (iso: string) => `Renews ${day(iso)}`,
    trialEnds: (iso: string) => `Trial ends ${day(iso)}`,
    status: subscriptionStatusLabel,
    payment: 'Payment method & invoices', openingPortal: 'Opening payment portal…', openingCheckout: 'Opening checkout…',
    paymentHelp: 'Open the secure billing portal for payment methods, invoices, and billing details.',
    pastDue: 'Your last payment didn’t go through. Everything stays open during the grace period — update your payment method in Payment method & invoices to keep it that way.',
    scheduled: (label: string, iso: string | null) => `Moves to ${label}${iso ? ` on ${day(iso)}` : ' at renewal'}.`,
    scheduledFrom: (iso: string | null) => `From ${iso ? formatStoredDate(iso, { withYear: false }) : 'renewal'}`,
    keep: (label: string) => `Keep ${label}`,
    kept: (org: string, label: string) => `${org} stays on ${label}.`,
    // Plans end at the renewal date (Stage 0 ruling 1): a waiting cancel on the plan card's waiting-change line.
    ending: 'Ending',
    // Stage 3 finding F2 (owner 2026-11-05): a past-due account has not paid for the period, and Stripe's retries can end it
    // sooner than the date — the line never promises the date then.
    endsOn: (iso: string, trial: boolean, pastDue = false) => `Ends on ${day(iso)}, ${trial ? 'when the trial ends' : pastDue ? SOONER : 'the last day you paid for'}.`,
    renewsAs: (label: string) => `If you keep it, you renew as ${label}, the move you chose.`,
    savings: formatAnnualSavings,
    // A conditional sentence only; eligibility/duration must come from checkout, not default config.
    // T1 (2026-11-16): the ONE Club trial sentence, the public pricing card's own.
    trial: (eligible: boolean, days: number | null) => eligible && days !== null && days > 0
      ? clubTrialLine(days)
      : 'Payment details collected in Stripe',
  },
  // The payment step an Upgrade opens: the cycle is chosen where the money is committed, not above a table that shows both.
  pay: {
    title: (label: string) => `How would you like to pay for ${label}?`,
    monthlyHelp: 'Billed every month.', annualHelp: 'Billed once a year.',
    cycleLabel: 'Billing', continue: 'Continue to checkout', cancel: 'Cancel',
    trialLoading: 'Checking your trial…',
    // The plan panel's Upgrade opens this window (On-sale pages S4, drawing tab 7).
    panelHint: (savings: string) => `Opens the payment window: Monthly or Yearly (${savings}).`,
  },
  usage: {
    teams: 'Teams', tournaments: 'Tournament slots', seats: 'Staff seats', unlimited: 'Unlimited', loading: 'Loading…',
    teamCount: (count: number, limit: number) => `${count} of ${limit >= NO_LIMIT ? 'unlimited' : limit} teams`,
    teamPolicy: (label: string, limit: number) => `${label} holds up to ${limit} teams. Archived teams don’t count.`,
    tournamentCount: (count: number, limit: number) => limit >= NO_LIMIT
      ? `${pluralize(count, 'tournament slot')} · unlimited`
      : `${count} of ${pluralize(limit, 'tournament slot')}`,
    /** A7 (Premium's plan card, one column): the slot as a line, "1 of 1 tournament slot in use". */
    slotsInUse: (count: number, limit: number) => limit >= NO_LIMIT
      ? `${pluralize(count, 'tournament slot')} in use`
      : `${count} of ${pluralize(limit, 'tournament slot')} in use`,
    staffCount: (count: number, limit: number) => limit >= NO_LIMIT
      ? `${pluralize(count, 'staff seat')} · unlimited`
      : `${count} of ${pluralize(limit, 'staff seat')}`,
    freeOfficials: (count: number) => `· ${pluralize(count, 'scorekeeper')} free`,
    customTeams: (limit: number, org: string) => `Your plan holds up to ${limit} teams, a custom limit for ${org}. Archived teams don’t count.`,
    fullTeams: (org: string, limit: number, label: string, target: string) => `${org} holds ${limit} teams on ${label}, its limit. Move to ${target} to add more.`,
    fullContact: (org: string, limit: number, label: string) => `${org} holds ${limit} teams on ${label}, its limit. Contact us to add more.`,
    // On-sale pages S4 (call 37, the 2026-11-19 ruling): a Club band counts the teams given a Premium Coaches Portal.
    growingTeams: (label: string, limit: number, target: string, targetLimit: number) => `${label} holds up to ${limit} teams ${WITH_PORTAL}. ${HOUSE_LEAGUE_UNLIMITED} Archived teams don’t count. Growing past ${limit}? ${target} holds ${targetLimit}.`,
    largestTeams: (label: string, limit: number) => `${label} holds up to ${limit} teams ${WITH_PORTAL}. ${HOUSE_LEAGUE_UNLIMITED} Archived teams don’t count. More than ${limit}? Contact us for a custom plan.`,
    freeTeams: (label: string) => `Teams you add while ${label} is free are kept after it ends.`,
  },
  change: {
    headings: { plan: 'Plan', holds: 'At a glance', monthly: 'Monthly', annual: 'Yearly', choice: 'Your choice' },
    current: 'Your plan', move: (label: string) => `Move to ${label}`,
    // On-sale pages S4 (drawing tab 6): a free-time organization's "Your plan" row is the plan it is given.
    freeThrough: (lastDay: string) => `Free through ${formatStoredDate(lastDay)}`,
    upgrade: (label: string) => `Upgrade to ${label}`, downgrade: (label: string) => `Downgrade to ${label}`,
    details: (label: string) => `See what ${label} includes`, contactMove: 'Contact us to move', contact: 'Contact us',
    // Change-plan table, "At a glance" (owner 2026-11-22, /marketing): every cell says what the plan gives, in the same kind
    // of words. The team count is a fit line under the two Club rows ("for clubs with…"), never a headline cap, so Club
    // never reads as more limited than the plans above it.
    glance: (key: string, tournamentLimit: number, club: { lower: number; upper: number | null }): { main: string; fit?: string } => {
      const unlimited = tournamentLimit >= NO_LIMIT;
      if (key === 'league') return { main: 'Unlimited tournaments, plus house league seasons' };
      if (key === 'club') return { main: `Everything in ${PLAN_CONFIG.league.label}, plus rep teams and accounting`, fit: `For clubs with up to ${club.upper} teams` };
      if (key === 'club_large') return { main: `Everything in ${PLAN_CONFIG.club.label}`, fit: `For clubs with ${club.lower} to ${club.upper} teams` };
      return { main: unlimited ? 'Unlimited tournaments' : `${pluralize(tournamentLimit, 'tournament')} at a time` };
    },
    custom: (limit: number) => `More than ${limit} teams?`, customEnd: 'for a custom plan.',
    // On-sale pages S4, call 37: the one line under the table whenever a Club row shows; it absorbs "More than 30 teams?".
    countLine: (limit: number) => `${PLAN_CONFIG.club.label} and ${PLAN_CONFIG.club_large.label} count the teams you give a ${PLAN_CONFIG.team.label}. ${HOUSE_LEAGUE_UNLIMITED} More than ${limit}?`,
    // Call 41: a start left halfway (an abandoned door checkout), above the table while its plan is on sale.
    leftStart: { before: 'You were starting', after: (label: string) => `. Pick up where you left off with Upgrade to ${label} below.` },
    pricesPlusTax: PRICES_PLUS_TAX,
    availabilityTag: gatedPlanTag, availabilityNote: gatedPlanNote,
    clubTitle: 'Part of a club?', joinClub: 'Join a club',
    clubBody: 'If your club runs on FieldLogicHQ, it can bring your team in. Everything the team built comes with it, and you won’t be charged for your own Coaches Portal again.',
    // One spelling with the Keep {Plan} door (Stage 0 ruling 2): both mean "stay on Premium", and never share a screen.
    keepPremium: keepDoor('team'), keepPremiumHelp: KEEP_PREMIUM_LINE, hostingExcluded: PORTAL_FREE_TIME_HOSTING_LINE,
  },
  /**
   * FREE TIME CATCHES THE ENDING (On-sale pages S4 Part 3; call 40 option A, owner 2026-11-21). A paid plan that ends while
   * whole-plan free time still runs falls back to the free plan: the club stays open, nothing is suspended, nothing is
   * counted down. Said only where it is TRUE for that end date (`freeTimeCatchesEnd`): the table line says "while your
   * free time runs" (owner 2026-11-21: a yearly plan can outlast it), the cancel window, its section and the emails say it
   * only when free time covers the date they name. No end date: "…goes back to free Tournament Plus." /legal reads these.
   */
  fallBack: {
    goesBack: (org: string, plan: OrgPlanKey, lastDay: string | null) => `${org} ${goesBackTo(plan, lastDay)}.`,
    tableLine: (org: string, plan: OrgPlanKey, lastDay: string | null) =>
      `Starting a plan doesn’t end your free time. If the plan ends while your free time runs, ${org} ${goesBackTo(plan, lastDay)}.`,
    /** Reduce or cancel, for a cancel that waits for its date. */
    waitBody: (org: string, iso: string, plan: OrgPlanKey, lastDay: string | null, trialing = false, pastDue = false) =>
      `Cancelling ends ${possessive(org)} plan on ${day(iso)}, ${trialing ? 'when your trial ends' : pastDue ? SOONER : 'the end of the period you paid for'}. Then ${org} ${goesBackTo(plan, lastDay)}.`,
    /** Reduce or cancel, for an account with no paid period (it ends when the owner confirms). */
    nowBody: (org: string, plan: OrgPlanKey, lastDay: string | null) =>
      `Cancelling ends ${possessive(org)} plan when you confirm. Then ${org} ${goesBackTo(plan, lastDay)}.`,
    /** The door and the window's title and confirm: nothing is suspended, so they never say "suspend". */
    door: (label: string) => `Cancel ${label}…`, title: (label: string) => `Cancel ${label}?`, confirm: (label: string) => `Cancel ${label}`,
    /** The window's list of what the paid plan alone carried (the tournaments and the site stay). */
    stopsOn: (iso: string) => `What stops on ${dayOnly(iso)}`, stopsNow: 'What stops',
    /** Checkout's and the moves' refusal of a plan at or below a running free plan (`below_free_plan`). */
    belowFreePlan: (org: string, plan: OrgPlanKey) => `${org} already has ${PLAN_CONFIG[plan].label} as free time. Choose a plan above it, or contact us.`,
    /** The notice after a cancel that ended at once and fell back. */
    done: (label: string, org: string, plan: OrgPlanKey, lastDay: string | null) => `${label} has ended. ${org} ${goesBackTo(plan, lastDay)}.`,
  },
  cancel: {
    orgBody: (org: string, offline: readonly string[], days: number) => `Cancelling suspends ${org}: ${joinWithAnd(offline)} go offline. Your data is kept for ${days} days. Reactivate within that time to restore the tools and records your plan allows.`,
    premiumBody: (days: number) => `Cancelling turns off Premium tools. Basic tournament records stay available. Premium team data is kept for ${days} days and comes back if you reactivate within that time.`,
    orgDoor: (org: string) => `Cancel and suspend ${org}…`, premiumDoor: 'Cancel Premium…',
    orgTitle: (org: string) => `Cancel and suspend ${org}?`, premiumTitle: 'Cancel Premium?',
    premiumWarning: (days: number) => `Premium tools stop when you confirm. Premium team data is kept for ${days} days. Basic tournament records stay available in Coaches Portal.`,
    retained: (days: number) => `Your data is kept for ${days} days. Reactivate within that time to restore the tools and records your plan allows.`,
    archived: (count: number) => count > 0 ? `${pluralize(count, 'tournament')} ${count === 1 ? 'moves' : 'move'} into the archive until then.` : 'No tournament records need to be archived.',
    premiumRetained: (days: number) => `Roster, documents, team budget, schedule data, and local Premium tournament data stay restorable for ${days} days.`,
    offlineHeading: 'What goes offline', premiumOfflineHeading: 'Premium tools inactive',
    offlineHelp: (org: string) => `These areas are unavailable while ${org} is cancelled.`,
    premiumOfflineHelp: 'Basic tournament records stay available. These Premium tools stop when you confirm.',
    reason: 'Why are you cancelling?', reasonHelp: 'For your records and ours. You can leave it empty.',
    footer: (days: number) => `Your data is kept for ${days} days.`,
    confirm: 'Cancel and suspend', premiumConfirm: 'Cancel Premium', working: 'Cancelling…',
    // A cancel that waits for the renewal date (Plans end at renewal, Stage 1). The words above stay for an account with no
    // paid period, which still ends at the click.
    waitBody: (org: string, offline: readonly string[], iso: string, days: number, trialing = false, pastDue = false) => `Cancelling ends ${possessive(org)} plan on ${day(iso)}, ${trialing ? 'when your trial ends' : pastDue ? SOONER : 'the end of the period you paid for'}. Then ${joinWithAnd(offline)} go offline. Your data is kept for ${days} days after that. Reactivate within that time to restore the tools and records your plan allows.`,
    premiumWaitBody: (iso: string, days: number, trialing = false, pastDue = false) => `Cancelling turns off Premium tools on ${day(iso)}, ${trialing ? 'when your trial ends' : pastDue ? SOONER : 'the end of the period you paid for'}. Basic tournament records stay available. Premium team data is kept for ${days} days after that and comes back if you reactivate within that time.`,
    waitDoor: (label: string) => `Cancel ${label}…`, waitTitle: (label: string) => `Cancel ${label}?`,
    // Renewal Stage 4: the lead says plainly that nothing is taken away early (the ruling: paid ahead, no refund). It names the
    // PLAN payment (/legal + /accounting 2026-11-16).
    stays: (org: string, iso: string) => `${org} stays open until ${day(iso)}, the end of the period you paid for. Nothing is switched off before then, and no more plan payments are taken.`,
    premiumStays: (iso: string) => `Premium stays on until ${day(iso)}, the end of the period you paid for. No Premium tool stops before then, and no more Premium payments are taken.`,
    trialStays: (org: string, iso: string) => `Your trial ends on ${day(iso)}. ${org} keeps every tool until then, and no plan payment is taken.`,
    /** F2: the end-date clause for a past-due account (the plan card, the Cancel section, the emails). */
    sooner: SOONER,
    /** F2: past due — the failed payment can still be collected, and if it can't, Stripe's retries end the plan sooner. */
    pastDueStays: (name: string, iso: string, premium: boolean) => `Your last payment didn’t go through, and it is still due. If it’s collected, ${name} ${premium ? 'stays on' : 'stays open'} until ${day(iso)}. If it can’t be, ${name} ends sooner, on the day the payment provider stops trying.`,
    /** Stage 2 ruling 4: a cancel over a waiting move to the free plan replaces it — a later Keep returns the full plan. */
    replacesMove: (move: string, iso: string, current: string) => `You chose to move to ${move} on ${dayOnly(iso)}. Cancelling replaces that move. If you then keep ${current}, you stay on ${current}.`,
    moveSetAside: (move: string, iso: string | null, keep: string) => `You chose to move to ${move}${iso ? ` on ${dayOnly(iso)}` : ' at renewal'}. Cancelling sets that move aside. ${keep} before then and the move to ${move} comes back.`,
    keepAnyTime: (name: string, iso: string) => `You can keep ${name} any time before ${dayOnly(iso)}.`,
    /** The lines under the list of what goes offline (Cancel window redraw, owner 2026-11-05): when it is suspended and how long
     *  the data is kept, split out of the sentence that used to name every area a second time. */
    // `dated` false (F2, past due): the end can come sooner, so the kept-until date would be a promise it can't keep.
    suspendedThen: (org: string, iso: string, days: number, dated = true) => `${org} is suspended then, and your data is kept for ${days} days after that${dated ? `, until ${day(retainedUntil(iso, days))}` : ''}.`,
    premiumKeptThen: (iso: string, days: number, dated = true) => `Basic tournament records stay available. Premium team data is kept for ${days} days after that${dated ? `, until ${day(retainedUntil(iso, days))}` : ''}.`,
    suspendedNow: (org: string) => `${org} is suspended the moment you confirm, and families opening your pages will see that they aren’t available.`,
    offlineOn: (iso: string) => `What goes offline on ${dayOnly(iso)}`, premiumOfflineOn: (iso: string) => `Premium tools that stop on ${dayOnly(iso)}`,
    waitConfirm: (iso: string) => `Cancel on ${dayOnly(iso)}`,
    noPeriod: (name: string) => `${name} has no paid period to wait for, so it ends when you confirm.`,
    // Keep {Plan}: the question window (Stage 0 ruling 4) — it names the date and the charge before a card is committed again.
    keepTitle: (plan: OrgPlanKey) => `${keepDoor(plan)}?`,
    // GST/HST Stage 2 Part 3: the renewal charge is the price before tax, so it says so (T4).
    keepRenews: (org: string, label: string, iso: string, price: string) => `${org} stays on ${label} and renews on ${day(iso)} at ${price} ${PLUS_TAX}.`,
    keepTrial: (org: string, label: string, iso: string, price: string) => `${org} stays on ${label}. The trial ends on ${day(iso)}, and then it’s ${price} ${PLUS_TAX}.`,
    keepStaysUntil: (org: string, label: string, iso: string) => `${org} stays on ${label} until ${day(iso)}.`,
    keepThenMove: (move: string, price: string) => `Then it renews as ${move}, the move you chose, at ${price} ${PLUS_TAX}.`,
    keepNothingElse: 'Nothing else changes.',
    keepAndMove: (move: string) => `Keep and renew as ${move}`, notNow: 'Not now', keeping: 'Keeping…',
    // Approved replacement for the existing server wording; wire once with the shared body.
    accountingOffline: 'Accounting: ledgers, the club budget, allocations to teams',
    // Plans end at the renewal date (Stage 0 rulings 2–3, owner 2026-10-31): the door is "Keep {Plan}"; a Coaches Portal's is "Keep Premium".
    keepDoor,
    endingRefusal: (plan: OrgPlanKey, iso: string | null) => `Your plan ends${iso ? ` on ${day(iso)}` : ' at renewal'}. ${keepDoor(plan)} first, then change it.`,
    foreignSchedule: 'A change made outside FieldLogicHQ is waiting on this subscription, so it can’t be cancelled here. Contact us and we’ll sort it out.',
    stripeRefused: 'The payment provider didn’t accept the cancel. Nothing was changed — try again in a moment.',
    /** An immediate cancel ended the plan here, but the payment provider would not stop the subscription. */
    stripeNotStopped: 'Your plan was cancelled here, but the payment provider could not stop the subscription. Contact support to stop your billing.',
    keepRefused: 'The payment provider didn’t accept the change. Your plan still ends on its date — try again in a moment.',
    notRecorded: 'Your cancel is scheduled with the payment provider. We’re still recording it here — refresh the page in a minute.',
    nothingToKeep: 'Your plan isn’t set to end, so there’s nothing to keep.',
    alreadyEnded: 'This plan has already ended.',
    /** Stage 2: a cancel that could not replace a waiting move to the free plan — the move still waits, nothing was cancelled. */
    moveStillWaiting: 'Your move to the free plan is still waiting, so the cancel wasn’t made. Try again in a moment.',
    /** Finish this ending now (G3, staff): the refusals. The two outcomes are the record's own notices. */
    finish: {
      nothingWaiting: 'Nothing is waiting to end on this account, so there is nothing to finish.',
      notOverdue: 'This ending isn’t overdue yet. Stripe still has time to send its message.',
      noSubscription: 'This ending names no Stripe subscription, so Stripe can’t be read for it. Nothing was changed.',
      stripeUnread: 'Stripe couldn’t be read. Nothing was changed. Try again in a moment.',
      otherSubscription: 'This ending is for a subscription the club no longer pays on — it pays on another now. Nothing was changed. Check the Money tab.',
      // The two outcomes (Stage 0 Tab 6, "After"): done, and a wait that is nobody's fault.
      finishedLead: 'Finished.',
      /** S4 Part 3: free time was running, so the club went back to it instead of being suspended. */
      fellBack: (org: string, endedAt: string | null, plan: OrgPlanKey, emailed: boolean) => [
        `Stripe ended this subscription${endedAt ? ` on ${day(endedAt)}` : ''}.`,
        `Its free time was still running, so ${org} went back to free ${PLAN_CONFIG[plan].label} instead of being suspended.`,
        emailed ? 'The owner was emailed.' : '',
      ].filter(Boolean).join(' '),
      finished: (org: string, endedAt: string | null, tournaments: number, until: string | null, emailed: boolean) => [
        `Stripe ended this subscription${endedAt ? ` on ${day(endedAt)}` : ''}.`,
        tournaments > 0
          ? `${org} is suspended and ${tournaments === 1 ? 'its tournament is' : `its ${pluralize(tournaments, 'tournament')} are`} archived${until ? ` until ${day(until)}` : ''}.`
          : `${org} is suspended${until ? ` and its data is kept until ${day(until)}` : ''}.`,
        emailed ? 'The owner was emailed.' : '',
      ].filter(Boolean).join(' '),
      /** Stage 2: the waiting change was a move to the free plan — the club moved on its date, never suspended. */
      moved: (org: string, target: string, movedAt: string | null, tournaments: number, until: string | null) => [
        `Stripe ended this subscription${movedAt ? ` on ${day(movedAt)}` : ''}, so ${org} moved to ${target} as it chose. It is not suspended.`,
        tournaments > 0 ? `${tournaments === 1 ? 'One tournament it did not keep is' : `${pluralize(tournaments, 'tournament')} it did not keep are`} archived${until ? ` until ${day(until)}` : ''}.` : '',
      ].filter(Boolean).join(' '),
      liveLead: 'Nothing changed.',
      correctedLead: 'Record corrected.',
      // Stripe still bills it: the account is untouched; our record agrees with Stripe now, or already did (owner 2026-11-02).
      live: (nextDate: string | null, cancelScheduled: boolean, record: 'withdrawn' | 'rescheduled' | 'unchanged') => {
        const stripe = `Stripe says this subscription is still live${nextDate ? `${cancelScheduled ? ' and is set to end' : ' and renews'} ${day(nextDate)}` : ''}.`;
        if (record === 'withdrawn') return `${stripe} Nothing was cancelled there, so the waiting cancel is withdrawn here, as Stripe’s missed message would have done. The account was not touched.`;
        if (record === 'rescheduled') return `${stripe} Our record now waits for that date too, as Stripe’s missed message would have done. The account was not touched.`;
        return `${stripe} Our record is wrong, not the account. Check the Money tab, where Stripe and our record are compared.`;
      },
    },
    /** The operator's Keep: the same fact, said to staff about the owner's account. */
    moveNotRestoredStaff: (current: string, move: string, iso: string | null) => `The plan is kept and renews${iso ? ` on ${day(iso)}` : ''} as ${current}. The owner’s move to ${move} couldn’t be put back; they can choose it again under Change plan, or it renews at the ${current} price.`,
    moveNotRestored: (current: string, move: string, iso: string | null) => `Your plan is kept and renews${iso ? ` on ${day(iso)}` : ''} as ${current}. The move to ${move} couldn’t be put back. Choose it again under Change plan, or it renews at the ${current} price.`,
  },
  reactivate: {
    cancelled: (org: string) => `${org} is cancelled`, premiumCancelled: 'Premium is cancelled',
    chip: (iso: string | null) => iso ? `Cancelled ${formatStoredDate(iso, { withYear: false })}` : subscriptionStatusLabel('canceled'),
    title: (label: string) => `Reactivate ${label} and restore your data`,
    orgBody: 'Your plan is cancelled. Public pages and tools are suspended. Reactivate within the retention window to restore your data.',
    premiumBody: (until: string | null) => `Premium tools are inactive. Your Premium team data is kept ${until ? `until ${day(until)}` : 'during the retention window'}. Basic tournament records stay available.`,
    intro: 'Reactivating within the retention window restores:',
    publicSite: 'Your public site goes back online', portals: 'Coach portals within your plan’s team limit reopen',
    tournaments: 'Retained tournaments within your plan’s slot limit return', reminders: 'Retention reminders stop',
    premiumTools: 'Premium team tools reopen', premiumData: 'Your Premium team data comes back',
    keptUntil: (iso: string) => `Kept until ${day(iso)}.`,
    remainder: 'Records beyond your plan’s limits remain in retention until their retention deadline. Data past that deadline may no longer be available.',
    basicTitle: 'Basic records are still available',
    basicBody: 'Tournament registrations linked to your Basic coach team profile remain in Coaches Portal while Premium tools are inactive.',
    basicDoor: 'Open tournament records',
    premiumHelp: "Reactivate Premium to restore your team's tools and retained data.",
    action: (label: string) => `Reactivate ${label}`, premiumAction: 'Reactivate Premium', contact: 'Contact us to reactivate',
    pricesPlusTax: PRICES_PLUS_TAX,
  },
  notice: {
    active: 'Your plan is active. Everything it includes is open now.', cardSaved: 'Your payment method is on file.',
    updated: (label: string, restored = 0, remaining = 0) => `Your plan is now ${label}.${restored ? ` ${pluralize(restored, 'retained tournament')} restored.` : ''}${remaining ? ` ${pluralize(remaining, 'retained tournament')} ${remaining === 1 ? 'remains' : 'remain'} in retention because ${remaining === 1 ? 'it exceeds' : 'they exceed'} this plan's limit.` : ''}`,
    downgraded: (label: string, count: number, days: number) => `Your plan is now ${label}.${count ? ` ${pluralize(count, 'tournament')} moved to retention for ${days} days.` : ''}`,
    cancelled: (org: string, days: number) => `${org} is cancelled. Your data is kept for ${days} days.`,
    premiumCancelled: (days: number) => `Premium is cancelled. Basic tournament records stay available. Premium team data is kept for ${days} days.`,
    ending: (name: string, iso: string | null) => `${name} ends${iso ? ` on ${day(iso)}` : ' at renewal'}. You can keep it until then.`,
  },
  errors: {
    retry: 'Try again', retrying: 'Trying again…', refresh: 'We couldn’t refresh your organization. Try again.',
    portal: 'The payment portal didn’t open. Try again.',
    checkout: 'Checkout didn’t open. Try again.', keep: 'Keeping your current plan didn’t go through. Try again.',
    cancelReview: 'The cancellation review didn’t load. Try again.', cancel: 'The cancellation didn’t go through. Try again.',
    downgradeReview: 'The plan-change review didn’t load. Try again.',
    downgrade: 'The plan change didn’t go through. Try again.', generic: 'Something went wrong. Try again.',
    read: (section: string) => `We couldn’t load ${section}. Try again.`,
    movePreview: 'The move couldn’t be checked. Try again.', movePreviewNetwork: 'The move couldn’t be checked. Check your connection and try again.',
    move: 'The move didn’t go through. Try again.', moveNetwork: 'The move didn’t go through. Check your connection and try again.',
    checkoutNetwork: 'Checkout didn’t open. Check your connection and try again.',
  },
  downgrade: {
    title: (label: string) => `Downgrade to ${label}?`, close: 'Close', applying: 'Applying…',
    capacity: (limit: number) => limit >= NO_LIMIT ? 'Unlimited tournaments.' : limit === 1
      ? 'One tournament at a time: a draft or an active event holds the slot, and a finished one stays online.'
      : `${limit} tournaments at a time: drafts and active events hold the slots, and finished ones stay online.`,
    inUse: (count: number) => `In use now: ${count}.`,
    lostKept: LOST_KEPT,
    /** The window's openable row (Downgrade window redraw, owner 2026-11-05): the same loss, as a list you open. */
    toolsOff: (current: string) => `${current} tools turn off`,
    /** The sentence after the choices. `iso` dates it; `names` (once the choice is complete) says which tournaments it is. */
    rest: W_REST,
    /** The foot while the choice is open, and once it is made (the button's date is not repeated there). */
    pickNeeded: (count: number) => count === 1 ? 'Choose a tournament to continue.' : `Choose ${count} tournaments to continue.`,
    pickedFoot: (names: readonly string[]) => `${joinWithAnd(names)} ${names.length === 1 ? 'stays' : 'stay'} active.`,
    pickedCount: (chosen: number, allowed: number) => `${chosen} of ${allowed} chosen.`,
    choose: (count: number, days: number) => `${chooseCount(count)} ${W_REST(days)}`,
    fits: 'Your current tournament usage fits this plan. No tournaments need to move into retention.',
    reason: 'Why are you downgrading?', reasonHelp: 'For your records and ours. You can leave it empty.',
    keep: (label: string) => `Keep ${label}`, confirm: (label: string) => `Downgrade to ${label}`,
    // Plans end at the renewal date, Stage 2 (owner rulings 2026-11-03): a move to the free plan waits for its date.
    /** Another change while a move to the free plan waits (the one rule's refusal, named for what comes on the date). */
    waitingRefusal: (plan: OrgPlanKey, target: OrgPlanKey, iso: string | null) =>
      `Your plan moves to ${PLAN_CONFIG[target].label}${iso ? ` on ${day(iso)}` : ' at renewal'}. ${keepDoor(plan)} first, then change it.`,
    foreignSchedule: 'A change made outside FieldLogicHQ is waiting on this subscription, so the plan can’t be changed here. Contact us and we’ll sort it out.',
    stripeRefused: 'The payment provider didn’t accept the change. Nothing was changed — try again in a moment.',
    changedMeanwhile: 'Another change to this plan was just made. Refresh the page to see it.',
    /** A move with no paid period happened here, but the payment provider would not stop the (unpaid) subscription. */
    stripeNotStopped: 'Your plan was moved here, but the payment provider could not stop the subscription. Contact support to stop your billing.',
    /** The old immediate move to a cheaper PAID plan is closed: that move waits for renewal under Change plan (§1.3). */
    useTheMove: 'A move to a cheaper paid plan waits for your renewal date. Choose it under Change plan.',
    /** A Coaches Portal changes plan on its own billing page, never through a club's downgrade. */
    notHere: 'This plan isn’t changed here.',
    // Stage 2 Part B (screens): the Downgrade window's dated words (Stage 0 drawing, tab "Moves to the free plan").
    whenOn: (iso: string, current: string, trialing = false, pastDue = false) => trialing
      ? `This takes effect on ${day(iso)}, when your trial ends. Until then you keep every ${current} tool, and no plan payment is taken.`
      : `This takes effect on ${day(iso)}, ${pastDue ? SOONER : 'the end of the period you paid for'}. Until then you keep every ${current} tool. Nothing is credited.`,
    chooseOn: (count: number, iso: string, days: number) => `${chooseCount(count)} ${W_REST(days, iso)}`,
    chooseCount,
    confirmOn: (iso: string) => `Downgrade on ${dayOnly(iso)}`,
    /** No live paid period (ruling 3): the move still happens at the click, and the window says why. */
    noPeriod: (org: string) => `${org} has no paid period to wait for, so the move happens when you confirm.`,
    /** The band under the plan card while a move to the free plan waits (G2). The kept tournament's name is set in bold. */
    band: {
      eyebrow: (iso: string) => `On ${day(iso)}`,
      youKeep: 'You keep',
      archived: (names: readonly string[], days: number) => names.length > 0
        ? `${joinWithAnd(names)} ${names.length === 1 ? 'is' : 'are'} archived then and kept for ${days} days, so ${names.length === 1 ? 'it' : 'they'} can come back. So is any other tournament you make before then.`
        : `Any other tournament you make before then is archived then and kept for ${days} days, so it can come back.`,
      none: (target: string, limit: number, days: number) => `${target} holds ${limit === 1 ? 'one draft or active tournament' : `${limit} draft or active tournaments`} at a time. If you have more than that on the date, the newest ${limit === 1 ? 'is' : 'are'} kept and the rest are archived for ${days} days.`,
      // Stage 0 Ask 8, ruled 2026-11-04: the reason it is gone is not claimed (deleted, archived and finished all read alike).
      gone: (picked: boolean, newest: string, iso: string) => `${picked ? 'The tournament you chose to keep is no longer a draft or active event' : 'You haven’t chosen a tournament to keep'}, so choose the one you keep. If you don’t choose by ${dayOnly(iso)}, we keep ${newest}, your newest.`,
      change: 'Change which tournament you keep', choose: 'Choose the tournament you keep',
    },
    /** Change which tournament you keep (G2): a 520px form window over the waiting move's pick. */
    pick: {
      title: 'Change which tournament you keep', loading: 'Loading your tournaments…',
      intro: (org: string, target: string, iso: string, limit: number, days: number) => `On ${day(iso)}, ${org} moves to ${target}, which holds ${pluralize(limit, 'tournament')} at a time. Choose ${limit === 1 ? 'the one that stays' : `the ${limit} that stay`} active. The rest are archived then and kept for ${days} days.`,
      yourChoice: 'your choice so far', added: (iso: string) => `added ${dayOnly(iso)}`,
      /** A slot holder's status word, from the one home of status words. */
      status: (status: string) => STATUS_WORD[status as keyof typeof STATUS_WORD] ?? status,
      footer: (iso: string) => `Nothing changes until ${dayOnly(iso)}.`,
      save: 'Save choice', saving: 'Saving…',
      saved: (iso: string, names: readonly string[]) => `On ${day(iso)} you keep ${joinWithAnd(names)}.`,
    },
    /** The Keep window over a waiting move: the second sentence (a cancel's is "Nothing else changes."). */
    keepMoveOff: (target: string) => `The move to ${target} is called off, and no tournament is archived.`,
    noMoveWaiting: 'No move to the free plan is waiting, so there is no choice to change.',
    nothingToChoose: 'Every tournament you have fits the free plan, so there is nothing to choose.',
    pickTooLate: 'The date of your move has come, so the tournament you keep can no longer be changed.',
    pickGone: 'One of the tournaments you chose is no longer a draft or active event. Close this window and open it again to see the current list.',
  },
  move: {
    title: (label: string) => `Move to ${label}?`, loading: 'Loading what the move changes…',
    moving: 'Moving…', close: 'Close', cancel: 'Cancel', repTeams: 'Go to Rep teams', checkout: 'Continue to checkout',
    /**
     * A band move up's first sentence (On-sale pages S4 Part 2, drawing tab 5 note 3, /marketing 2026-11-21). A plan with no team
     * limit (League Plus) names none — it used to read "up to 9999 teams"; a Club band names what it counts. Never a Premium
     * coach's move (that window has its own words).
     */
    up: (org: string, plan: OrgPlanKey) => {
      const { label, teamLimit } = PLAN_CONFIG[plan];
      return teamLimit >= NO_LIMIT
        ? `${org} moves to ${label} today. ${MOVE_KEEPS}`
        : `${org} moves to ${label} today and can hold up to ${teamLimit} teams ${WITH_PORTAL}. ${MOVE_KEEPS}`;
    },
    today: 'Today, for the rest of this billing period',
    from: (iso: string | null) => `From ${iso ? day(iso) : 'your next renewal'}`,
    previewHelp: 'Same subscription and payment method, with no second checkout. The prorated amount and its tax come from Stripe before you confirm. No second trial.',
    /** Call 46 (owner 2026-11-21, every move up): a failing payment is refused before any figure, with the payment-method door. */
    paymentFailing: 'Your last payment didn’t go through. Update your payment method first, then move.',
    // GST/HST Stage 2 Part 3 (drawings tabs 2–4, ruled 2026-11-05).
    loadingCharge: 'Loading the charge…',
    chargeWaits: 'The charge shows once the address is complete.',
    addressDoor: 'Billing address',
    /** The press-time check found a different charge: nothing was charged (tab 3, frame 4). `button` is the window's own. */
    chargeChanged: (amount: number, currency: string, button: string) =>
      `The charge changed to ${cents(amount, currency)}. Nothing was charged. Check the figures, then press ${button} again.`,
    /** Under a renewal figure, and after any price a buyer is quoted before Stripe's page (T4). */
    plusTax: PLUS_TAX,
    down: (org: string, label: string, limit: number, iso: string | null) => `${org} moves to ${label}${iso ? ` on ${day(iso)}` : ' at your next renewal'}, and can hold up to ${limit} teams from then.`,
    downHelp: (label: string, amount: string, billing: BillingCycle) => `You keep ${label} until then, with no credit for the rest of this period. From then it’s ${amount} CAD / ${period(billing)} ${PLUS_TAX}.`,
    tooSmall: (label: string, limit: number, org: string, active: number) => `${label} holds ${limit} teams and ${org} has ${active} active. Archive ${pluralize(active - limit, 'team')} first, then come back.`,
    noSubscription: (org: string, label: string, amount: number, billing: BillingCycle) => `${org} isn’t paying for a subscription yet, so there’s no subscription to change. This starts ${label} (${formatPriceAmount(amount)} CAD / ${period(billing)} ${PLUS_TAX}) at checkout, where you add a payment method.`,
    notOnSale: (label: string, org: string) => `${label} isn’t open for purchase yet. Contact us and we’ll move ${org} for you.`,
    moved: (org: string, label: string) => `${org} is now on ${label}.`,
    scheduled: (org: string, label: string, iso: string | null) => `${org} moves to ${label}${iso ? ` on ${day(iso)}` : ' at renewal'}.`,
  },
  clubUpgrade: {
    title: 'Start your club', start: 'Start my club', starting: 'Starting your club…',
    name: 'Club name', nameHelp: 'Shown across your club’s pages. You can change it later.',
    namePlaceholder: 'For example, Falcons Baseball Association', nameEmpty: 'Enter your club’s name.',
    nameLong: (max: number) => `Keep the club name to ${max} characters or fewer.`,
    owner: 'You’ll become the owner of your club. Your team stays exactly where it is, and you stay its head coach.',
    address: 'Web address',
    addressValue: (slug: string) => `${(process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')}/${slug}`,
    addressHelp: 'Stays as it is, so links you have already sent keep working. You can change it any time in club settings.',
    charge: (label: string) => `${label} for the rest of this period`,
    credit: (label: string) => `Credit for unused ${label} time`, dueToday: 'Due today',
    /** The no-trial checkout quote's first row: the plan's price before tax, so the tax row has something to sit under. */
    firstPeriod: (label: string, billing: BillingCycle) => `${label}, first ${billing === 'annual' ? 'year' : 'month'}`,
    amount: (amount: string, currency: string) => `${amount} ${currency.toUpperCase()}`,
    renewal: (amount: string, billing: BillingCycle, currency: string) => `${amount} ${currency.toUpperCase()} / ${period(billing)}`,
    billingKept: (billing: BillingCycle) => `Same subscription and payment method. Your ${cycle(billing)} billing stays ${cycle(billing)}. No second trial.`,
    /** The window in two steps (owner 2026-11-16, drawings START_YOUR_CLUB_TWO_STEPS): the step line, the foot's buttons and
     *  the read-back that opens step 2. The step line is the New tournament wizard's own ("Step 1 of 3 · The tournament"). */
    stepLine: (at: number) => `Step ${at} of 2 · ${at === 1 ? 'Your club' : 'Review the charge'}`,
    next: 'Next', back: 'Back', nextFoot: 'The charge and terms come next.',
    readClub: 'Club', readAddress: 'Billing address', changeLabel: 'Change the club or its billing address',
    payingFoot: 'Charged to the payment method you already use.',
    checkoutFoot: 'Next, you add a payment method on our secure payment page.',
    freeTitle: () => `Your ${PLAN_CONFIG.team.label} free time ends when your club starts`,
    // No date = free time with no end date (owner ruling 2026-11-19): there are no "days left" to speak of.
    freeWarning: (through: string | null) => `${through ? `Free through ${day(through)}. The days left don’t carry over. ` : ''}If you leave before finishing, nothing changes and your free time keeps running.`,
    trial: (days: number) => clubTrialLine(days),
    // "plus applicable taxes" (On-sale pages S2, `/accounting` 2026-11-19): the card beside it shows the pre-tax price.
    noTrial: `You’ve had a subscription before, so there’s no second trial. The full charge, ${BILLING_TAX_WORDS.plusTax}, is due today at checkout.`,
    firstCharge: (iso: string | null) => iso ? `First charge, ${day(iso)}` : 'First charge when the trial ends',
    monthly: 'Monthly', yearly: 'Yearly', billing: 'Billing',
    checkAgain: 'Check again', previewFailed: 'We couldn’t check the charge. Please check again.',
    paymentFailing: 'Your last payment didn’t go through. Update your payment method first, then start your club.',
    cannotBecome: 'This portal can’t become a club. Contact us for help.',
    paymentProvider: 'We couldn’t reach the payment provider. Please check again.',
    priceMissing: 'This checkout is not configured yet. Contact us for help.',
    finishing: 'Your upgrade is going through. Please don’t start another payment.',
    settingTitle: 'Setting up your club',
    settingBody: 'We’re setting up your club. Your team and everything in it stays as it is. Please don’t start another payment.',
    settingLoading: 'Setting up…',
    longerTitle: 'This is taking longer than usual',
    longerBody: 'Your club isn’t ready yet. Please don’t start another payment. Check again in a minute.',
    unconfirmedTitle: 'We couldn’t confirm your club is ready',
    unconfirmedBody: 'Please don’t pay again. Contact us and we’ll sort it out.',
    // On-sale pages S4 (drawing tab 3): the same wait, for an organization starting League Plus, Club or Club · Association.
    startSettingTitle: (label: string) => `Setting up ${label}`,
    startSettingBody: (label: string, org: string) => `We’re setting up ${label} for ${org}. ${MOVE_KEEPS} Please don’t start another payment.`,
    startLongerBody: (label: string) => `${label} isn’t ready yet. Please don’t start another payment. Check again in a minute.`,
    startUnconfirmedTitle: (label: string) => `We couldn’t confirm ${label} is ready`,
    ready: 'Your club is ready',
    readyBody: (club: string) => `You’re the owner of ${club}. Your team is already in it, with you as head coach. A few things to set up first:`,
    setupLabel: 'Set up your club', nameStep: 'Name your club', addressStep: 'Check your web address',
    addressStepHelp: 'It is easiest to change before you share it.', change: 'Change',
    staffStep: 'Invite your staff', staffHelp: 'Board members and other coaches.', invite: 'Invite',
    publicStep: 'Set up your public site', publicHelp: 'Optional. Your club’s page for families.', open: 'Open',
    repTeams: 'Rep teams', teamHelp: 'Your team, as head coach. Everything it holds is unchanged.', openTeam: 'Open my team',
    loadingTeam: 'Loading your team…', teamReadFailed: 'We couldn’t load your team. Please check again.',
    noTeam: 'No coached team was found here. Open Rep teams to check your club’s teams.',
  },
  shelf: {
    title: 'Managing more than tournaments?',
    withCoach: 'If you also manage a team, a league program, or a full club outside your tournament, these are the next FieldLogicHQ workspaces to watch.',
    organization: 'For organizations running more than tournament weekends, these plans bring year-round programs, teams, and finances into the same operating system.',
    coach: 'For rep teams', league: 'For league programs', club: 'For full clubs', startCoach: 'Start your Coaches Portal',
  },
  freeTime: freeTimeCopy,
  portalFreeTime: portalFreeTimeCopy,
} as const;
