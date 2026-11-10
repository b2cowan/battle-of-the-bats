/**
 * Milton Bats demo — ready-signed-in links for the demo people, used by the PC window launcher
 * (scripts/milton-demo-windows.ps1) and the phone sign-in codes (scripts/milton-phone-codes.mjs).
 *
 * How: an admin one-time sign-in token (no email is sent) is exchanged here for a session, and the
 * session goes to the app's /auth/callback in the URL fragment — the callback's existing "admin-generated
 * magic link" branch sets it and goes on to `next`. No password is typed or needed.
 *
 * ⚠ DEV ONLY. Refuses any Supabase project but dev (staging reads dev). Each link is a NEW session for that
 * person; it does not sign them out anywhere else. Give each device its OWN link: two devices sharing one
 * session's refresh token can sign each other out at the first refresh.
 *
 * CLI: node --env-file=.env.local scripts/milton-demo-signin.mjs <baseUrl> <persona=email=nextPath> ...
 *      → prints JSON { "<persona>": "<url>", ... } on stdout.
 */
import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';
import { findUserByEmail } from './lib/fixture-user.mjs';

const DEV_REF = 'npgnrxaitgbtbtvvykto';

function clients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  let host = '';
  try { host = new URL(url).host; } catch { /* handled below */ }
  if (host !== `${DEV_REF}.supabase.co`) throw new Error('Refusing: the Supabase URL in .env.local is not the dev project. Demo sign-in runs on dev only.');
  if (!serviceKey || !anonKey) throw new Error('.env.local is missing the Supabase keys.');
  return { url, serviceKey, anonKey };
}

/** Ready-signed-in links: { persona: url }. specs = ["persona=email=nextPath", ...]. A persona that fails is left out (reason on stderr). */
export async function makeSignInLinks(base, specs) {
  const { url, serviceKey, anonKey } = clients();
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const out = {};
  for (const spec of specs) {
    const [persona, email, next] = spec.split('=');
    // ⚠ Look first: generateLink('magiclink') CREATES an account for an unknown address. The parent's account must be
    // made by the family-app invitation, never here.
    if (!(await findUserByEmail(admin, email))) {
      console.error(`✗ ${persona} (${email}): no account yet — sign-in page instead.`);
      continue;
    }
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    if (linkErr || !link?.properties?.hashed_token) {
      console.error(`✗ ${persona} (${email}): could not make a sign-in token — ${linkErr?.message ?? 'no token'}.`);
      continue;
    }
    // A fresh client per person so sessions never mix.
    const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: verified, error: otpErr } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });
    const s = verified?.session;
    if (otpErr || !s) {
      console.error(`✗ ${persona} (${email}): sign-in token refused — ${otpErr?.message ?? 'no session'}`);
      continue;
    }
    // The callback reads only these two; nothing else goes in, which keeps the phone QR as small as it can be.
    const fragment = new URLSearchParams({ access_token: s.access_token, refresh_token: s.refresh_token });
    out[persona] = `${base}/auth/callback?next=${encodeURIComponent(next || '/')}#${fragment}`;
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [base, ...specs] = process.argv.slice(2);
  if (!base || !specs.length) {
    console.error('Usage: node --env-file=.env.local scripts/milton-demo-signin.mjs <baseUrl> <persona=email=nextPath> ...');
    process.exit(1);
  }
  try {
    process.stdout.write(JSON.stringify(await makeSignInLinks(base, specs)));
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
