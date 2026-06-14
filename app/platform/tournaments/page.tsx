import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tournaments — FieldLogicHQ',
  description: 'Run your tournament without the spreadsheets. Brackets, live scoring, team registration, and scheduling — all in one place.',
};

const CAPABILITIES = [
  {
    name: 'Bracket Generator',
    desc: 'Build single or double-elimination brackets in seconds. Seeding, bye assignment, and bracket advancement are handled automatically.',
  },
  {
    name: 'Live Scorekeeping',
    desc: 'Enter scores from the sideline. Brackets advance in real time — coaches and parents see results the moment you save them.',
  },
  {
    name: 'Team Registration',
    desc: 'Start with standard team registration on the free plan. Tournament Plus adds custom questions, file collection, Excel and PDF exports for check-in and insurance submissions, and waitlist workflows.',
  },
  {
    name: 'Schedule Generator',
    desc: 'Automated game scheduling across fields and time slots. Minimize conflicts, balance rest, and publish in one click.',
  },
  {
    name: 'Venue Management',
    desc: 'Define your venue layout once. Scheduling and scorekeeping use it automatically across every event.',
  },
  {
    name: 'Tournament Archives',
    desc: 'Every result sealed and searchable after the final whistle. Past brackets, standings, and scores stay on the platform permanently.',
  },
];

export default function TournamentsPage() {
  return (
    <div className="pt-16 bg-pitch-black min-h-screen">
      {/* Hero */}
      <section className="border-b border-blueprint-blue/20 py-24">
        <div className="max-w-4xl mx-auto px-6">
          <p className="font-mono text-xs text-logic-lime uppercase tracking-widest mb-4">
            Tournament module
          </p>
          <h1 className="font-display text-5xl md:text-6xl font-black text-fl-text leading-tight mb-6">
            Run your tournament.<br />
            <span className="text-logic-lime">Not your inbox.</span>
          </h1>
          <p className="font-mono text-sm text-data-gray leading-relaxed max-w-2xl mb-10">
            Scores, standings, standard team registration, scheduling, and field management for your first
            tournament. Tournament Plus adds the registration control and repeat-event tools serious organizers need.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/auth/signup"
              className="font-mono text-xs font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors"
            >
              Get Started Free
            </Link>
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
            Start free, then add serious operations
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
            {['Tournament (Free)', 'Tournament Plus', 'League Plus', 'Club'].map(plan => (
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
            Your first tournament is free.
          </h2>
          <p className="font-mono text-xs text-data-gray mb-10">
            No credit card required. Upgrade when you need custom registration, Excel and PDF exports, payment reminders, waitlist promotion, cloning, and full branding.
          </p>
          <Link
            href="/auth/signup"
            className="font-mono text-sm font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors"
          >
            Start Your Organization
          </Link>
        </div>
      </section>
    </div>
  );
}
