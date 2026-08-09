import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import styles from './page.module.css';
import AnimateIn from '@/components/AnimateIn';
import PricingSection from '@/components/PricingSection';
import { getPlanGatingMap, type PlanGatingMap } from '@/lib/plan-gating-server';
import type { OrgPlan } from '@/lib/types';
import { PLAN_CONFIG, formatPriceAmount, isFoundingSeasonPromoActive } from '@/lib/plan-config';
import { createClient } from '@/lib/supabase-server';
import { getAuthDestination } from '@/lib/auth-destination';
import { SEE_IT_LIVE_PATH, sandboxDoorsVisible } from '@/lib/sandbox-door';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

/**
 * The role deep-dive cards ("One platform. Every role.").
 *
 * Same contract as the persona cards below: NO CARD WRITES DOWN WHETHER ITS PRODUCT IS AVAILABLE —
 * this section held a hardcoded "Coaches Portal · Coming soon" for two weeks after that product
 * went live (found by the owner 2026-08-08, the exact trap the persona cards were cured of the day
 * before). `liveBadge` doubles as the launch switch: `null` means nobody has decided what the card
 * says when live, so it presents as in-development even if its gate opens — and per the
 * "live products lead" ruling (2026-08-08) an in-development role renders as a compact strip,
 * never a full deep-dive card. `stripLine` is that strip's one-sentence pitch.
 */
const MODULE_CARDS: Array<{
  id: string;
  name: string;
  href: string;
  planKey: OrgPlan;
  planLabel: string;
  liveBadge: string | null;
  tagline: string;
  features: string[];
  stripLine: string;
}> = [
  {
    id: '01',
    name: 'Tournament Organizer',
    href: '/for-tournament-organizers',
    planKey: 'tournament',
    planLabel: 'Tournament',
    liveBadge: 'Free to start',
    tagline: 'From team registration to final standings — without the spreadsheets.',
    features: [
      'Custom team registration with waitlist management',
      'Schedule generator across fields and time slots',
      'Single and double-elimination brackets',
      'Live score entry — standings update the moment you save',
      'Tournament archives — every past event preserved',
    ],
    stripLine: 'Registration to final standings, without the spreadsheets.',
  },
  {
    id: '02',
    name: 'Head Coach',
    href: '/for-coaches',
    planKey: 'team',
    planLabel: 'Coaches Portal',
    liveBadge: 'Free to start',
    tagline: 'Manage your team. Not your inbox.',
    features: [
      'Full roster management with positions and season history',
      'Lineup builder with game-by-game history — exportable to PDF',
      'Team budget, player dues, and payment tracking',
      'Document management — consent forms, medical notes, eligibility',
      'Works standalone — no organization account required',
    ],
    stripLine: 'A complete team workspace — with or without an organization.',
  },
  {
    id: '03',
    name: 'House League Admin',
    href: '/for-leagues',
    planKey: 'league',
    planLabel: 'League Plus',
    liveBadge: null,
    tagline: 'From first registration to final standings, in one dashboard.',
    features: [
      'Player registration and waitlist management',
      'Draft tools and team building',
      'Auto-generated schedules and standings',
      'Automated parent notifications — no manual emails',
      'One dashboard from opening day to final standings',
    ],
    stripLine: 'First registration to final standings, in one dashboard.',
  },
  {
    id: '04',
    name: 'Club Executive',
    href: '/for-clubs',
    planKey: 'club',
    planLabel: 'Club',
    liveBadge: null,
    tagline: 'Your executive team gets visibility. Coaches run their own teams.',
    features: [
      'Tournaments, house league, and rep teams under one roof',
      'Coaches manage their own roster, lineups, and team budget',
      'Organization-wide visibility into rosters, documents, and finances',
      'Tryout registration and program year management',
      'Organization ledger, team invoicing, and financial reporting',
    ],
    stripLine: 'The whole organization under one roof.',
  },
];

const STEPS = [
  {
    num: '01',
    label: 'SET UP YOUR ORGANIZATION',
    desc: 'Create your organization and set up the tournament tools you need today. League Plus and Club modules can be added as they open.',
  },
  {
    num: '02',
    label: 'OPEN YOUR PROGRAMS',
    desc: 'Publish tournament pages, manage teams and contacts, and keep registration work organized without extra spreadsheets.',
  },
  {
    num: '03',
    label: 'RUN YOUR WHOLE SEASON',
    desc: 'Enter scores from the field, publish results, and keep your tournament history on record — every event your org has run, in one place.',
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

/**
 * The persona cards.
 *
 * ⚠ NO CARD WRITES DOWN WHETHER ITS PRODUCT IS AVAILABLE. Every one carries the plan key it speaks
 * for, and `resolvePersonas` reads the live gate — because the alternative is what actually
 * happened: the Coaches Portal card held a hardcoded "coming soon" for two weeks after the Premium
 * Coaches Portal went live on production (gate reopened 2026-07-24), while /for-coaches, the /start
 * chooser and /pricing — all of which READ the gate — flipped together the same day. The homepage
 * was the one surface that asserted the answer instead of asking for it, so it froze, and the
 * highest-traffic page in the product spent a fortnight contradicting the three pages one click
 * behind it.
 *
 * Fixing only the card that was wrong would have left the identical trap armed under League Plus and
 * Club: their gates are DB-driven and can change without a deploy, so whichever launches next would
 * freeze the same way, and nobody would remember this comment in time.
 *
 * ⚠ `liveBadge: null` means "nobody has written what this card should say when it IS on sale", and
 * such a card **stays presented as coming-soon even once its gate opens**. That looks like the bug
 * this file just fixed, and it is deliberately not:
 *
 *   The homepage is not the only surface that speaks for a product. `/for-leagues` and `/for-clubs`
 *   hard-code "Coming soon" in their own copy — they do not read the gate the way `/for-coaches`
 *   does. So a card that went live the instant its gate flipped would send a visitor to a page still
 *   telling them the product isn't ready: the SAME contradiction, moved one click downstream. Given
 *   a choice between two inconsistencies, this one keeps the homepage and its destination agreeing.
 *
 *   Supplying `liveBadge` is therefore the single deliberate act that launches a card — and whoever
 *   does it must make the destination page gate-aware in the same unit of work. Until then the card
 *   is honest about being unavailable rather than dishonest about being available.
 *
 * Tracked in HOMEPAGE_TRUTH_AND_ENTRY_POINTS_PLAN.md; /marketing owes copy for both.
 */
type Persona = {
  id: string;
  /** The plan whose gate decides whether this card is on sale. */
  planKey: OrgPlan;
  label: string;
  question: string;
  body: string;
  liveBadge: string | null;
  cta: string;
  href: string;
};

/** The one line every not-yet-purchasable card shows. */
const GATED_BADGE = 'Coming soon · express interest';

/**
 * Badge copy is /marketing's (2026-08-07) and deliberately carries NO price and NO promo date — the
 * persona cards state availability and the absence of a payment barrier; the $29/$39 anchors and the
 * Founding Season end date live one click later where a promotion can be explained.
 * Ruling: BUSINESS_DECISIONS.md 2026-08-07.
 */
const PERSONAS: Persona[] = [
  {
    id: 'tournament',
    planKey: 'tournament',
    label: 'Tournament',
    question: 'Running a tournament?',
    body: 'From team registration to final standings — brackets, schedule, live scores, all in one place.',
    liveBadge: 'Free to start · no credit card',
    cta: "I'm a tournament organizer",
    href: '/for-tournament-organizers',
  },
  {
    id: 'league',
    planKey: 'league',
    label: 'League Plus',
    question: 'Managing a house league season?',
    body: 'Player registration, draft, schedule, standings, and parent notifications — from first signup to final game.',
    liveBadge: null,
    cta: 'I run a house league',
    href: '/for-leagues',
  },
  {
    id: 'club',
    planKey: 'club',
    label: 'Club',
    question: 'Running a club with rep teams?',
    body: 'Tournaments, house league, rep teams, and accounting in one place. Your executive team gets visibility. Coaches run their own teams.',
    liveBadge: null,
    cta: 'I run a club',
    href: '/for-clubs',
  },
  {
    id: 'coaches',
    planKey: 'team',
    label: 'Coaches Portal',
    question: 'Coaching a single team?',
    body: 'Roster, lineups, budget, and documents — a complete team workspace, whether or not your organization is on FieldLogicHQ.',
    liveBadge: 'Free to start · no credit card',
    cta: "I'm a coach",
    href: '/for-coaches',
  },
];

/**
 * `true` in the gating map means GATED, so availability is its negation — AND a card only presents
 * as live once someone has written what it says when it is (see the note above on `liveBadge`).
 */
function resolvePersonas(gating: PlanGatingMap) {
  return PERSONAS.map(p => {
    const isLive = !gating[p.planKey] && p.liveBadge !== null;
    return { ...p, isLive, badge: isLive ? p.liveBadge : GATED_BADGE };
  });
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  // Unified-app entry router (Phase 0). This page is BOTH the public marketing
  // homepage (browser visits — unchanged) AND the installed app's start_url.
  // The manifest launches the app at `/?source=pwa`, so only an app launch
  // carries that marker; organic/crawler traffic never does and always gets the
  // marketing page below (SEO/canonical/OG intact). On an app launch we route:
  // signed-in → their workspace (fail-closed via getAuthDestination), anonymous
  // → the public directory front door (browsing is free — no wall).
  const { source } = await searchParams;
  if (source === 'pwa') {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      redirect(await getAuthDestination());
    }
    redirect('/discover');
  }

  const gatingMap = await getPlanGatingMap();
  // The sandbox door. Hidden in a production build until the owner turns it on deliberately
  // (lib/sandbox-door.ts) — and note the demo orgs are seeded on dev only today, so this is a
  // local-only affordance until the "do the demos go public?" decision is made
  // (BUSINESS_DECISIONS.md 2026-08-07, logged as Proposed).
  const showSandboxDoor = sandboxDoorsVisible();
  // "Live products lead" (owner-ratified 2026-08-08, closing the question left open on 08-07):
  // live personas get full cards; not-yet-purchasable ones compress into one roadmap strip below.
  // The split is the same `isLive` the badges use, so a persona is promoted from strip to card by
  // the same single deliberate act that launches it — supplying its `liveBadge`.
  const personas = resolvePersonas(gatingMap);
  const livePersonas = personas.filter(p => p.isLive);
  const roadmapPersonas = personas.filter(p => !p.isLive);
  const teamOpen = !gatingMap.team;
  // The Founding Season surfaces are promo artifacts, not permanent chrome (/review 2026-08-08):
  // the hero badge row and the callout card render ONLY while the Tournament Plus promo runs, and
  // name BOTH products only while both promos run and the coach checkout is open. When the promo
  // ends they disappear on their own instead of asserting an expired date.
  const tpPromoActive = isFoundingSeasonPromoActive('tournament_plus');
  const bothPromosLive = teamOpen && tpPromoActive && isFoundingSeasonPromoActive('team');
  const liveModules = MODULE_CARDS.filter(m => !gatingMap[m.planKey] && m.liveBadge !== null);
  const roadmapModules = MODULE_CARDS.filter(m => gatingMap[m.planKey] || m.liveBadge === null);
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroGrid} />
        <div className="container">
          <div className={styles.heroHeader}>
            {tpPromoActive && (
              <div className="flex items-center gap-3 mb-8 justify-center flex-wrap">
                <span className="font-mono text-xs text-logic-lime uppercase tracking-widest font-bold">
                  Founding Season
                </span>
                <span className="font-mono text-xs text-data-gray/40">·</span>
                <span className="font-mono text-xs text-data-gray uppercase tracking-widest">
                  {bothPromosLive
                    ? 'Tournament Plus & Premium Coaches Portal free through Dec 31, 2026'
                    : 'Tournament Plus free through Dec 31, 2026'}
                </span>
                <span className="font-mono text-xs text-data-gray/40">·</span>
                <span className="font-mono text-xs text-data-gray uppercase tracking-widest">
                  No credit card required
                </span>
              </div>
            )}

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
              {livePersonas.map((p) => {
                const body = (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <span className="font-mono text-[10px] text-logic-lime uppercase tracking-widest font-bold">
                        {p.label}
                      </span>
                      {/* Defensive only — `resolvePersonas` guarantees a string either way. Absent
                          rather than empty, so a future path that does yield no badge leaves no
                          stray element in the flex row. */}
                      {p.badge && (
                        <span className={`font-mono text-[9px] uppercase tracking-widest text-right leading-relaxed ${p.isLive ? 'text-logic-lime' : 'text-data-gray/40'}`}>
                          {p.badge}
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-sm font-bold text-fl-text leading-snug">{p.question}</p>
                    <p className="font-mono text-xs text-data-gray/70 leading-relaxed flex-1">{p.body}</p>
                  </>
                );
                const ctaClass = `font-mono text-[10px] uppercase tracking-widest ${p.isLive ? 'text-logic-lime' : 'text-data-gray/50'}`;

                // The Tournament card carries a SECOND door in the sandbox era. Two links cannot
                // nest, so that one card becomes a div and the persona link stretches over it
                // (::after) to keep whole-card clickability. Every other card is untouched.
                if (showSandboxDoor && p.id === 'tournament') {
                  return (
                    <div key={p.id} className={`${styles.heroPersonaCard} ${styles.heroPersonaCardStack}`}>
                      {body}
                      <Link href={p.href} className={`${ctaClass} ${styles.heroPersonaStretch}`}>
                        {p.cta} →
                      </Link>
                      {/* ⚠ Tournament only, for now — NOT because it is the only live product (the
                          Coaches Portal has been live since 2026-07-24), but because the demo orgs
                          are seeded on dev only and putting them on production is an unmade
                          decision. The matching coaches door is designed and waiting on that call:
                          BUSINESS_DECISIONS.md 2026-08-07, status Proposed. */}
                      <Link href={SEE_IT_LIVE_PATH} className={`${ctaClass} ${styles.heroPersonaSecondary}`}>
                        <span className={styles.heroPersonaLiveDot} aria-hidden="true" />
                        See it live — no sign-up →
                      </Link>
                    </div>
                  );
                }

                return (
                  <Link key={p.id} href={p.href} className={styles.heroPersonaCard}>
                    {body}
                    <span className={ctaClass}>{p.cta} →</span>
                  </Link>
                );
              })}
            </div>

            {/* The roadmap strip — every not-yet-purchasable persona, at footnote weight. Its
                doors and interest capture survive; only the real estate shrinks. Data-driven from
                the same gate as the cards, so it empties itself as products launch. */}
            {roadmapPersonas.length > 0 && (
              <div className={styles.heroRoadmap}>
                <span className={styles.heroRoadmapLabel}>On the roadmap</span>
                {roadmapPersonas.map(p => (
                  <Link key={p.id} href={p.href} className={styles.heroRoadmapItem}>
                    <span className={styles.heroRoadmapQ}>{p.question}</span>
                    <span className={styles.heroRoadmapCta}>{p.cta} →</span>
                  </Link>
                ))}
              </div>
            )}
          </AnimateIn>

          <div className={styles.heroFooterNote}>
            <span className="font-mono text-xs text-data-gray/50 uppercase tracking-widest">
              Already know what you need?
            </span>
            <Link
              href="/start"
              className="font-mono text-xs uppercase tracking-widest text-logic-lime hover:text-fl-text transition-colors"
            >
              Start free →
            </Link>
            <Link
              href="/start"
              className="font-mono text-xs uppercase tracking-widest text-data-gray/60 hover:text-fl-text transition-colors"
            >
              Not sure? See your options →
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
                {teamOpen
                  ? 'Tournament organizers and coaches can start today — free, no credit card required. League Plus and Club are in active development.'
                  : 'Tournament organizers can start today — free, no credit card required. League Plus, Club, and Coaches Portal are in active development.'}
              </p>
            </div>
          </AnimateIn>
          <AnimateIn>
            <div className="flex flex-col gap-4">
              {/* Live roles: the full deep-dive. */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {liveModules.map((mod) => (
                  <div key={mod.id} className="border border-blueprint-blue/30 p-8 flex flex-col gap-5 hover:border-blueprint-blue/60 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="font-mono text-[10px] text-data-gray/40 uppercase tracking-widest">{mod.id}</span>
                        <h3 className="font-mono text-sm font-bold text-fl-text uppercase tracking-wide mt-0.5">{mod.name}</h3>
                      </div>
                      <span className="font-mono text-[10px] text-logic-lime uppercase tracking-widest text-right leading-relaxed">{mod.planLabel} · {mod.liveBadge}</span>
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
              {/* In-development roles: one confident sentence each — discoverable, not a peer.
                  The full pitch lives on each role's own page, one click away. */}
              {roadmapModules.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {roadmapModules.map((mod) => (
                    <Link
                      key={mod.id}
                      href={mod.href}
                      className="border border-blueprint-blue/20 px-6 py-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 hover:border-blueprint-blue/50 transition-colors"
                    >
                      <span className="font-mono text-xs font-bold text-data-gray uppercase tracking-wide">{mod.name}</span>
                      <span className="font-mono text-[10px] text-data-gray/40 uppercase tracking-widest">{mod.planLabel} · In development</span>
                      <span className="font-mono text-xs text-data-gray/70 leading-relaxed w-full">
                        {mod.stripLine}{' '}
                        <span className="text-data-gray/50 uppercase text-[10px] tracking-widest">Learn more →</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
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
                {teamOpen
                  ? 'Tournament, Tournament Plus, and the Premium Coaches Portal are available now. League Plus and Club are open for early-access interest while those workflows are refined.'
                  : 'Tournament and Tournament Plus are available now. League Plus and Club are open for early-access interest while those workflows are refined.'}
              </p>
            </div>
          </AnimateIn>

          {/* Founding Season callout — a promo artifact that renders only while the promo runs,
              and speaks for BOTH promos while both are running (Tournament Plus-only otherwise). */}
          {tpPromoActive && (
            <div className="mb-6 border border-logic-lime/40 p-6 flex flex-col gap-4" style={{ background: 'rgba(var(--logic-lime-rgb, 163 230 53) / 0.04)' }}>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-[0.6rem] font-bold uppercase tracking-widest text-logic-lime">
                  Founding Season
                </span>
                <span className="font-mono text-[0.6rem] text-data-gray/40">·</span>
                <span className="font-mono text-[0.6rem] uppercase tracking-widest text-data-gray/70">
                  Free through December 31, 2026
                </span>
              </div>
              <p className="font-mono text-sm font-bold text-fl-text leading-snug">
                {bothPromosLive
                  ? `Tournament Plus (${formatPriceAmount(PLAN_CONFIG.tournament_plus.monthlyPrice)}/month) and the Premium Coaches Portal (${formatPriceAmount(PLAN_CONFIG.team.monthlyPrice)}/month) are free for organizations and coaches that sign up before the end of 2026.`
                  : `Tournament Plus (${formatPriceAmount(PLAN_CONFIG.tournament_plus.monthlyPrice)}/month) is free for organizations that sign up before the end of 2026.`}
              </p>
              <p className="font-mono text-xs text-data-gray/70 leading-relaxed">
                We&apos;re in our founding season — we want real tournaments and real teams on the
                platform, not demos. Sign up today and run your season at no cost through December 31.
              </p>
              <div className="flex items-center gap-6 flex-wrap">
                <Link
                  href="/start"
                  className="font-mono text-xs font-bold uppercase tracking-widest text-logic-lime hover:text-fl-text transition-colors"
                >
                  Start your organization →
                </Link>
                {teamOpen && (
                  <Link
                    href="/coaches/start?source=home"
                    className="font-mono text-xs font-bold uppercase tracking-widest text-logic-lime hover:text-fl-text transition-colors"
                  >
                    Start your coaches portal →
                  </Link>
                )}
              </div>
            </div>
          )}

          <PricingSection gatingMap={gatingMap} marketingLayout />

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
              href="/start"
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
