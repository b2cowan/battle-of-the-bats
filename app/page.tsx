import Link from 'next/link';
import styles from './page.module.css';
import AnimateIn from '@/components/AnimateIn';
import PricingSection from '@/components/PricingSection';

const CAPABILITIES = [
  { id: '01', name: 'Bracket Builder',    spec: 'Generate single or double-elimination brackets in seconds',         status: 'ACTIVE' },
  { id: '02', name: 'Live Brackets',      spec: 'Scores update for coaches and parents the moment you enter them',   status: 'ACTIVE' },
  { id: '03', name: 'Team Registration',  spec: 'Custom registration forms with waitlist management built in',       status: 'ACTIVE' },
  { id: '04', name: 'Tournament Archive', spec: 'Every result sealed and searchable after the final whistle',        status: 'BETA'   },
];

const STEPS = [
  {
    num: '01',
    label: 'SET UP YOUR ORGANIZATION',
    desc: 'Create your organization. Define age groups, field layout, and schedule format.',
  },
  {
    num: '02',
    label: 'OPEN REGISTRATION',
    desc: 'Share your registration link. Teams sign up, and waitlist management runs automatically.',
  },
  {
    num: '03',
    label: 'RUN YOUR TOURNAMENT',
    desc: 'Enter scores from the sideline. Brackets advance live. Results are archived when it\'s over.',
  },
];

const OPERATOR_LOGS = [
  {
    id: 'OPS-001',
    operator: 'Sarah M.',
    org: 'Regional Softball Association',
    entry: 'Bracket generation reduced from 3 hours to under 5 minutes. Coaches access live results directly — zero status requests to staff.',
  },
  {
    id: 'OPS-002',
    operator: 'Kevin T.',
    org: 'City Youth Sports League',
    entry: 'Waitlist automation eliminated manual team-management overhead. Seat releases execute without staff intervention.',
  },
];
// id field kept for React key only — not rendered

export default function HomePage() {
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroGrid} />
        <div className="container">
          <div className={styles.heroContent}>
            <div className="flex items-center gap-3 mb-8 justify-center">
              <span className="font-mono text-xs text-logic-lime uppercase tracking-widest flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-logic-lime animate-pulse" />
                Live
              </span>
              <span className="font-mono text-xs text-data-gray/40">·</span>
              <span className="font-mono text-xs text-data-gray uppercase tracking-widest">
                50+ Organizations Running
              </span>
            </div>

            <h1 className={styles.heroTitle}>
              Engineered for{' '}
              <span className={styles.heroAccent}>Competition.</span>
            </h1>

            <p className={styles.heroSub}>
              Everything you need to run a tournament — registration, brackets,
              and live scores — without the spreadsheets. Built for the organizers who
              take it seriously.
            </p>

            <div className={styles.heroActions}>
              <Link
                href="/auth/signup"
                className="font-mono text-sm font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors"
              >
                Start Your Organization
              </Link>
              <Link
                href="/discover"
                className="font-mono text-sm uppercase tracking-widest text-data-gray border border-blueprint-blue/40 px-8 py-4 hover:border-blueprint-blue hover:text-fl-text transition-colors"
              >
                See Live Tournaments →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────────────── */}
      <section className={styles.statsBar}>
        <div className="container">
          <div className={styles.statsBarInner}>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>50+</span>
              <span className={styles.statLabel}>Tournaments</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>2,000+</span>
              <span className={styles.statLabel}>Teams</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>300+</span>
              <span className={styles.statLabel}>Age divisions</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── System Capabilities ───────────────────────────────────────── */}
      <section className={styles.features}>
        <div className="container">
          <AnimateIn>
            <div className={styles.sectionHead}>
              <p className={styles.eyebrow}>Platform Features</p>
              <h2 className={styles.sectionTitle}>Everything a tournament needs</h2>
              <p className={styles.sectionSub}>
                From first registration to final bracket — every tool in one place.
              </p>
            </div>
          </AnimateIn>
          <AnimateIn>
            <div className="border border-blueprint-blue/30 overflow-hidden">
              <div className="grid grid-cols-4 border-b border-blueprint-blue/20 bg-blueprint-blue/5 px-6 py-3">
                <span className="hud-label">#</span>
                <span className="hud-label">Feature</span>
                <span className="hud-label">What it does</span>
                <span className="hud-label text-right">Status</span>
              </div>
              {CAPABILITIES.map((cap, i) => (
                <div
                  key={cap.id}
                  className={`grid grid-cols-4 px-6 py-4 border-b border-blueprint-blue/10 transition-colors hover:bg-blueprint-blue/5 ${i === CAPABILITIES.length - 1 ? 'border-b-0' : ''}`}
                >
                  <span className="font-mono text-xs text-data-gray/50">{cap.id}</span>
                  <span className="font-mono text-xs font-bold text-fl-text uppercase tracking-wide">{cap.name}</span>
                  <span className="font-mono text-xs text-data-gray">{cap.spec}</span>
                  <span className={`font-mono text-xs font-bold text-right ${cap.status === 'ACTIVE' ? 'text-logic-lime' : 'text-data-gray'}`}>
                    {cap.status}
                  </span>
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
                No manual needed. Set up your organization, open registration, run your tournament.
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
              <h2 className={styles.sectionTitle}>Simple pricing. Start free.</h2>
              <p className={styles.sectionSub}>
                Start for free — no credit card needed. Upgrade as you grow.
              </p>
            </div>
          </AnimateIn>
          <PricingSection />
        </div>
      </section>

      {/* ── Operator Logs ─────────────────────────────────────────────── */}
      <section className={styles.testimonials}>
        <div className="container">
          <AnimateIn>
            <div className={styles.sectionHead}>
              <p className={styles.eyebrow}>From the Field</p>
              <h2 className={styles.sectionTitle}>Real results, real organizers</h2>
            </div>
          </AnimateIn>
          <div className={styles.testimonialGrid}>
            {OPERATOR_LOGS.map(({ id, operator, org, entry }, i) => (
              <AnimateIn key={id} delay={i * 120}>
                <div className="border-l-2 border-blueprint-blue bg-hud-surface p-6 flex flex-col gap-4">
                  <div className="font-mono text-[10px] text-data-gray/50 uppercase tracking-widest">
                    {operator} · {org}
                  </div>
                  <p className="font-mono text-xs text-fl-text/80 leading-relaxed">{entry}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Showcase ──────────────────────────────────────────────────── */}
      <section className={styles.showcase}>
        <div className="container">
          <div className={styles.showcaseCard}>
            <div className={styles.showcaseText}>
              <h2>Built for tournaments like Battle of the Bats</h2>
              <p>
                The Milton Softball Association runs their annual Battle of the Bats
                tournament entirely on this platform — from U11 to U19, pool play
                through playoffs. Take a look at a live tournament in action.
              </p>
            </div>
            <div className={styles.showcaseActions}>
              <Link
                href="/milton-bats"
                className="font-mono text-xs uppercase tracking-widest font-bold bg-logic-lime text-pitch-black px-6 py-3 hover:bg-white transition-colors"
              >
                View Live Tournament →
              </Link>
              <Link
                href="/discover"
                className="font-mono text-xs uppercase tracking-widest text-data-gray border border-blueprint-blue/40 px-6 py-3 hover:border-blueprint-blue hover:text-fl-text transition-colors"
              >
                Browse All Tournaments
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ────────────────────────────────────────────────── */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaBg} />
        <div className="container">
          <h2 className={styles.ctaTitle}>
            Your tournament deserves{' '}
            <span className={styles.heroAccent}>a real platform.</span>
          </h2>
          <p className={styles.ctaSub}>
            Join organizers who have moved on from spreadsheets.
          </p>
          <div className={styles.ctaActions}>
            <Link
              href="/auth/signup"
              className="font-mono text-sm font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors"
            >
              Start Your Organization
            </Link>
            <Link
              href="/discover"
              className="font-mono text-sm uppercase tracking-widest text-data-gray border border-blueprint-blue/40 px-8 py-4 hover:border-blueprint-blue hover:text-fl-text transition-colors"
            >
              Browse Tournaments
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
