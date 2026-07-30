'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, ArrowUpRight, Loader2 } from 'lucide-react';
import type { ActivatableFeature } from '@/lib/basic-coach-teams';
import { activateCoachTeamFeature } from '@/lib/coach-feature-activation';
import { COACH_TEAM_TOOLS, coachTeamToolPath } from '@/lib/coach-team-tools';
import { isFoundingSeasonPromoActive } from '@/lib/plan-config';
import styles from './CoachExploreCatalog.module.css';

/** Explore's own catalog blurb per tool — this page's voice. The tool's NAME, icon and path come
 *  from the shared catalog (lib/coach-team-tools.ts); only the sales copy lives here. */
const DESCRIPTIONS: Record<ActivatableFeature, string> = {
  roster: 'Enter your team once — keep it here and reuse it for your next tournament registration.',
  schedule: 'Your tournament games plus your own practices, in one team calendar.',
  fees: 'Track who has paid their team fees — no spreadsheet.',
  announcements: 'Send a note to your whole team at once.',
};

// What the paid Premium Coaches Portal adds, in the team's own words. Matches the verified
// in-product upsell vocabulary (ScopeShelf / ScopeCeilingInterest) + the approved copy canon —
// do not add features here without updating docs/agents/brand/PRICING_PAGE_COPY.md.
const PREMIUM_FEATURES = [
  'Game lineups',
  'Attendance tracking',
  // B3.4 (◆M1): a free team is ONE person's sign-in — the free model has no assistant-coach
  // concept at all, and this list is the only place in the portal a coach could learn that
  // Premium does. (Relocated here from the plan's Chat placement: the coach's chat is now the
  // app-wide Chat tab, shared with fans and with paying coaches, where an upsell must not go.)
  'Assistant coaches with their own sign-in',
  'Team documents',
  'Dues schedules & automatic reminders',
  'A season budget',
  'Carry your roster into next season',
];

/**
 * The "Explore" catalog — the permanent rediscovery home for the team-scoped Coaches Portal.
 * Explains the coach's free team-ops features in plain language; each is opt-in via "Turn on"
 * (POST /api/coaches/teams/{id}/features), which makes it appear in the rail nav and lands the
 * coach on that section. Already-on features show "On →" and link straight to the section.
 * A quiet premium nudge sits at the bottom. Progressive disclosure: nothing here is forced.
 */
export default function CoachExploreCatalog({
  basicTeamId,
  activatedFeatures,
  checkoutOpen,
}: {
  basicTeamId: string;
  activatedFeatures: string[];
  checkoutOpen: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState<Set<string>>(new Set(activatedFeatures));
  const [busy, setBusy] = useState<ActivatableFeature | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The coach can leave (a card's "Open →", the rail, Back) while a write is in flight; the router
  // outlives this component, so an unguarded push would yank them off the page they chose.
  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; }, []);

  async function turnOn(feature: ActivatableFeature) {
    if (busy) return;
    setBusy(feature);
    setError(null);
    try {
      const next = await activateCoachTeamFeature(basicTeamId, feature, [...active]);
      if (!aliveRef.current) return; // they navigated elsewhere meanwhile — their latest intent wins
      setActive(new Set(next));
      // Clear `busy` before navigating: a stalled navigation must not leave every card disabled
      // behind a spinner that only a reload can clear (the write already succeeded, and the card
      // now honestly reads "Open →").
      setBusy(null);
      // Invalidate this page's cached payload (so returning here doesn't re-offer "Turn on" for a
      // tool that's now on), then land the coach on the newly-activated section.
      router.refresh();
      router.push(coachTeamToolPath(basicTeamId, feature));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not turn this on.');
      setBusy(null);
    }
  }

  // The upgrade CTA follows the same checkout gate as the rest of the portal: real self-serve
  // upgrade when open (dev / post-launch), the public explainer when gated (prod pre-launch).
  const premiumHref = checkoutOpen
    ? `/coaches/start?source=coach_explore&basicTeamId=${encodeURIComponent(basicTeamId)}`
    : '/for-coaches?source=coach_explore';
  const promoActive = isFoundingSeasonPromoActive('team');
  const premiumCtaLabel = checkoutOpen
    ? (promoActive ? 'Upgrade to Premium — free →' : 'Upgrade to Premium →')
    : 'See everything it includes →';

  return (
    <div className={styles.catalog}>
      <p className={styles.intro}>
        Your Coaches Portal isn&apos;t just for this tournament. Turn on what&apos;s useful for your
        team — and ignore what isn&apos;t. These are all free.
      </p>

      <div className={styles.grid}>
        {COACH_TEAM_TOOLS.map(({ key, label, Icon }) => {
          const isOn = active.has(key);
          return (
            <div key={key} className={styles.card}>
              <span className={styles.icon}><Icon size={18} aria-hidden /></span>
              <div className={styles.text}>
                <span className={styles.title}>
                  {label}<span className={styles.free}>Free</span>
                </span>
                <span className={styles.desc}>{DESCRIPTIONS[key]}</span>
              </div>
              {isOn ? (
                <Link href={coachTeamToolPath(basicTeamId, key)} className={styles.openBtn}>
                  Open →
                </Link>
              ) : (
                <button
                  type="button"
                  className={styles.turnOn}
                  onClick={() => turnOn(key)}
                  disabled={busy !== null}
                >
                  {busy === key
                    ? <><Loader2 size={13} className={styles.spin} aria-hidden /> Turning on…</>
                    : <><Check size={13} aria-hidden /> Turn on</>}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      {/* PRIMARY upsell — upgrade THIS team to the paid Premium Coaches Portal. */}
      <section className={styles.premiumBlock} aria-label="Upgrade to the Premium Coaches Portal">
        <div className={styles.premiumHead}>
          <span className={styles.premiumEyebrow}>Premium Coaches Portal</span>
          <h2 className={styles.premiumHeading}>Ready for the full toolkit?</h2>
        </div>
        <p className={styles.premiumBody}>
          Upgrading keeps everything you&apos;ve already entered — your roster, schedule and fees
          come straight across, nothing to re-type. Premium turns this portal into your team&apos;s
          operations HQ, with the tools for running a whole season:
        </p>
        <ul className={styles.premiumFeatures}>
          {PREMIUM_FEATURES.map(feature => (
            <li key={feature} className={styles.premiumFeature}>
              <Check size={13} aria-hidden /> {feature}
            </li>
          ))}
        </ul>
        <div className={styles.premiumFooter}>
          <div className={styles.premiumMeta}>
            <span className={styles.premiumReassure}>Everything above stays free.</span>
            {promoActive ? (
              <span className={styles.premiumPrice}>
                Free until Jan 1, 2027<span className={styles.premiumPriceUnit}> · then $29/mo per team</span>
              </span>
            ) : (
              <span className={styles.premiumPrice}>
                $29<span className={styles.premiumPriceUnit}>/month per team</span>
              </span>
            )}
          </div>
          <Link href={premiumHref} className={styles.premiumCta}>{premiumCtaLabel}</Link>
        </div>
      </section>

      {/* SECONDARY, quieter — the whole-organization (League / Club) pitch. */}
      <Link
        href="/pricing?source=coach_explore"
        className={styles.orgNudge}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span>
          <strong>Running a whole club or league?</strong>{' '}FieldLogicHQ runs the entire
          organization — every team&apos;s rosters and schedules, your accounting, a public website
          for your members, and full tournament management with automated scheduling and brackets.
          <span className={styles.srOnly}> (opens in a new tab)</span>
        </span>
        <ArrowUpRight size={15} aria-hidden />
      </Link>
    </div>
  );
}
