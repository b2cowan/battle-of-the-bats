'use client';

import { FormEvent, use, useCallback, useEffect, useState } from 'react';
import { Building2, RefreshCw } from 'lucide-react';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachNotGranted from '@/components/coaches/CoachNotGranted';
import QuestionShell from '@/components/coaches/QuestionShell';
import HelpCallout from '@/components/help/HelpCallout';
import { useOrg } from '@/lib/org-context';
import { useCoaches } from '@/lib/coaches-context';
import { formatStoredDate } from '@/lib/timezone';
import type { TeamOrgLinkSummary } from '@/lib/team-org-links';
import {
  COACH_PLAN_LINE,
  COACH_REQUEST_FIELD,
  COACH_REQUEST_FORM_TITLE,
  COACH_REQUEST_HINT,
  CONFIRM_BODY_COACH,
  CONFIRM_FIELD,
  JOIN_A_CLUB_TITLE,
  REFUSAL,
  WHAT_COMES_WITH_THE_TEAM,
  coachAfterLine,
  coachApproveButton,
  coachCardTitle,
  coachPageLede,
  confirmTitle,
  historyLine,
  openTournamentLineForCoach,
  teamNameConfirmed,
} from '@/lib/team-move-words';
import styles from '../coaches.module.css';
import own from './link-org.module.css';

/**
 * Portal › Join a club — the coach's side of bringing their own team into a club (Club Tier Stage 2,
 * B04 / Ask 2, owner ruling 2026-09-28). Before this it was "Link Organization": a Basic visibility
 * link first (retired, B12), then an ownership request, then a wait for FieldLogicHQ staff.
 *
 * Now: a club's request shows the same three facts the club reads — what it costs the coach (they
 * won't be charged for their own portal again; the owner's words rule, never a refund), what comes
 * with the team, what changes — and Approve asks for the team's name and MOVES THE TEAM there and
 * then, landing the coach on the team inside the club. The coach can also ask a club, and withdraw.
 * Restyled only where the words needed it (the prompt's rule); every sentence is
 * `lib/team-move-words.ts`'s.
 */
export default function CoachLinkOrgPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = use(params);
  const { currentOrg, loading: orgLoading } = useOrg();
  // Moving the team is the head coach's (the API refuses everyone else, reads included — staff
  // access review, 2026-09-10); the page says so instead of showing the refusal as a load error. A
  // standalone workspace has one team, so "any head-coach assignment" is it.
  // ⚠ Live AND closed assignments: `assignments` holds live seasons only, so a standalone head
  // coach whose season has just closed would otherwise be told they are not the head coach —
  // false, and a worse sentence than the generic load error they met before (`/review`,
  // 2026-09-10). The API still decides what they may do; this only decides which sentence.
  const { assignments, closedAssignments, loading: coachesLoading } = useCoaches();
  const isHeadCoach = [...assignments, ...closedAssignments].some(a => a.capabilities.isHeadCoach);
  const ownTeamName = [...assignments, ...closedAssignments][0]?.teamName ?? 'your team';
  const [links, setLinks] = useState<TeamOrgLinkSummary[]>([]);
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<TeamOrgLinkSummary | null>(null);
  const [typed, setTyped] = useState('');
  const [typedMiss, setTypedMiss] = useState(false);
  const linkOrgHelpRequest = {
    module: 'coaches' as const,
    sectionIds: ['recipe-link-parent-org'],
    fullGuideHref: `/${orgSlug}/coaches/help#recipe-link-parent-org`,
  };

  const isTeamWorkspace = currentOrg?.accountKind === 'team_workspace' || currentOrg?.planId === 'team';
  const api = `/api/coaches/${orgSlug}/team-links`;

  const loadLinks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(api, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not load your requests.');
      setLinks(Array.isArray(data.links) ? data.links : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your requests.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (orgLoading || coachesLoading) return;
      if (isTeamWorkspace && isHeadCoach) void loadLinks();
      else setLoading(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [orgLoading, coachesLoading, isTeamWorkspace, isHeadCoach, loadLinks]);

  async function send(method: 'POST' | 'PATCH', body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const res = await fetch(api, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? REFUSAL.moveFailed);
      return null;
    }
    return data;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target.trim()) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const data = await send('POST', { target });
      if (!data) return;
      setTarget('');
      const link = data.link as TeamOrgLinkSummary | undefined;
      const club = link?.linkedOrg?.name ?? 'The club';
      setMessage(!data.reusedExisting
        ? `Request sent. ${club} will see it in its own admin.`
        : link?.askedBy === 'club'
          ? `${club} has already asked for your team — it’s waiting on you below.`
          : `You’ve already asked ${club}. It’s waiting on them.`);
      await loadLinks();
    } finally {
      setSubmitting(false);
    }
  }

  async function answer(link: TeamOrgLinkSummary, action: 'decline' | 'withdraw') {
    setWorkingId(link.id);
    setError(null);
    setMessage(null);
    try {
      const data = await send('PATCH', { linkId: link.id, action });
      if (!data) return;
      const club = link.linkedOrg?.name ?? 'the club';
      setMessage(action === 'decline' ? `You declined ${club}’s request. Nothing moved.` : `Request to ${club} withdrawn.`);
      await loadLinks();
    } finally {
      setWorkingId(null);
    }
  }

  async function approve() {
    const link = confirming;
    if (!link) return;
    const teamName = link.repTeam?.name ?? '';
    // Checked here for the sentence, and again on the server (the check that counts).
    if (!teamNameConfirmed(typed, teamName)) { setTypedMiss(true); return; }
    setWorkingId(link.id);
    setError(null);
    try {
      const data = await send('PATCH', { linkId: link.id, action: 'approve', confirmTeamName: typed });
      if (!data) { setConfirming(null); await loadLinks(); return; }
      const moved = data.moved as { teamId: string; clubSlug: string | null };
      // The team lives in the club now: a full load, so the portal re-reads which org it is in.
      window.location.assign(moved.clubSlug ? `/${moved.clubSlug}/coaches/teams/${moved.teamId}` : '/coaches');
    } finally {
      setWorkingId(null);
    }
  }

  if (orgLoading || coachesLoading || loading) {
    return <div className={styles.loadingState}>Loading…</div>;
  }

  if (isTeamWorkspace && !isHeadCoach) {
    return (
      <div className={styles.page}>
        <CoachPageHeader
          icon={Building2}
          title={JOIN_A_CLUB_TITLE}
          helpLabel={JOIN_A_CLUB_TITLE}
          help={linkOrgHelpRequest}
        />
        <CoachNotGranted
          icon={<Building2 size={20} aria-hidden />}
          section="Joining a club"
          what="Bringing this team into a club — a decision about the team itself."
          blocker="Only the head coach can bring the team into a club."
        />
      </div>
    );
  }

  if (!isTeamWorkspace) {
    return (
      <div className={styles.page}>
        {/* Page-header ruling 2026-08-11: ONE icon for both states, and no static line — the
            callout under it says who this is for, in a full sentence. */}
        <CoachPageHeader
          icon={Building2}
          title={JOIN_A_CLUB_TITLE}
          helpLabel={JOIN_A_CLUB_TITLE}
          help={linkOrgHelpRequest}
        />
        <HelpCallout
          variant="info"
          title="Already part of a club"
          body="This team already belongs to its club, so there is nothing to join. Joining a club is for a coach who runs a team on their own Coaches Portal."
        />
      </div>
    );
  }

  const fromClubs = links.filter(l => l.askedBy === 'club');
  // A confirm window never outlives its request (answered elsewhere, withdrawn, or moved).
  const confirmingLive = confirming && fromClubs.some(l => l.id === confirming.id) ? confirming : null;
  const mine = links.filter(l => l.askedBy === 'coach');
  const history = links.filter(l => l.historyState !== null);

  return (
    <div className={styles.page}>
      {/* Page-header ruling 2026-08-11: the static line goes; the header carries only actions. */}
      <CoachPageHeader
        icon={Building2}
        title={JOIN_A_CLUB_TITLE}
        actions={
          /* Portal geometry, not the global button scale (plan §2.6 — the drift vector the
             inventory named, swept here in Phase 4b). This is one of only two header buttons that
             still hand-wrote its own sizing; the page-actions guard carries a row for each so they
             were known debt rather than a future discovery. */
          <button type="button" className={styles.btnSecondary} onClick={loadLinks} aria-label="Refresh">
            <RefreshCw size={14} aria-hidden /> <span className={styles.headerBtnLabel}>Refresh</span>
          </button>
        }
        helpLabel={JOIN_A_CLUB_TITLE}
        help={linkOrgHelpRequest}
      />

      {error && <p className={styles.errorText} role="alert">{error}</p>}
      {message && <p className={styles.successText} role="status">{message}</p>}

      {fromClubs.map(link => {
        const club = link.linkedOrg?.name ?? 'A club';
        const team = link.repTeam?.name ?? ownTeamName;
        return (
          <section key={link.id} className={styles.detailSection}>
            <article className={styles.linkCard}>
              <div className={styles.linkCardHeader}>
                <h3 className={styles.linkCardTitle}>{coachCardTitle(club, team)}</h3>
                <span className={`${styles.badge} ${styles.badgeUpcoming}`}>
                  Asked {formatStoredDate(link.updatedAt, { withYear: false })}
                </span>
              </div>
              <div className={own.facts}>
                <div className={own.factCol}>
                  <div>
                    <div className={own.eye}>What it costs you</div>
                    <p className={own.factText}>{COACH_PLAN_LINE}</p>
                  </div>
                  <div>
                    <div className={own.eye}>What changes</div>
                    <p className={own.factText}>{coachAfterLine({ teamName: team, clubName: club })}</p>
                  </div>
                </div>
                <div className={own.factCol}>
                  <div>
                    <div className={own.eye}>What comes with the team</div>
                    <p className={own.factText}>{WHAT_COMES_WITH_THE_TEAM}</p>
                  </div>
                </div>
              </div>
              {link.openTournamentName && <p className={own.hold}>{openTournamentLineForCoach(link.openTournamentName)}</p>}
              <div className={own.actions}>
                <button type="button" className={styles.btnSecondary} onClick={() => answer(link, 'decline')} disabled={workingId === link.id}>
                  Decline
                </button>
                {/* Absent, not disabled, while the coach's own tournament is open. */}
                {!link.openTournamentName && (
                  <button
                    type="button"
                    className="btn btn-lime"
                    onClick={() => { setTyped(''); setTypedMiss(false); setConfirming(link); }}
                    disabled={workingId === link.id}
                  >
                    {coachApproveButton(club)}
                  </button>
                )}
              </div>
            </article>
          </section>
        );
      })}

      <section className={styles.detailSection}>
        <h2 className={styles.detailSectionTitle}>{COACH_REQUEST_FORM_TITLE}</h2>
        <p className={own.lede}>{coachPageLede(ownTeamName)}</p>
        <form className={styles.linkForm} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>{COACH_REQUEST_FIELD}</span>
            <input
              className={styles.input}
              value={target}
              onChange={event => setTarget(event.target.value)}
              placeholder="example-club or admin@example.com"
              disabled={submitting}
            />
          </label>
          <button type="submit" className={styles.btnSecondary} disabled={submitting || !target.trim()}>
            {submitting ? 'Sending…' : 'Send request'}
          </button>
        </form>
        <p className={own.hint}>{COACH_REQUEST_HINT}</p>
      </section>

      {mine.length > 0 && (
        <section className={styles.detailSection}>
          <h2 className={styles.detailSectionTitle}>Waiting on the club</h2>
          {mine.map(link => (
            <div key={link.id} className={own.row}>
              <div className={own.rowMain}>
                <div className={own.rowTitle}>{link.linkedOrg?.name ?? 'A club'}</div>
                <span className={own.rowSub}>Asked {formatStoredDate(link.updatedAt, { withYear: false })}</span>
              </div>
              <button type="button" className={styles.btnSecondary} onClick={() => answer(link, 'withdraw')} disabled={workingId === link.id}>
                Withdraw
              </button>
            </div>
          ))}
        </section>
      )}

      {history.length > 0 && (
        <section className={styles.detailSection}>
          <h2 className={styles.detailSectionTitle}>Earlier requests</h2>
          {history.map(link => (
            <div key={link.id} className={own.row}>
              <div className={own.rowMain}>
                <div className={own.rowTitle}>{link.linkedOrg?.name ?? 'A club'}</div>
                <span className={own.rowSub}>
                  {historyLine(link.historyState!, { clubName: link.linkedOrg?.name ?? 'the club', date: formatStoredDate(link.updatedAt) })}
                </span>
              </div>
            </div>
          ))}
        </section>
      )}

      <QuestionShell
        open={confirmingLive !== null}
        onClose={() => setConfirming(null)}
        ariaLabel={confirmingLive ? confirmTitle(confirmingLive.repTeam?.name ?? ownTeamName, confirmingLive.linkedOrg?.name ?? 'the club') : JOIN_A_CLUB_TITLE}
        title={confirmingLive ? confirmTitle(confirmingLive.repTeam?.name ?? ownTeamName, confirmingLive.linkedOrg?.name ?? 'the club') : ''}
        busy={confirmingLive !== null && workingId === confirmingLive.id}
      >
        <form onSubmit={e => { e.preventDefault(); void approve(); }}>
          <p className={own.confirmBody}>{CONFIRM_BODY_COACH}</p>
          <label className={styles.field}>
            <span className={styles.label}>{CONFIRM_FIELD}</span>
            <input
              className={styles.input}
              value={typed}
              onChange={e => { setTyped(e.target.value); setTypedMiss(false); }}
              placeholder={confirmingLive?.repTeam?.name ?? ''}
              autoComplete="off"
            />
          </label>
          {typedMiss && <p className={own.confirmMiss} role="alert">{REFUSAL.confirmMismatch}</p>}
          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnSecondary} onClick={() => setConfirming(null)}>Cancel</button>
            <button type="submit" className="btn btn-lime">
              {confirmingLive && workingId === confirmingLive.id ? 'Joining…' : `Join ${confirmingLive?.linkedOrg?.name ?? 'the club'}`}
            </button>
          </div>
        </form>
      </QuestionShell>
    </div>
  );
}
