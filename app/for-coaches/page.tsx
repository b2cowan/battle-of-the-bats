import Link from 'next/link';
import EarlyAccessModalTrigger from '@/components/EarlyAccessModalTrigger';
import kit from '@/components/marketing/MarketingKit.module.css';
import fp from '@/components/marketing/ForPage.module.css';
import { marketingMetadata } from '@/lib/marketing-metadata';
import { PLAN_ARTICLE_CONTENT } from '@/lib/plan-article-content';
import {
  PLAN_CONFIG, formatPriceAmount, isFoundingSeasonPromoActive,
  FOUNDING_SEASON_END_LABEL, FOUNDING_SEASON_SIGNUP_CLOSE_LABEL, FOUNDING_SEASON_YEAR_LABEL,
  FOUNDING_SEASON_DECISION_MONTH_LABEL, FOUNDING_SEASON_NEXT_YEAR_LABEL,
} from '@/lib/plan-config';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import { SEE_IT_LIVE_COACHES_PATH, sandboxDoorsVisible } from '@/lib/sandbox-door';

export const metadata = marketingMetadata({
  title: 'For coaches',
  description:
    'A complete workspace for one rep team — roster, lineups, budget, schedule, and documents. No org account needed, and if your organization moves to Club, it can bring your team in.',
  path: '/for-coaches',
});

const { painItems: PAIN_ITEMS, steps: STEPS, features: PORTAL_FEATURES } =
  PLAN_ARTICLE_CONTENT.team;

export default async function ForCoachesPage() {
  // The whole page flips with the team checkout gate (Founding Season Phase 3 launch): when open,
  // it's a live "Start free" front door into /coaches/start with the promo framing; when gated, it
  // stays the express-interest explainer. This keeps /for-coaches coordinated with the launch on
  // each environment. This is a copy/CTA flip only.
  const checkoutOpen = !(await getPlanGatingMap()).team;
  const promoActive = isFoundingSeasonPromoActive('team');
  const startHref = '/coaches/start?source=for_coaches';
  // The demo door (owner-ratified 2026-08-10) — same arrangement /for-tournament-organizers
  // settled: "Start free" first, "See a coach's season" with a live dot second. The sandbox is
  // the proof; signup is still the ask. Independent of the checkout gate on purpose: the demo
  // proves the product exists either way.
  const showSandboxDoor = sandboxDoorsVisible();
  return (
    <main className={kit.page}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className={kit.hero}>
        <div className="container">
          <p className={kit.eyebrow}>For coaches</p>
          <h1 className={kit.headline}>
            Manage your team.<br />
            <span className={kit.accent}>Not your inbox.</span>
          </h1>
          {/* While the signup window is open the hero sells ONE thing (owner-approved 2026-09-07):
              the two-tier explanation made a coach sort out Basic vs Premium before reaching the
              line that matters. The free companion's reassurance moves to the plan grid below,
              where it is true; the two-family framing returns here the day the window closes. */}
          {checkoutOpen && promoActive ? (
            <p className={kit.lead}>
              The Premium Coaches Portal is your team&apos;s operations HQ — roster, lineups, budget,
              schedule, and documents for the whole season.{' '}
              <span className={fp.noteStrong}>It&apos;s free for your whole {FOUNDING_SEASON_YEAR_LABEL} season</span>
              {' '}when you sign up by {FOUNDING_SEASON_SIGNUP_CLOSE_LABEL} — normally {formatPriceAmount(PLAN_CONFIG.team.monthlyPrice)}/month.
              No organization account needed, and if your organization moves to Club, it can bring your team in with everything you&apos;ve built.
            </p>
          ) : (
            <p className={kit.lead}>
              Every coach on FieldLogicHQ starts with the free Coaches Portal — a companion for the
              tournaments you enter. The Premium Coaches Portal turns it into your team&apos;s
              operations HQ: roster, lineups, budget, schedule, and documents for the whole season.
              No org account needed, and if your organization moves to Club, it can bring your team in with everything you&apos;ve built.
            </p>
          )}
          <div className={`${kit.row} ${fp.heroRow}`}>
            {checkoutOpen ? (
              <Link href={startHref} className={kit.btn}>
                Start free
              </Link>
            ) : (
              <EarlyAccessModalTrigger
                className={kit.btn}
                initialPlanInterest={['coaches_portal']}
                initialFeaturesInterested={['roster', 'lineups', 'budget', 'team_documents']}
              >
                Express interest
              </EarlyAccessModalTrigger>
            )}
            {showSandboxDoor && (
              <Link href={SEE_IT_LIVE_COACHES_PATH} className={`${kit.btn} ${kit.btnSecondary} ${kit.live}`}>
                See a coach&apos;s season
              </Link>
            )}
            <Link href="/pricing" className={`${kit.link} ${kit.linkBlock}`}>
              See all plans
            </Link>
          </div>
          {/* The objection this answers — "is this another form?" — is why the door converts. */}
          {showSandboxDoor && (
            <p className={kit.small}>No sign-up, no email. Walk a full season — tryout day to season&apos;s end.</p>
          )}
          <div className={showSandboxDoor ? fp.afterNote : undefined}>
            <p className={kit.small}>
              {checkoutOpen ? (
                promoActive ? (
                  <>
                    <span className={fp.noteStrong}>Free through {FOUNDING_SEASON_END_LABEL}</span>
                    {' '}— normally {formatPriceAmount(PLAN_CONFIG.team.monthlyPrice)}/month. No credit card required.
                  </>
                ) : (
                  <>Start free — no credit card required.</>
                )
              ) : (
                <>
                  <span className={fp.noteStrong}>Coming soon</span>
                  {' '}— The Coaches Portal is in development. Express interest to be notified when it opens.
                </>
              )}
            </p>
          </div>
          <div className={fp.afterNote}>
            <ul className={kit.facts}>
              {(checkoutOpen && promoActive
                ? [`Free through ${FOUNDING_SEASON_END_LABEL}`, `Normally ${formatPriceAmount(PLAN_CONFIG.team.monthlyPrice)}/month`, 'No org account needed']
                : [`${formatPriceAmount(PLAN_CONFIG.team.monthlyPrice)} CAD / month`, `${formatPriceAmount(PLAN_CONFIG.team.annualPrice)} / season — save two months`, 'No org account needed']
              ).map(s => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Pain recognition ─────────────────────────────────────────────── */}
      <section className={kit.section}>
        <div className="container">
          <p className={kit.eyebrow}>The old way</p>
          <h2 className={kit.heading}>If this is how you run your team, we know the drill.</h2>
          <div className={`${kit.grid2} ${fp.gridTop}`}>
            {PAIN_ITEMS.map(item => (
              <div key={item.title} className={kit.card}>
                <p className={kit.title}>{item.title}</p>
                <p className={kit.body}>{item.body}</p>
              </div>
            ))}
          </div>
          {/* The pre-sales walkthrough (PRESALES_WALKTHROUGH_PLAN.md): the reader who just
              recognized themselves in these cards gets the visual version — 90 seconds of screens
              and diagrams — before the page moves on to features. Text-weight on purpose;
              signup stays the ask, this is deeper proof. */}
          <div className={fp.calloutTop}>
            <Link href="/for-coaches/walkthrough" className={`${kit.link} ${kit.linkBlock}`}>
              See them fixed — the 90-second walkthrough
            </Link>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className={kit.section}>
        <div className="container">
          <p className={kit.eyebrow}>What&apos;s in the portal</p>
          <h2 className={kit.heading}>Everything a head coach needs to run a season.</h2>
          <p className={`${kit.body} ${fp.measure}`}>
            One workspace for your team — whether or not your organization is on FieldLogicHQ.
          </p>
          <div className={`${kit.grid2} ${fp.gridTop}`}>
            {STEPS.map(step => (
              <div key={step.num} className={kit.card}>
                <p className={kit.counter}>{step.num}</p>
                <p className={kit.eyebrow}>{step.label}</p>
                <p className={kit.title}>{step.title}</p>
                <p className={kit.body}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Plan section ─────────────────────────────────────────────────── */}
      <section className={kit.section}>
        <div className="container">
          <p className={kit.eyebrow}>The plan</p>
          <h2 className={kit.heading}>Coaches Portal — your team, your workspace.</h2>
          <p className={`${kit.body} ${fp.measure}`}>
            Your free portal follows your tournaments{checkoutOpen && promoActive ? ' — free with no end date' : ''}. Premium is the operations HQ for the whole
            season — roster, lineups, budget, schedule, and documents in one place. Standalone,
            or included with Club when your org joins.
          </p>
          <div className={`${fp.planGrid} ${fp.gridTop}`}>

            {/* ── Coaches Portal plan ────────────────────────────────────── */}
            <div className={`${kit.card} ${kit.cardFeatured} ${kit.stack}`}>
              <div>
                <p className={kit.title}>Premium Coaches Portal</p>
                {checkoutOpen && promoActive ? (
                  <>
                    <div className={fp.priceRow}>
                      <span className={kit.price}>Free</span>
                      <span className={kit.small}>through {FOUNDING_SEASON_END_LABEL}</span>
                    </div>
                    <p className={kit.small}>Normally {formatPriceAmount(PLAN_CONFIG.team.monthlyPrice)}/month or {formatPriceAmount(PLAN_CONFIG.team.annualPrice)}/year · no credit card · standalone, no org required</p>
                    {/* The coach consequence line — the FALLBACK wording until the read-only window
                        after cancellation is built (ratified in principle 2026-09-07). Do not
                        promise "your season stays readable" before that window exists. */}
                    <div className={fp.calloutTop}>
                      <p className={kit.small}>In {FOUNDING_SEASON_DECISION_MONTH_LABEL} you&apos;ll choose a plan for your {FOUNDING_SEASON_NEXT_YEAR_LABEL} season. Nothing is charged before then.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={fp.priceRow}>
                      <span className={kit.price}>{formatPriceAmount(PLAN_CONFIG.team.monthlyPrice)}</span>
                      <span className={kit.small}>/month</span>
                    </div>
                    <p className={kit.small}>{formatPriceAmount(PLAN_CONFIG.team.annualPrice)}/season — save two months · Standalone, no org required</p>
                  </>
                )}
              </div>
              <p>
                {checkoutOpen
                  ? <span className={kit.tag}>Free right now</span>
                  : <span className={kit.tag}>Coming soon</span>}
              </p>
              <p className={kit.body}>
                The operations HQ for one rep team — roster, lineups, budget, documents,
                and schedule — whether or not your organization is on FieldLogicHQ.
              </p>
              <div>
                <p className={kit.subhead}>Included</p>
                <ul className={kit.ticks}>
                  {PORTAL_FEATURES.map(f => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
              <div className={kit.push}>
                {checkoutOpen ? (
                  <Link href={startHref} className={`${kit.btn} ${kit.btnFull}`}>
                    {promoActive ? 'Start free' : 'Start now'}
                  </Link>
                ) : (
                  <EarlyAccessModalTrigger
                    className={`${kit.btn} ${kit.btnFull}`}
                    initialPlanInterest={['coaches_portal']}
                    initialFeaturesInterested={['roster', 'lineups', 'budget', 'team_documents']}
                  >
                    Express interest
                  </EarlyAccessModalTrigger>
                )}
              </div>
            </div>

            {/* ── Org bridge callout ─────────────────────────────────────── */}
            <div className={`${kit.card} ${kit.stack}`}>
              <p className={kit.eyebrow}>When your org joins</p>
              {/* ⚠ Rewritten 2026-08-20. This card used to say the workspace "carries over
                  automatically … without any data transfer or setup" and that "the bill just
                  goes away" — as though the org subscribing to Club were enough on its own.
                  It is not: the coach or the org opens a link, one side requests an ownership
                  transfer, the other accepts, and a FieldLogicHQ operator executes the final
                  move. Everything does travel with it and nothing is re-keyed by hand, so the
                  substance held — but the friction it hid is a SAFEGUARD, and saying so is a
                  better sentence than pretending it isn't there. */}
              <p className={kit.title}>
                Your whole workspace moves with you.
              </p>
              <p className={kit.body}>
                When your organization is on Club, you can hand your team over to them —
                roster, documents, finances and season records travel together, with nothing
                to re-enter. Both sides approve the move first, so your team never changes
                hands without your say-so.
              </p>
              <p className={`${kit.body} ${fp.noteEdge}`}>
                Once it is done, your portal is included in their plan and you stop paying the
                standalone rate.
              </p>
              <p className={kit.body}>
                Until then, everything you need is here. The standalone portal is a complete
                product — not a trial, not a fallback.
              </p>
              {/* Same 2026-08-10 reroute as the cross-sell below: the Club page now carries the
                  proof; the interest form waits there. */}
              <div className={kit.push}>
                <Link href="/for-clubs" className={`${kit.btn} ${kit.btnSecondary} ${kit.btnFull}`}>
                  Is your org considering Club?
                </Link>
              </div>
            </div>

          </div>
          <p className={fp.afterCards}>
            <Link href="/pricing#org-plans" className={`${kit.link} ${kit.linkBlock}`}>
              See every plan and price
            </Link>
          </p>
        </div>
      </section>

      {/* ── Cross-sell ───────────────────────────────────────────────────── */}
      <section className={kit.section}>
        <div className="container">
          <p className={kit.eyebrow}>More from FieldLogicHQ</p>
          <div className={`${kit.grid2} ${fp.gridTop}`}>
            {/* Routes to the Club page, not straight to the interest form (2026-08-10 ruling:
                route to a page when the page has proof — /for-clubs now carries both demo doors;
                express interest waits there). */}
            <Link href="/for-clubs" className={`${kit.card} ${fp.crossCard}`}>
              <span className={kit.eyebrow}>Club</span>
              <span className={kit.title}>Is your organization on FieldLogicHQ yet?</span>
              <span className={kit.body}>
                Club includes the Premium Coaches Portal for your whole coaching staff — every coach,
                every team, no per-team fee — plus tournaments, house league, rep teams, and accounting.
              </span>
              <span className={fp.crossCta}>See what Club includes</span>
            </Link>
            <Link href="/for-tournament-organizers" className={`${kit.card} ${fp.crossCard}`}>
              <span className={kit.eyebrow}>Tournament</span>
              <span className={kit.title}>Running a team tournament?</span>
              <span className={kit.body}>
                Tournament is free to start — you add the teams, then brackets, scheduling, and live
                scores for your round robin, exhibition weekend, or local event. Your club doesn&apos;t
                need to be on FieldLogicHQ.
              </span>
              <span className={fp.crossCta}>See tournament plans</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
      <section className={`${kit.section} ${kit.band} ${kit.center}`}>
        <div className="container">
          <h2 className={kit.heading}>
            Your team,{' '}
            <span className={kit.accent}>properly managed.</span>
          </h2>
          <p className={kit.lead}>
            {checkoutOpen
              ? (promoActive
                ? `Start your Premium Coaches Portal free — free through ${FOUNDING_SEASON_END_LABEL} when you sign up by ${FOUNDING_SEASON_SIGNUP_CLOSE_LABEL}, normally ${formatPriceAmount(PLAN_CONFIG.team.monthlyPrice)}/month. No credit card.`
                : 'Start your Coaches Portal — no credit card required.')
              : 'Express interest in the Coaches Portal to be notified when it opens. No commitment required.'}
          </p>
          <div className={kit.row}>
            {checkoutOpen ? (
              <Link href={startHref} className={kit.btn}>
                Start free
              </Link>
            ) : (
              <EarlyAccessModalTrigger
                className={kit.btn}
                initialPlanInterest={['coaches_portal']}
                initialFeaturesInterested={['roster', 'lineups', 'budget', 'team_documents']}
              >
                Express interest
              </EarlyAccessModalTrigger>
            )}
            {showSandboxDoor && (
              <Link href={SEE_IT_LIVE_COACHES_PATH} className={`${kit.btn} ${kit.btnSecondary} ${kit.live}`}>
                See a coach&apos;s season
              </Link>
            )}
            <Link href="/pricing" className={`${kit.btn} ${kit.btnSecondary}`}>
              See all plans
            </Link>
          </div>
          <div className={fp.afterNote}>
            <p className={kit.small}>All plans are billed in CAD. No contracts. No setup fees.</p>
          </div>
        </div>
      </section>

    </main>
  );
}
