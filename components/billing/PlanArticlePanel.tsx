'use client';
import { useEffect } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { PLAN_ARTICLE_CONTENT } from '@/lib/plan-article-content';
import { PLAN_CONFIG, isFoundingSeasonActive } from '@/lib/plan-config';
import styles from './PlanArticlePanel.module.css';

type PlanKey = 'tournament_plus' | 'league' | 'club' | 'team';

interface Props {
  planKey: PlanKey | null;
  billingCycle: 'monthly' | 'annual';
  onClose: () => void;
  onUpgrade: (planKey: PlanKey) => void;
  upgradeLoading: PlanKey | null;
  isComingSoon: boolean;
  canUpgrade?: boolean;
}

export default function PlanArticlePanel({
  planKey,
  billingCycle,
  onClose,
  onUpgrade,
  upgradeLoading,
  isComingSoon,
  canUpgrade = true,
}: Props) {
  useEffect(() => {
    if (!planKey) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [planKey]);

  useEffect(() => {
    if (!planKey) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [planKey, onClose]);

  if (!planKey) return null;

  const article = PLAN_ARTICLE_CONTENT[planKey];
  const config  = PLAN_CONFIG[planKey];
  const price   =
    planKey === 'tournament_plus' && isFoundingSeasonActive()
      ? 'Free through Dec 31, 2026'
      : config.monthlyPrice === 0
        ? 'Free'
        : billingCycle === 'annual'
          ? `$${config.annualPrice} CAD / year`
          : `$${config.monthlyPrice} CAD / month`;
  const loadingLabel = planKey === 'tournament_plus' && isFoundingSeasonActive()
    ? 'Applying...'
    : 'Redirecting...';

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <aside className={styles.panel} role="dialog" aria-modal="true" aria-label={`${config.label} plan details`}>

        {/* Header */}
        <div className={styles.panelHeader}>
          <div className={styles.panelHeaderLeft}>
            <p className={styles.panelEyebrow}>{article.eyebrow}</p>
            <p className={styles.panelHeadline}>{article.panelHeadline}</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Price strip */}
        <div className={styles.priceStrip}>
          <span className={styles.priceAmount}>{price}</span>
          {billingCycle === 'annual' && config.monthlyPrice > 0 && (
            <span className={styles.priceSavings}>
              Save ${config.monthlyPrice * 12 - config.annualPrice} — 2 months free
            </span>
          )}
        </div>

        {/* Scrollable body */}
        <div className={styles.panelBody}>

          {/* Pain section */}
          <section className={styles.section}>
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
          </section>

          {/* Steps / modules */}
          <section className={styles.section}>
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
          </section>

          {/* Feature list */}
          <section className={styles.section}>
            <p className={styles.sectionEyebrow}>What&apos;s included</p>
            <h2 className={styles.sectionHeadline}>{article.featuresLabel}</h2>
            <ul className={styles.featureList}>
              {article.features.map(f => (
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
          {isComingSoon ? (
            <p className={styles.comingSoonNote}>
              {config.label} is opening soon — self-serve checkout is not yet available.
            </p>
          ) : canUpgrade ? (
            <button
              className={`btn btn-lime btn-data ${styles.upgradeBtn}`}
              onClick={() => onUpgrade(planKey)}
              disabled={upgradeLoading === planKey}
            >
              {upgradeLoading === planKey ? loadingLabel : `Upgrade to ${config.label}`}
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
