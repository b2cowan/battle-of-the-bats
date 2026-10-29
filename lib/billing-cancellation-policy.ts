import type { Capability } from './roles';
import type { PlanConfig } from './plan-config';
import { pluralize } from './utils';

/** Shared with server retention and the billing profile; values are unchanged by the presentation migration. */
export const BILLING_RETENTION_DAYS = 90;
/** A full season cycle for a standalone coach (owner, 2026-09-24). */
export const COACHES_PORTAL_RETENTION_DAYS = 365;

export type CancellationKind = 'organization' | 'premium';
export const retentionDaysForKind = (kind: CancellationKind): number =>
  kind === 'premium' ? COACHES_PORTAL_RETENTION_DAYS : BILLING_RETENTION_DAYS;

type ModuleShutdownCopy = { full: string; short: string; shortOrder: number };
const ORGANIZATION_MODULE_SHUTDOWN_COPY: Partial<Record<Capability, ModuleShutdownCopy>> = {
  module_public_site: { full: 'Public organization site', short: 'the public site', shortOrder: 3 },
  module_house_league: { full: 'House league seasons, registration, schedules, and standings', short: 'house league', shortOrder: 4 },
  module_rep_teams: { full: 'Rep teams tryouts, rosters, coach portal, and player documents', short: 'Rep teams and every team’s coach portal', shortOrder: 0 },
  module_accounting: { full: 'Accounting: ledgers, the club budget, allocations to teams', short: 'Accounting', shortOrder: 1 },
  module_families: { full: 'The Families area — household records, the family worklist, and duplicate review', short: 'Families', shortOrder: 2 },
};

export const PREMIUM_COACH_SHUTDOWN_AREAS = [
  'Premium roster, schedule, attendance, lineup, documents, dues, and budget tools',
  'Coach-managed payment reminders and premium team documents',
  'The Premium local tournament slot',
];

/** The same ordered projection the cancellation preflight uses, including enabled add-ons. No DB or Stripe. */
export function organizationShutdownAreas(plan: Pick<PlanConfig, 'moduleEntitlements'> | undefined, enabledAddons: readonly string[] = []): string[] {
  return [
    'Public tournament pages and registration links',
    'Tournament setup, scheduling, communications, and score updates',
    'Member and staff access to tournament workflows',
    ...shutdownModules(plan, enabledAddons).map(([, copy]) => copy.full),
  ];
}

/** The enabled modules (plan entitlements plus add-ons) that have shutdown copy, in the server's order. */
function shutdownModules(plan: Pick<PlanConfig, 'moduleEntitlements'> | undefined, enabledAddons: readonly string[]) {
  const enabled = new Set<string>([...(plan?.moduleEntitlements ?? []), ...enabledAddons]);
  return (Object.entries(ORGANIZATION_MODULE_SHUTDOWN_COPY) as [Capability, ModuleShutdownCopy][]).filter(([cap]) => enabled.has(cap));
}

/** D25: the Club summary is another projection of the SAME selected server areas, with real active-team count. */
export function shortOrganizationShutdownAreas(
  plan: Pick<PlanConfig, 'moduleEntitlements'> | undefined, enabledAddons: readonly string[] = [], activeTeams: number | null = null,
): string[] {
  return [
    ...shutdownModules(plan, enabledAddons)
      .sort(([, a], [, b]) => a.shortOrder - b.shortOrder)
      .map(([cap, copy]) => cap === 'module_rep_teams' && activeTeams !== null
        ? `${copy.short} (${pluralize(activeTeams, 'team')})` : copy.short),
    'tournaments',
  ];
}
