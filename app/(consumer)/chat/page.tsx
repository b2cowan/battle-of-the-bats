import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase-server';
import warm from '@/components/consumer/warmTheme.module.css';
import styles from './chat.module.css';

/**
 * /chat — Chat tab, Phase 0 placeholder (Unified Home IA).
 *
 * The cross-context member inbox lands in Phase 4. This phase ships ONLY the static
 * logged-out / signed-in-fan pitch so the newly-added tab never 404s and the social
 * layer is visible pre-signup (owner constraint: nav shape never varies by auth
 * state). There is no query against real chat data here — logged-out and fan states
 * render the exact same fictional preview; only the honest footer line differs.
 * Member-only read/post stays enforced at the DB layer regardless (Round 3 spec).
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Chat',
  robots: { index: false, follow: false },
};

const THREAD = [
  { side: 'in' as const, who: 'Organizer · Riverside Rays', text: 'Field 3 is playable — first pitch still 9:00. See everyone there!' },
  { side: 'in' as const, who: 'Coach Dana', text: 'Thanks! We’ll be there by 8:30 to warm up.' },
  { side: 'out' as const, who: 'You', text: 'Perfect — bringing the scorebook and the extra bases.' },
];

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const signedIn = !!user?.email;

  return (
    <div className={`${warm.warm} ${styles.page}`}>
      <div className={styles.header}>
        <h1 className={styles.title}>Chat</h1>
        <p className={styles.sub}>
          Team and tournament conversations — organizers and coaches, all in one place.
        </p>
      </div>

      {/* Fictional, obviously-not-real preview thread. */}
      <div className={styles.previewCard}>
        <span className={styles.exampleChip}>
          <MessageCircle size={11} strokeWidth={2.4} aria-hidden />
          Example — not a real conversation
        </span>
        <div className={styles.thread}>
          {THREAD.map((m, i) => (
            <div key={i} className={`${styles.msg} ${m.side === 'in' ? styles.msgIn : styles.msgOut}`}>
              <span className={styles.msgKicker}>{m.who}</span>
              <span className={`${styles.bubble} ${m.side === 'in' ? styles.bubbleIn : styles.bubbleOut}`}>
                {m.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Two doors — never implies fans/parents get team chat. */}
      <div className={styles.doors}>
        <Link href="/for-coaches" className={styles.door}>
          <span className={`${styles.doorKicker} ${styles.doorKickerCoach}`}>For coaches</span>
          <span className={styles.doorTitle}>Keep your team in the loop</span>
          <span className={styles.doorText}>
            One place for game-day updates, field changes, and reminders — no more scattered group texts.
          </span>
          <span className={styles.doorGo}>See the Coaches Portal →</span>
        </Link>
        <Link href="/for-tournament-organizers" className={styles.door}>
          <span className={`${styles.doorKicker} ${styles.doorKickerOrg}`}>For organizers</span>
          <span className={styles.doorTitle}>Reach every coach at once</span>
          <span className={styles.doorText}>
            Post a delay, a field move, or a bracket update and every team&rsquo;s staff sees it instantly.
          </span>
          <span className={styles.doorGo}>Run a tournament →</span>
        </Link>
      </div>

      <p className={styles.footRow}>
        {signedIn ? (
          <>Chat opens up once you&rsquo;re on a team&rsquo;s staff. Coaching or organizing a team? It&rsquo;ll show up here.</>
        ) : (
          <>
            Already on a team&rsquo;s staff?{' '}
            <Link href="/auth/login?next=/chat" className={styles.footLink}>Sign in</Link>
            {' '}to open your conversations.
          </>
        )}
      </p>
    </div>
  );
}
