import { earliestLastDay, endInstantForLastDay, formatLongDay, formatShortDay, lastDayOfInstant, todayEastern } from './free-time';
import { addCalendarDays, addCalendarMonths, isCalendarDate } from './timezone';
import { possessive } from './utils';

/**
 * Free time on a Coaches Portal (Support console Stage 4b): the rules and words, with no database in them. The reads
 * and writes are in `lib/portal-free-time-server.ts`.
 *
 * A portal given free time is stored ENDED (organization cancelled, billing mode `platform_override`) and held open by
 * a Stage 4 billing-status grant (`org_overrides`, type `subscription_status`) whose end is the last free day; the
 * team's entitlement carries the same end. Nothing runs at the end: every reader asks whether the portal is in force,
 * and the answer changes by itself the moment the grant runs out (owner rulings 2026-10-27, Q1/Q6).
 *
 * ⚠ The end is NEVER a cancel. Free-time code must not import the cancel or retention functions
 * (`tests/unit/support-console-stage4b-guard.test.ts`, T15): a cancel archives tournaments and starts a 365-day
 * retention clock, which is the data-loss path the owner ruled out.
 */

/** The grant type that holds a free-time portal open. */
export const PORTAL_FREE_TIME_GRANT_TYPE = 'subscription_status';

/**
 * How long each role may give, measured from the FIRST give, never from today (Q2/Q5, T11): a change of the end or a
 * later give can never chain past it. Product, Growth and Read only hold no power and are absent.
 */
export const PORTAL_FREE_TIME_CAP: Record<'super_admin' | 'billing' | 'support', { days: number } | { months: number }> = {
  super_admin: { months: 6 },
  billing: { days: 90 },
  support: { days: 90 },
};

/** "90 days" / "6 months". */
export function portalCapWords(role: string): string | null {
  const cap = PORTAL_FREE_TIME_CAP[role as keyof typeof PORTAL_FREE_TIME_CAP];
  if (!cap) return null;
  return 'days' in cap ? `${cap.days} days` : `${cap.months} months`;
}

/** The latest last free day this role may give, from the day free time was first given (today for a first give). */
export function portalLatestLastDay(role: string, firstGiveDay: string): string | null {
  const cap = PORTAL_FREE_TIME_CAP[role as keyof typeof PORTAL_FREE_TIME_CAP];
  if (!cap) return null;
  return 'days' in cap ? addCalendarDays(firstGiveDay, cap.days) : addCalendarMonths(firstGiveDay, cap.months);
}

/**
 * Why a last free day cannot be given to a portal, or null. A bare `YYYY-MM-DD` only (an instant is refused, never
 * parsed, T5). `firstGiveDay` is the Eastern day of the first give, or null for a first give (then today).
 */
export function portalLastDayRefusal(lastDay: unknown, role: string, firstGiveDay: string | null, now: Date = new Date()): string | null {
  if (typeof lastDay !== 'string' || !isCalendarDate(lastDay)) return 'Choose the last free day.';
  const latest = portalLatestLastDay(role, firstGiveDay ?? todayEastern(now));
  if (latest == null) return "Your role can't give free time.";
  if (lastDay < earliestLastDay(now)) return 'The last free day must be after today.';
  if (lastDay > latest) {
    const from = firstGiveDay ? ` from when free time was first given (${formatShortDay(firstGiveDay)})` : '';
    const longer = role === 'super_admin' ? '' : ' Longer needs a Super admin.';
    return `You can give up to ${portalCapWords(role)}${from}, through ${formatLongDay(latest)}.${longer}`;
  }
  return null;
}

/** A giver's gives inside this many days before a Super admin is needed (T2, owner gate ruling (a) 2026-10-27). */
export const PORTAL_GIVES_WINDOW_DAYS = 7;
export const PORTAL_GIVES_BEFORE_SUPER_ADMIN = 5;

/** The sixth give inside seven days needs a Super admin (Stage 3's refund shape). Null when this give may go ahead. */
export function weekLimitRefusal(role: string, givesInWindow: number): string | null {
  if (role === 'super_admin' || givesInWindow < PORTAL_GIVES_BEFORE_SUPER_ADMIN) return null;
  return `You have given free time to ${givesInWindow} Coaches Portals in the last ${PORTAL_GIVES_WINDOW_DAYS} days. A Super admin can give this one.`;
}

/** The coach's cancel, refused while free time runs (Q11-4; words reviewed by /billing and /marketing 2026-10-27). */
export function coachCancelRefusal(lastDay: string): string {
  return `There's nothing to cancel. Your Premium Coaches Portal is free through ${formatLongDay(lastDay)}, then goes back to the free Coaches Portal by itself.`;
}

/** The console's cancel, refused while free time runs: End it now is the way (Q11-4). */
export function staffCancelRefusal(portalName: string, lastDay: string): string {
  return `${portalName} has free time through ${formatShortDay(lastDay)}. End it now from its Access list instead of cancelling.`;
}

/**
 * The last free day of a free time that has ended: the day it was ended early (End it now revokes it), else its own
 * last day. Null while it still runs.
 */
export function endedLastDay(
  grant: { starts_at: string | null; expires_at: string | null; revoked_at: string | null },
  now: Date = new Date(),
): string | null {
  if (grant.revoked_at) return lastDayOfInstant(grant.revoked_at);
  if (grant.expires_at && new Date(grant.expires_at) <= now) return lastDayOfInstant(grant.expires_at);
  return null;
}

/** The Premium portal's wall once free time has ended (copy 8): never "subscription ended". */
export function freeTimeEndedWallWords(lastDay: string): { title: string; text: string; door: string } {
  return {
    title: 'Your free time has ended',
    text: `Your Premium free time ran through ${formatLongDay(lastDay)}. Your team is back on the free Coaches Portal, and everything you made on Premium is saved. It comes back if you choose Premium again.`,
    door: 'Go to your team',
  };
}

/** A bulk action's summary line for the portals it skipped (Q9, T8/T33). */
export function bulkPortalSkipLine(count: number): string | null {
  if (count <= 0) return null;
  return count === 1
    ? 'Skipped 1 Coaches Portal: its plan and free time can only be changed on its own record.'
    : `Skipped ${count} Coaches Portals: their plan and free time can only be changed on each portal's own record.`;
}

// ── The give: who and what, decided from facts the server read (Part 3) ──────────────────────────────────────────

export type Refusal = { ok: false; status: number; error: string };

/** A free team the coach is an active member of, as the give reads it. */
export type FreeTeamFacts = {
  id: string;
  name: string;
  sport: string | null;
  ageGroup: string | null;
  /** Already belongs to a portal, live or cancelled (`basic_coach_teams.team_workspace_id`): never offered. */
  claimed: boolean;
  /** A shadow the product minted for a portal (`source = 'premium_upgrade'`): never offered. */
  shadow: boolean;
};

/** A Premium portal the coach owns, as the give reads it. */
export type CoachPortalFacts = {
  workspaceId: string;
  orgId: string;
  name: string;
  billingMode: string;
  /** The team moved into a club (`workspace_state = 'org_owned'`). */
  movedIntoClub: boolean;
  /** The one question (`lib/portal-in-force.ts`). */
  inForce: boolean;
  /** `team_workspaces.free_time_given_at` (mig 406): staff gave this portal free time. */
  freeTimeGivenAt: string | null;
  /** The last day of a live Founding Season comp on it, or null. */
  foundingLastDay: string | null;
  /** The billing-status grant holding it open right now, or null. */
  runningGrant: { overrideId: string; lastDay: string; expiresAt: string } | null;
  /** The last free day of its newest free time once ended, or null. */
  endedLastDay: string | null;
};

export type PortalGiveFacts = {
  switchOn: boolean;
  /** The signed-in staff member is this person (T1). */
  coachIsGiver: boolean;
  /** This person holds a platform staff account (T34). */
  coachIsStaff: boolean;
  /** A public demo or sandbox account (T28). */
  coachIsDemo: boolean;
  /** The giver belongs to one of this coach's teams or portals, in any role (T1). */
  giverOnTeam: boolean;
  freeTeams: FreeTeamFacts[];
  portals: CoachPortalFacts[];
  /** The giver's portal gives in the last seven days (T2). */
  givesInWindow: number;
};

/** The door's one line where it is absent (drawing A, lines 1–9; the console knows before the click). */
export type PortalGiveBlock = {
  kind: 'switch' | 'own' | 'demo' | 'running' | 'paying' | 'founding' | 'comped' | 'cancelled' | 'club' | 'had_free_time' | 'no_team' | 'week';
  tone: 'red' | 'quiet';
  line: string;
  /** The portal the line is about, when there is one (the tab links to its record). */
  orgId?: string;
};

/** The free teams the window offers: the coach's own, never one a portal already holds, never a shadow. */
export function offerableTeams(facts: Pick<PortalGiveFacts, 'freeTeams'>): FreeTeamFacts[] {
  return facts.freeTeams.filter(t => !t.claimed && !t.shadow);
}

/** "UAT Free Team · Baseball, U13". */
export function freeTeamLabel(team: Pick<FreeTeamFacts, 'name' | 'sport' | 'ageGroup'>): string {
  const sport = team.sport ? team.sport.charAt(0).toUpperCase() + team.sport.slice(1) : null;
  const kind = [sport, team.ageGroup].filter(Boolean).join(', ');
  return kind ? `${team.name} · ${kind}` : team.name;
}

/** The coach's staff-given portal (one per coach, mig 406), or null. */
export function freeTimePortalOf(facts: Pick<PortalGiveFacts, 'portals'>): CoachPortalFacts | null {
  return facts.portals.find(p => p.freeTimeGivenAt) ?? null;
}

const CLUB_BILLED_MODES = new Set(['club_included', 'org_team_addon', 'club_extra_team']);

/** Why one of the coach's portals blocks a give, or null when it does not. */
function portalBlockOf(p: CoachPortalFacts, role: string): PortalGiveBlock | null {
  const at = { tone: 'quiet' as const, orgId: p.orgId };
  if (p.movedIntoClub || CLUB_BILLED_MODES.has(p.billingMode)) {
    return { ...at, kind: 'club', line: "This coach's team is in a club, and the club pays for it. Give the club free time instead." };
  }
  if (p.freeTimeGivenAt && p.billingMode === 'platform_override') {
    if (p.runningGrant) {
      return { ...at, kind: 'running', line: `Their Premium Coaches Portal is free through ${formatLongDay(p.runningGrant.lastDay)}. Change its end from the portal's record.` };
    }
    if (role === 'super_admin') return null; // a later give reuses this portal (Q5)
    const from = formatShortDay(todayEastern(new Date(p.freeTimeGivenAt)));
    const to = p.endedLastDay ? ` to ${formatShortDay(p.endedLastDay)}` : '';
    return { ...at, kind: 'had_free_time', line: `This coach had Premium free from ${from}${to}. A second time needs a Super admin.` };
  }
  if (p.foundingLastDay) {
    return { ...at, kind: 'founding', line: `Their Premium portal is already free through ${formatShortDay(p.foundingLastDay)} under Founding Season. Its end stays as it is.` };
  }
  if (!p.inForce) {
    return { ...at, kind: 'cancelled', line: 'Their Premium portal was cancelled and its kept data is on a retention clock. Reopening it is not free time.' };
  }
  if (p.billingMode === 'platform_override') {
    return { ...at, kind: 'comped', line: 'Their Premium Coaches Portal is already free from FieldLogicHQ. Its end stays as it is.' };
  }
  return { ...at, kind: 'paying', line: 'Their Premium Coaches Portal pays through Stripe. There is nothing to give: they would keep paying while using free time.' };
}

/**
 * Why the door is absent for this giver and this coach (one line), or null when it is there. The tab, the window and
 * the server all ask this one rule. A role without the power never reaches it: the tab has no door for it at all.
 */
export function portalGiveBlockOf(facts: PortalGiveFacts, role: string): PortalGiveBlock | null {
  if (!facts.switchOn) {
    return { kind: 'switch', tone: 'red', line: 'Free time is switched off on this server, so anything given here would do nothing. An engineer can switch it on.' };
  }
  if (facts.coachIsGiver || facts.coachIsStaff) {
    return { kind: 'own', tone: 'red', line: "This is your own account, or a platform staff account, so it can't be given free time. Another staff member can give it to a coach." };
  }
  if (facts.giverOnTeam) {
    return { kind: 'own', tone: 'red', line: "You belong to this coach's team, so you can't give it free time. Another staff member can." };
  }
  if (facts.coachIsDemo) {
    return { kind: 'demo', tone: 'quiet', line: "This is a public demo coach, so it can't be given free time: everyone who opens the demo would see it." };
  }
  // A portal the coach can use now decides before one that has ended, and any portal before a free team.
  const ordered = [...facts.portals].sort((a, b) => Number(b.inForce) - Number(a.inForce));
  for (const p of ordered) {
    const block = portalBlockOf(p, role);
    if (block) return block;
  }
  if (!freeTimePortalOf(facts) && offerableTeams(facts).length === 0) {
    return { kind: 'no_team', tone: 'quiet', line: 'No free team. Free time needs a team to bring across: ask the coach to add theirs first.' };
  }
  const week = weekLimitRefusal(role, facts.givesInWindow);
  if (week) return { kind: 'week', tone: 'quiet', line: week };
  return null;
}

export type PortalGiveRequest = { teamId: unknown; lastDay: unknown; reason: unknown; role: string };

export type PortalGiveDecision =
  | { ok: true; mode: 'first'; team: FreeTeamFacts; lastDay: string; expiresAt: string; reason: string }
  | { ok: true; mode: 'again'; portal: CoachPortalFacts; lastDay: string; expiresAt: string; reason: string };

/** The day free time was first given to this portal, Eastern (the limits' anchor, Q5). */
export function firstGiveDayOf(freeTimeGivenAt: string): string {
  return todayEastern(new Date(freeTimeGivenAt));
}

/**
 * Give or refuse, from facts the server read. Pure: the caller writes ONLY on `ok: true`, so every refusal writes
 * nothing. A first give's team must be one of the coach's own offerable teams (read from their memberships on the
 * server, T23); a later give is the coach's one staff-given portal, never a team from the request.
 */
export function decidePortalGive(req: PortalGiveRequest, facts: PortalGiveFacts, now: Date = new Date()): Refusal | PortalGiveDecision {
  const refuse = (status: number, error: string): Refusal => ({ ok: false, status, error });
  if (portalCapWords(req.role) == null) return refuse(403, "Your role can't give free time.");
  const block = portalGiveBlockOf(facts, req.role);
  if (block) return refuse(block.kind === 'switch' ? 409 : 403, block.line);

  const reason = typeof req.reason === 'string' ? req.reason.trim() : '';
  if (!reason) return refuse(400, "Say why you're giving it.");

  const again = freeTimePortalOf(facts);
  const dayRefusal = portalLastDayRefusal(req.lastDay, req.role, again?.freeTimeGivenAt ? firstGiveDayOf(again.freeTimeGivenAt) : null, now);
  if (dayRefusal) return refuse(400, dayRefusal);
  const lastDay = req.lastDay as string;
  const expiresAt = endInstantForLastDay(lastDay)!;

  if (again) return { ok: true, mode: 'again', portal: again, lastDay, expiresAt, reason };
  const team = offerableTeams(facts).find(t => t.id === req.teamId);
  if (!team) return refuse(400, 'Choose one of their free teams.');
  return { ok: true, mode: 'first', team, lastDay, expiresAt, reason };
}

/** The copy's stored summary, as far as the give's answer reads it. */
export type CopyOutcome = {
  ok?: boolean; pending?: boolean;
  roster?: { migrated?: number; failed?: number };
  schedule?: { migrated?: number; failed?: number };
  fees?: { migrated?: number; failed?: number };
};

/**
 * The give's amber line when the copy fell short (drawing F2), or null when all of it came across. Free time runs
 * either way: nothing is lost (the free team keeps every row), and the portal's "check these" notice has Try again.
 */
export function copyShortfallLine(summary: CopyOutcome | null, teamName: string, coachFirst: string): string | null {
  const tail = `Nothing was lost: everything is still on ${teamName}. ${possessive(coachFirst)} Premium portal shows the "check these" notice with Try again, and the portal’s Story says what was copied.`;
  if (!summary || summary.pending) return `Free time is running, but bringing ${teamName} across did not finish. ${tail}`;
  if (summary.ok) return null;
  const part = (s: { migrated?: number; failed?: number } | undefined, one: string, many: string) =>
    s?.failed ? `${s.failed} of ${(s.migrated ?? 0) + s.failed} ${(s.migrated ?? 0) + s.failed === 1 ? one : many}` : null;
  const parts = [part(summary.roster, 'player', 'players'), part(summary.schedule, 'event', 'events'), part(summary.fees, 'fee', 'fees')].filter(Boolean);
  if (parts.length === 0) return null;
  return `Free time is running, but ${parts.join(', ')} could not be copied. ${tail}`;
}

/** "Frankie" from "Frankie Okafor"; an address stays whole. */
export function firstNameOf(name: string): string {
  return name.includes('@') ? name : name.trim().split(/\s+/)[0] || name;
}

/**
 * Change the running end, or refuse (T11): the same limits, measured from the first give. The anchor comes from the
 * portal's mark, never the request.
 */
export function portalChangeRefusal(req: { lastDay: unknown; reason: unknown; role: string }, firstGiveDay: string, now: Date = new Date()): string | null {
  if (portalCapWords(req.role) == null) return "Your role can't change free time.";
  const reason = typeof req.reason === 'string' ? req.reason.trim() : '';
  if (!reason) return "Say why you're changing it.";
  return portalLastDayRefusal(req.lastDay, req.role, firstGiveDay, now);
}
