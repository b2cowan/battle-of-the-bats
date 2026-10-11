'use client';
/**
 * A PLAN LOCK AS ONE PLAIN LINE (design decision 2026-09-30, "a plan lock is never a dashed box"; A6
 * "show the plan's name"). The padlock, what the plan adds in a few words, and the plan's name as the
 * kit's chip — no border, no tint — at the 44px floor, the whole line opening Plan & billing on that
 * plan's panel (the `?plan=` door Stage 1 built). First drawn on the tournament composer and the team
 * record (Tournament admin redesign Stage 2); the game-day board's "Running late?" door is the same
 * idea as a door card, because there it replaces a door.
 *
 * No price and no upsell sentence: the chip is the whole pitch, and the panel it opens says the rest.
 *
 * PlanLockedTool is the same lock inside a Tools menu (Stage 3, A44): the tool keeps its own name, the plan's chip
 * beside it, the row opening the plan's panel. The schedule's Tools and Teams' Tools wear it.
 */
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { RepChip } from '@/components/admin/kit/club/RepKit';
import { CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import styles from './PlanLockLine.module.css';

/** Plan & billing with the Tournament Plus panel asked for — the door every Tournament Plus lock line opens. */
export function tournamentPlusPanelHref(orgSlug: string): string {
  return `/${orgSlug}/admin/tournaments/settings/subscription?plan=tournament_plus`;
}

/** A Tools row the plan doesn't include: the padlock, the tool's own name, then the plan's (never a bare padlock). */
export function PlanLockedTool({ name, href, plan = 'Tournament Plus' }: { name: string; href: string; plan?: string }) {
  return (
    <CoachToolbarMenuItem
      icon={<Lock size={16} aria-hidden />}
      label={<span className={styles.tool}>{name} <RepChip>{plan}</RepChip></span>}
      href={href}
    />
  );
}

export default function PlanLockLine({ href, plan, children }: {
  /** Plan & billing with the plan's panel asked for (`…/settings/subscription?plan=tournament_plus`). */
  href: string;
  /** The plan's full name, as the Facts doc spells it ("Tournament Plus"). */
  plan: string;
  /** What the plan adds here, in a few words ("Show under chosen divisions"). */
  children: string;
}) {
  return (
    <Link href={href} className={styles.line} aria-label={`${children} · ${plan}`}>
      <Lock size={13} aria-hidden className={styles.icon} />
      <span className={styles.words}>{children}</span>
      <span className={styles.plan}><RepChip>{plan}</RepChip></span>
    </Link>
  );
}
