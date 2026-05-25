import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  LayoutGrid,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { getUserAccessContexts, type UserAccessContext } from '@/lib/user-contexts';
import styles from './home.module.css';

export const metadata = { title: 'Home - FieldLogicHQ' };

const ICONS: Record<UserAccessContext['kind'], LucideIcon> = {
  organization: Building2,
  tournament_official: ClipboardCheck,
  coaches_basic: Trophy,
  coaches_premium: Users,
};

const KIND_LABELS: Record<UserAccessContext['kind'], string> = {
  organization: 'Admin Area',
  tournament_official: 'Tournament',
  coaches_basic: 'Coaches Portal',
  coaches_premium: 'Coaches Portal',
};

export default async function UserHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect('/auth/login?next=/home');
  }

  if (await isPlatformAdminEmail(user.email)) {
    redirect('/platform-admin');
  }

  const contexts = await getUserAccessContexts({
    id: user.id,
    email: user.email,
  });

  if (contexts.length === 0) {
    redirect('/auth/signup');
  }

  if (contexts.length === 1) {
    redirect(contexts[0].destination);
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.iconWrap}>
            <LayoutGrid size={21} strokeWidth={1.8} aria-hidden />
          </div>
          <h1 className={styles.title}>Home</h1>
          <p className={styles.sub}>
            {contexts.length} access areas for {user.email}
          </p>
        </header>

        <div className={styles.contextList}>
          {contexts.map(context => (
            <ContextCard key={context.id} context={context} />
          ))}
        </div>

        <footer className={styles.footer}>
          Signed in as {user.email}
        </footer>
      </div>
    </div>
  );
}

function ContextCard({ context }: { context: UserAccessContext }) {
  const Icon = ICONS[context.kind];
  return (
    <Link href={context.destination} className={styles.contextItem}>
      <div className={styles.contextIcon} data-kind={context.kind}>
        <Icon size={20} strokeWidth={1.8} aria-hidden />
      </div>
      <div className={styles.contextInfo}>
        <div className={styles.contextTop}>
          <span className={styles.contextType}>{KIND_LABELS[context.kind]}</span>
          <span className={styles.badge} data-kind={context.kind}>{context.badgeLabel}</span>
        </div>
        <div className={styles.contextTitle}>{context.title}</div>
        <div className={styles.contextMeta}>
          <span>{context.subtitle}</span>
          <span>{context.detail}</span>
        </div>
      </div>
      <span className={styles.enterBtn} aria-label={`Open ${context.title}`}>
        <ArrowRight size={16} strokeWidth={2.4} aria-hidden />
      </span>
    </Link>
  );
}
