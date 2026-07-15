import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Inbox, ShieldCheck, Trophy, Users } from 'lucide-react';
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
import { excludeActivePremiumUpgrades } from '@/lib/coach-team-page';
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

  const [contexts, allBasicTeams, claimable] = await Promise.all([
    getUserAccessContexts({ id: user.id, email }),
    getBasicCoachTeamsForUser(user.id),
    getClaimableRegistrationsForUser(user.id, email),
  ]);
  // A team upgraded to a LIVE Premium portal is the coach's Premium team now, not a free one — drop
  // it from the free "Your teams" list (its team page also redirects into Premium). Canceled
  // upgrades stay (the free team is usable again).
  const basicTeams = await excludeActivePremiumUpgrades(allBasicTeams);

  const workspaceContexts = contexts.filter(context => context.kind === 'coaches_premium');
  const hasTournamentRecords = contexts.some(context => context.id === 'coaches-basic:tournament-records');
  const isEmpty = basicTeams.length === 0 && workspaceContexts.length === 0 && !hasTournamentRecords && claimable.length === 0;

  // Skip the hub when there's nothing to choose between: a coach with exactly ONE team
  // (a free team home OR a Premium workspace) lands straight on that team. The hub only
  // earns its place when there's a real choice (2+ teams, or a mix). A pending claim is
  // an action that needs the hub, so never auto-advance past it. Tournament records and
  // the conversion pitch are reachable from within the single team, so they don't block
  // the redirect.
  if (claimable.length === 0 && basicTeams.length + workspaceContexts.length === 1) {
    if (basicTeams.length === 1) {
      redirect(coachTeamPath(basicTeams[0].id));
    }
    redirect(workspaceContexts[0].destination);
  }

  // Persona-conditional pitch (CP-10): only nudge a coach toward something they don't
  // already have. No pitch for Premium-workspace coaches, the truly-empty (the empty
  // state owns that), or coaches who already run BOTH a free team home + tournaments.
  const hasStandalone = basicTeams.length > 0;
  const pitch =
    // No pitch for: Premium-workspace coaches, the truly-empty (the empty state owns
    // it), coaches with a pending claim (the claim prompt is the action — don't add a
    // competing CTA), or coaches who already run BOTH a free team home + tournaments.
    workspaceContexts.length > 0 || isEmpty || claimable.length > 0 || (hasStandalone && hasTournamentRecords)
      ? null
      : hasStandalone
        ? {
            // standalone-only → premium upsell (ghost; lower-priority secondary action)
            // Canon (PLAN_PRICING_FACTS coach bridge, /strategy 2026-07-14): the portal is
            // absorbed at CLUB tier only — never imply any paid org plan carries it.
            title: 'Take your team further',
            body: 'Premium adds the serious-operator tools — lineup builder, dues automation, team budget, and document storage. If your organization joins FieldLogicHQ on the Club plan, your portal is included — you stop paying for it.',
            href: COACHES_START_PATH,
            label: 'Express interest',
            primary: false,
          }
        : {
            // tournament-only → the thing they're missing: a free team home (btn-lime)
            title: 'Start a free team home',
            body: 'Manage your roster, schedule, fees, and parent announcements year-round — free between tournaments.',
            href: COACHES_START_PATH,
            label: 'Start free team home',
            primary: true,
          };

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
            <h2 className={styles.sectionTitle} style={{ color: 'var(--logic-lime)' }}>Claim your team{claimable.length === 1 ? '' : 's'}</h2>
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
                  className="btn btn-lime"
                  style={{ width: '100%', marginTop: 'auto' }}
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
            {/* Hub empty-state primary CTA → btn-lime (CP-4/CP-10); CP-1 bans btn-sm as a primary size. */}
            <Link href={COACHES_START_PATH} className="btn btn-lime">Start free team home</Link>
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

      {/* Persona-conditional pitch (Rule CP-10), demoted to a compact ruled banner
          (CP-4) — never a card at the coach's-own-content weight, and never shown to a
          coach who already has everything:
            - workspace (Premium)         → no pitch
            - has BOTH standalone + tournaments → no pitch (nothing left to nudge)
            - standalone-only             → "take your team further" (ghost)
            - tournament-only             → "start a free team home" (btn-lime — the
                                            thing they're missing)
          The empty state above owns the truly-empty case. */}
      {pitch && (
        <div className={styles.pitchBanner}>
          <div className={styles.pitchBannerText}>
            <p className={styles.pitchBannerTitle}>{pitch.title}</p>
            <p className={styles.pitchBannerBody}>{pitch.body}</p>
          </div>
          <div className={styles.pitchBannerActions}>
            <Link href={pitch.href} className={pitch.primary ? 'btn btn-lime btn-sm' : 'btn btn-ghost btn-sm'}>
              {pitch.label}
            </Link>
          </div>
        </div>
      )}

      {/* Organizer cross-sell (conversion sweep C6c) — coaches are a high-intent
          audience for running their own event, and this hub had zero doors to it.
          Same demoted ruled-banner weight as the pitch above (CP-4: never a card
          at the coach's-own-content weight), ghost CTA, always low-pressure.
          CP-10 gating: suppressed while a claim is pending (the claim prompt is
          the action — no competing CTA) and on the truly-empty hub (the empty
          state owns that moment). It DOES show for Premium/has-both coaches —
          unlike the team-tools pitch above, running an event is orthogonal to
          what they already have. */}
      {claimable.length === 0 && !isEmpty && (
        <div className={styles.pitchBanner}>
          <div className={styles.pitchBannerText}>
            <p className={styles.pitchBannerTitle}>Run your own event</p>
            <p className={styles.pitchBannerBody}>
              Tournaments with live scores, standings &amp; brackets — like the ones your teams
              play in. Free to start.
            </p>
          </div>
          <div className={styles.pitchBannerActions}>
            <Link href="/start/tournament" className="btn btn-ghost btn-sm">Run an event</Link>
          </div>
        </div>
      )}
    </div>
  );
}
