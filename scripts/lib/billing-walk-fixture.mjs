/**
 * What the billing walk fixtures share (Plans end at the renewal date, Stages 1–3): scripts/seed-plan-ending-walk.mjs,
 * scripts/seed-plan-move-walk.mjs and scripts/rehearse-plan-ending.mjs. One guard, one way to make a sign-in, one signed-in
 * cookie. Each caller keeps its own clubs (their columns and dates differ) and its own error style: these throw.
 */
import { createServerClient } from '@supabase/ssr';
import { stripeKeyIsTest } from '../../lib/stripe-mode.ts';
import { recordLegalAcceptance } from './record-legal-acceptance.mjs';

// The dev project's ref, as `PROJECTS.dev` in scripts/lib/supabase-ops.mjs. NOT imported from there: that module fills any
// unset variable from .env.local the moment it loads, so a guard importing it would turn "no key" into .env.local's key.
export const DEV_REF = 'npgnrxaitgbtbtvvykto';

/**
 * Null when a fixture may run; otherwise the sentence it exits with. A Stripe TEST key (decided only by lib/stripe-mode.ts;
 * a missing key is not one) and the DEV project by its exact host (a URL that merely contains or starts with the ref is not it).
 */
export function refusal({ stripeKey, supabaseUrl }) {
  if (!stripeKeyIsTest(stripeKey)) return 'Refusing: STRIPE_SECRET_KEY is not a Stripe TEST key (or there is none). This never touches live mode.';
  let host = '';
  try { host = new URL(supabaseUrl ?? '').hostname; } catch { /* not a URL */ }
  if (host !== `${DEV_REF}.supabase.co`) return 'Refusing: NEXT_PUBLIC_SUPABASE_URL is not the dev project. This never touches production.';
  return null;
}

/** The auth user with this address (any case), or null. Pages 200 at a time. */
export async function findUserByEmail(db, email) {
  for (let page = 1; page <= 40; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

/** The sign-in for this address with this password: found (password reset to it) or made (confirmed). */
export async function ensureUser(db, { email, password, fullName }) {
  const found = await findUserByEmail(db, email);
  if (found) {
    const { error } = await db.auth.admin.updateUserById(found.id, { password });
    if (error) throw new Error(`password ${email}: ${error.message}`);
    await recordLegalAcceptance(db, found); // GST/HST 6.3 A5: a fixture never meets the Terms screen
    return { user: found, created: false };
  }
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  await recordLegalAcceptance(db, data.user);
  return { user: data.user, created: true };
}

/**
 * A signed-in `Cookie` header for the site's own API routes, without a browser. @supabase/ssr's own server client writes it
 * (as scripts/measure-dev-memory.mjs does), so the chunking and prefix are the library's, never a hand-built imitation.
 */
export async function signInCookie({ url, anonKey, email, password }) {
  const jar = new Map();
  const supa = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: cookies => { for (const c of cookies) jar.set(c.name, c.value); },
    },
  });
  const { error } = await supa.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in ${email}: ${error.message}`);
  if (!jar.size) throw new Error(`sign-in ${email}: no session cookie was written`);
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}
