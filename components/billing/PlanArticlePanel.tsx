'use client';
/**
 * A plan's panel — what the plan includes and its Upgrade button, as a drawer from the right. Opened on Plan & billing
 * by its own buttons, and over ANY admin page by a plan lock (`PlanPanelHost`, owner 2026-10-16: an upgrade link never
 * navigates away). It stands on the window floor (`useDialogFloor`), so Escape and the phone's Back close the drawer
 * alone when it is open over a window (the composer), Tab stays inside it and focus goes home to the lock on close.
 */
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { X, CheckCircle } from 'lucide-react';
import { useDialogFloor } from '@/components/coaches/useDialogFloor';
import ViewSwitch from '@/components/coaches/kit/ViewSwitch';
import { COACHES_START_PATH } from '@/lib/coaches-portal-routes';
import { PLAN_ARTICLE_CONTENT } from '@/lib/plan-article-content';
import { PLAN_CONFIG, showsFoundingZero, gatedPlanSentence, FOUNDING_SEASON_END_LABEL } from '@/lib/plan-config';
import { useFoundingOfferOnPlanChoice } from '@/lib/use-founding-season-lock';
import type { PanelPlanKey as PlanKey } from '@/lib/plan-upgrade';
import type { PlanBillingProfile } from '@/lib/plan-billing-profile';
import styles from './PlanArticlePanel.module.css';

interface Props {
  planKey: PlanKey | null;
  billingCycle: 'monthly' | 'annual';
  /** Billing's door: the cycle is chosen here, beside the price it changes, because the Upgrade button below commits it. */
  onBillingCycleChange?: (cycle: 'monthly' | 'annual') => void;
  onClose: () => void;
  onUpgrade: (planKey: PlanKey) => void;
  upgradeLoading: PlanKey | null;
  isComingSoon: boolean;
  canUpgrade?: boolean;
  /** The checkout's own "$0 for this organization's choice" answer, when the host already read it (Plan & billing).
   *  Left out, the panel asks for itself once it opens (the plan drawer a lock line opens). */
  foundingOfferHeld?: boolean;
  /** Unpublished billing targets use their own facts and article variant without adding a public article key. */
  profile?: PlanBillingProfile<string>;
  /** Billing's details door is informational; other shipped callers retain their existing workspace/upgrade door. */
  readOnly?: boolean;
}

export default function PlanArticlePanel({
  planKey,
  billingCycle,
  onBillingCycleChange,
  onClose,
  onUpgrade,
  upgradeLoading,
  isComingSoon,
  canUpgrade = true,
  foundingOfferHeld,
  profile,
  readOnly = false,
}: Props) {
  const open = Boolean(planKey || profile);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const panelRef = useRef<HTMLElement>(null);
  useDialogFloor(open, panelRef, { onClose, busy: planKey !== null && upgradeLoading === planKey });
  const askedHere = useFoundingOfferOnPlanChoice(foundingOfferHeld === undefined && planKey !== null);

  if (!planKey && !profile) return null;

  const article = planKey ? PLAN_ARTICLE_CONTENT[planKey] : null;
  const config = profile?.config ?? PLAN_CONFIG[planKey!];
  // The price shown is the price charged: the window for a newcomer, the checkout's answer for a comp holder.
  const promoActive = (!profile || profile.showFoundingSeason) && planKey !== null && showsFoundingZero(planKey, foundingOfferHeld ?? askedHere);
  const price   =
    promoActive
      ? `Free through ${FOUNDING_SEASON_END_LABEL}`
      : config.monthlyPrice === 0
        ? 'Free'
        : billingCycle === 'annual'
          ? `$${config.annualPrice} CAD / year`
          : `$${config.monthlyPrice} CAD / month`;
  const loadingLabel = promoActive ? 'Applying…' : 'Redirecting…';
  const picksCycle = Boolean(onBillingCycleChange) && !promoActive && !readOnly && canUpgrade && !isComingSoon && config.monthlyPrice > 0;

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      {/* tabIndex -1: the floor seats focus on the panel itself, and only a focusable panel can hold it — without it
          focus stayed on the lock that opened it, and Escape went to the window under the drawer (the composer). */}
      <aside ref={panelRef} tabIndex={-1} className={styles.panel} role="dialog" aria-modal="true" aria-label={`${config.label} plan details`}>

        {/* Header */}
        <div className={styles.panelHeader}>
          <div className={styles.panelHeaderLeft}>
            <p className={styles.panelEyebrow}>{article?.eyebrow ?? config.label}</p>
            <p className={styles.panelHeadline}>{article?.panelHeadline ?? config.label}</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Price strip */}
        <div className={styles.priceStrip}>
          <span className={styles.priceAmount}>{price}</span>
          {picksCycle && <ViewSwitch label="Billing" value={billingCycle} onChange={onBillingCycleChange!}
            views={[{ id: 'monthly', label: 'Monthly' }, { id: 'annual', label: 'Yearly' }]} />}
          {promoActive ? (
            <span className={styles.priceSavings}>
              then ${config.monthlyPrice}/mo · no credit card required
            </span>
          ) : billingCycle === 'annual' && config.monthlyPrice > 0 ? (
            <span className={styles.priceSavings}>
              Save ${config.monthlyPrice * 12 - config.annualPrice} — 2 months free
            </span>
          ) : null}
        </div>

        {/* Scrollable body */}
        <div className={styles.panelBody}>

          {/* Pain section */}
          {article && <section className={styles.section}>
            <p className={styles.sectionEyebrow}>The old way</p>
            <h2 className={styles.sectionHeadline}>{article.painHeadline}</h2>
            <div className={styles.painGrid}>
              {article.painItems.map(item => (
                <div key={item.title} className={styles.painCard}>
                  <p className={styles.painTitle}>{item.title}</p>
                  <p className={styles.painBody}>{item.body}</p>
                </div>
              ))}
            </div>
          </section>}

          {/* Steps / modules */}
          {article && <section className={styles.section}>
            <p className={styles.sectionEyebrow}>How it works</p>
            <h2 className={styles.sectionHeadline}>{article.stepsHeadline}</h2>
            <div className={styles.stepsGrid}>
              {article.steps.map(step => (
                <div key={step.num} className={styles.stepCard}>
                  <span className={styles.stepNum}>{step.num}</span>
                  <p className={styles.stepLabel}>{step.label}</p>
                  <p className={styles.stepTitle}>{step.title}</p>
                  <p className={styles.stepBody}>{step.body}</p>
                </div>
              ))}
            </div>
          </section>}

          {/* Feature list */}
          <section className={styles.section}>
            <p className={styles.sectionEyebrow}>What&apos;s included</p>
            <h2 className={styles.sectionHeadline}>{article?.featuresLabel ?? config.label}</h2>
            <ul className={styles.featureList}>
              {(profile?.included.article ?? article!.features).map(f => (
                <li key={f}>
                  <CheckCircle size={13} className={styles.featureIcon} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </section>

        </div>

        {/* Footer CTA */}
        <div className={styles.panelFooter}>
          {isComingSoon && planKey ? (
            <p className={styles.comingSoonNote}>
              {gatedPlanSentence(planKey)}
            </p>
          ) : planKey === 'team' && !readOnly ? (
            // Its own workspace, not a change to this org's plan — the coach sign-up is the door.
            <Link className={`btn btn-lime btn-data ${styles.upgradeBtn}`} href={COACHES_START_PATH}>
              Start your Coaches Portal
            </Link>
          ) : canUpgrade && planKey && !readOnly ? (
            <button
              className={`btn btn-lime btn-data ${styles.upgradeBtn}`}
              onClick={() => onUpgrade(planKey)}
              disabled={upgradeLoading === planKey}
            >
              {upgradeLoading === planKey ? loadingLabel : promoActive ? `Get ${config.label} free` : `Upgrade to ${config.label}${picksCycle ? ` · ${billingCycle === 'annual' ? `$${config.annualPrice} / year` : `$${config.monthlyPrice} / month`}` : ''}`}
            </button>
          ) : null}
          <button className={`btn btn-ghost ${styles.cancelBtn}`} onClick={onClose}>
            Not right now
          </button>
        </div>

      </aside>
    </>
  );
}
