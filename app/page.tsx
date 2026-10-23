import Link from 'next/link';
import { redirect } from 'next/navigation';
import kit from '@/components/marketing/MarketingKit.module.css';
import styles from './page.module.css';
import { marketingMetadata } from '@/lib/marketing-metadata';
import PricingSection from '@/components/PricingSection';
import { getPlanGatingMap, type PlanGatingMap } from '@/lib/plan-gating-server';
import type { OrgPlan } from '@/lib/types';
import { isFoundingSeasonPromoActive, FOUNDING_SEASON_END_LABEL, FOUNDING_SEASON_SIGNUP_CLOSE_LABEL, gatedPlanTag, closedProgramPlansSentence } from '@/lib/plan-config';
import FoundingSeasonPanel from '@/components/marketing/FoundingSeasonPanel';
import { createClient } from '@/lib/supabase-server';
import { getAuthDestination } from '@/lib/auth-destination';
import { SEE_IT_LIVE_PATH, SEE_IT_LIVE_COACHES_PATH, sandboxDoorsVisible } from '@/lib/sandbox-door';

// The home page's one absolute title; its description is the site's own (words doc items 1 and 4).
export const metadata = marketingMetadata({ title: 'FieldLogicHQ: less admin, more sport', absolute: true, path: '/' });

/**
 * The role deep-dive cards ("One platform. Every role.").
 *
 * Same contract as the persona cards below: NO CARD WRITES DOWN WHETHER ITS PRODUCT IS AVAILABLE —
 * this section held a hardcoded "Coaches Portal · Coming soon" for two weeks after that product
 * went live (found by the owner 2026-08-08, the exact trap the persona cards were cured of the day
 * before). `liveBadge` doubles as the launch switch: `null` means nobody has decided what the card
 * says when live, so it presents as in-development even if its gate opens — and per the
 * "live products lead" ruling (2026-08-08) an in-development role renders as a compact strip,
 * never a full deep-dive card. `stripLine` is that strip's one-sentence pitch.
 */
const MODULE_CARDS: Array<{
  id: string;
  name: string;
  href: string;
  planKey: OrgPlan;
  planLabel: string;
  liveBadge: string | null;
  tagline: string;
  features: string[];
  stripLine: string;
}> = [
  {
    id: '01',
    name: 'Tournament organizer',
    href: '/for-tournament-organizers',
    planKey: 'tournament',
    planLabel: 'Tournament',
    liveBadge: 'Free to start',
    // "Your team list", not "team registration": true on both plans (free adds the teams, Tournament Plus takes
    // registrations), and the line sits under the free badge (free tournament tier, /marketing 2026-10-16).
    tagline: 'From your team list to final standings — without the spreadsheets.',
    // ⚠ This list renders under "Tournament · Free to start", so every line is a FREE-plan claim.
    // Copy it from the free inclusion list in PLAN_PRICING_FACTS.md, never from the Tournament Plus
    // card: custom registration, the round-robin generator and sealed archives sat here until
    // 2026-10-12 (free tournament tier review, R9). The lines chosen also stay true after the
    // invite-only build, so that build's /marketing pass does not have to chase this card.
    features: [
      'Pools and a schedule you build game by game, across your fields',
      'Single and double-elimination brackets',
      'Live score entry — standings update the moment you save',
      'A public event site with live scores families can follow',
      'Announcements to every team in one send',
    ],
    stripLine: 'Team list to final standings, without the spreadsheets.',
  },
  {
    id: '02',
    name: 'Head coach',
    href: '/for-coaches',
    planKey: 'team',
    planLabel: 'Coaches Portal',
    liveBadge: 'Free to start',
    tagline: 'Manage your team. Not your inbox.',
    features: [
      'Full roster management with positions and season history',
      'Lineup builder with game-by-game history — exportable to PDF',
      'Team budget, player dues, and payment tracking',
      'Document management — consent forms, medical notes, eligibility',
      'Works standalone — no organization account required',
    ],
    stripLine: 'A complete team workspace — with or without an organization.',
  },
  {
    id: '03',
    name: 'House league admin',
    href: '/for-leagues',
    planKey: 'league',
    planLabel: 'League Plus',
    liveBadge: null,
    tagline: 'From first registration to final standings, in one dashboard.',
    features: [
      'Player registration and waitlist management',
      'Draft tools and team building',
      'Auto-generated schedules and standings',
      'Season-wide parent messaging — one screen, every registered family',
      'One dashboard from opening day to final standings',
    ],
    stripLine: 'First registration to final standings, in one dashboard.',
  },
  {
    id: '04',
    name: 'Club executive',
    href: '/for-clubs',
    planKey: 'club',
    planLabel: 'Club',
    liveBadge: null,
    tagline: 'Your executive team gets visibility. Coaches run their own teams.',
    features: [
      'Tournaments, house league, and rep teams under one roof',
      'Coaches manage their own roster, lineups, and team budget',
      'Organization-wide visibility into rosters, documents, and finances',
      'Tryout registration and program year management',
      'Club ledger, budget vs. actual, and costs split across teams',
    ],
    stripLine: 'The whole organization under one roof.',
  },
];

const STEPS = [
  {
    label: 'Set up your organization',
    desc: 'Create your organization and set up the tournament tools you need today. League Plus and Club modules can be added as they open.',
  },
  {
    label: 'Open your programs',
    desc: 'Publish tournament pages, manage teams and contacts, and keep registration work organized without extra spreadsheets.',
  },
  {
    label: 'Run your whole season',
    desc: 'Enter scores from the field, publish results, and keep your tournament history on record — every event your org has run, in one place.',
  },
];

const PLATFORM_BENEFITS = [
  {
    id: 'BEN-001',
    module: 'Tournament module',
    entry: 'Generate brackets in seconds, not hours. Coaches and parents see live scores the moment you enter them — no calls to the scorekeeper\'s table.',
  },
  {
    id: 'BEN-002',
    module: 'House league module',
    entry: 'Open registration, run your draft, publish the schedule, and track standings — all in one dashboard. Parents hear about their registration automatically, and you can message the whole league in one go.',
  },
  {
    id: 'BEN-003',
    module: 'Rep teams module',
    entry: 'Coaches manage their own roster, documents, and team finances independently. Organization admins get visibility without owning the day-to-day.',
  },
  {
    id: 'BEN-004',
    module: 'Coaches Portal',
    entry: 'The roster in a group text, the lineup in a notes app, and team fees tracked in someone\'s head. The Coaches Portal puts all of it in one place — whether or not your organization is on FieldLogicHQ.',
  },
];
// id field kept for React key only — not rendered

/**
 * The persona cards.
 *
 * ⚠ NO CARD WRITES DOWN WHETHER ITS PRODUCT IS AVAILABLE. Every one carries the plan key it speaks
 * for, and `resolvePersonas` reads the live gate — because the alternative is what actually
 * happened: the Coaches Portal card held a hardcoded "coming soon" for two weeks after the Premium
 * Coaches Portal went live on production (gate reopened 2026-07-24), while /for-coaches, the /start
 * chooser and /pricing — all of which READ the gate — flipped together the same day. The homepage
 * was the one surface that asserted the answer instead of asking for it, so it froze, and the
 * highest-traffic page in the product spent a fortnight contradicting the three pages one click
 * behind it.
 *
 * Fixing only the card that was wrong would have left the identical trap armed under League Plus and
 * Club: their gates are DB-driven and can change without a deploy, so whichever launches next would
 * freeze the same way, and nobody would remember this comment in time.
 *
 * ⚠ `liveBadge: null` means "nobody has written what this card should say when it IS on sale", and
 * such a card **stays presented as coming-soon even once its gate opens**. That looks like the bug
 * this file just fixed, and it is deliberately not:
 *
 *   The homepage is not the only surface that speaks for a product. `/for-leagues` and `/for-clubs`
 *   hard-code "Coming soon" in their own copy — they do not read the gate the way `/for-coaches`
 *   does. So a card that went live the instant its gate flipped would send a visitor to a page still
 *   telling them the product isn't ready: the SAME contradiction, moved one click downstream. Given
 *   a choice between two inconsistencies, this one keeps the homepage and its destination agreeing.
 *
 *   Supplying `liveBadge` is therefore the single deliberate act that launches a card — and whoever
 *   does it must make the destination page gate-aware in the same unit of work. Until then the card
 *   is honest about being unavailable rather than dishonest about being available.
 *
 * Tracked in HOMEPAGE_TRUTH_AND_ENTRY_POINTS_PLAN.md; /marketing owes copy for both.
 */
type Persona = {
  id: string;
  /** The plan whose gate decides whether this card is on sale. */
  planKey: OrgPlan;
  label: string;
  question: string;
  body: string;
  liveBadge: string | null;
  cta: string;
  href: string;
};

/** The one line every not-yet-purchasable card shows — its plan's own tag (League Plus is parked, so
 *  "Not open yet"; everything else "Coming soon": BUSINESS_DECISIONS.md 2026-09-28). */
const gatedBadge = (planKey: OrgPlan) => `${gatedPlanTag(planKey)} · express interest`;

/**
 * Badge copy is /marketing's (2026-08-07) and deliberately carries NO price and NO promo date — the
 * persona cards state availability and the absence of a payment barrier; the $29/$39 anchors and the
 * Founding Season end date live one click later where a promotion can be explained.
 * Ruling: BUSINESS_DECISIONS.md 2026-08-07.
 */
const PERSONAS: Persona[] = [
  {
    id: 'tournament',
    planKey: 'tournament',
    label: 'Tournament',
    question: 'Running a tournament?',
    body: 'From your team list to final standings — brackets, schedule, live scores, all in one place.',
    liveBadge: 'Free to start · no credit card',
    cta: "I'm a tournament organizer",
    href: '/for-tournament-organizers',
  },
  {
    id: 'league',
    planKey: 'league',
    label: 'League Plus',
    question: 'Managing a house league season?',
    body: 'Player registration, draft, schedule, standings, and season-wide parent messaging — from first signup to final game.',
    liveBadge: null,
    cta: 'I run a house league',
    href: '/for-leagues',
  },
  {
    id: 'club',
    planKey: 'club',
    label: 'Club',
    question: 'Running a club with rep teams?',
    body: 'Tournaments, house league, rep teams, and accounting in one place. Your executive team gets visibility. Coaches run their own teams.',
    liveBadge: null,
    cta: 'I run a club',
    href: '/for-clubs',
  },
  {
    id: 'coaches',
    planKey: 'team',
    label: 'Coaches Portal',
    question: 'Coaching a single team?',
    body: 'Roster, lineups, budget, and documents — a complete team workspace, whether or not your organization is on FieldLogicHQ.',
    liveBadge: 'Free to start · no credit card',
    cta: "I'm a coach",
    href: '/for-coaches',
  },
];

/**
 * `true` in the gating map means GATED, so availability is its negation — AND a card only presents
 * as live once someone has written what it says when it is (see the note above on `liveBadge`).
 */
function resolvePersonas(gating: PlanGatingMap) {
  return PERSONAS.map(p => {
    const isLive = !gating[p.planKey] && p.liveBadge !== null;
    return { ...p, isLive, badge: isLive ? p.liveBadge : gatedBadge(p.planKey) };
  });
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  // Unified-app entry router (Phase 0). This page is BOTH the public marketing
  // homepage (browser visits — unchanged) AND the installed app's start_url.
  // The manifest launches the app at `/?source=pwa`, so only an app launch
  // carries that marker; organic/crawler traffic never does and always gets the
  // marketing page below (SEO/canonical/OG intact). On an app launch we route:
  // signed-in → their workspace (fail-closed via getAuthDestination), anonymous
  // → the public directory front door (browsing is free — no wall).
  const { source } = await searchParams;
  if (source === 'pwa') {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      redirect(await getAuthDestination());
    }
    redirect('/discover');
  }

  const gatingMap = await getPlanGatingMap();
  // The sandbox door. Hidden in a production build until the owner turns it on deliberately
  // (lib/sandbox-door.ts) — and note the demo orgs are seeded on dev only today, so this is a
  // local-only affordance until the "do the demos go public?" decision is made
  // (BUSINESS_DECISIONS.md 2026-08-07, logged as Proposed).
  const showSandboxDoor = sandboxDoorsVisible();
  // "Live products lead" (owner-ratified 2026-08-08, closing the question left open on 08-07):
  // live personas get full cards; not-yet-purchasable ones compress into one roadmap strip below.
  // The split is the same `isLive` the badges use, so a persona is promoted from strip to card by
  // the same single deliberate act that launches it — supplying its `liveBadge`.
  const personas = resolvePersonas(gatingMap);
  const livePersonas = personas.filter(p => p.isLive);
  const roadmapPersonas = personas.filter(p => !p.isLive);
  const teamOpen = !gatingMap.team;
  // The Founding Season surfaces are promo artifacts, not permanent chrome (/review 2026-08-08):
  // the hero badge row and the callout card render ONLY while the Tournament Plus promo runs, and
  // name BOTH products only while both promos run and the coach checkout is open. When the promo
  // ends they disappear on their own instead of asserting an expired date.
  const tpPromoActive = isFoundingSeasonPromoActive('tournament_plus');
  const bothPromosLive = teamOpen && tpPromoActive && isFoundingSeasonPromoActive('team');
  const liveModules = MODULE_CARDS.filter(m => !gatingMap[m.planKey] && m.liveBadge !== null);
  const roadmapModules = MODULE_CARDS.filter(m => gatingMap[m.planKey] || m.liveBadge === null);
  return (
    <div className={kit.page}>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className={`${kit.hero} ${kit.center}`}>
        <div className="container">
          {/* The Founding Season eyebrow row that sat here (12px uppercase above the headline)
              was removed 2026-09-07: the site-wide offer bar above the nav and the offer panel
              below the lead carry the offer at the weight it deserves. */}
          <h1 className={kit.headline}>
            Less admin. <span className={kit.accent}>More sport.</span>
          </h1>
          <p className={kit.lead}>
            Purpose-built for the people running community sports organizations on evenings
            and weekends — from your first tournament to a full club program.
          </p>
          {/* The page's one lime (design check D6, Ask 14): the first screen carries its own action. */}
          <div className={kit.row}>
            <Link href="/start" className={kit.btn}>Start free</Link>
            <Link href="/start" className={`${kit.link} ${kit.linkBlock}`}>Not sure? See your options</Link>
          </div>
        </div>
      </section>

      <div className={`container ${styles.doors}`}>
        {/* The Founding Season offer panel (owner-approved 2026-09-07): the promise at headline
            weight, the one offer sentence, the two prices being waived, and the after line —
            BEFORE the visitor chooses a door. The persona cards below stay the doors and keep
            their availability-only badges (BUSINESS_DECISIONS 2026-08-07): the panel carries the
            calendar so they never have to. A promo artifact: gone the day the signup window
            closes. */}
        {tpPromoActive && <FoundingSeasonPanel showProducts product={bothPromosLive ? undefined : 'tournament_plus'} />}

        <div className={`${kit.grid2} ${styles.doorsGrid}`}>
          {livePersonas.map((p) => {
            const body = (
              <>
                <div className={styles.cardHead}>
                  <p className={`${kit.eyebrow} ${styles.flush}`}>{p.label}</p>
                  {/* Defensive only — `resolvePersonas` guarantees a string either way. Absent
                      rather than empty, so a future path that does yield no badge leaves no
                      stray element in the row. */}
                  {p.badge && <span className={kit.tag}>{p.badge}</span>}
                </div>
                <h3 className={kit.title}>{p.question}</h3>
                <p className={`${kit.body} ${styles.grow}`}>{p.body}</p>
              </>
            );
            const linkClass = `${kit.link} ${kit.linkBlock}`;

            // The TWIN DOOR (owner-ratified 2026-08-10): every live persona whose product has
            // a public demo carries a second, quieter link into it — proof one step after the
            // claim, never competing with the ask. Two links cannot nest, so a doored card
            // becomes a div and the persona link stretches over it (::after) to keep
            // whole-card clickability. A persona with no demo gets no door — a door pattern
            // on League/Club would promise a demo that does not exist.
            const doorPath =
              p.id === 'tournament' ? SEE_IT_LIVE_PATH
              : p.id === 'coaches' ? SEE_IT_LIVE_COACHES_PATH
              : null;
            if (showSandboxDoor && doorPath) {
              return (
                <div key={p.id} className={`${kit.card} ${kit.stack} ${styles.doored}`}>
                  {body}
                  <div className={styles.links}>
                    <Link href={p.href} className={`${linkClass} ${styles.stretch}`}>
                      {p.cta}
                    </Link>
                    {/* One label for both worlds — the card's own title says which "it" you'll
                        see. Product-specific wording was considered and parked (2026-08-10). */}
                    <Link href={doorPath} className={`${linkClass} ${kit.live} ${styles.secondary}`}>
                      See it live — no sign-up
                    </Link>
                  </div>
                </div>
              );
            }

            return (
              <Link key={p.id} href={p.href} className={`${kit.card} ${kit.stack} ${styles.whole}`}>
                {body}
                <span className={`${linkClass} ${styles.ctaText}`}>{p.cta}</span>
              </Link>
            );
          })}
        </div>

        {/* The roadmap strip — every not-yet-purchasable persona, at footnote weight. Its
            doors and interest capture survive; only the real estate shrinks. Data-driven from
            the same gate as the cards, so it empties itself as products launch. */}
        {roadmapPersonas.length > 0 && (
          <div className={`${kit.card} ${kit.cardFlat} ${kit.row} ${styles.roadmap}`}>
            <p className={`${kit.eyebrow} ${styles.flush}`}>On the roadmap</p>
            {roadmapPersonas.map(p => (
              <Link key={p.id} href={p.href} className={styles.roadmapItem}>
                <span className={kit.small}>{p.question}</span>
                <span className={`${kit.link} ${styles.ctaText}`}>{p.cta}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Modules ───────────────────────────────────────────────────── */}
      <section className={kit.section}>
        <div className="container">
          <div className={styles.head}>
            <p className={kit.eyebrow}>What&apos;s included</p>
            <h2 className={kit.heading}>One platform. Every role.</h2>
            <p className={`${kit.body} ${styles.sub}`}>
              {teamOpen
                ? 'Tournament organizers and coaches can start today — free, no credit card required. League Plus and Club are in active development.'
                : 'Tournament organizers can start today — free, no credit card required. League Plus, Club, and Coaches Portal are in active development.'}
            </p>
          </div>
          {/* Live roles: the full deep-dive. */}
          <div className={kit.grid2}>
            {liveModules.map((mod) => (
              <div key={mod.id} className={`${kit.card} ${kit.stack}`}>
                <p className={styles.tagRow}>
                  <span className={kit.tag}>{mod.planLabel} · {mod.liveBadge}</span>
                </p>
                <h3 className={kit.title}>{mod.name}</h3>
                <p className={kit.body}>{mod.tagline}</p>
                <ul className={`${kit.ticks} ${styles.grow}`}>
                  {mod.features.map(f => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <div className={kit.push}>
                  <Link href={mod.href} className={`${kit.link} ${kit.linkBlock}`}>
                    This is me
                  </Link>
                </div>
              </div>
            ))}
          </div>
          {/* In-development roles: one confident sentence each — discoverable, not a peer.
              The full pitch lives on each role's own page, one click away. */}
          {roadmapModules.length > 0 && (
            <div className={`${kit.grid2} ${styles.roadmapModules}`}>
              {roadmapModules.map((mod) => (
                <div key={mod.id} className={`${kit.card} ${kit.cardFlat}`}>
                  <div className={styles.nameRow}>
                    <h3 className={`${kit.subhead} ${styles.flush}`}>{mod.name}</h3>
                    <span className={kit.tag}>{mod.planLabel} · In development</span>
                  </div>
                  <p className={kit.small}>{mod.stripLine}</p>
                  <Link href={mod.href} className={`${kit.link} ${kit.linkBlock}`}>
                    {mod.planKey === 'team' ? 'See the Coaches Portal' : `See what ${mod.planLabel} includes`}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────── */}
      <section className={kit.section}>
        <div className="container">
          <div className={styles.head}>
            <p className={kit.eyebrow}>How it works</p>
            <h2 className={kit.heading}>Up and running in a day</h2>
            <p className={`${kit.body} ${styles.sub}`}>
              No manual needed. Set up your organization, open your programs, run your whole season.
            </p>
          </div>
          <div className={kit.grid3}>
            {STEPS.map(({ label, desc }, i) => (
              <div key={label} className={`${kit.card} ${kit.cardFlat}`}>
                <p className={kit.counter}>Step {i + 1}</p>
                <h3 className={`${kit.subhead} ${styles.stepTitle}`}>{label}</h3>
                <p className={kit.small}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────── */}
      <section className={kit.section} id="pricing">
        <div className="container">
          <div className={styles.head}>
            <p className={kit.eyebrow}>Pricing</p>
            <h2 className={kit.heading}>Plans built for how you operate.</h2>
            <p className={`${kit.body} ${styles.sub}`}>
              {[
                teamOpen
                  ? 'Tournament, Tournament Plus, and the Premium Coaches Portal are available now.'
                  : 'Tournament and Tournament Plus are available now.',
                closedProgramPlansSentence(gatingMap),
              ].filter(Boolean).join(' ')}
            </p>
          </div>

          {/* Founding Season — one line, not a second box (owner-approved 2026-09-07): the hero
              panel already made the pitch three screens up. Speaks for BOTH promos while both are
              running (Tournament Plus-only otherwise); a promo artifact, gone when the signup
              window closes. */}
          {tpPromoActive && (
            <p className={`${kit.small} ${styles.promoLine}`}>
              <strong className={styles.promoName}>Founding Season:</strong>{' '}
              {bothPromosLive ? 'Tournament Plus and the Premium Coaches Portal are' : 'Tournament Plus is'} free through {FOUNDING_SEASON_END_LABEL} when you sign up by {FOUNDING_SEASON_SIGNUP_CLOSE_LABEL}.
            </p>
          )}

          <PricingSection gatingMap={gatingMap} marketingLayout />

          <p className={styles.after}>
            <Link href="/pricing" className={`${kit.btn} ${kit.btnSecondary}`}>
              Compare all plans in detail
            </Link>
          </p>
        </div>
      </section>

      {/* ── Platform highlights ───────────────────────────────────────── */}
      <section className={kit.section}>
        <div className="container">
          <div className={styles.head}>
            <p className={kit.eyebrow}>Platform highlights</p>
            <h2 className={kit.heading}>What it actually replaces</h2>
          </div>
          <div className={kit.grid2}>
            {PLATFORM_BENEFITS.map(({ id, module, entry }) => (
              <div key={id} className={`${kit.card} ${kit.cardFlat}`}>
                <p className={kit.eyebrow}>{module}</p>
                <p className={`${kit.body} ${styles.flush}`}>{entry}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ────────────────────────────────────────────────── */}
      <section className={`${kit.section} ${kit.band} ${kit.center}`}>
        <div className="container">
          <p className={kit.eyebrow}>Built for how community sport actually runs</p>
          <p className={kit.lead}>
            Your organization isn&apos;t just running a tournament. You&apos;re managing house league
            registrations, rep team tryouts, field bookings, and a treasurer who tracks
            dues in a spreadsheet — all with volunteers, on nights and weekends, for the
            kids in your community.
          </p>
          <h2 className={`${kit.heading} ${styles.ctaHeading}`}>
            Your season belongs{' '}
            <span className={kit.accent}>on a real platform.</span>
          </h2>
          <Link href="/start" className={kit.btn}>
            Start your organization
          </Link>
        </div>
      </section>
    </div>
  );
}
