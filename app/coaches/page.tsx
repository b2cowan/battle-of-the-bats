import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, ShieldCheck, Trophy, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase-server';
import { getUserAccessContexts, type UserAccessContext } from '@/lib/user-contexts';
import {
  COACHES_START_PATH,
  COACHES_TOURNAMENTS_PATH,
  COACHES_TEAMS_PATH,
} from '@/lib/coaches-portal-routes';
import styles from './coaches-portal.module.css';

export const metadata = { title: 'Coaches Portal' };

function getBasicContext(contexts: UserAccessContext[]) {
  return contexts.find(context => context.kind === 'coaches_basic') ?? null;
}

function getWorkspaceContexts(contexts: UserAccessContext[]) {
  return contexts.filter(context => context.kind === 'coaches_premium');
}

export default async function CoachesPortalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect(`/auth/login?next=/coaches`);
  }

  const contexts = await getUserAccessContexts({ id: user.id, email: user.email });
  const basicContext = getBasicContext(contexts);
  const workspaceContexts = getWorkspaceContexts(contexts);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Your Coaches Portal</h1>
          <p className={styles.sub}>
            Everything for the teams you bring to tournaments — <strong>{user.email}</strong>.
          </p>
        </div>
      </div>

      {/* Teams & tournaments — the coach's home base */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Teams &amp; tournaments</h2>
        </div>
        {basicContext ? (
          <div className={styles.grid}>
            <Link href={COACHES_TOURNAMENTS_PATH} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardIcon}><Trophy size={18} /></div>
              </div>
              <div>
                <h3 className={styles.cardTitle}>Your teams &amp; history</h3>
                <p className={styles.cardText}>{basicContext.detail}</p>
              </div>
              <span className={styles.cardAction}>Open tournament records</span>
            </Link>
          </div>
        ) : (
          <div className={styles.empty}>
            <p>Your teams and tournament history appear here automatically when you register for a tournament.</p>
            <Link href={COACHES_START_PATH} className="btn btn-outline btn-sm">Explore the Coaches Portal</Link>
          </div>
        )}
      </section>

      {/* Team workspaces — only when the coach actually has one */}
      {workspaceContexts.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Team workspaces</h2>
            <Link href={COACHES_TEAMS_PATH} className="btn btn-ghost btn-sm">View all</Link>
          </div>
          <div className={styles.grid}>
            {workspaceContexts.map(context => (
              <Link key={context.id} href={context.destination} className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.cardIcon}><ShieldCheck size={18} /></div>
                </div>
                <div>
                  <h3 className={styles.cardTitle}>{context.title}</h3>
                  <p className={styles.cardText}>
                    {context.detail || 'Team management'}
                    {context.orgSlug ? ` · ${context.orgSlug}` : ''}
                  </p>
                </div>
                <span className={styles.cardAction}>Open workspace</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Value-first, never a tier pitch: only shown when there's no workspace yet */}
      {workspaceContexts.length === 0 && (
        <section className={styles.section}>
          <div className={styles.grid}>
            <div className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardIcon}><Users size={18} /></div>
              </div>
              <div>
                <h3 className={styles.cardTitle}>Take your team further</h3>
                <p className={styles.cardText}>
                  Run your team year-round — roster, lineups, schedule, dues, budget, and documents in one place. It carries over automatically if your organization joins FieldLogicHQ.
                </p>
              </div>
              <Link href={COACHES_START_PATH} className="btn btn-outline btn-sm" style={{ marginTop: 'auto' }}>
                Express interest
              </Link>
            </div>
            <div className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardIcon}><CalendarDays size={18} /></div>
              </div>
              <div>
                <h3 className={styles.cardTitle}>Run your own tournament</h3>
                <p className={styles.cardText}>
                  FieldLogicHQ runs divisions, pools, schedules, and registration from one dashboard.
                </p>
              </div>
              <Link href="/pricing" className="btn btn-ghost btn-sm" style={{ marginTop: 'auto' }}>
                See tournament plans
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
