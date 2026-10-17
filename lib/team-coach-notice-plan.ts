/**
 * lib/team-coach-notice-plan.ts — WHO gets a free coach's notice, and WHAT it says
 * (Free coach header parity, owner rulings 2026-10-13). Pure: no database, no server imports, so the
 * recipient rule and the words are unit-tested (tests/unit/team-coach-notices.test.ts). The server
 * half (lib/team-coach-notices.ts) gathers the facts, hands them here, and inserts what comes back.
 *
 * THE RULES, each an owner ruling or a guard:
 *   · A5 — EVERY active account on the free team linked to the registration gets the notice, not only
 *     the one address the emails go to. A person on two linked teams gets one row per registration.
 *   · GENUINELY FREE TEAMS ONLY. A Premium team's free "shadow" (`team_workspace_id` set — every paid
 *     workspace mints one) is skipped: its coaches read the paid portal, whose club bell never shows
 *     these kinds, so a row there would sit unseen until a later ruling gave it a door (paid coaches
 *     receiving host-club notices is an open question, not ruled).
 *   · The Pause switch silences these too, with no exempt floor (none of these kinds is protected).
 *   · A6 — the host's EMAIL switches (`coach_email_*`, the pause-all) are NOT read here: they govern
 *     email. The writers call this outside those checks.
 *   · A demo ("See it live") club never notifies anyone, exactly as notify() refuses to.
 *   · Nobody is told about their own action (`excludeUserIds`).
 */
import { formatEventDateRange } from './timezone';
import { formatMoney } from './coach-register';
import type { TeamCoachEventType } from './notification-labels';
import { possessive } from './utils';

/** What one notice knows about the registration it is about. */
export interface TeamCoachNoticeContext {
  registrationId: string;
  teamName: string;
  tournamentId: string;
  tournamentName: string;
  /** "Jul 2–4, 2027", or null when the tournament has no dates yet. */
  tournamentDates: string | null;
  /** The host club — the row is filed under it (`notifications.org_id` is NOT NULL). */
  orgId: string;
  clubName: string;
}

export interface TeamCoachNotice {
  title: string;
  body?: string | null;
  link?: string | null;
  metadata?: Record<string, unknown>;
}

/** One `notifications` row, ready to insert. */
export interface TeamCoachNoticeRow {
  org_id: string;
  user_id: string;
  event_type: TeamCoachEventType;
  title: string;
  body: string | null;
  link: string | null;
  metadata: Record<string, unknown>;
}

/** Everything the planner reads, as the server fetched it. */
export interface TeamCoachNoticeFacts {
  registrations: { id: string; name: string | null; tournament_id: string | null }[];
  tournaments: { id: string; name: string | null; org_id: string | null; start_date?: string | null; end_date?: string | null }[];
  clubs: { id: string; name: string | null }[];
  links: { tournament_team_id: string | null; basic_coach_team_id: string | null }[];
  freeTeams: { id: string; team_workspace_id: string | null }[];
  members: { basic_coach_team_id: string | null; user_id: string | null; status: string | null }[];
  /** Who is NOT paused. Null when the lookup failed: deliver to everyone (fail-open, as notify()). */
  unpaused: ReadonlySet<string> | null;
  /** Demo clubs, which never notify anyone. */
  demoOrgIds: ReadonlySet<string>;
}

/** The registration's record in the free portal — where every registration notice opens. */
export function teamCoachRecordLink(registrationId: string): string {
  return `/coaches/tournaments/${registrationId}`;
}

/**
 * The rows to write: one per (registration, person) for every active account on a genuinely free team
 * linked to the registration, minus the paused and the excluded. `compose` writes the words for a
 * registration (null skips it) and is called only when that registration has someone to tell.
 */
export function planTeamCoachNotices(
  facts: TeamCoachNoticeFacts,
  eventType: TeamCoachEventType,
  compose: (ctx: TeamCoachNoticeContext) => TeamCoachNotice | null,
  excludeUserIds: readonly string[] = [],
): TeamCoachNoticeRow[] {
  const tournaments = new Map(facts.tournaments.map(t => [t.id, t]));
  const clubs = new Map(facts.clubs.map(c => [c.id, c]));
  const freeTeamIds = new Set(facts.freeTeams.filter(t => !t.team_workspace_id).map(t => t.id));
  const excluded = new Set(excludeUserIds);

  const teamsByRegistration = new Map<string, Set<string>>();
  for (const link of facts.links) {
    if (!link.tournament_team_id || !link.basic_coach_team_id || !freeTeamIds.has(link.basic_coach_team_id)) continue;
    const set = teamsByRegistration.get(link.tournament_team_id) ?? new Set<string>();
    set.add(link.basic_coach_team_id);
    teamsByRegistration.set(link.tournament_team_id, set);
  }
  const peopleByTeam = new Map<string, Set<string>>();
  for (const m of facts.members) {
    if (m.status !== 'active' || !m.user_id || !m.basic_coach_team_id) continue;
    const set = peopleByTeam.get(m.basic_coach_team_id) ?? new Set<string>();
    set.add(m.user_id);
    peopleByTeam.set(m.basic_coach_team_id, set);
  }

  const rows: TeamCoachNoticeRow[] = [];
  for (const reg of facts.registrations) {
    const tournament = reg.tournament_id ? tournaments.get(reg.tournament_id) : undefined;
    const orgId = tournament?.org_id ?? null;
    if (!tournament || !orgId || facts.demoOrgIds.has(orgId)) continue;

    // Everyone on every free team linked to this registration, once each.
    const people = new Set<string>();
    for (const teamId of teamsByRegistration.get(reg.id) ?? []) {
      for (const userId of peopleByTeam.get(teamId) ?? []) people.add(userId);
    }
    const recipients = [...people].filter(u => !excluded.has(u) && (!facts.unpaused || facts.unpaused.has(u)));
    if (recipients.length === 0) continue;

    const notice = compose({
      registrationId: reg.id,
      teamName: reg.name?.trim() || 'Your team',
      tournamentId: tournament.id,
      tournamentName: tournament.name?.trim() || 'the tournament',
      tournamentDates: formatEventDateRange(tournament.start_date, tournament.end_date, true),
      orgId,
      clubName: clubs.get(orgId)?.name?.trim() || 'The organizer',
    });
    if (!notice) continue;

    for (const userId of recipients) {
      rows.push({
        org_id: orgId,
        user_id: userId,
        event_type: eventType,
        title: notice.title,
        body: notice.body ?? null,
        link: notice.link ?? teamCoachRecordLink(reg.id),
        metadata: { registrationId: reg.id, tournamentId: tournament.id, ...(notice.metadata ?? {}) },
      });
    }
  }
  return rows;
}

/** Does this person hold an active seat on at least one genuinely free team? (A club's invitation, A8.) */
export function holdsFreeTeam(
  members: { basic_coach_team_id: string | null; status: string | null }[],
  freeTeams: { id: string; team_workspace_id: string | null }[],
): boolean {
  const free = new Set(freeTeams.filter(t => !t.team_workspace_id).map(t => t.id));
  return members.some(m => m.status === 'active' && !!m.basic_coach_team_id && free.has(m.basic_coach_team_id));
}

// ── The words (hub screen 3's table, Free coach header parity; reviewed by /marketing 2026-10-13) ──
// Each title says the team's name and, where the club acted, leads with the club. Bodies carry the one
// fact the title leaves out. Every builder is plain text: the bell renders text, never markup.

/** "Riverside U13" → "Riverside U13’s"; "Riverside Reds" → "Riverside Reds’" — the product's one possessive
 *  (`lib/utils.ts`, owner ruling 2026-10-16), passed through for this module's readers. */
export { possessive };

const ANNOUNCEMENT_BODY_MAX = 600;

/** Text cut at the last word before `max`, with an ellipsis — never mid-word. Whitespace runs collapse. */
export function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** "$450.00" — null for a missing or non-positive amount, so a sentence never says "$0.00". */
export function noticeMoney(amount: number | null | undefined): string | null {
  return typeof amount === 'number' && Number.isFinite(amount) && amount > 0 ? formatMoney(amount) : null;
}

export const TEAM_COACH_WORDS = {
  registered: (c: TeamCoachNoticeContext): TeamCoachNotice => ({
    title: `${c.teamName} is registered for ${c.tournamentName}`,
    body: `Sent to ${c.clubName} for review`,
  }),
  waitlisted: (c: TeamCoachNoticeContext): TeamCoachNotice => ({
    title: `${c.teamName} is on the waitlist for ${c.tournamentName}`,
    // Never "they'll let you know if a spot opens": nothing tells the coach when one does (/marketing 2026-10-13).
    body: `Sent to ${c.clubName}`,
  }),
  accepted: (c: TeamCoachNoticeContext): TeamCoachNotice => ({
    title: `${c.clubName} accepted ${c.teamName}`,
    body: [c.tournamentName, c.tournamentDates].filter(Boolean).join(' · '),
  }),
  declined: (c: TeamCoachNoticeContext): TeamCoachNotice => ({
    title: `${c.clubName} declined ${c.teamName}`,
    body: c.tournamentName,
  }),
  paymentRecorded: (c: TeamCoachNoticeContext, amount: number | null | undefined): TeamCoachNotice => {
    const money = noticeMoney(amount);
    return {
      title: money
        ? `${c.clubName} recorded the ${money} fee for ${c.teamName}`
        : `${c.clubName} recorded ${possessive(c.teamName)} fee as paid`,
      body: c.tournamentName,
    };
  },
  /** `due` is the reminder's own sentence ("$450.00 is due Jun 1"), built by the sender from what it emailed. */
  paymentReminder: (c: TeamCoachNoticeContext, due: string): TeamCoachNotice => ({
    title: `${due} for ${c.tournamentName}`,
    body: `${c.clubName} sent a reminder for ${c.teamName}`,
  }),
  schedulePublished: (c: TeamCoachNoticeContext, divisionName: string | null): TeamCoachNotice => ({
    title: divisionName
      ? `The ${divisionName} schedule for ${c.tournamentName} is out`
      : `The schedule for ${c.tournamentName} is out`,
    body: `${c.clubName} · ${c.teamName}`,
  }),
  /** The schedule-change sweep's own message — the push's words, so the bell and the phone never say it two
   *  ways. "Your 10:00 a.m. vs X moved" names the team in the bell ("Ottawa’s 10:00 a.m. vs X moved"): a
   *  coach with two teams in one event must know which. The multi-game title already names it. */
  gameChanged: (c: TeamCoachNoticeContext, message: { title: string; body: string }): TeamCoachNotice => ({
    title: message.title.replace(/^Your /, `${possessive(c.teamName)} `),
    body: message.body,
  }),
  /** The message itself is the body — the bell opens a notice in full, and an email-only announcement has no
   *  other page a coach can read it on. Long ones end at a word, with the rest in the email. */
  announcement: (c: TeamCoachNoticeContext, subject: string, message: string): TeamCoachNotice => ({
    title: `${c.clubName}: ${subject}`,
    body: clip(message, ANNOUNCEMENT_BODY_MAX) || `An announcement for the teams in ${c.tournamentName}`,
  }),
  resultsPosted: (c: TeamCoachNoticeContext): TeamCoachNotice => ({
    title: `Final results for ${c.tournamentName} are posted`,
    body: `${c.clubName} · ${c.teamName}`,
  }),
  invitation: (clubName: string, teamName: string | null): TeamCoachNotice => ({
    title: teamName ? `${clubName} invited you to coach ${teamName}` : `${clubName} invited you to coach one of its teams`,
    body: 'Accept or decline it on Home',
    link: '/discover',
  }),
} as const;

/** The public form's notice (one event kind, two sentences): the waitlist's words when the entry landed on it. */
export function registrationNoticeWords(status: string) {
  return status === 'waitlist' ? TEAM_COACH_WORDS.waitlisted : TEAM_COACH_WORDS.registered;
}
