import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  LayoutGrid,
  Plus,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { getUserAccessContexts, type UserAccessContext } from '@/lib/user-contexts';
import InstallAppPrompt from '@/components/InstallAppPrompt';
import styles from './home.module.css';

export const metadata = {
  title: 'Home - FieldLogicHQ',
  manifest: '/manifest.json',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'FieldLogicHQ',
  },
};

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
    redirect('/start');
  }

  // Note: single-context users are intentionally NOT auto-redirected here. Landing on
  // /home (on a base-URL login) lets them see the switcher + "Start something new" so
  // they can add a second workspace. Deep links skip /home entirely (login honours an
  // explicit `next` before ever calling getAuthDestination).

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.iconWrap}>
            <LayoutGrid size={21} strokeWidth={1.8} aria-hidden />
          </div>
          <h1 className={styles.title}>Home</h1>
          <p className={styles.sub}>
            {contexts.length} access {contexts.length === 1 ? 'area' : 'areas'} for {user.email}
          </p>
        </header>

        <div className={styles.contextList}>
          {contexts.map(context => (
            <ContextCard key={context.id} context={context} />
          ))}
          <StartNewCard />
        </div>

        <footer className={styles.footer}>
          Signed in as {user.email}
        </footer>
      </div>
      <InstallAppPrompt
        appName="FieldLogicHQ"
        subtitle="Your teams, schedules and scores — one tap away."
        dismissKey="flhq-install-member"
      />
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

function StartNewCard() {
  return (
    <Link href="/start" className={`${styles.contextItem} ${styles.startNewItem}`}>
      <div className={`${styles.contextIcon} ${styles.startNewIcon}`}>
        <Plus size={20} strokeWidth={2} aria-hidden />
      </div>
      <div className={styles.contextInfo}>
        <div className={styles.contextTop}>
          <span className={styles.contextType}>New workspace</span>
        </div>
        <div className={styles.contextTitle}>Start something new</div>
        <div className={styles.contextMeta}>
          <span>Run a tournament, coach a team, or explore league &amp; club</span>
        </div>
      </div>
      <span className={styles.enterBtn} aria-label="Start something new">
        <ArrowRight size={16} strokeWidth={2.4} aria-hidden />
      </span>
    </Link>
  );
}
