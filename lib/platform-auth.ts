import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase-admin';
import { getAuthenticatedUser, getSessionTwoStep } from './api-auth';
import { platformStaffTwoStepRequired, requiredSeatNeed } from './two-step-rule';
import { TwoStepRequiredError } from './two-step-gate';
import { canViewPlatformArea, canWritePlatformArea, hasPlatformPower, type PlatformArea, type PlatformPower } from './platform-areas';

export type PlatformRole = 'super_admin' | 'support' | 'billing' | 'product' | 'growth' | 'read_only';

export type PlatformAuthContext = {
  user: User;
  role: PlatformRole;
  isBootstrapAdmin: boolean;
};

// ⚖ WHO MAY DO WHAT lives in ONE table, by power: `PLATFORM_POWERS` in `lib/platform-areas.ts` (Support console Stage 2,
// owner 2026-10-25). The by-permission table that stood here (`ROLE_PERMISSIONS`) was the second rulebook and is gone;
// `hasPlatformPower` is re-exported below so a server file needs one import.
export { hasPlatformPower };
export type { PlatformPower };

export function getBootstrapAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isBootstrapAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return getBootstrapAdminEmails().includes(email.toLowerCase());
}

function normalizePlatformRole(role: string | null | undefined): PlatformRole {
  if (role === 'admin') return 'super_admin';
  if (role === 'super_admin' || role === 'support' || role === 'billing' || role === 'product' || role === 'growth' || role === 'read_only') {
    return role;
  }
  return 'read_only';
}

async function getDbPlatformRole(email: string): Promise<PlatformRole | null> {
  const { data } = await supabaseAdmin
    .from('platform_users')
    .select('role, is_active')
    .eq('email', email.toLowerCase())
    .eq('is_active', true)
    .maybeSingle();
  return data ? normalizePlatformRole(data.role) : null;
}

export async function isPlatformAdminEmail(email: string): Promise<boolean> {
  if (isBootstrapAdmin(email)) return true;
  return (await getDbPlatformRole(email)) !== null;
}

/**
 * The same question, for a door that must not let a staff address through when the read fails (Board Ready leftover call
 * 13, owner 2026-11-19: a club's member invite). `null` = it couldn't be answered; the caller refuses with "try again".
 * ⚖ The database is read FIRST, for every address, so a failed read answers null whatever the address is: an answer that
 * still said "staff" for a bootstrap address during an outage would let a club admin probe which addresses are staff.
 * `isPlatformAdminEmail` keeps its soft answer for its other callers, which want it.
 */
export async function isPlatformAdminEmailStrict(email: string): Promise<boolean | null> {
  const typed = email.trim().toLowerCase();
  const { data, error } = await supabaseAdmin
    .from('platform_users')
    .select('role')
    .eq('email', typed)
    .eq('is_active', true)
    .maybeSingle();
  if (error) return null;
  return !!data || isBootstrapAdmin(typed);
}

/**
 * The staff session, or null. ⚖ PLATFORM STAFF ALWAYS USE TWO-STEP, with no grace period (Board Ready · two-step sign-in,
 * owner ruling 2026-11-10): one stolen password here opens every customer. A staff session without it throws
 * TwoStepRequiredError — the set-up step in a page, a 401 in a route — and one whose last code is over 30 days old is
 * sent to type it again. On dev only, TWO_STEP_STAFF_REQUIRED=off lifts it for seeds and probes (lib/two-step-rule.ts).
 */
export async function getPlatformAdminContext(): Promise<PlatformAuthContext | null> {
  const state = await getSessionTwoStep();
  const user = state?.passed ? state.user : null;
  if (!user?.email) return null;
  // ⚖ A STAFF ACCOUNT MUST HAVE A CONFIRMED EMAIL (Support console Stage 2; found by the Find security review). The
  // check below trusts the session's email, so an account created with a staff address and never confirmed would pass as
  // staff if the hosted sign-in ever let it sign in. It runs BEFORE the bootstrap branch, which would otherwise return
  // super admin without reading anything. Every staff account on dev and prod was confirmed before this shipped
  // (2026-10-25).
  if (!user.email_confirmed_at) return null;

  const bootstrap = isBootstrapAdmin(user.email);
  const role: PlatformRole | null = bootstrap ? 'super_admin' : await getDbPlatformRole(user.email);
  if (!role) return null;

  if (state && platformStaffTwoStepRequired()) {
    const need = requiredSeatNeed(state);
    if (need) throw new TwoStepRequiredError(need, await staffReturnPath());
  }
  return { user, role, isBootstrapAdmin: bootstrap };
}

/** Where a staff page sent to the code or set-up step returns: the page asked for, else the console's front. */
async function staffReturnPath(): Promise<string> {
  try {
    const h = await headers();
    const path = h.get('x-pathname');
    if (path && path.startsWith('/platform-admin')) return path + (h.get('x-search') ?? '');
  } catch { /* not in a request */ }
  return '/platform-admin';
}

/**
 * Server-component guard for a platform-admin area. Redirects to the login page
 * if there is no platform session, or to the Overview if the signed-in role is
 * not permitted to view this area (see lib/platform-areas.ts). Returns the auth
 * context for the caller to reuse.
 */
export async function requirePlatformAreaView(area: PlatformArea): Promise<PlatformAuthContext> {
  const auth = await getPlatformAdminContext();
  if (!auth) redirect('/platform-admin/login?next=/platform-admin');
  if (!canViewPlatformArea(auth.role, area)) redirect('/platform-admin');
  return auth;
}

export async function requirePlatformAdmin(): Promise<
  { user: User; role: PlatformRole; response: null } | { user: null; role: null; response: NextResponse }
> {
  const auth = await getPlatformAdminContext();
  if (!auth) return { user: null, role: null, response: new NextResponse('Forbidden', { status: 403 }) };
  return { user: auth.user, role: auth.role, response: null };
}

/**
 * API-route counterpart to `requirePlatformAreaView` (which is for server pages and redirects).
 * Enforces the `lib/platform-areas.ts` access matrix at the API layer so route guards read from
 * the same single source of truth as the nav + page guards — closing the class of bug where a
 * route checked only "is there a platform session" and silently bypassed least-privilege.
 *
 *   access: 'view'  -> caller's role must be able to VIEW the area  (PLATFORM_AREAS[area].viewRoles)
 *   access: 'write' -> caller's role must hold a power the area's page uses (PLATFORM_AREAS[area].powers)
 *
 * super_admin always passes (both predicates short-circuit on it). Returns the standard guard
 * shape — `if (auth.response) return auth.response;` then use `auth.user` / `auth.role`.
 */
export async function requirePlatformAreaApi(area: PlatformArea, access: 'view' | 'write'): Promise<
  { user: User; role: PlatformRole; response: null } | { user: null; role: null; response: NextResponse }
> {
  const auth = await requirePlatformAdmin();
  if (auth.response) return auth;
  const allowed = access === 'write'
    ? canWritePlatformArea(auth.role, area)
    : canViewPlatformArea(auth.role, area);
  if (!allowed) {
    return { user: null, role: null, response: NextResponse.json({ error: 'Insufficient platform role' }, { status: 403 }) };
  }
  return auth;
}

/**
 * THE API GATE BY POWER — every console route's first step (Support console Stage 2; the powers are `PLATFORM_POWERS` in
 * `lib/platform-areas.ts`). A signed-out caller, a customer session or a disabled staff account gets 403 before anything
 * is read; a staff role without the power gets 403 "Insufficient platform role". The role is read fresh on every call.
 * Returns the standard guard shape — `if (auth.response) return auth.response;` then use `auth.user` / `auth.role`.
 */
export async function requirePlatformPower(power: PlatformPower): Promise<
  { user: User; role: PlatformRole; response: null } | { user: null; role: null; response: NextResponse }
> {
  const auth = await requirePlatformAdmin();
  if (auth.response) return auth;
  if (!hasPlatformPower(auth.role, power)) {
    return { user: null, role: null, response: NextResponse.json({ error: 'Insufficient platform role' }, { status: 403 }) };
  }
  return auth;
}

/** As `requirePlatformPower`, for a route one of several powers may use (each action inside checks its own). */
export async function requireAnyPlatformPower(powers: PlatformPower[]): Promise<
  { user: User; role: PlatformRole; response: null } | { user: null; role: null; response: NextResponse }
> {
  const auth = await requirePlatformAdmin();
  if (auth.response) return auth;
  if (!powers.some(power => hasPlatformPower(auth.role, power))) {
    return { user: null, role: null, response: NextResponse.json({ error: 'Insufficient platform role' }, { status: 403 }) };
  }
  return auth;
}

export async function requireDevToolPlatformAdmin(): Promise<
  { user: User; role: PlatformRole; response: null } | { user: null; role: null; response: NextResponse }
> {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS !== 'true') {
    return {
      user: null,
      role: null,
      response: NextResponse.json({ error: 'Not found' }, { status: 404 }),
    };
  }
  // Belt and braces, as `requireDevToolUserAuth` below: a production build never runs the dev tools, even if the flag
  // were set there by mistake (Board Ready sweep 3, small).
  if (process.env.NODE_ENV === 'production') {
    return {
      user: null,
      role: null,
      response: NextResponse.json({ error: 'Not found' }, { status: 404 }),
    };
  }

  const auth = await requirePlatformAdmin();
  if (auth.response) {
    return {
      user: null,
      role: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  // The dev_tools power (super admin only, PLATFORM_POWERS).
  if (!hasPlatformPower(auth.role, 'dev_tools')) {
    return {
      user: null,
      role: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  return auth;
}

/**
 * Dev-tool access that requires NEXT_PUBLIC_ENABLE_DEV_TOOLS=true + any authenticated
 * Supabase user. Use for seed/wipe/status/memberships — routes you need after testing
 * the signup flow (which replaces the platform-admin session cookie with the new org
 * user's session). More sensitive operations (platform user seeding, plan gates) keep
 * requireDevToolPlatformAdmin.
 *
 * Never set NEXT_PUBLIC_ENABLE_DEV_TOOLS=true in production. The production guard here
 * is a belt-and-suspenders fallback only.
 */
export async function requireDevToolUserAuth(): Promise<
  { user: User; role: PlatformRole; response: null } | { user: null; role: null; response: NextResponse }
> {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS !== 'true') {
    return {
      user: null,
      role: null,
      response: NextResponse.json({ error: 'Not found' }, { status: 404 }),
    };
  }
  if (process.env.NODE_ENV === 'production') {
    return {
      user: null,
      role: null,
      response: NextResponse.json({ error: 'Not found' }, { status: 404 }),
    };
  }
  const user = await getAuthenticatedUser();
  if (!user) {
    return {
      user: null,
      role: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { user, role: 'super_admin', response: null };
}
