'use client';
/**
 * Accounting › Teams › A TEAM'S ACCOUNT WITH THE CLUB (Club Tier Stage 3a, specimen 1 — Ask 5a, D1, C12; ⚖ Club
 * Accounting · Teams, Asks 2 and 4–7, ruled 2026-10-16 — hub M3iNQq4N8cRWeZCdN6G8Ps screen 3).
 *
 * A VIEW OF THE TEAMS TAB, as a book is a view of the Ledger (Ask 2): the tab row stays with Teams lit, and a lead Team
 * pill (the Book pill's control) switches team — "All teams" goes back to the table. No back arrow, no crumbs: the tab row
 * says where you are. Choosing a team REPLACES the address (Back leaves the tab instead of walking back through every team
 * flicked through); a table row opens a team with an ordinary link.
 *
 * The page answers what a treasurer opens it for:
 *   · the season line (Ask 6) — the live season (else the last closed one) and its head coach(es), or "No head coach" in
 *     red while the live season has none: Remind needs one, so a treasurer should know before trying.
 *   · the band (four figures, unchanged) — Outstanding's line says why the team needs you (Ask 4): late in red, then sent,
 *     the bill window's one wording (`billOutstandingLine`) WITHOUT the next-due date, which Next due already shows.
 *   · one lock line (Ask 7) about the one figure the club reads but doesn't own — "Nothing here can be changed" went.
 *   · Needs you (Ask 5) — every late and sent installment and every request waiting on the club, every year, one row
 *     each; a bill row opens the team's bill in the allocation's window over the page (the statement's Billed rows' own
 *     door), a request row opens the request over the page (`RequestFlow`, the one flow Payment requests mounts too).
 *     Shown only when something waits.
 *   · Statement — 3a's, unchanged, in its own card: Billed · Collected · Paid to the team · Outstanding (running), banded
 *     by the team's seasons, closing on "Outstanding on {today}". A billed or received line opens the team's bill; a
 *     request line opens the request over the page (one door per kind on this page). Export writes it.
 *   · In Rep Teams (Ask 6) — for anyone who can open Rep Teams, the mirror of the team page's "With the club", last (a
 *     rare door ends the body). A treasurer gets the head coach's name instead.
 *
 * ⚖ THE ONE FIGURE THE CLUB READS FROM THE TEAM'S OWN BOOKS (Club Tier Stage 3b, specimen 4 — D1, C15, Ask 4e): the
 * fourth figure is the team's Cash on hand, read through the coaches' own function each time the page opens, never stored
 * by the club, never added into a club figure — the lock and the blue edge of "held by the team".
 */
import { use, useCallback, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronRight, Lock } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { usePageTitle } from '@/lib/usePageTitle';
import ExportMenu from '@/components/admin/ExportMenu';
import { CoachListToolbar, ledgerKit } from '@/components/coaches/kit';
import SingleSelectDropdown from '@/components/coaches/SingleSelectDropdown';
import PageNotice, { useNotice } from '@/components/admin/kit/club/PageNotice';
import { ClubRow, ClubRowList, ClubSection, LoadFailed, repKit, useDeferredLoad, useLatestRead } from '@/components/admin/kit/club/RepKit';
import { WaitingCount, day, daysLateWords, money, moneyFetch, moneyKit } from '@/components/admin/kit/club/money/MoneyKit';
import AllocationRecordWindow from '@/components/admin/kit/club/money/AllocationRecordWindow';
import RequestFlow from '@/components/admin/kit/club/money/RequestFlow';
import type { RequestRow, RequestsRead } from '@/components/admin/kit/club/money/RequestWindows';
import MoneySummaryBand from '@/components/coaches/MoneySummaryBand';
import {
  STILL_OPEN_WORDS, TEAMS_WORDS, TEAM_ACCOUNT_WORDS as W, billOutstandingLine, howItCame, teamCashCaption,
} from '@/lib/club-money-words';
import { HAND_BACK_WORDS } from '@/lib/club-hand-back-words';
import { fmt as fmtSigned } from '@/lib/coach-money-summary';
import { downloadCSVBlob, downloadXLSX, generateCSV, buildFilename } from '@/lib/export';
import { pluralize } from '@/lib/utils';
import type { AccountRow, TeamAccount, TeamCashHeld } from '@/lib/club-money-figures';
import { teamsByGroup, type NeedsYouBillRow, type NeedsYouRequestRow, type NeedsYouRow, type TeamNeedsYou } from '@/lib/club-team-needs';
import type { TeamAccountSeason, TeamWithTheClub } from '@/lib/club-money-reads';
import LoadingState from '@/components/shared/LoadingState';

/** Where a row opens: the team's bill in the allocation's window, or a request — both over this page. */
type RowDoor = { bill: { allocationId: string; splitId: string } } | { request: string };

interface AccountRead {
  asOf: string;
  team: { id: string; name: string };
  account: TeamAccount;
  seasons: { id: string; name: string; status: string }[];
  withTheClub: { requestsWaiting: number } | null;
  teamCash: TeamCashHeld | null;
  season: TeamAccountSeason | null;
  headCoaches: string[];
  needsYou: TeamNeedsYou;
}

/** The Team pill's "All teams" choice. */
const ALL_TEAMS = '__all__';

const of = (r: AccountRow) => (r.installmentCount && r.installmentCount > 1 && r.installmentNumber ? `, ${r.installmentNumber} of ${r.installmentCount}` : '');

/** A statement row's name and its quiet line under it. */
function rowWords(r: AccountRow, teamName: string): { name: string; sub: string | null } {
  switch (r.kind) {
    case 'billed':
      return {
        name: `Billed · ${r.description}`,
        sub: r.installmentCount && r.installmentCount > 1 ? `${r.installmentCount} installments` : 'One installment',
      };
    case 'credit':
      // Stage 11d (Ask 6): the club took money off what the team owes — its own row, the Billed row above untouched.
      return {
        name: HAND_BACK_WORDS.creditEntry(r.description),
        sub: HAND_BACK_WORDS.creditEntrySub({ reason: r.creditReason ?? '', by: r.recordedBy ?? null, source: r.creditSource ?? 'hand_back' }),
      };
    case 'received':
      return {
        name: `Received · ${r.description}${of(r)}`,
        sub: [howItCame(r.paidMethod, r.paidReference), r.daysLate ? daysLateWords(r.daysLate) : null, r.recordedBy]
          .filter(Boolean).join(' · ') || null,
      };
    case 'paid_to_team':
      return {
        name: `Paid to ${teamName} · ${r.description}`,
        sub: ['Request', r.moneyInMeaning === 'funding' ? 'the coach filed it as new money' : r.moneyInMeaning === 'reimbursement' ? 'the coach filed it as money back' : null, r.paidMethod]
          .filter(Boolean).join(' · '),
      };
    case 'received_on_request':
      // Money the team paid the club outside any bill: received, but it moves no Outstanding — the row says so.
      return { name: `From ${teamName} · ${r.description}`, sub: ['Request', 'not against a bill', r.paidMethod].filter(Boolean).join(' · ') };
  }
}

export default function TeamAccountPage({ params }: { params: Promise<{ orgSlug: string; teamId: string }> }) {
  const { orgSlug, teamId } = use(params);
  const { currentOrg, loading: orgLoading, canOpen } = useOrg();
  const router = useRouter();
  const isPhone = useIsPhone();
  const q = `orgSlug=${encodeURIComponent(orgSlug)}`;
  const base = `/${orgSlug}/admin/accounting`;

  const [read, setRead] = useState<AccountRead | null>(null);
  const [failed, setFailed] = useState<{ notFound: boolean } | null>(null);
  /** The team's bill open over the page (Stage 3d). */
  const [bill, setBill] = useState<{ allocationId: string; splitId: string } | null>(null);
  /** A request open over the page (Ask 5): its id; the row comes from the team's Payment requests read. */
  const [requestId, setRequestId] = useState<string | null>(null);
  const [requests, setRequests] = useState<{ canMove: boolean; rows: RequestRow[] } | null>(null);
  const [notice, setNotice] = useNotice();

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const current = beginRead();
    const r = await moneyFetch<AccountRead>(`/api/admin/accounting/teams/${teamId}/account?${q}`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed({ notFound: r?.status === 404 || r?.status === 403 }); return; }
    setFailed(null);
    setRead(r.data);
  }, [teamId, q, beginRead]);
  useDeferredLoad(!orgLoading, load);
  // The page names itself: the frame names every other tab, and would overwrite this (AccountingFrame).
  usePageTitle(`${read?.team.name ?? 'Team'} · Teams · Accounting`);
  /* The Team pill's list (the Teams table's every-year read, `teamsWithTheClub`): the teams this reader may see. Read on
     every visit — choosing a team mounts the page again — and again when money moves on the page. Never kept between
     visits: a list kept in the tab would outlive the person who read it (/review 2026-10-16). */
  const [teams, setTeams] = useState<TeamWithTheClub[] | null>(null);
  const beginTeams = useLatestRead();
  const loadTeams = useCallback(async () => {
    const current = beginTeams();
    const r = await moneyFetch<{ teams?: TeamWithTheClub[] }>(`/api/admin/accounting/teams?${q}`).catch(() => null);
    if (current() && r?.ok) setTeams(r.data.teams ?? []);
  }, [q, beginTeams]);
  useDeferredLoad(!orgLoading, loadTeams);

  /* The team's requests, as Payment requests reads them (each request window's own row): ahead of time when Needs you
     lists one (the request a treasurer is most likely to open), else when one is opened — and again, IN PLACE, after an
     answer: the open request's window keeps its question and the server's sentence while it re-reads (a stale tap is
     "refused in words"). A failed read is tried again by the next click on a request. */
  const beginRequests = useLatestRead();
  const loadRequests = useCallback(async () => {
    const current = beginRequests();
    const r = await moneyFetch<RequestsRead>(`/api/admin/accounting/payment-requests?${q}&teamId=${encodeURIComponent(teamId)}`).catch(() => null);
    if (current() && r?.ok) setRequests({ canMove: !!r.data.canMove, rows: [...r.data.waiting.requests, ...r.data.decided.requests] });
  }, [q, teamId, beginRequests]);
  useDeferredLoad(!!read?.needsYou.rows.some(r => r.kind === 'request'), loadRequests);

  if (failed) {
    return failed.notFound
      ? <LoadFailed title={`This team isn’t in ${currentOrg?.name ?? 'your club'}.`} sub="It may have been removed, or it belongs to a team group you don’t manage." />
      : <LoadFailed title="We couldn’t load this team’s account." onRetry={() => void load()} />;
  }
  if (!read) return <LoadingState label="Loading this team’s account…" />;

  const { account, team, needsYou, season, headCoaches } = read;
  const f = account.figures;
  const left = f.installmentCount - f.receivedCount;
  const seasonName = new Map(read.seasons.map(s => [s.id, s.name]));
  const doorOf = (r: AccountRow): RowDoor | null => r.kind === 'billed' || r.kind === 'received' || r.kind === 'credit'
    ? (r.allocationId ? { bill: { allocationId: r.allocationId, splitId: r.sourceId } } : null)
    : { request: r.sourceId };
  const open = (door: RowDoor) => {
    if ('bill' in door) { setRequestId(null); setBill(door.bill); return; }
    setRequestId(door.request);
    if (!requests) void loadRequests();
  };
  const empty = account.seasons.length === 0;
  const waiting = read.withTheClub?.requestsWaiting ?? 0;
  const cash = read.teamCash;
  // Ask 4: the line under Outstanding — the bill's one wording, its days late the oldest late row's own (the server's), and
  // no next-due date (`nextDue: null`): Next due already shows it beside.
  const owedLine = billOutstandingLine({ ...f, nextDue: null }, Math.max(0, ...needsYou.rows.map(r => (r.kind === 'late' ? r.daysLate : 0))));
  const openRequest = requestId ? requests?.rows.find(r => r.id === requestId) ?? null : null;
  const pick = (id: string) => router.replace(id === ALL_TEAMS ? `${base}/teams` : `${base}/teams/${id}`);
  /** Money moved on the page: the account, and the Team pill's figures, read again. */
  const changed = () => { void load(); void loadTeams(); };
  const answered = (text: string | null, keepOpen = false) => {
    if (text) setNotice({ tone: 'good', text });
    if (!keepOpen) setRequestId(null);
    void loadRequests();
    changed();
  };

  return (
    <>
      {notice && <PageNotice notice={notice} />}
      <CoachListToolbar actions={<StatementExport read={read} orgSlug={orgSlug} />}>
        <SingleSelectDropdown lead shrink fill label={W.pill} options={teamPillOptions(teams, team)} value={team.id} onChange={pick} />
      </CoachListToolbar>

      {/* ── The season and the person to call (Ask 6) ── */}
      <p className={moneyKit.seasonLine}>
        {season ? <b>{season.name}</b> : W.noSeason}
        {season && !season.live && <> · {W.closedOn(season.closedOn)}</>}
        {' · '}
        {headCoaches.length > 0 ? W.headCoaches(headCoaches)
          : <span className={season?.live ? moneyKit.holdingInline : undefined}>{W.noHeadCoach}</span>}
      </p>

      {/* ⚖ ONE JOINED BAND (Stage 3d, owner 2026-10-08). Cash on hand keeps the lock and the blue edge of a figure the
          club reads but doesn't own. */}
      <MoneySummaryBand
        ariaLabel={`${team.name}’s account with the club`}
        tiles={[
          {
            key: 'outstanding', label: 'Outstanding', figure: money(account.outstanding),
            caption: owedLine
              ? (owedLine.late ? <span className={moneyKit.owedLate}><AlertTriangle size={11} aria-hidden />{owedLine.text}</span> : owedLine.text)
              : left > 0 ? pluralize(left, 'installment') + ' not yet received' : 'Nothing owed',
          },
          // Late money is said under Outstanding now (Ask 4), so Next due no longer repeats it when nothing is coming due.
          { key: 'next', label: 'Next due', figure: f.nextDue ? money(f.nextDue.amount) : '—', caption: f.nextDue ? day(f.nextDue.dueDate) : 'Nothing coming due' },
          {
            key: 'paid', label: 'Paid to the team', figure: money(account.paidToTeam),
            caption: `${account.paidToTeamCount > 0 ? pluralize(account.paidToTeamCount, 'request') : 'No requests paid'} · ${waiting > 0 ? `${waiting} waiting` : 'none waiting'}`,
          },
          {
            key: 'cash', label: 'Cash on hand', held: true,
            figure: cash?.cash == null ? '—' : fmtSigned(cash.cash),
            tone: cash?.cash != null && cash.cash < -0.005 ? 'danger' : 'plain',
            caption: teamCashCaption(cash?.cash == null ? null : cash.season),
          },
        ]}
      />
      {/* ── The one figure the club reads but doesn't own (Ask 7) ── */}
      <p className={moneyKit.lockLine}>
        <Lock size={13} aria-hidden className={moneyKit.lockLineMark} />
        <span>{W.lockLine(team.name, cash?.season?.live ?? true)}</span>
      </p>

      {/* ── Needs you (Ask 5): only when something waits ── */}
      {needsYou.count > 0 && (
        <NeedsYou needs={needsYou} teamName={team.name} isPhone={isPhone} onOpen={r => open(r.door)} />
      )}

      {/* ── The statement (3a's, unchanged) ── */}
      {empty ? (
        <p className={repKit.notes}>The club hasn’t billed {team.name} or paid it on a request yet.</p>
      ) : (
        <ClubSection id="statement" title={W.statement} list>
          <div className={`${repKit.tableFrame} ${ledgerKit.cardsFrame}`}>
            <table className={repKit.table}>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Entry</th>
                  <th scope="col" className={repKit.num}>Billed</th>
                  <th scope="col" className={repKit.num}>Collected</th>
                  <th scope="col" className={repKit.num}>Paid to the team</th>
                  <th scope="col" className={repKit.num}>Outstanding</th>
                  <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
                </tr>
              </thead>
              <tbody>
                {account.seasons.map(s => (
                  <SeasonRows key={s.programYearId} label={seasonName.get(s.programYearId) ?? 'Season'} rows={s.rows} teamName={team.name}
                    doorOf={doorOf} onOpen={open} />
                ))}
                <tr className={moneyKit.closeRow} data-close="">
                  <td colSpan={5}>Outstanding on {day(read.asOf)}</td>
                  <td className={repKit.num} data-label="Outstanding">{money(account.outstanding)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <p className={`${repKit.notes} ${repKit.deskOnly}`}>{W.statementNote}</p>
        </ClubSection>
      )}

      {/* ── In Rep Teams (Ask 6): the mirror of the team page's "With the club", for anyone who can open Rep Teams ── */}
      {canOpen('module_rep_teams') && (
        <ClubSection id="in-rep-teams" title={W.inRepTeams} list>
          <ClubRowList inset label={W.inRepTeams}>
            <ClubRow as="link" href={`/${orgSlug}/admin/rep-teams/teams/${team.id}`} title={W.teamPage(team.name)} caption={W.teamPageCaption} chevron />
          </ClubRowList>
        </ClubSection>
      )}

      {bill && (
        <AllocationRecordWindow q={q} orgSlug={orgSlug} allocationId={bill.allocationId} bill={bill.splitId}
          onChanged={changed} onClose={() => setBill(null)} />
      )}
      {openRequest && (
        <RequestFlow key={openRequest.id} request={openRequest} q={q} canMove={requests?.canMove ?? false}
          onClose={() => setRequestId(null)} onDone={answered} />
      )}
    </>
  );
}

/**
 * The Team pill's list (Ask 2): "All teams" first (the table), then every team the reader may see under its group's
 * heading — the Teams table's own order (`teamsByGroup`: "No group" last; no headings when the club has no groups) —
 * each with its amber waiting count (in the list only) and its every-year Outstanding, the figure its account reads.
 */
function teamPillOptions(teams: readonly TeamWithTheClub[] | null, current: { id: string; name: string }) {
  const list = teams ?? [];
  const grouped = list.some(t => t.groupName != null);
  const options: { id: string; label: string; detail?: string; group?: string; rowMark?: ReactNode }[] = [
    { id: ALL_TEAMS, label: W.allTeams, detail: teams ? W.allTeamsDetail(teams.length) : undefined },
    ...teamsByGroup(list).flatMap(g => g.teams.map(t => ({
      id: t.teamId,
      label: t.teamName,
      group: grouped ? g.group ?? TEAMS_WORDS.noGroup : undefined,
      rowMark: t.requestsWaiting > 0 ? <WaitingCount n={t.requestsWaiting} /> : undefined,
      detail: money(t.outstanding),
    }))),
  ];
  // The team on screen is always a choice, so the pill names it (until the list lands, or an archived team it doesn't
  // list): right after "All teams", above every group's heading, so it never reads as one of the last group's teams.
  if (!list.some(t => t.teamId === current.id)) options.splice(1, 0, { id: current.id, label: current.name });
  return options;
}

/** A bill row's state, in the still-open card's words: late in red, sent quiet. */
const billState = (r: NeedsYouBillRow) => (r.kind === 'late'
  ? { text: STILL_OPEN_WORDS.overdue(r.dueDate), late: true }
  : { text: STILL_OPEN_WORDS.sent(r.sentOn ?? r.dueDate), late: false });
/** A request row's quiet facts: who asked, and when. */
const requestMeta = (r: NeedsYouRequestRow) => [r.askedBy, day(r.filedOn)].filter(Boolean).join(' · ');

/**
 * NEEDS YOU (Ask 5): What · State · Amount · chevron at a desk, framed rows with the figure at the end on a phone. The
 * name is the row's keyboard door — a window's button, for a bill or a request, both over the page. Its heading carries
 * the count and the total in words ("3 · $2,358.00"); no closing row. A closed year's row says so.
 */
function NeedsYou({ needs, teamName, isPhone, onOpen }: {
  needs: TeamNeedsYou; teamName: string; isPhone: boolean; onOpen: (r: NeedsYouRow) => void;
}) {
  const bills = needs.rows.some(r => r.kind !== 'request');
  const asks = needs.rows.some(r => r.kind === 'request');
  const what = (r: NeedsYouRow, short: boolean) => (r.kind === 'request'
    ? { name: STILL_OPEN_WORDS.request(r.description), rest: '' }
    : { name: r.allocationDescription, rest: W.installmentOf(r.installmentNumber, r.installmentCount, short) });
  return (
    <ClubSection id="needs-you" title={W.needsYou} meta={W.needsYouMeta(needs.count, needs.amount)} list>
      {!isPhone ? (
        <>
          <div className={repKit.tableFrame}>
            <table className={repKit.table}>
              <thead>
                <tr>
                  <th scope="col">What</th>
                  <th scope="col">State</th>
                  <th scope="col" className={repKit.num}>Amount</th>
                  <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
                </tr>
              </thead>
              <tbody>
                {needs.rows.map(r => {
                  const w = what(r, false);
                  const st = r.kind === 'request' ? null : billState(r);
                  return (
                    <tr key={r.key} className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; onOpen(r); }}>
                      <td>
                        <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} aria-haspopup="dialog"
                          onClick={e => { e.stopPropagation(); onOpen(r); }}>{w.name}</button>
                        {w.rest}
                        {r.kind === 'request' && <span className={repKit.cellSub}>{requestMeta(r)}</span>}
                      </td>
                      <td>
                        {st
                          ? <span className={st.late ? moneyKit.holdingInline : undefined}>{st.text}</span>
                          : <><WaitingCount n={1} />{r.kind === 'request' && r.holdingPayout && <span className={moneyKit.holding}>{STILL_OPEN_WORDS.holding}</span>}</>}
                        {r.closedYear && <span className={repKit.cellSub}>{W.fromYear(r.closedYear.name)}</span>}
                      </td>
                      <td className={repKit.num}>{money(r.amount)}</td>
                      <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className={repKit.notes}>{W.needsYouNote(teamName, bills, asks)}</p>
        </>
      ) : (
        <ClubRowList inset label={W.needsYou}>
          {needs.rows.map(r => {
            const w = what(r, true);
            const parts: ReactNode[] = r.kind === 'request'
              ? [r.holdingPayout ? <span key="h" className={moneyKit.holdingInline}>{TEAMS_WORDS.holding}</span> : null, requestMeta(r)]
              : [(st => <span key="s" className={st.late ? moneyKit.holdingInline : undefined}>{st.text}</span>)(billState(r))];
            if (r.closedYear) parts.push(<span key="y" className={moneyKit.nowrap}>{W.fromYear(r.closedYear.name)}</span>);
            const caption = parts.filter(Boolean).flatMap((x, i) => (i === 0 ? [x] : ['\u00a0· ', x]));
            return (
              <ClubRow key={r.key} as="button" aria-haspopup="dialog" onClick={() => onOpen(r)}
                title={<>{w.name}{w.rest} {r.kind === 'request' && <WaitingCount n={1} />}</>}
                caption={<>{caption}</>}
                trail={<span className={moneyKit.needsAmount}>{money(r.amount)}</span>}
                chevron />
            );
          })}
        </ClubRowList>
      )}
    </ClubSection>
  );
}

function SeasonRows({ label, rows, teamName, doorOf, onOpen }: {
  label: string; rows: AccountRow[]; teamName: string; doorOf: (r: AccountRow) => RowDoor | null; onOpen: (door: RowDoor) => void;
}) {
  return (
    <>
      <tr className={repKit.band} data-band=""><td colSpan={7}>{label}</td></tr>
      {rows.map((r, i) => {
        const w = rowWords(r, teamName);
        const door = doorOf(r);
        return (
          <tr key={`${r.kind}-${r.sourceId}-${r.installmentId ?? ''}-${i}`} className={door ? repKit.rowOpens : undefined}
            onClick={door ? () => { if (window.getSelection()?.toString()) return; onOpen(door); } : undefined}>
            {/* A date never wraps (the standard's fixed-width date). */}
            <td className={`${repKit.dim} ${moneyKit.nowrap}`} data-label="Date">{day(r.date)}</td>
            <td className={ledgerKit.whatCell}>
              {/* The name is the row's keyboard door: a window's button, for a bill and for a request alike. */}
              {door
                ? <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} aria-haspopup="dialog" onClick={e => { e.stopPropagation(); onOpen(door); }}>{w.name}</button>
                : <span className={moneyKit.what}>{w.name}</span>}
              {w.sub && <span className={repKit.cellSub}>{w.sub}</span>}
            </td>
            <td className={repKit.num} data-label={r.billed || r.credited ? 'Billed' : undefined}>{r.billed ? money(r.billed) : r.credited ? fmtSigned(-r.credited) : ''}</td>
            <td className={repKit.num} data-label={r.collected || r.receivedOnRequest ? 'Collected' : undefined}>{r.collected ? money(r.collected) : r.receivedOnRequest ? money(r.receivedOnRequest) : ''}</td>
            <td className={repKit.num} data-label={r.paidToTeam ? 'Paid to the team' : undefined}>{r.paidToTeam ? money(r.paidToTeam) : ''}</td>
            <td className={repKit.num} data-label="Outstanding">{money(r.outstanding)}</td>
            <td className={`${repKit.go} ${ledgerKit.goCell}`}>{door && <span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span>}</td>
          </tr>
        );
      })}
    </>
  );
}

/** The statement as a file: one row per line, the season named on each, oldest first. */
function StatementExport({ read, orgSlug }: { read: AccountRead; orgSlug: string }) {
  const seasonName = new Map(read.seasons.map(s => [s.id, s.name]));
  const headers = ['Season', 'Date', 'Entry', 'Detail', 'Billed', 'Collected', 'Paid to the team', 'Outstanding'];
  const body = () => read.account.seasons.slice().reverse().flatMap(s => s.rows.slice().reverse().map(r => {
    const w = rowWords(r, read.team.name);
    return [seasonName.get(s.programYearId) ?? '', r.date, w.name, w.sub ?? '', r.billed || (r.credited ? -r.credited : ''), r.collected || r.receivedOnRequest || '', r.paidToTeam || '', r.outstanding];
  }));
  const name = (ext: 'xlsx' | 'csv') => buildFilename({ org: orgSlug, dataset: `${read.team.name} account`, scope: 'club' }, ext);
  return (
    <ExportMenu
      formats={['xlsx', 'csv']}
      disabled={read.account.seasons.length === 0}
      onExportXLSX={() => downloadXLSX(name('xlsx'), headers, body(), 'Account')}
      onExportCSV={() => downloadCSVBlob(name('csv'), generateCSV(headers, body()))}
    />
  );
}

