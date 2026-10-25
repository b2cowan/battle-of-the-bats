/**
 * The support console's words for raw values — plain functions and tables with no stylesheet and no database client, so a
 * server route and a client screen read the SAME words (`app/platform-admin/chips.ts` re-exports the first few beside the
 * chip tones, which need the console's CSS). Anything the Story and the record both say lives here once.
 */
import { PLAN_CONFIG } from './plan-config';
import { roleEmailLabel } from './member-access';
import type { OrgPlan } from './types';

/** Sentence case for a raw status/severity word the console shows a person ("open" becomes "Open"). */
export function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** A raw snake_case word as a person reads it: "past_due" becomes "Past due", "owner" becomes "Owner". */
export function humanize(s: string | null | undefined): string {
  return cap((s ?? '').replace(/_/g, ' '));
}

/** A subscription status word as the console prints it. */
export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active:   'Active',
  trialing: 'Trialing',
  past_due: 'Past due',
  canceled: 'Canceled',
};

/** A subscription status as the console prints it: the known four by name, anything else (incomplete, unpaid) humanized. */
export function subscriptionStatusLabel(status: string): string {
  return SUBSCRIPTION_STATUS_LABELS[status] ?? humanize(status);
}

/** A plan's name as the product prints it ("Club · Association"); an unknown key, humanized. */
export function planLabel(planId: string): string {
  return PLAN_CONFIG[planId as OrgPlan]?.label ?? planId.replace(/_/g, ' ');
}

/** A member role inside a sentence, the product's one word for it ("an administrator", "a volunteer"). */
export function aRole(role: string | null | undefined): string {
  const r = role ? roleEmailLabel(role) : 'member';
  return /^[aeiou]/i.test(r) ? `an ${r}` : `a ${r}`;
}

/** 9999 is how a plan stores "no limit" (`lib/plan-config.ts`). */
export const NO_LIMIT = 9999;

/** A tournament or team limit as words: a number, or "no limit". */
export function limitWords(n: number | null | undefined): string {
  return n == null || n >= NO_LIMIT ? 'no limit' : String(n);
}

/** The sections a club can have switched on beyond its plan — the four add-on modules, in the drawn order. */
export const CLUB_SECTIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'module_house_league', label: 'House league' },
  { key: 'module_rep_teams', label: 'Rep teams' },
  { key: 'module_accounting', label: 'Accounting' },
  { key: 'module_public_site', label: 'Public site' },
];

export function sectionLabel(key: string): string {
  return CLUB_SECTIONS.find(s => s.key === key)?.label ?? key.replace(/^module_/, '').replace(/_/g, ' ');
}

/** An override's kind, as the record and the Story both name it. */
export const OVERRIDE_LABELS: Record<string, string> = {
  subscription_status: 'Subscription status',
  comp_period: 'Comp period',
  module_addon: 'Feature access',
  plan_tier: 'Plan tier',
};

/** What an override overrides, in one phrase: "Feature access: House league, Rep teams", "Subscription status: Past due". */
export function overrideWhat(type: string, value: string | null, addons: readonly string[]): string {
  const label = OVERRIDE_LABELS[type] ?? humanize(type);
  if (type === 'module_addon') return `${label}: ${addons.map(sectionLabel).join(', ') || 'sections'}`;
  return value ? `${label}: ${humanize(value)}` : label;
}

/** The Story's kinds, in the Type dropdown's order. */
export const STORY_KINDS = [
  { key: 'staff', label: 'Staff changes' },
  { key: 'billing', label: 'Billing' },
  { key: 'notes', label: 'Notes' },
  { key: 'emails', label: 'Emails' },
  { key: 'people', label: 'People' },
  { key: 'feedback', label: 'Feedback' },
] as const;

export type StoryKind = (typeof STORY_KINDS)[number]['key'];
