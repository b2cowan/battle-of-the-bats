import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { CalendarClock, ClipboardList, MessageSquare, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase-server';
import {
  getBasicCoachTeamForUser,
  getBasicCoachTournamentHistoryForTeam,
} from '@/lib/basic-coach-teams';
import {
  COACHES_HOME_PATH,
  COACHES_TOURNAMENTS_PATH,
  coachTeamPath,
} from '@/lib/coaches-portal-routes';
import shared from '../../coaches-portal.module.css';
import styles from './team.module.css';

type RouteParams = { params: Promise<{ basicTeamId: string }> };

const STATUS_LABEL: Record<string, string> = {
  accepted: 'Accepted',
  pending:  'Pending Review',
  waitlist: 'Waitlisted',
  rejected: 'Not Accepted',
};

const STATUS_BADGE: Record<string, string> = {
  accepted: 'badge-success',
  pending:  'badge-warning',
  waitlist: 'badge-info',
  rejected: 'badge-danger',
};

// Free-floor (opt-C) team-management capabilities. Built in later phases — listed
// here as honest "coming soon" so the bare-team home isn't a dead end and never
// over-promises. These are FREE (not a Premium pitch); the pressure ladder keeps
// pre-event surfaces pitch-free.
const COMING_SOON: Array<{ icon: typeof ClipboardList; label: string; detail: string }> = [
  { icon: ClipboardList, label: 'Master roster',  detail: 'Build your roster once and reuse it everywhere.' },
  { icon: CalendarClock,  label: 'Team schedule',  detail: 'Add practices and games your parents can see.' },
  { icon: MessageSquare,  label: 'Team messaging', detail: 'Send announcements to your roster contacts.' },
  { icon: Wallet,         label: 'Fee tracking',   detail: 'Track who has paid against your roster.' },
];

export async function generateMetadata({ params }: RouteParams) {
  const { basicTeamId } = await params;
  // Ownership-gated: never emit a team name in <title> for a non-owner / signed-out
  // request (the page body is gated, but metadata runs independently of it).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return { title: 'Your Team' };
  const team = await getBasicCoachTeamForUser({ userId: user.id, basicCoachTeamId: basicTeamId });
  return { title: team?.name ?? 'Your Team' };
}

export default async function CoachTeamHomePage({ params }: RouteParams) {
  const { basicTeamId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect(`/auth/login?next=${coachTeamPath(basicTeamId)}`);
  }

  const team = await getBasicCoachTeamForUser({ userId: user.id, basicCoachTeamId: basicTeamId });
  if (!team) {
    notFound();
  }

  const history = await getBasicCoachTournamentHistoryForTeam(basicTeamId);

  const metaParts = [team.primaryCoachName, team.sport, team.ageGroup].filter(Boolean) as string[];

  return (
    <div className={shared.page}>
      <nav className={styles.breadcrumb}>
        <Link href={COACHES_HOME_PATH}>Back to Coaches Portal</Link>
      </nav>

      <div className={shared.header}>
        <div>
          <h1 className={shared.title}>{team.name}</h1>
          <p className={shared.sub}>
            {metaParts.length > 0 ? metaParts.join(' · ') : 'Your team home'}
          </p>
        </div>
      </div>

      {/* Tournament history — empty for a no-tournament team; never leads the page. */}
      <section className={shared.section}>
        <div className={shared.sectionHeader}>
          <h2 className={shared.sectionTitle}>Tournament history</h2>
        </div>
        {history.length === 0 ? (
          <div className={shared.empty}>
            <p>This team isn&apos;t in any tournaments yet. When you register it for one, the registration and schedule show up here.</p>
          </div>
        ) : (
          <div className={styles.historyList}>
            {history.map(entry => {
              const badge = STATUS_BADGE[entry.registration.status] ?? 'badge-info';
              const label = STATUS_LABEL[entry.registration.status] ?? entry.registration.status;
              const dateRange = entry.tournament?.startDate
                ? entry.tournament.endDate
                  ? `${new Date(entry.tournament.startDate).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} - ${new Date(entry.tournament.endDate).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : new Date(entry.tournament.startDate).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
                : null;
              return (
                <Link
                  key={entry.registration.id}
                  href={`${COACHES_TOURNAMENTS_PATH}/${entry.registration.id}`}
                  className={styles.historyRow}
                >
                  <div className={styles.historyMain}>
                    <span className={styles.historyName}>{entry.tournament?.name ?? entry.registration.name}</span>
                    <span className={styles.historyMeta}>
                      {entry.org?.name ? `${entry.org.name}` : ''}
                      {dateRange ? `${entry.org?.name ? ' · ' : ''}${dateRange}` : ''}
                    </span>
                  </div>
                  <span className={`badge ${badge}`}>{label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Honest "coming soon" — the free-floor team-management tools, not a pitch. */}
      <section className={shared.section}>
        <div className={shared.sectionHeader}>
          <h2 className={shared.sectionTitle}>Coming to your team home</h2>
        </div>
        <div className={styles.comingGrid}>
          {COMING_SOON.map(({ icon: Icon, label, detail }) => (
            <div key={label} className={styles.comingItem}>
              <div className={styles.comingIcon}><Icon size={16} aria-hidden /></div>
              <div>
                <div className={styles.comingLabel}>{label}</div>
                <p className={styles.comingDetail}>{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
