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
import { reconcilePendingInvitesForUser, listPendingInvitesForUser } from '@/lib/invite-reconciliation';
import PendingInvitationsCard from '@/components/home/PendingInvitationsCard';
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

export default async function UserHomePage({
  searchParams,
}: {
  searchParams?: Promise<{ pick?: string }>;
}) {
  // `?pick=1` forces the launchpad even for single-access users — set by the explicit
  // "All workspaces" / "Start something new" entry points so they aren't auto-redirected
  // straight back into their one context (which would make adding a 2nd workspace impossible).
  const { pick } = (await searchParams) ?? {};
  const forcePicker = pick === '1';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect('/auth/login?next=/home');
  }

  if (await isPlatformAdminEmail(user.email)) {
    redirect('/platform-admin');
  }

  // Reconcile pending invites onto this identity before resolving contexts, so a
  // self-registered/logged-in invitee's orphaned invite is re-pointed and surfaces
  // (mig 128). Mirrors getAuthDestination for direct /home navigation.
  await reconcilePendingInvitesForUser({ id: user.id, email: user.email, emailConfirmedAt: user.email_confirmed_at });

  const [contexts, pendingInvites] = await Promise.all([
    getUserAccessContexts({ id: user.id, email: user.email }),
    listPendingInvitesForUser(user.id),
  ]);

  if (contexts.length === 0 && pendingInvites.length === 0) {
    // No active context AND no pending invite — send to the account-first front door,
    // not straight into org-creation.
    redirect('/start');
  }

  // If they have ONLY pending invites (no active context), we render /home with the
  // PendingInvitationsCard so they can Accept/Decline in place — replacing the old
  // context-free bounce into the accept-invite form.

  // Auto-drop single-access users straight into their one area: a chooser with a single
  // choice is friction. When the user has exactly ONE access context and NO pending invite
  // to act on, redirect to that context's canonical destination (the same href the card
  // would link to). Users with >1 context, or any pending invite, still land on the /home
  // launchpad (switcher + "Start something new"). "All workspaces" remains the way back here.
  // Guard on a non-empty destination — some contexts (e.g. `organization`) currently carry an
  // empty `destination`; never `redirect('')` (it would loop/error). Those fall through to /home.
  if (!forcePicker && contexts.length === 1 && pendingInvites.length === 0 && contexts[0].destination) {
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
            {contexts.length > 0
              ? `${contexts.length} access ${contexts.length === 1 ? 'area' : 'areas'} for ${user.email}`
              : `Signed in as ${user.email}`}
          </p>
        </header>

        <PendingInvitationsCard invitations={pendingInvites} />

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
