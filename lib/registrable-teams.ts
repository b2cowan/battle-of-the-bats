import {
  resolveCoachCapabilities, staffKindLabel, staffKindWord, STAFF_KIND_COPY,
  type AssistantCapabilityGrants, type StaffKind,
} from './coach-capabilities';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHICH TEAMS MAY THIS PERSON REGISTER? — the one computation (owner D1, 2026-10-13).
 *
 * On 2026-10-13 a Premium coach registered for a tournament from a WhatsApp link and ended up with a
 * second, separate team (`docs/projects/active/COACH_REGISTER_EXISTING_TEAM_PLAN.md`): the form
 * offered his portal under the free team's frozen name (F3), and none of his five staff could have
 * seen the team at all (F5) — the picker listed only free teams the account is a MEMBER of, and only
 * the portal's primary owner is a member of the free team underneath a Premium team (its "twin").
 *
 * The owner's ruling: *"who can register a premium team is a permission and default to head coach and
 * team manager."* So a Premium team is offered to everyone on its STAFF, decided by the "Register for
 * tournaments" grant (`registerTournaments`, `lib/coach-capabilities.ts`) and never by twin
 * membership; staff without it see the team LOCKED, with who can register it, so the empty space
 * never reads as "I have to make a new team".
 *
 * ⚠ ONE COMPUTATION, THREE READERS. The register form's team cards, the join page's list and the
 * server's refusal (`findRegistrableTeam`, asked by `/api/register` and the join link before anything
 * is written) all read this function's output for the same person. A screen and a server that decide
 * separately drift; that drift is how a form offers a team the server then refuses.
 *
 * Pure (no database), so the rule is unit-tested without one; `getRegistrableTeamsForUser` in
 * `lib/registrable-teams-server.ts` loads its inputs. Stage 1b adds the second rule a Premium card
 * carries — who the entry's coach is (`pickEntryHeadCoach`).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** One card on the form. Plain JSON — the API hands it to the browser as is. */
export type RegistrableTeam = {
  /** The free team the entry links to. For a Premium team, its twin (the portal reads its tournaments through it). */
  basicCoachTeamId: string;
  /** What the card says: a Premium team's CURRENT portal name (F3), a free team's own name. */
  name: string;
  /** A live Coaches Portal's team: tagged "Coaches Portal" and listed first. */
  isPortalTeam: boolean;
  /**
   * The Premium portal the entry joins (Review says the tournament will show on its Tournaments page).
   * Null for a free team, or a portal that has moved into a club (out of scope, kept as it was). Where
   * the coach LANDS is decided by the free record route, which forwards to the portal's record whenever
   * that record will open for them.
   */
  portal: { orgSlug: string; repTeamId: string } | null;
  /** On the staff without the grant: shown greyed, not choosable, and refused by the server. */
  locked: boolean;
  /** This person on the team, as the card's sub-line says it — "the head coach", "the team manager". Null on a free team. */
  youAre: string | null;
  /** On a locked card: everyone who CAN register it, head coaches first ("head coach", "team manager"). */
  registeredBy: Array<{ name: string; role: string }>;
  /**
   * The team's head coaches, on an OPEN card of a standalone portal only (Stage 1b, C1/C2): the entry's
   * coach comes from here, whoever presses Submit. Empty on a free team, a club-owned portal and a
   * locked card — there the person registering is the coach, as before.
   */
  headCoaches: CardHeadCoach[];
};

/**
 * One head coach on a card. The NAME only, never their email: the card reaches every registrant on the
 * staff, who has no business learning the head coach's address from it (Stage 1's /review). `id` is the
 * staff membership, which the server finds again at Submit.
 */
export type CardHeadCoach = { id: string; name: string | null; isYou: boolean };

/** A free team this person is an active member of (`getBasicCoachTeamsForUser`), oldest first. */
export type FreeTeamMembership = { id: string; name: string; teamWorkspaceId: string | null };

/** One active member of a portal team's staff. */
export type PortalStaffMember = {
  /** The staff membership row — a head coach's id on the card. */
  membershipId: string;
  userId: string;
  /** Their name as the team knows it; null when there is none (never their email — the card names the role instead). */
  name: string | null;
  coachRole: 'head_coach' | 'assistant_coach';
  capabilities: AssistantCapabilityGrants | null;
  staffKind: StaffKind | null;
};

/** A LIVE Coaches Portal this person reaches — on its staff, or a member of a free team that points at it. */
export type LivePortal = {
  workspaceId: string;
  repTeamId: string;
  /** The portal org's slug — the landing after Submit. Null when it could not be read (lands as a free team would). */
  orgSlug: string | null;
  /** The portal team's current name; null when it cannot be read (the twin keeps its own). */
  name: string | null;
  /** The free team the portal points at; null when none is recorded (see the twin rule below). */
  twinId: string | null;
  /**
   * A coach's own portal. FALSE once the team has moved into its club (mig 313 marks the workspace
   * `org_owned`): a club's teams are out of scope for the permission, so that portal's twin is
   * offered exactly as before — to its members, under the portal's name.
   */
  standalone: boolean;
  /** The team's ACTIVE staff — required for a standalone portal this person is on the staff of. */
  staff: readonly PortalStaffMember[];
};

const capsOf = (s: PortalStaffMember) => resolveCoachCapabilities(s.coachRole, s.capabilities);
const holdsGrant = (s: PortalStaffMember) => capsOf(s).registerTournaments;

/** "head coach" / "team manager" / "assistant coach" — the staff list's word, lower case for a sentence. */
const roleWord = (s: PortalStaffMember) => staffKindWord(capsOf(s), s.staffKind).toLowerCase();

/** "the head coach" / "the team manager" / "an assistant coach" — the kind's own phrase. */
function youAreWord(s: PortalStaffMember): string {
  const kind = staffKindLabel(capsOf(s), s.staffKind);
  return kind === 'head' ? 'the head coach' : STAFF_KIND_COPY[kind].asA;
}

/** A card offered by MEMBERSHIP of the free team (a free team, or a club-owned portal's twin): never locked, no staff role. */
const memberCard = (basicCoachTeamId: string, name: string, isPortalTeam: boolean): RegistrableTeam => ({
  basicCoachTeamId, name, isPortalTeam, portal: null, locked: false, youAre: null, registeredBy: [], headCoaches: [],
});

/**
 * The cards, in the order the form shows them: Premium teams this person may register, Premium teams
 * they are on the staff of WITHOUT the grant (locked), then their free teams. Order within each group
 * is the order the inputs arrived in.
 *
 * ⚠ THE TWIN RULE (A4, 2026-10-13, kept). Only the free team the portal ITSELF points at takes the
 * portal's name. Nothing in the schema stops a second free team carrying the same back-link, and
 * renaming both would show two identical rows; a second one is an ordinary free team (own name, no
 * tag) — the honest answer, since the portal reads its tournaments through its twin and an entry filed
 * under the other never reaches it. With no twin recorded, the earliest back-linked team stands in
 * (the one `createWorkspaceShadowBasicCoachTeam` would adopt).
 *
 * ⚠ ON A STANDALONE PORTAL, MEMBERSHIP OF THE TWIN CONFERS NOTHING. The staff permission decides;
 * a member of the twin who is not on the staff (an owner who handed the team over and left it) is
 * not offered the team. The build prompt's line: "this must not depend on twin membership".
 */
export function buildRegistrableTeams(input: {
  userId: string;
  freeTeams: readonly FreeTeamMembership[];
  portals: readonly LivePortal[];
}): RegistrableTeam[] {
  const open: RegistrableTeam[] = [];
  const locked: RegistrableTeam[] = [];
  const free: RegistrableTeam[] = [];
  const offered = new Set<string>();      // basic team ids already on a card
  const twinTaken = new Set<string>();    // workspaces whose twin has been placed

  for (const portal of input.portals) {
    if (!portal.standalone || !portal.twinId || offered.has(portal.twinId)) continue;
    const me = portal.staff.find(s => s.userId === input.userId);
    if (!me) continue;
    offered.add(portal.twinId);
    twinTaken.add(portal.workspaceId);
    const mayRegister = holdsGrant(me);
    const ownName = input.freeTeams.find(t => t.id === portal.twinId)?.name;
    const card: RegistrableTeam = {
      basicCoachTeamId: portal.twinId,
      name: portal.name?.trim() || ownName || 'Your Coaches Portal team',
      isPortalTeam: true,
      portal: portal.orgSlug ? { orgSlug: portal.orgSlug, repTeamId: portal.repTeamId } : null,
      locked: !mayRegister,
      youAre: youAreWord(me),
      registeredBy: mayRegister ? [] : portal.staff
        .filter(holdsGrant)
        .sort((a, b) => (a.coachRole === b.coachRole ? 0 : a.coachRole === 'head_coach' ? -1 : 1))
        .map(s => ({ name: s.name?.trim() ?? '', role: roleWord(s) })),
      headCoaches: !mayRegister ? [] : portal.staff
        .filter(s => s.coachRole === 'head_coach')
        .map(s => ({ id: s.membershipId, name: s.name?.trim() || null, isYou: s.userId === input.userId })),
    };
    (mayRegister ? open : locked).push(card);
  }

  const portalByWorkspace = new Map(input.portals.map(p => [p.workspaceId, p]));
  for (const team of input.freeTeams) {
    if (offered.has(team.id)) continue;
    const portal = team.teamWorkspaceId ? portalByWorkspace.get(team.teamWorkspaceId) : undefined;
    const isTwin = !!portal && !twinTaken.has(portal.workspaceId)
      && (portal.twinId ? portal.twinId === team.id : true);
    if (portal && isTwin) {
      twinTaken.add(portal.workspaceId);
      // A standalone portal's twin is offered only through the staff permission above.
      if (portal.standalone) continue;
      offered.add(team.id);
      open.push(memberCard(team.id, portal.name?.trim() || team.name, true));
      continue;
    }
    offered.add(team.id);
    free.push(memberCard(team.id, team.name, false));
  }

  return [...open, ...locked, ...free];
}

/**
 * THE SERVER'S QUESTION (D1, part 4 of the build): may this person attach an entry to this team?
 * Exactly when the form would have offered it unlocked. `/api/register` asks before it creates the
 * entry; the join link asks before it links one.
 */
export function findRegistrableTeam(
  teams: readonly RegistrableTeam[],
  basicCoachTeamId: string | null | undefined,
): RegistrableTeam | null {
  if (!basicCoachTeamId) return null;
  return teams.find(t => t.basicCoachTeamId === basicCoachTeamId && !t.locked) ?? null;
}

/** The refusal when a team has two or more head coaches and none was chosen — the form says it first. */
export const CHOOSE_HEAD_COACH = 'Choose your team’s head coach.';

/**
 * WHO THE ENTRY'S COACH IS (Stage 1b, owner C1 + C2 2026-10-15). A Premium team's head coach comes from
 * its staff list, whoever presses Submit: the organizer, the public Teams page and every later email
 * name the coach, and C1 sends the organizer's emails to them. With one head coach there is nothing to
 * choose; with two or more (one handing over to the other) the person registering picks (C2), and the
 * server holds them to a current head coach of THAT team. `headCoach: null` = the team has none (a free
 * team, a club-owned portal, a staff list with no head coach): the person registering is the coach.
 * The form and `/api/register` both ask this, so the form cannot reach Review with a pick the server
 * then refuses.
 */
export function pickEntryHeadCoach(
  headCoaches: readonly CardHeadCoach[],
  pickedId: string | null | undefined,
): { ok: true; headCoach: CardHeadCoach | null } | { ok: false; error: string } {
  if (headCoaches.length === 0) return { ok: true, headCoach: null };
  if (headCoaches.length === 1) return { ok: true, headCoach: headCoaches[0] };
  const picked = pickedId ? headCoaches.find(h => h.id === pickedId) : undefined;
  return picked ? { ok: true, headCoach: picked } : { ok: false, error: CHOOSE_HEAD_COACH };
}

/**
 * WHAT THE ENTRY RECORDS (C1), once the head coach is picked and read again at Submit:
 *   coach      — the head coach's name; the registrant's when the registrant IS the head coach and the
 *                portal has no name, or when there is no head coach at all. NULL when nobody has one —
 *                never '' and never an email (the public Teams page prints it).
 *   coachEmail — where the organizer's emails go: the head coach's address when they are someone else.
 *                The registrant's own address stays `teams.email`, the claim key.
 *   headCoachElsewhere — the head coach is not the person registering (the confirmation says where
 *                updates go; the organizer's email says who registered).
 * `identity` null (stepped down since the form loaded), or no readable address for someone else, is
 * refused: recording them would send the organizer's emails to the wrong person — the C1 problem.
 * `addressRefused`: FieldLogicHQ staff are never coaches (the portal's head-coach editor refuses the
 * same address), so their address is not written and the emails stay with the registrant.
 */
export function entryCoachRecord(input: {
  headCoach: CardHeadCoach | null;
  identity: { name: string | null; email: string | null } | null;
  registrantName: string | null;
  registrantEmail: string;
  addressRefused?: boolean;
}): { ok: true; coach: string | null; coachEmail: string | null; headCoachElsewhere: boolean } | { ok: false } {
  const { headCoach, identity, registrantName } = input;
  if (!headCoach) return { ok: true, coach: registrantName, coachEmail: null, headCoachElsewhere: false };
  if (!identity) return { ok: false };
  if (headCoach.isYou) return { ok: true, coach: identity.name ?? registrantName, coachEmail: null, headCoachElsewhere: false };
  if (!identity.email) return { ok: false };
  const coachEmail = identity.email !== input.registrantEmail && !input.addressRefused ? identity.email : null;
  return { ok: true, coach: identity.name, coachEmail, headCoachElsewhere: true };
}

/** "A, B or C" — a short list in prose. */
function orList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

/**
 * The sentence under a locked card: who registers this team, and whom to ask. Names the people
 * rather than a role ("your team manager") because a team may not have one, and never names the
 * switch — that is staff-sheet wording on a public page (/design, 2026-10-13).
 * "Brett Jackson (head coach) or Alex Morgan (team manager) registers this team. Ask Brett if you
 * need to do it yourself."
 */
export function whoRegistersSentence(team: Pick<RegistrableTeam, 'registeredBy'>): string {
  if (team.registeredBy.length === 0) return 'Only the head coach can register this team.';
  // A person whose name could not be read is named by role alone ("your head coach"), capitalized
  // only when it opens the sentence — a name or an email address is shown exactly as it is.
  const who = orList(team.registeredBy.map((p, i) => (p.name ? `${p.name} (${p.role})` : `${i === 0 ? 'Your' : 'your'} ${p.role}`)));
  const head = team.registeredBy.find(p => p.role === 'head coach');
  // An email address is a fine way to name someone in the list, and an odd one to address them by.
  const firstName = head?.name && !head.name.includes('@') ? head.name.split(/\s+/)[0] : null;
  return `${who} registers this team. Ask ${firstName ?? 'your head coach'} if you need to do it yourself.`;
}
