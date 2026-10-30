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
 * THE PANEL OPENS WHERE YOU ARE (owner, the free tier walk 2026-10-16): the line stays a link to Plan & billing's panel,
 * and a plain click on it opens that panel over the page instead (`PlanPanelHost`, mounted in the admin layout) — so a
 * lock inside a window holding a draft (the composer) loses nothing. Ctrl/⌘-click still opens Plan & billing in a tab.
 *
 * PlanLockedTool is the same lock inside a Tools menu (Stage 3, A44): the tool keeps its own name, the plan's chip
 * beside it, the row opening the plan's panel. The schedule's Tools and Teams' Tools wear it.
 *
 * THE FOUNDING SEASON LINE (R10, M9 — the free tournament tier, 2026-10-12): an organization still on the free plan
 * with a running Founding Season comp sees "Free for you through September 30, 2027" as a quiet second line under a
 * lock line, in the lock's own grey (the chip and the door do not change). In a Tools menu it is said ONCE, at the
 * menu's foot (`PlanLockMenuFoot`), never under each locked row. The rule is `foundingSeasonLockUntil`.
 */
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { RepChip } from '@/components/admin/kit/club/RepKit';
import { CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import { useFoundingSeasonLock } from '@/lib/use-founding-season-lock';
import { LOCK_WORDS } from '@/lib/invite-only-words';
import { getBillingHref, type BillingUrlOrg } from '@/lib/billing-urls';
import { useOrg } from '@/lib/org-context';
import styles from './PlanLockLine.module.css';

/** Plan & billing with the Tournament Plus panel asked for — the door every Tournament Plus lock line opens. */
export function tournamentPlusPanelHref(org: BillingUrlOrg | string): string {
  const workspace = typeof org === 'string' ? { slug: org, planId: 'tournament' } : org;
  const base = getBillingHref(workspace);
  return `${base}${base.includes('?') ? '&' : '?'}plan=tournament_plus`;
}

/** Locks keep the current workspace's billing host, including a standalone coach's tournament. */
export function useTournamentPlusHref(): string {
  const { currentOrg } = useOrg();
  return tournamentPlusPanelHref(currentOrg ?? 'admin');
}

/** The plan every tournament lock names. */
const TOURNAMENT_PLUS = 'Tournament Plus';

/** A locked row's name: the tool's own name, then the plan's chip (never a bare padlock). Every menu's lock row wears it. */
export function PlanLockName({ name, plan = TOURNAMENT_PLUS }: { name: string; plan?: string }) {
  return <span className={styles.tool}>{name} <RepChip>{plan}</RepChip></span>;
}

/** A Tools row the plan doesn't include: the padlock, the tool's own name, then the plan's. */
export function PlanLockedTool({ name, href, plan = TOURNAMENT_PLUS }: { name: string; href: string; plan?: string }) {
  return <CoachToolbarMenuItem icon={<Lock size={16} aria-hidden />} label={<PlanLockName name={name} plan={plan} />} href={href} />;
}

export default function PlanLockLine({ href, plan = TOURNAMENT_PLUS, children }: {
  /** Plan & billing with the plan's panel asked for (`…/settings/subscription?plan=tournament_plus`). */
  href: string;
  /** The plan's full name, as the Facts doc spells it; Tournament Plus unless said. */
  plan?: string;
  /** What the plan adds here, in a few words ("Show under chosen divisions"). */
  children: string;
}) {
  const until = useFoundingSeasonLock();
  const foundingLine = until ? LOCK_WORDS.foundingLine(until) : null;
  return (
    <Link href={href} className={styles.line} aria-label={`${children} · ${plan}${foundingLine ? ` · ${foundingLine}` : ''}`}>
      <Lock size={13} aria-hidden className={styles.icon} />
      <span className={styles.words}>
        {children}
        {foundingLine && <span className={styles.until}>{foundingLine}</span>}
      </span>
      <span className={styles.plan}><RepChip>{plan}</RepChip></span>
    </Link>
  );
}

/** The Founding Season line, said once at the foot of a Tools menu that holds a locked row (M9). Absent otherwise. */
export function PlanLockMenuFoot() {
  const until = useFoundingSeasonLock();
  if (!until) return null;
  return <p className={styles.menuFoot} role="note">{LOCK_WORDS.foundingMenuFoot(until)}</p>;
}
