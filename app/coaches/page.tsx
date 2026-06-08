import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, ShieldCheck, Trophy, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase-server';
import { getUserAccessContexts } from '@/lib/user-contexts';
import { getBasicCoachTeamsForUser, type BasicCoachTeam } from '@/lib/basic-coach-teams';
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

  const [contexts, basicTeams] = await Promise.all([
    getUserAccessContexts({ id: user.id, email: user.email }),
    getBasicCoachTeamsForUser(user.id),
  ]);

  const workspaceContexts = contexts.filter(context => context.kind === 'coaches_premium');
  const hasTournamentRecords = contexts.some(context => context.id === 'coaches-basic:tournament-records');
  const isEmpty = basicTeams.length === 0 && workspaceContexts.length === 0 && !hasTournamentRecords;

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
