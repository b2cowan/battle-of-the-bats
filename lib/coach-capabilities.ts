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
  schedule?: boolean;            // view + manage events / game-day
  attendance?: boolean;          // record attendance
  lineups?: boolean;             // build game lineups + templates
  roster?: RosterAccess;         // basics (names/jersey/position) visibility
  rosterPii?: boolean;           // guardian contacts, player DOB, medical, emergency
  notes?: boolean;               // player notes + admin/internal notes
  money?: MoneyAccess;           // budget / dues / expenses / accounting
  documents?: DocsAccess;        // team + player documents
  announcementsSend?: boolean;   // send guardian announcements (else draft-only)
  tryouts?: boolean;             // tryout candidates + decisions (guardian PII, roster-building)
}

/** Fully-resolved capabilities for one coach on one team. */
export interface CoachCapabilities {
  isHeadCoach: boolean;
  schedule: boolean;
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
}

/** The least-privilege bundle a freshly-invited assistant gets before any grant. */
export const ASSISTANT_DEFAULTS: Readonly<CoachCapabilities> = {
  isHeadCoach: false,
  schedule: true,
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
};

/** A head coach's full-access bundle. */
const HEAD_COACH_ALL: Readonly<CoachCapabilities> = {
  isHeadCoach: true,
  schedule: true,
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
};

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
  };
}

// ── Predicates ───────────────────────────────────────────────────────────────
export const canViewMoney = (c: CoachCapabilities) => c.money !== 'off';
export const canWriteMoney = (c: CoachCapabilities) => c.money === 'write';
export const canViewDocuments = (c: CoachCapabilities) => c.documents !== 'off';
export const canManageDocuments = (c: CoachCapabilities) => c.documents === 'manage';
export const canViewRoster = (c: CoachCapabilities) => c.roster !== 'off';
// Player Awards (Phase 2): "roster/schedule access" per the locked scope — either surface
// already implies enough context to know the players and games awards attach to.
export const canManageAwards = (c: CoachCapabilities) => c.schedule || c.roster !== 'off';

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
