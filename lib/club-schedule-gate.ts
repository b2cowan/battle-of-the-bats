/**
 * WHO BUILDS THE CLUB'S SCHEDULES — one rule (Club Tier Stage 11; Ask 6), read by the server's gate
 * (`resolveScheduler`, which says each refusal in its own words) and by every door to the screens: the Schedules row,
 * a permit's "Hand out this time in a schedule", the club calendar's From link. A door decided anywhere else is a
 * door that can open onto a refusal.
 *
 *   · the plan carries `club_scheduler` (League Plus and both Club bands — the Facts doc);
 *   · an owner or an admin.
 *
 * A door that STARTS a schedule also needs rep teams to hand time to (`module_rep_teams`, which each caller reads from
 * its own access); the server asks that of a write only, so a reader without rep teams can still open what exists.
 * Client-safe: no server imports.
 */
import { hasPlanFeature } from './plan-features';
import type { OrgPlan } from './types';

/** The plan carries the scheduler — the one test a coach's side asks (a coach is never a builder). */
export const clubSchedulerOn = (planId: OrgPlan | null | undefined): boolean => !!planId && hasPlanFeature(planId, 'club_scheduler');

/** The roles that build the club's schedules. */
export const isScheduleBuilder = (role: string | null | undefined): boolean => role === 'owner' || role === 'admin';

/** The plan and the role, together — what every door to the schedules asks. */
export const canOpenClubSchedules = (p: { planId: OrgPlan | null | undefined; role: string | null | undefined }): boolean =>
  clubSchedulerOn(p.planId) && isScheduleBuilder(p.role);
