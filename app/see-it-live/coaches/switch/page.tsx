import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getDemoOrgByKind } from '@/lib/demo-org';
import { SEE_IT_LIVE_COACHES_PATH, COACH_SWITCH_ENDPOINT } from '@/lib/sandbox-door';
import styles from '../../switch/switch.module.css';

/**
 * The coach demo's confirm screen — the twin of `/see-it-live/switch` (read that page's docblock;
 * the ungated-door reasoning is identical). Someone signed in as themselves pressed "See it live"
 * for the coach demo; establishing the shared demo coach's session would sign them out of their
 * own account, so we say so and ask.
 *
 * One difference from the tournament twin: there is no public fan side to offer as the decline
 * path — the coaches portal sits entirely behind sign-in — so declining keeps their session and
 * returns them to the coaches marketing page.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Open the live coach demo — FieldLogicHQ',
  robots: { index: false, follow: false },
};

export default async function CoachSandboxSwitchPage() {
  const demo = getDemoOrgByKind('coach');
  if (!demo) redirect('/for-coaches');

  // Read-only: this page must never mutate the visitor's cookies.
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

  // Nobody signed in → nothing to warn about; the door walks them straight in.
  if (!user) redirect(SEE_IT_LIVE_COACHES_PATH);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>
          <span className={styles.bulb} aria-hidden="true" />
          {/* Matches the demo's own banner — same eyebrow as the tournament twin. */}
          Live demo
        </p>
        <h1 className={styles.title}>Step into the coach&apos;s seat?</h1>
        <p className={styles.body}>
          The coach demo uses a <strong>shared demo account</strong> on a fictional team. Continuing
          signs this browser out of your own account while you explore —{' '}
          <strong>nothing about your account or your teams changes</strong>, and signing back in
          takes one click.
        </p>
        {user.email && (
          <p className={styles.who}>
            <span className={styles.whoDot} aria-hidden="true" />
            <span>You&apos;re currently signed in as <strong>{user.email}</strong></span>
          </p>
        )}

        {/* A POST, not a link: a GET that destroys a session can be fired by any page that can
            embed a URL. One button, no fields — there is nothing here to fill in. */}
        <form action={COACH_SWITCH_ENDPOINT} method="post" className={styles.actions}>
          <button type="submit" className={styles.primary}>
            Continue to the coach&apos;s seat
          </button>
          <Link href="/for-coaches" className={styles.secondary}>
            Stay in my account
          </Link>
        </form>

        <p className={styles.note}>
          The demo team is fictional and shared — nothing you do in it is saved, and it can never
          email anyone.
        </p>
      </div>
    </main>
  );
}
