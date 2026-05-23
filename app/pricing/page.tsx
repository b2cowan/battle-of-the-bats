import { Fragment } from 'react';
import Link from 'next/link';
import PricingSection from '@/components/PricingSection';
import EarlyAccessModalTrigger from '@/components/EarlyAccessModalTrigger';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import styles from './page.module.css';

export const metadata = {
  title: 'Pricing — FieldLogicHQ',
  description: 'Simple, honest pricing for Canadian sports organizations. Tournament, Team, and Tournament Plus are available now; League and Club are coming soon.',
};

const TRUST_SIGNALS = [
  'Canadian pricing — billed in CAD',
  'No contracts — cancel anytime',
  'Tournament, Team, and Tournament Plus available now',
  'Plans can be changed at any time',
];

const COMPARISON_CATEGORIES = [
  {
    label: 'Tournaments & Scheduling',
    rows: [
      { feature: 'Non-archived tournament slots', tournament: '1',        plus: 'Unlimited', league: 'Unlimited', club: 'Unlimited' },
      { feature: 'Tournament scheduling',        tournament: 'Manual',   plus: 'Manual + automated', league: 'Manual + automated', club: 'Manual + automated' },
      { feature: 'Playoff games / brackets',     tournament: 'Manual',   plus: 'Generator included', league: 'Generator included', club: 'Generator included' },
      { feature: 'Tournament archive flow',      tournament: 'Basic archive', plus: 'Sealed archives', league: 'Sealed archives', club: 'Sealed archives' },
      { feature: 'Field and diamond management', tournament: '✓',        plus: '✓',         league: '✓',         club: '✓' },
      { feature: 'Score entry and standings',    tournament: '✓',        plus: '✓',         league: '✓',         club: '✓' },
    ],
  },
  {
    label: 'Registration Operations',
    rows: [
      { feature: 'Team registration form',          tournament: 'Standard fields', plus: 'Custom fields + files', league: 'Custom fields + files', club: 'Custom fields + files' },
      { feature: 'Registration exports (Excel, CSV, PDF)', tournament: '-',          plus: 'Included',              league: 'Included',              club: 'Included' },
      { feature: 'Selected-row registration updates', tournament: 'Included',       plus: 'Included',              league: 'Included',              club: 'Included' },
      { feature: 'Division capacity and waitlists', tournament: 'Collection + review', plus: 'Promotion tools',    league: 'Promotion tools',       club: 'Promotion tools' },
      { feature: 'Payment and deposit tracking',    tournament: 'Basic tracking',  plus: 'Advanced reporting',    league: 'Advanced reporting',    club: 'Advanced reporting' },
    ],
  },
  {
    label: 'Data & Exports',
    rows: [
      { feature: 'Schedule export (Excel, CSV, iCal)',        tournament: '✓', plus: '✓',         league: '✓',       club: '✓' },
      { feature: 'Results export (Excel, CSV)',               tournament: '✓', plus: '✓',         league: '✓',       club: '✓' },
      { feature: 'Registration exports (Excel, CSV, PDF)',    tournament: '—', plus: 'Included',   league: 'Included', club: 'Included' },
      { feature: 'PDF reports with branded templates',        tournament: '—', plus: 'Included',   league: 'Included', club: 'Included' },
      { feature: 'League registration and standings exports', tournament: '—', plus: '—',          league: 'Included', club: 'Included' },
      { feature: 'Rep team and accounting PDF reports',       tournament: '—', plus: '—',          league: '—',        club: 'Included' },
    ],
  },
  {
    label: 'Staff & Access',
    rows: [
      { feature: 'Staff / admin seats',                   tournament: '3',       plus: '10',              league: '10',            club: 'Unlimited' },
      { feature: 'Officials seats',                       tournament: 'Counted', plus: 'Unlimited (free)', league: 'Unlimited (free)', club: 'Unlimited (free)' },
      { feature: 'Advanced member roles and permissions', tournament: '—',       plus: '—',               league: '✓',             club: '✓' },
    ],
  },
  {
    label: 'Communications',
    rows: [
      { feature: 'Basic team/contact email',     tournament: '✓', plus: '✓', league: '✓', club: '✓' },
      { feature: 'Targeted tournament announcements', tournament: '-', plus: 'Included', league: 'Included', club: 'Included' },
      { feature: 'League-scoped communications', tournament: '—', plus: '—', league: '✓', club: '✓' },
    ],
  },
  {
    label: 'Public Presence',
    rows: [
      { feature: 'Tournament public branding', tournament: 'FieldLogicHQ default', plus: 'Full control', league: 'Full control', club: 'Full control' },
      { feature: 'Powered by FieldLogicHQ badge', tournament: 'Shown', plus: 'Not shown', league: 'Not shown', club: 'Not shown' },
      { feature: 'Public organization page',  tournament: '—', plus: '—', league: '✓', club: '✓' },
      { feature: 'Branded tournament listing', tournament: '—', plus: '—', league: '✓', club: '✓' },
    ],
  },
  {
    label: 'House League',
    rows: [
      { feature: 'House League module',          tournament: '—', plus: '—', league: '✓', club: '✓' },
      { feature: 'Player registration workflows', tournament: '—', plus: '—', league: '✓', club: '✓' },
      { feature: 'Season and division management', tournament: '—', plus: '—', league: '✓', club: '✓' },
      { feature: 'League scheduling and standings', tournament: '—', plus: '—', league: '✓', club: '✓' },
    ],
  },
  {
    label: 'Accounting',
    rows: [
      { feature: 'Accounting module',     tournament: '—', plus: '—', league: '—', club: '✓' },
      { feature: 'Organization ledger',   tournament: '—', plus: '—', league: '—', club: '✓' },
      { feature: 'Team invoicing',        tournament: '—', plus: '—', league: '—', club: '✓' },
      { feature: 'Payment reconciliation', tournament: '—', plus: '—', league: '—', club: '✓' },
      { feature: 'Expense tracking',      tournament: '—', plus: '—', league: '—', club: '✓' },
    ],
  },
  {
    label: 'Rep Teams',
    rows: [
      { feature: 'Rep Teams module',         tournament: '—', plus: '—', league: '—', club: '✓' },
      { feature: 'Tryout registration',      tournament: '—', plus: '—', league: '—', club: '✓' },
      { feature: 'Roster management',        tournament: '—', plus: '—', league: '—', club: '✓' },
      { feature: 'Player document management', tournament: '—', plus: '—', league: '—', club: '✓' },
      { feature: 'Coaches portal',           tournament: '—', plus: '—', league: '—', club: '✓' },
      { feature: 'Team financial management', tournament: '—', plus: '—', league: '—', club: '✓' },
    ],
  },
  {
    label: 'Availability',
    rows: [
      { feature: 'Self-serve signup', tournament: 'Available now', plus: 'Available now', league: 'Coming soon', club: 'Coming soon' },
      { feature: 'Free trial', tournament: '-', plus: '14 days', league: 'Early access', club: 'Early access' },
      { feature: 'Payment details at signup', tournament: '-', plus: 'Yes', league: 'Not yet', club: 'Not yet' },
    ],
  },
];

const UPGRADE_BRIDGES = [
  {
    headline: 'Ready to run a serious tournament program?',
    body: 'Tournament Plus adds the operational tools real organizers need: unlimited tournament slots, 10 staff seats, custom registration questions, file uploads, Excel and PDF exports for registrations, schedules, and results — check-in sheets, insurance documents, and field ops handouts — payment reminders, waitlist promotion, full branding, cloning, targeted announcements, and post-event summaries.',
    from: 'Tournament',
    to: 'Tournament Plus',
    cta: 'Start Free Trial',
    href: '/auth/signup',
    earlyAccess: false,
  },
  {
    headline: 'Planning a public-facing organization?',
    body: 'League is the next tier being refined: a branded public page, house league registration and season management, and advanced permissions for registrars and division coordinators. It is visible now so organizations can see where the platform is going.',
    from: 'Tournament Plus',
    to: 'League',
    cta: 'Join Early Access',
    earlyAccess: true,
    initialPlanInterest: ['league'],
    initialFeaturesInterested: ['house_league', 'registration', 'public_site'],
  },
  {
    headline: 'When operations grow, disconnected tools become the problem.',
    body: 'Club is the full-platform direction: accounting, rep team management, tryout coordination, rosters, player documents, and a coaches portal. Those workflows are still being refined before self-serve launch.',
    from: 'League',
    to: 'Club',
    cta: 'Join Early Access',
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
    a: 'No. Tournament management is the live entry point today. League and Club are the next parts of the platform, covering registrations, public-facing league operations, accounting, rep teams, and organization-wide administration.',
  },
  {
    q: 'Can I buy League or Club today?',
    a: 'Not through self-serve checkout yet. Tournament and Tournament Plus are available now. League and Club are shown as coming-soon previews so organizations can plan ahead and join early access while those workflows are refined.',
  },
  {
    q: 'How does billing work?',
    a: 'Tournament Plus is billed monthly or annually in Canadian dollars. Monthly billing renews automatically each month. Annual billing is charged once per year - you pay for 10 months and get 12, which works out to roughly 2 months free. No contracts, no penalties.',
  },
  {
    q: 'What happens when my free trial ends?',
    a: "At the end of a Tournament Plus trial, your plan continues at the regular rate for the billing period you selected. We'll send reminders before the trial ends. If you decide not to continue, you can cancel before the trial period closes and you won't be charged. Your data stays available for 90 days after cancellation.",
  },
  {
    q: 'Can I change plans later?',
    a: "Yes, at any time. If you upgrade mid-month, the new features are available immediately and billing adjusts pro-rata. If you downgrade, the change takes effect at your next billing date. There's no lock-in. Organizations often start on Tournament, try the platform, and upgrade as their needs grow — that's exactly how the plans are designed.",
  },
  {
    q: 'Do I need a credit card to get started?',
    a: 'No card is required for the free Tournament plan. Tournament Plus trials use secure Stripe Checkout and collect payment details at signup, with the first payment charged automatically only after the trial ends.',
  },
  {
    q: 'What if we get stuck?',
    a: "FieldLogicHQ is designed to be self-serve — every workflow is built to be completed without needing to contact anyone. Documentation covers every feature in plain language, written for administrators who aren't technical. In practice, most organizations are fully operational after an afternoon of setup.",
  },
  {
    q: 'Can I use FieldLogicHQ for multiple sports?',
    a: 'Yes. The platform is sport-agnostic — used by softball associations, hockey organizations, soccer leagues, and baseball clubs. Field naming, team structures, scoring, and season setup all work across sports. If you run multiple associations, each one is managed as its own organization.',
  },
  {
    q: 'Are officials counted against my seat limit?',
    a: 'No — from Tournament Plus and above, officials seats are always free and never count against your staff/admin seat limit. The seat limit applies to administrative staff: people who create events, manage schedules, enter scores, and configure the organization.',
  },
  {
    q: 'Is there a setup fee or onboarding cost?',
    a: 'No. There are no setup fees, implementation costs, or onboarding charges. You sign up, create your organization, and start using the live tournament tools. Documentation covers every available setup step.',
  },
];

export default async function PricingPage() {
  const gatingMap = await getPlanGatingMap();

  return (
    <main>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className="container">
          <p className="font-mono text-xs uppercase tracking-widest text-blueprint-blue mb-4">Pricing</p>
          <h1 className={styles.heroTitle}>
            Plans that match how your<br />
            organization actually operates.
          </h1>
          <p className={styles.heroSub}>
            Tournament, Team, and Tournament Plus are ready for self-serve signup today.
            League and Club are previewed for early-access planning while those workflows are refined.
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

      {/* ── Plans ────────────────────────────────────────────────────────── */}
      <section className={styles.teamEntrySection}>
        <div className="container">
          <div className={styles.teamEntry}>
            <div className={styles.teamEntryText}>
              <p className={styles.teamEntryLabel}>For one competitive team</p>
              <h2 className={styles.teamEntryTitle}>I manage one competitive team.</h2>
              <p className={styles.teamEntryBody}>
                Start a standalone Team workspace for one entitled rep team. Coaches land in the coaches portal with roster, schedule, documents, dues, budget, and team-scoped access.
              </p>
            </div>
            <div className={styles.teamEntryPlan}>
              <p className={styles.teamEntryPrice}>$29 CAD / mo</p>
              <p className={styles.teamEntryNote}>or $290 CAD per season</p>
            </div>
            <Link href="/team" className={styles.teamEntryCta}>
              Start Team Workspace
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.plansSection}>
        <div className="container">
          <PricingSection gatingMap={gatingMap} />
        </div>
      </section>

      {/* ── Comparison table ─────────────────────────────────────────────── */}
      <section className={styles.tableSection} id="compare">
        <div className="container">
          <h2 className={styles.sectionTitle}>Compare all plans</h2>
          <p className={styles.sectionSub}>
            Choose from the live tournament plans today, and preview the League and Club roadmap.
          </p>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thFeature}>Feature</th>
                  <th className={styles.th}>Tournament</th>
                  <th className={styles.th}>Tournament Plus</th>
                  <th className={styles.th}>League Preview</th>
                  <th className={`${styles.th} ${styles.thClub}`}>Club Preview</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_CATEGORIES.map(cat => (
                  <Fragment key={cat.label}>
                    <tr className={styles.catRow}>
                      <td colSpan={5} className={styles.catLabel}>{cat.label}</td>
                    </tr>
                    {cat.rows.map(row => (
                      <tr key={row.feature} className={styles.dataRow}>
                        <td className={styles.tdFeature}>{row.feature}</td>
                        <td className={styles.td}>{row.tournament}</td>
                        <td className={styles.td}>{row.plus}</td>
                        <td className={styles.td}>{row.league}</td>
                        <td className={`${styles.td} ${styles.tdClub}`}>{row.club}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Upgrade bridges ──────────────────────────────────────────────── */}
      <section className={styles.bridgeSection}>
        <div className="container">
          <div className={styles.bridgeGrid}>
            {UPGRADE_BRIDGES.map(b => (
              <div key={b.from} className={styles.bridgeCard}>
                <div className={styles.bridgeLabel}>
                  {b.from} → {b.to}
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

      {/* ── Club deep-dive ───────────────────────────────────────────────── */}
      <section className={styles.clubSection} id="early-access">
        <div className="container">
          <div className={styles.clubInner}>
            <div className={styles.clubText}>
              <p className="font-mono text-xs uppercase tracking-widest text-logic-lime mb-3">Early Access</p>
              <h2 className={styles.clubTitle}>League and Club are coming next</h2>
              <p className={styles.clubSub}>Preview the bigger platform without pretending it is ready to buy today.</p>
              <p className={styles.clubBody}>
                Tournament and Tournament Plus are the live launch offers. League and Club remain on the
                public site so organizations can understand the long-term platform direction before
                they start building their tournament workflow here.
              </p>
              <p className={styles.clubBody}>
                League is focused on house league registration, divisions, seasons, public organization
                pages, and registrar workflows. Club adds rep teams and accounting for organizations
                that need the whole operating system.
              </p>
              <p className={styles.clubBody}>
                If you want either tier, start on a live tournament plan now or open the early-access form.
                That keeps the launch honest while still giving interested clubs a path into the roadmap.
              </p>
              <EarlyAccessModalTrigger
                className="inline-flex font-mono text-xs uppercase tracking-widest font-bold bg-logic-lime text-pitch-black px-6 py-3 hover:bg-white transition-colors border-0 cursor-pointer"
                initialPlanInterest={['league', 'club']}
                initialFeaturesInterested={['house_league', 'registration', 'accounting', 'rep_teams']}
              >
                Join Early Access
              </EarlyAccessModalTrigger>
            </div>
            <div className={styles.clubStats}>
              {[
                { label: 'Available now', body: 'Tournament is the free starter event tier. Tournament Plus adds registration control, schedule automation, brackets, archives, branding, cloning, and reporting for serious organizers.' },
                { label: 'Coming next', body: 'League and Club workflows are being refined before self-serve checkout opens.' },
                { label: 'Early-access path', body: 'Interested organizations can share their details and module priorities before the broader tiers launch.' },
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
          <h2 className={styles.sectionTitle}>Questions? We&apos;ve got answers.</h2>
          <p className={styles.sectionSub}>
            Especially for volunteer-run organizations — we know the questions.
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
            Spend less time managing operations<br />
            and more time running your organization.
          </h2>
          <p className={styles.ctaSub}>
            Free Tournament plan available. Tournament Plus includes a 14-day trial. League and Club are coming soon.
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
              Join Early Access
            </EarlyAccessModalTrigger>
          </div>
          <p className={styles.ctaFootnote}>All plans are billed in CAD. No contracts. No setup fees.</p>
        </div>
      </section>

    </main>
  );
}
