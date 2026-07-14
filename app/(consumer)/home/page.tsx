import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  Star,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { getUserAccessContexts, type UserAccessContext } from '@/lib/user-contexts';
import { reconcilePendingInvitesForUser, listPendingInvitesForUser } from '@/lib/invite-reconciliation';
import { getFollowedTeamsForUser } from '@/lib/fan-follows';
import { getFollowFeed, followStatusText, FOLLOW_FEED_GROUP_ORDER, type FollowFeedEntry } from '@/lib/follow-feed';
import PendingInvitationsCard from '@/components/home/PendingInvitationsCard';
import styles from './home.module.css';

// Lives inside the (consumer) shell (owner direction 2026-07-14): the switcher keeps
// the FieldLogicHQ top bar + bottom tabs so navigation persists until a workspace is
// entered. URL stays /home — the route group adds chrome, not a path segment; the
// shell layout carries the manifest/install metadata and the install prompt.
export const metadata = {
  title: 'Your FieldLogicHQ',
};

const ICONS: Record<UserAccessContext['kind'], LucideIcon> = {
  organization: Building2,
  tournament_official: ClipboardCheck,
  coaches_basic: Trophy,
  coaches_premium: Users,
  fan: Star,
};

const KIND_LABELS: Record<UserAccessContext['kind'], string> = {
  organization: 'Admin Area',
  tournament_official: 'Tournament',
  coaches_basic: 'Coaches Portal',
  coaches_premium: 'Coaches Portal',
  fan: 'Following',
};

export default async function UserHomePage({
  searchParams,
}: {
  searchParams?: Promise<{ pick?: string }>;
}) {
  // `?pick=1` forces the launchpad even for single-access users — set by the explicit
  // "All workspaces" entry points so a genuinely multi-workspace user isn't auto-redirected
  // straight back into their one context. Single-org users normally never reach the launchpad.
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
  // launchpad (the workspace switcher). "All workspaces" remains the way back here.
  // Guard on a non-empty destination — some contexts (e.g. `organization`) currently carry an
  // empty `destination`; never `redirect('')` (it would loop/error). Those fall through to /home.
  if (!forcePicker && contexts.length === 1 && pendingInvites.length === 0 && contexts[0].destination) {
    redirect(contexts[0].destination);
  }

  // Phase 3 (one-home connective tissue): the fan hat renders as a real Following
  // section — followed teams with their live/next/recent state (same resolver the
  // Following tab uses) — instead of a bare card that says nothing about today.
  // Only resolved AFTER the single-context redirect above so auto-skipped users
  // never pay for the feed fetch.
  const fanContext = contexts.find(context => context.kind === 'fan');
  const workspaceContexts = contexts.filter(context => context.kind !== 'fan');

  let feedEntries: FollowFeedEntry[] = [];
  if (fanContext) {
    const follows = await getFollowedTeamsForUser(user.id);
    if (follows.length > 0) {
      feedEntries = await getFollowFeed(
        follows.map(f => ({
          teamId: f.teamId,
          teamName: f.teamName,
          orgSlug: f.orgSlug,
          tournamentSlug: f.tournamentSlug,
        })),
      );
    }
    feedEntries.sort((a, b) => FOLLOW_FEED_GROUP_ORDER[a.group] - FOLLOW_FEED_GROUP_ORDER[b.group]);
  }

  return (
    <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Your FieldLogicHQ</h1>
          {/* Email appears once, in the footer — not duplicated here (owner tweak). */}
          <p className={styles.sub}>Every hat, one home</p>
        </header>

        <PendingInvitationsCard invitations={pendingInvites} />

        <div className={styles.contextList}>
          {workspaceContexts.map(context => (
            <ContextCard key={context.id} context={context} />
          ))}
        </div>

        {/* Always present (mockup-approved shape): live rows when the account follows
            teams, an honest hand-off when follows are non-team entities, and a
            discover nudge when there are none — so admins/coaches meet Following here. */}
        <section className={styles.followSection} aria-label="Following">
          <div className={styles.followHeader}>
            <span>Following</span>
            <Link href="/following" className={styles.followAll}>
              All following <ArrowRight size={11} strokeWidth={2.4} aria-hidden />
            </Link>
          </div>
          {feedEntries.length > 0 ? (
            feedEntries.map(entry => (
              <Link
                key={`${entry.orgSlug}/${entry.tournamentSlug}/${entry.teamId}`}
                href={entry.href}
                className={styles.followRow}
              >
                <span className={styles.followInfo}>
                  <span className={styles.followTeam}>{entry.teamName}</span>
                  <span className={styles.followEvent}>{entry.tournamentName}</span>
                </span>
                <FollowStatusChip entry={entry} />
              </Link>
            ))
          ) : fanContext ? (
            <Link href="/following" className={styles.followRow}>
              <span className={styles.followInfo}>
                {/* Neutral copy — follows can be tournaments/orgs, not only teams. */}
                <span className={styles.followTeam}>Everything you follow</span>
                <span className={styles.followEvent}>{fanContext.subtitle}</span>
              </span>
              <span className={styles.followChip}>View</span>
            </Link>
          ) : (
            <Link href="/discover" className={styles.followRow}>
              <span className={styles.followInfo}>
                <span className={styles.followTeam}>Follow teams you care about</span>
                <span className={styles.followEvent}>Live scores &amp; next games land here</span>
              </span>
              <span className={styles.followChip}>Browse</span>
            </Link>
          )}
        </section>

        {/* Notification settings lives on the Account tab (owner direction) —
            no duplicate entry here. */}
        <footer className={styles.footer}>
          <span>Signed in as {user.email}</span>
        </footer>
    </div>
  );
}

function ContextCard({ context }: { context: UserAccessContext }) {
  const Icon = ICONS[context.kind];

  // Per-card notification shortcuts removed (owner direction 2026-07-14): they all
  // land on the same hub, so ONE quiet footer link carries that job for the page.
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

// One compact status chip per followed team — the wording comes from the shared
// followStatusText helper so this stays in step with the Following tab.
function FollowStatusChip({ entry }: { entry: FollowFeedEntry }) {
  const status = followStatusText(entry);
  return (
    <span className={status.live ? `${styles.followChip} ${styles.followChipLive}` : styles.followChip}>
      {status.text}
    </span>
  );
}

