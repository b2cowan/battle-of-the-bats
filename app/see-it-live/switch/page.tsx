import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getDemoOrgByKind } from '@/lib/demo-org';
import { SEE_IT_LIVE_PATH, SANDBOX_SWITCH_ENDPOINT } from '@/lib/sandbox-door';
import styles from './switch.module.css';

/**
 * The confirm screen — the only thing the sandbox door ever asks anybody, and it asks it of a
 * CUSTOMER, not a prospect.
 *
 * Somebody signed in as themselves pressed "See it live". Establishing the demo's session would
 * replace their own and sign them out of their account. So we say so, plainly, and give them both
 * doors: take the demo, or keep their account and read the fan side (which is public anyway, and is
 * the half that proves the demo is live within seconds).
 *
 * **Nothing is collected here.** No email field, no form beyond a single confirm button, no tracking
 * of who declined. A logged-out visitor never reaches this page — the door sends them straight in.
 * That is what keeps the binding "ungated at the door" ruling intact: the ruling forbids asking a
 * stranger for something before they may come in, not warning a customer before we touch their
 * account. (Owner ruling 2026-08-03.)
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Open the live demo — FieldLogicHQ',
  // Not a page anybody should arrive at from a search result; it only makes sense mid-flow.
  robots: { index: false, follow: false },
};

export default async function SandboxSwitchPage() {
  const demo = getDemoOrgByKind('tournament');
  if (!demo) redirect('/for-tournament-organizers');

  // Read-only: this page must never mutate the visitor's cookies. The confirm button does that,
  // and only after they press it.
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => { /* deliberately inert */ },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();

  // Nobody is signed in, so there is nothing to warn about — send them through the door proper,
  // which will walk them straight into the demo with no screen at all. Keyed on the SESSION, not
  // on an email: an account without an email address is still an account, and must still be warned
  // (the door makes the same distinction — see lib/demo-session.ts).
  if (!user) redirect(SEE_IT_LIVE_PATH);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>
          <span className={styles.bulb} aria-hidden="true" />
          {/* Matches the demo's own banner — see the note in SandboxChrome. */}
          Live demo
        </p>
        {/* Copy aligned to the approved D5 mockup (TOURNAMENT_SANDBOX_PHASE3_DECISIONS.html,
            ratified 2026-08-04): lead with what they're stepping into, name the account being
            signed out in its own chip, and make declining a first-class choice. */}
        <h1 className={styles.title}>Step into the organizer&apos;s seat?</h1>
        <p className={styles.body}>
          The demo&apos;s organizer side uses a <strong>shared demo account</strong>. Continuing
          signs this browser out of your own account while you explore —{' '}
          <strong>nothing about your account or your organization changes</strong>, and signing
          back in takes one click.
        </p>
        {user.email && (
          <p className={styles.who}>
            <span className={styles.whoDot} aria-hidden="true" />
            <span>You&apos;re currently signed in as <strong>{user.email}</strong></span>
          </p>
        )}

        {/* A POST, not a link: a GET that destroys a session can be fired by any page that can
            embed a URL. One button, no fields — there is nothing here to fill in. */}
        <form action={SANDBOX_SWITCH_ENDPOINT} method="post" className={styles.actions}>
          <button type="submit" className={styles.primary}>
            Continue to the organizer&apos;s seat
          </button>
          <Link href={demo.landingPath} className={styles.secondary}>
            Stay in my account — watch as a fan
          </Link>
        </form>

        <p className={styles.note}>
          The public side of the demo never needs this — live scores, standings and the bracket
          are open to everyone, no account involved.
        </p>
      </div>
    </main>
  );
}
