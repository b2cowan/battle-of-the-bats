/**
 * WHO A TOURNAMENT ANNOUNCEMENT EMAIL REACHES — one rule, and every reader reads it
 * (Tournament admin redesign Stage 2, Part 0 — F42; owner ruling A15 2026-09-30, "fix now, as a defect").
 *
 * The composer said "All accepted teams · 18" while the send read EVERY team in the tournament with
 * no status filter — 22 addresses on the test event, including the team the organizer rejected, a
 * waitlisted team and two still waiting for a decision — and the email's record then listed only the
 * accepted 18. Three readers, three rules. Now there is one:
 *
 *   - the SEND (`app/api/admin/communications` → `resolveRecipients`) sends to exactly this list;
 *   - the RECORD is this same list, written down by the send (`announcements.email_recipients`,
 *     mig 314) — never rebuilt from today's teams when it is opened;
 *   - the free plan's per-send cap counts this list;
 *   - the composer's live count (Part 3) is a dry run of this list through the same route.
 *
 * ⚠ The DEFAULT is the accepted teams. With no targeting — or targeting that names no status and no
 * team — nobody else is emailed. Reaching a waitlisted, pending or rejected team takes an explicit
 * choice, and choosing anything but "the accepted teams" is targeting (Tournament Plus): the plan's
 * basic send is the composer's own words, "every accepted team".
 *
 * Plain functions over plain rows (no Supabase, no React), so the unit suite can hold the rule.
 */
import { resolveCoachRecipient } from './coach-email-rules';

/** The composer's targeting, as the route stores it in `announcements.email_targeting`. */
export type RecipientTargeting = {
  includeTeams?: boolean;
  /** Dead key — the contacts table is gone (DATA_DICTIONARY announcements gotcha 4). */
  includeContacts?: boolean;
  teamStatuses?: string[];
  paymentStatuses?: string[];
  divisionIds?: string[];
  teamIds?: string[];
  /** Dead key, as includeContacts. */
  contactRoles?: string[];
};

/** A team row as the send reads it. */
export type RecipientTeamRow = {
  id: string;
  name: string | null;
  email: string | null;
  coach_email: string | null;
  status: string | null;
  payment_status: string | null;
  division_id: string | null;
};

/** One address the send reaches, and the team(s) it stands for — the stored shape (mig 314). */
export type AnnouncementRecipient = {
  email: string;
  teams: Array<{ id: string; name: string }>;
};

/** Who an untargeted email reaches: the accepted teams, as the composer says. */
export const DEFAULT_RECIPIENT_STATUSES: readonly string[] = ['accepted'];

function stringSet(value: unknown): Set<string> {
  return new Set(Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);
}

/**
 * The addresses an announcement email goes to, in team order, one element per address (two teams
 * sharing a coach's address are one email, and the record names both teams).
 */
export function selectAnnouncementRecipients(
  teams: readonly RecipientTeamRow[],
  targeting: RecipientTargeting | null,
): AnnouncementRecipient[] {
  if (targeting && targeting.includeTeams === false) return [];

  const teamIds = stringSet(targeting?.teamIds);
  const named = stringSet(targeting?.teamStatuses);
  const statuses = named.size > 0 ? named : new Set(DEFAULT_RECIPIENT_STATUSES);
  const paymentStatuses = stringSet(targeting?.paymentStatuses);
  const divisionIds = stringSet(targeting?.divisionIds);

  const byEmail = new Map<string, AnnouncementRecipient>();
  for (const team of teams) {
    const chosen = teamIds.size > 0
      ? teamIds.has(team.id)
      : statuses.has(team.status ?? '')
        && (paymentStatuses.size === 0 || paymentStatuses.has(team.payment_status ?? 'pending'))
        && (divisionIds.size === 0 || divisionIds.has(team.division_id ?? ''));
    if (!chosen) continue;
    // Honour an assigned head-coach contact (teams.coach_email) over the registration email —
    // every automatic coach email does, so a reassigned coach gets the announcement.
    const email = resolveCoachRecipient({ coach_email: team.coach_email, email: team.email });
    if (!email) continue;
    const entry = byEmail.get(email) ?? { email, teams: [] };
    entry.teams.push({ id: team.id, name: team.name ?? '' });
    byEmail.set(email, entry);
  }
  return [...byEmail.values()];
}

/**
 * Whether a send is TARGETED (Tournament Plus — `targeted_tournament_announcements`). The basic send
 * is the default audience: no targeting, or targeting that names only the accepted teams. Anything
 * else — another status, a division, a payment state, chosen teams — is targeting.
 */
export function usesAdvancedTargeting(targeting: RecipientTargeting | null): boolean {
  if (!targeting) return false;
  const statuses = stringSet(targeting.teamStatuses);
  const defaultStatuses = statuses.size === 0
    || (statuses.size === DEFAULT_RECIPIENT_STATUSES.length && DEFAULT_RECIPIENT_STATUSES.every(s => statuses.has(s)));
  return Boolean(
    targeting.includeContacts ||
    stringSet(targeting.divisionIds).size > 0 ||
    stringSet(targeting.teamIds).size > 0 ||
    stringSet(targeting.contactRoles).size > 0 ||
    stringSet(targeting.paymentStatuses).size > 0 ||
    !defaultStatuses,
  );
}

/** Read the stored list back (a jsonb column: anything that is not the shape is "not kept"). */
export function readStoredRecipients(value: unknown): AnnouncementRecipient[] | null {
  if (!Array.isArray(value)) return null;
  const out: AnnouncementRecipient[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const email = (item as { email?: unknown }).email;
    if (typeof email !== 'string' || !email) continue;
    const rawTeams = (item as { teams?: unknown }).teams;
    const teams = Array.isArray(rawTeams)
      ? rawTeams.flatMap(t => (t && typeof t === 'object' && typeof (t as { id?: unknown }).id === 'string')
        ? [{ id: (t as { id: string }).id, name: String((t as { name?: unknown }).name ?? '') }]
        : [])
      : [];
    out.push({ email, teams });
  }
  return out;
}
