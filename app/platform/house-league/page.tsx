import Link from 'next/link';
import type { Metadata } from 'next';
import EarlyAccessModalTrigger from '@/components/EarlyAccessModalTrigger';

export const metadata: Metadata = {
  title: 'House League — FieldLogicHQ',
  description: 'Manage your house league from registration to final standings. Seasons, drafts, scheduling, and parent notifications — all in one place.',
};

const CAPABILITIES = [
  {
    name: 'Season Management',
    desc: 'Create seasons with custom divisions and age groups. Activate and archive seasons independently — multiple can run at once.',
  },
  {
    name: 'Registration Workflows',
    desc: 'Publish registration forms per season. Collect player info, accept or decline applications, and manage waitlists automatically.',
  },
  {
    name: 'Draft Tools',
    desc: 'Build balanced teams from your registered player pool. Assign players to divisions and teams before the season starts.',
  },
  {
    name: 'Schedule Generation',
    desc: 'Auto-generate game schedules across fields and time slots. Balance games-per-team and rest periods without manual calculations.',
  },
  {
    name: 'Standings & Results',
    desc: 'Standings update automatically as scores are entered. Parents and coaches see live results without any extra staff effort.',
  },
  {
    name: 'Parent Notifications',
    desc: 'Automated email notifications when schedules change, games are postponed, or standings update. No more reply-all chains.',
  },
];

export default function HouseLeaguePage() {
  return (
    <div className="pt-16 bg-pitch-black min-h-screen">
      {/* Hero */}
      <section className="border-b border-blueprint-blue/20 py-24">
        <div className="max-w-4xl mx-auto px-6">
          <p className="font-mono text-xs text-logic-lime uppercase tracking-widest mb-4">
            House League module
          </p>
          <h1 className="font-display text-5xl md:text-6xl font-black text-fl-text leading-tight mb-6">
            From registration<br />
            <span className="text-logic-lime">to final standings.</span>
          </h1>
          <p className="font-mono text-sm text-data-gray leading-relaxed max-w-2xl mb-10">
            Season setup, player registration, draft tools, scheduling, standings, and parent notifications
            — everything your house league needs in one dashboard. No spreadsheets, no reply-all emails.
          </p>
          <p className="font-mono text-xs text-logic-lime leading-relaxed max-w-2xl mb-8 border border-logic-lime/30 px-4 py-3">
            Coming soon: House League is in final refinement. Tournament and Tournament Plus are available now.
          </p>
          <div className="flex flex-wrap gap-4">
            <EarlyAccessModalTrigger
              className="font-mono text-xs font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors border-0 cursor-pointer"
              initialPlanInterest={['league']}
              initialFeaturesInterested={['house_league', 'registration']}
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
            {['League', 'Club'].map(plan => (
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
            Ready to run a real season?
          </h2>
          <p className="font-mono text-xs text-data-gray mb-10">
            House League will be included in the League and Club plans when those tiers open for self-serve signup.
          </p>
          <EarlyAccessModalTrigger
            className="font-mono text-sm font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors border-0 cursor-pointer"
            initialPlanInterest={['league']}
            initialFeaturesInterested={['house_league', 'registration']}
          >
            Join Early Access
          </EarlyAccessModalTrigger>
        </div>
      </section>
    </div>
  );
}
