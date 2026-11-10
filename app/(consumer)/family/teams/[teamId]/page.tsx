import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import warm from '@/components/consumer/warmTheme.module.css';
import styles from '../../family.module.css';
import accountForm from '@/components/auth/AccountForm.module.css';
import FamilyTeamClient from './FamilyTeamClient';
import { GUARDIAN_TIER_ENABLED } from '@/lib/family-guardian';
import { getOrgForGate, getVerifiedLinkForUserTeam } from '@/lib/family-access';
import { resolveGuardianPayloadForLink } from '@/lib/family-guardian-view';
import { resolveFamilyRecapAvailability } from '@/lib/family-recap';
import { connectedLines, familyChildHref, readFamilyTeam } from '@/lib/family-home';
import { HIDDEN } from '@/lib/family-team-schedule';
import { familyFeedUrl } from '@/lib/family-calendar';
import { canonicalAppOrigin } from '@/lib/app-origin';
import { FAMILY_HOME_PATH } from '@/lib/family-invitation-panel';
import { FAMILY_HOME_WORDS as W } from '@/lib/family-home-words';
import FamilyCalendarCard from '../../_parts/FamilyCalendarCard';
import { FamilyFoot, SignupRow } from '../../_parts/FamilyRows';

/**
 * /family/teams/[teamId] — a connected parent's view of one of their children's teams, either kind (Signed-in family accounts
 * Stage 4a, Part 6; drawing tab 3). One id space: the team is found among the teams THIS ACCOUNT reaches now
 * (`getFamilyReach`, lib/family-home.ts), so the id in the URL selects a team and never stands in for a connection. The rep
 * route of before keeps working for existing links (a rep team's id is the same id).
 *
 * The page: the team line; the one-time "You've joined" note (`?joined=1`); Your player; From the coach (rep only); the
 * schedule with Up next; Your calendar (here only when the parent has ONE team — otherwise it lives on the family list); Your
 * sign-up; /legal draft (b) and "Connected to {child}" with Manage. A parent who reaches no such team now is told so quietly;
 * a rep team whose season has CLOSED still opens its recap door.
 *
 * ⚠ 404 while the guardian tier is off (every family page). Never indexed, never cached (the route is in the service worker's
 * NEVER_CACHE list — see public/sw.js; the /coaches PII-leak lesson applies to every authed route).
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your team',
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className={warm.warm}>
      <div className={styles.page}>{children}</div>
    </div>
  );
}

function Quiet({ title, body, action }: { title: string; body: string; action: { href: string; label: string } }) {
  return (
    <Shell>
      <div className={`${styles.card} ${styles.quietCard}`}>
        <h1 className={styles.joinTitle}>{title}</h1>
        <p className={styles.joinLede}>{body}</p>
        <div className={styles.actions}>
          <Link href={action.href} className={`${accountForm.primary} ${styles.quietButton}`}>{action.label}</Link>
        </div>
      </div>
    </Shell>
  );
}

export default async function FamilyTeamPage({ params, searchParams }: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ joined?: string }>;
}) {
  if (!GUARDIAN_TIER_ENABLED) notFound();
  const [{ teamId }, { joined }] = await Promise.all([params, searchParams]);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <Quiet
        title={W.family.signInTitle}
        body={W.family.signInBody}
        action={{ href: `/auth/login?next=${encodeURIComponent(`/family/teams/${teamId}`)}`, label: W.family.signIn }}
      />
    );
  }

  const found = await readFamilyTeam(user.id, teamId);
  if (!found) {
    // A rep team whose season has CLOSED reaches nothing live, and its recap is the whole point of this page for the parent
    // (Chunk D 3.2): the recap door stays, rep-only and unchanged.
    const recapLink = await getVerifiedLinkForUserTeam(user.id, teamId, 'recap');
    if (recapLink) {
      const recap = await resolveFamilyRecapAvailability({ link: recapLink, repTeamId: teamId });
      if (recap.status === 'ready') {
        return (
          <Quiet
            title="The season has finished"
            body="There’s no live schedule for this team right now — but your player’s season recap is here to keep."
            action={{ href: `/family/teams/${teamId}/recap`, label: 'Read the season recap' }}
          />
        );
      }
    }
    return <Quiet title={W.team.notConnectedTitle} body={W.team.notConnectedBody} action={{ href: FAMILY_HOME_PATH, label: W.team.notConnectedButton }} />;
  }

  const { home, team, schedule } = found;
  const shown = schedule === HIDDEN ? null : schedule;
  const childrenHere = home.children.filter(c => team.childIds.includes(c.childId));
  const onlyTeam = home.teams.length === 1;

  // The rep half: the guardian payload (the tier boundary's one resolver) and the recap door, exactly as the rep page read them.
  let guardian = null;
  let recapDoor: { href: string } | { comingAfter: string } | null = null;
  if (team.kind === 'rep' && shown) {
    const link = await getVerifiedLinkForUserTeam(user.id, teamId);
    if (link) {
      guardian = await resolveGuardianPayloadForLink(link, teamId);
      const recapLink = await getVerifiedLinkForUserTeam(user.id, teamId, 'recap');
      const org = await getOrgForGate(link.orgId);
      const recap = await resolveFamilyRecapAvailability({ link: recapLink ?? link, repTeamId: teamId, org });
      recapDoor = recap.status === 'ready' ? { href: `/family/teams/${teamId}/recap` }
        : recap.status === 'season_open' ? { comingAfter: recap.seasonName } : null;
    }
  }

  const [calendarUrl, connected] = await Promise.all([
    onlyTeam ? familyFeedUrl(user.id, canonicalAppOrigin()) : Promise.resolve(null),
    connectedLines(user.id, childrenHere),
  ]);
  const signups = home.signups.filter(s => s.childIds.some(id => team.childIds.includes(id)));

  const teamLine = team.kind === 'league' && team.divisionName ? `${team.teamName} · ${team.divisionName}` : team.teamName;
  const metaLine = shown?.record
    ? `${shown.record.wins}–${shown.record.losses}–${shown.record.ties}`
    : team.seasonLine;

  return (
    <Shell>
      <FamilyTeamClient
        teamName={teamLine}
        metaLine={metaLine}
        backHref={onlyTeam ? null : FAMILY_HOME_PATH}
        joined={joined === '1' ? team.children : null}
        guardian={guardian}
        leaguePlayers={team.kind === 'league' ? team.children.map(firstName => ({ firstName, division: team.divisionName })) : null}
        recap={recapDoor}
        entries={shown ? shown.entries : null}
      >
        {onlyTeam && <FamilyCalendarCard initialUrl={calendarUrl} />}
        {signups.map(s => <SignupRow key={s.registrationId} row={s} />)}
        <FamilyFoot
          kids={team.children}
          club={home.clubs.find(c => c.orgId === team.orgId)?.name ?? (shown?.orgName ?? '')}
          connected={connected.map(c => ({ child: c.child, others: c.others, href: familyChildHref(c.childId) }))}
        />
      </FamilyTeamClient>
    </Shell>
  );
}
