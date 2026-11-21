import Link from 'next/link';
import EarlyAccessModalTrigger from '@/components/EarlyAccessModalTrigger';
import HowTheTrialWorks from '@/components/marketing/HowTheTrialWorks';
import { BoardQuestionsSection } from '@/components/marketing/BoardQuestions';
import { OnSaleDrawing, type OnSaleDrawingId } from '@/components/marketing/OnSaleDrawing';
import kit from '@/components/marketing/MarketingKit.module.css';
import fp from '@/components/marketing/ForPage.module.css';
import { marketingMetadata } from '@/lib/marketing-metadata';
import { PLAN_ARTICLE_CONTENT } from '@/lib/plan-article-content';
import {
  PLAN_CONFIG, formatPriceAmount, isPlanOpen, interestButtonLabel, gatedPlanTag, gatedPlanSentence, GATED_PLAN_INTEREST_LINE,
  PLAN_AVAILABILITY_LINE,
} from '@/lib/plan-config';
import { BILLING_TAX_WORDS } from '@/lib/billing-tax';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import { getPlanConfigOverrides } from '@/lib/plan-config-db';
import { planTrialLine } from '@/lib/plan-trial-line';
import { FIELDLOGICHQ_CONTACT_EMAIL } from '@/lib/fieldlogichq-contact';
import { START_PATH_FOR_PLAN, parseStartPricing, withStartPricing } from '@/lib/start-door';
import { SEE_IT_LIVE_PATH, SEE_IT_LIVE_COACHES_PATH, sandboxDoorsVisible } from '@/lib/sandbox-door';

export const metadata = marketingMetadata({
  // W64 (ruled 2026-11-18): the words a club board would search.
  title: 'Club management: house league, rep teams',
  description:
    'One place for a volunteer board: house league, rep teams, tournaments and the club\'s accounting, with a Premium Coaches Portal for every coach.',
  path: '/for-clubs',
});

const { painItems: PAIN_ITEMS, steps: MODULES, stepsHeadline: STEPS_HEADLINE, features: CLUB_FEATURES } =
  PLAN_ARTICLE_CONTENT.club;

/** W67, as re-ruled 2026-11-21: a drawing for each of the four (Tournaments, House league, Rep teams, Accounting), in order. */
const MODULE_DRAWINGS: readonly OnSaleDrawingId[] = ['clubs-01-tournaments', 'clubs-02-house-league', 'clubs-03-rep-teams', 'clubs-04-accounting'];

/**
 * W69 (S3b, both states): what each person at the club gets. Every line is something the product does today (board roles,
 * the board report as PDF or Excel, registration with a waitlist, Email families). The coaches card follows the 2026-11-19
 * team-limit ruling (the teams GIVEN a portal), and types no count.
 */
const BOARD_CARDS = [
  {
    label: 'President',
    title: 'One place for the whole club.',
    body: 'House league, rep teams, tournaments and the books behind one sign-in. Give each board member their role, and take it back when someone steps down.',
  },
  {
    label: 'Treasurer',
    title: 'Books the next treasurer can read.',
    body: 'One ledger, a budget checked against what was actually spent, and club costs split across teams. Export the board report for the meeting as a PDF or an Excel file.',
  },
  {
    label: 'Registrar',
    title: 'Registration without the inbox.',
    body: "Families register on your club's page. You accept players, manage the waitlist and email every family from one screen.",
  },
  {
    label: 'Coaches',
    title: 'A Premium Coaches Portal for every coach.',
    body: "Roster, lineups, schedule and team budget for every team you give a portal, with no per-team fee. The team's books stay with the coach.",
  },
];

/** W27 / W4: the Club · Association card's list, the same three lines as its /pricing card. */
const CLUB_LARGE_FEATURES = [
  'Everything in Club',
  'Premium Coaches Portal for every coach on 16 to 30 teams — no per-team fee',
  'Start here, or move up from Club when you pass 15 teams',
];

const CROSS_SELLS: Array<{
  label: string;
  q: string;
  body: string;
  cta: string;
  href?: string;
  initialPlanInterest?: string[];
  initialFeaturesInterested?: string[];
}> = [
  {
    label: 'Coaches Portal',
    q: 'Do coaches need access before Club opens?',
    // W29 closed / Ask 13: "bring each coach's team in with everything they've built" returns only once the
    // coach-into-Club move is on production and proved.
    body: "The Coaches Portal is also available standalone — coaches can start on their own today. When you move to Club, a coach with a standalone portal won’t be charged for it again, and the portal is included in your plan from then on.",
    // Flips to a live "See the Coaches Portal" link with the coach checkout gate below — this card
    // held an express-interest trigger for a live product until 2026-08-10 (the same stale trap as
    // the /for-tournament-organizers cross-sell, found in the door-placement build).
    cta: interestButtonLabel(['team']),
    initialPlanInterest: ['coaches_portal'],
    initialFeaturesInterested: ['roster', 'lineups', 'budget', 'team_documents'],
  },
  {
    label: 'Tournament',
    q: 'Running a tournament before Club opens?',
    body: 'Tournament and Tournament Plus are live today — free to start, no credit card required. Your org is already on the platform when Club launches.',
    cta: 'See tournament plans',
    href: '/for-tournament-organizers',
  },
];

/**
 * W29 open: the Coaches Portal cross-sell says what Club gives every coach; the Tournament one leaves (Club includes
 * tournaments, and "before Club opens" no longer exists). The bring-in sentence keeps W22's closed words until the
 * coach-into-Club move is proved on production (Ask 13).
 */
const OPEN_CROSS_SELL = {
  label: 'Coaches Portal',
  q: 'Do your coaches need their own portal?',
  // `/legal` 2026-11-20: the move is the coach's own step, and their plan ends at once (no refund; the team move's words).
  body: 'Every coach on your staff gets the Premium Coaches Portal with Club — every team included, no per-team fee. A coach who already has a standalone portal can move their team in; their own plan then ends and they aren’t charged for it again.',
  cta: 'See the Coaches Portal',
  href: '/for-coaches',
};

export default async function ForClubsPage() {
  // The live gate, per request (on-sale pages S1). Club's open state is S3: every line below that changes reads Club's
  // own gate (Club · Association's card reads its own).
  const gatingMap = await getPlanGatingMap();
  const teamCheckoutOpen = isPlanOpen(gatingMap, 'team');
  const clubOpen = isPlanOpen(gatingMap, 'club');
  const clubLargeOpen = isPlanOpen(gatingMap, 'club_large');
  // The trial sentence with the length checkout will use (a platform admin can override it); none for a 0-day trial.
  const overrides = await getPlanConfigOverrides();
  const clubTrialDays = overrides.club.trialDays;
  const clubTrial = clubTrialDays > 0 ? planTrialLine(clubTrialDays) : null;
  const clubLargeTrial = overrides.club_large.trialDays > 0 ? planTrialLine(overrides.club_large.trialDays) : null;
  // A button that names a trial needs the trial (`/accounting` 2026-11-20).
  const clubCta = clubTrial ? 'Start your Club trial' : 'Start Club';
  const clubLargeCta = clubLargeTrial ? 'Start your Club · Association trial' : 'Start Club · Association';
  const startHref = (plan: 'club' | 'club_large') => withStartPricing(START_PATH_FOR_PLAN[plan], parseStartPricing(plan, 'monthly'));
  const showSandboxDoor = sandboxDoorsVisible();
  // W70 answer 6, open only: every price and both team limits from PLAN_CONFIG, never typed.
  const clubYearCost =
    `Club is ${formatPriceAmount(PLAN_CONFIG.club.annualPrice)} a year or ${formatPriceAmount(PLAN_CONFIG.club.monthlyPrice)} a month, ${BILLING_TAX_WORDS.plusTax}. ` +
    `It covers up to ${PLAN_CONFIG.club.teamLimit} teams with a Premium Coaches Portal, with no per-team fee, and house league teams are unlimited.` +
    (clubLargeOpen ? ` Club · Association covers up to ${PLAN_CONFIG.club_large.teamLimit}.` : '');
  const crossSells = clubOpen
    ? [OPEN_CROSS_SELL]
    : CROSS_SELLS.map(cs =>
      cs.label === 'Coaches Portal' && teamCheckoutOpen
        ? { ...cs, href: '/for-coaches', cta: 'See the Coaches Portal' }
        : cs,
    );
  return (
    <main className={kit.page}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className={kit.hero}>
        <div className="container">
          <p className={kit.eyebrow}>For club executives</p>
          <h1 className={kit.headline}>
            Coaches run their team.<br />
            <span className={kit.accent}>You run the club.</span>
          </h1>
          {/* W65 (S3b): never "full visibility" — the club reads each team's roster, schedule and results and ONE cash
              figure, never a coach's books (owner 2026-11-06). */}
          <p className={kit.lead}>
            One place for house league, rep teams, tournaments and the club&apos;s books. Coaches run their own teams;
            the board handles registration and the club&apos;s money.
          </p>
          <div className={`${kit.row} ${fp.heroRow}`}>
            {clubOpen ? (
              // W23 open: the Club start (S2's door), with the pick.
              <Link href={startHref('club')} className={kit.btn}>{clubCta}</Link>
            ) : (
              <EarlyAccessModalTrigger
                className={kit.btn}
                initialPlanInterest={['club']}
                initialFeaturesInterested={['accounting', 'rep_teams', 'coach_portal']}
              >
                {interestButtonLabel(['club'])}
              </EarlyAccessModalTrigger>
            )}
            <Link href="/for-tournament-organizers" className={`${kit.link} ${kit.linkBlock}`}>
              Running a tournament? See tournament plans
            </Link>
          </div>
          {clubOpen ? (
            clubTrial && <p className={kit.small}>{clubTrial}</p>
          ) : (
            <p className={kit.small}>
              {/* W23 closed: "Club is in development" was not the canon sentence. */}
              <span className={fp.noteStrong}>{gatedPlanTag('club')}</span>
              {' '}— it isn&apos;t open for sign-up yet.{' '}
              {teamCheckoutOpen
                ? 'Tournament, Tournament Plus, and the Premium Coaches Portal are live today.'
                : 'Tournament and Tournament Plus are live today.'}
            </p>
          )}
          <div className={fp.afterNote}>
            <ul className={kit.facts}>
              {/* `/legal` 2026-11-20: open, the line says the one change a Club buyer can make. */}
              {['No long-term contract — cancel any time', 'Billed in CAD', clubOpen ? 'Move between Club and Club · Association when you need to' : 'Upgrade or downgrade at any time'].map(s => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── The demo block (owner-ratified 2026-08-10) ───────────────────────
          Renders only while the doors are on; a door pattern must never appear anywhere it would promise a demo that
          doesn't exist. Closed: proof-by-parts, both halves. Open (W24, Ask 11): one coach's season inside a club, and
          no promise of a club demo (none for launch, 2026-11-18). */}
      {showSandboxDoor && (
        <section className={kit.section}>
          <div className="container">
            <div className={`${kit.card} ${kit.cardEdge}`}>
              {clubOpen ? (
                <>
                  <p className={kit.eyebrow}>A coach&apos;s season inside a club</p>
                  <p className={`${kit.body} ${fp.measure}`}>
                    Every coach on your staff works in the Premium Coaches Portal that comes with Club. This is one
                    coach&apos;s season in a fictional club: roster, lineups, schedule and budget. No sign-up.
                  </p>
                  <div className={kit.row}>
                    <Link href={SEE_IT_LIVE_COACHES_PATH} className={`${kit.link} ${kit.linkBlock} ${kit.live}`}>
                      See a coach&apos;s season
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <p className={kit.eyebrow}>Both halves are live today</p>
                  <p className={`${kit.body} ${fp.measure}`}>
                    Club bundles what&apos;s already running: tournaments and the Premium Coaches
                    Portal. Walk both right now — no sign-up — and express interest for the day
                    they&apos;re one product.
                  </p>
                  <div className={kit.row}>
                    <Link href={SEE_IT_LIVE_PATH} className={`${kit.link} ${kit.linkBlock} ${kit.live}`}>
                      See a live tournament
                    </Link>
                    <Link href={SEE_IT_LIVE_COACHES_PATH} className={`${kit.link} ${kit.linkBlock} ${kit.live}`}>
                      See a coach&apos;s season
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Pain recognition ─────────────────────────────────────────────── */}
      <section className={kit.section}>
        <div className="container">
          <p className={kit.eyebrow}>The old way</p>
          <h2 className={kit.heading}>If this is how your club operates, we know the drill.</h2>
          <div className={`${kit.grid2} ${fp.gridTop}`}>
            {PAIN_ITEMS.map(item => (
              <div key={item.title} className={kit.card}>
                <p className={kit.title}>{item.title}</p>
                <p className={kit.body}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What's in Club ───────────────────────────────────────────────── */}
      <section className={kit.section}>
        <div className="container">
          <p className={kit.eyebrow}>What&apos;s included</p>
          {/* S3b: "module" leaves the marketing pages (the pricing promises "No modules to buy separately"). */}
          <h2 className={kit.heading}>{STEPS_HEADLINE}</h2>
          <p className={`${kit.body} ${fp.measure}`}>
            Club is the complete operating system for established clubs: every program, every role, one sign-in.
          </p>
          <div className={`${kit.grid2} ${fp.gridTop} ${fp.drawingGrid}`}>
            {MODULES.map((mod, i) => (
              <div key={mod.num} className={kit.card}>
                {MODULE_DRAWINGS[i] && <OnSaleDrawing id={MODULE_DRAWINGS[i]} />}
                <p className={kit.counter}>{mod.num}</p>
                <p className={kit.eyebrow}>{mod.label}</p>
                <p className={kit.title}>{mod.title}</p>
                <p className={kit.body}>{mod.body}</p>
                {/* W67 (drawing tab 4): a coach's season, live, on the rep teams card while the demo doors are on. */}
                {mod.num === '03' && showSandboxDoor && (
                  <Link href={SEE_IT_LIVE_COACHES_PATH} className={`${kit.link} ${kit.linkBlock} ${kit.live}`}>
                    See a coach&apos;s season
                  </Link>
                )}
              </div>
            ))}
          </div>
          <div className={`${kit.card} ${kit.cardEdge} ${kit.cardFlat} ${fp.calloutTop}`}>
            <p className={kit.body}>
              Club includes house league in full. If your club runs a house league alongside rep teams, you don&apos;t
              need League Plus as well.
            </p>
          </div>
        </div>
      </section>

      {/* ── What each person at your club gets (W69, both states; drawing tab 4) ── */}
      <section className={kit.section}>
        <div className="container">
          <p className={kit.eyebrow}>Your board</p>
          <h2 className={kit.heading}>What each person at your club gets</h2>
          <div className={`${kit.grid4} ${fp.gridTop}`}>
            {BOARD_CARDS.map(c => (
              <div key={c.label} className={kit.card}>
                <p className={kit.eyebrow}>{c.label}</p>
                <p className={kit.title}>{c.title}</p>
                <p className={kit.body}>{c.body}</p>
              </div>
            ))}
          </div>
          {/* No "trial" here: the section shows while Club is closed, when there is none. */}
          <p className={fp.hnote}>
            Taking this to a board meeting? The plans and prices are on one page.{' '}
            <Link href="/pricing" className={`${kit.link} ${kit.linkBlock}`}>See every plan and price</Link>
          </p>
        </div>
      </section>

      {/* ── Plan section ─────────────────────────────────────────────────── */}
      <section className={kit.section}>
        <div className="container">
          <p className={kit.eyebrow}>The plan</p>
          <h2 className={kit.heading}>Club — the complete operating system.</h2>
          <p className={`${kit.body} ${fp.measure}`}>
            {clubOpen
              // W25 open.
              // `/marketing` 2026-11-20: the count is the teams given a Premium portal (BUSINESS_DECISIONS 2026-11-19).
              ? 'Pick the Club plan by how many teams will have a Premium Coaches Portal: up to 15, or up to 30 on Club · Association. House league teams are unlimited.'
              /* W25 closed: "finishing its final workflows" was the retired imminence framing. */
              : `${gatedPlanSentence('club')} ${GATED_PLAN_INTEREST_LINE}`}
          </p>
          <div className={`${fp.planGrid} ${fp.gridTop}`}>

            {/* ── Club plan ──────────────────────────────────────────────── */}
            <div className={`${kit.card} ${kit.cardFeatured} ${kit.stack}`}>
              <div>
                {/* The status pill on the card's first line, on the right (one place for the pill, owner 2026-11-19). */}
                <div className={fp.cardFirstLine}>
                  <p className={kit.title}>Club</p>
                  {!clubOpen && <span className={kit.tag}>{gatedPlanTag('club')}</span>}
                </div>
                <div className={fp.priceRow}>
                  <span className={kit.price}>{formatPriceAmount(PLAN_CONFIG.club.monthlyPrice)}</span>
                  <span className={kit.small}>/month</span>
                </div>
                {/* W26 open: the tax line under a price the buyer will be charged; a closed price carries none. */}
                {clubOpen && <p className={kit.small}>{BILLING_TAX_WORDS.plusTax}</p>}
                <p className={kit.small}>
                  {formatPriceAmount(PLAN_CONFIG.club.annualPrice)}/year — save two months ·{' '}
                  {/* W26 open: Club · Association has its own card beside it, so the pointer goes. */}
                  {clubOpen && clubLargeOpen
                    ? 'up to 15 teams'
                    : 'priced by the teams you give a Premium Coaches Portal (up to 15 · up to 30 on Club · Association)'}
                </p>
                <p className={kit.small}>Rep, select, all-star, travel: whatever you call them. House league teams are unlimited. Archived teams and teams entered in your tournaments aren&apos;t counted.</p>
                {clubOpen && clubTrial && <p className={kit.small}>{clubTrial}</p>}
              </div>
              <p className={`${kit.body} ${fp.planCopyTop}`}>
                The complete operating system for established clubs — tournaments, house league,
                rep teams, accounting, and coaching staff, all in one place.
              </p>
              <div>
                <p className={kit.subhead}>Included</p>
                <ul className={kit.ticks}>
                  {CLUB_FEATURES.map(f => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
              <div className={kit.push}>
                {clubOpen ? (
                  <Link href={startHref('club')} className={`${kit.btn} ${kit.btnFull}`}>{clubCta}</Link>
                ) : (
                  <EarlyAccessModalTrigger
                    className={`${kit.btn} ${kit.btnFull}`}
                    initialPlanInterest={['club']}
                    initialFeaturesInterested={['accounting', 'rep_teams', 'coach_portal']}
                  >
                    {interestButtonLabel()}
                  </EarlyAccessModalTrigger>
                )}
              </div>
            </div>

            {clubLargeOpen ? (
              /* ── W27: the Club · Association card, beside Club ─────────────── */
              <div className={`${kit.card} ${kit.stack}`}>
                <div>
                  <p className={kit.title}>Club · Association</p>
                  <div className={fp.priceRow}>
                    <span className={kit.price}>{formatPriceAmount(PLAN_CONFIG.club_large.monthlyPrice)}</span>
                    <span className={kit.small}>/month</span>
                  </div>
                  <p className={kit.small}>{BILLING_TAX_WORDS.plusTax}</p>
                  <p className={kit.small}>{formatPriceAmount(PLAN_CONFIG.club_large.annualPrice)}/year — save two months · 16 to 30 teams</p>
                  {clubLargeTrial && <p className={kit.small}>{clubLargeTrial}</p>}
                </div>
                <p className={`${kit.body} ${fp.planCopyTop}`}>The full Club platform for organizations with 16 to 30 teams.</p>
                <div>
                  <p className={kit.subhead}>Included</p>
                  <ul className={kit.ticks}>
                    {CLUB_LARGE_FEATURES.map(f => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
                <div className={kit.push}>
                  <Link href={startHref('club_large')} className={`${kit.btn} ${kit.btnSecondary} ${kit.btnFull}`}>
                    {clubLargeCta}
                  </Link>
                  {/* W5: a quote above the top band — an email, never "talk to us", never the interest form. */}
                  <p className={`${kit.small} ${fp.quietLine}`}>
                    More than 30 teams? Email {FIELDLOGICHQ_CONTACT_EMAIL} for a custom quote.
                  </p>
                </div>
              </div>
            ) : !clubOpen && (
              /* ── Start with Tournament while you wait (W28: it leaves once Club is open — Club includes tournaments) ── */
              <div className={`${kit.card} ${kit.stack}`}>
                <p className={kit.eyebrow}>Start now</p>
                <p className={kit.title}>
                  Running a tournament this year? Get your org on the platform today.
                </p>
                <p className={kit.body}>
                  Tournament and Tournament Plus are live now. Start with your next event —
                  your org is already set up on FieldLogicHQ when Club opens, with no data
                  to migrate.
                </p>
                <div className={fp.tagRow}>
                  {[`Tournament — Free`, `Tournament Plus — ${formatPriceAmount(PLAN_CONFIG.tournament_plus.monthlyPrice)}/mo ${BILLING_TAX_WORDS.plusTax}`].map(p => (
                    <span key={p} className={kit.tag}>{p}</span>
                  ))}
                </div>
                <div className={kit.push}>
                  <Link
                    href="/for-tournament-organizers"
                    className={`${kit.btn} ${kit.btnSecondary} ${kit.btnFull}`}
                  >
                    See tournament plans
                  </Link>
                </div>
              </div>
            )}

          </div>
          <p className={fp.afterCards}>
            <Link href="/pricing#org-plans" className={`${kit.link} ${kit.linkBlock}`}>
              See every plan and price
            </Link>
          </p>
          {/* Who can buy (Ask 15), once a club can. */}
          {clubOpen && <p className={kit.small}>{PLAN_AVAILABILITY_LINE}</p>}
        </div>
      </section>

      {/* ── How the trial works (W68, Ask 27): a disclosure, while Club is open and its trial exists ─────── */}
      {clubOpen && clubTrial && <HowTheTrialWorks who="club" trialLine={clubTrial} />}

      {/* ── Questions a board asks (W70; only while the legal pages are published) ── */}
      <BoardQuestionsSection club cost={clubOpen ? clubYearCost : null} />

      {/* ── Cross-sell ───────────────────────────────────────────────────── */}
      <section className={kit.section}>
        <div className="container">
          <p className={kit.eyebrow}>More from FieldLogicHQ</p>
          <div className={`${crossSells.length > 1 ? kit.grid2 : ''} ${fp.gridTop}`}>
            {crossSells.map(cs =>
              cs.href ? (
                <Link key={cs.label} href={cs.href} className={`${kit.card} ${fp.crossCard}`}>
                  <span className={kit.eyebrow}>{cs.label}</span>
                  <span className={kit.title}>{cs.q}</span>
                  <span className={kit.body}>{cs.body}</span>
                  <span className={fp.crossCta}>{cs.cta}</span>
                </Link>
              ) : (
                <EarlyAccessModalTrigger
                  key={cs.label}
                  className={`${kit.card} ${fp.crossCard}`}
                  initialPlanInterest={'initialPlanInterest' in cs ? cs.initialPlanInterest : undefined}
                  initialFeaturesInterested={'initialFeaturesInterested' in cs ? cs.initialFeaturesInterested : undefined}
                >
                  <span className={kit.eyebrow}>{cs.label}</span>
                  <span className={kit.title}>{cs.q}</span>
                  <span className={kit.body}>{cs.body}</span>
                  <span className={fp.crossCta}>{cs.cta}</span>
                </EarlyAccessModalTrigger>
              )
            )}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
      <section className={`${kit.section} ${kit.band} ${kit.center}`}>
        <div className="container">
          <h2 className={kit.heading}>
            The whole club,{' '}
            <span className={kit.accent}>one platform.</span>
          </h2>
          {clubOpen ? (
            /* W30 open (Ask 33): one button; "Start free with Tournament" leaves — Club includes tournaments. */
            <>
              <p className={kit.lead}>Pick the Club plan that fits and start today.</p>
              <div className={kit.row}>
                <Link href={startHref('club')} className={kit.btn}>{clubCta}</Link>
              </div>
              <div className={fp.afterNote}>
                <Link href="/pricing#org-plans" className={`${kit.link} ${kit.linkBlock}`}>See every plan and price</Link>
              </div>
            </>
          ) : (
            <>
              <p className={kit.lead}>
                {/* W30 closed: the canon interest line. */}
                {GATED_PLAN_INTEREST_LINE} Running a tournament now? Start free today.
              </p>
              <div className={kit.row}>
                <EarlyAccessModalTrigger
                  className={kit.btn}
                  initialPlanInterest={['club']}
                  initialFeaturesInterested={['accounting', 'rep_teams', 'coach_portal']}
                >
                  {interestButtonLabel(['club'])}
                </EarlyAccessModalTrigger>
                <Link href="/start/tournament" className={`${kit.btn} ${kit.btnSecondary}`}>
                  Start free with Tournament
                </Link>
              </div>
            </>
          )}
          <div className={fp.afterNote}>
            <p className={kit.small}>All plans are billed in CAD. No long-term contract. No setup fees.</p>
          </div>
        </div>
      </section>

    </main>
  );
}
