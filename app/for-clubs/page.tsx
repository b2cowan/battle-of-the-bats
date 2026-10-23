import Link from 'next/link';
import EarlyAccessModalTrigger from '@/components/EarlyAccessModalTrigger';
import kit from '@/components/marketing/MarketingKit.module.css';
import fp from '@/components/marketing/ForPage.module.css';
import { marketingMetadata } from '@/lib/marketing-metadata';
import { PLAN_ARTICLE_CONTENT } from '@/lib/plan-article-content';
import { PLAN_CONFIG, formatPriceAmount } from '@/lib/plan-config';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import { SEE_IT_LIVE_PATH, SEE_IT_LIVE_COACHES_PATH, sandboxDoorsVisible } from '@/lib/sandbox-door';

export const metadata = marketingMetadata({
  title: 'For club executives',
  description:
    'One platform for tournaments, house league, rep teams, and org finances. Coaches run their teams independently — you keep full visibility without owning every task.',
  path: '/for-clubs',
});

const { painItems: PAIN_ITEMS, steps: MODULES, features: CLUB_FEATURES } =
  PLAN_ARTICLE_CONTENT.club;

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
    body: "The Coaches Portal is also available standalone — coaches can start on their own today. When you move to Club, you can bring each coach’s team in with everything they’ve built, and it’s included in your plan from then on.",
    // Flips to a live "See the Coaches Portal" link with the coach checkout gate below — this card
    // held an express-interest trigger for a live product until 2026-08-10 (the same stale trap as
    // the /for-tournament-organizers cross-sell, found in the door-placement build).
    cta: 'Express interest in the Coaches Portal',
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

export default async function ForClubsPage() {
  const teamCheckoutOpen = !(await getPlanGatingMap()).team;
  const showSandboxDoor = sandboxDoorsVisible();
  const crossSells = CROSS_SELLS.map(cs =>
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
            <span className={kit.accent}>You run the org.</span>
          </h1>
          <p className={kit.lead}>
            One platform for tournaments, house league, rep teams, and org finances.
            Coaches operate independently — you keep full visibility without owning every task.
          </p>
          <div className={`${kit.row} ${fp.heroRow}`}>
            <EarlyAccessModalTrigger
              className={kit.btn}
              initialPlanInterest={['club']}
              initialFeaturesInterested={['accounting', 'rep_teams', 'coach_portal']}
            >
              Express interest in Club
            </EarlyAccessModalTrigger>
            <Link href="/for-tournament-organizers" className={`${kit.link} ${kit.linkBlock}`}>
              Running a tournament? See tournament plans
            </Link>
          </div>
          <p className={kit.small}>
            <span className={fp.noteStrong}>Coming soon</span>
            {' '}— Club is in development.{' '}
            {teamCheckoutOpen
              ? 'Tournament, Tournament Plus, and the Premium Coaches Portal are live today.'
              : 'Tournament and Tournament Plus are live today.'}
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

      {/* ── Both halves are live today (owner-ratified 2026-08-10) ───────────
          The club executive is the one persona genuinely interested in BOTH demos — their
          coming-soon page becomes proof-by-parts. Renders only while the doors are on; a door
          pattern must never appear anywhere it would promise a demo that doesn't exist. */}
      {showSandboxDoor && (
        <section className={kit.section}>
          <div className="container">
            <div className={`${kit.card} ${kit.cardEdge}`}>
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
          <h2 className={kit.heading}>Four modules. One platform.</h2>
          <p className={`${kit.body} ${fp.measure}`}>
            Club is the complete operating system for established clubs — every module,
            every role, one login.
          </p>
          <div className={`${kit.grid2} ${fp.gridTop}`}>
            {MODULES.map(mod => (
              <div key={mod.num} className={kit.card}>
                <p className={kit.counter}>{mod.num}</p>
                <p className={kit.eyebrow}>{mod.label}</p>
                <p className={kit.title}>{mod.title}</p>
                <p className={kit.body}>{mod.body}</p>
              </div>
            ))}
          </div>
          <div className={`${kit.card} ${kit.cardEdge} ${kit.cardFlat} ${fp.calloutTop}`}>
            <p className={kit.body}>
              Club includes the full house league module — if your org runs a house league program
              alongside rep teams, you do not need to purchase League Plus separately.
            </p>
          </div>
        </div>
      </section>

      {/* ── Plan section ─────────────────────────────────────────────────── */}
      <section className={kit.section}>
        <div className="container">
          <p className={kit.eyebrow}>The plan</p>
          <h2 className={kit.heading}>Club — the complete operating system.</h2>
          <p className={`${kit.body} ${fp.measure}`}>
            Club is finishing its final workflows before self-serve checkout opens.
            Express interest to be notified when it&apos;s ready for your organization.
          </p>
          <div className={`${fp.planGrid} ${fp.gridTop}`}>

            {/* ── Club plan ──────────────────────────────────────────────── */}
            <div className={`${kit.card} ${kit.cardFeatured} ${kit.stack}`}>
              <div>
                <p className={kit.title}>Club</p>
                <div className={fp.priceRow}>
                  <span className={kit.price}>{formatPriceAmount(PLAN_CONFIG.club.monthlyPrice)}</span>
                  <span className={kit.small}>/month</span>
                </div>
                <p className={kit.small}>{formatPriceAmount(PLAN_CONFIG.club.annualPrice)}/year — save two months · priced by club size (up to 15 teams · up to 30 on Club · Association)</p>
              </div>
              <p><span className={kit.tag}>Coming soon</span></p>
              <p className={kit.body}>
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
                <EarlyAccessModalTrigger
                  className={`${kit.btn} ${kit.btnFull}`}
                  initialPlanInterest={['club']}
                  initialFeaturesInterested={['accounting', 'rep_teams', 'coach_portal']}
                >
                  Express interest
                </EarlyAccessModalTrigger>
              </div>
            </div>

            {/* ── Start with Tournament while you wait ───────────────────── */}
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
          <p className={kit.lead}>
            Express interest in Club to be notified when self-serve checkout opens.
            Running a tournament now? Start free today.
          </p>
          <div className={kit.row}>
            <EarlyAccessModalTrigger
              className={kit.btn}
              initialPlanInterest={['club']}
              initialFeaturesInterested={['accounting', 'rep_teams', 'coach_portal']}
            >
              Express interest in Club
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
