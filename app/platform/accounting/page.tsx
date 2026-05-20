import Link from 'next/link';
import type { Metadata } from 'next';
import EarlyAccessModalTrigger from '@/components/EarlyAccessModalTrigger';

export const metadata: Metadata = {
  title: 'Accounting — FieldLogicHQ',
  description: 'Financial tracking built for sports organizations. Org ledgers, team invoicing, expense tracking, and CSV export — no separate spreadsheets.',
};

const CAPABILITIES = [
  {
    name: 'Org Ledger',
    desc: 'A central ledger for all organization-level income and expenses. Every entry is timestamped, categorized, and auditable.',
  },
  {
    name: 'Team Invoicing',
    desc: 'Issue invoices to teams for dues, registration fees, and expenses. Track payment status without chasing down coaches manually.',
  },
  {
    name: 'Expense Tracking',
    desc: 'Log and categorize expenses by event, season, or program. Get a clear picture of where money is going across the org.',
  },
  {
    name: 'Transfers & Reconciliation',
    desc: 'Move funds between ledgers — org to team, team to team. Reconcile transfers and keep books balanced season over season.',
  },
  {
    name: 'CSV Export',
    desc: 'Export any ledger to CSV at any time. Hand off clean data to your external accountant or upload to any accounting software.',
  },
  {
    name: 'Treasurer Role',
    desc: 'Assign a Treasurer role with access scoped to financial tools only — no scheduling, no roster management, no admin sprawl.',
  },
];

export default function AccountingPage() {
  return (
    <div className="pt-16 bg-pitch-black min-h-screen">
      {/* Hero */}
      <section className="border-b border-blueprint-blue/20 py-24">
        <div className="max-w-4xl mx-auto px-6">
          <p className="font-mono text-xs text-logic-lime uppercase tracking-widest mb-4">
            Accounting module
          </p>
          <h1 className="font-display text-5xl md:text-6xl font-black text-fl-text leading-tight mb-6">
            Your books belong<br />
            <span className="text-logic-lime">on the platform.</span>
          </h1>
          <p className="font-mono text-sm text-data-gray leading-relaxed max-w-2xl mb-10">
            Org ledgers, team invoicing, expense tracking, transfers, and CSV export — financial
            tools built for how volunteer-run sports clubs actually operate. No separate spreadsheets.
            No more treasurer onboarding from scratch.
          </p>
          <p className="font-mono text-xs text-logic-lime leading-relaxed max-w-2xl mb-8 border border-logic-lime/30 px-4 py-3">
            Coming soon: Accounting is part of the Club roadmap and is not open for self-serve signup yet.
          </p>
          <div className="flex flex-wrap gap-4">
            <EarlyAccessModalTrigger
              className="font-mono text-xs font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors border-0 cursor-pointer"
              initialPlanInterest={['club']}
              initialFeaturesInterested={['accounting']}
            >
              Join Early Access
            </EarlyAccessModalTrigger>
            <Link
              href="/pricing"
              className="font-mono text-xs uppercase tracking-widest text-data-gray border border-blueprint-blue/40 px-8 py-4 hover:border-blueprint-blue hover:text-fl-text transition-colors"
            >
              View pricing →
            </Link>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <p className="font-mono text-xs text-logic-lime uppercase tracking-widest mb-2">Capabilities</p>
          <h2 className="font-display text-3xl font-black text-fl-text mb-12">
            What&apos;s included
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CAPABILITIES.map(cap => (
              <div
                key={cap.name}
                className="border border-blueprint-blue/30 p-6 hover:border-blueprint-blue/60 transition-colors"
              >
                <p className="font-mono text-xs font-bold text-fl-text uppercase tracking-wide mb-2">
                  {cap.name}
                </p>
                <p className="font-mono text-xs text-data-gray leading-relaxed">{cap.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plan callout */}
      <section className="py-12 border-t border-blueprint-blue/20">
        <div className="max-w-4xl mx-auto px-6">
          <p className="font-mono text-xs text-data-gray/50 uppercase tracking-widest mb-4">Included in</p>
          <div className="flex flex-wrap gap-3 mb-6">
            {['Club'].map(plan => (
              <span
                key={plan}
                className="font-mono text-xs uppercase tracking-widest border border-blueprint-blue/40 px-4 py-2 text-fl-text"
              >
                {plan}
              </span>
            ))}
          </div>
          <Link
            href="/pricing"
            className="font-mono text-xs text-logic-lime uppercase tracking-widest hover:text-fl-text transition-colors"
          >
            Compare all plans →
          </Link>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 border-t border-blueprint-blue/20 text-center">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="font-display text-4xl font-black text-fl-text mb-4">
            Stop managing money in spreadsheets.
          </h2>
          <p className="font-mono text-xs text-data-gray mb-10">
            Accounting will be included in the Club plan when that tier opens for self-serve signup.
          </p>
          <EarlyAccessModalTrigger
            className="font-mono text-sm font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors border-0 cursor-pointer"
            initialPlanInterest={['club']}
            initialFeaturesInterested={['accounting']}
          >
            Join Early Access
          </EarlyAccessModalTrigger>
        </div>
      </section>
    </div>
  );
}
