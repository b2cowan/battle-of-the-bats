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
  PLAN_CONFIG, formatPriceAmount, gatedPlanTag, gatedPlanSentence, isPlanOpen, interestButtonLabel, GATED_PLAN_INTEREST_LINE,
  PLAN_AVAILABILITY_LINE,
} from '@/lib/plan-config';
import { BILLING_TAX_WORDS } from '@/lib/billing-tax';
// ⚠ 2026-08-20: this was the ONE persona page not reading the live gate, and it is the one whose
// availability copy drifted furthest ('in final refinement', 'opening soon' — for a parked plan).
// The other three ask the gate; now so does this one, so the sentence cannot go stale on its own.
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import { getPlanConfigOverride } from '@/lib/plan-config-db';
import { planTrialLine } from '@/lib/plan-trial-line';
import { START_PATH_FOR_PLAN, parseStartPricing, withStartPricing } from '@/lib/start-door';

export const metadata = marketingMetadata({
  // W64 (ruled 2026-11-18): the words a league board would search.
  title: 'House league registration and scheduling',
  description:
    'Run your house league season in one place: online registration, the draft, the schedule, standings and emails to every family. Built for volunteer boards.',
  path: '/for-leagues',
});

const { painItems: PAIN_ITEMS, steps: STEPS, features: LEAGUE_FEATURES } =
  PLAN_ARTICLE_CONTENT.league;

/** W67, as re-ruled 2026-11-21: a drawing for each step (Registration, Draft, Schedule and standings, Notifications), in order. */
const STEP_DRAWINGS: readonly OnSaleDrawingId[] = ['leagues-01-registration', 'leagues-02-draft', 'leagues-03-standings', 'leagues-04-notifications'];

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
    label: 'Club',
    q: 'Also running rep teams?',
    body: 'Club combines everything in League Plus with rep teams, accounting, the club’s books, and a Premium Coaches Portal for every coach on up to 15 teams, or up to 30 on Club · Association, with no per-team fee — for clubs that do it all.',
    cta: interestButtonLabel(['club']),
    initialPlanInterest: ['club'],
    initialFeaturesInterested: ['accounting', 'rep_teams', 'coach_portal'],
  },
  {
    label: 'Coaches Portal',
    q: 'Do your coaches need their own workspace?',
    // W35 closed / Ask 13: the bring-in promise waits for the coach-into-Club move to be proved on production.
    body: 'A complete workspace for one rep team — roster, lineups, budget, schedule, and documents. No org account needed. And if your organization moves to Club, a coach with a standalone portal won’t be charged for it again.',
    cta: interestButtonLabel(['team']),
    initialPlanInterest: ['coaches_portal'],
    initialFeaturesInterested: ['roster', 'lineups', 'budget', 'team_documents'],
  },
];

export default async function ForLeaguesPage() {
  // The live gate, per request (on-sale pages S1). League Plus's open state is S3: every line below that changes reads
  // League Plus's own gate; the Club cross-sell reads Club's.
  const gatingMap = await getPlanGatingMap();
  const teamCheckoutOpen = isPlanOpen(gatingMap, 'team');
  const leagueOpen = isPlanOpen(gatingMap, 'league');
  const clubOpen = isPlanOpen(gatingMap, 'club');
  // The trial sentence with the length checkout will use (a platform admin can override it); none for a 0-day trial.
  const leagueTrialDays = (await getPlanConfigOverride('league')).trialDays;
  const leagueTrial = leagueTrialDays > 0 ? planTrialLine(leagueTrialDays) : null;
  // A button that names a trial needs the trial (`/accounting` 2026-11-20).
  const leagueCta = leagueTrial ? 'Start your League Plus trial' : 'Start League Plus';
  const startHref = withStartPricing(START_PATH_FOR_PLAN.league, parseStartPricing('league', 'monthly'));
  // W35: the Coaches Portal cross-sell reads the Premium gate, as /for-clubs' already does (it said "Express interest"
  // for a product on sale since 2026-07-24); the Club one becomes a link to its page once Club is open.
  const crossSells = CROSS_SELLS.map(cs =>
    cs.label === 'Coaches Portal' && teamCheckoutOpen
      ? { ...cs, href: '/for-coaches', cta: 'See the Coaches Portal' }
      : cs.label === 'Club' && clubOpen
        ? { ...cs, href: '/for-clubs', cta: 'See what Club includes' }
        : cs,
  );
  return (
    <main className={kit.page}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className={kit.hero}>
        <div className="container">
          <p className={kit.eyebrow}>For house league administrators</p>
          <h1 className={kit.headline}>
            One dashboard.<br />
            <span className={kit.accent}>The full season arc.</span>
          </h1>
          <p className={kit.lead}>
            Player registration, draft tools, scheduling, standings, and season-wide parent messaging
            — everything your house league season needs, in one dashboard. No spreadsheets,
            no reply-all emails.
          </p>
          <div className={`${kit.row} ${fp.heroRow}`}>
            {leagueOpen ? (
              // W31 open: the League Plus start (S2's door), with the pick.
              <Link href={startHref} className={kit.btn}>{leagueCta}</Link>
            ) : (
              <EarlyAccessModalTrigger
                className={kit.btn}
                initialPlanInterest={['league']}
                initialFeaturesInterested={['house_league', 'registration', 'public_site']}
              >
                {interestButtonLabel(['league'])}
              </EarlyAccessModalTrigger>
            )}
            <Link href="/for-tournament-organizers" className={`${kit.link} ${kit.linkBlock}`}>
              Running a tournament? See tournament plans
            </Link>
          </div>
          {leagueOpen ? (
            leagueTrial && <p className={kit.small}>{leagueTrial}</p>
          ) : (
            <p className={kit.small}>
              {/* The tag, then the sentence's own words after it (as /for-clubs), so the tag is not said twice. */}
              <span className={fp.noteStrong}>{gatedPlanTag('league')}</span>
              {' '}— it isn&apos;t open for sign-up yet.{' '}
              {teamCheckoutOpen
                ? 'Tournament, Tournament Plus and the Premium Coaches Portal are live now.'
                : 'Tournament and Tournament Plus are live now.'}
            </p>
          )}
          <div className={fp.afterNote}>
            <ul className={kit.facts}>
              {/* `/legal` 2026-11-20: League Plus can change to no other plan yet, so the open page drops the line. */}
              {['No long-term contract — cancel any time', 'Billed in CAD', ...(leagueOpen ? [] : ['Upgrade or downgrade at any time'])].map(s => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Pain recognition ─────────────────────────────────────────────── */}
      <section className={kit.section}>
        <div className="container">
          <p className={kit.eyebrow}>The old way</p>
          <h2 className={kit.heading}>If this is your season setup, we know the drill.</h2>
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

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className={kit.section}>
        <div className="container">
          <p className={kit.eyebrow}>How it works</p>
          <h2 className={kit.heading}>Registration to final standings — four steps.</h2>
          <p className={`${kit.body} ${fp.measure}`}>
            From the moment registration opens to the final game night — everything runs in one place.
          </p>
          <div className={`${kit.grid2} ${fp.gridTop} ${fp.drawingGrid}`}>
            {STEPS.map((step, i) => (
              <div key={step.num} className={kit.card}>
                {STEP_DRAWINGS[i] && <OnSaleDrawing id={STEP_DRAWINGS[i]} />}
                <p className={kit.counter}>{step.num}</p>
                <p className={kit.eyebrow}>{step.label}</p>
                <p className={kit.title}>{step.title}</p>
                <p className={kit.body}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Plan section ─────────────────────────────────────────────────── */}
      <section className={kit.section}>
        <div className="container">
          <p className={kit.eyebrow}>The plan</p>
          <h2 className={kit.heading}>League Plus — built for the full season.</h2>
          <p className={`${kit.body} ${fp.measure}`}>
            {leagueOpen
              // W32 open.
              ? 'League Plus is open for sign-up. It is its own plan: you don\'t need a tournament plan first.'
              // W32 closed (`/marketing` 2026-11-20): "the clearest signal we have for when to open it" was the parked
              // plan's reason, gone since League Plus goes on sale with Club (2026-11-06).
              : `${gatedPlanSentence('league')} ${GATED_PLAN_INTEREST_LINE}`}
          </p>
          <div className={`${fp.planGrid} ${fp.gridTop}`}>

            {/* ── League plan ────────────────────────────────────────────── */}
            <div className={`${kit.card} ${kit.cardFeatured} ${kit.stack}`}>
              <div>
                {/* The status pill on the card's first line, on the right (one place for the pill, owner 2026-11-19). */}
                <div className={fp.cardFirstLine}>
                  <p className={kit.title}>League Plus</p>
                  {!leagueOpen && <span className={kit.tag}>{gatedPlanTag('league')}</span>}
                </div>
                <div className={fp.priceRow}>
                  <span className={kit.price}>{formatPriceAmount(PLAN_CONFIG.league.monthlyPrice)}</span>
                  <span className={kit.small}>/month</span>
                </div>
                {/* W33 open: the tax line under a price the buyer will be charged; a closed price carries none. */}
                {leagueOpen && <p className={kit.small}>{BILLING_TAX_WORDS.plusTax}</p>}
                <p className={kit.small}>{formatPriceAmount(PLAN_CONFIG.league.annualPrice)}/year — save two months</p>
                {leagueOpen && leagueTrial && <p className={kit.small}>{leagueTrial}</p>}
              </div>
              <p className={`${kit.body} ${fp.planCopyTop}`}>
                The complete house league platform — registration, draft, scheduling,
                standings, and parent communications in one place.
              </p>
              <div>
                <p className={kit.subhead}>Included</p>
                <ul className={kit.ticks}>
                  {LEAGUE_FEATURES.map(f => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
              <div className={kit.push}>
                {leagueOpen ? (
                  <Link href={startHref} className={`${kit.btn} ${kit.btnFull}`}>{leagueCta}</Link>
                ) : (
                  <EarlyAccessModalTrigger
                    className={`${kit.btn} ${kit.btnFull}`}
                    initialPlanInterest={['league']}
                    initialFeaturesInterested={['house_league', 'registration', 'public_site']}
                  >
                    {interestButtonLabel()}
                  </EarlyAccessModalTrigger>
                )}
              </div>
            </div>

            {leagueOpen ? (
              /* ── W34 open: what the plan already covers (its list starts "Everything in Tournament Plus") ── */
              <div className={`${kit.card} ${kit.stack}`}>
                <p className={kit.eyebrow}>Already included</p>
                <p className={kit.title}>Running a tournament too? It is in your plan.</p>
                <p className={kit.body}>
                  League Plus includes everything in Tournament Plus — public registration, check-in, schedule
                  generators and your own branding — so one plan covers your season and your events.
                </p>
                <div className={kit.push}>
                  <Link href="/for-tournament-organizers" className={`${kit.btn} ${kit.btnSecondary} ${kit.btnFull}`}>
                    See what Tournament Plus includes
                  </Link>
                </div>
              </div>
            ) : (
              /* ── Start with Tournament while you wait ───────────────────── */
              <div className={`${kit.card} ${kit.stack}`}>
                <p className={kit.eyebrow}>Start now</p>
                <p className={kit.title}>
                  Running a tournament this year? You can get started today.
                </p>
                <p className={kit.body}>
                  Tournament and Tournament Plus are live now. If your organization runs an annual
                  tournament or spring event, start there — your org is already on the platform
                  when League Plus opens.
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
          {/* Who can buy (Ask 15), once a league can. */}
          {leagueOpen && <p className={kit.small}>{PLAN_AVAILABILITY_LINE}</p>}
        </div>
      </section>

      {/* ── How the trial works (W68, Ask 27): a disclosure, while League Plus is open and its trial exists ─── */}
      {leagueOpen && leagueTrial && <HowTheTrialWorks who="league" trialLine={leagueTrial} />}

      {/* ── Questions a board asks (W70; only while the legal pages are published). Answer 6 only while League Plus is
          open: a closed price carries no tax line. ── */}
      <BoardQuestionsSection
        club={false}
        cost={leagueOpen
          ? `League Plus is ${formatPriceAmount(PLAN_CONFIG.league.annualPrice)} a year or ${formatPriceAmount(PLAN_CONFIG.league.monthlyPrice)} a month, ${BILLING_TAX_WORDS.plusTax}. That covers your seasons and your tournaments.`
          : null}
      />

      {/* ── Cross-sell ───────────────────────────────────────────────────── */}
      <section className={kit.section}>
        <div className="container">
          <p className={kit.eyebrow}>More from FieldLogicHQ</p>
          <div className={`${kit.grid2} ${fp.gridTop}`}>
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
                  initialPlanInterest={cs.initialPlanInterest}
                  initialFeaturesInterested={cs.initialFeaturesInterested}
                >
                  <span className={kit.eyebrow}>{cs.label}</span>
                  <span className={kit.title}>{cs.q}</span>
                  <span className={kit.body}>{cs.body}</span>
                  <span className={fp.crossCta}>{cs.cta}</span>
                </EarlyAccessModalTrigger>
              ),
            )}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
      <section className={`${kit.section} ${kit.band} ${kit.center}`}>
        <div className="container">
          <h2 className={kit.heading}>
            Your season deserves{' '}
            <span className={kit.accent}>a real platform.</span>
          </h2>
          {leagueOpen ? (
            /* W36 open (Ask 33): one button; "Start free with Tournament" leaves — League Plus includes Tournament Plus. */
            <>
              <p className={kit.lead}>Start League Plus today.</p>
              <div className={kit.row}>
                <Link href={startHref} className={kit.btn}>{leagueCta}</Link>
              </div>
              <div className={fp.afterNote}>
                <Link href="/pricing#org-plans" className={`${kit.link} ${kit.linkBlock}`}>See every plan and price</Link>
              </div>
            </>
          ) : (
            <>
              <p className={kit.lead}>
                {/* W36 closed: the canon interest line. */}
                {GATED_PLAN_INTEREST_LINE} Running a tournament now? Start free today.
              </p>
              <div className={kit.row}>
                <EarlyAccessModalTrigger
                  className={kit.btn}
                  initialPlanInterest={['league']}
                  initialFeaturesInterested={['house_league', 'registration', 'public_site']}
                >
                  {interestButtonLabel(['league'])}
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
