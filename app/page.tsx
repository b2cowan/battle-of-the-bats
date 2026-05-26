import Link from 'next/link';
import styles from './page.module.css';
import AnimateIn from '@/components/AnimateIn';
import PricingSection from '@/components/PricingSection';
import EarlyAccessModalTrigger from '@/components/EarlyAccessModalTrigger';
import { getPlanGatingMap } from '@/lib/plan-gating-server';

const MODULE_CARDS = [
  {
    id: '01',
    name: 'Tournament Organizer',
    href: '/for-tournament-organizers',
    plan: 'Tournament · Free to start',
    tagline: 'From team registration to final standings — without the spreadsheets.',
    features: [
      'Custom team registration with waitlist management',
      'Schedule generator across fields and time slots',
      'Single and double-elimination brackets',
      'Live score entry — standings update the moment you save',
      'Tournament archives — every past event preserved',
    ],
  },
  {
    id: '02',
    name: 'House League Admin',
    href: '/for-leagues',
    plan: 'League · Coming soon',
    tagline: 'From first registration to final standings, in one dashboard.',
    features: [
      'Player registration and waitlist management',
      'Draft tools and team building',
      'Auto-generated schedules and standings',
      'Automated parent notifications — no manual emails',
      'One dashboard from opening day to final standings',
    ],
  },
  {
    id: '03',
    name: 'Club Executive',
    href: '/for-clubs',
    plan: 'Club · Coming soon',
    tagline: 'Your executive team gets visibility. Coaches run their own teams.',
    features: [
      'Tournaments, house league, and rep teams under one roof',
      'Coaches manage their own roster, lineups, and team budget',
      'Organization-wide visibility into rosters, documents, and finances',
      'Tryout registration and program year management',
      'Organization ledger, team invoicing, and financial reporting',
    ],
  },
  {
    id: '04',
    name: 'Head Coach',
    href: '/for-coaches',
    plan: 'Coaches Portal · Coming soon',
    tagline: 'Manage your team. Not your inbox.',
    features: [
      'Full roster management with positions and season history',
      'Lineup builder with game-by-game history — exportable to PDF',
      'Team budget, player dues, and payment tracking',
      'Document management — consent forms, medical notes, eligibility',
      'Works standalone — no organization account required',
    ],
  },
];

const STEPS = [
  {
    num: '01',
    label: 'SET UP YOUR ORGANIZATION',
    desc: 'Create your organization and set up the tournament tools you need today. League and club modules can be added as they open.',
  },
  {
    num: '02',
    label: 'OPEN YOUR PROGRAMS',
    desc: 'Publish tournament pages, manage teams and contacts, and keep registration work organized without extra spreadsheets.',
  },
  {
    num: '03',
    label: 'RUN YOUR WHOLE SEASON',
    desc: 'Enter scores from the field, publish results, and preserve tournament history. Broader season operations are coming next.',
  },
];

const PLATFORM_BENEFITS = [
  {
    id: 'BEN-001',
    module: 'Tournament module',
    entry: 'Generate brackets in seconds, not hours. Coaches and parents see live scores the moment you enter them — no calls to the scorekeeper\'s table.',
  },
  {
    id: 'BEN-002',
    module: 'House League module',
    entry: 'Open registration, run your draft, publish the schedule, and track standings — all in one dashboard. Parents get automated game notifications without staff sending a single email.',
  },
  {
    id: 'BEN-003',
    module: 'Rep Teams module',
    entry: 'Coaches manage their own roster, documents, and team finances independently. Organization admins get visibility without owning the day-to-day.',
  },
  {
    id: 'BEN-004',
    module: 'Coaches Portal',
    entry: 'The roster in a group text, the lineup in a notes app, and team fees tracked in someone\'s head. The Coaches Portal puts all of it in one place — whether or not your organization is on FieldLogicHQ.',
  },
];
// id field kept for React key only — not rendered

const PERSONAS = [
  {
    id: 'tournament',
    label: 'Tournament',
    question: 'Running a tournament?',
    body: 'From team registration to final standings — brackets, schedule, live scores, all in one place.',
    badge: 'Free to start · no credit card',
    isLive: true,
    cta: "I'm a tournament organizer",
    href: '/for-tournament-organizers',
  },
  {
    id: 'league',
    label: 'League',
    question: 'Managing a house league season?',
    body: 'Player registration, draft, schedule, standings, and parent notifications — from first signup to final game.',
    badge: 'Coming soon · express interest',
    isLive: false,
    cta: 'I run a house league',
    href: '/for-leagues',
  },
  {
    id: 'club',
    label: 'Club',
    question: 'Running a club with rep teams?',
    body: 'Tournaments, house league, rep teams, and accounting in one place. Your executive team gets visibility. Coaches run their own teams.',
    badge: 'Coming soon · express interest',
    isLive: false,
    cta: 'I run a club',
    href: '/for-clubs',
  },
  {
    id: 'coaches',
    label: 'Coaches Portal',
    question: 'Coaching a single team?',
    body: 'Roster, lineups, budget, and documents — a complete team workspace, whether or not your organization is on FieldLogicHQ.',
    badge: 'Coming soon · express interest',
    isLive: false,
    cta: "I'm a coach",
    href: '/for-coaches',
  },
];

export default async function HomePage() {
  const gatingMap = await getPlanGatingMap();
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroGrid} />
        <div className="container">
          <div className={styles.heroHeader}>
            <div className="flex items-center gap-3 mb-8 justify-center">
              <span className="font-mono text-xs text-data-gray uppercase tracking-widest">
                Free plan available
              </span>
              <span className="font-mono text-xs text-data-gray/40">·</span>
              <span className="font-mono text-xs text-data-gray uppercase tracking-widest">
                No credit card required
              </span>
            </div>

            <h1 className={styles.heroTitle}>
              Less admin.{' '}
              <span className={styles.heroAccent}>More sport.</span>
            </h1>

            <p className={styles.heroSub}>
              Purpose-built for the people running community sports organizations on evenings
              and weekends — from your first tournament to a full club program.
            </p>
          </div>

          <AnimateIn>
            <div className={styles.heroPersonaGrid}>
              {PERSONAS.map((p) => (
                <Link
                  key={p.id}
                  href={p.href}
                  className={styles.heroPersonaCard}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="font-mono text-[10px] text-logic-lime uppercase tracking-widest font-bold">
                      {p.label}
                    </span>
                    <span className={`font-mono text-[9px] uppercase tracking-widest text-right leading-relaxed ${p.isLive ? 'text-logic-lime' : 'text-data-gray/40'}`}>
                      {p.badge}
                    </span>
                  </div>
                  <p className="font-mono text-sm font-bold text-fl-text leading-snug">{p.question}</p>
                  <p className="font-mono text-xs text-data-gray/70 leading-relaxed flex-1">{p.body}</p>
                  <span className={`font-mono text-[10px] uppercase tracking-widest ${p.isLive ? 'text-logic-lime' : 'text-data-gray/50'}`}>
                    {p.cta} →
                  </span>
                </Link>
              ))}
            </div>
          </AnimateIn>

          <div className={styles.heroFooterNote}>
            <span className="font-mono text-xs text-data-gray/50 uppercase tracking-widest">
              Already know what you need?
            </span>
            <Link
              href="/auth/signup"
              className="font-mono text-xs uppercase tracking-widest text-logic-lime hover:text-fl-text transition-colors"
            >
              Start free →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Modules ───────────────────────────────────────────────────── */}
      <section className={styles.features}>
        <div className="container">
          <AnimateIn>
            <div className={styles.sectionHead}>
              <p className={styles.eyebrow}>What&apos;s included</p>
              <h2 className={styles.sectionTitle}>One platform. Every role.</h2>
              <p className={styles.sectionSub}>
                Tournament organizers can start today — free, no credit card required. League, Club, and Coaches Portal are in active development.
              </p>
            </div>
          </AnimateIn>
          <AnimateIn>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {MODULE_CARDS.map((mod) => (
                <div key={mod.id} className="border border-blueprint-blue/30 p-8 flex flex-col gap-5 hover:border-blueprint-blue/60 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="font-mono text-[10px] text-data-gray/40 uppercase tracking-widest">{mod.id}</span>
                      <h3 className="font-mono text-sm font-bold text-fl-text uppercase tracking-wide mt-0.5">{mod.name}</h3>
                    </div>
                    <span className="font-mono text-[10px] text-data-gray/50 uppercase tracking-widest text-right leading-relaxed">{mod.plan}</span>
                  </div>
                  <p className="font-mono text-xs text-data-gray leading-relaxed">{mod.tagline}</p>
                  <ul className="flex flex-col gap-2 flex-1">
                    {mod.features.map(f => (
                      <li key={f} className="font-mono text-xs text-data-gray/70 flex gap-2">
                        <span className="text-logic-lime flex-shrink-0">—</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={mod.href}
                    className="font-mono text-xs text-logic-lime uppercase tracking-widest hover:text-fl-text transition-colors self-start"
                  >
                    This is me →
                  </Link>
                </div>
              ))}
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* ── Initialization Sequence ───────────────────────────────────── */}
      <section className={styles.howItWorks}>
        <div className="container">
          <AnimateIn>
            <div className={styles.sectionHead}>
              <p className={styles.eyebrow}>How It Works</p>
              <h2 className={styles.sectionTitle}>Up and running in a day</h2>
              <p className={styles.sectionSub}>
                No manual needed. Set up your organization, open your programs, run your whole season.
              </p>
            </div>
          </AnimateIn>
          <div className={styles.stepsGrid}>
            {STEPS.map(({ num, label, desc }, i) => (
              <AnimateIn key={num} delay={i * 100}>
                <div className="p-8 border border-blueprint-blue/30 hover:border-blueprint-blue/60 transition-colors relative">
                  <span className="font-mono text-6xl font-bold text-blueprint-blue/20 absolute top-5 right-6 leading-none select-none">
                    {num}
                  </span>
                  <div className="hud-label text-blueprint-blue mb-3">{label}</div>
                  <p className="font-mono text-xs text-data-gray leading-relaxed">{desc}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────── */}
      <section className={styles.pricing} id="pricing">
        <div className="container">
          <AnimateIn>
            <div className={styles.sectionHead}>
              <p className={styles.eyebrow}>Pricing</p>
              <h2 className={styles.sectionTitle}>Plans built for how you operate.</h2>
              <p className={styles.sectionSub}>
                Tournament and Tournament Plus are available now. League and Club are open for early-access interest while those workflows are refined.
              </p>
            </div>
          </AnimateIn>
          <PricingSection gatingMap={gatingMap} />

          {/* Coaches Portal callout — matches pricing page coachesCallout treatment */}
          <div className="mt-3 flex items-center gap-8 flex-wrap border border-blueprint-blue/25 px-6 py-4" style={{ background: 'rgba(30,58,138,0.03)' }}>
            <div className="flex items-baseline gap-6 flex-1 flex-wrap">
              <span className="font-mono text-[0.6rem] font-bold uppercase tracking-widest text-logic-lime whitespace-nowrap flex-shrink-0">
                Coaches Portal
              </span>
              <span className="font-mono text-[0.82rem] font-bold text-fl-text whitespace-nowrap flex-shrink-0">
                $29 CAD <span className="font-normal text-[0.72rem] text-data-gray">/mo</span>
              </span>
              <span className="font-mono text-[0.7rem] text-data-gray whitespace-nowrap flex-shrink-0">
                or $290/season — save two months
              </span>
              <span className="font-mono text-[0.73rem] text-data-gray leading-relaxed flex-1 min-w-[180px]">
                A standalone workspace for one rep team — roster, lineups, budget, and schedule. No organization account needed. Coming soon.
              </span>
            </div>
            <EarlyAccessModalTrigger
              className="inline-flex items-center justify-center min-h-[38px] px-4 border border-logic-lime/40 bg-transparent text-logic-lime font-mono text-[0.68rem] font-bold uppercase tracking-widest whitespace-nowrap flex-shrink-0 hover:bg-logic-lime/10 hover:text-fl-text transition-colors cursor-pointer"
              initialPlanInterest={['coaches_portal']}
              initialFeaturesInterested={['roster', 'lineups', 'budget', 'team_documents']}
            >
              Express interest →
            </EarlyAccessModalTrigger>
          </div>

          <div className="flex justify-center mt-6">
            <Link
              href="/pricing"
              className="font-mono text-xs uppercase tracking-widest text-data-gray border border-blueprint-blue/30 px-6 py-2.5 hover:border-blueprint-blue hover:text-fl-text transition-colors"
            >
              Compare all plans in detail →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Platform Benefits ─────────────────────────────────────────── */}
      <section className={styles.testimonials}>
        <div className="container">
          <AnimateIn>
            <div className={styles.sectionHead}>
              <p className={styles.eyebrow}>Platform highlights</p>
              <h2 className={styles.sectionTitle}>What it actually replaces</h2>
            </div>
          </AnimateIn>
          <div className={styles.testimonialGrid}>
            {PLATFORM_BENEFITS.map(({ id, module, entry }, i) => (
              <AnimateIn key={id} delay={i * 120}>
                <div className="border-l-2 border-blueprint-blue bg-hud-surface p-6 flex flex-col gap-4">
                  <div className="font-mono text-[10px] text-data-gray/50 uppercase tracking-widest">
                    {module}
                  </div>
                  <p className="font-mono text-xs text-fl-text/80 leading-relaxed">{entry}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ────────────────────────────────────────────────── */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaBg} />
        <div className="container">
          <p className={`${styles.eyebrow} mb-6`}>Built for how community sport actually runs</p>
          <p className={styles.ctaSub}>
            Your organization isn&apos;t just running a tournament. You&apos;re managing house league
            registrations, rep team tryouts, field bookings, and a treasurer who tracks
            dues in a spreadsheet — all with volunteers, on nights and weekends, for the
            kids in your community.
          </p>
          <h2 className={styles.ctaTitle}>
            Your season belongs{' '}
            <span className={styles.heroAccent}>on a real platform.</span>
          </h2>
          <div className={styles.ctaActions}>
            <Link
              href="/auth/signup"
              className="font-mono text-sm font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors"
            >
              Start Your Organization
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
