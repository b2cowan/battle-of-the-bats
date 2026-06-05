'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Info, Lightbulb, AlertTriangle, X } from 'lucide-react';
import styles from './help.module.css';

type Variant = 'info' | 'tip' | 'warning';

interface HelpCalloutProps {
  variant: Variant;
  title: string;
  body: React.ReactNode;
  cta?: { label: string; href: string };
  dismissible?: boolean;
  localStorageKey?: string;
}

const ICONS: Record<Variant, React.ElementType> = {
  info:    Info,
  tip:     Lightbulb,
  warning: AlertTriangle,
};

const VARIANT_CLASS: Record<Variant, string> = {
  info:    styles.calloutInfo,
  tip:     styles.calloutTip,
  warning: styles.calloutWarning,
};

function defaultStorageKey(title: string) {
  return `flhq-help-dismissed-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

export default function HelpCallout({ variant, title, body, cta, dismissible, localStorageKey }: HelpCalloutProps) {
  const [dismissed, setDismissed] = useState(false);

  const resolvedKey = localStorageKey ?? defaultStorageKey(title);

  useEffect(() => {
    if (!dismissible) return;
    if (localStorage.getItem(resolvedKey) === '1') setDismissed(true);
  }, [dismissible, resolvedKey]);

  if (dismissed) return null;

  const Icon = ICONS[variant];
  // Help-guide links open in a new tab so the reader keeps their current work in view.
  const ctaOpensHelpGuide = cta ? /\/help(\/|#|$)/.test(cta.href) : false;

  function handleDismiss() {
    localStorage.setItem(resolvedKey, '1');
    setDismissed(true);
  }

  return (
    <div className={`${styles.callout} ${VARIANT_CLASS[variant]}`}>
      <Icon size={16} className={styles.calloutIcon} />
      <div className={styles.calloutBody}>
        <p className={styles.calloutTitle}>{title}</p>
        <div className={styles.calloutText}>{body}</div>
        {cta && (
          <Link
            href={cta.href}
            className={styles.calloutCta}
            {...(ctaOpensHelpGuide ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            aria-label={ctaOpensHelpGuide ? `${cta.label} (opens in a new tab)` : undefined}
          >
            {cta.label} →
          </Link>
        )}
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          className={styles.calloutDismiss}
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
