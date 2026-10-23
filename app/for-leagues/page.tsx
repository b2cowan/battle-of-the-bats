import Link from 'next/link';
import EarlyAccessModalTrigger from '@/components/EarlyAccessModalTrigger';
import kit from '@/components/marketing/MarketingKit.module.css';
import fp from '@/components/marketing/ForPage.module.css';
import { marketingMetadata } from '@/lib/marketing-metadata';
import { PLAN_ARTICLE_CONTENT } from '@/lib/plan-article-content';
import { PLAN_CONFIG, formatPriceAmount, gatedPlanTag, gatedPlanSentence } from '@/lib/plan-config';
// ⚠ 2026-08-20: this was the ONE persona page not reading the live gate, and it is the one whose
// availability copy drifted furthest ('in final refinement', 'opening soon' — for a parked plan).
// The other three ask the gate; now so does this one, so the sentence cannot go stale on its own.
import { getPlanGatingMap } from '@/lib/plan-gating-server';

export const metadata = marketingMetadata({
  title: 'For house league administrators',
  description:
    'Run your full house league season in one dashboard — registration, draft, scheduling, standings, and season-wide parent messaging. No spreadsheets, no reply-all emails.',
  path: '/for-leagues',
});

const { painItems: PAIN_ITEMS, steps: STEPS, features: LEAGUE_FEATURES } =
  PLAN_ARTICLE_CONTENT.league;

const CROSS_SELLS = [
  {
    label: 'Club',
    q: 'Also running rep teams?',
    body: 'Club combines everything in League Plus with rep teams, accounting, org-wide financials, and a Premium Coaches Portal for your whole coaching staff — every team, no per-team fee — for clubs that do it all.',
    cta: 'Express interest in Club',
    initialPlanInterest: ['club'],
    initialFeaturesInterested: ['accounting', 'rep_teams', 'coach_portal'],
  },
  {
    label: 'Coaches Portal',
    q: 'Do your coaches need their own workspace?',
    body: 'A complete workspace for one rep team — roster, lineups, budget, schedule, and documents. No org account needed. And if your organization moves to Club, it can bring each coach’s team in with everything they’ve built.',
    cta: 'Express interest in the Coaches Portal',
    initialPlanInterest: ['coaches_portal'],
    initialFeaturesInterested: ['roster', 'lineups', 'budget', 'team_documents'],
  },
];

export default async function ForLeaguesPage() {
  const teamCheckoutOpen = !(await getPlanGatingMap()).team;
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
            <EarlyAccessModalTrigger
              className={kit.btn}
              initialPlanInterest={['league']}
              initialFeaturesInterested={['house_league', 'registration', 'public_site']}
            >
              Express interest in League Plus
            </EarlyAccessModalTrigger>
            <Link href="/for-tournament-organizers" className={`${kit.link} ${kit.linkBlock}`}>
              Running a tournament? See tournament plans
            </Link>
          </div>
          <p className={kit.small}>
            <span className={fp.noteStrong}>{gatedPlanTag('league')}</span>
            {' '}— {gatedPlanSentence('league')}{' '}
            {teamCheckoutOpen
              ? 'Tournament, Tournament Plus and the Premium Coaches Portal are live now.'
              : 'Tournament and Tournament Plus are live now.'}
          </p>
          <div className={fp.afterNote}>
            <ul className={kit.facts}>
              {['No contracts — cancel anytime', 'Billed in CAD', 'Upgrade or downgrade at any time'].map(s => (
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
          <div className={`${kit.grid2} ${fp.gridTop}`}>
            {STEPS.map(step => (
              <div key={step.num} className={kit.card}>
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
            League Plus is built but not currently open for sign-up. Tell us your league is waiting — it is the clearest signal we have for when to open it.
          </p>
          <div className={`${fp.planGrid} ${fp.gridTop}`}>

            {/* ── League plan ────────────────────────────────────────────── */}
            <div className={`${kit.card} ${kit.cardFeatured} ${kit.stack}`}>
              <div>
                <p className={kit.title}>League Plus</p>
                <div className={fp.priceRow}>
                  <span className={kit.price}>{formatPriceAmount(PLAN_CONFIG.league.monthlyPrice)}</span>
                  <span className={kit.small}>/month</span>
                </div>
                <p className={kit.small}>{formatPriceAmount(PLAN_CONFIG.league.annualPrice)}/year — save two months</p>
              </div>
              <p><span className={kit.tag}>{gatedPlanTag('league')}</span></p>
              <p className={kit.body}>
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
                <EarlyAccessModalTrigger
                  className={`${kit.btn} ${kit.btnFull}`}
                  initialPlanInterest={['league']}
                  initialFeaturesInterested={['house_league', 'registration', 'public_site']}
                >
                  Express interest
                </EarlyAccessModalTrigger>
              </div>
            </div>

            {/* ── Start with Tournament while you wait ───────────────────── */}
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
                {[`Tournament — Free`, `Tournament Plus — ${formatPriceAmount(PLAN_CONFIG.tournament_plus.monthlyPrice)}/mo`].map(p => (
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

          </div>
          <p className={fp.afterCards}>
            <Link href="/pricing#org-plans" className={`${kit.link} ${kit.linkBlock}`}>
              See every plan and price
            </Link>
          </p>
        </div>
      </section>

      {/* ── Cross-sell ───────────────────────────────────────────────────── */}
      <section className={kit.section}>
        <div className="container">
          <p className={kit.eyebrow}>More from FieldLogicHQ</p>
          <div className={`${kit.grid2} ${fp.gridTop}`}>
            {CROSS_SELLS.map(cs => (
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
            ))}
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
          <p className={kit.lead}>
            Express interest in League Plus to be notified when self-serve checkout opens.
            Running a tournament now? Start free today.
          </p>
          <div className={kit.row}>
            <EarlyAccessModalTrigger
              className={kit.btn}
              initialPlanInterest={['league']}
              initialFeaturesInterested={['house_league', 'registration', 'public_site']}
            >
              Express interest in League Plus
            </EarlyAccessModalTrigger>
            <Link href="/start/tournament" className={`${kit.btn} ${kit.btnSecondary}`}>
              Start free with Tournament
            </Link>
          </div>
          <div className={fp.afterNote}>
            <p className={kit.small}>All plans are billed in CAD. No contracts. No setup fees.</p>
          </div>
        </div>
      </section>

    </main>
  );
}
