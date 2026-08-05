/**
 * Assistant Coaches — per-assistant capability model (Phase 1).
 *
 * A team's coaching staff is a head coach plus zero or more assistant coaches
 * (`rep_team_coaches.coach_role`). A HEAD coach always has full access. An ASSISTANT
 * coach starts from a least-privilege default and the head coach grants additional
 * areas per assistant (stored in `rep_team_coaches.capabilities`, wired in Phase 2).
 *
 * Every paid coach API route resolves the caller's effective capabilities and gates
 * its actions here. RLS is NOT the enforcement layer for the coach portal (all reads
 * and writes go through service-role); these app-layer checks are the only gate.
 *
 * Locked owner decisions (2026-06-25): per-assistant area toggles; least-privilege
 * defaults; team money is three-state (off/read/write); guardian PII + internal notes
 * off by default; documents view-only by default; announcements draft-only by default.
 *
 * NOTE: this module intentionally does NOT import `next/server` so it stays safe to import
 * anywhere (its type is referenced through the client coaching context). `denyUnless` returns a
 * standard web `Response` (which App Router route handlers accept, and `NextResponse` extends).
 */
export type MoneyAccess = 'off' | 'read' | 'write';
export type DocsAccess = 'off' | 'view' | 'manage';
export type RosterAccess = 'off' | 'view';

/**
 * Per-assistant capability overrides stored in `rep_team_coaches.capabilities` (jsonb).
 * All optional; an unset key falls back to the assistant least-privilege default.
 * Completely ignored for head coaches (who always receive full access).
 */
export interface AssistantCapabilityGrants {
  schedule?: boolean;            // SEE the schedule + a practice plan
  scheduleManage?: boolean;      // create / edit / delete events, import, share (see the split below)
  attendance?: boolean;          // record attendance
  lineups?: boolean;             // build game lineups + templates
  roster?: RosterAccess;         // basics (names/jersey/position) visibility
  rosterPii?: boolean;           // guardian contacts, player DOB, medical, emergency
  notes?: boolean;               // player notes + admin/internal notes
  money?: MoneyAccess;           // budget / dues / expenses / accounting
  documents?: DocsAccess;        // team + player documents
  announcementsSend?: boolean;   // send guardian announcements (else draft-only)
  tryouts?: boolean;             // tryout candidates + decisions (guardian PII, roster-building)
  staffChat?: boolean;           // a seat in the team's staff chat room (see the note below)
  planPlayerNames?: boolean;     // names on a PRACTICE PLAN without team-wide roster access
}

/**
 * Fully-resolved capabilities for one coach on one team.
 *
 * ── The three grants added for HELPERS (Practice Plans Phase 4, 2026-08-03) ──────────────────
 * A "Helper" is a non-coach adult — a parent volunteer, an outside instructor — invited to run a
 * station at one practice. The owner ruling (`BUSINESS_DECISIONS.md`, 2026-08-03) is that a Helper
 * is a **named PRESET of these grants and never a third `coach_role`**, so that "what can this
 * person see?" keeps exactly one answer in one place. Three additive grants make that true, because
 * verification found it was NOT true as originally planned:
 *
 *   1. `scheduleManage` — `schedule` was ONE switch covering *see the schedule* and *create / edit /
 *      delete events*. The preset "schedule visibility on, all writes off" was therefore not
 *      expressible: a helper would have been able to delete a game. Defaults TRUE for assistants, so
 *      every existing coach keeps both halves and nobody's access changes.
 *   2. `staffChat` — team staff-chat membership is DERIVED from the staff assignment and was
 *      documented as explicitly not a capability toggle, so a parent volunteer would have been
 *      auto-seated in the room where coaches discuss children. Defaults TRUE for the same reason.
 *   3. `planPlayerNames` — the owner ruled a helper sees full roster basics **on the plan**. Doing
 *      that by granting `roster: 'view'` would also have opened the roster page, the development
 *      board and Insights, because every record surface reads that one grant. This grant instead
 *      lets the practice-plan surfaces show names while `roster` stays OFF, so the rest of the
 *      portal **fails closed with no new gate anywhere**. Defaults FALSE — it grants nothing to an
 *      existing coach, whose names still come from `roster` exactly as before.
 *
 * ⚠ None of the three is a role. `resolveCoachCapabilities` and `isCoachNavItemVisible` learn no new
 * vocabulary about *who* someone is — only about what a bundle allows.
 */
export interface CoachCapabilities {
  isHeadCoach: boolean;
  schedule: boolean;             // SEE the schedule + a practice plan
  scheduleManage: boolean;       // create / edit / delete events, import, share
  attendance: boolean;
  lineups: boolean;
  roster: RosterAccess;          // basics visibility
  rosterWrite: boolean;          // add/edit/reorder/deactivate players + profile — head only in V1
  rosterPii: boolean;            // guardian contacts, DOB, medical, emergency
  notes: boolean;                // notes + admin_notes
  money: MoneyAccess;
  documents: DocsAccess;
  announcementsSend: boolean;    // else draft-only (Phase 2 surfaces the draft flow)
  tryouts: boolean;              // head only in V1
  staffChat: boolean;            // a seat in the team's staff chat room
  planPlayerNames: boolean;      // names on a practice plan without team-wide roster access
}

/** The least-privilege bundle a freshly-invited assistant gets before any grant. */
export const ASSISTANT_DEFAULTS: Readonly<CoachCapabilities> = {
  isHeadCoach: false,
  schedule: true,
  // TRUE by default: `schedule` used to mean both halves, and every assistant already invited holds
  // it. Defaulting this to false would silently take event editing away from every existing coach.
  scheduleManage: true,
  attendance: true,
  lineups: true,
  roster: 'view',
  rosterWrite: false,
  rosterPii: false,
  notes: false,
  money: 'off',
  documents: 'view',
  announcementsSend: false,
  tryouts: false,
  // TRUE by default for the same reason — an assistant coach is staff, and staff chat has never been
  // something a head coach had to switch on.
  staffChat: true,
  // FALSE by default, and deliberately so: an assistant's names come from `roster`, exactly as they
  // always have. This grant exists only to let a bundle show names on a plan while `roster` is off.
  planPlayerNames: false,
};

/** A head coach's full-access bundle. */
const HEAD_COACH_ALL: Readonly<CoachCapabilities> = {
  isHeadCoach: true,
  schedule: true,
  scheduleManage: true,
  attendance: true,
  lineups: true,
  roster: 'view',
  rosterWrite: true,
  rosterPii: true,
  notes: true,
  money: 'write',
  documents: 'manage',
  announcementsSend: true,
  tryouts: true,
  staffChat: true,
  planPlayerNames: true,
};

/**
 * THE HELPER PRESET (Phase 4) — a named bundle of the grants above, nothing more.
 *
 * What it hands over: the schedule, read-only · a practice plan · the names, numbers and positions
 * of the players at their station. What it withholds: every write, the staff chat room, coaching
 * notes, guardian contacts, attendance, lineups, documents, money, tryouts, and — because `roster`
 * stays OFF — the roster page, the development board and Insights.
 *
 * ⚠ Stored as ordinary per-assistant grants on an `assistant_coach` row. There is no helper column,
 * no helper role, and no migration. If a future change needs one, the preset has become a role and
 * the ruling that authorised this phase no longer covers it.
 */
export const HELPER_PRESET: Readonly<AssistantCapabilityGrants> = {
  schedule: true,
  scheduleManage: false,
  attendance: false,
  lineups: false,
  roster: 'off',
  rosterPii: false,
  notes: false,
  money: 'off',
  documents: 'off',
  announcementsSend: false,
  tryouts: false,
  staffChat: false,
  planPlayerNames: true,
};

/**
 * DISPLAY ONLY — which word describes this bundle on a staff list ("Helper" vs "Assistant").
 *
 * ⚠ **NEVER gate anything on this.** It reads a bundle and returns a label; it does not decide
 * access, and no route may call it. Access decisions go through the predicates below, one grant at a
 * time, which is the whole reason a Helper is a preset instead of a role. A head coach who hand-edits
 * a helper's grants simply stops seeing the "Helper" word — nothing about their access changes,
 * because the word was never what governed it.
 */
export function staffKindLabel(c: CoachCapabilities): 'head' | 'assistant' | 'helper' {
  if (c.isHeadCoach) return 'head';
  const looksLikeHelper =
    c.schedule && !c.scheduleManage && !c.staffChat && c.planPlayerNames
    && c.roster === 'off' && !c.attendance && !c.lineups && !c.notes && !c.rosterPii
    && !c.tryouts && !c.announcementsSend && c.money === 'off' && c.documents === 'off';
  return looksLikeHelper ? 'helper' : 'assistant';
}

/**
 * Resolve a coach's effective capabilities from their role + stored per-assistant grants.
 * Head coaches always get full access (grants ignored). Assistants merge grants over the
 * least-privilege defaults. `rosterWrite` is never granted to an assistant in V1 (the locked
 * roster option is View/Off only) — the head coach owns roster edits.
 */
export function resolveCoachCapabilities(
  coachRole: 'head_coach' | 'assistant_coach',
  grants?: AssistantCapabilityGrants | null,
): CoachCapabilities {
  if (coachRole === 'head_coach') return { ...HEAD_COACH_ALL };
  const g = grants ?? {};
  return {
    isHeadCoach: false,
    schedule: g.schedule ?? ASSISTANT_DEFAULTS.schedule,
    /**
     * ⚠ Falls back to `schedule`, not to the default, for grants stored BEFORE the split existed.
     * Every assistant invited before 2026-08-03 has `{schedule: true}` and no `scheduleManage` key,
     * and they have been managing events all season — resolving that to "view only" would take a
     * capability away from a live team the first time this code deployed. A helper's bundle writes
     * `scheduleManage: false` explicitly, so it is never the one falling back.
     */
    scheduleManage: g.scheduleManage ?? g.schedule ?? ASSISTANT_DEFAULTS.scheduleManage,
    attendance: g.attendance ?? ASSISTANT_DEFAULTS.attendance,
    lineups: g.lineups ?? ASSISTANT_DEFAULTS.lineups,
    roster: g.roster ?? ASSISTANT_DEFAULTS.roster,
    rosterWrite: false,
    rosterPii: g.rosterPii ?? ASSISTANT_DEFAULTS.rosterPii,
    notes: g.notes ?? ASSISTANT_DEFAULTS.notes,
    money: g.money ?? ASSISTANT_DEFAULTS.money,
    documents: g.documents ?? ASSISTANT_DEFAULTS.documents,
    announcementsSend: g.announcementsSend ?? ASSISTANT_DEFAULTS.announcementsSend,
    tryouts: g.tryouts ?? ASSISTANT_DEFAULTS.tryouts,
    staffChat: g.staffChat ?? ASSISTANT_DEFAULTS.staffChat,
    planPlayerNames: g.planPlayerNames ?? ASSISTANT_DEFAULTS.planPlayerNames,
  };
}

// ── Predicates ───────────────────────────────────────────────────────────────
export const canViewMoney = (c: CoachCapabilities) => c.money !== 'off';

/**
 * WI-5 (security): the single source of truth for "must this caller's team-money be redacted on
 * this team?". Fails CLOSED — no matching assignment ⇒ redacted (a resolver miss must never leak
 * fees). Takes the caller's already-resolved coaching assignments (from `getCoachingAssignmentsForUser`,
 * which keys the whole portal) so this stays a pure predicate with no DB import. Both server-side fee
 * gates (the Premium tournament record + the tournament-history API) call this so they can't diverge.
 */
export function isMoneyRedactedForTeam(
  assignments: ReadonlyArray<{ teamId: string; capabilities: CoachCapabilities }>,
  teamId: string,
): boolean {
  const assignment = assignments.find((a) => a.teamId === teamId);
  return !assignment || !canViewMoney(assignment.capabilities);
}
export const canWriteMoney = (c: CoachCapabilities) => c.money === 'write';
/** TEAM-level blank forms (`rep_document_templates`) — no `player_id`, nothing personal in them. */
export const canViewDocuments = (c: CoachCapabilities) => c.documents !== 'off';
export const canManageDocuments = (c: CoachCapabilities) => c.documents === 'manage';

/**
 * PER-PLAYER completed forms (`rep_player_documents` — waiver / medical consent / code of conduct),
 * which require BOTH `documents` AND `rosterPii`.
 *
 * `documents` alone was the gate until 2026-07-31, and it defeated the redaction on the very screen
 * that performs it: a default assistant saw guardian email/phone/DOB/medical notes blanked out by
 * `redactRosterPlayer`, and directly beneath them that same child's "Medical Consent" PDF listed by
 * filename with a working Download button. The file contents ARE the guardian details and medical
 * history the redaction exists to hide — so hiding the field while handing over the document was
 * one gate contradicting the other.
 *
 * Requiring both makes both locked owner decisions true at once — "documents view-only by default"
 * (2026-06-25) AND "guardian PII off by default" — with no migration and no fourth grant for a head
 * coach to reason about. A dedicated capability was considered and rejected on that cost.
 *
 * Head coaches are unaffected: `HEAD_COACH_ALL` sets `rosterPii: true`, so this is a strict no-op
 * for them. Org admins never reach these predicates (they use the /api/admin/rep-teams routes).
 */
export const canViewPlayerDocuments = (c: CoachCapabilities) => canViewDocuments(c) && c.rosterPii;
export const canManagePlayerDocuments = (c: CoachCapabilities) => canManageDocuments(c) && c.rosterPii;
export const canViewRoster = (c: CoachCapabilities) => c.roster !== 'off';
// Player Awards (Phase 2): "roster/schedule access" per the locked scope — either surface
// already implies enough context to know the players and games awards attach to.
export const canManageAwards = (c: CoachCapabilities) => c.schedule || c.roster !== 'off';
// Player Development (Phase 3, D1): goals are coach-judgment content about a minor — same
// sensitivity class as notes; measurables ride roster visibility; ALL Development writes
// (goals, entries, the type library) are head-coach-only in V1. No new capability key.
export const canViewDevelopmentGoals = (c: CoachCapabilities) => c.notes;
// Distinct NAME kept as a semantic seam (measurable visibility could diverge from roster
// visibility later); today it IS roster visibility, so alias rather than duplicate the body.
export const canViewMeasurables = canViewRoster;
export const canWriteDevelopment = (c: CoachCapabilities) => c.isHeadCoach;

// ── "Can this coach COMPLETE the action?" ─────────────────────────────────────
/**
 * The CTA gate, deliberately distinct from the "can this coach SEE the section" gate in
 * `lib/coach-nav-visibility.ts`. Quiet Mode Phase A's review paid for the distinction once: setup
 * steps gated on page visibility told assistant coaches to "Add players" and sent them to a
 * read-only roster. Phase B then needed the same call four more times for empty-state CTAs.
 *
 * Route them all through here so a change to the capability model (e.g. `schedule` gaining a
 * read/manage split) is a one-file diff instead of a grep across pages. Each predicate mirrors the
 * `denyUnless` gate on the matching API route — change one, change both.
 *
 * `rosterWrite` deliberately has NO wrapper: unlike `schedule`/`tryouts`, its name already says
 * "write", so there is no view-vs-manage ambiguity for a caller to get wrong.
 */
/**
 * Create / edit / delete events, import a schedule, share a game.
 *
 * ⚠ SPLIT FROM `canViewSchedule` on 2026-08-03. Before that this predicate WAS `c.schedule`, so
 * every caller below inherited "can see it" and "can change it" as one answer. Read the JSDoc on
 * `CoachCapabilities` for why that had to end. **When adding a schedule gate, ask which half you
 * mean** — a GET wants `canViewSchedule`, anything that mutates wants this.
 */
export const canManageSchedule = (c: CoachCapabilities) => c.scheduleManage;
/** See the schedule and open a practice plan. The sidebar's Schedule door keys on this. */
export const canViewSchedule = (c: CoachCapabilities) => c.schedule;
/**
 * Opponent Scouting Book (owner-ratified 2026-08-04): reading the book AND logging
 * observations are OPEN to every schedule-holder — assistants and Helpers included —
 * because the best observations come from the bench, entries are always attributed, and
 * the head coach curates (delete-any). Deliberately looser than hasRecordAccess: the book
 * is about opposing teams, never roster records or PII. The curated "book line" summary
 * stays on the `notes` grant (canWriteScoutingSummary); observation deletion is
 * head-coach-any / author-own, enforced in the route (needs the row's author, not just
 * capabilities).
 */
export const canViewScoutingBook = (c: CoachCapabilities) => c.schedule;
export const canLogScoutingObservation = (c: CoachCapabilities) => c.schedule;
export const canWriteScoutingSummary = (c: CoachCapabilities) => c.notes;
/**
 * Game-Day Mode P2 — who may capture a moment at the bench (owner ruling 2026-08-05, the P2
 * mockup sign-off's Q1; the plan was silent).
 *
 * **Anyone who DRIVES the console** — the union of the three grants that already carve the
 * console into zones (subs, Who's here, score + End game). Deliberately NOT `schedule` alone,
 * which is the Scouting Book's gate: a schedule-only Helper's console is read-only by the
 * §1.15 ruling and renders no footer at all, so a bare-`schedule` predicate here would have
 * put a write behind a surface that shows no button — a gate contradicting its own screen.
 *
 * ⚠ No new capability key, by the same reasoning as P1 §6: nothing new appears on the staff
 * screen, and a coach's ability to log follows the duties they already hold.
 */
export const canLogGameMoment = (c: CoachCapabilities) =>
  c.attendance || c.lineups || c.scheduleManage;
/**
 * Does this person get a seat in the team's staff chat room?
 *
 * ⚠ Membership of that room is DERIVED from the staff assignment (`syncStaffChatRoom`), which is why
 * this predicate exists at all: without it, inviting a parent volunteer to run a station would seat
 * them in the room where coaches discuss children. `syncStaffChatRoom` is the only caller, and it
 * removes an existing seat when this turns false — a grant taken back must empty the chair.
 */
export const canJoinStaffChat = (c: CoachCapabilities) => c.staffChat;
/**
 * May a practice plan show this person the players' names, numbers and positions?
 *
 * TRUE for anyone with roster visibility (unchanged for every existing coach), and separately for a
 * bundle holding `planPlayerNames` with `roster: 'off'` — which is a Helper, and only a Helper. This
 * is the ONLY predicate that opens on the new grant; the roster page, the development board and
 * Insights all keep reading `roster`, so they stay shut for a helper without a single new gate.
 */
export const canSeePlanPlayers = (c: CoachCapabilities) => c.roster !== 'off' || c.planPlayerNames;
/**
 * Can this bundle open ANY of the team's record surfaces — the roster, the development board,
 * attendance, lineups, documents, money, tryouts?
 *
 * ⚠ **NOT A GATE.** Every one of those surfaces gates itself, individually, on its own grant; this
 * decides ALTITUDE — whether there is a board worth rendering at all. The coach Overview is six
 * tiles reading exactly these capabilities, so a bundle that holds none of them meets a page of
 * empty boxes and a setup checklist it cannot action, and a closed season redirects it into a
 * season review of other people's children. Both callers use it to choose a screen, never to
 * decide access, and it is expressed in grants so a widened bundle stops matching by itself.
 */
export const hasNoTeamRecordAccess = (c: CoachCapabilities) =>
  !c.isHeadCoach && c.roster === 'off' && !c.attendance && !c.lineups && !c.notes
  && c.money === 'off' && c.documents === 'off' && !c.tryouts;
/** Run tryout day (sessions, scorecard, decisions). Head-coach-only in V1 — candidate PII. */
export const canManageTryouts = (c: CoachCapabilities) => c.tryouts;

const MONEY_VALUES: MoneyAccess[] = ['off', 'read', 'write'];
const DOCS_VALUES: DocsAccess[] = ['off', 'view', 'manage'];
const ROSTER_VALUES: RosterAccess[] = ['off', 'view'];

/**
 * Validate + normalize a raw grants object from a client (the head coach's duty grid) into a
 * clean `AssistantCapabilityGrants`. Unknown keys are dropped; out-of-range values are ignored.
 * `rosterWrite` is intentionally NOT accepted — assistants never get roster write in V1.
 */
export function sanitizeAssistantGrants(input: unknown): AssistantCapabilityGrants {
  const src = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {};
  const out: AssistantCapabilityGrants = {};
  const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
  const b = bool(src.schedule); if (b !== undefined) out.schedule = b;
  const sm = bool(src.scheduleManage); if (sm !== undefined) out.scheduleManage = sm;
  const sc = bool(src.staffChat); if (sc !== undefined) out.staffChat = sc;
  const pn = bool(src.planPlayerNames); if (pn !== undefined) out.planPlayerNames = pn;
  const a = bool(src.attendance); if (a !== undefined) out.attendance = a;
  const l = bool(src.lineups); if (l !== undefined) out.lineups = l;
  const p = bool(src.rosterPii); if (p !== undefined) out.rosterPii = p;
  const n = bool(src.notes); if (n !== undefined) out.notes = n;
  const s = bool(src.announcementsSend); if (s !== undefined) out.announcementsSend = s;
  const t = bool(src.tryouts); if (t !== undefined) out.tryouts = t;
  if (typeof src.roster === 'string' && ROSTER_VALUES.includes(src.roster as RosterAccess)) out.roster = src.roster as RosterAccess;
  if (typeof src.money === 'string' && MONEY_VALUES.includes(src.money as MoneyAccess)) out.money = src.money as MoneyAccess;
  if (typeof src.documents === 'string' && DOCS_VALUES.includes(src.documents as DocsAccess)) out.documents = src.documents as DocsAccess;
  return out;
}

/** Returns a 403 `Response` when `allowed` is false, otherwise null (proceed). A route handler
 *  may return a standard `Response`; `NextResponse` extends it, so `if (denied) return denied` works. */
export function denyUnless(
  allowed: boolean,
  message = 'You do not have permission to do this. Ask the head coach to grant it.',
): Response | null {
  return allowed
    ? null
    : new Response(JSON.stringify({ error: message }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      });
}

// ── Roster PII / notes redaction ─────────────────────────────────────────────
const PII_FIELDS = [
  'playerDateOfBirth',
  'guardianFirstName',
  'guardianLastName',
  'guardianEmail',
  'guardianPhone',
  'medicalNotes',
  'emergencyContactName',
  'emergencyContactPhone',
] as const;

const NOTES_FIELDS = ['notes', 'adminNotes'] as const;

/** Null out guardian PII / notes on a roster player object the caller isn't cleared to see. */
export function redactRosterPlayer<T extends object>(
  player: T,
  caps: CoachCapabilities,
): T {
  if (caps.rosterPii && caps.notes) return player;
  const out = { ...player } as Record<string, unknown>;
  if (!caps.rosterPii) for (const f of PII_FIELDS) if (f in out) out[f] = null;
  if (!caps.notes) for (const f of NOTES_FIELDS) if (f in out) out[f] = null;
  return out as T;
}

/** Redact a list of roster players (no-op when the caller is fully cleared). */
export function redactRoster<T extends object>(
  players: T[],
  caps: CoachCapabilities,
): T[] {
  if (caps.rosterPii && caps.notes) return players;
  return players.map((p) => redactRosterPlayer(p, caps));
}
