/**
 * Plan & billing vocabulary, keyed by concept (PLAN_AND_BILLING_COPY.md).
 * Part 1 prepares the ruled vocabulary for the shared body; owner decisions are in plan section 9.
 * Existing free-time, Stripe-fee, availability and status builders remain their own single sources.
 */
import {
  formatPriceAmount, formatAnnualSavings, gatedPlanTag, gatedPlanNote,
  FOUNDING_SEASON_END_LABEL as END, FOUNDING_SEASON_FIRST_CHARGE_LABEL as FIRST,
  FOUNDING_SEASON_DECISION_MONTH_LABEL as DECISION, FOUNDING_SEASON_NEXT_YEAR_LABEL as NEXT,
  PLAN_CONFIG, type BillingCycle,
} from './plan-config';
import { possessive, pluralize, joinWithAnd } from './utils';
import { formatStoredDate } from './timezone';
import { subscriptionStatusLabel, NO_LIMIT } from './platform-labels';
import { formatCardOnFile } from './billing-format';
import { freeTimeCopy } from './free-time-copy';
import { portalFreeTimeCopy, KEEP_PREMIUM_LINE, PORTAL_FREE_TIME_HOSTING_LINE } from './portal-free-time';
import { STRIPE_FEE_WORDS } from './online-payment-words';
import { PLAN_BILLING_TITLE } from './plan-billing-title';
import type { OrgPlan as OrgPlanKey } from './types';

const day = (iso: string) => formatStoredDate(iso, { longMonth: true });
/** The door that undoes a waiting cancel (Plans end at renewal, Stage 0 ruling 2): "Keep {Plan}", and "Keep Premium" for a Coaches Portal. */
const keepDoor = (plan: OrgPlanKey) => plan === 'team' ? 'Keep Premium' : `Keep ${PLAN_CONFIG[plan].label}`;
const cycle = (value: BillingCycle) => value === 'annual' ? 'yearly' : 'monthly';
const period = (value: BillingCycle) => value === 'annual' ? 'year' : 'month';
const price = (amount: number, billing: BillingCycle) => amount === 0 ? formatPriceAmount(amount) : `${formatPriceAmount(amount)} CAD / ${period(billing)}`;
const perTeam = 'per team';
const coachMonthlyPrice = () => `${price(PLAN_CONFIG.team.monthlyPrice, 'monthly')} ${perTeam}`;

export const PLAN_BILLING_WORDS = {
  coverage: {
    eyebrow: 'Plan',
    title: (club: string) => `Covered by ${club}`,
    body: 'Your club pays for this team’s Coaches Portal. There is nothing to manage here.',
  },
  coachUpsell: {
    perTeam,
    normally: () => `normally ${coachMonthlyPrice()}`,
    shelf: (founding: boolean) => founding
      ? `Premium is free through ${END} — normally ${coachMonthlyPrice()}.`
      : `Premium is ${coachMonthlyPrice()}.`,
    ceiling: (founding: boolean) => founding
      ? `Free through ${END} — normally ${coachMonthlyPrice()}. No credit card required.`
      : `${coachMonthlyPrice()}, cancel anytime.`,
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
    /** Stage 0 Part 6: what the subscription charges (cents), in the same words as `price` ("$29 CAD / month", "$34.50 …"). */
    paidPrice: (cents: number, billing: BillingCycle) => cents % 100 === 0 ? price(cents / 100, billing)
      : `$${(cents / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CAD / ${period(billing)}`,
    fromPrice: (amount: number) => amount === 0 ? formatPriceAmount(amount) : `From ${formatPriceAmount(amount)} CAD / month`,
    billed: (billing: BillingCycle) => `billed ${cycle(billing)}`,
    renews: (iso: string) => `Renews ${day(iso)}`,
    trialEnds: (iso: string) => `Trial ends ${day(iso)}`,
    status: subscriptionStatusLabel,
    payment: 'Payment method & invoices', openingPortal: 'Opening payment portal…', openingCheckout: 'Opening checkout…',
    paymentHelp: 'Open the secure billing portal for payment methods, invoices, and billing details.',
    pastDue: 'Your last payment didn’t go through. Everything stays open during the grace period — update your card in Payment method & invoices to keep it that way.',
    scheduled: (label: string, iso: string | null) => `Moves to ${label}${iso ? ` on ${day(iso)}` : ' at renewal'}.`,
    scheduledFrom: (iso: string | null) => `From ${iso ? formatStoredDate(iso, { withYear: false }) : 'renewal'}`,
    keep: (label: string) => `Keep ${label}`,
    kept: (org: string, label: string) => `${org} stays on ${label}.`,
    savings: formatAnnualSavings,
    // A conditional sentence only; eligibility/duration must come from checkout, not default config.
    // The public Club helper is changed in its separate /marketing step (T1).
    trial: (eligible: boolean, days: number | null) => eligible && days !== null && days > 0
      ? `${days}-day trial — you add a payment method at checkout, and you're first charged when the trial ends.`
      : 'Payment details collected in Stripe',
  },
  // The payment step an Upgrade opens: the cycle is chosen where the money is committed, not above a table that shows both.
  pay: {
    title: (label: string) => `How would you like to pay for ${label}?`,
    monthlyHelp: 'Billed every month.', annualHelp: 'Billed once a year.',
    cycleLabel: 'Billing', continue: 'Continue to checkout', cancel: 'Cancel',
  },
  usage: {
    teams: 'Teams', tournaments: 'Tournament slots', seats: 'Staff seats', unlimited: 'Unlimited', loading: 'Loading…',
    teamCount: (count: number, limit: number) => `${count} of ${limit >= NO_LIMIT ? 'unlimited' : limit} teams`,
    teamPolicy: (label: string, limit: number) => `${label} holds up to ${limit} teams. Archived teams don’t count.`,
    tournamentCount: (count: number, limit: number) => limit >= NO_LIMIT
      ? `${pluralize(count, 'tournament slot')} · unlimited`
      : `${count} of ${pluralize(limit, 'tournament slot')}`,
    staffCount: (count: number, limit: number) => limit >= NO_LIMIT
      ? `${pluralize(count, 'staff seat')} · unlimited`
      : `${count} of ${pluralize(limit, 'staff seat')}`,
    freeOfficials: (count: number) => `· ${pluralize(count, 'scorekeeper')} free`,
    customTeams: (limit: number, org: string) => `Your plan holds up to ${limit} teams, a custom limit for ${org}. Archived teams don’t count.`,
    fullTeams: (org: string, limit: number, label: string, target: string) => `${org} holds ${limit} teams on ${label}, its limit. Move to ${target} to add more.`,
    fullContact: (org: string, limit: number, label: string) => `${org} holds ${limit} teams on ${label}, its limit. Contact us to add more.`,
    growingTeams: (label: string, limit: number, target: string, targetLimit: number) => `${label} holds up to ${limit} teams. Archived teams don’t count. Growing past ${limit}? ${target} holds ${targetLimit}.`,
    largestTeams: (label: string, limit: number) => `${label} holds up to ${limit} teams. Archived teams don’t count. More than ${limit}? Contact us for a custom plan.`,
    freeTeams: (label: string) => `Teams you add while ${label} is free are kept after it ends.`,
  },
  change: {
    headings: { plan: 'Plan', holds: 'Holds', monthly: 'Monthly', annual: 'Yearly', choice: 'Your choice' },
    current: 'Your plan', move: (label: string) => `Move to ${label}`,
    upgrade: (label: string) => `Upgrade to ${label}`, downgrade: (label: string) => `Downgrade to ${label}`,
    details: (label: string) => `See what ${label} includes`, contactMove: 'Contact us to move', contact: 'Contact us',
    upTo: (limit: number) => `Up to ${limit}`, range: (lower: number, upper: number) => `${lower} to ${upper}`,
    tournamentLimit: (limit: number) => limit >= NO_LIMIT ? 'Unlimited' : `${pluralize(limit, 'tournament')} at a time`,
    custom: (limit: number) => `More than ${limit} teams?`, customEnd: 'for a custom plan.',
    availabilityTag: gatedPlanTag, availabilityNote: gatedPlanNote,
    clubTitle: 'Part of a club?', joinClub: 'Join a club',
    clubBody: 'If your club runs on FieldLogicHQ, it can bring your team in. Everything the team built comes with it, and you won’t be charged for your own Coaches Portal again.',
    keepPremium: 'Keep Premium', keepPremiumHelp: KEEP_PREMIUM_LINE, hostingExcluded: PORTAL_FREE_TIME_HOSTING_LINE,
  },
  cancel: {
    orgBody: (org: string, offline: readonly string[], days: number) => `Cancelling suspends ${org}: ${joinWithAnd(offline)} go offline. Your data is kept for ${days} days. Reactivate within that time to restore the tools and records your plan allows.`,
    premiumBody: (days: number) => `Cancelling turns off Premium tools. Basic tournament records stay available. Premium team data is kept for ${days} days and comes back if you reactivate within that time.`,
    orgDoor: (org: string) => `Cancel and suspend ${org}…`, premiumDoor: 'Cancel Premium…',
    orgTitle: (org: string) => `Cancel and suspend ${org}?`, premiumTitle: 'Cancel Premium?',
    orgWarning: (org: string, offline: readonly string[]) => `${org} is suspended the moment you confirm: ${joinWithAnd(offline)} go offline, and families opening your pages will see that they aren’t available.`,
    premiumWarning: (days: number) => `Premium tools stop when you confirm. Premium team data is kept for ${days} days. Basic tournament records stay available in Coaches Portal.`,
    retained: (days: number) => `Your data is kept for ${days} days. Reactivate within that time to restore the tools and records your plan allows.`,
    archived: (count: number) => count > 0 ? `${pluralize(count, 'tournament')} ${count === 1 ? 'moves' : 'move'} into the archive until then.` : 'No tournament records need to be archived.',
    premiumRetained: (days: number) => `Roster, documents, team budget, schedule data, and local Premium tournament data stay restorable for ${days} days.`,
    offlineHeading: 'What goes offline', premiumOfflineHeading: 'Premium tools inactive',
    offlineHelp: (org: string) => `These areas are unavailable while ${org} is cancelled.`,
    premiumOfflineHelp: 'Basic tournament records stay available. These Premium tools stop when you confirm.',
    reason: 'Why are you cancelling?', reasonHelp: 'For your records and ours. You can leave it empty.',
    footer: (days: number) => `Your data is kept for ${days} days.`,
    confirm: 'Cancel and suspend', premiumConfirm: 'Cancel Premium', working: 'Suspending…', premiumWorking: 'Cancelling Premium…',
    // Approved replacement for the existing server wording; wire once with the shared body.
    accountingOffline: 'Accounting: ledgers, the club budget, allocations to teams',
    // Plans end at the renewal date (Stage 0 rulings 2–3, owner 2026-10-31): the door is "Keep {Plan}"; a Coaches Portal's is "Keep Premium".
    keepDoor,
    endingRefusal: (plan: OrgPlanKey, iso: string | null) => `Your plan ends${iso ? ` on ${day(iso)}` : ' at renewal'}. ${keepDoor(plan)} first, then change it.`,
    foreignSchedule: 'A change made outside FieldLogicHQ is waiting on this subscription, so it can’t be cancelled here. Contact us and we’ll sort it out.',
    stripeRefused: 'The payment provider didn’t accept the cancel. Nothing was changed — try again in a moment.',
    keepRefused: 'The payment provider didn’t accept the change. Your plan still ends on its date — try again in a moment.',
    notRecorded: 'Your cancel is scheduled with the payment provider. We’re still recording it here — refresh the page in a minute.',
    nothingToKeep: 'Your plan isn’t set to end, so there’s nothing to keep.',
    alreadyEnded: 'This plan has already ended.',
    moveNotRestored: (label: string) => `Your plan is kept. The move to ${label} at renewal couldn’t be put back — choose it again below.`,
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
  },
  founding: {
    price: `Free through ${END}`, eyebrow: 'Founding Season', endingEyebrow: `Founding Season · ends ${END}`,
    priceHelp: (annualAmount: number) => `Normally ${formatPriceAmount(annualAmount)} a year.`,
    title: (label: string) => `${label} is free through ${END}.`, endingTitle: `Your Founding Season ends ${END}.`,
    body: (label: string, amount: number, audience: 'coach' | 'organization') => `You're running ${label} free through ${END} as a founding ${audience} — normally ${formatPriceAmount(amount)}/month. No credit card. In ${DECISION} you'll choose a plan for your ${NEXT} season.`,
    endingBody: `Choose a plan for your ${NEXT} season below. Nothing is charged before ${FIRST}, and you can change your mind until then.`,
    chooseTitle: `Choose your ${NEXT} plan`,
    orgChoiceHelp: (label: string, freeLabel: string) => `You’re on ${label} today. Keep it for ${NEXT}, or move to the free ${freeLabel} plan when the season ends.`,
    coachChoiceHelp: (label: string) => `You’re on ${label} today. Keep it for ${NEXT}, or let it end on ${END} and keep your free Basic team records.`,
    choiceLabel: (label: string, billing: BillingCycle) => `${label} · ${cycle(billing)}`,
    guarantee: `First charge ${FIRST} · nothing before then`,
    choose: (label: string, billing: BillingCycle) => `Choose ${label} · ${cycle(billing)}`,
    decideLater: 'Prefer to decide later?', saveOnly: 'Save a card without choosing', chosen: `Your ${NEXT} season is set`,
    chosenTitle: (label: string, billing: BillingCycle) => `${label}, billed ${cycle(billing)} from ${FIRST}.`,
    chosenBody: (amount: number, card: string | null) => `${formatPriceAmount(amount)} will be charged${card ? ` to ${card}` : ''} on ${FIRST} — your first charge, and nothing before it. Your Founding Season runs free until then.`,
    missingPrice: 'Your next-season choice is recorded. We couldn’t load its price. Try again.',
    confirming: 'Confirming your next-season choice…',
    changeUntil: `You can change this until ${END}.`, change: 'Change plan or card',
    nothingTitle: 'If you choose nothing',
    coachNothing: `Your Premium portal ends on ${END}. Your team's Basic tournament records stay available, and your season's work is kept.`,
    orgNothing: (freeLabel: string) => `Your organization moves to the free ${freeLabel} plan on ${FIRST}. Your tournaments and records stay.`,
    noAction: `No billing action needed — your Founding Season runs free through ${END}. We'll remind you during the summer when it's time to choose a plan for ${NEXT}.`,
    card: (label: string | null) => `${label ? `${label} is on file.` : 'No payment method on file yet.'} Nothing is charged before ${FIRST}.`,
    addCard: 'Add payment method', updateCard: 'Update payment method',
    heldOffer: `No credit card — nothing is charged before ${FIRST}`, formatCard: formatCardOnFile,
  },
  notice: {
    active: 'Your plan is active. Everything it includes is open now.', cardSaved: 'Your payment method is on file.',
    foundingCardSaved: `Your payment method is on file. Nothing is charged before ${FIRST}. Your Founding Season stays free through ${END}.`,
    nextSeason: `Your next season is set. Nothing is charged before ${FIRST}. Your Founding Season stays free through ${END}, and you can change your choice until then.`,
    updated: (label: string, restored = 0, remaining = 0) => `Your plan is now ${label}.${restored ? ` ${pluralize(restored, 'retained tournament')} restored.` : ''}${remaining ? ` ${pluralize(remaining, 'retained tournament')} ${remaining === 1 ? 'remains' : 'remain'} in retention because ${remaining === 1 ? 'it exceeds' : 'they exceed'} this plan's limit.` : ''}`,
    downgraded: (label: string, count: number, days: number) => `Your plan is now ${label}.${count ? ` ${pluralize(count, 'tournament')} moved to retention for ${days} days.` : ''}`,
    cancelled: (org: string, days: number) => `${org} is cancelled. Your data is kept for ${days} days.`,
    premiumCancelled: (days: number) => `Premium is cancelled. Basic tournament records stay available. Premium team data is kept for ${days} days.`,
  },
  errors: {
    retry: 'Try again', retrying: 'Trying again…', refresh: 'We couldn’t refresh your organization. Try again.',
    nextSeasonRead: 'We couldn’t confirm your next-season choice yet. Try again.',
    portal: 'The payment portal didn’t open. Try again.', card: 'Card setup didn’t open. Try again.',
    checkout: 'Checkout didn’t open. Try again.', keep: 'Keeping your current plan didn’t go through. Try again.',
    cancelReview: 'The cancellation review didn’t load. Try again.', cancel: 'The cancellation didn’t go through. Try again.',
    nextSeason: 'Your next-season choice didn’t go through. Try again.', downgradeReview: 'The plan-change review didn’t load. Try again.',
    downgrade: 'The plan change didn’t go through. Try again.', generic: 'Something went wrong. Try again.',
    read: (section: string) => `We couldn’t load ${section}. Try again.`,
    movePreview: 'The move couldn’t be checked. Try again.', movePreviewNetwork: 'The move couldn’t be checked. Check your connection and try again.',
    move: 'The move didn’t go through. Try again.', moveNetwork: 'The move didn’t go through. Check your connection and try again.',
    checkoutNetwork: 'Checkout didn’t open. Check your connection and try again.',
  },
  downgrade: {
    title: (label: string) => `Downgrade to ${label}?`, close: 'Close', applying: 'Applying…',
    when: 'This takes effect today and ends your subscription. Nothing is credited for the rest of the current period.',
    capacity: (limit: number) => limit >= NO_LIMIT ? 'Unlimited tournaments.' : limit === 1
      ? 'One tournament at a time: a draft or an active event holds the slot, and a finished one stays online.'
      : `${limit} tournaments at a time: drafts and active events hold the slots, and finished ones stay online.`,
    inUse: (count: number) => `In use now: ${count}.`,
    lost: (target: string, current: string, features: readonly string[]) => `Moving to ${target} turns off these tools that come only with ${current}: ${joinWithAnd(features)}. Saved branding is kept; public tournament pages use FieldLogicHQ defaults until you upgrade again.`,
    choose: (count: number, days: number) => `Choose ${pluralize(count, 'tournament')} to keep active. The rest move to archive retention for ${days} days.`,
    fits: 'Your current tournament usage fits this plan. No tournaments need to move into retention.',
    reason: 'Why are you downgrading?', reasonHelp: 'For your records and ours. You can leave it empty.',
    keep: (label: string) => `Keep ${label}`, confirm: (label: string) => `Downgrade to ${label}`,
  },
  move: {
    title: (label: string) => `Move to ${label}?`, loading: 'Loading what the move changes…',
    moving: 'Moving…', close: 'Close', cancel: 'Cancel', repTeams: 'Go to Rep teams', checkout: 'Continue to checkout',
    up: (org: string, label: string, limit: number) => `${org} moves to ${label} today and can hold up to ${limit} teams.`,
    today: 'Today, for the rest of this billing period',
    from: (iso: string | null) => `From ${iso ? day(iso) : 'your next renewal'}`,
    previewHelp: 'Same subscription and payment method, with no second checkout. The prorated amount comes from Stripe before you confirm.',
    down: (org: string, label: string, limit: number, iso: string | null) => `${org} moves to ${label}${iso ? ` on ${day(iso)}` : ' at your next renewal'}, and can hold up to ${limit} teams from then.`,
    downHelp: (label: string, amount: string, billing: BillingCycle) => `You keep ${label} until then, with no credit for the rest of this period. From then it’s ${amount} CAD / ${period(billing)}.`,
    tooSmall: (label: string, limit: number, org: string, active: number) => `${label} holds ${limit} teams and ${org} has ${active} active. Archive ${pluralize(active - limit, 'team')} first, then come back.`,
    noSubscription: (org: string, label: string, amount: number, billing: BillingCycle) => `${org} isn’t paying for a subscription yet, so there’s no subscription to change. This starts ${label} (${formatPriceAmount(amount)} CAD / ${period(billing)}) at checkout, where you add a payment method.`,
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
    amount: (amount: string, currency: string) => `${amount} ${currency.toUpperCase()}`,
    renewal: (amount: string, billing: BillingCycle, currency: string) => `${amount} ${currency.toUpperCase()} / ${period(billing)}`,
    billingKept: (billing: BillingCycle) => `Same subscription and payment method. Your ${cycle(billing)} billing stays ${cycle(billing)}. No second trial.`,
    payingFoot: 'Charged to the payment method you already use.',
    checkoutFoot: 'Next, you add a payment method on our secure payment page.',
    freeTitle: () => `Your ${PLAN_CONFIG.team.label} free time ends when your club starts`,
    freeWarning: (through: string | null) => `${through ? `Free through ${day(through)}. ` : ''}The days left don’t carry over. If you leave before finishing, nothing changes and your free time keeps running.`,
    trial: (days: number) => `${days}-day trial — you add a payment method at checkout, and you’re first charged when the trial ends.`,
    noTrial: 'You’ve had a subscription before, so there’s no second trial. The full charge is due today at checkout.',
    firstCharge: (iso: string | null) => iso ? `First charge, ${day(iso)}` : 'First charge when the trial ends',
    monthly: 'Monthly', yearly: 'Yearly', billing: 'Billing',
    checkAgain: 'Check again', previewFailed: 'We couldn’t check the charge. Please check again.',
    paymentFailing: 'Your last payment didn’t go through. Update your payment method first, then start your club.',
    cannotBecome: 'This portal can’t become a club. Contact us for help.',
    paymentProvider: 'We couldn’t reach the payment provider. Please check again.',
    priceMissing: 'This checkout is not configured yet. Contact us for help.',
    paymentSettings: 'Open payment settings',
    ending: (iso: string | null) => `${PLAN_CONFIG.team.label} is set to end${iso ? ` on ${day(iso)}` : ' at renewal'}. Open payment settings to keep your current subscription first, then start your club.`,
    finishing: 'Your upgrade is going through. Please don’t start another payment.',
    settingTitle: 'Setting up your club',
    settingBody: 'We’re setting up your club. Your team and everything in it stays as it is. Please don’t start another payment.',
    settingLoading: 'Setting up…',
    longerTitle: 'This is taking longer than usual',
    longerBody: 'Your club isn’t ready yet. Please don’t start another payment. Check again in a minute.',
    unconfirmedTitle: 'We couldn’t confirm your club is ready',
    unconfirmedBody: 'Please don’t pay again. Contact us and we’ll sort it out.',
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
  stripeFees: STRIPE_FEE_WORDS,
} as const;
