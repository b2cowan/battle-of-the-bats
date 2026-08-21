import Link from 'next/link';
import type { Metadata } from 'next';
import EarlyAccessModalTrigger from '@/components/EarlyAccessModalTrigger';
import { PLAN_ARTICLE_CONTENT } from '@/lib/plan-article-content';
import { PLAN_CONFIG, formatPriceAmount } from '@/lib/plan-config';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import { SEE_IT_LIVE_PATH, sandboxDoorsVisible } from '@/lib/sandbox-door';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'For Tournament Organizers — FieldLogicHQ',
  description:
    'From first team registration to final standings — without the spreadsheets. Brackets, live scoring, scheduling, and registration all in one place. Free to start, no credit card required.',
  alternates: { canonical: '/for-tournament-organizers' },
};

const { painItems: PAIN_ITEMS, steps: STEPS, features: PLUS_FEATURES } =
  PLAN_ARTICLE_CONTENT.tournament_plus;

const FREE_FEATURES = [
  '1 active tournament',
  'Manual scheduling across fields and time slots',
  'Standard team registration with waitlist collection',
  'Single and double-elimination brackets',
  'Score entry and live standings',
  'Venue management',
  // Officials moved here from the paid list 2026-08-20: they have never counted against a seat
  // cap on any plan, so claiming them as an upgrade benefit both overstated the paid tier and
  // wasted a genuine free-tier selling point.
  '3 staff / admin seats — officials and scorekeepers are free and unlimited',
];

const CROSS_SELLS: Array<{
  label: string;
  q: string;
  body: string;
  cta: string;
  /** When set AND the product's gate is open, the card links here instead of opening the
   *  express-interest modal. Absent = the product has no live state to advertise yet. */
  liveHref?: string;
  liveCta?: string;
  /** Unconditional navigation — the destination page is worth visiting regardless of any gate
   *  (Club's page carries the two demo doors). Wins over the modal always. */
  alwaysHref?: string;
  initialPlanInterest: string[];
  initialFeaturesInterested: string[];
}> = [
  {
    label: 'League Plus',
    q: 'Also running a house league season?',
    body: 'Player registration, draft tools, schedules, standings, and automated parent notifications — all in one dashboard.',
    cta: 'Express interest in League Plus',
    initialPlanInterest: ['league'],
    initialFeaturesInterested: ['house_league', 'registration', 'public_site'],
  },
  {
    label: 'Club',
    q: 'Running a full club with rep teams?',
    body: 'Club adds rep teams, accounting, and coaching staff management to the full tournament and house league toolkit.',
    cta: 'See what Club includes',
    // 2026-08-10 reroute: to the Club page, not straight to the interest form — that page now
    // carries both demo doors, and the form waits there. (League Plus above stays form-first on
    // purpose: its page has no demo to show yet.)
    alwaysHref: '/for-clubs',
    initialPlanInterest: ['club'],
    initialFeaturesInterested: ['accounting', 'rep_teams', 'coach_portal'],
  },
  {
    label: 'Coaches Portal',
    q: 'Coaching a single competitive team?',
    body: 'A standalone workspace for one rep team — roster, lineups, budget, and schedule. No org account needed.',
    cta: 'Express interest',
    // Live when the coach checkout gate is open — the card becomes a link to /for-coaches with a
    // live CTA instead of an express-interest trigger. Same flip /for-coaches itself performs;
    // this card held a hardcoded express-interest for a live product until 2026-08-08.
    liveHref: '/for-coaches',
    liveCta: 'Start free',
    initialPlanInterest: ['coaches_portal'],
    initialFeaturesInterested: ['roster', 'lineups', 'budget', 'team_documents'],
  },
];

export default async function ForTournamentOrganizersPage() {
  // The sandbox door. Hidden in a production build until the owner turns it on deliberately —
  // see lib/sandbox-door.ts for why that release step is a decision and not a merge.
  const showSandboxDoor = sandboxDoorsVisible();
  const teamCheckoutOpen = !(await getPlanGatingMap()).team;
  return (
    <main className="bg-pitch-black min-h-screen">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className="container">
          <p className={styles.heroEyebrow}>For tournament organizers</p>
          <h1 className={styles.heroTitle}>
            From first registration<br />
            <span className={styles.heroAccent}>to final standings.</span>
          </h1>
          <p className={styles.heroSub}>
            Register teams, build your schedule, run the bracket, and post live scores — all in one place.
            Free to start, no credit card required.
          </p>
          <div className={styles.heroActions}>
            {/* "Start free", matching /for-coaches word for word (owner-directed 2026-08-07): the
                two persona pages are one product and were reading as two. The credit-card objection
                is NOT lost — the sub-line directly above answers it, and the trust list below says
                it a third time, which is where it belongs. */}
            <Link
              href="/auth/signup"
              className="font-mono text-xs font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors"
            >
              Start free
            </Link>
            {/* Second position, deliberately: lime OUTLINE with a live dot, so it reads as a live
                thing without out-shouting the solid-lime primary. The sandbox is the proof;
                signup is still the ask. */}
            {showSandboxDoor && (
              <Link href={SEE_IT_LIVE_PATH} className={styles.seeItLive}>
                <span className={styles.seeItLiveDot} aria-hidden="true" />
                See it live →
              </Link>
            )}
            <Link
              href="/pricing"
              className="font-mono text-xs uppercase tracking-widest text-data-gray border border-blueprint-blue/40 px-8 py-4 hover:border-blueprint-blue hover:text-fl-text transition-colors"
            >
              See all plans →
            </Link>
          </div>
          {/* The objection this answers — "is this another form?" — is the whole reason the door
              converts. It is also literally true: no email, no form, no lead capture, ever. */}
          {showSandboxDoor && (
            <p className={styles.seeItLiveNote}>No sign-up, no email. Walk into a tournament that&apos;s running right now.</p>
          )}
          <div className={styles.trustRow}>
            {['Free plan — no time limit', 'No credit card required', 'Billed in CAD'].map(s => (
              <div key={s} className={styles.trustItem}>
                <span className={styles.trustDot} />
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pain recognition ─────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className="container">
          <p className={styles.sectionEyebrow}>The old way</p>
          <h2 className={styles.sectionTitle}>If this is your tournament setup, we know the drill.</h2>
          <div className={styles.painGrid}>
            {PAIN_ITEMS.map(item => (
              <div key={item.title} className={styles.painCard}>
                <p className={styles.painCardTitle}>{item.title}</p>
                <p className={styles.painCardBody}>{item.body}</p>
              </div>
            ))}
          </div>
          {/* The pre-sales walkthrough (PRESALES_WALKTHROUGH_PLAN.md): the reader who just
              recognized themselves in these cards gets the visual version — 90 seconds of screens
              and diagrams — before the page moves on to features. Text-weight on purpose;
              signup stays the ask, this is deeper proof. */}
          <Link href="/for-tournament-organizers/walkthrough" className={styles.walkthroughLink}>
            See them fixed — the 90-second walkthrough →
          </Link>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className="container">
          <p className={styles.sectionEyebrow}>How it works</p>
          <h2 className={styles.sectionTitle}>Four phases. One platform.</h2>
          <p className={styles.sectionSub}>
            From the moment teams register to the final standings post — everything runs here.
          </p>
          <div className={styles.stepsGrid}>
            {STEPS.map(step => (
              <div key={step.num} className={styles.stepCard}>
                <span className={styles.stepNum}>{step.num}</span>
                <p className={styles.stepLabel}>{step.label}</p>
                <p className={styles.stepTitle}>{step.title}</p>
                <p className={styles.stepBody}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Plan comparison ──────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className="container">
          <p className={styles.sectionEyebrow}>Choose your plan</p>
          <h2 className={styles.sectionTitle}>Start free. Add more when you need it.</h2>
          <p className={styles.sectionSub}>
            Both plans are built for tournament organizers. Tournament covers your first event.
            Tournament Plus is for repeat organizers who need more control.
          </p>
          <div className={styles.planGrid}>

            {/* ── Tournament (free) ──────────────────────────────────────── */}
            <div className={styles.planCard}>
              <div>
                <p className={styles.planName}>Tournament</p>
                <div className={styles.planPrice}>
                  <span className={styles.planAmount}>Free</span>
                </div>
                <p className={styles.planNote}>No credit card. No time limit.</p>
              </div>
              <p className={styles.planTagline}>
                Everything you need to run your first tournament — registration, scheduling, brackets, and live results.
              </p>
              <div className={styles.planFeatures}>
                <p className={styles.planFeatureLabel}>Included</p>
                {FREE_FEATURES.map(f => (
                  <div key={f} className={styles.planFeatureItem}>
                    <span className={styles.planFeatureBullet}>—</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/auth/signup" className={`${styles.planCta} ${styles.planCtaFree}`}>
                Start free →
              </Link>
            </div>

            {/* ── Tournament Plus ────────────────────────────────────────── */}
            <div className={`${styles.planCard} ${styles.planCardFeatured}`}>
              <div>
                <p className={styles.planName}>Tournament Plus</p>
                <div className={styles.planPrice}>
                  <span className={styles.planAmount}>{formatPriceAmount(PLAN_CONFIG.tournament_plus.monthlyPrice)}</span>
                  <span className={styles.planPeriod}>/month</span>
                </div>
                <p className={styles.planNote}>Free through Dec 31, 2026 — Founding Season · {formatPriceAmount(PLAN_CONFIG.tournament_plus.annualPrice)}/year from Jan 2027</p>
              </div>
              <p className={styles.planTagline}>
                For organizers running more than one event a year, or who need custom registration, exports, and archives.
              </p>
              <div className={styles.planFeatures}>
                <p className={styles.planFeatureLabel}>Everything in Tournament, plus</p>
                {PLUS_FEATURES.map(f => (
                  <div key={f} className={styles.planFeatureItem}>
                    <span className={styles.planFeatureBullet}>—</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              {/* Same relabel as the hero, and for the same reason — a page whose hero says
                  "Start free" and whose plan card says something longer reads as two hands. This
                  matches the Premium Coaches Portal card's "Start free →" exactly. */}
              <Link href="/auth/signup" className={`${styles.planCta} ${styles.planCtaPaid}`}>
                Start free →
              </Link>
            </div>

          </div>
          <p className={styles.planNote2}>
            Not sure which plan? Start free — you can upgrade at any time.{' '}
            <Link href="/pricing#compare" className="tap-target text-logic-lime hover:opacity-75 transition-opacity">
              Compare all features →
            </Link>
          </p>
        </div>
      </section>

      {/* ── Founding Season ──────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className="container">
          <div className={styles.foundingSeasonCard}>
            <div className={styles.foundingSeasonEyebrow}>Running your first tournament this year?</div>
            <h2 className={styles.foundingSeasonTitle}>
              Tournament Plus is free for founding organizations through December 31, 2026.
            </h2>
            <p className={styles.foundingSeasonBody}>
              Auto-scheduling, brackets, communications, and archives — at no cost while we build
              our first season together. Normally {formatPriceAmount(PLAN_CONFIG.tournament_plus.monthlyPrice)}/month. No credit card required.
            </p>
            <div className={styles.foundingSeasonActions}>
              <Link
                href="/auth/signup"
                className="font-mono text-xs font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors"
              >
                Start free — no credit card required
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Cross-sell ───────────────────────────────────────────────────── */}
      <section className={styles.crossSellSection}>
        <div className="container">
          <p className={styles.crossSellEyebrow}>More from FieldLogicHQ</p>
          <div className={styles.crossSellGrid}>
            {CROSS_SELLS.map(cs => {
              // Only the Coaches Portal card carries liveHref today, so the team gate is the
              // right check; a future live cross-sell must key off its own plan's gate.
              const isLive = !!cs.liveHref && teamCheckoutOpen;
              const linkHref = cs.alwaysHref ?? (isLive ? cs.liveHref : undefined);
              const content = (
                <>
                  <span className={styles.crossSellLabel}>{cs.label}</span>
                  <span className={styles.crossSellQ}>{cs.q}</span>
                  <span className={styles.crossSellBody}>{cs.body}</span>
                  <span className={styles.crossSellCta}>{(isLive ? cs.liveCta : undefined) ?? cs.cta} →</span>
                </>
              );
              if (linkHref) {
                return (
                  <Link key={cs.label} href={linkHref} className={styles.crossSellCard}>
                    {content}
                  </Link>
                );
              }
              return (
                <EarlyAccessModalTrigger
                  key={cs.label}
                  className={styles.crossSellCard}
                  initialPlanInterest={cs.initialPlanInterest}
                  initialFeaturesInterested={cs.initialFeaturesInterested}
                >
                  {content}
                </EarlyAccessModalTrigger>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaBg} />
        <div className="container">
          <h2 className={styles.ctaTitle}>
            Your next tournament{' '}
            <span className={styles.ctaAccent}>starts here.</span>
          </h2>
          <p className={styles.ctaSub}>
            Free to start. No credit card required. Tournament Plus is free through December 31, 2026 for founding organizations.
          </p>
          <div className={styles.ctaActions}>
            <Link
              href="/auth/signup"
              className="tap-target font-mono text-sm font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors"
            >
              Get Started Free
            </Link>
            {/* The reader who finished the whole pitch and still isn't ready gets one more exit
                that isn't "leave" (2026-08-10 door placements). */}
            {showSandboxDoor && (
              <Link href={SEE_IT_LIVE_PATH} className={styles.seeItLive}>
                <span className={styles.seeItLiveDot} aria-hidden="true" />
                See it live →
              </Link>
            )}
            <Link
              href="/pricing"
              className="font-mono text-sm uppercase tracking-widest text-data-gray border border-blueprint-blue/40 px-8 py-4 hover:border-blueprint-blue hover:text-fl-text transition-colors"
            >
              View pricing →
            </Link>
          </div>
          <p className={styles.ctaFootnote}>All plans are billed in CAD. No contracts. No setup fees.</p>
        </div>
      </section>

    </main>
  );
}
