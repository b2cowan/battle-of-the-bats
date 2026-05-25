import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldCheck, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase-server';
import { getUserAccessContexts } from '@/lib/user-contexts';
import { COACHES_START_PATH } from '@/lib/coaches-portal-routes';
import styles from '../coaches-portal.module.css';

export const metadata = { title: 'Coaches Portal - Premium Teams' };

export default async function CoachesPremiumTeamsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect('/auth/login?next=/coaches/teams');
  }

  const contexts = await getUserAccessContexts({ id: user.id, email: user.email });
  const premiumContexts = contexts.filter(context => context.kind === 'coaches_premium');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Premium Teams</h1>
          <p className={styles.sub}>
            Premium Coaches Portal workspaces linked to <strong>{user.email}</strong>.
          </p>
        </div>
        <nav className={styles.nav} aria-label="Coaches Portal navigation">
          <Link href="/coaches" className="btn btn-outline btn-sm">Portal Home</Link>
          <Link href="/coaches/tournaments" className="btn btn-outline btn-sm">Tournaments</Link>
        </nav>
      </div>

      {premiumContexts.length === 0 ? (
        <div className={styles.empty}>
          <div style={{ marginBottom: '1rem', color: 'var(--logic-lime)' }}>
            <Users size={28} />
          </div>
          <p>Premium team workspaces appear here after a subscription, org-paid access, or Club coach assignment is active.</p>
          <Link href={COACHES_START_PATH} className="btn btn-primary btn-sm">Explore Premium</Link>
        </div>
      ) : (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Available workspaces</h2>
          </div>
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
        </section>
      )}
    </div>
  );
}
