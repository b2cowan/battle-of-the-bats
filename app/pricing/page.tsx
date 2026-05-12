import Link from 'next/link';
import PricingSection from '@/components/PricingSection';
import styles from './page.module.css';

export const metadata = {
  title: 'Pricing — FieldLogicHQ',
  description: 'Simple, honest pricing for Canadian sports organizations. From your first tournament to a full club — one platform that grows with you.',
};

const TRUST_SIGNALS = [
  'Canadian pricing — billed in CAD',
  'No contracts — cancel anytime',
  '14-day free trial on paid plans',
  'Plans can be changed at any time',
];

const COMPARISON_CATEGORIES = [
  {
    label: 'Tournaments & Scheduling',
    rows: [
      { feature: 'Active tournaments',           tournament: '1',        plus: 'Unlimited', league: 'Unlimited', club: 'Unlimited' },
      { feature: 'Tournament scheduling',        tournament: 'Manual',   plus: 'Automated', league: 'Automated', club: 'Automated' },
      { feature: 'Bracket generator',            tournament: '—',        plus: '✓',         league: '✓',         club: '✓' },
      { feature: 'Tournament archives',          tournament: '—',        plus: '✓',         league: '✓',         club: '✓' },
      { feature: 'Field and diamond management', tournament: '✓',        plus: '✓',         league: '✓',         club: '✓' },
      { feature: 'Score entry and standings',    tournament: '✓',        plus: '✓',         league: '✓',         club: '✓' },
    ],
  },
  {
    label: 'Staff & Access',
    rows: [
      { feature: 'Staff / admin seats',                   tournament: '3',       plus: '5',               league: '10',            club: 'Unlimited' },
      { feature: 'Officials seats',                       tournament: 'Counted', plus: 'Unlimited (free)', league: 'Unlimited (free)', club: 'Unlimited (free)' },
      { feature: 'Advanced member roles and permissions', tournament: '—',       plus: '—',               league: '✓',             club: '✓' },
    ],
  },
  {
    label: 'Communications',
    rows: [
      { feature: 'Email announcements',        tournament: '—', plus: '✓', league: '✓', club: '✓' },
      { feature: 'League-scoped communications', tournament: '—', plus: '—', league: '✓', club: '✓' },
    ],
  },
  {
    label: 'Public Presence',
    rows: [
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
    label: 'Free Trial',
    rows: [
      { feature: '14-day free trial', tournament: '—', plus: '✓', league: '✓', club: '✓' },
    ],
  },
];

const UPGRADE_BRIDGES = [
  {
    headline: 'Ready to stop building schedules by hand?',
    body: 'Tournament Plus gives you automated scheduling, bracket generation, and email communications. For organizations running more than one event a year, the time saved on schedule builds alone is worth the upgrade.',
    from: 'Tournament',
    to: 'Tournament Plus',
  },
  {
    headline: 'Running a public-facing organization?',
    body: 'League adds a branded public page, a full house league module with registration and season management, and the advanced permissions your registrar and division coordinators need. One platform for everything members interact with.',
    from: 'Tournament Plus',
    to: 'League',
  },
  {
    headline: 'When operations grow, disconnected tools become the problem.',
    body: 'Club adds full accounting and rep team management — the two things that consume the most volunteer time in any organization. Invoicing, payment tracking, tryout coordination, roster management, player documents, and a coaches portal are all included. Most Club organizations recover that time within the first season.',
    from: 'League',
    to: 'Club',
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
    a: 'No. Tournament management is one part of the platform. League and Club plans support registrations, public-facing league operations, accounting, rep teams, and organization-wide administration. The Tournament plan is the entry point — not the full picture.',
  },
  {
    q: 'How does billing work?',
    a: 'Paid plans are billed monthly or annually in Canadian dollars. Monthly billing renews automatically each month. Annual billing is charged once per year — you pay for 10 months and get 12, which works out to roughly 2 months free. You can switch between monthly and annual at any renewal date. No contracts, no penalties.',
  },
  {
    q: 'What happens when my free trial ends?',
    a: "At the end of your 14-day trial, your plan continues at the regular monthly rate. We'll send you a reminder before your trial ends. If you decide not to continue, you can cancel before the trial period closes and you won't be charged. Your data stays available for 30 days after cancellation.",
  },
  {
    q: 'Can I change plans later?',
    a: "Yes, at any time. If you upgrade mid-month, the new features are available immediately and billing adjusts pro-rata. If you downgrade, the change takes effect at your next billing date. There's no lock-in. Organizations often start on Tournament, try the platform, and upgrade as their needs grow — that's exactly how the plans are designed.",
  },
  {
    q: 'Do I need a credit card to get started?',
    a: "No. The Tournament plan is free, no card required. Paid plan free trials also don't require a credit card upfront — you only enter billing information when you're ready to continue after the trial.",
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
    a: 'No. There are no setup fees, implementation costs, or onboarding charges. You sign up, create your organization, and start using the platform. Documentation covers every setup step, including first-season configuration, accounting setup, and rep team structure.',
  },
];

export default function PricingPage() {
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
            Pick the plan that fits where you are today. No modules to buy separately.
            No seat surprises. No contract required.
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
      <section className={styles.plansSection}>
        <div className="container">
          <PricingSection />
        </div>
      </section>

      {/* ── Comparison table ─────────────────────────────────────────────── */}
      <section className={styles.tableSection} id="compare">
        <div className="container">
          <h2 className={styles.sectionTitle}>Compare all plans</h2>
          <p className={styles.sectionSub}>
            Choose the plan that matches how your organization operates today.
          </p>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thFeature}>Feature</th>
                  <th className={styles.th}>Tournament</th>
                  <th className={styles.th}>Tournament Plus</th>
                  <th className={styles.th}>League</th>
                  <th className={`${styles.th} ${styles.thClub}`}>Club ⭐</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_CATEGORIES.map(cat => (
                  <>
                    <tr key={cat.label} className={styles.catRow}>
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
                  </>
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
                <Link href="/auth/signup" className={styles.bridgeCta}>
                  Start Free Trial →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Club deep-dive ───────────────────────────────────────────────── */}
      <section className={styles.clubSection}>
        <div className="container">
          <div className={styles.clubInner}>
            <div className={styles.clubText}>
              <p className="font-mono text-xs uppercase tracking-widest text-logic-lime mb-3">Most Popular</p>
              <h2 className={styles.clubTitle}>Why most clubs choose the Club plan</h2>
              <p className={styles.clubSub}>It's not about features. It's about time.</p>
              <p className={styles.clubBody}>
                The two tools that Club adds — accounting and rep team management — are where sports
                organizations lose the most time every season. Chasing payments. Reconciling who owes
                what. Coordinating tryouts over email. Keeping track of player documents. Sending
                rosters to coaches who then manage their own spreadsheets.
              </p>
              <p className={styles.clubBody}>
                Club centralizes all of it. Treasurers get a real ledger. Team managers stop chasing
                paper. Coaches have their own portal. And the executive doesn't spend Sunday nights
                in a spreadsheet.
              </p>
              <p className={styles.clubBody}>
                That's why it's the most popular plan — not because organizations want the most
                features, but because they want their volunteer hours back.
              </p>
            </div>
            <div className={styles.clubStats}>
              {[
                { label: 'Hours recovered every season', body: 'Accounting and rep team tools eliminate the manual coordination that costs volunteer orgs most of their time.' },
                { label: 'One place for everything', body: 'Rosters, finances, documents, schedules, and communications — no more fragmented tools.' },
                { label: 'Built for the whole org', body: 'Treasurers, coaches, registrars, and executives each get the access they need without stepping on each other.' },
              ].map(s => (
                <div key={s.label} className={styles.clubStat}>
                  <p className={styles.clubStatLabel}>{s.label}</p>
                  <p className={styles.clubStatBody}>{s.body}</p>
                </div>
              ))}
              <Link
                href="/auth/signup"
                className="block font-mono text-xs uppercase tracking-widest font-bold text-center bg-logic-lime text-pitch-black px-6 py-3 hover:bg-white transition-colors w-full mt-2"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className={styles.faqSection}>
        <div className="container">
          <h2 className={styles.sectionTitle}>Questions? We've got answers.</h2>
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
            Free plan available. No credit card required for trials. Cancel anytime.
          </p>
          <div className={styles.ctaActions}>
            <Link
              href="/auth/signup"
              className="font-mono text-sm font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors"
            >
              Get Started Free
            </Link>
            <Link
              href="/auth/signup"
              className="font-mono text-sm uppercase tracking-widest text-data-gray border border-blueprint-blue/40 px-8 py-4 hover:border-blueprint-blue hover:text-fl-text transition-colors"
            >
              Have questions? Talk to us.
            </Link>
          </div>
          <p className={styles.ctaFootnote}>All plans are billed in CAD. No contracts. No setup fees.</p>
        </div>
      </section>

    </main>
  );
}
