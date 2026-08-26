import { isDemoOrgSlug, getDemoOrgBySlug, decodePathSegment } from './demo-org';

/**
 * lib/demo-guard.ts — the central write block for sandbox organizations.
 *
 * ONE rule: **for a demo org, nothing that changes anything is allowed through.** Enforced at the
 * request layer (`proxy.ts`) so a route written next year is blocked by default, without anybody
 * remembering to opt it in. That default-closed property is the entire value of putting it here
 * rather than in the routes.
 *
 * The rejection is a structured 403 carrying `sandbox: true`. That flag is a contract with the
 * client: the shared fetch layer recognises it and shows the "not saved in the sandbox" nudge
 * instead of an error, and — for the schedule and bracket editors — keeps the visitor's change on
 * screen so the health score can react to it. A plain 403 would make the sandbox feel broken;
 * this is what makes it feel honest.
 *
 * ── What this module does NOT claim ─────────────────────────────────────────────────────────
 *
 * This layer identifies the org from the URL — a path segment or the `orgSlug` query parameter,
 * which is how every authenticated admin and coach route carries it. A request that names its org
 * only in its BODY cannot be identified here, because middleware cannot read a body without
 * consuming it. Those routes are a short, enumerable list (public registration and token-based
 * score submission), and they carry their own guard via `assertNotDemoOrg`. `lib/demo-org.ts`
 * describes the layering; the honest summary is: this is the chokepoint, plus a handful of
 * body-identified public endpoints that must call the guard themselves.
 *
 * Outbound silence (email/notifications) is a SEPARATE and independent guarantee — see
 * `lib/notify.ts` and `lib/email.ts`. Either layer alone would stop the demo org contacting
 * anyone; both is what makes it a statement rather than a hope.
 *
 * ── The one known GET that writes ───────────────────────────────────────────────────────────
 *
 * This chokepoint keys on write METHODS, so a GET handler with a lazy-create side effect walks
 * straight through it. Exactly one is known: `…/tryout-self-score` find-or-creates the signed-in
 * coach's own `self:`-keyed evaluator session on first open of the scorer. For the demo org that
 * means one benign, idempotent bookkeeping row (the demo coach, "Jordan Blake") appears the
 * first time anyone opens the demo's scoring screen — invisible to the visitor, no user content,
 * and `check-demo-coach.mjs` counts shareable links excluding `self:` rows for this reason
 * (2026-08-11). If you add another GET-that-writes, either guard it here-in-spirit with
 * `assertNotDemoOrg` or record it in this list — an unrecorded one costs a day of false alarms.
 */

/** Methods that cannot change anything and are therefore always allowed. */
const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const SANDBOX_REJECTION_STATUS = 403;

/** The body every blocked write returns. `sandbox: true` is what the client keys off. */
export interface SandboxRejectionBody {
  sandbox: true;
  error: string;
  /** Short, human, and safe to surface directly if a caller has no better copy to hand. */
  message: string;
}

export const SANDBOX_REJECTION_BODY: SandboxRejectionBody = {
  sandbox: true,
  error: 'SandboxReadOnly',
  message: 'Nothing is saved here. To keep your changes, start your own tournament — it\'s free.',
};

/** The coach sandbox's variant — same contract, its own ask. */
const COACH_REJECTION_BODY: SandboxRejectionBody = {
  sandbox: true,
  error: 'SandboxReadOnly',
  message: 'Nothing is saved here. To keep your changes, start your own team — it\'s free.',
};

/**
 * The rejection body for a given demo org — each sandbox nudges toward ITS OWN signup, because a
 * coach reading "start your own tournament" has just been told the demo wasn't for them. Falls
 * back to the tournament body so a caller without a slug is never worse than before.
 */
export function sandboxRejectionBodyFor(slug?: string | null): SandboxRejectionBody {
  return getDemoOrgBySlug(slug)?.kind === 'coach' ? COACH_REJECTION_BODY : SANDBOX_REJECTION_BODY;
}

/** Does this request method attempt to change something? */
export function isWriteMethod(method: string | null | undefined): boolean {
  if (!method) return false;
  return !READ_ONLY_METHODS.has(method.toUpperCase());
}

/**
 * Which org does this request act on, as far as the URL can tell?
 *
 * Three shapes cover every authenticated write in the app:
 *   `/{orgSlug}/admin/…`             → org pages, scorekeeper, check-in (server actions)
 *   `/api/coaches/{orgSlug}/…`       → the coaches portal API
 *   `/api/**?orgSlug={orgSlug}`      → the admin API, which carries it in the query string
 *
 * Returns the FIRST demo slug it finds, so a request cannot dodge the block by also naming a
 * real org somewhere else in the URL.
 */

export function demoOrgSlugFromRequest(url: URL): string | null {
  // EVERY path segment is checked, not just the ones we can name today.
  //
  // The org slug sits in position 0 for org pages (`/{orgSlug}/admin/…`) and in position 2 for
  // the several API families that scope by org in the path — `/api/coaches/{orgSlug}/…`,
  // `/api/scorekeeper/{orgSlug}/…`, `/api/official/{orgSlug}/…`. Enumerating those prefixes
  // would mean this guard silently stopped covering the next family somebody adds. Scanning
  // every segment costs nothing (the allow-list is two entries and slugs are a closed
  // vocabulary that cannot collide with a route word — see lib/reserved-slugs.ts) and cannot
  // fall behind the routing table.
  for (const rawSegment of url.pathname.split('/')) {
    const segment = decodePathSegment(rawSegment);
    if (isDemoOrgSlug(segment)) return segment;
  }

  // ?orgSlug= — how the admin API names its org. Checked for every path, because a route that
  // takes orgSlug in the query is a write target wherever it lives.
  const queryOrg = url.searchParams.get('orgSlug');
  if (isDemoOrgSlug(queryOrg)) return queryOrg;

  return null;
}

/**
 * The demo-org slug this request writes against, or null when it may proceed — THE composition
 * `proxy.ts` calls, returning the slug so the rejection can carry that sandbox's own copy.
 */
export function demoOrgSlugForBlockedWrite(method: string, url: URL): string | null {
  if (!isWriteMethod(method)) return null;
  return demoOrgSlugFromRequest(url);
}

/**
 * Should this request be refused as a sandbox write?
 * The boolean face of `demoOrgSlugForBlockedWrite` — one definition, two shapes.
 */
export function shouldBlockSandboxWrite(method: string, url: URL): boolean {
  return demoOrgSlugForBlockedWrite(method, url) !== null;
}

/** The structured rejection returned to a blocked write. Pass the slug for sandbox-true copy. */
export function sandboxRejectionResponse(slug?: string | null): Response {
  return new Response(JSON.stringify(sandboxRejectionBodyFor(slug)), {
    status: SANDBOX_REJECTION_STATUS,
    headers: {
      'Content-Type': 'application/json',
      // Lets a client (and a human reading a network tab) tell this apart from a real 403 without
      // parsing the body.
      'X-Sandbox-Blocked': '1',
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * Guard for the handful of public write endpoints that identify their org from the request BODY
 * rather than the URL, and so cannot be caught by the proxy chokepoint above.
 *
 * Returns a rejection Response to return immediately, or null when the write may proceed.
 * Deliberately takes an already-resolved slug: the caller has just looked the org up, so this
 * adds no query of its own.
 */
export function assertNotDemoOrg(orgSlug: string | null | undefined): Response | null {
  return isDemoOrgSlug(orgSlug) ? sandboxRejectionResponse() : null;
}
