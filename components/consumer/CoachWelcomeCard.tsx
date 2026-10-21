import type { ReactNode } from 'react';
import Link from 'next/link';
import { Check, Clock, Search } from 'lucide-react';
import { StartColumn, accountForm } from '@/components/auth/AccountForm';
import {
  FOUNDING_SEASON_END_LABEL, FOUNDING_SEASON_FIRST_CHARGE_LABEL, FOUNDING_SEASON_DECISION_MONTH_NAME, FOUNDING_SEASON_NEXT_YEAR_LABEL,
} from '@/lib/plan-config';
import styles from './CoachWelcomeCard.module.css';

/**
 * THE COACH WELCOME CARD (The first look, Stage 3b — Ask 5b, F06, F17; gate G1–G2 ruled 2026-10-20, drawn at
 * https://claude.ai/artifact/CtzAZMhmvnJZQxMTtn5xjj). One card, built once, for every moment between paying for Coach
 * Premium and the portal: the welcome (`/coaches/welcome`, the Founding Season path) and checkout complete
 * (`/coaches/checkout/complete`: setting up, still setting up, can't find that payment, and ready — which IS the
 * welcome). The start column on the warm paper, in the app's own frame (rule 1): a round well, the display heading, one
 * sub line, one lime. Never a card frame around it.
 */
const ICONS = { check: Check, clock: Clock, search: Search } as const;

export function CoachWelcomeCard({ icon, quiet = false, title, sub, children }: {
  /** The well's mark; none for the setting-up card, whose loading line is the only motion on the page. */
  icon?: keyof typeof ICONS;
  /** The ink-soft well, for "We can't find that payment" (amber is only ever a notice's edge). */
  quiet?: boolean;
  title: ReactNode;
  sub?: ReactNode;
  /** The way forward: one lime, or the loading line. */
  children?: ReactNode;
}) {
  const Icon = icon ? ICONS[icon] : null;
  return (
    <StartColumn>
      <div className={Icon ? styles.card : styles.cardBare}>
        {Icon && (
          <div className={quiet ? styles.wellQuiet : styles.well} aria-hidden>
            <Icon size={26} strokeWidth={2.5} />
          </div>
        )}
        <h1 className={accountForm.title}>{title}</h1>
        {sub && <p className={accountForm.sub}>{sub}</p>}
        {children && <div className={styles.action}>{children}</div>}
      </div>
    </StartColumn>
  );
}

/** The setting-up card's line (G2): the loading line's dot and a sentence, read out as it appears. */
export function WaitLine({ children }: { children: ReactNode }) {
  return <p className={styles.wait} role="status">{children}</p>;
}

/**
 * "Premium is on for {team}" (G1). The dates sentence shows ONLY when the workspace holds the Founding comp, read from
 * its record by the caller (`workspaceHoldsFoundingComp`); a paid coach gets no second sentence: the receipt and the
 * welcome email carry the price, and this card is the doorway, not the bill. "Open your team" (no arrow) goes to the
 * portal, which forwards its `?success=1` to the team landing.
 */
export function PremiumWelcome({ team, href, foundingComp }: { team: string; href: string; foundingComp: boolean }) {
  return (
    <CoachWelcomeCard
      icon="check"
      title={`Premium is on${team ? ` for ${team}` : ''}`}
      sub={foundingComp
        ? `Free through ${FOUNDING_SEASON_END_LABEL}. Nothing is charged before ${FOUNDING_SEASON_FIRST_CHARGE_LABEL}; in ${FOUNDING_SEASON_DECISION_MONTH_NAME} you'll choose a plan for ${FOUNDING_SEASON_NEXT_YEAR_LABEL}.`
        : undefined}
    >
      <Link href={href} className={accountForm.primary}>Open your team</Link>
    </CoachWelcomeCard>
  );
}
