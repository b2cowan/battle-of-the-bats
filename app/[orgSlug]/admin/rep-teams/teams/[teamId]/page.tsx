'use client';
/**
 * Rep Teams › a team — THE TEAM PAGE (Club Tier Stage 2, specimen 2; hub v15). It replaced the season
 * ("program year") page: the club now works on a TEAM and its live season, never on a year it picks.
 * The club runs what it owns here — the team's details, its seasons, its coaches — and says plainly
 * what stays the coach's.
 *
 *   header   — back to Teams; eyebrow "Rep Teams · {group}"; the title and its state chip; the two
 *              season doors (Close the season · Start next season), owner and admin only (Ask 1 (a)).
 *   cards    — Record (a report card), then Roster, Next event and Tryouts as DOOR cards. A team with
 *              no live season shows its closed-season card instead (specimen 3); a team with none, the
 *              first-season door; a team with two open, the refusal in words.
 *   sections — Coaches (each row opens the person on the Coaches page) · What the club sees (fixed
 *              copy) · Team details (AUTOSAVE, the transient word at its foot; archive lives here) ·
 *              Seasons (a closed season opens its past-season page; the live row opens nothing).
 *   states   — archived ("Bring back", with the team-cap window at the cap); a failed load keeps the
 *              back arrow and retries (J4-002).
 * The old season page redirects here, and G04's dead "Coming Soon" branch went with it.
 */
import { use, useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, Book, Building2, CalendarCheck, CalendarPlus, ExternalLink, Lock, RotateCcw } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import PageNotice, { useNotice } from '@/components/admin/kit/club/PageNotice';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import type { TeamCapRefusal } from '@/components/admin/kit/club/TeamCapDialog';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { CoachCard, CoachDoorCard, CoachEyebrow, CoachFigure, kit } from '@/components/coaches/kit';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import {
  Callout, ClubRow, ClubRowList, ClubSection, EmptyCard, LoadFailed, PageLoading, RepChip, repKit,
  SaveWord, useDeferredLoad, useLatestRead,
} from '@/components/admin/kit/club/RepKit';
import type { SeasonPreflight } from '@/components/admin/kit/club/SeasonDialogs';
import { usePublishRailTeam } from '@/components/admin/kit/useRailTeam';
import { TEAM_COLOUR_EXAMPLE, nextEventLines } from '@/lib/club-board-view';
import {
  FIRST_SEASON_TITLE, closedCardLine, firstSeasonLine, reopenLink, startButton, twoOpenBody, twoOpenTitle,
} from '@/lib/club-season-words';
import { formatStoredDate } from '@/lib/timezone';
import { pluralize } from '@/lib/utils';
import { OFFERED_SPORT_OPTIONS } from '@/lib/sports';
import type { ClubBoardRow } from '@/lib/club-team-board';
import type { RepProgramYear, RepTeam, RepTeamGroup } from '@/lib/types';

const TeamCapDialog = dynamic(() => import('@/components/admin/kit/club/TeamCapDialog'));
const StartSeasonDialog = dynamic(() => import('@/components/admin/kit/club/SeasonDialogs').then(m => m.StartSeasonDialog));
const CloseSeasonDialog = dynamic(() => import('@/components/admin/kit/club/SeasonDialogs').then(m => m.CloseSeasonDialog));
const FirstSeasonDialog = dynamic(() => import('@/components/admin/kit/club/SeasonDialogs').then(m => m.FirstSeasonDialog));

interface TeamSeason {
  id: string; name: string; year: number; status: string; isLive: boolean;
  recordText: string | null; rosterCount: number;
  headCoaches: { userId: string; name: string | null }[];
}
interface TeamRead {
  team: RepTeam;
  programYears: RepProgramYear[];
  board: ClubBoardRow;
  seasons: TeamSeason[];
}
interface StaffRow { membershipId: string; userId: string; name: string | null; email: string | null; coachRole: string; kindWord: string }
interface InviteRow { id: string; email: string; coachRole: string; kindWord: string; status: string; invitedAt: string; expired: boolean }
interface CoachesRead { staff: StaffRow[]; invitations: InviteRow[] }

type Details = { name: string; groupId: string; division: string; color: string; sport: string; description: string };
const HEX = /^#[0-9a-fA-F]{6}$/;

function detailsOf(team: RepTeam): Details {
  return {
    name: team.name, groupId: team.groupId ?? '', division: team.division ?? '', color: team.color ?? '',
    sport: team.sport ?? '', description: team.description ?? '',
  };
}
const detailsSig = (d: Details) => JSON.stringify({
  name: d.name.trim(), groupId: d.groupId, division: d.division.trim(), color: d.color.trim(), sport: d.sport,
  description: d.description.trim(),
});

export default function TeamPage({ params }: { params: Promise<{ orgSlug: string; teamId: string }> }) {
  const { orgSlug, teamId } = use(params);
  const { currentOrg, userRole, loading: orgLoading } = useOrg();
  const canWrite = userRole === 'owner' || userRole === 'admin';
  const q = `orgSlug=${encodeURIComponent(orgSlug)}`;
  const base = `/${orgSlug}/admin/rep-teams`;
  const teamBase = `${base}/teams/${teamId}`;

  const [read, setRead] = useState<TeamRead | null>(null);
  const [coaches, setCoaches] = useState<CoachesRead | null>(null);
  const [preflight, setPreflight] = useState<SeasonPreflight | null>(null);
  const [groups, setGroups] = useState<RepTeamGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ notFound: boolean } | null>(null);
  const [notice, setNotice] = useNotice();
  const [windowOpen, setWindowOpen] = useState<'start' | 'close' | 'first' | 'archive' | null>(null);
  const [busy, setBusy] = useState(false);
  const [capRefusal, setCapRefusal] = useState<TeamCapRefusal | null>(null);

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const current = beginRead();
    setLoadError(null);
    try {
      const [teamRes, coachesRes, groupsRes, seasonsRes] = await Promise.all([
        fetch(`/api/admin/rep-teams/teams/${teamId}?${q}`, { cache: 'no-store' }),
        fetch(`/api/admin/rep-teams/teams/${teamId}/coaches?${q}`, { cache: 'no-store' }),
        fetch(`/api/admin/rep-teams/groups?${q}`, { cache: 'no-store' }),
        // The season doors' preflight is the owner's and an admin's (write-gated); it never refuses.
        canWrite ? fetch(`/api/admin/rep-teams/teams/${teamId}/seasons?${q}`, { cache: 'no-store' }) : Promise.resolve(null),
      ]);
      if (!teamRes.ok) {
        if (current()) setLoadError({ notFound: teamRes.status === 404 || teamRes.status === 403 });
        return;
      }
      const teamData = await teamRes.json() as TeamRead;
      const coachesData = coachesRes.ok ? await coachesRes.json() as CoachesRead : null;
      const groupsData = await groupsRes.json().catch(() => ({}));
      const preflightData = seasonsRes?.ok ? await seasonsRes.json() as SeasonPreflight : null;
      if (!current()) return;
      setRead(teamData);
      if (coachesData) setCoaches(coachesData);
      setGroups(Array.isArray(groupsData.groups) ? groupsData.groups : []);
      if (preflightData) setPreflight(preflightData);
    } catch {
      if (current()) setLoadError({ notFound: false });
    } finally {
      if (current()) setLoading(false);
    }
  }, [teamId, q, canWrite, beginRead]);

  useDeferredLoad(!orgLoading, load);

  const team = read?.team ?? null;
  usePageTitle(team?.name ?? 'Team');
  usePublishRailTeam(teamId, team?.name);

  const header = (chip?: React.ReactNode, actions?: React.ReactNode) => (
    <AdminPageHeader
      backTo={{ href: base, label: 'Teams' }}
      crumbs={[{ label: 'Rep Teams' }, team?.groupName ? { label: team.groupName } : null]}
      title={team?.name ?? 'Team'}
      titleChips={chip}
      actions={actions}
    />
  );

  if (orgLoading || loading) {
    return <PageLoading header={header()} />;
  }

  // J4-002: a failed load says it failed, keeps the way back, and retries. Only a team that isn't the
  // club's (or is outside the person's groups) says so.
  if (loadError || !read || !team) {
    return (
      <div className={repKit.page}>
        <AdminPageHeader backTo={{ href: base, label: 'Teams' }} crumbs={[{ label: 'Rep Teams' }]} title="Team" />
        {loadError?.notFound ? (
          <LoadFailed
            title={`This team isn’t in ${currentOrg?.name ?? 'your club'}.`}
            sub="It may have been removed, or it belongs to a team group you don’t manage."
          />
        ) : (
          <LoadFailed title="We couldn’t load this team." onRetry={() => { setLoading(true); void load(); }} />
        )}
      </div>
    );
  }

  const board = read.board;
  const next = board.nextEvent ? nextEventLines(board.nextEvent) : null;
  const seasons = [...read.seasons].sort((a, b) => b.year - a.year);
  const live = seasons.find(s => s.isLive && s.id === board.season?.id) ?? seasons.find(s => s.isLive) ?? null;
  const liveYear = live ? read.programYears.find(py => py.id === live.id) ?? null : null;
  const openCount = preflight?.openSeasons.length ?? seasons.filter(s => s.isLive).length;
  const lastClosed = !live ? seasons.find(s => !s.isLive) ?? null : null;
  const headCoachName = board.headCoach.people[0]?.name ?? null;
  const rollsFromRoster = seasons.find(s => s.id === preflight?.rollsFrom?.id)?.rosterCount ?? live?.rosterCount ?? 0;

  async function reopen() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/rep-teams/teams/${teamId}/seasons?${q}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reopen' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setNotice({ tone: 'bad', text: data.error ?? 'The season could not be reopened.' }); return; }
      setNotice({ tone: 'good', text: `${data.season?.name ?? 'The season'} is live again. ${team!.name}’s coaches have been told.` });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function setArchived(isArchived: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/rep-teams/teams/${teamId}?${q}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isArchived }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.code === 'team_limit_reached') { setCapRefusal(data as TeamCapRefusal); return; }
      if (!res.ok) { setNotice({ tone: 'bad', text: data.error ?? 'That didn’t work. Please try again.' }); return; }
      setWindowOpen(null);
      setNotice({ tone: 'good', text: isArchived ? `${team!.name} is archived. Its seasons and history are kept.` : `${team!.name} is back on your team list.` });
      await load();
    } finally {
      setBusy(false);
    }
  }

  const titleChip = team.isArchived ? <RepChip>Archived</RepChip>
    : live ? <RepChip tone="good">{live.name} · Live</RepChip>
    : lastClosed ? <RepChip>{lastClosed.name} · Closed</RepChip>
    : null;
  // The two season doors sit in the header only while a season runs; with none running, the closed-
  // season card below holds Start (the page's one lime). Two open seasons: Close is the way out.
  const seasonDoors = canWrite && !team.isArchived && live ? (
    <>
      <button type="button" className={`btn btn-outline ${ck.iconOnlyPhone}`} onClick={() => setWindowOpen('close')} aria-label="Close the season">
        <CalendarCheck size={15} aria-hidden /><span className={ck.btnWord}>Close the season</span>
      </button>
      {openCount <= 1 && preflight?.rollsFrom && (
        <button type="button" className={`btn btn-lime ${ck.iconOnlyPhone}`} onClick={() => setWindowOpen('start')} aria-label="Start next season">
          <CalendarPlus size={15} aria-hidden /><span className={ck.btnWord}>Start next season</span>
        </button>
      )}
    </>
  ) : undefined;

  return (
    <div className={repKit.page}>
      {header(titleChip, seasonDoors)}
      {notice && <PageNotice notice={notice} />}

      {team.isArchived ? (
        <ArchivedCard
          team={team}
          canWrite={canWrite}
          busy={busy}
          limit={currentOrg && currentOrg.teamLimit < 9999 ? currentOrg.teamLimit : null}
          onBringBack={() => void setArchived(false)}
        />
      ) : (
        <>
          {openCount > 1 && preflight && (
            <Callout tone="bad" role="alert" icon={<AlertTriangle size={16} aria-hidden />}>
              <b>{twoOpenTitle(team.name, openCount)}</b>
              <span className={repKit.calloutSub}>{twoOpenBody(preflight.openSeasons.map(s => s.name))}</span>
              {canWrite && (
                <div className={repKit.calloutActions}>
                  <button type="button" className="btn btn-outline" onClick={() => setWindowOpen('close')}>Close one of them</button>
                </div>
              )}
            </Callout>
          )}

          {live ? (
            <div className={repKit.cards4}>
              <CoachCard>
                <CoachEyebrow>Record</CoachEyebrow>
                {live.recordText ? <CoachFigure>{live.recordText}</CoachFigure> : <CoachFigure words>No games yet</CoachFigure>}
                <p className={kit.sub}>League and tournament games</p>
              </CoachCard>
              <CoachDoorCard href={`${teamBase}/roster`}>
                <CoachEyebrow arrow>Roster</CoachEyebrow>
                <CoachFigure tone={board.rosterCount === 0 ? 'bad' : undefined}>{board.rosterCount ?? 0}</CoachFigure>
                <p className={kit.sub}>{board.rosterCount === 0 ? 'No players yet' : board.rosterCount === 1 ? 'player' : 'players'}</p>
              </CoachDoorCard>
              <CoachDoorCard href={`${teamBase}/schedule`}>
                <CoachEyebrow arrow>Next event</CoachEyebrow>
                {next ? (
                  <>
                    <CoachFigure className={repKit.figDay}>{next.day}</CoachFigure>
                    <p className={kit.sub}>{next.line}</p>
                  </>
                ) : <CoachFigure words>Nothing scheduled</CoachFigure>}
              </CoachDoorCard>
              <CoachDoorCard href={`${teamBase}/tryouts`}>
                <CoachEyebrow arrow>Tryouts</CoachEyebrow>
                {liveYear?.tryoutOpen ? <CoachFigure className={repKit.figDay}>Open</CoachFigure> : <CoachFigure words>Closed</CoachFigure>}
                <p className={kit.sub}>
                  {board.pendingTryouts > 0 ? `${pluralize(board.pendingTryouts, 'applicant')} waiting`
                    : liveYear?.tryoutOpen ? 'Taking sign-ups' : 'Opens on the next season'}
                </p>
              </CoachDoorCard>
            </div>
          ) : lastClosed ? (
            <CoachCard className={repKit.closedCard}>
              <CoachEyebrow>{team.name} · this season</CoachEyebrow>
              <span className={repKit.closedTitle}>{lastClosed.name} <RepChip>Closed</RepChip></span>
              <p className={kit.sub}>{closedCardLine({ teamName: team.name, seasonName: lastClosed.name, recordText: lastClosed.recordText })}</p>
              {canWrite && preflight?.rollsFrom && (
                <div className={repKit.calloutActions}>
                  <button type="button" className="btn btn-lime" onClick={() => setWindowOpen('start')}>
                    {startButton(preflight.suggested?.year ?? null)}
                  </button>
                </div>
              )}
              {canWrite && preflight?.canReopen && preflight.reopenSeason && (
                <p className={repKit.quiet}>
                  <button type="button" className={repKit.inlineLink} onClick={() => void reopen()} disabled={busy}>
                    {busy ? 'Reopening…' : reopenLink(preflight.reopenSeason.name)}
                  </button>
                </p>
              )}
            </CoachCard>
          ) : (
            <EmptyCard
              title="No season yet"
              action={canWrite ? <button type="button" className="btn btn-lime" onClick={() => setWindowOpen('first')}>{FIRST_SEASON_TITLE}</button> : undefined}
            >
              {firstSeasonLine(team.name)}
            </EmptyCard>
          )}
        </>
      )}

      <CoachesSection coaches={coaches} teamBase={teamBase} />
      {!team.isArchived && <WhatTheClubSees />}
      {!team.isArchived && (
        <TeamDetails
          key={team.id}
          team={team}
          groups={groups}
          orgSlug={orgSlug}
          canWrite={canWrite}
          onSaved={updated => setRead(r => (r ? { ...r, team: { ...r.team, ...updated } } : r))}
          onArchive={() => setWindowOpen('archive')}
        />
      )}
      <SeasonsSection seasons={seasons} liveId={live?.id ?? null} teamBase={teamBase} />

      {windowOpen === 'start' && preflight?.rollsFrom && (
        <StartSeasonDialog
          orgSlug={orgSlug}
          teamId={teamId}
          teamName={team.name}
          preflight={preflight}
          rosterCount={rollsFromRoster}
          headCoachName={headCoachName}
          onClose={() => setWindowOpen(null)}
          onStarted={async name => {
            setWindowOpen(null);
            setNotice({ tone: 'good', text: `The ${name} has started. ${team.name}’s coaches have been told.` });
            await load();
          }}
        />
      )}
      {windowOpen === 'close' && preflight && preflight.openSeasons.length > 0 && (
        <CloseSeasonDialog
          orgSlug={orgSlug}
          teamId={teamId}
          teamName={team.name}
          preflight={preflight}
          onClose={() => setWindowOpen(null)}
          onClosed={async name => {
            setWindowOpen(null);
            setNotice({ tone: 'good', text: `The ${name} is closed. ${team.name}’s coaches have been told.` });
            await load();
          }}
        />
      )}
      {windowOpen === 'first' && (
        <FirstSeasonDialog
          orgSlug={orgSlug}
          teamId={teamId}
          teamName={team.name}
          onClose={() => setWindowOpen(null)}
          onStarted={async name => {
            setWindowOpen(null);
            setNotice({ tone: 'good', text: `The ${name} has started. Invite ${team.name}’s head coach from Coaches.` });
            await load();
          }}
        />
      )}
      {windowOpen === 'archive' && (
        <KitDialog
          kind="question"
          title={`Archive ${team.name}?`}
          onClose={() => setWindowOpen(null)}
          busy={busy}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setWindowOpen(null)} disabled={busy}>Keep it</button>
              <button type="button" className="btn btn-danger" onClick={() => void setArchived(true)} disabled={busy}>
                {busy ? 'Archiving…' : 'Archive team'}
              </button>
            </>
          }
        >
          <p>{team.name} leaves the club’s team list and frees its place on your plan. Its seasons and history are kept, and you can bring it back.</p>
        </KitDialog>
      )}
      {capRefusal && currentOrg && (
        <TeamCapDialog
          refusal={capRefusal}
          org={currentOrg}
          isOwner={userRole === 'owner'}
          onClose={() => setCapRefusal(null)}
          onMoved={text => { setCapRefusal(null); setNotice({ tone: 'good', text: `${text} You can bring ${team.name} back now.` }); }}
        />
      )}
    </div>
  );
}

/** The archived team (specimen 2, second frame): hidden from the lists, history kept, one way back. */
function ArchivedCard({ team, canWrite, busy, limit, onBringBack }: {
  team: RepTeam; canWrite: boolean; busy: boolean; limit: number | null; onBringBack: () => void;
}) {
  return (
    <ClubSection title="Archived team">
      <p className={repKit.lead}>
        {team.name} is hidden from the club’s team list. Its seasons and history are kept.
        {limit != null ? ' Bringing it back uses one of your team places.' : ''}
      </p>
      {canWrite && (
        <button type="button" className="btn btn-outline" onClick={onBringBack} disabled={busy}>
          <RotateCcw size={14} aria-hidden /> {busy ? 'Bringing it back…' : `Bring back ${team.name}`}
        </button>
      )}
    </ClubSection>
  );
}

/** Coaches — a row list; each row opens that person on the team's Coaches page. Same in every season. */
function CoachesSection({ coaches, teamBase }: { coaches: CoachesRead | null; teamBase: string }) {
  const staff = coaches?.staff ?? [];
  const invites = (coaches?.invitations ?? []).filter(i => !i.expired);
  const count = staff.length;
  return (
    <ClubSection id="coaches" title="Coaches" meta={pluralize(count, 'person', 'people')} list>
      <ClubRowList inset label="Coaches">
        {invites.map(i => (
          <ClubRow
            key={i.id}
            as="link"
            href={`${teamBase}/coaches`}
            title={<>{i.email} <RepChip tone="warn">Invited</RepChip></>}
            caption={`${i.kindWord} · invited ${formatStoredDate(i.invitedAt, { withYear: false })}`}
            chevron
          />
        ))}
        {staff.map(s => (
          <ClubRow
            key={s.membershipId}
            as="link"
            href={`${teamBase}/coaches?person=${s.membershipId}`}
            title={s.name || s.email || 'A coach'}
            caption={s.kindWord}
            chevron
          />
        ))}
        {staff.length === 0 && invites.length === 0 && (
          <ClubRow
            as="link"
            href={`${teamBase}/coaches`}
            title="No coaches yet"
            caption="Invite the head coach from the team’s Coaches page."
            chevron
          />
        )}
      </ClubRowList>
    </ClubSection>
  );
}

/** The franchise contract in plain words (plan §4B) — fixed copy, the same on every team page. */
function WhatTheClubSees() {
  return (
    <ClubSection title="What the club sees">
      <div className={repKit.split3}>
        <div>
          <h3 className={repKit.splitHead}><Building2 size={14} aria-hidden className={repKit.splitOlive} />Yours to run</h3>
          <ul className={repKit.splitList}>
            <li>The team’s name, division, colour and group</li>
            <li>Its seasons: start, close, reopen</li>
            <li>Its coaches</li>
            <li>Tryout sign-ups</li>
            <li>The documents families sign</li>
            <li>Allocations and payment-request decisions</li>
          </ul>
        </div>
        <div>
          <h3 className={repKit.splitHead}><Book size={14} aria-hidden className={repKit.splitBlue} />The coach’s, and you can read it</h3>
          <ul className={repKit.splitList}>
            <li>The roster</li>
            <li>The schedule and results</li>
            <li>Payment requests</li>
            <li>How many families are connected</li>
            <li>A closed season’s record, roster and staff</li>
            <li>The team’s books, from Stage 3</li>
          </ul>
        </div>
        <div>
          <h3 className={repKit.splitHead}><Lock size={14} aria-hidden className={repKit.splitDim} />The coach’s alone</h3>
          <ul className={repKit.splitList}>
            <li>Attendance</li>
            <li>Lineups</li>
            <li>Awards</li>
            <li>Player development</li>
            <li>Opponents and scouting</li>
            <li>Practice plans</li>
          </ul>
        </div>
      </div>
    </ClubSection>
  );
}

/**
 * Team details — AUTOSAVE (house rule 2026-09-24: an edit saves as you go; creating asks). The word
 * is transient at the section's foot (2026-09-20). The group now actually saves (B09); the division
 * is the real home of the coach's "Division is managed by your club admin"; archive lives here,
 * never as a row action.
 */
function TeamDetails({ team, groups, orgSlug, canWrite, onSaved, onArchive }: {
  team: RepTeam;
  groups: RepTeamGroup[];
  orgSlug: string;
  canWrite: boolean;
  onSaved: (team: Partial<RepTeam>) => void;
  onArchive: () => void;
}) {
  const [form, setForm] = useState<Details>(() => detailsOf(team));
  const [saved, setSaved] = useState<Details>(() => detailsOf(team));
  const sig = detailsSig(form);
  const blocked = !form.name.trim() ? 'Give the team a name to save it.'
    : form.color.trim() && !HEX.test(form.color.trim()) ? `Use a colour code like ${TEAM_COLOUR_EXAMPLE} to save it.`
    : null;

  const write = useCallback(async (signal: AbortSignal) => {
    const body: Record<string, unknown> = {
      name: form.name.trim(), division: form.division.trim(), color: form.color.trim(), sport: form.sport,
      description: form.description.trim(),
    };
    // The group is sent only when it changed: the server checks a group-limited member's scope on it.
    if (form.groupId !== saved.groupId) body.groupId = form.groupId || null;
    const res = await fetch(`/api/admin/rep-teams/teams/${team.id}?orgSlug=${encodeURIComponent(orgSlug)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? 'Couldn’t save');
    // The SAVED record moves; the form is never reset, so keystrokes typed during the save stay.
    const next = { ...form };
    setSaved(next);
    onSaved({
      name: next.name.trim(), division: next.division.trim() || null, color: next.color.trim() || null, sport: next.sport,
      description: next.description.trim() || null, groupId: next.groupId || null,
      groupName: groups.find(g => g.id === next.groupId)?.name ?? null,
    });
  }, [form, saved.groupId, team.id, orgSlug, groups, onSaved]);

  const { saving, dirty, saveError, touch, handleSave } = useRecordAutosave({
    enabled: canWrite, loading: false, sig, blocked, write, failText: 'Couldn’t save',
  });

  const set = (patch: Partial<Details>) => { setForm(f => ({ ...f, ...patch })); touch(); };

  // Leaving inside the 0.9 s debounce (a rail link, Archive) must not drop an edit: a pending change
  // is sent on the way out, and Archive waits for it (/review — the hook's own retire path does too).
  const pending = useRef({ dirty, handleSave });
  useEffect(() => { pending.current = { dirty, handleSave }; }, [dirty, handleSave]);
  useEffect(() => () => { if (pending.current.dirty) void pending.current.handleSave(); }, []);
  const archive = async () => {
    if (dirty && !(await handleSave())) return;
    onArchive();
  };

  const sports = OFFERED_SPORT_OPTIONS.some(s => s.id === form.sport)
    ? OFFERED_SPORT_OPTIONS
    : [...OFFERED_SPORT_OPTIONS, { id: form.sport, label: form.sport }];
  const publicHref = `/${orgSlug}/teams/${team.slug}`;

  return (
    <ClubSection id="details" title="Team details">
      <fieldset className={repKit.fieldset} disabled={!canWrite}>
        <div className={repKit.fieldGrid}>
          <label className={ck.field}>
            <span className={ck.label}>Name<span className={repKit.req} aria-hidden>*</span></span>
            <input className={ck.input} value={form.name} maxLength={100} onChange={e => set({ name: e.target.value })} />
          </label>
          <label className={ck.field}>
            <span className={ck.label}>Group</span>
            <select className={ck.select} value={form.groupId} onChange={e => set({ groupId: e.target.value })}>
              <option value="">No group</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
          <label className={ck.field}>
            <span className={ck.label}>Division</span>
            <input className={ck.input} value={form.division} maxLength={30} onChange={e => set({ division: e.target.value })} />
            <span className={ck.hint}>Coaches see this in their Team settings. Only the club changes it.</span>
          </label>
          <label className={ck.field}>
            <span className={ck.label}>Colour</span>
            <span className={repKit.fieldRow}>
              <i className={repKit.colourSwatch} style={{ background: HEX.test(form.color.trim()) ? form.color.trim() : undefined }} aria-hidden />
              <input className={ck.input} value={form.color} maxLength={7} placeholder={TEAM_COLOUR_EXAMPLE} onChange={e => set({ color: e.target.value })} />
            </span>
            <span className={ck.hint}>Shown on the team’s public page.</span>
          </label>
          <label className={ck.field}>
            <span className={ck.label}>Sport</span>
            <select className={ck.select} value={form.sport} onChange={e => set({ sport: e.target.value })}>
              {sports.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <div className={ck.field}>
            <span className={ck.label}>Public address</span>
            <span className={repKit.readonlyValue}>{orgSlug}/teams/{team.slug}</span>
            <span className={ck.hint}>
              Rename team URLs on Rep Teams changes it.{' '}
              <a href={publicHref} target="_blank" rel="noopener noreferrer" className={repKit.inlineLink}>
                Open the public page <ExternalLink size={12} aria-hidden />
              </a>
            </span>
          </div>
        </div>
        <label className={ck.field}>
          <span className={ck.label}>Description</span>
          <textarea className={ck.textarea} rows={2} value={form.description} onChange={e => set({ description: e.target.value })} />
        </label>
      </fieldset>
      <div className={repKit.sectionFoot}>
        {canWrite ? (
          <>
            <span>Archiving hides {team.name} from the club’s lists and frees its place on your plan. Its seasons and history are kept.</span>
            <button type="button" className="btn btn-danger" onClick={() => void archive()} disabled={saving}>Archive team</button>
            {(blocked && dirty) ? <span className={`${repKit.saveWord} ${repKit.saveWordError}`} role="status">{blocked}</span>
              : <SaveWord saving={saving} dirty={dirty} error={saveError || null} onRetry={() => void handleSave()} />}
          </>
        ) : (
          <span>Only the club’s owner and admins change a team’s details.</span>
        )}
      </div>
    </ClubSection>
  );
}

/** Seasons — Live or Closed; a closed season opens its record; the live one is this page. */
function SeasonsSection({ seasons, liveId, teamBase }: { seasons: TeamSeason[]; liveId: string | null; teamBase: string }) {
  if (seasons.length === 0) return null;
  return (
    <ClubSection id="seasons" title="Seasons" meta={pluralize(seasons.length, 'season')} list>
      <ClubRowList inset label="Seasons">
        {seasons.map(s => {
          const caption = [
            s.recordText ?? (s.isLive ? 'No games yet' : null),
            pluralize(s.rosterCount, 'player'),
            s.headCoaches.map(h => h.name).filter(Boolean).join(', ') || null,
          ].filter(Boolean).join(' · ');
          const chip = s.isLive ? <RepChip tone="good">Live</RepChip> : <RepChip>Closed</RepChip>;
          return s.isLive && s.id === liveId ? (
            <ClubRow key={s.id} title={<>{s.name} {chip}</>} caption={caption} />
          ) : s.isLive ? (
            // A second open season (the old Add Program Year could make one): no record page to open.
            <ClubRow key={s.id} title={<>{s.name} {chip}</>} caption={caption} />
          ) : (
            <ClubRow key={s.id} as="link" href={`${teamBase}/history/${s.id}`} title={<>{s.name} {chip}</>} caption={caption} chevron />
          );
        })}
      </ClubRowList>
    </ClubSection>
  );
}
