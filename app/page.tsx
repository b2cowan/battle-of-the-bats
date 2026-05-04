import Link from 'next/link';
import styles from './page.module.css';
import AnimateIn from '@/components/AnimateIn';
import PricingSection from '@/components/PricingSection';

const CAPABILITIES = [
  { id: 'CAP-01', name: 'Playoff Wizard',      spec: 'Bracket Generation Algorithm',       status: 'ACTIVE' },
  { id: 'CAP-02', name: 'Live Bracket Sync',   spec: 'Supabase Realtime · <50ms latency',  status: 'ACTIVE' },
  { id: 'CAP-03', name: 'Registration Engine', spec: 'Multi-tier capacity management',      status: 'ACTIVE' },
  { id: 'CAP-04', name: 'Digital Ledger',      spec: 'Immutable tournament archives',       status: 'BETA'   },
];

const STEPS = [
  {
    num: '01',
    label: 'CONFIGURE NODE',
    desc: 'Create your organization. Define age groups, field layout, and schedule format.',
  },
  {
    num: '02',
    label: 'OPEN INGESTION',
    desc: 'Activate public registration endpoint. Teams enroll; waitlist logic executes automatically.',
  },
  {
    num: '03',
    label: 'EXECUTE TOURNAMENT',
    desc: 'Enter scores via admin panel. Bracket advances in real-time. Final state sealed to the Digital Ledger.',
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
                System Operational
              </span>
              <span className="font-mono text-xs text-data-gray/40">·</span>
              <span className="font-mono text-xs text-data-gray uppercase tracking-widest">
                Multi-tenant · v2.0
              </span>
            </div>

            <h1 className={styles.heroTitle}>
              Engineered for{' '}
              <span className={styles.heroAccent}>Competition.</span>
            </h1>

            <p className={styles.heroSub}>
              A high-precision tournament management layer for sports organizations
              that demand structural integrity in their operations.
              Real-time brackets. Immutable records. Zero spreadsheets.
            </p>

            <div className={styles.heroActions}>
              <Link
                href="/auth/signup"
                className="font-mono text-sm font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors"
              >
                Initialize Your Organization
              </Link>
              <Link
                href="/discover"
                className="font-mono text-sm uppercase tracking-widest text-data-gray border border-blueprint-blue/40 px-8 py-4 hover:border-blueprint-blue hover:text-fl-text transition-colors"
              >
                View Live Systems →
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
              <p className={styles.eyebrow}>System Capabilities</p>
              <h2 className={styles.sectionTitle}>Infrastructure for competition</h2>
              <p className={styles.sectionSub}>
                Every module built for tournament operations that cannot afford to fail.
              </p>
            </div>
          </AnimateIn>
          <AnimateIn>
            <div className="border border-blueprint-blue/30 overflow-hidden">
              <div className="grid grid-cols-4 border-b border-blueprint-blue/20 bg-blueprint-blue/5 px-6 py-3">
                <span className="hud-label">ID</span>
                <span className="hud-label">Capability</span>
                <span className="hud-label">Specification</span>
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
              <p className={styles.eyebrow}>Initialization Sequence</p>
              <h2 className={styles.sectionTitle}>Operational in a single session</h2>
              <p className={styles.sectionSub}>
                No training required. Define parameters, open the endpoint, execute.
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
              <p className={styles.eyebrow}>Access Tiers</p>
              <h2 className={styles.sectionTitle}>Select your operational level</h2>
              <p className={styles.sectionSub}>
                Start at no cost. Upgrade as your organization scales. Every tier includes full platform access.
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
              <p className={styles.eyebrow}>Operator Reports</p>
              <h2 className={styles.sectionTitle}>Field-verified performance</h2>
            </div>
          </AnimateIn>
          <div className={styles.testimonialGrid}>
            {OPERATOR_LOGS.map(({ id, operator, org, entry }, i) => (
              <AnimateIn key={id} delay={i * 120}>
                <div className="border-l-2 border-blueprint-blue bg-hud-surface p-6 flex flex-col gap-4">
                  <div className="font-mono text-[10px] text-data-gray/50 uppercase tracking-widest">
                    {id} · {operator} · {org}
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
            Join organizations that have moved from spreadsheets to structured infrastructure.
          </p>
          <div className={styles.ctaActions}>
            <Link
              href="/auth/signup"
              className="font-mono text-sm font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors"
            >
              Initialize Your Organization
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
