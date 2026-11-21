import Link from 'next/link';
import ViewerAwarePlans from './ViewerAwarePlans';
import EarlyAccessModalTrigger from '@/components/EarlyAccessModalTrigger';
import { BILLING_TAX_WORDS } from '@/lib/billing-tax';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import { getPlanConfigOverrides } from '@/lib/plan-config-db';
import {
  PLAN_CONFIG, formatPriceAmount, closedProgramPlansSentence,
  isPlanOpen, interestButtonLabel, gatedPlanSentence, closedPlansGroupTag, availableNowSentence,
  GATED_PLAN_INTEREST_LINE, PLAN_AVAILABLE_NOW, allProgramPlansOpen, anyProgramPlanOpen, PROGRAM_PLANS,
} from '@/lib/plan-config';
import { planTrialLine } from '@/lib/plan-trial-line';
import { FIELDLOGICHQ_CONTACT_EMAIL } from '@/lib/fieldlogichq-contact';
import type { OrgPlan } from '@/lib/types';
import { OFFERED_SPORT_OPTIONS } from '@/lib/sports';
import kit from '@/components/marketing/MarketingKit.module.css';
import faqStyles from '@/components/marketing/Faq.module.css';
import { FaqList, boardQuestions } from '@/components/marketing/BoardQuestions';
import { marketingMetadata } from '@/lib/marketing-metadata';
import styles from './page.module.css';

export const metadata = marketingMetadata({
  // W64 (ruled 2026-11-18): the words each audience would search.
  title: 'Plans and prices',
  description: 'Prices for tournaments, house leagues, clubs and coaches, in CAD. Tournament is free.',
  path: '/pricing',
});

const TRUST_SIGNALS = [
  'Billed in CAD — no conversion surprises',
  'No long-term contract — cancel any time',
  'Tournament is free — no credit card required',
  'Upgrade or downgrade at any time',
];

const BUYER_SEGMENTS: Array<{
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  featured?: boolean;
  href?: string;
  earlyAccess?: boolean;
  initialPlanInterest?: string[];
  initialFeaturesInterested?: string[];
}> = [
  {
    eyebrow: 'Tournament organizer',
    title: 'I run tournaments.',
    body: 'From your team list to final standings — free to start, no spreadsheets required.',
    href: '#org-plans',
    cta: 'See tournament plans',
  },
  // Live products lead (2026-08-08): the coach segment sits second, beside the other live door —
  // the two coming-soon segments follow. The coach entry's CTA flips with the gate below.
  {
    eyebrow: 'Coach or team manager',
    title: 'I manage one competitive team.',
    // No "free Coaches Portal" here (owner 2026-11-19): no marketing door sells the free portal; a coach gets it by
    // entering a tournament.
    body: 'The Premium Coaches Portal is the operations HQ for one competitive team — roster, lineups, budget, and schedule. No org account needed.',
    cta: interestButtonLabel(['team']),
    earlyAccess: true,
    initialPlanInterest: ['coaches_portal'],
    initialFeaturesInterested: ['roster', 'lineups', 'budget', 'team_documents'],
  },
  {
    eyebrow: 'House league administrator',
    title: 'I run a house league season.',
    body: 'Player registration, draft, scheduling, standings, and season-wide parent messaging — from opening day to final game, in one dashboard.',
    cta: interestButtonLabel(['league']),
    earlyAccess: true,
    initialPlanInterest: ['league'],
    initialFeaturesInterested: ['house_league', 'registration', 'public_site'],
  },
  {
    eyebrow: 'Club executive',
    title: 'I run a club with rep teams.',
    body: 'Tournaments, house league, rep teams, and accounting in one place. Coaches manage their teams; you see each team\'s roster, schedule and results without the constant check-ins.',
    // 2026-08-10 reroute: to the Club page, not straight to the interest form — that page now
    // carries both demo doors, and the form waits there. This also restores the section's own
    // promise ("you'll land in the right place"). League Plus above stays form-first on purpose:
    // its page has no demo to show yet.
    cta: 'See what Club includes',
    href: '/for-clubs',
  },
];

/**
 * W59 (on-sale pages S3): with League Plus, Club and Club · Association all on sale the picker has three doors, in the
 * bands' order, each jumping to its band. While one is closed the four-door picker above stays ("live products lead"
 * still orders it). The coach door names Premium only (owner 2026-11-19: no marketing door sells the free portal).
 */
const THREE_DOORS: typeof BUYER_SEGMENTS = [
  { ...BUYER_SEGMENTS[0], href: '#tournament-plans' },
  {
    eyebrow: 'League or club board',
    title: 'I run a league or a club.',
    body: 'House league seasons, rep teams and the club’s books, run by a volunteer board.',
    cta: 'See league and club plans',
    href: '#league-club-plans',
  },
  {
    eyebrow: 'Coach or team manager',
    title: 'I coach one team.',
    body: BUYER_SEGMENTS[1].body,
    cta: 'See the Coaches Portal',
    href: '#coach-plans',
  },
];


const UPGRADE_BRIDGES = [
  {
    // Registration, fees and payments lead Tournament Plus (free tournament tier R9, /marketing 2026-10-16).
    headline: 'Opening your event to registration?',
    body: 'Tournament Plus opens your event to registration: teams register on your public site, and you approve, waitlist, or decline each one and record who has paid. It adds check-in and unlimited volunteers for game day, and the tools that make repeat events sustainable: unlimited tournaments, the round-robin and playoff generators, custom registration fields, file uploads, the full export suite, payment reminders, and post-event archives. Unlimited staff seats included.',
    from: 'Tournament',
    to: 'Tournament Plus',
    label: 'Tournament → Tournament Plus',
    // W73 / Ask 31 (ruled 2026-11-18): no "free" over a plan whose checkout takes a payment method; the trial sentence,
    // with the length checkout will use, sits on the card beside the button (filled in per request below).
    cta: 'Start Tournament Plus',
    href: '/start/tournament?plan=tournament_plus&billing=monthly',
    earlyAccess: false,
    trialPlan: 'tournament_plus' as const,
  },
  {
    headline: 'Running a full house league season?',
    // W11 closed: the canon sentence plus the interest line.
    body: `League Plus is the complete house league platform — player registration, draft, season scheduling, standings, and season-wide parent messaging in one dashboard. No tournament plan required — League Plus is its own entry point for house league organizations. ${gatedPlanSentence('league')} ${GATED_PLAN_INTEREST_LINE}`,
    from: null,
    to: null,
    label: 'House league administrators',
    cta: interestButtonLabel(['league']),
    earlyAccess: true,
    closedPlan: 'league' as const,
    initialPlanInterest: ['league'],
    initialFeaturesInterested: ['house_league', 'registration', 'public_site'],
  },
  {
    headline: 'Running a club with rep teams, house league, and tournaments?',
    // W12 closed: the canon sentence plus the interest line.
    body: `Club is the complete platform — tournaments, house league, rep teams, and accounting in one place. The Premium Coaches Portal is included for every coach on up to 15 teams, or up to 30 on Club · Association, with no per-team fee. House league teams are unlimited. Start directly on Club — you don't need to have been on League Plus first. ${gatedPlanSentence('club')} ${GATED_PLAN_INTEREST_LINE}`,
    from: null,
    to: null,
    label: 'Club executives',
    cta: interestButtonLabel(['club']),
    earlyAccess: true,
    closedPlan: 'club' as const,
    initialPlanInterest: ['club'],
    initialFeaturesInterested: ['accounting', 'rep_teams', 'coach_portal'],
  },
];

const FAQS = [
  {
    q: 'Is this too complex for a volunteer-run organization?',
    // W72 (ruled 2026-11-18): nothing has been sold yet, so no sentence describes customers ("used by", "most organizations").
    a: `No. FieldLogicHQ is built for associations where the "tech person" is whoever stepped up at the last AGM. It follows the jobs your board already does: scheduling, registration, score entry and emails, without the spreadsheets and email chains. You don't need to configure anything complicated to get started.`,
    featured: true,
  },
  {
    q: 'Is the platform only for tournaments?',
    // W14: the closed-plans sentence is added per request (it reads the live gate).
    a: 'No. Tournament and Tournament Plus are the live self-serve plans today, and the Coaches Portal is coming for coaches managing a single rep team. League Plus and Club — covering house league seasons, rep team management, and accounting — are shown here so your organization can plan ahead.',
  },
  {
    q: 'What if I only manage one competitive team?',
    // W22 / Ask 13: "bring your team in with everything you've built" returns only once the coach-into-Club move is on
    // production AND proved; until then the one fact Facts allows.
    a: `Use the Coaches Portal. It's a standalone workspace for one rep team — roster, schedule, budget, documents, attendance, and lineups. No org account needed. If your organization moves to Club later, you won't be charged for the portal again. ${gatedPlanSentence('team')} ${GATED_PLAN_INTEREST_LINE}`,
  },
  {
    q: 'Can I buy League Plus, Club, or the Coaches Portal today?',
    // W15: the per-request answer is built in the page (it names what is open from the live gate).
    a: 'Not through self-serve checkout yet.',
  },
  {
    q: 'How does billing work?',
    a: `Tournament Plus is billed monthly or annually in Canadian dollars. ${BILLING_TAX_WORDS.pricesPlusTax} Monthly billing renews automatically each month. Annual billing is charged once per year — you pay for 10 months and get 12, which works out to roughly two months free. Cancel any time; your plan runs to the end of the year you've paid for.`,
  },
  {
    q: 'Can I change plans later?',
    a: 'Yes, at any time. If you upgrade mid-month, the new features are available immediately and billing adjusts pro-rata. If you downgrade, the change takes effect at your next billing date. There\'s no lock-in. Organizations often start on Tournament, try the platform, and upgrade as their needs grow — that\'s exactly how the plans are designed.',
  },
  {
    q: 'Do I need a credit card to get started?',
    a: 'Not for Tournament: it is free, with no credit card and no time limit. Paid plans, the Premium Coaches Portal included, use secure Stripe Checkout.',
  },
  {
    q: 'What if we get stuck?',
    a: 'Every workflow is documented in plain language — written for the person who stepped up to run the org, not a developer. If something\'s unclear, documentation is the first stop. If that doesn\'t cover it, you can reach us directly.',
  },
  {
    q: 'Can I use FieldLogicHQ for multiple sports?',
    // W72, as confirmed by /marketing against the sport settings (2026-11-18): only the OFFERED sports, read from the
    // one list every sport picker uses, so the answer grows when a sport is added and never names one we don't run.
    a: `Yes, for ${OFFERED_SPORT_OPTIONS.map(o => o.label.toLowerCase()).join(' and ')}. You choose the sport for each tournament, season and team, and scoring and standings follow it. If you run more than one club or association, each one is set up separately.`,
  },
  {
    q: 'Is there a limit on how many staff accounts I can have?',
    // The free plan has no volunteers since the invite-only build (R7): the host and up to two staff enter every score.
    a: `Not on any paid plan. Tournament Plus, League Plus, and Club all include unlimited staff seats — add as many admins, schedulers, and volunteers as you need, and volunteers who score games or work the gate never count as seats. The free Tournament plan includes ${PLAN_CONFIG.tournament.seatLimit} staff seats, yours included: the people who run the event and enter its scores.`,
  },
  {
    q: 'How does the team limit on Club work?',
    // Decided 2026-11-19 (BUSINESS_DECISIONS.md): the limit counts teams with a Premium Coaches Portal, never a team label.
    a: `The limit counts the teams you give a Premium Coaches Portal, whatever you call them: rep, select, all-star, travel. House league teams are unlimited. Archived teams and teams entered in your tournaments aren't counted.`,
  },
  {
    q: 'Is there a setup fee or onboarding cost?',
    a: 'No. There are no setup fees, implementation costs, or onboarding charges. You sign up, create your organization, and start using the live tournament tools. Documentation covers every available setup step.',
  },
];

/** The FAQ's "Getting started" group (drawing tab 2); every other answer sits under "Plans and billing". */
const GETTING_STARTED = new Set([
  'Is this too complex for a volunteer-run organization?',
  'What if I only manage one competitive team?',
  'What if we get stuck?',
  'Can I use FieldLogicHQ for multiple sports?',
]);

export default async function PricingPage() {
  // The live gate, per request (getPlanGatingMap() makes this page render on each visit: on-sale pages S1).
  const gatingMap = await getPlanGatingMap();
  const teamCheckoutOpen = isPlanOpen(gatingMap, 'team');
  // Read from the live gate — the typed coming-soon line for both plans outlived the League park (2026-09-28).
  const closedPlansLine = closedProgramPlansSentence(gatingMap);
  // "Tournament, Tournament Plus, and the Premium Coaches Portal are available now." from the gate (W8, W15): every plan
  // is named only while open, so the list widens as plans open rather than being retyped (S3).
  const liveLine = availableNowSentence(gatingMap, ['tournament', 'tournament_plus', 'league', 'club', 'club_large', 'team']);
  // null once League Plus and Club are both open: the "what they cover" section then does not render (W13).
  const closedGroupTag = closedPlansGroupTag(gatingMap);
  // The open-state layout (W59, W21, the FAQ's open answers): League Plus, Club and Club · Association all on sale.
  const programOpen = allProgramPlansOpen(gatingMap);
  const everyPlanOpen = programOpen && teamCheckoutOpen;
  // League Plus and Club, whichever is still closed: the interest doors offer only those (Ask 5, W55).
  const closedProgram = (['league', 'club'] as OrgPlan[]).filter(p => !isPlanOpen(gatingMap, p));
  // One or two of the three on sale: the closed answers that would call an open plan "shown here" are rebuilt (`/review`).
  const partialFlip = anyProgramPlanOpen(gatingMap) && !programOpen;
  // The length checkout will use, per plan (a platform admin can override it), for every trial sentence (Ask 9, Ask 31).
  // No sentence for a trial of 0 days (a platform admin can switch the trial off): no "0-day trial".
  const overrides = await getPlanConfigOverrides();
  const trialDays: Partial<Record<OrgPlan, number>> = Object.fromEntries(
    (['tournament_plus', ...PROGRAM_PLANS] as OrgPlan[]).map(p => [p, overrides[p].trialDays]),
  );
  const trialLineOf = (plan: OrgPlan) => ((trialDays[plan] ?? 0) > 0 ? planTrialLine(trialDays[plan]!) : null);
  const tpTrialLine = trialLineOf('tournament_plus');
  // "League Plus: {leagueTrialLine} Club and Club · Association: {clubTrialLine}" (W15, W16, W18), each half only while
  // its trial exists.
  // The two Club bands share one sentence while their lengths agree; an override can split them (`/accounting` 2026-11-20).
  const clubBandsTrialLines = trialLineOf('club') === trialLineOf('club_large')
    ? [trialLineOf('club') && `Club and Club · Association: ${trialLineOf('club')}`]
    : [trialLineOf('club') && `Club: ${trialLineOf('club')}`, trialLineOf('club_large') && `Club · Association: ${trialLineOf('club_large')}`];
  const programTrialLines = [
    trialLineOf('league') && `League Plus: ${trialLineOf('league')}`,
    ...clubBandsTrialLines,
  ].filter(Boolean).join(' ');
  const teamPrice = formatPriceAmount(PLAN_CONFIG.team.monthlyPrice);
  // The static segment/FAQ copy is written for the GATED state; when the team checkout is
  // open (Coaches Portal launch), the coach-facing entries flip to live availability so the
  // page can't contradict PLAN_PRICING_FACTS.md (Premium Coaches Portal: live, self-serve).
  const segments = programOpen
    // The coach door jumps to its band, which renders while Premium is on sale; closed, it goes to the coach page.
    ? THREE_DOORS.map(door => (door.href === '#coach-plans' && !teamCheckoutOpen ? { ...door, href: '/for-coaches' } : door))
    : BUYER_SEGMENTS.map(segment => {
        if (segment.initialPlanInterest?.[0] === 'coaches_portal' && teamCheckoutOpen) {
          return { ...segment, earlyAccess: false, href: '/coaches/start?source=pricing', cta: 'Start now' };
        }
        // W9 (League Plus open while Club is not): the door leads to the page that carries the plan card and its terms.
        if (segment.initialPlanInterest?.[0] === 'league' && isPlanOpen(gatingMap, 'league')) {
          return { ...segment, earlyAccess: false, href: '/for-leagues', cta: 'See what League Plus includes' };
        }
        return segment;
      });
  // W75: a bridge card for League Plus or Club repeats its band once that plan is open, so it leaves; the Tournament Plus
  // bridge stays. A closed plan's bridge keeps its closed words (W11, W12).
  const bridges = UPGRADE_BRIDGES.filter(b => !b.closedPlan || !isPlanOpen(gatingMap, b.closedPlan));
  // W14, W15 (closed words, ruled 2026-11-18): each closed plan says its one canon sentence and the interest line;
  // nothing promises a plan's timing ("the next parts of the platform") or invites "plan ahead and express interest".
  const closedTail = closedPlansLine ? ` ${closedPlansLine} ${GATED_PLAN_INTEREST_LINE}` : '';
  const faqs = FAQS.flatMap(faq => {
    // The open answers (W14 to W20): League Plus, Club and Club · Association on sale. A partial flip keeps the closed
    // answers, each closed plan saying its own sentence from the gate.
    if (programOpen) {
      const open = openAnswer(faq);
      if (open) return open;
    }
    return [closedAnswer(faq)];
  });

  const faqItems = faqs.map(f => ({ q: f.q, a: f.a, tag: f.featured ? 'Volunteer orgs' : undefined }));
  // W70: the first four (switching, handover, families' information, stopping); training stays on the persona pages.
  const boardFaqs = boardQuestions({ club: true })?.slice(0, 4) ?? null;

  function openAnswer(faq: typeof FAQS[number]): typeof FAQS | null {
    switch (faq.q) {
      case 'Is the platform only for tournaments?':
        return everyPlanOpen
          ? [{ ...faq, a: 'No. Tournament, Tournament Plus, League Plus, Club, Club · Association, and the Premium Coaches Portal are all available now: tournaments, house league seasons, rep teams, accounting, and a workspace for one competitive team.' }]
          : null;
      case 'Can I buy League Plus, Club, or the Coaches Portal today?':
        return [{
          q: 'How do I buy League Plus, Club, or Club · Association?',
          a: `Choose the plan above, create your account, name your club or league, and check out. ${programTrialLines}`.trim(),
        }];
      case 'How does billing work?':
        return [{ ...faq, a: `${faq.a.replace('Tournament Plus is billed monthly', 'Every paid plan is billed monthly')} ${programTrialLines}`.trim() }];
      case 'Can I change plans later?':
        // W17, as `/legal` corrected it (2026-11-20): "Yes, at any time" is false for League Plus, which changes to no
        // other plan yet (lib/plan-move-options.ts has no League Plus row). Each sentence is a move the product makes.
        return [{ ...faq, a: 'It depends on the plan. A free Tournament organization can start Tournament Plus at any time. Tournament Plus can move up to Club or Club · Association, and Club to Club · Association, at any time: you see the prorated charge before you confirm, and a move doesn\'t start a second trial. Moving from Club · Association down to Club waits for your next renewal, and needs 15 or fewer teams with a Premium Coaches Portal. League Plus can\'t be moved to another plan yet.' }];
      case 'Do I need a credit card to get started?':
        return [{ ...faq, a: `${faq.a} ${programTrialLines}`.trim() }];
      case 'Is there a setup fee or onboarding cost?':
        return [{ ...faq, a: 'No. There are no setup fees, implementation costs, or onboarding charges. You sign up, create your organization, and start using your plan\'s tools. Help articles cover every setup step.' }];
      case 'How does the team limit on Club work?':
        // W20 joins after the team-limit answer, where the question gets asked. Its count follows the 2026-11-19 ruling
        // (the teams given a Premium Coaches Portal; house league teams unlimited), which the team-limit answer above says.
        return [faq, {
          q: 'Which Club plan do I need?',
          a: `Club covers up to 15 teams with a Premium Coaches Portal and Club · Association up to 30. You don't need League Plus first: a club with rep teams starts on Club. Start on the one that fits today; you can move up at any time and you see the prorated charge before you confirm. More than 30 teams? Email ${FIELDLOGICHQ_CONTACT_EMAIL} for a custom quote.`,
        }];
      default:
        return null;
    }
  }

  function closedAnswer(faq: typeof FAQS[number]): typeof FAQS[number] {
    // A partial flip (`/review` S3): once one programme plan is on sale, the two answers that say League Plus and Club
    // are only "shown here" or "not through self-serve checkout yet" are built from the gate instead.
    if (partialFlip && faq.q === 'Is the platform only for tournaments?') {
      return { ...faq, a: `No. ${liveLine ?? ''} ${closedPlansLine ?? ''}`.replace(/\s+/g, ' ').trim() };
    }
    if (partialFlip && faq.q === 'Can I buy League Plus, Club, or the Coaches Portal today?') {
      return {
        ...faq,
        a: [
          availableNowSentence(gatingMap, ['league', 'club', 'club_large']),
          programTrialLines,
          teamCheckoutOpen
            ? `The Premium Coaches Portal is available now through self-serve checkout at ${teamPrice}/month ${BILLING_TAX_WORDS.plusTax}.`
            : gatedPlanSentence('team'),
          closedTail.trim(),
        ].filter(Boolean).join(' '),
      };
    }
    if (faq.q === 'Is the platform only for tournaments?') {
      return {
        ...faq,
        a: (teamCheckoutOpen
          ? 'No. Tournament, Tournament Plus, and the Premium Coaches Portal are the live self-serve plans today — the Coaches Portal covers coaches managing a single competitive team. League Plus and Club — covering house league seasons, rep team management, and accounting — are shown here so your organization can plan ahead.'
          : faq.a) + (closedPlansLine ? ` ${closedPlansLine}` : ''),
      };
    }
    if (faq.q === 'What if I only manage one competitive team?' && teamCheckoutOpen) {
      return {
        ...faq,
        // No "free portal" sentence (owner 2026-11-19): a coach gets the free portal by entering a tournament; the
        // pricing page sells only Premium to a coach.
        a: `Use the Premium Coaches Portal, the operations HQ for the whole season — roster, lineups, attendance, budget, and documents. It's ${teamPrice}/month, cancel any time. If your organization moves to Club later, you won't be charged for the portal again.`,
      };
    }
    if (faq.q === 'Can I buy League Plus, Club, or the Coaches Portal today?') {
      return {
        ...faq,
        a: teamCheckoutOpen
          ? `The Premium Coaches Portal is available now through self-serve checkout at ${teamPrice}/month ${BILLING_TAX_WORDS.plusTax}.${closedTail}`
          : `${faq.a} ${liveLine ?? ''} ${gatedPlanSentence('team')}${closedTail}`.replace(/\s+/g, ' ').trim(),
      };
    }
    return faq;
  }

  return (
    <main className={kit.page}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className={kit.hero}>
        <div className="container">
          <p className={kit.eyebrow}>Pricing</p>
          <h1 className={kit.headline}>
            Plans built around how you actually operate.
          </h1>
          {/* W8 closed (ruled 2026-11-18): "start free, no credit card required" read as if Tournament Plus needed no
              card, and "while we finish those workflows" promised timing. The live list and the closed line read the gate. */}
          <p className={kit.lead}>
            {/* W8 open: once all six are on sale the list would name every plan, so the lead says it in four words. */}
            {everyPlanOpen ? 'Every plan is available now.' : liveLine} Tournament is free, with no credit card required.{closedPlansLine && <> {closedPlansLine}</>}
          </p>
          <ul className={kit.facts}>
            {/* `/legal` 2026-11-20: once League Plus is sold, "downgrade at any time" is false for it (it changes to no other plan yet). */}
            {(programOpen ? [...TRUST_SIGNALS.slice(0, 3), 'Move up to a larger Club plan at any time'] : TRUST_SIGNALS).map(s => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Segment picker ───────────────────────────────────────────────── */}
      <section className={kit.section} aria-labelledby="pricing-segments-title">
        <div className="container">
          <div className={styles.sectionIntro}>
            <p className={kit.eyebrow}>Find your plan</p>
            <h2 id="pricing-segments-title" className={kit.heading}>What does your role look like?</h2>
            <p className={kit.body}>
              Not every plan is for every organization. Pick the role that fits — you&apos;ll land in the right place.
            </p>
          </div>
          <div className={segments.length === 3 ? kit.grid3 : kit.grid4}>
            {segments.map(segment => {
              const cardClass = `${kit.card} ${kit.stack} ${styles.segmentCard}`;
              const cardContent = (
                <>
                  <span className={`${kit.eyebrow}`}>{segment.eyebrow}</span>
                  <span className={`${kit.title}`}>{segment.title}</span>
                  <span className={`${kit.small}`}>{segment.body}</span>
                  <span className={`${kit.link} ${kit.push}`}>{segment.cta}</span>
                </>
              );
              if (segment.earlyAccess) {
                return (
                  <EarlyAccessModalTrigger
                    key={segment.title}
                    className={cardClass}
                    initialPlanInterest={segment.initialPlanInterest}
                    initialFeaturesInterested={segment.initialFeaturesInterested}
                  >
                    {cardContent}
                  </EarlyAccessModalTrigger>
                );
              }
              return (
                <Link key={segment.title} href={segment.href!} className={cardClass}>
                  {cardContent}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Org plans + Coaches Portal callout ──────────────────────────── */}
      <section className={kit.section} id="org-plans">
        <div className="container">
          <div className={styles.sectionIntro}>
            <p className={kit.eyebrow}>Plans</p>
            <h2 className={kit.heading}>{PLAN_AVAILABLE_NOW}</h2>
            {/* W10 closed: "early interest" was the withdrawn early-access framing. */}
            <p className={kit.body}>
              {programOpen && teamCheckoutOpen
                // W10 open.
                ? 'Plans for tournaments, house leagues and clubs, plus the standalone Premium Coaches Portal for coaches.'
                : teamCheckoutOpen
                  ? <>Organization plans for tournaments and operations, plus the standalone Premium Coaches Portal for coaches.{closedPlansLine && <> {closedPlansLine}</>}</>
                  : 'Use these plans when you manage events or organization-wide operations.'}
            </p>
          </div>
          {/* R4 (2026-08-01): same grid, but it knows whether the reader already operates here.
              Prospects and anonymous visitors get today's cards untouched; a signed-in org
              operator gets their tier marked and CTAs that open their billing screen instead of
              the sign-up funnel. Resolved client-side, so this page stays static + role-free.
              marketingLayout (2026-08-08): live plans as full cards — including the Premium
              Coaches Portal, which replaced the old callout strip here — and gated plans
              compressed into the coming-soon strip below the grid. */}
          <ViewerAwarePlans gatingMap={gatingMap} marketingLayout bands trialDays={trialDays} />
        </div>
      </section>

      {/* ── Upgrade bridges ──────────────────────────────────────────────── */}
      <section className={kit.section}>
        <div className="container">
          <div className={bridges.length === 1 ? styles.bridgeAlone : bridges.length === 2 ? kit.grid2 : kit.grid3}>
            {bridges.map(b => (
              <div key={b.label} className={`${kit.card} ${kit.stack}`}>
                <p className={styles.bridgeLabel}>
                  <span className={kit.tag}>{b.label}</span>
                </p>
                <h3 className={`${kit.title} ${styles.plainHeading}`}>{b.headline}</h3>
                <p className={kit.small}>{b.body}</p>
                {'trialPlan' in b && tpTrialLine && <p className={kit.small}>{tpTrialLine}</p>}
                <div className={kit.push}>
                  {b.earlyAccess ? (
                    <EarlyAccessModalTrigger
                      className={`${kit.btn} ${kit.btnSecondary}`}
                      initialPlanInterest={b.initialPlanInterest}
                      initialFeaturesInterested={b.initialFeaturesInterested}
                    >
                      {b.cta}
                    </EarlyAccessModalTrigger>
                  ) : (
                    <Link href={b.href ?? '/start/tournament'} className={`${kit.btn} ${kit.btnSecondary}`}>
                      {b.cta}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* W13: the section's only job is plans you cannot yet buy, and its words name both plans, so it shows only while
          League Plus and Club are both closed (`/review` S3); in a partial flip the strip and the closed plan's bridge carry
          the closed one. */}
      {closedGroupTag && closedProgram.length === 2 && (
      <section className={kit.section} id="early-access">
        <div className="container">
          <div className={styles.clubInner}>
            <div>
              {/* W13 closed (ruled 2026-11-18): roadmap and launch language goes; the eyebrow follows W6's rule. */}
              <p className={kit.eyebrow}>{closedGroupTag}</p>
              <h2 className={kit.heading}>League Plus and Club — what they cover</h2>
              {closedPlansLine && <p className={kit.subhead}>{closedPlansLine}</p>}
              <p className={kit.body}>
                {teamCheckoutOpen
                  ? 'Tournament, Tournament Plus, and the Premium Coaches Portal are the live plans available today. '
                  : 'Tournament and Tournament Plus are the live plans available today. '}
                League Plus and Club are shown here so you can see what they cover.
              </p>
              <p className={kit.body}>
                League Plus is focused on house league registration, divisions, seasons, public organization
                pages, and registrar workflows. Club adds rep teams and accounting — plus a Premium Coaches
                Portal for every coach on up to 15 teams, or up to 30 on Club · Association, with no per-team fee — for
                organizations that need the complete operating system.
              </p>
              <p className={kit.body}>
                If you want either plan, start on a live tournament plan now, or tell us you&apos;re interested.
                Tick the box on the form if you&apos;d like an email when it opens.
              </p>
              <EarlyAccessModalTrigger
                className={`${kit.btn} ${kit.btnSecondary}`}
                initialPlanInterest={closedProgram}
                initialFeaturesInterested={['house_league', 'registration', 'accounting', 'rep_teams']}
              >
                {interestButtonLabel(closedProgram)}
              </EarlyAccessModalTrigger>
            </div>
            <div className={styles.clubStats}>
              {[
                {
                  label: PLAN_AVAILABLE_NOW,
                  body: teamCheckoutOpen
                    ? 'Tournament is free for an invite-only event — no credit card, no time limit. Tournament Plus adds public registration and payment tracking, check-in and volunteers, the round-robin and playoff generators, sealed archives, branding, and reporting. The Premium Coaches Portal is live for coaches managing one team.'
                    : 'Tournament is free for an invite-only event — no credit card, no time limit. Tournament Plus adds public registration and payment tracking, check-in and volunteers, the round-robin and playoff generators, sealed archives, branding, and reporting.',
                },
                {
                  label: closedGroupTag,
                  // Symmetric with "Available now": if the coach checkout gate ever re-closes,
                  // the product moves back to this list instead of vanishing from both. Read from the
                  // live gate: "being finished before checkout opens" promised a parked plan (2026-09-28).
                  body: [teamCheckoutOpen ? null : gatedPlanSentence('team'), closedPlansLine]
                    .filter(Boolean).join(' '),
                },
                {
                  label: interestButtonLabel(),
                  body: 'Share your details and which plans you want — no commitment. Tick the box on the form if you\'d like an email when they open.',
                },
              ].map(s => (
                <div key={s.label} className={`${kit.card} ${kit.cardFlat} ${kit.cardEdge}`}>
                  <p className={kit.subhead}>{s.label}</p>
                  <p className={kit.small}>{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className={kit.section}>
        <div className="container">
          <h2 className={kit.heading}>Common questions — answered plainly.</h2>
          <p className={kit.body}>
            No jargon. No sales pitch. Just what you need to know before signing up.
          </p>

          {/* S3b (drawing tab 2): three small headings. The middle group is W70's first four board questions, which render
              only while the legal pages are published (answer 3 links to the Privacy Policy). */}
          <p className={faqStyles.group}>Plans and billing</p>
          <FaqList items={faqItems.filter(f => !GETTING_STARTED.has(f.q))} />
          {boardFaqs && (
            <>
              <p className={faqStyles.group}>Switching, your board and your families&apos; information</p>
              <FaqList items={boardFaqs} />
            </>
          )}
          <p className={faqStyles.group}>Getting started</p>
          <FaqList items={faqItems.filter(f => GETTING_STARTED.has(f.q))} />
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
      <section className={`${kit.section} ${kit.band} ${kit.center}`}>
        <div className="container">
          <h2 className={kit.heading}>
            Less admin.{' '}
            <span className={kit.accent}>More sport.</span>
          </h2>
          <p className={kit.lead}>
            {programOpen
              // W21 open: no interest door is left to offer.
              ? 'Start free with Tournament, or pick the plan that matches what you run.'
              : teamCheckoutOpen
                ? <>Start free with Tournament.
                  {closedPlansLine && <>{' '}{closedPlansLine} {GATED_PLAN_INTEREST_LINE}</>}</>
                : <>Start free with Tournament.
                  {' '}{gatedPlanSentence('team')}{closedPlansLine && <> {closedPlansLine}</>} {GATED_PLAN_INTEREST_LINE}</>}
          </p>
          <div className={`${kit.row} ${styles.ctaActions}`}>
            <Link href="/start/tournament" className={kit.btn}>
              Get started free
            </Link>
            {closedProgram.length > 0 ? (
              <EarlyAccessModalTrigger
                className={`${kit.btn} ${kit.btnSecondary}`}
                initialPlanInterest={closedProgram}
                initialFeaturesInterested={['house_league', 'registration', 'accounting', 'rep_teams']}
              >
                {interestButtonLabel(closedProgram)}
              </EarlyAccessModalTrigger>
            ) : (
              // The interest window's own link words (W21).
              <Link href="/start" className={`${kit.btn} ${kit.btnSecondary}`}>
                Browse all the ways to start
              </Link>
            )}
          </div>
          <p className={kit.small}>All plans are billed in CAD. No long-term contract. No setup fees.</p>
        </div>
      </section>

    </main>
  );
}
