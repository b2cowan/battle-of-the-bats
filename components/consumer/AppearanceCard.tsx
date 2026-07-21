'use client';

/**
 * AppearanceCard — the Account → Appearance control (Theme Toggle Foundation, TH-1/TH-3).
 *
 * Dark / Warm, with a mini swatch preview of each. Selecting one applies it instantly (attribute +
 * device fast-path, no flash) and — when signed in — persists it to the account so it follows the
 * user to every device. Light is deliberately absent (no neutral-light theme exists yet). The card
 * itself lives on the warm Account tab, so it repaints with the chosen theme via the tab dark-gate.
 */

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import {
  applyTheme,
  getEffectiveTheme,
  THEME_CHANGE_EVENT,
  type UserTheme,
} from '@/lib/user-theme';
import styles from './AppearanceCard.module.css';

const OPTIONS: { value: UserTheme; label: string }[] = [
  { value: 'warm', label: 'Warm' },
  { value: 'dark', label: 'Dark' },
];

export default function AppearanceCard({ signedIn }: { signedIn: boolean }) {
  // SSR renders the consumer default (warm); reconcile to the real active theme after mount, and
  // stay in sync if the account reconcile (ConsumerThemeManager) flips it a beat later.
  const [selected, setSelected] = useState<UserTheme>('warm');

  useEffect(() => {
    const sync = () => setSelected(getEffectiveTheme() ?? 'warm');
    sync();
    window.addEventListener(THEME_CHANGE_EVENT, sync);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, sync);
  }, []);

  function choose(theme: UserTheme) {
    if (theme === selected) return;
    setSelected(theme);
    applyTheme(theme); // instant: <html> attribute + device fast-path + change event
    if (signedIn) {
      // Persist to the account (source of truth, cross-device). Local is already applied, so this
      // is fire-and-forget — a failed save just means it won't follow to other devices.
      fetch('/api/account/theme', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      }).catch(() => {});
    }
  }

  return (
    <section className={styles.card} aria-labelledby="appearance-heading">
      <h2 id="appearance-heading" className={styles.heading}>Appearance</h2>
      <div className={styles.options} role="radiogroup" aria-label="App theme">
        {OPTIONS.map((opt) => {
          const active = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              className={`${styles.option} ${active ? styles.optionActive : ''}`}
              onClick={() => choose(opt.value)}
            >
              <span className={`${styles.swatch} ${styles[`swatch_${opt.value}`]}`} aria-hidden>
                <span className={styles.swatchBar} />
                <span className={styles.swatchCard} />
                <span className={styles.swatchAccent} />
              </span>
              <span className={styles.optionRow}>
                <span className={styles.optionLabel}>{opt.label}</span>
                {active && <Check size={16} strokeWidth={2.5} className={styles.check} aria-hidden />}
              </span>
            </button>
          );
        })}
      </div>
      {/* Copy per design_decisions TH-5 (release rule): the picker must NOT promise the coaches
          workspace until its warm coverage ships as one public release. Amended from the round-1
          frame's "…app and coaches workspace" accordingly. */}
      <p className={styles.note}>
        Applies to your FieldLogicHQ app. Tournament pages always show the organizer&rsquo;s colors.
      </p>
    </section>
  );
}
