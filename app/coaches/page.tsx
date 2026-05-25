import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, ShieldCheck, Trophy, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase-server';
import { getUserAccessContexts, type UserAccessContext } from '@/lib/user-contexts';
import {
  COACHES_START_PATH,
  COACHES_TOURNAMENTS_PATH,
} from '@/lib/coaches-portal-routes';
import styles from './coaches-portal.module.css';

export const metadata = { title: 'Coaches Portal' };

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function getBasicContext(contexts: UserAccessContext[]) {
  return contexts.find(context => context.kind === 'coaches_basic') ?? null;
}

function getPremiumContexts(contexts: UserAccessContext[]) {
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
  const premiumContexts = getPremiumContexts(contexts);
  const hasCoachAccess = Boolean(basicContext || premiumContexts.length > 0);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Coaches Portal</h1>
          <p className={styles.sub}>
            Tournament records and Premium team workspaces for <strong>{user.email}</strong>.
          </p>
        </div>
        <nav className={styles.nav} aria-label="Coaches Portal navigation">
          <Link href={COACHES_TOURNAMENTS_PATH} className="btn btn-outline btn-sm">Tournaments</Link>
          <Link href="/coaches/teams" className="btn btn-outline btn-sm">Premium Teams</Link>
        </nav>
      </div>

      {!hasCoachAccess && (
        <div className={styles.empty}>
          <p>No Coaches Portal access is linked to this account yet.</p>
          <Link href={COACHES_START_PATH} className="btn btn-primary btn-sm">Explore Coaches Portal</Link>
        </div>
      )}

      {basicContext && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Basic tournament records</h2>
            <Link href={COACHES_TOURNAMENTS_PATH} className="btn btn-ghost btn-sm">View History</Link>
          </div>
          <div className={styles.grid}>
            <Link href={COACHES_TOURNAMENTS_PATH} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardIcon}><Trophy size={18} /></div>
                <span className="badge badge-info">Basic</span>
              </div>
              <div>
                <h3 className={styles.cardTitle}>Tournament history</h3>
                <p className={styles.cardText}>{basicContext.detail}</p>
              </div>
              <span className={styles.cardAction}>Open tournament records</span>
            </Link>
          </div>
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Premium team workspaces</h2>
          <Link href={COACHES_START_PATH} className="btn btn-ghost btn-sm">Explore Premium</Link>
        </div>

        {premiumContexts.length === 0 ? (
          <div className={styles.empty}>
            <p>Premium tools appear here after a direct subscription, org-paid access, or Club coach assignment is active.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {premiumContexts.map(context => (
              <Link key={context.id} href={context.destination} className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.cardIcon}><ShieldCheck size={18} /></div>
                  <span className="badge badge-success">Premium</span>
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
        )}
      </section>

      {hasCoachAccess && (
        <section className={styles.section}>
          <div className={styles.grid}>
            <Link href={COACHES_TOURNAMENTS_PATH} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardIcon}><CalendarDays size={18} /></div>
              </div>
              <div>
                <h3 className={styles.cardTitle}>Tournament schedule</h3>
                <p className={styles.cardText}>Schedules and announcements remain available through each linked tournament record.</p>
              </div>
              <span className={styles.cardAction}>Review records</span>
            </Link>
            <Link href="/coaches/teams" className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardIcon}><Users size={18} /></div>
              </div>
              <div>
                <h3 className={styles.cardTitle}>Premium teams</h3>
                <p className={styles.cardText}>{pluralize(premiumContexts.length, 'workspace')} linked to this coach account.</p>
              </div>
              <span className={styles.cardAction}>View premium teams</span>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
