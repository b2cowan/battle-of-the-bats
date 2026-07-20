'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users, CalendarClock, CircleDollarSign, Megaphone, Check, ArrowUpRight, Loader2,
} from 'lucide-react';
import { coachTeamPath } from '@/lib/coaches-portal-routes';
import { isFoundingSeasonPromoActive } from '@/lib/plan-config';
import styles from './CoachExploreCatalog.module.css';

type FeatureKey = 'roster' | 'schedule' | 'fees' | 'announcements';

const FEATURES: Array<{ key: FeatureKey; label: string; desc: string; icon: typeof Users; sub: string }> = [
  { key: 'roster', label: 'Roster', icon: Users, sub: '/roster',
    desc: 'Enter your team once — keep it here and reuse it for your next tournament registration.' },
  { key: 'schedule', label: 'Schedule', icon: CalendarClock, sub: '/schedule',
    desc: 'Your tournament games plus your own practices, in one team calendar.' },
  { key: 'fees', label: 'Fees', icon: CircleDollarSign, sub: '/fees',
    desc: 'Track who has paid their team fees — no spreadsheet.' },
  { key: 'announcements', label: 'Announcements', icon: Megaphone, sub: '/announcements',
    desc: 'Send a note to your whole team at once.' },
];

// What the paid Premium Coaches Portal adds, in the team's own words. Matches the verified
// in-product upsell vocabulary (ScopeShelf / ScopeCeilingInterest) + the approved copy canon —
// do not add features here without updating docs/agents/brand/PRICING_PAGE_COPY.md.
const PREMIUM_FEATURES = [
  'Game lineups',
  'Attendance tracking',
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
  const [busy, setBusy] = useState<FeatureKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function turnOn(feature: FeatureKey, sub: string) {
    if (busy) return;
    setBusy(feature);
    setError(null);
    try {
      const res = await fetch(`/api/coaches/teams/${basicTeamId}/features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature, active: true }),
      });
      const body = (await res.json().catch(() => ({}))) as { activatedFeatures?: string[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Could not turn this on.');
      setActive(new Set(body.activatedFeatures ?? [...active, feature]));
      // Land the coach on the newly-activated section + refresh server state (rail nav).
      router.refresh();
      router.push(`${coachTeamPath(basicTeamId)}${sub}`);
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
        {FEATURES.map(({ key, label, desc, icon: Icon, sub }) => {
          const isOn = active.has(key);
          return (
            <div key={key} className={styles.card}>
              <span className={styles.icon}><Icon size={18} aria-hidden /></span>
              <div className={styles.text}>
                <span className={styles.title}>
                  {label}<span className={styles.free}>Free</span>
                </span>
                <span className={styles.desc}>{desc}</span>
              </div>
              {isOn ? (
                <Link href={`${coachTeamPath(basicTeamId)}${sub}`} className={styles.openBtn}>
                  Open →
                </Link>
              ) : (
                <button
                  type="button"
                  className={styles.turnOn}
                  onClick={() => turnOn(key, sub)}
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
          come straight across, nothing to re-type. Premium adds the tools for running a whole season:
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
