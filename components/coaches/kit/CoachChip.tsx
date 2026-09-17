import clsx from 'clsx';
import type { ReactNode } from 'react';
import kit from './CoachKit.module.css';

/**
 * A state chip beside a card's eyebrow: "2 overdue" · "on plan" · "all clear". `--type-token` — it
 * is recognised, not read. ⚠ Colour never carries the verdict alone (deutan ruling): a danger chip
 * carries a word or an icon the caller passes as children.
 */
export default function CoachChip({ tone, children }: { tone: 'danger' | 'warn' | 'good'; children: ReactNode }) {
  return <span className={clsx(kit.chip, tone === 'danger' ? kit.chipDanger : tone === 'warn' ? kit.chipWarn : kit.chipGood)}>{children}</span>;
}
