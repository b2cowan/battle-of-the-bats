import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldCheck, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase-server';
import { getUserAccessContexts } from '@/lib/user-contexts';
import { COACHES_START_PATH } from '@/lib/coaches-portal-routes';
import styles from '../coaches-portal.module.css';

export const metadata = { title: 'Coaches Portal - Team Workspaces' };

export default async function CoachesTeamWorkspacesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect('/auth/login?next=/coaches/teams');
  }

  const contexts = await getUserAccessContexts({ id: user.id, email: user.email });
  const workspaceContexts = contexts.filter(context => context.kind === 'coaches_premium');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Team workspaces</h1>
          <p className={styles.sub}>
            Year-round team workspaces linked to <strong>{user.email}</strong>.
          </p>
        </div>
      </div>

      {workspaceContexts.length === 0 ? (
        <div className={styles.empty}>
          <div style={{ marginBottom: '1rem', color: 'var(--logic-lime)' }}>
            <Users size={28} />
          </div>
          <p>Premium adds the serious-operator tools — a lineup builder, dues automation, team budget, and document storage. It carries over automatically if your organization joins FieldLogicHQ.</p>
          <Link href={COACHES_START_PATH} className="btn btn-ghost btn-sm">Express interest</Link>
        </div>
      ) : (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Available workspaces</h2>
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
    </div>
  );
}
