import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rep Teams — FieldLogicHQ',
  description: 'Coaches-first management for competitive programs. Tryouts, rosters, player documents, and team finances — all in one place.',
};

const CAPABILITIES = [
  {
    name: 'Tryout Registration',
    desc: 'Publish tryout registration forms and collect player info, medical notes, and consent before the first skate. Waitlists manage themselves.',
  },
  {
    name: 'Roster Management',
    desc: 'Build and manage rosters by program year. Track player status, positions, and uniform numbers — coaches own their own roster.',
  },
  {
    name: 'Coaches Portal',
    desc: 'Coaches get their own dedicated portal to manage their team independently. Head coaches and assistants have differentiated access.',
  },
  {
    name: 'Player Documents',
    desc: 'Upload, store, and track player documents — medical forms, consent, eligibility certificates. Coaches can see what\'s missing at a glance.',
  },
  {
    name: 'Team Accounting',
    desc: 'Track team-level income and expenses independently from the org ledger. Coaches manage their own team finances with org visibility.',
  },
  {
    name: 'Program Year Tracking',
    desc: 'Each team is organized by program year. Historical rosters, documents, and financials are preserved year over year.',
  },
];

export default function RepTeamsPage() {
  return (
    <div className="pt-16 bg-pitch-black min-h-screen">
      {/* Hero */}
      <section className="border-b border-blueprint-blue/20 py-24">
        <div className="max-w-4xl mx-auto px-6">
          <p className="font-mono text-xs text-logic-lime uppercase tracking-widest mb-4">
            Rep Teams module
          </p>
          <h1 className="font-display text-5xl md:text-6xl font-black text-fl-text leading-tight mb-6">
            Coaches run their team.<br />
            <span className="text-logic-lime">You run the org.</span>
          </h1>
          <p className="font-mono text-sm text-data-gray leading-relaxed max-w-2xl mb-10">
            Tryout registration, roster management, a dedicated coaches portal, player documents,
            and team finances — all in one place. Coaches own their day-to-day. Org admins keep
            visibility without owning every task.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/auth/signup"
              className="font-mono text-xs font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors"
            >
              Get Started
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
            The whole club, one platform.
          </h2>
          <p className="font-mono text-xs text-data-gray mb-10">
            Rep Teams is included in the Club plan. Start with a 90-day early-adopter trial.
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
