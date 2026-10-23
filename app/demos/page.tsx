import Link from 'next/link';
import {
  DEMOS_PATH,
  SEE_IT_LIVE_PATH,
  SEE_IT_LIVE_COACHES_PATH,
} from '@/lib/sandbox-door';
import { marketingMetadata } from '@/lib/marketing-metadata';
import kit from '@/components/marketing/MarketingKit.module.css';
import { cn } from '@/lib/utils';
import styles from './page.module.css';

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

// Bare title (the layout adds the brand once): this page's title is the preview text on a link we hand to strangers.
export const metadata = marketingMetadata({
  title: 'Live demos',
  description:
    'Walk the real product with no sign-up and no email: a live tournament weekend, and a full rep-team season. Two fictional clubs running the actual FieldLogicHQ software.',
  path: DEMOS_PATH,
});

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
    <main className={kit.page}>
      <section className={kit.hero}>
        <div className="container">
          <p className={kit.eyebrow}>Live demos</p>
          <h1 className={kit.headline}>
            Walk the real product.
            <br />
            <span className={kit.accent}>Nothing to sign up for.</span>
          </h1>
          <p className={kit.lead}>
            These are not recordings or screenshots. Both demos are the actual FieldLogicHQ
            software, running on two fictional clubs we operate ourselves. Pick a door and
            you are inside it — no form, no email, no credit card.
          </p>
        </div>
      </section>

      <section className={cn(kit.section, styles.cards)}>
        <div className="container">
          <div className={kit.grid2}>
            {DEMOS.map(demo => (
              <div key={demo.id} className={cn(kit.card, kit.stack)}>
                <div className={styles.cardHead}>
                  <p className={kit.eyebrow}>{demo.label}</p>
                  <span className={kit.tag}>No sign-up</span>
                </div>

                <h2 className={kit.title}>{demo.title}</h2>
                <p className={cn(kit.small, styles.org)}>{demo.org}</p>

                <p className={kit.body}>{demo.body}</p>

                <ul className={kit.ticks}>
                  {demo.seeing.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>

                {/* The tournament card's door is the page's one lime button; the coach card's is the
                    secondary (one primary per view, S4). Each pitch link is an olive text link. */}
                <div className={cn(kit.push, styles.foot)}>
                  <Link
                    href={demo.door}
                    className={cn(kit.btn, demo.id !== 'tournament' && kit.btnSecondary)}
                  >
                    {demo.doorCta}
                  </Link>
                  <Link
                    href={demo.learnMore.href}
                    className={cn(kit.link, kit.linkBlock)}
                  >
                    {demo.learnMore.label}
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* The two questions everyone asks on arrival, answered before they have to ask.
              Both are load-bearing promises the sandbox actually keeps (the central write
              block and the three outbound chokepoints) — not reassurance copy. */}
          <div className={cn(kit.grid2, styles.faq)}>
            <div>
              <h2 className={kit.subhead}>Can I break it?</h2>
              <p className={kit.body}>
                No. Both demos are read-only — you can open anything, but nothing you do is
                saved, and no email or notification can leave them. Everyone who visits sees
                the same club, freshly re-set.
              </p>
            </div>
            <div>
              <h2 className={kit.subhead}>Can I see both?</h2>
              <p className={kit.body}>
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
