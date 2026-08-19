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
};

/**
 * THE HELPER PRESET (Phase 4) — a named bundle of the grants above, nothing more.
 *
 * What it hands over: the schedule, read-only · a practice plan · the names, numbers and positions
 * of the players at their station. What it withholds: every write, the staff chat room, coaching
 * notes, guardian contacts, attendance, lineups, documents, money, tryouts, and — because the preset
 * holds NO record grant at all (`hasRecordAccess` is false) — the roster page, the development board
 * and Insights.
 *
 * ⚠ **A1 (2026-08-03) removed two keys from this preset, and it still means the same thing.** It used
 * to carry `roster: 'off'` + `planPlayerNames: true` — "no roster access, but show names on the
 * plan". Names are baseline now, so the exception is unnecessary and the grant it evaded is gone.
 * What keeps the roster page shut for a helper is no longer a switch set to off; it is that they
 * hold none of the duties a record surface is for.
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
  rosterPii: false,
  notes: false,
  money: 'off',
  documents: 'off',
  announcementsSend: false,
  tryouts: false,
  staffChat: false,
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
  /**
   * ⚠ RE-DERIVED for A1 (2026-08-03). This used to require `roster === 'off'` and
   * `planPlayerNames` — the two keys A1 retires. Left alone, every helper would have been
   * relabelled "Assistant" on the head coach's staff card the day A1 shipped: no access change,
   * but the coach loses the only place the product names what they invited.
   *
   * The surviving shape still identifies a helper uniquely. An assistant carries `scheduleManage`,
   * `staffChat` and `attendance` from the defaults; a helper is the only bundle that holds
   * `schedule` while holding none of them and no record grant at all.
   */
  const looksLikeHelper =
    c.schedule && !c.scheduleManage && !c.staffChat && !c.announcementsSend
    && !c.rosterPii && !hasRecordAccess(c);
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
    rosterWrite: false,
    rosterPii: g.rosterPii ?? ASSISTANT_DEFAULTS.rosterPii,
    notes: g.notes ?? ASSISTANT_DEFAULTS.notes,
    money: g.money ?? ASSISTANT_DEFAULTS.money,
    documents: g.documents ?? ASSISTANT_DEFAULTS.documents,
    announcementsSend: g.announcementsSend ?? ASSISTANT_DEFAULTS.announcementsSend,
    tryouts: g.tryouts ?? ASSISTANT_DEFAULTS.tryouts,
    staffChat: g.staffChat ?? ASSISTANT_DEFAULTS.staffChat,
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
