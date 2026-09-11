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
  rosterPii?: boolean;           // guardian contacts, player DOB, medical, emergency
  notes?: boolean;               // player notes + admin/internal notes
  money?: MoneyAccess;           // budget / dues / expenses / accounting
  documents?: DocsAccess;        // team + player documents
  announcementsSend?: boolean;   // send guardian announcements (else draft-only)
  tryouts?: boolean;             // tryout candidates + decisions (guardian PII, roster-building)
  staffChat?: boolean;           // a seat in the team's staff chat room (see the note below)
  scoutingBook?: boolean;        // read the POOLED scouting book (everyone's notes + the book line)
}

/**
 * Fully-resolved capabilities for one coach on one team.
 *
 * ── The two grants added for HELPERS (Practice Plans Phase 4, 2026-08-03) ────────────────────
 * A "Helper" is a non-coach adult — a parent volunteer, an outside instructor — invited to run a
 * station at one practice. The owner ruling (`BUSINESS_DECISIONS.md`, 2026-08-03) is that a Helper
 * is a **named PRESET of these grants and never a third `coach_role`**, so that "what can this
 * person see?" keeps exactly one answer in one place. Two additive grants make that true, because
 * verification found it was NOT true as originally planned:
 *
 *   1. `scheduleManage` — `schedule` was ONE switch covering *see the schedule* and *create / edit /
 *      delete events*. The preset "schedule visibility on, all writes off" was therefore not
 *      expressible: a helper would have been able to delete a game. Defaults TRUE for assistants, so
 *      every existing coach keeps both halves and nobody's access changes.
 *   2. `staffChat` — team staff-chat membership is DERIVED from the staff assignment and was
 *      documented as explicitly not a capability toggle, so a parent volunteer would have been
 *      auto-seated in the room where coaches discuss children. Defaults TRUE for the same reason.
 *
 * A third — `planPlayerNames` — existed between 2026-08-03 and the A1 ruling later the same day. It
 * showed a helper names on the practice plan while `roster` stayed off. **Both it and `roster` are
 * retired (A1);** see the note on `hasRecordAccess` for what replaced the job `roster` was doing.
 *
 * ⚠ Neither is a role. `resolveCoachCapabilities` and `isCoachNavItemVisible` learn no new
 * vocabulary about *who* someone is — only about what a bundle allows.
 */
export interface CoachCapabilities {
  isHeadCoach: boolean;
  schedule: boolean;             // SEE the schedule + a practice plan
  scheduleManage: boolean;       // create / edit / delete events, import, share
  attendance: boolean;
  lineups: boolean;
  rosterWrite: boolean;          // add/edit/reorder/deactivate players + profile — head only in V1
  rosterPii: boolean;            // guardian contacts, DOB, medical, emergency
  notes: boolean;                // notes + admin_notes
  money: MoneyAccess;
  documents: DocsAccess;
  announcementsSend: boolean;    // else draft-only (Phase 2 surfaces the draft flow)
  tryouts: boolean;              // head only in V1
  staffChat: boolean;            // a seat in the team's staff chat room
  /**
   * Read the POOLED scouting book — everyone's observations, the book line, the Club Shared
   * Book layer, and the full "Everything we know" page. Logging your OWN observation and
   * seeing your OWN past ones back stays on `schedule` alone (owner-ratified 2026-08-04,
   * unchanged) — this narrows only the shared/pooled read, so a head coach who wants notes
   * kept to "add, don't browse" for a given person can do that (owner ruling, 2026-09-11).
   * Defaults TRUE everywhere below: every schedule-holder already has this today, and nothing
   * may change until a head coach explicitly turns it off for someone.
   */
  scoutingBook: boolean;
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
  // TRUE by default — the pooled scouting book has always come bundled with `schedule`. Only an
  // explicit grant turns it off for someone.
  scoutingBook: true,
};

/** A head coach's full-access bundle. */
const HEAD_COACH_ALL: Readonly<CoachCapabilities> = {
  isHeadCoach: true,
  schedule: true,
  scheduleManage: true,
  attendance: true,
  lineups: true,
  rosterWrite: true,
  rosterPii: true,
  notes: true,
  money: 'write',
  documents: 'manage',
  announcementsSend: true,
  tryouts: true,
  staffChat: true,
  scoutingBook: true,
};

/**
 * ═══ THE FOUR KINDS OF STAFF (pass 2 of the staff access plan, owner-approved 2026-09-10) ═══
 *
 * A kind is a STORED LABEL (`rep_team_staff_memberships.staff_kind`, mig 288) that chooses three
 * things: the starting bundle at invite time, the word on the staff row, and the invite email's
 * wording. **It gates nothing.** Every nav door and every route keeps deciding on the individual
 * grant, exactly as before — that is the property the 2026-08-03 "a helper is a preset, never a
 * third role" ruling existed to protect, and storing the word does not touch it. What it fixes is
 * the word LYING: a helper granted attendance used to be relabelled "Assistant" on the next render,
 * because the label was re-derived from the switches; and a manager or a treasurer had no word at
 * all and was invited as a coach.
 *
 * ⚠ NULL is legal and means "no label stored" — every row written before mig 288 except the
 * backfilled helpers. `staffKindLabel` falls back to the old derivation for those.
 */
export type StaffKind = 'assistant' | 'manager' | 'treasurer' | 'helper';
export const STAFF_KINDS: ReadonlyArray<StaffKind> = ['assistant', 'manager', 'treasurer', 'helper'];

/** Validate a raw kind from a client or a row; anything else is "no kind". */
export function sanitizeStaffKind(input: unknown): StaffKind | null {
  return typeof input === 'string' && (STAFF_KINDS as readonly string[]).includes(input)
    ? (input as StaffKind)
    : null;
}

/**
 * THE FOUR STARTING BUNDLES — a preset is where a kind's access STARTS, never where it must stay.
 * The head coach adjusts any switch afterwards and the word does not move.
 *
 * ⚠ `assistant` is the explicit form of `ASSISTANT_DEFAULTS` (written out so a PATCH from the
 * sheet round-trips every key — an omitted key is dropped, not left alone). `helper` is the
 * Phase 4 preset unchanged. The two new ones are the plan's §2.2, with one addition it could not
 * have known about: the `scoutingBook` grant (2026-09-11).
 *
 * ⚠ THE TREASURER TURNS THE SCOUTING BOOK OFF, and that is what keeps the approved plan true.
 * Since 2026-09-11 the Insights door opens for anyone who can read the pooled book, so a
 * treasurer bundle that inherited it ON would have held Insights — the one door the plan and the
 * "no money in Insights" ruling (2026-08-18) say they do not. Off keeps "Keeps the books. Nothing
 * else." literally true, and it is one tap to add. The helper keeps it ON per that same ruling
 * (every existing helper reads the book today; nothing changes until a head coach flips it).
 */
export const STAFF_PRESETS: Readonly<Record<StaffKind, Readonly<Required<AssistantCapabilityGrants>>>> = {
  assistant: {
    schedule: true, scheduleManage: true, attendance: true, lineups: true, staffChat: true,
    documents: 'view', money: 'off', rosterPii: false, notes: false, announcementsSend: false,
    tryouts: false, scoutingBook: true,
  },
  manager: {
    schedule: true, scheduleManage: true, attendance: false, lineups: false, staffChat: true,
    documents: 'manage', money: 'write', rosterPii: true, notes: false, announcementsSend: true,
    tryouts: false, scoutingBook: true,
  },
  treasurer: {
    schedule: true, scheduleManage: false, attendance: false, lineups: false, staffChat: false,
    documents: 'off', money: 'write', rosterPii: false, notes: false, announcementsSend: false,
    tryouts: false, scoutingBook: false,
  },
  /**
   * THE HELPER PRESET (Phase 4) — a named bundle of the grants above, nothing more.
   *
   * What it hands over: the schedule, read-only · a practice plan · the names, numbers and
   * positions of the players at their station. What it withholds: every write, the staff chat
   * room, coaching notes, guardian contacts, attendance, lineups, documents, money, tryouts, and —
   * because the preset holds NO record grant at all (`hasRecordAccess` is false) — the roster page,
   * the development board and Insights' record tabs.
   *
   * ⚠ A1 (2026-08-03) removed `roster: 'off'` + `planPlayerNames: true` from this preset and it
   * still means the same thing: names are baseline now, so the exception is unnecessary. What keeps
   * the roster page shut for a helper is that they hold none of the duties a record surface is for.
   *
   * `scoutingBook` stays TRUE — matches every existing helper's actual access today. A head coach
   * narrows it per person from the sheet (owner ruling 2026-09-11); the preset does not, or every
   * existing Helper would silently lose read access on ship.
   */
  helper: {
    schedule: true, scheduleManage: false, attendance: false, lineups: false, staffChat: false,
    documents: 'off', money: 'off', rosterPii: false, notes: false, announcementsSend: false,
    tryouts: false, scoutingBook: true,
  },
};

/** The Phase 4 name, kept so the tests and the routes that pinned it keep reading. */
export const HELPER_PRESET: Readonly<AssistantCapabilityGrants> = STAFF_PRESETS.helper;

/**
 * ONE TABLE OF WORDS PER KIND — the dropdown's name and sub-line, the row chip, the invite email's
 * subject and promise, the accept page's phrase, the admin's approval notification. Every surface
 * that names a kind reads from here, so the four cannot drift apart (the way the helper's email
 * once promised "the team's chat, attendance and lineups" it did not grant).
 *
 * ⚠ `emailWhat` PROMISES WHAT THE PRESET GRANTS, nothing more. Widen a preset and re-read its
 * sentence — copy describing a permission bundle drifts silently.
 */
export const STAFF_KIND_COPY: Readonly<Record<StaffKind, {
  /** The chip and the dropdown option. */
  name: string;
  /** The dropdown's sub-line — one sentence for the person deciding. */
  sentence: string;
  /** "join as {asA}" on the accept page and in the notifications. */
  asA: string;
  /** "{inviter} invited you {inviteVerb} {team} as {asA}" — the email's line and the accept page's. */
  inviteVerb: string;
  /** The invite email's subject, given the team. */
  emailSubject: (teamName: string) => string;
  /** The invite email's heading. */
  emailHeading: string;
  /** What the email promises they will be able to open once they accept. */
  emailWhat: string;
}>> = {
  assistant: {
    name: 'Assistant coach',
    sentence: 'Coaches the team. Starts with the everyday tools; you choose the rest.',
    asA: 'an assistant coach',
    inviteVerb: 'to help coach',
    emailSubject: team => `You're invited to help coach ${team}`,
    emailHeading: 'You’re invited to help coach',
    emailWhat: 'Accept below to set up your account. You’ll get the team’s chat, schedule, attendance and lineups; the head coach chooses anything more.',
  },
  manager: {
    name: 'Team manager',
    sentence: 'Runs the team off the field — money, forms, family emails. Not the lineup.',
    asA: 'the team manager',
    inviteVerb: 'to help run',
    emailSubject: team => `You're invited to help run ${team}`,
    emailHeading: 'You’re invited to help run the team',
    emailWhat: 'Accept below to set up your account. You’ll get the schedule, the team’s money, its forms, family contact details, family emails and the staff chat — the head coach can change any of it.',
  },
  treasurer: {
    name: 'Team treasurer',
    sentence: 'Keeps the books — budget, dues, expenses and payments. Nothing else.',
    asA: 'the team treasurer',
    inviteVerb: 'to keep the books for',
    emailSubject: team => `You're invited to keep the books for ${team}`,
    emailHeading: 'You’re invited to keep the books',
    emailWhat: 'Accept below to set up your account. You’ll see the schedule and run the team’s money — budget, dues, expenses and every payment. That’s all it opens unless the head coach adds more.',
  },
  helper: {
    name: 'Helper',
    sentence: 'Runs a station at practice. Sees the plan and the players in front of them.',
    asA: 'a helper',
    inviteVerb: 'to help out at',
    emailSubject: team => `You're invited to help out at ${team}`,
    emailHeading: 'You’re invited to help out',
    emailWhat: 'Accept below to set up your account. On a practice day you’ll see the plan, the station you’re running and the players with you — on your own phone, at the field. That’s all it does.',
  },
};

/**
 * DISPLAY ONLY — which word describes this person on a staff list.
 *
 * Prefers the STORED kind (mig 288) and falls back to the Phase 4 derivation for a NULL, so a row
 * written before the column existed reads exactly as it did yesterday.
 *
 * ⚠ **NEVER gate anything on this.** It returns a label; it does not decide access, and no route
 * may call it. Access decisions go through the predicates below, one grant at a time — which is
 * the whole reason the kind is a label and not a role.
 */
export function staffKindLabel(c: CoachCapabilities, storedKind?: StaffKind | null): 'head' | StaffKind {
  if (c.isHeadCoach) return 'head';
  if (storedKind) return storedKind;
  /**
   * The fallback shape (A1, 2026-08-03): an assistant carries `scheduleManage`, `staffChat` and
   * `attendance` from the defaults; a helper is the only bundle that holds `schedule` while
   * holding none of them and no record grant at all.
   */
  const looksLikeHelper =
    c.schedule && !c.scheduleManage && !c.staffChat && !c.announcementsSend
    && !c.rosterPii && !hasRecordAccess(c);
  return looksLikeHelper ? 'helper' : 'assistant';
}

/** The word on the row — "Head coach", or the kind's name from the one copy table. Display only. */
export function staffKindWord(c: CoachCapabilities, storedKind?: StaffKind | null): string {
  const kind = staffKindLabel(c, storedKind);
  return kind === 'head' ? 'Head coach' : STAFF_KIND_COPY[kind].name;
}

/**
 * ═══ SCHEDULE AS ONE THREE-WAY CONTROL (R6) ═══
 * Hidden / View / View + edit over the SAME two stored keys — a UI mapping, not a new grant. The
 * two-checkbox shape admitted a state that meant nothing ("change the schedule" ticked with
 * "schedule" unticked resolved to a coach who could configure the team but not open its
 * schedule). The mapping is a bijection over the three states the product means; the resolver's
 * legacy fallback (`scheduleManage ?? schedule`) is untouched.
 */
export type ScheduleAccess = 'off' | 'view' | 'manage';
export const SCHEDULE_VALUES: ReadonlyArray<ScheduleAccess> = ['off', 'view', 'manage'];
export function scheduleAccessOf(c: Pick<CoachCapabilities, 'schedule' | 'scheduleManage'>): ScheduleAccess {
  if (!c.schedule) return 'off';
  return c.scheduleManage ? 'manage' : 'view';
}
export function scheduleGrantsFor(level: ScheduleAccess): Pick<Required<AssistantCapabilityGrants>, 'schedule' | 'scheduleManage'> {
  return { schedule: level !== 'off', scheduleManage: level === 'manage' };
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
    rosterWrite: false,
    rosterPii: g.rosterPii ?? ASSISTANT_DEFAULTS.rosterPii,
    notes: g.notes ?? ASSISTANT_DEFAULTS.notes,
    money: g.money ?? ASSISTANT_DEFAULTS.money,
    documents: g.documents ?? ASSISTANT_DEFAULTS.documents,
    announcementsSend: g.announcementsSend ?? ASSISTANT_DEFAULTS.announcementsSend,
    tryouts: g.tryouts ?? ASSISTANT_DEFAULTS.tryouts,
    staffChat: g.staffChat ?? ASSISTANT_DEFAULTS.staffChat,
    scoutingBook: g.scoutingBook ?? ASSISTANT_DEFAULTS.scoutingBook,
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
/**
 * Player Awards (Phase 2). Locked scope was "roster or schedule access" — either surface implies
 * enough context to know the players and games an award attaches to.
 *
 * ⚠ **NARROWED by A1 (2026-08-03), deliberately, because the `|| schedule` half had become a hole.**
 * A Helper holds `schedule: true`, so `schedule || roster` admitted a parent volunteer to the awards
 * API — the nav never offered it (awards sit inside Insights, which a helper cannot open), but the
 * route is the last line and it said yes. Keying on record access closes it and costs no real coach
 * anything: every assistant carries attendance, lineups and documents from the defaults.
 */
export const canManageAwards = (c: CoachCapabilities) => hasRecordAccess(c);
// Player Development (Phase 3, D1): goals are coach-judgment content about a minor — same
// sensitivity class as notes; measurables ride roster visibility; ALL Development writes
// (goals, entries, the type library) are head-coach-only in V1. No new capability key.
export const canViewDevelopmentGoals = (c: CoachCapabilities) => c.notes;
// Distinct NAME kept as a semantic seam (measurable visibility could diverge later). It used to
// alias roster visibility; A1 retired that grant, so it aliases record access — the same people,
// since every assistant who held `roster: 'view'` also holds a record grant.
export const canViewMeasurables = (c: CoachCapabilities) => hasRecordAccess(c);
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
/**
 * Write a practice plan, a drill, a plan template (R7, owner-approved 2026-09-10).
 *
 * ⚠ FOLLOWS "Schedule: View + edit", deliberately, and NOT `canWriteDevelopment`. Plan writes were
 * gated on the head-only Development predicate because Practice Plans 1a borrowed it — D1's reason
 * (coach-judgment content about a minor) describes goals and notes, not a drill sheet. The
 * assistant who runs Tuesday practice can now write Tuesday's plan. This WIDENS every existing
 * assistant who holds schedule editing (the plan's stated assumption 3); the sheet's Schedule
 * sentence says so. Skills & Goals writes (goals, measurables, sessions, continuity, carry) stay
 * on `canWriteDevelopment` — this predicate is the seam between the two.
 *
 * ⚠ Its own NAME rather than callers reading `canManageSchedule` directly, so the day a coach asks
 * for "plans but not the calendar" it is a one-line change instead of a grep.
 */
export const canWritePracticePlans = (c: CoachCapabilities) => canManageSchedule(c);
/**
 * Configure the TEAM itself — its division, its season, its lineup rules, its book sharing, its
 * link to a club. The five original Team settings groups.
 *
 * ⚠ Deliberately NOT the whole Settings page. When the two dues settings moved onto that page
 * (2026-08-14) its nav door had to widen to money editors, or a head coach's "team treasurer"
 * would have lost both controls entirely. The door is therefore the UNION of this and money
 * write, while each group on the page gates on the grant that owns it — so a money-only coach
 * finds Money and nothing else. Keep those two ideas separate: widening the door must never
 * widen this.
 */
export const canConfigureTeam = (c: CoachCapabilities) => c.isHeadCoach || c.scheduleManage;
/** See the schedule and open a practice plan. The sidebar's Schedule door keys on this. */
export const canViewSchedule = (c: CoachCapabilities) => c.schedule;
/**
 * Opponent Scouting Book (owner-ratified 2026-08-04, narrowed 2026-09-11): LOGGING an
 * observation — and seeing your OWN past ones back — is OPEN to every schedule-holder,
 * assistants and Helpers included, because the best observations come from the bench and
 * entries are always attributed. Reading the POOLED book (everyone else's notes, the book
 * line, the Club Shared Book layer, the full "Everything we know" page) is the separate
 * `scoutingBook` grant — a head coach who wants a person adding to the book without
 * browsing it turns this off while leaving `schedule` alone. The route/panel layer is
 * responsible for downgrading rather than refusing when only the weaker grant holds: the
 * schedule drawer's Scouting tab still opens, showing the record, the log form, and that
 * person's own entries — never a wall. The curated "book line" summary is gated on BOTH
 * `notes` and `scoutingBook` (canWriteScoutingSummary) — writing into a shared summary you
 * cannot read back would be a standing contradiction. Observation deletion is head-coach-any
 * / author-own, enforced in the route (needs the row's author, not just capabilities).
 */
export const canViewScoutingBook = (c: CoachCapabilities) => c.schedule && c.scoutingBook;
export const canLogScoutingObservation = (c: CoachCapabilities) => c.schedule;
export const canWriteScoutingSummary = (c: CoachCapabilities) => c.notes && c.scoutingBook;
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
 * ⚠ **THE PREDICATE A1 PUT IN PLACE OF THE RETIRED `roster` GRANT** (owner ruling 2026-08-03).
 *
 * Does this person hold ANY of the duties a record surface exists for — attendance, lineups,
 * coaching notes, money, documents, tryouts?
 *
 * ── Why this exists, and why it is NOT the retired switch under a new name ──
 * `roster` was quietly doing two jobs. Job one: *may a player's name be rendered here?* — A1 makes
 * that unconditionally yes, everywhere, for everyone with portal access, and that half simply has no
 * gate any more. Job two: *does this SECTION exist for this person?* — the roster page, attendance,
 * the development board, Insights and the Overview tiles all read `roster` as a stand-in for it.
 * A1 is silent on job two, and retiring the grant with nothing behind it would have opened every one
 * of those to a Helper: a widening, which the ruling explicitly says it is not.
 *
 * So job two is answered by the duties a head coach already assigns deliberately, and the answer
 * needs no new switch:
 *   · a head coach → true
 *   · an assistant on the defaults (attendance + lineups + documents) → true
 *   · a HELPER, who holds none of them → false
 *   · an assistant hand-stripped to schedule-only → false, which is correct: that IS a helper
 *
 * ⚠ It also **self-corrects**. Grant a helper attendance and the roster page opens by itself —
 * there is no second switch anyone has to remember, and no list to keep in step.
 *
 * ⚠ Unlike the switch it replaces, this asks nothing about *seeing a name*. A person for whom this
 * is false still reads their players' names, numbers and positions on the practice plan they are
 * standing on the field to run.
 */
/**
 * The record duties that are NOT money — the shared half of the two predicates below.
 *
 * ⚠ Private, and it exists so the duty list is written ONCE. Both exported predicates enumerate the
 * same duties and differ by exactly one clause; as two independent seven-clause unions, an eighth
 * duty added to `CoachCapabilities` had to be remembered in two places, and forgetting one would
 * silently open or close a door with nothing to catch it.
 */
const hasNonMoneyRecordDuty = (c: CoachCapabilities) =>
  c.attendance || c.lineups || c.notes || c.documents !== 'off' || c.tryouts;

export const hasRecordAccess = (c: CoachCapabilities) =>
  c.isHeadCoach || hasNonMoneyRecordDuty(c) || c.money !== 'off';
/**
 * **Does this person hold a record duty that is NOT money?** — the Insights portal's own gate
 * (reports portal P1, owner ruling 3, 2026-08-18).
 *
 * ⚠ **THE ONE PERSONA THIS MOVES IS THE TREASURER, AND MOVING THEM IS THE POINT.** Insights gated
 * on `hasRecordAccess`, which counts `money !== 'off'` among its seven duties — so an assistant set
 * up as the team's treasurer and nothing else held the Insights door. That was defensible while a
 * dues tile, two money findings and a "Where's the money?" doorway lived on the hub: there was
 * something there for them. The owner then ruled money out of Insights entirely, and the door
 * became one onto a portal of player and team statistics with nothing of theirs on it. Their home
 * is the Money hub, which they still hold.
 *
 * ⚠ It is `hasRecordAccess` MINUS money's contribution — and the two now SHARE the duty list rather
 * than each spelling it out, so an eighth duty cannot be added to one and forgotten in the other.
 * A coach who holds money AND attendance keeps the door; only a coach whose sole duty is money
 * loses it.
 *
 * ⚠ Every OTHER record surface stays on `hasRecordAccess`: the roster page, Season's End and the
 * development board are records a treasurer has a real claim on. This narrows exactly one door.
 */
export const hasNonMoneyRecordAccess = (c: CoachCapabilities) =>
  c.isHeadCoach || hasNonMoneyRecordDuty(c);
/**
 * The negation, kept as its own name because it reads better at the two ALTITUDE call sites — the
 * ones choosing which SCREEN to render rather than whether to allow something.
 *
 * The coach Overview is six tiles reading exactly these capabilities, so a bundle holding none of
 * them meets a page of empty boxes and a setup checklist it cannot action; and on a closed season it
 * would otherwise be redirected into a season review of other people's children.
 *
 * ⚠ **This is load-bearing for the "This season has finished" screen a Helper meets when their
 * season closes** — the screen that keeps the season-review door shut (owner ruling 2026-08-03).
 * It previously required `roster === 'off'`, the exact state A1 retires, so leaving it alone would
 * have reopened that door while looking like an unrelated simplification.
 */
export const hasNoTeamRecordAccess = (c: CoachCapabilities) => !hasRecordAccess(c);
/**
 * **Read a practice plan from a season that has FINISHED** — the look-back layer's own gate.
 *
 * ⚠ **THE PAIR IS THE POINT, and it had been kept in step by comment alone.** `hasRecordAccess`
 * asks "is the team's record yours?"; `canViewSchedule` asks "do you belong at the practice?". A
 * HELPER turns up to run one station on a Tuesday: they hold the schedule and tonight's plan, and
 * `hasRecordAccess` is false for them (the preset grants none of its seven duties). Requiring both
 * is what keeps last season's plans out of their hands without inventing an eighth grant.
 *
 * ⚠ **Named on 2026-08-16 (P3 C3 `/simplify`) because it had reached THREE call sites** — the
 * read route, the season list behind the Season's End shelf, and that shelf's own client-side
 * door — each carrying a comment insisting the gate and its entry points must move together. That
 * is precisely the invariant a name makes structural instead of clerical: a fourth entry point now
 * imports one symbol rather than re-deriving a conjunction, and reordering or dropping half of it
 * is no longer something a reader has to notice.
 */
export const canReadPastPracticePlans = (c: CoachCapabilities) =>
  canViewSchedule(c) && hasRecordAccess(c);
/** Run tryout day (sessions, scorecard, decisions). Head-coach-only in V1 — candidate PII. */
export const canManageTryouts = (c: CoachCapabilities) => c.tryouts;

/**
 * **THE LAST-HEAD-COACH RULE** (R8, owner-approved 2026-09-10; assumption 2: two head coaches are
 * allowed, and removing or demoting the last one is refused). Pure, and here rather than in the
 * membership module so it can be unit-tested without a database, and so both write paths — the
 * role change and the removal in `lib/coach-membership.ts` — decide from one sentence.
 *
 * `activeHeadCount` is the team's count INCLUDING the target; `targetIsHead` says whether the
 * row about to change is one of them. A change that would leave zero is refused.
 */
export function wouldLeaveNoHeadCoach(activeHeadCount: number, targetIsHead: boolean): boolean {
  return targetIsHead && activeHeadCount <= 1;
}
/** The one wording for that refusal — the route's 409 and the sheet's own check say the same thing. */
export const LAST_HEAD_COACH_MESSAGE = 'A team needs at least one head coach.';

const MONEY_VALUES: MoneyAccess[] = ['off', 'read', 'write'];
const DOCS_VALUES: DocsAccess[] = ['off', 'view', 'manage'];

/**
 * Validate + normalize a raw grants object from a client (the head coach's duty grid) into a
 * clean `AssistantCapabilityGrants`. Unknown keys are dropped; out-of-range values are ignored.
 * `rosterWrite` is intentionally NOT accepted — assistants never get roster write in V1.
 *
 * ⚠ **Rows stored before A1 (2026-08-03) still carry `roster` and `planPlayerNames` keys.** Dropping
 * unknown keys is exactly what makes that a non-event: no migration, no backfill, and a stale
 * `roster: 'off'` on an existing assistant simply stops meaning anything the next time they load.
 */
export function sanitizeAssistantGrants(input: unknown): AssistantCapabilityGrants {
  const src = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {};
  const out: AssistantCapabilityGrants = {};
  const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
  const b = bool(src.schedule); if (b !== undefined) out.schedule = b;
  const sm = bool(src.scheduleManage); if (sm !== undefined) out.scheduleManage = sm;
  const sc = bool(src.staffChat); if (sc !== undefined) out.staffChat = sc;
  const a = bool(src.attendance); if (a !== undefined) out.attendance = a;
  const l = bool(src.lineups); if (l !== undefined) out.lineups = l;
  const p = bool(src.rosterPii); if (p !== undefined) out.rosterPii = p;
  const n = bool(src.notes); if (n !== undefined) out.notes = n;
  const s = bool(src.announcementsSend); if (s !== undefined) out.announcementsSend = s;
  const t = bool(src.tryouts); if (t !== undefined) out.tryouts = t;
  const sb = bool(src.scoutingBook); if (sb !== undefined) out.scoutingBook = sb;
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

/**
 * "You named a team — do you coach it, and may you touch its money?" — the two questions every
 * money WRITE door in the coach API asks before it does anything.
 *
 * ⚠⚠ ONE FUNCTION, FOUR DOORS (`/simplify` + `/review`, 2026-08-17). Add a word, rename one, remove
 * one and fold one had each hand-written this pair, and **they had already drifted**: three answered
 * a blocked coach *"You do not have access to team finances. Ask the head coach to grant it."*, and
 * the fourth answered *"teamId is required and must be a team whose finances you can edit"* — which
 * is developer wording, merges two different problems into one sentence, and never tells the coach
 * the one thing that would fix it. Same person, same missing permission, two different answers
 * depending on which button they pressed.
 *
 * ⚠ THE TWO FAILURES STAY DISTINCT, which is why this returns two different statuses. **400** means
 * the request named no team, or a team this person does not coach — a caller mistake. **403** means
 * they coach it and their money access is off — a permission fact, and the only one with a remedy
 * worth printing. Collapsing them was the bug in the fourth door, not the fix.
 *
 * ⚠ AND IT IS CHECKED ON **THIS** TEAM, NOT ON ANY TEAM. Money access is three-state and per team
 * precisely so a head coach can withhold it; two of these doors once asked whether the coach could
 * write money on SOME team they coach, which let a head coach on team A reach into team B's
 * vocabulary while holding `money: 'off'` there. Found by review and fixed door by door — this is
 * the shape that stops it being possible to get wrong a fifth time.
 */
export function denyUnlessTeamMoneyWrite(
  assignments: ReadonlyArray<{ teamId: string; capabilities: CoachCapabilities }>,
  teamId: string | null | undefined,
): Response | null {
  const team = teamId?.trim();
  if (!team || !assignments.some((a) => a.teamId === team)) {
    return new Response(
      JSON.stringify({ error: 'teamId is required and must be a team you coach' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }
  return denyUnless(
    assignments.some((a) => a.teamId === team && canWriteMoney(a.capabilities)),
    'You do not have access to team finances. Ask the head coach to grant it.',
  );
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
