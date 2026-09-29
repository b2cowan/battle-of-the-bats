'use client';

/**
 * Rep Teams › Bring in a coach's team (Club Tier Stage 2, specimen 9 — Ask 2, owner ruling 2026-09-28:
 * "finish it"). Before this, the page was Organization › "Coaches portal links": it spoke in internal
 * phase names, required a "Basic visibility" link first (retired, B12), and ended in a step only
 * FieldLogicHQ staff could finish, which left most of the team behind (B04).
 *
 * What the page does now, drawn to hub v15 and the Coaches Portal benchmark:
 *   - its first line says what it is for, and sends a NEW coach to "Invite a coach" (J4-034);
 *   - one request form — the coach's email → Send request;
 *   - each request WAITING ON YOU says what it costs the club (a team place, never a price), what
 *     happens to the coach's own plan (they won't be charged again — the owner's words rule, never
 *     a refund), what comes with the team, and that it can't be undone (J4-037) — then Approve,
 *     which asks for the team's name and MOVES THE TEAM there and then (no FieldLogicHQ step);
 *   - requests waiting on the coach (Withdraw), and a folded history.
 * Not drawn, built to the same rules: the "waiting on the coach" list and the history.
 * Every sentence is `lib/team-move-words.ts`'s.
 */

import { FormEvent, use, useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Repeat } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import PageNotice, { useNotice } from '@/components/admin/kit/club/PageNotice';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import type { TeamCapRefusal } from '@/components/admin/kit/club/TeamCapDialog';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { formatStoredDate } from '@/lib/timezone';
import type { TeamOrgLinkSummary } from '@/lib/team-org-links';
import {
  BRING_IN_PAGE_TITLE,
  CLUB_NEW_COACH_POINTER_LEAD,
  CLUB_NEW_COACH_POINTER_LINK,
  CLUB_NEW_COACH_POINTER_TAIL,
  CLUB_REQUEST_FIELD,
  CLUB_REQUEST_FORM_TITLE,
  CLUB_REQUEST_HINT,
  CONFIRM_BODY_CLUB,
  CONFIRM_FIELD,
  WHAT_COMES_WITH_THE_TEAM,
  clubAfterLine,
  clubApproveButton,
  clubCardTitle,
  clubCostLine,
  clubMovedNotice,
  clubPageLede,
  coachPlanLineForClub,
  confirmTitle,
  historyLine,
  openTournamentLineForClub,
  teamNameConfirmed,
  REFUSAL,
} from '@/lib/team-move-words';
import styles from './bring-in.module.css';

const TeamCapDialog = dynamic(() => import('@/components/admin/kit/club/TeamCapDialog'));

type Places = { used: number; limit: number | null };

export default function BringInACoachsTeamPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = use(params);
  const { currentOrg, userRole, loading: orgLoading } = useOrg();
  const router = useRouter();
  usePageTitle(BRING_IN_PAGE_TITLE);

  const [links, setLinks] = useState<TeamOrgLinkSummary[]>([]);
  const [places, setPlaces] = useState<Places>({ used: 0, limit: null });
  const [planLabel, setPlanLabel] = useState('Club');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<TeamOrgLinkSummary | null>(null);
  const [typed, setTyped] = useState('');
  const [typedMiss, setTypedMiss] = useState(false);
  const [capRefusal, setCapRefusal] = useState<TeamCapRefusal | null>(null);
  const [notice, setNotice] = useNotice();

  const canAct = userRole === 'owner' || userRole === 'admin';
  const api = `/api/admin/org/team-links?orgSlug=${encodeURIComponent(orgSlug)}`;
  const clubName = currentOrg?.name ?? 'your club';

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(api, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not load the requests.');
      setLinks(Array.isArray(data.links) ? data.links : []);
      if (data.teamPlaces) setPlaces(data.teamPlaces as Places);
      if (typeof data.planLabel === 'string') setPlanLabel(data.planLabel);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the requests.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (orgLoading || !canAct) return;
    // A frame later, as the page it replaced did: the load's first write is not the effect's own.
    const frame = window.requestAnimationFrame(() => { void load(); });
    return () => window.cancelAnimationFrame(frame);
  }, [orgLoading, canAct, load]);

  /** One POST, one answer: a team-cap refusal opens its window; any other refusal is a notice. */
  async function post(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const res = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409 && data.code === 'team_limit_reached') {
      setCapRefusal(data as TeamCapRefusal);
      return null;
    }
    if (!res.ok) {
      setNotice({ tone: 'bad', text: data.error ?? REFUSAL.moveFailed });
      return null;
    }
    return data;
  }

  async function sendRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const coachEmail = email.trim();
    if (!coachEmail) return;
    setSending(true);
    setNotice(null);
    try {
      const data = await post({ coachEmail });
      if (!data) return;
      setEmail('');
      const link = data.link as TeamOrgLinkSummary | undefined;
      const team = link?.repTeam?.name ?? 'Their team';
      setNotice({
        tone: 'good',
        text: !data.reusedExisting
          ? `Request sent. ${team} will see it in their own portal.`
          : link?.askedBy === 'coach'
            ? `${team} has already asked to join — it’s waiting on you below.`
            : `You’ve already asked ${team}. It’s waiting on the coach.`,
      });
      await load();
    } finally {
      setSending(false);
    }
  }

  async function answer(link: TeamOrgLinkSummary, action: 'decline' | 'withdraw') {
    setWorkingId(link.id);
    setNotice(null);
    try {
      const data = await post({ linkId: link.id, action });
      if (!data) return;
      const team = link.repTeam?.name ?? 'The team';
      setNotice({ tone: 'good', text: action === 'decline' ? `You declined ${team}’s request. Nothing moved.` : `Request to ${team} withdrawn.` });
      await load();
    } finally {
      setWorkingId(null);
    }
  }

  async function openConfirm(link: TeamOrgLinkSummary) {
    // At the cap, Approve asks the server first (it answers the room before the name): the team-cap
    // window opens on its refusal. If a place freed up since the page loaded, the answer is "type the
    // name" — so the name is asked for, as it would have been.
    if (places.limit != null && places.used >= places.limit) {
      setWorkingId(link.id);
      setNotice(null);
      try {
        const res = await fetch(api, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ linkId: link.id, action: 'approve', confirmTeamName: '' }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 409 && data.code === 'team_limit_reached') { setCapRefusal(data as TeamCapRefusal); return; }
        if (data.code !== 'confirm_mismatch') { setNotice({ tone: 'bad', text: data.error ?? REFUSAL.moveFailed }); return; }
      } finally {
        setWorkingId(null);
      }
    }
    setTyped('');
    setTypedMiss(false);
    setConfirming(link);
  }

  async function approve() {
    const link = confirming;
    if (!link) return;
    const teamName = link.repTeam?.name ?? '';
    // Checked here for the sentence, and again on the server (the check that counts).
    if (!teamNameConfirmed(typed, teamName)) { setTypedMiss(true); return; }
    setWorkingId(link.id);
    setNotice(null);
    try {
      const data = await post({ linkId: link.id, action: 'approve', confirmTeamName: typed });
      if (!data) { setConfirming(null); await load(); return; }
      const moved = data.moved as { teamId: string; teamName: string | null; teamSlug: string | null; slugChanged: boolean };
      setConfirming(null);
      setNotice({
        tone: 'good',
        text: clubMovedNotice({ teamName: moved.teamName ?? teamName, slugChangedTo: moved.slugChanged ? moved.teamSlug : null }),
        link: { href: `/${orgSlug}/admin/rep-teams/teams/${moved.teamId}`, label: `Open ${moved.teamName ?? teamName}` },
      });
      await load();
    } finally {
      setWorkingId(null);
    }
  }

  const header = (
    <AdminPageHeader
      legacy={null}
      // Plain words, as drawn: an eyebrow link is a 14px tap target (the tournament eyebrow's ruling).
      crumbs={[{ label: 'Rep Teams' }, { label: currentOrg?.name ?? '' }]}
      title={BRING_IN_PAGE_TITLE}
    />
  );

  // A member who cannot act never loads the list, so they never wait on it.
  if (orgLoading || (canAct && loading)) {
    return <div className={styles.page}>{header}<p className={ck.loading}>Loading…</p></div>;
  }

  if (!canAct) {
    return (
      <div className={styles.page}>
        {header}
        <div className={styles.callout}>
          <div>Bringing a coach’s team into the club is for the club’s owner and admins.</div>
        </div>
      </div>
    );
  }

  const waitingOnYou = links.filter(l => l.askedBy === 'coach');
  // A confirm window never outlives its request: after a reload it is gone if the request was
  // answered elsewhere, withdrawn, or moved.
  const confirmingLive = confirming && waitingOnYou.some(l => l.id === confirming.id) ? confirming : null;
  const waitingOnCoach = links.filter(l => l.askedBy === 'club');
  const history = links.filter(l => l.historyState !== null);
  const placesAfter = places.limit == null ? null : places.used + 1;

  return (
    <div className={styles.page}>
      {header}

      <div className={styles.callout}>
        <Repeat size={16} aria-hidden />
        <div>
          {clubPageLede(clubName)}
          <p className={styles.calloutSub}>
            {CLUB_NEW_COACH_POINTER_LEAD}{' '}
            <Link href={`/${orgSlug}/admin/rep-teams`} className={`${ck.link} ${styles.pointerLink}`}>{CLUB_NEW_COACH_POINTER_LINK}</Link>{' '}
            {CLUB_NEW_COACH_POINTER_TAIL}
          </p>
        </div>
      </div>

      {notice && <PageNotice notice={notice} />}
      {loadError && <PageNotice notice={{ tone: 'bad', text: loadError }} />}

      <section className={styles.card} aria-labelledby="bring-in-ask">
        <div className={styles.head}>
          <h2 id="bring-in-ask" className={styles.title}>{CLUB_REQUEST_FORM_TITLE}</h2>
        </div>
        <div className={styles.body}>
          <form className={styles.formRow} onSubmit={sendRequest}>
            <label className={`${ck.field} ${styles.field}`}>
              <span className={ck.label}>{CLUB_REQUEST_FIELD}</span>
              <input
                className={ck.input}
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="off"
                disabled={sending}
              />
            </label>
            <button type="submit" className={`btn btn-outline ${styles.sendBtn}`} disabled={sending || !email.trim()}>
              {sending ? 'Sending…' : 'Send request'}
            </button>
          </form>
          <p className={styles.hint}>{CLUB_REQUEST_HINT}</p>
        </div>
      </section>

      {waitingOnYou.length > 0 && (
        <section className={styles.card} aria-labelledby="bring-in-waiting">
          <div className={styles.head}>
            <h2 id="bring-in-waiting" className={styles.title}>Waiting on you</h2>
            <span className={styles.count}>{waitingOnYou.length}</span>
          </div>
          {waitingOnYou.map(link => {
            const team = link.repTeam?.name ?? 'This team';
            const coach = link.coachName ?? 'The coach';
            return (
              <article key={link.id} className={styles.request}>
                <div className={styles.requestTop}>
                  <h3 className={styles.requestTitle}>{clubCardTitle(team, clubName)}</h3>
                  <span className={`${ck.chip} ${ck.chipWarn}`}>{coach} said yes · {formatStoredDate(link.updatedAt, { withYear: false })}</span>
                </div>
                <div className={styles.facts}>
                  <div className={styles.factCol}>
                    <div>
                      <div className={styles.eye}>What it costs the club</div>
                      <p className={styles.factText}>{clubCostLine({ planLabel, placesAfter, limit: places.limit })}</p>
                    </div>
                    <div>
                      <div className={styles.eye}>{coach}’s own plan</div>
                      <p className={styles.factText}>{coachPlanLineForClub(coach)}</p>
                    </div>
                  </div>
                  <div className={styles.factCol}>
                    <div>
                      <div className={styles.eye}>What comes with the team</div>
                      <p className={styles.factText}>{WHAT_COMES_WITH_THE_TEAM}</p>
                    </div>
                  </div>
                </div>
                <p className={styles.after}>{clubAfterLine({ coachName: coach, teamName: team, clubName })}</p>
                {link.openTournamentName && (
                  <p className={styles.hold}>{openTournamentLineForClub(coach, link.openTournamentName)}</p>
                )}
                <div className={styles.actions}>
                  <button type="button" className="btn btn-outline" onClick={() => answer(link, 'decline')} disabled={workingId === link.id}>
                    Decline
                  </button>
                  {/* Absent, not disabled, while the coach's tournament is open: a disabled .btn reads as live. */}
                  {!link.openTournamentName && (
                    <button type="button" className="btn btn-lime" onClick={() => { void openConfirm(link); }} disabled={workingId === link.id}>
                      {clubApproveButton(team)}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {waitingOnCoach.length > 0 && (
        <section className={styles.card} aria-labelledby="bring-in-coach">
          <div className={styles.head}>
            <h2 id="bring-in-coach" className={styles.title}>Waiting on the coach</h2>
            <span className={styles.count}>{waitingOnCoach.length}</span>
          </div>
          <div className={styles.body}>
            {waitingOnCoach.map(link => (
              <div key={link.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <div className={styles.rowTitle}>{link.repTeam?.name ?? 'A coach’s team'}</div>
                  <span className={styles.rowSub}>
                    {link.coachName ? `${link.coachName} · ` : ''}Asked {formatStoredDate(link.updatedAt, { withYear: false })}
                  </span>
                </div>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => answer(link, 'withdraw')} disabled={workingId === link.id}>
                  Withdraw
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {history.length > 0 && (
        <details className={`${styles.card} ${styles.history}`}>
          <summary>
            <h2 className={styles.title}>Earlier requests</h2>
            <span className={styles.count}>{history.length}</span>
            <ChevronRight size={16} className={styles.chevron} aria-hidden />
          </summary>
          <div className={styles.body}>
            {history.map(link => (
              <div key={link.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <div className={styles.rowTitle}>{link.repTeam?.name ?? link.workspaceOrg?.name ?? 'A coach’s team'}</div>
                  <span className={styles.rowSub}>
                    {historyLine(link.historyState!, { clubName, date: formatStoredDate(link.updatedAt) })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {confirmingLive && (
        <KitDialog
          kind="question"
          title={confirmTitle(confirmingLive.repTeam?.name ?? 'this team', clubName)}
          onClose={() => setConfirming(null)}
          busy={workingId === confirmingLive.id}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setConfirming(null)} disabled={workingId === confirmingLive.id}>
                Cancel
              </button>
              <button type="button" className="btn btn-lime" onClick={approve} disabled={workingId === confirmingLive.id}>
                {workingId === confirmingLive.id ? 'Bringing it in…' : `Bring in ${confirmingLive.repTeam?.name ?? 'the team'}`}
              </button>
            </>
          }
        >
          <p>{CONFIRM_BODY_CLUB}</p>
          <label className={`${ck.field} ${styles.confirmField}`}>
            <span className={ck.label}>{CONFIRM_FIELD}</span>
            <input
              className={ck.input}
              value={typed}
              onChange={e => { setTyped(e.target.value); setTypedMiss(false); }}
              placeholder={confirmingLive.repTeam?.name ?? ''}
              autoComplete="off"
              data-autofocus=""
            />
          </label>
          {typedMiss && <p className={styles.confirmMiss} role="alert">{REFUSAL.confirmMismatch}</p>}
        </KitDialog>
      )}

      {capRefusal && currentOrg && (
        <TeamCapDialog
          refusal={capRefusal}
          org={currentOrg}
          isOwner={userRole === 'owner'}
          onClose={() => setCapRefusal(null)}
          onArchive={() => { setCapRefusal(null); router.push(`/${orgSlug}/admin/rep-teams`); }}
          onMoved={text => { setCapRefusal(null); setNotice({ tone: 'good', text: `${text} You can bring the team in now.` }); void load(); }}
        />
      )}
    </div>
  );
}
