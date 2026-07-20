import Link from 'next/link';
import PricingSection from '@/components/PricingSection';
import EarlyAccessModalTrigger from '@/components/EarlyAccessModalTrigger';
import ComparisonTable from './ComparisonTable';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import { PLAN_CONFIG, formatPriceAmount, isFoundingSeasonPromoActive } from '@/lib/plan-config';
import styles from './page.module.css';

export const metadata = {
  title: 'Pricing — FieldLogicHQ',
  description: 'Simple, honest pricing for every role in your organization — from running one tournament to managing a full club. Tournament and Tournament Plus are available now. League Plus, Club, and the Coaches Portal are coming soon.',
};

const TRUST_SIGNALS = [
  'Billed in CAD — no conversion surprises',
  'No contracts — cancel anytime',
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
    body: 'From first team registration to final standings — free to start, no spreadsheets required.',
    href: '#org-plans',
    cta: 'See tournament plans',
  },
  {
    eyebrow: 'House league administrator',
    title: 'I run a house league season.',
    body: 'Player registration, draft, scheduling, standings, and automated parent notifications — from opening day to final game, in one dashboard.',
    cta: 'Express interest in League Plus',
    earlyAccess: true,
    initialPlanInterest: ['league'],
    initialFeaturesInterested: ['house_league', 'registration', 'public_site'],
  },
  {
    eyebrow: 'Club executive',
    title: 'I run a club with rep teams.',
    body: 'Tournaments, house league, rep teams, and accounting in one place. Coaches manage their teams; you get the visibility without the constant check-ins.',
    cta: 'Express interest in Club',
    earlyAccess: true,
    initialPlanInterest: ['club'],
    initialFeaturesInterested: ['accounting', 'rep_teams', 'coach_portal'],
  },
  {
    eyebrow: 'Coach or team manager',
    title: 'I manage one competitive team.',
    body: 'A full Coaches Portal for one rep team — roster, lineups, budget, and schedule — without needing a full org account. Available soon; express interest now.',
    cta: 'Express interest',
    earlyAccess: true,
    initialPlanInterest: ['coaches_portal'],
    initialFeaturesInterested: ['roster', 'lineups', 'budget', 'team_documents'],
  },
];


/* Comparison categories are defined in ComparisonTable.tsx */

const UPGRADE_BRIDGES = [
  {
    headline: 'Running more than one tournament a year?',
    body: 'Tournament Plus removes the single-event limit and adds the tools that make repeat events sustainable: unlimited tournaments, automated scheduling, custom registration fields, file uploads, full export suite, payment reminders, waitlist promotion, and post-event archives. Unlimited staff seats and unlimited officials included.',
    from: 'Tournament',
    to: 'Tournament Plus',
    label: 'Tournament → Tournament Plus',
    cta: 'Start Free — No Credit Card',
    href: '/auth/signup',
    earlyAccess: false,
  },
  {
    headline: 'Running a full house league season?',
    body: 'League Plus is the complete house league platform — player registration, draft, season scheduling, standings, and automated parent notifications in one dashboard. No tournament plan required — League Plus is its own entry point for house league organizations. Available soon — express interest to be notified when it opens.',
    from: null,
    to: null,
    label: 'House league administrators',
    cta: 'Express interest in League Plus',
    earlyAccess: true,
    initialPlanInterest: ['league'],
    initialFeaturesInterested: ['house_league', 'registration', 'public_site'],
  },
  {
    headline: 'Running a club with rep teams, house league, and tournaments?',
    body: 'Club is the complete platform — tournaments, house league, rep teams, and accounting in one place. The Premium Coaches Portal is included for your whole coaching staff — every team, no per-team fee — priced by club size (up to 15 teams, or up to 30 on Club · Association). Start directly on Club — you don\'t need to have been on League Plus first. Available soon — express interest to be notified when it opens.',
    from: null,
    to: null,
    label: 'Club executives',
    cta: 'Express interest in Club',
    earlyAccess: true,
    initialPlanInterest: ['club'],
    initialFeaturesInterested: ['accounting', 'rep_teams', 'coach_portal'],
  },
];

const FAQS = [
  {
    q: 'Is this too complex for a volunteer-run organization?',
    a: `No — and we built it with volunteer-run orgs specifically in mind. FieldLogicHQ is used by associations where the "tech person" is whoever stepped up at the last AGM. The platform is designed around tasks your team already does — scheduling, communications, score entry, registration — just without the spreadsheets and email chains. You don't need to configure anything complicated to get started. Most organizations are running their first tournament within an afternoon of signing up.`,
    featured: true,
  },
  {
    q: 'Is the platform only for tournaments?',
    a: 'No. Tournament and Tournament Plus are the live self-serve plans today, and the Coaches Portal is coming for coaches managing a single rep team. League Plus and Club — covering house league seasons, rep team management, and accounting — are the next parts of the platform. They\'re shown here so your organization can plan ahead.',
  },
  {
    q: 'What if I only manage one competitive team?',
    a: 'Use the Coaches Portal. It\'s a standalone workspace for one rep team — roster, schedule, budget, documents, attendance, and lineups. No org account needed. If your organization joins FieldLogicHQ later, your workspace carries over automatically. The Coaches Portal is coming soon — express interest to be notified.',
  },
  {
    q: 'Can I buy League Plus, Club, or the Coaches Portal today?',
    a: 'Not through self-serve checkout yet. Tournament and Tournament Plus are available now. League Plus, Club, and the Coaches Portal are shown as coming-soon previews so organizations and coaches can plan ahead and express interest while those workflows are finished.',
  },
  {
    q: 'How does billing work?',
    a: 'Tournament Plus is billed monthly or annually in Canadian dollars. Monthly billing renews automatically each month. Annual billing is charged once per year — you pay for 10 months and get 12, which works out to roughly two months free. No contracts, no penalties.',
  },
  {
    q: 'What happens after the Founding Season offer ends?',
    a: 'Tournament Plus is free through December 31, 2026 for organizations that sign up during the founding season — no credit card required. Starting January 2027, the standard rate of $39/month applies. We\'ll send a reminder before the offer closes. Your data and settings stay in place regardless of what you choose at renewal.',
  },
  {
    q: 'Can I change plans later?',
    a: 'Yes, at any time. If you upgrade mid-month, the new features are available immediately and billing adjusts pro-rata. If you downgrade, the change takes effect at your next billing date. There\'s no lock-in. Organizations often start on Tournament, try the platform, and upgrade as their needs grow — that\'s exactly how the plans are designed.',
  },
  {
    q: 'Do I need a credit card to get started?',
    a: 'No. Tournament is free — no credit card, no time limit. During the Founding Season (through December 31, 2026), Tournament Plus is also free with no payment details required. Starting January 2027, paid plans use secure Stripe Checkout.',
  },
  {
    q: 'What if we get stuck?',
    a: 'Every workflow is documented in plain language — written for the person who stepped up to run the org, not a developer. Most organizations are running their first tournament within an afternoon of signing up. If something\'s unclear, documentation is the first stop. If that doesn\'t cover it, you can reach us directly.',
  },
  {
    q: 'Can I use FieldLogicHQ for multiple sports?',
    a: 'Yes. The platform is sport-agnostic — used by softball associations, hockey organizations, soccer leagues, and baseball clubs. Field naming, team structures, scoring, and season setup all work across sports. If you run multiple associations, each one is managed as its own organization.',
  },
  {
    q: 'Is there a limit on how many staff accounts I can have?',
    a: 'Not on any paid plan. Tournament Plus, League Plus, and Club all include unlimited staff seats — add as many admins, schedulers, and scorekeepers as you need. The free Tournament tier includes 3 staff seats as a soft limit, but officials and scorekeepers don\'t count against it — bring as many as your event needs. Paid plans have no staff seat limit at all.',
  },
  {
    q: 'Is there a setup fee or onboarding cost?',
    a: 'No. There are no setup fees, implementation costs, or onboarding charges. You sign up, create your organization, and start using the live tournament tools. Documentation covers every available setup step.',
  },
];

export default async function PricingPage() {
  const gatingMap = await getPlanGatingMap();
  const teamCheckoutOpen = !gatingMap.team;
  const teamPromoActive = isFoundingSeasonPromoActive('team');

  return (
    <main>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className="container">
          <p className="font-mono text-xs uppercase tracking-widest text-blueprint-blue mb-4">Pricing</p>
          <h1 className={styles.heroTitle}>
            Plans built around how<br />
            you actually operate.
          </h1>
          <p className={styles.heroSub}>
            Tournament and Tournament Plus are live — start free, no credit card required.
            League Plus, Club, and the Coaches Portal are open for interest while we finish those workflows.
          </p>
          <div className={styles.trustRow}>
            {TRUST_SIGNALS.map(s => (
              <div key={s} className={styles.trustItem}>
                <span className={styles.trustDot} />
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Segment picker ───────────────────────────────────────────────── */}
      <section className={styles.segmentSection} aria-labelledby="pricing-segments-title">
        <div className="container">
          <div className={styles.sectionIntro}>
            <p className={styles.sectionEyebrow}>Find your plan</p>
            <h2 id="pricing-segments-title" className={styles.sectionTitle}>What does your role look like?</h2>
            <p className={styles.sectionSub}>
              Not every plan is for every organization. Pick the role that fits — you&apos;ll land in the right place.
            </p>
          </div>
          <div className={styles.segmentGrid}>
            {BUYER_SEGMENTS.map(segment => {
              const cardClass = `${styles.segmentCard} ${segment.featured ? styles.segmentCardFeatured : ''}`;
              const cardContent = (
                <>
                  <span className={styles.segmentEyebrow}>{segment.eyebrow}</span>
                  <span className={styles.segmentTitle}>{segment.title}</span>
                  <span className={styles.segmentBody}>{segment.body}</span>
                  <span className={styles.segmentCta}>{segment.cta} →</span>
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
      <section className={styles.plansSection} id="org-plans">
        <div className="container">
          <div className={styles.sectionIntro}>
            <p className={styles.sectionEyebrow}>For organizations</p>
            <h2 className={styles.sectionTitle}>Tournament, League Plus, and Club plans</h2>
            <p className={styles.sectionSub}>
              Use these plans when you manage events or organization-wide operations.
            </p>
          </div>
          <PricingSection gatingMap={gatingMap} />

          {/* Founding Season note */}
          <p className={`${styles.sectionSub} mt-3 text-center`} style={{ fontSize: '0.78rem' }}>
            Tournament Plus is free through December 31, 2026 for founding organizations.
            Starting January 2027, the standard {formatPriceAmount(PLAN_CONFIG.tournament_plus.monthlyPrice)}/month rate applies.
            No contract. Cancel anytime.
          </p>

          {/* Premium Coaches Portal — compact callout below plan grid. Flips with the checkout gate:
              live "Start free" + Founding Season promo when open, "Coming soon" + express-interest when gated. */}
          <div className={styles.coachesCallout} id="coaches-portal">
            <div className={styles.coachesCalloutInner}>
              <span className={styles.coachesCalloutLabel}>Premium Coaches Portal</span>
              {teamCheckoutOpen && teamPromoActive ? (
                <>
                  <span className={styles.coachesCalloutPrice}>Free <span style={{ fontWeight: 400, fontSize: '0.72rem' }}>until Jan 1, 2027</span></span>
                  <span className={styles.coachesCalloutPriceSub}>then {formatPriceAmount(PLAN_CONFIG.team.monthlyPrice)}/mo — no credit card required</span>
                  <span className={styles.coachesCalloutBody}>
                    A standalone workspace for one rep team — roster, lineups, budget, and schedule. No org account needed. When your org joins Club, your workspace carries over automatically.
                  </span>
                </>
              ) : (
                <>
                  <span className={styles.coachesCalloutPrice}>{formatPriceAmount(PLAN_CONFIG.team.monthlyPrice)} CAD <span style={{ fontWeight: 400, fontSize: '0.72rem' }}>/mo</span></span>
                  <span className={styles.coachesCalloutPriceSub}>or {formatPriceAmount(PLAN_CONFIG.team.annualPrice)}/season — save two months</span>
                  <span className={styles.coachesCalloutBody}>
                    A standalone workspace for one rep team — roster, lineups, budget, and schedule. No org account needed. When your org joins Club, your workspace carries over automatically. Coming soon.
                  </span>
                </>
              )}
            </div>
            {teamCheckoutOpen ? (
              <Link href="/coaches/start?source=pricing" className={styles.coachesCalloutCta}>
                {teamPromoActive ? 'Start free →' : 'Start now →'}
              </Link>
            ) : (
              <EarlyAccessModalTrigger
                className={styles.coachesCalloutCta}
                initialPlanInterest={['coaches_portal']}
                initialFeaturesInterested={['roster', 'lineups', 'budget', 'team_documents']}
              >
                Express interest →
              </EarlyAccessModalTrigger>
            )}
          </div>
        </div>
      </section>

      {/* ── Comparison table ─────────────────────────────────────────────── */}
      <section className={styles.tableSection} id="compare">
        <div className="container">
          <h2 className={styles.sectionTitle}>Compare all plans</h2>
          <p className={styles.sectionSub}>
            Tournament and Tournament Plus are available now. League Plus and Club are open for early interest.
          </p>
          <ComparisonTable />
          <p className="font-mono text-xs text-data-gray/50 mt-4 text-center">
            League Plus and Club are available for early interest — express interest to be notified when self-serve checkout opens. Coaches Portal is also available standalone for coaches managing one team — see below.
          </p>
        </div>
      </section>

      {/* ── Upgrade bridges ──────────────────────────────────────────────── */}
      <section className={styles.bridgeSection}>
        <div className="container">
          <div className={styles.bridgeGrid}>
            {UPGRADE_BRIDGES.map(b => (
              <div key={b.label} className={styles.bridgeCard}>
                <div className={styles.bridgeLabel}>
                  {b.label}
                </div>
                <h3 className={styles.bridgeHeadline}>{b.headline}</h3>
                <p className={styles.bridgeBody}>{b.body}</p>
                {b.earlyAccess ? (
                  <EarlyAccessModalTrigger
                    className={styles.bridgeCta}
                    initialPlanInterest={b.initialPlanInterest}
                    initialFeaturesInterested={b.initialFeaturesInterested}
                  >
                    {b.cta} →
                  </EarlyAccessModalTrigger>
                ) : (
                  <Link href={b.href ?? '/auth/signup'} className={styles.bridgeCta}>
                    {b.cta} →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Coming soon deep-dive ────────────────────────────────────────── */}
      <section className={styles.clubSection} id="early-access">
        <div className="container">
          <div className={styles.clubInner}>
            <div className={styles.clubText}>
              <p className="font-mono text-xs uppercase tracking-widest text-logic-lime mb-3">Coming Soon</p>
              <h2 className={styles.clubTitle}>League Plus and Club — what&apos;s coming next</h2>
              <p className={styles.clubSub}>We&apos;re finishing the workflows before opening self-serve checkout. Here&apos;s what they cover.</p>
              <p className={styles.clubBody}>
                Tournament and Tournament Plus are the live plans available today. League Plus and Club are shown
                here so organizations can understand the full platform direction before committing their
                tournament workflow to us.
              </p>
              <p className={styles.clubBody}>
                League Plus is focused on house league registration, divisions, seasons, public organization
                pages, and registrar workflows. Club adds rep teams and accounting — plus a Premium Coaches
                Portal for your whole coaching staff, every team included with no per-team fee — for
                organizations that need the complete operating system.
              </p>
              <p className={styles.clubBody}>
                If you want either tier, start on a live tournament plan now or express interest below.
                That keeps the launch honest while giving interested clubs a path into the roadmap.
              </p>
              <EarlyAccessModalTrigger
                className="inline-flex font-mono text-xs uppercase tracking-widest font-bold bg-logic-lime text-pitch-black px-6 py-3 hover:bg-white transition-colors border-0 cursor-pointer"
                initialPlanInterest={['league', 'club']}
                initialFeaturesInterested={['house_league', 'registration', 'accounting', 'rep_teams']}
              >
                Express interest →
              </EarlyAccessModalTrigger>
            </div>
            <div className={styles.clubStats}>
              {[
                {
                  label: 'Available now',
                  body: 'Tournament is free — no credit card, no time limit. Tournament Plus adds registration control, schedule automation, brackets, archives, branding, and reporting.',
                },
                {
                  label: 'Coming next',
                  body: 'League Plus, Club, and the Coaches Portal workflows are being finished before self-serve checkout opens.',
                },
                {
                  label: 'Express interest',
                  body: 'Share your details and plan priorities. We\'ll notify you when self-serve checkout opens — no commitment required.',
                },
              ].map(s => (
                <div key={s.label} className={styles.clubStat}>
                  <p className={styles.clubStatLabel}>{s.label}</p>
                  <p className={styles.clubStatBody}>{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className={styles.faqSection}>
        <div className="container">
          <h2 className={styles.sectionTitle}>Common questions — answered plainly.</h2>
          <p className={styles.sectionSub}>
            No jargon. No sales pitch. Just what you need to know before signing up.
          </p>

          <div className={styles.faqList}>
            {FAQS.map(faq => (
              <details key={faq.q} className={`${styles.faqItem} ${faq.featured ? styles.faqFeatured : ''}`}>
                <summary className={styles.faqQuestion}>
                  {faq.featured && <span className={styles.faqBadge}>Volunteer orgs</span>}
                  {faq.q}
                </summary>
                <p className={styles.faqAnswer}>{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaBg} />
        <div className="container">
          <h2 className={styles.ctaTitle}>
            Less admin.{' '}
            <span style={{ color: 'var(--logic-lime)' }}>More sport.</span>
          </h2>
          <p className={styles.ctaSub}>
            Start free with Tournament. Tournament Plus is free through December 31, 2026 — no credit card required.
            League Plus, Club, and the Coaches Portal are coming soon — express interest to be notified.
          </p>
          <div className={styles.ctaActions}>
            <Link
              href="/auth/signup"
              className="font-mono text-sm font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors"
            >
              Get Started Free
            </Link>
            <EarlyAccessModalTrigger
              className="font-mono text-sm uppercase tracking-widest text-data-gray border border-blueprint-blue/40 bg-transparent px-8 py-4 hover:border-blueprint-blue hover:text-fl-text transition-colors cursor-pointer"
              initialPlanInterest={['league', 'club']}
              initialFeaturesInterested={['house_league', 'registration', 'accounting', 'rep_teams']}
            >
              Express interest →
            </EarlyAccessModalTrigger>
          </div>
          <p className={styles.ctaFootnote}>All plans are billed in CAD. No contracts. No setup fees.</p>
        </div>
      </section>

    </main>
  );
}
