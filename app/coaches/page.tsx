import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, Inbox, ShieldCheck, Trophy, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { getUserAccessContexts } from '@/lib/user-contexts';
import {
  getBasicCoachTeamsForUser,
  getClaimableRegistrationsForUser,
  type BasicCoachTeam,
} from '@/lib/basic-coach-teams';
import {
  COACHES_START_PATH,
  COACHES_TOURNAMENTS_PATH,
  COACHES_TEAMS_PATH,
  coachTeamPath,
} from '@/lib/coaches-portal-routes';
import styles from './coaches-portal.module.css';

export const metadata = { title: 'Coaches Portal' };

function teamMeta(team: BasicCoachTeam): string {
  const parts = [team.primaryCoachName, team.sport, team.ageGroup].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(' · ') : 'Your team home';
}

export default async function CoachesPortalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect(`/auth/login?next=/coaches`);
  }

  // FieldLogicHQ staff are NOT coaches — never run coach discovery on a platform-admin session
  // or surface a claim prompt for them (mirrors /home).
  if (await isPlatformAdminEmail(user.email)) {
    redirect('/platform-admin');
  }

  // Narrowed string for use inside closures (control-flow narrowing is lost in the .map below).
  const email = user.email;

  const [contexts, basicTeams, claimable] = await Promise.all([
    getUserAccessContexts({ id: user.id, email }),
    getBasicCoachTeamsForUser(user.id),
    getClaimableRegistrationsForUser(user.id, email),
  ]);

  const workspaceContexts = contexts.filter(context => context.kind === 'coaches_premium');
  const hasTournamentRecords = contexts.some(context => context.id === 'coaches-basic:tournament-records');
  const isEmpty = basicTeams.length === 0 && workspaceContexts.length === 0 && !hasTournamentRecords && claimable.length === 0;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Your Coaches Portal</h1>
          <p className={styles.sub}>
            Everything for the teams you coach — <strong>{user.email}</strong>.
          </p>
        </div>
      </div>

      {/* Claim-by-email — admin-added / imported registrations matching this account's email
          that aren't linked yet. Routes to the existing /coaches/join claim screen (explicit
          claim — no silent auto-link until Phase 8 email verification). */}
      {claimable.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Claim your team{claimable.length === 1 ? '' : 's'}</h2>
          </div>
          <p style={{ margin: '0 0 1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {claimable.length === 1 ? 'A team was' : 'Teams were'} registered with your email by an organizer.
            Claim {claimable.length === 1 ? 'it' : 'them'} to see status, schedule, and updates in your portal.
          </p>
          <div className={styles.grid}>
            {claimable.map(reg => (
              <div key={reg.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.cardIcon}><Inbox size={18} /></div>
                </div>
                <div>
                  <h3 className={styles.cardTitle}>{reg.name}</h3>
                  <p className={styles.cardText}>
                    {reg.tournament?.name ?? 'Tournament registration'}
                    {reg.orgName ? ` · ${reg.orgName}` : ''}
                  </p>
                </div>
                <Link
                  href={`/coaches/join?registrationId=${encodeURIComponent(reg.id)}&email=${encodeURIComponent(email)}&next=${encodeURIComponent(COACHES_TOURNAMENTS_PATH)}`}
                  className="btn btn-outline btn-sm"
                  style={{ marginTop: 'auto' }}
                >
                  Claim team
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Your teams — the org-less team homes (the coach's home base) */}
      {basicTeams.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Your teams</h2>
          </div>
          <div className={styles.grid}>
            {basicTeams.map(team => (
              <Link key={team.id} href={coachTeamPath(team.id)} className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.cardIcon}><Users size={18} /></div>
                </div>
                <div>
                  <h3 className={styles.cardTitle}>{team.name}</h3>
                  <p className={styles.cardText}>{teamMeta(team)}</p>
                </div>
                <span className={styles.cardAction}>Open team home</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Tournament records — only when the coach has registered for a tournament */}
      {hasTournamentRecords && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Tournaments</h2>
          </div>
          <div className={styles.grid}>
            <Link href={COACHES_TOURNAMENTS_PATH} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardIcon}><Trophy size={18} /></div>
              </div>
              <div>
                <h3 className={styles.cardTitle}>Tournament records &amp; history</h3>
                <p className={styles.cardText}>Your registrations, schedules, and statuses across every tournament.</p>
              </div>
              <span className={styles.cardAction}>Open tournament records</span>
            </Link>
          </div>
        </section>
      )}

      {/* Honest empty state — never presupposes a tournament registration */}
      {isEmpty && (
        <section className={styles.section}>
          <div className={styles.empty}>
            <p>Your teams show up here. Register a team for a tournament, or start a free team home to manage your season.</p>
            <Link href={COACHES_START_PATH} className="btn btn-outline btn-sm">Explore the Coaches Portal</Link>
          </div>
        </section>
      )}

      {/* Team workspaces — only when the coach actually has a Premium workspace */}
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

      {/* Premium upgrade — additive, availability-aware; only when no workspace yet */}
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
                  Premium adds the serious-operator tools — a lineup builder, dues automation, team budget, and document storage. It carries over automatically if your organization joins FieldLogicHQ.
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
