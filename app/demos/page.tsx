import Link from 'next/link';
import type { Metadata } from 'next';
import {
  DEMOS_PATH,
  SEE_IT_LIVE_PATH,
  SEE_IT_LIVE_COACHES_PATH,
} from '@/lib/sandbox-door';

/**
 * `/demos` — both sandbox doors on one short, shareable address.
 *
 * Built 2026-08-11 on the owner's ask, firing the revisit trigger the 2026-08-10 placement ruling
 * set for itself ("when a campaign needs one URL"): a link to hand to people in the industry who
 * should walk BOTH worlds, for whom the homepage's "which persona are you?" — a better chooser for
 * a prospect — is the wrong question. See `lib/sandbox-door.ts` for why it sits at a top level.
 *
 * ⚠ This page is NOT gated on `sandboxDoorsVisible()`, and that is deliberate: it follows the same
 * rule as the doors it links to ("the door itself is always live wherever the sandbox is seeded;
 * the flag only governs whether the marketing site ADVERTISES it"). Gating the page would make a
 * shared link dead exactly where someone was sent it. The flag governs the footer link instead.
 *
 * The ungated-door ruling applies here in full: nothing on this page may ask a visitor for
 * anything. No form, no email, no interstitial — two links and what is behind them.
 */

export const metadata: Metadata = {
  // Bare, unlike its `/for-*` siblings, which each hardcode "— FieldLogicHQ" and then collect the
  // root template's "| FieldLogicHQ" on top of it. This page's title is the preview text on a link
  // we hand to strangers, so it is the one place the doubling is worth not inheriting.
  title: 'Live Demos',
  description:
    'Walk the real product with no sign-up and no email: a live tournament weekend, and a full rep-team season. Two fictional clubs running the actual FieldLogicHQ software.',
  alternates: { canonical: DEMOS_PATH },
};

const DEMOS = [
  {
    id: 'tournament',
    label: 'Tournament demo',
    org: 'Riverdale Minor Ball Association',
    title: 'A tournament weekend, mid-flight',
    body:
      'You arrive on a real tournament that is running right now — and you get the organizer’s side of it too, not just the public page.',
    // ⚠ Every line here is a CLAIM ABOUT SEEDED DATA and drifts silently when the seed moves.
    // Checked against `lib/demo-moments.ts` on 2026-08-11: the main event re-anchors on a rolling
    // 120-minute cycle and is live ~116 of every 120 minutes on ANY day (there is no weekend
    // logic — an earlier draft of this line said "live this weekend" and was false 5 days in 7);
    // the Opener's bracket day is a fixed -1 ("always yesterday"); the Invitational sits at
    // INVITATIONAL_START_OFFSET = 21 days to FIRST PITCH with registration deliberately still
    // OPEN mid-flight (not closing — an earlier draft said "from registration close").
    seeing: [
      'Three events at once: one running live right now, one that finished yesterday, one three weeks out with registration still open',
      'The public side families actually use — schedule, live scores, standings, brackets',
      'The organizer’s console behind it: registrations, scheduling, score entry, publishing',
    ],
    door: SEE_IT_LIVE_PATH,
    doorCta: 'Open the tournament demo',
    learnMore: { href: '/for-tournament-organizers', label: 'Read the tournament pitch' },
  },
  {
    id: 'coaches',
    label: 'Coaches Portal demo',
    org: 'Riverdale Ridge Baseball',
    title: 'A rep team, a whole season',
    body:
      'You arrive as a head coach mid-season, with a game this Saturday — and you can step to any other moment of the year from there.',
    seeing: [
      'Five teams, one per season moment: tryout day, off-season, season start, mid-season, season’s end',
      'Roster, lineups, practice plans, schedule and team documents on a real team',
      'The team’s money: budget, dues, who has paid, and what each family owes',
    ],
    door: SEE_IT_LIVE_COACHES_PATH,
    doorCta: 'Open the coaches demo',
    learnMore: { href: '/for-coaches', label: 'Read the coaches pitch' },
  },
] as const;

export default function DemosPage() {
  return (
    <main className="bg-pitch-black min-h-screen">
      <section className="pt-32 pb-16 md:pt-40 md:pb-20">
        <div className="container">
          {/* NOT `hud-label` + a colour utility. The global `.hud-label` rule sets its own ink
              (--blueprint-light) and is declared after @tailwind utilities, so at equal
              specificity it BEATS `text-logic-lime` and the eyebrow silently renders blue —
              the same trap app/error.tsx had to route around. The homepage's lime eyebrows
              spell the type out instead, so this matches them. */}
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-logic-lime mb-6">
            Live demos
          </p>
          <h1 className="font-mono font-bold tracking-tighter text-fl-text text-4xl md:text-6xl leading-[1.05] max-w-4xl">
            Walk the real product.
            <br />
            <span className="text-logic-lime">Nothing to sign up for.</span>
          </h1>
          <p className="font-mono text-sm md:text-base text-data-gray leading-relaxed max-w-2xl mt-8">
            These are not recordings or screenshots. Both demos are the actual FieldLogicHQ
            software, running on two fictional clubs we operate ourselves. Pick a door and
            you are inside it — no form, no email, no credit card.
          </p>
        </div>
      </section>

      <section className="pb-20 md:pb-28">
        <div className="container">
          <div className="grid gap-6 md:grid-cols-2">
            {DEMOS.map(demo => (
              <div
                key={demo.id}
                className="flex flex-col border border-blueprint-blue/40 p-7 md:p-8 transition-colors hover:border-logic-lime/30"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-logic-lime">
                    {demo.label}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-data-gray text-right leading-relaxed">
                    No sign-up
                  </span>
                </div>

                <h2 className="font-mono font-bold text-fl-text text-xl md:text-2xl tracking-tight mt-5">
                  {demo.title}
                </h2>
                <p className="font-mono text-[11px] uppercase tracking-widest text-data-gray mt-2">
                  {demo.org}
                </p>

                <p className="font-mono text-sm text-data-gray leading-relaxed mt-5">
                  {demo.body}
                </p>

                <ul className="mt-6 space-y-3 flex-1">
                  {demo.seeing.map(item => (
                    <li key={item} className="flex gap-3 font-mono text-xs text-data-gray leading-relaxed">
                      <span className="text-logic-lime shrink-0" aria-hidden="true">›</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <Link
                    href={demo.door}
                    className="font-mono text-xs font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-7 py-3.5 hover:bg-white transition-colors"
                  >
                    {demo.doorCta} →
                  </Link>
                  <Link
                    href={demo.learnMore.href}
                    className="tap-target font-mono text-[10px] uppercase tracking-widest text-data-gray hover:text-fl-text transition-colors"
                  >
                    {demo.learnMore.label} →
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* The two questions everyone asks on arrival, answered before they have to ask.
              Both are load-bearing promises the sandbox actually keeps (the central write
              block and the three outbound chokepoints) — not reassurance copy. */}
          <div className="mt-12 border-t border-blueprint-blue/25 pt-8 grid gap-6 md:grid-cols-2 max-w-4xl">
            <div>
              {/* Bare `hud-label` — it carries its own AA-cleared ink and, being declared after
                  @tailwind utilities, would override any colour utility paired with it anyway. */}
              <p className="hud-label mb-3">Can I break it?</p>
              <p className="font-mono text-xs text-data-gray leading-relaxed">
                No. Both demos are read-only — you can open anything, but nothing you do is
                saved, and no email or notification can leave them. Everyone who visits sees
                the same club, freshly re-set.
              </p>
            </div>
            <div>
              <p className="hud-label mb-3">Can I see both?</p>
              <p className="font-mono text-xs text-data-gray leading-relaxed">
                Yes — come back to this page and open the other one. They are separate worlds,
                and switching between them takes one click with nothing to sign out of.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
