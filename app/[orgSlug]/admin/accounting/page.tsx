'use client';
/**
 * Accounting › OVERVIEW — THE BOARD SUMMARY (Club Tier Stage 3b, session 2 — hub v38/39 specimen 3;
 * C04, J4-028, C15, S1-02; Asks 1, 4e).
 *
 * The one page a treasurer would show the board:
 *   where the club stands · today — the coach's band: Cash on hand (the club's own books added up, never a
 *       team's; a pending cheque is its caption) · Owed by the teams (Outstanding, the overdue and the sent
 *       split out) · Waiting on you (amber: it waits on the reader). None depends on the Year pill; no
 *       figure adds them together.
 *   the year against the budget — READ from Budget vs. Actual's report (never computed twice): revenue and
 *       expenses planned and so far, From the teams split into allocations and requests, paid to teams on
 *       request, the off-plan spending, the year's net; Headroom said ONCE, with its arithmetic; the olive
 *       card-foot door to Budget vs. Actual.
 *   the teams — group bands, Allocated · Collected · Outstanding (overdue / sent captions) · Requests (the
 *       amber count; a red "holding up a payout") · CASH ON HAND · HELD BY THE TEAM — the column the screen
 *       reads but doesn't own (standard §3.5, Ask 4e): a lock and the owner's name in its heading, blank in
 *       the closing row, its own band under the table worded as not the club's. A row opens the team's
 *       account with the club. Teams in the reader's group limit only (B11).
 *   the club's books — Add ledger and each book's Balance, closing on Cash on hand.
 * Export is the board report (Excel first, then PDF).
 *
 * ⚰ GONE (C04): Income · Expenses · Net position · Pending across every book — they added the teams' books
 * in and made the club read ahead on money that was mostly the teams' — and the From/To pair (the Year
 * pill is the summary's period; the Ledger's Date pill reads any other window).
 * ⚖ The tournament rail's Accounting door still arrives with `?tournamentId=` and forwards to that
 * tournament's book on the Ledger (3a's behaviour, kept).
 *
 * ⚖ STAGE 3c — THE FISCAL YEAR (hub v46, specimens 3–5; Asks 1–4, 8c):
 *   · the ENDED year's line (Ask 2's door): from the day after a year ends until someone closes it, one quiet line
 *     under the toolbar names it and the day it ended, with an outlined "Close 2025–26" opening the close question.
 *     Money movers only (the server sends `endedOpen` only to them). Gone once the year is closed.
 *   · a CLOSED year reads in place: its one line (closed by / on; Reopen on the latest, for a money mover).
 *   · "From 2025–26, still open" (Ask 4): under Where the club stands, while anything from a closed year is unpaid
 *     or waiting — each row opens the page that settles it, a waiting count the amber pill; it leaves with the last.
 *   · the one Export: on a CLOSED year it writes the YEAR-END REPORT (Excel first, then PDF) — read only from
 *     locked figures, in the drawing's order, with one line in place of the teams' cash; on an open year it is
 *     3b's board report, its title carrying the year's name and its two days.
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Lock, Plus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { CoachListToolbar, kit } from '@/components/coaches/kit';
import MoneySummaryBand from '@/components/coaches/MoneySummaryBand';
import PageNotice, { useNotice } from '@/components/admin/kit/club/PageNotice';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import {
  ClubRow, ClubRowList, ClubSection, LoadFailed, RepChip, repKit, useDeferredLoad, useLatestRead, type ChipTone,
} from '@/components/admin/kit/club/RepKit';
import frame from '@/components/admin/kit/AdminKitFrame.module.css';
import { money, moneyFetch, moneyKit } from '@/components/admin/kit/club/money/MoneyKit';
import AddLedgerWindow from '@/components/admin/kit/club/money/AddLedgerWindow';
import YearPill, { useClubYear } from '@/components/admin/kit/club/money/YearPill';
import { CloseYearQuestion, EndedYearLine, ReopenYearQuestion, YearLine } from '@/components/admin/kit/club/money/FiscalYearParts';
import ClubMoneyExport, { useClubMoneyFile, type ClubMoneyFile } from '@/components/admin/kit/club/money/ClubMoneyExport';
import cr from '@/components/admin/kit/club/money/ClubReport.module.css';
import { fmt as fmtSigned } from '@/lib/coach-money-summary';
import { LEDGER_KIND_WORD, type LedgerKind } from '@/lib/club-ledger';
import {
  HELD_BY_THE_TEAM_WORD, STILL_OPEN_WORDS, SUMMARY_WORDS, YEAR_END_WORDS, fiscalYearSpanWords, netForYearWord,
  stillOpenFromWord, teamCashClosedWord,
} from '@/lib/club-money-words';
import { clubYearEndFile } from '@/lib/club-money-reports';
import type { StillOpenRow } from '@/lib/club-fiscal-reads';
import { joinWithAnd } from '@/lib/utils';
import { BOARD_TEAMS_EXPORT_COLUMNS, boardTeamsExportRows, type BoardSummary, type SummaryTeamRow } from '@/lib/club-budget-report';
import type { ReportNote } from '@/lib/coach-money-report-notes';
import type { MoneyRowKind } from '@/lib/coach-money-exports';
import { formatStoredDate } from '@/lib/timezone';
import type { FiscalYearOption, FiscalYearRead } from '@/lib/club-fiscal-year';
import type { OverviewYearReads } from '@/lib/club-fiscal-reads';

/** The Overview's read (Stage 3c): the fiscal year read, the Year pill, the summary — and the year's own reads
 *  session 2 draws (the ended year's door, "From 2025–26, still open", a closed year's year-end report). */
interface Read {
  year: FiscalYearRead;
  years: FiscalYearOption[];
  summary: BoardSummary;
  endedOpen: OverviewYearReads['endedOpen'];
  stillOpen: OverviewYearReads['stillOpen'];
  yearEnd: OverviewYearReads['yearEnd'];
}

const KIND_TONE: Record<LedgerKind, ChipTone> = { org: 'good', tournament: 'neutral', league_season: 'neutral', team: 'info' };

/** A waiting count: the rail's amber pill — the number, never words (owner ruling 2026-10-01). */
function WaitingCount({ n }: { n: number }) {
  return <span className={frame.count} style={{ marginLeft: 0 }} aria-label={`${n} waiting`}>{n > 9 ? '9+' : n}</span>;
}

/** Group the teams under their group's band, in the order the server sent them (late, then waiting, then by name). */
function byGroup(teams: readonly SummaryTeamRow[]): { group: string | null; teams: SummaryTeamRow[] }[] {
  const out: { group: string | null; teams: SummaryTeamRow[] }[] = [];
  const sorted = [...teams].sort((a, b) => (a.groupName ?? '￿').localeCompare(b.groupName ?? '￿')
    || a.teamName.localeCompare(b.teamName, undefined, { numeric: true }));
  for (const t of sorted) {
    const last = out[out.length - 1];
    if (last && last.group === t.groupName) last.teams.push(t);
    else out.push({ group: t.groupName, teams: [t] });
  }
  return out;
}

const note = (id: string, text: string): ReportNote => ({ id, tone: 'note', segments: [{ text }] });

export default function AccountingOverviewPage() {
  const { currentOrg, loading: orgLoading } = useOrg();
  const { tournaments } = useTournament();
  const router = useRouter();
  const search = useSearchParams();
  const isPhone = useIsPhone();
  const slug = currentOrg?.slug ?? '';
  const q = `orgSlug=${encodeURIComponent(slug)}`;
  const base = `/${slug}/admin/accounting`;

  const [year, setYear] = useClubYear(slug);
  const [read, setRead] = useState<Read | null>(null);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  /** The close question (for the ended year) or Reopen (for the closed year on screen). */
  const [win, setWin] = useState<'close' | 'reopen' | null>(null);
  const [notice, setNotice] = useNotice();

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    if (!slug) return;
    const current = beginRead();
    const r = await moneyFetch<Read>(`/api/admin/accounting/summary?${q}${year ? `&year=${year}` : ''}`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); return; }
    setFailed(false);
    setRead(r.data);
  }, [slug, q, year, beginRead]);
  useDeferredLoad(!orgLoading && !!slug, load);

  const summary = read?.summary ?? null;
  // The tournament rail's door: straight to that tournament's book, when it has one (read only when that
  // door was used — the summary's books carry no tournament id).
  const forTournament = search.get('tournamentId');
  useEffect(() => {
    if (!forTournament || !slug) return;
    let live = true;
    void moneyFetch<{ ledgers?: { ledger: { id: string; entityType: string; entityId: string | null } }[] }>(`/api/admin/accounting/ledgers?${q}`)
      .then(r => {
        const book = r.ok ? (r.data.ledgers ?? []).find(l => l.ledger.entityType === 'tournament' && l.ledger.entityId === forTournament) : null;
        if (live && book) router.replace(`${base}/ledger?book=${book.ledger.id}`);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [forTournament, slug, q, router, base]);

  const words = useMemo(() => {
    if (!summary) return null;
    const a = summary.againstBudget;
    // "so far": against what the plan expected by today (the whole year's plan read as nearly all "under" in January).
    const under = Math.max(0, Math.round((a.revenue.plannedToDate - a.revenue.actual) * 100) / 100);
    return {
      headroom: SUMMARY_WORDS.headroom(a.headroom, under, summary.position.owedByTheTeams.amount, summary.year.lastDay < summary.today),
      held: SUMMARY_WORDS.teamsCashBand(summary.teamsCash.total, summary.teamsCash.teamCount),
    };
  }, [summary]);

  /* The board report: the teams table, the cash labelled exactly as on screen (its closing row blank under
     the cash, its own row saying it is not the club's — `boardTeamsExportRows`), and the page's position,
     year and books as the PDF's opening block and the Excel's notes. */
  const yearEnd = read?.yearEnd ?? null;
  const buildExport = useCallback((): ClubMoneyFile => {
    if (yearEnd) {
      const built = clubYearEndFile(yearEnd);
      return {
        dataset: 'year-end-report',
        title: YEAR_END_WORDS.againstBoth(yearEnd.againstLastYear?.lastYear.name ?? null),
        columns: built.columns,
        rows: built.rows,
        rowKinds: built.kinds,
        sections: built.sections,
        shape: { orientation: 'landscape' },
        scopeLabel: yearEnd.year.name,
        teamName: currentOrg?.name ?? '',
        notes: built.notes,
        masthead: {
          title: `${currentOrg?.name ?? ''} · ${YEAR_END_WORDS.title} · ${yearEnd.year.name}`,
          subtitle: `${fiscalYearSpanWords(yearEnd.year)} · ${YEAR_END_WORDS.closedBy(yearEnd.closed.byName, yearEnd.closed.at)}`,
          meta: YEAR_END_WORDS.prepared(read?.summary.today ?? yearEnd.closed.at.slice(0, 10)),
        },
        emptyMessage: 'There is nothing to report yet.',
      };
    }
    if (!summary || !words) throw new Error('The summary is still loading.');
    const p = summary.position;
    const a = summary.againstBudget;
    const rows = boardTeamsExportRows(summary);
    const kinds: (MoneyRowKind | undefined)[] = rows.map((_, i) => (i >= rows.length - 2 ? 'total' : undefined));
    const position = `Where the club stands, ${formatStoredDate(summary.today, { withYear: true, longMonth: true })}: Cash on hand ${fmtSigned(p.cashOnHand)} (the club’s own books, never a team’s) · Owed by the teams ${money(p.owedByTheTeams.amount)} (${SUMMARY_WORDS.owedCaption(p.owedByTheTeams.overdue.amount, p.owedByTheTeams.sent.amount)}) · Waiting on you ${money(p.waitingOnYou.amount)} (${SUMMARY_WORDS.waitingCaption(p.waitingOnYou.count, p.waitingOnYou.holdingPayout)}).`;
    const yearLine = `${summary.year.name} against the budget: revenue ${money(a.revenue.actual)} of ${money(a.revenue.planned)} planned (from the teams ${money(a.fromTheTeams.allocations)} on allocations and ${money(a.fromTheTeams.onRequest)} on request) · expenses ${money(a.expenses.actual)} of ${money(a.expenses.planned)} planned (paid to teams on request ${money(a.paidToTeamsOnRequest)}; off-plan ${money(a.offPlan)}) · ${netForYearWord(summary.year.name)} ${fmtSigned(a.net.actual)} against ${fmtSigned(a.net.planned)} planned.`;
    const booksLine = `The club’s books: ${summary.books.map(b => `${b.name} ${fmtSigned(b.balance)}`).join(' · ')} — Cash on hand ${fmtSigned(p.cashOnHand)}.`;
    return {
      dataset: 'board-report',
      title: 'Board report',
      columns: BOARD_TEAMS_EXPORT_COLUMNS,
      rows: rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? '']))) as Record<string, string | number>[],
      rowKinds: kinds,
      scopeLabel: summary.year.name,
      teamName: currentOrg?.name ?? '',
      notes: [note('board-position', position), note('board-year', yearLine), note('board-headroom', words.headroom), note('board-held', words.held), note('board-books', booksLine)],
      pdfIntro: {
        label: 'Where the club stands, and the year against the budget',
        rows: [
          ['Cash on hand · the club’s books, today', fmtSigned(p.cashOnHand)],
          ['Owed by the teams', money(p.owedByTheTeams.amount)],
          ['Waiting on you', money(p.waitingOnYou.amount)],
          [`Revenue ${summary.year.name} · ${summary.year.lastDay < summary.today ? 'actual' : 'so far'} of planned`, `${money(a.revenue.actual)} of ${money(a.revenue.planned)}`],
          [`Expenses ${summary.year.name} · ${summary.year.lastDay < summary.today ? 'actual' : 'so far'} of planned`, `${money(a.expenses.actual)} of ${money(a.expenses.planned)}`],
          ['Off-plan spending', money(a.offPlan)],
          ['Headroom', fmtSigned(a.headroom)],
          ...summary.books.map(b => [`${b.name} · ${LEDGER_KIND_WORD[b.kind as LedgerKind] ?? 'Club'}`, fmtSigned(b.balance)] as [string, string]),
        ],
      },
      masthead: {
        title: `${currentOrg?.name ?? ''} · ${summary.year.name}`,
        subtitle: 'Board report — where the club stands, the year against the budget, the teams and the books',
        meta: `${fiscalYearSpanWords(summary.year)} · as at ${formatStoredDate(summary.today, { withYear: true, longMonth: true })}`,
      },
      emptyMessage: 'There is nothing to report yet.',
    };
  }, [summary, words, yearEnd, read?.summary.today, currentOrg?.name]);
  const exportFailed = useCallback((text: string) => setNotice({ tone: 'bad', text }), [setNotice]);
  const runExport = useClubMoneyFile(q, slug, buildExport, exportFailed);

  if (failed) return <LoadFailed title="We couldn’t load the club’s summary." onRetry={() => void load()} />;
  if (!read || !summary || !words) return <p className={ck.loading}>Loading…</p>;

  const p = summary.position;
  const a = summary.againstBudget;
  const teamHref = (id: string) => `${base}/teams/${id}`;
  const bookHref = (id: string) => `${base}/ledger?book=${id}`;
  const bookIds = new Set(summary.books.map(b => b.name));
  const tournamentsWithoutBook = tournaments.filter(t => t.status !== 'archived' && !bookIds.has(t.name));
  const showTeams = summary.teams.length > 0;

  return (
    <>
      {notice && <PageNotice notice={notice} />}
      <CoachListToolbar actions={(
        <ClubMoneyExport run={runExport} formats={yearEnd ? ['xlsx', 'pdf'] : ['xlsx', 'pdf', 'csv']}
          holds={yearEnd ? { title: YEAR_END_WORDS.title, lines: [YEAR_END_WORDS.atAGlance, YEAR_END_WORDS.againstBoth(yearEnd.againstLastYear?.lastYear.name ?? null), YEAR_END_WORDS.books, YEAR_END_WORDS.teams, YEAR_END_WORDS.carried(yearEnd.carried.nextYear.name)] } : undefined} />
      )}>
        <YearPill year={summary.year.key} years={read.years} onChange={setYear} />
      </CoachListToolbar>
      {read.endedOpen && <EndedYearLine year={read.endedOpen} onClose={() => setWin('close')} />}
      <YearLine year={read.year} onReopen={() => setWin('reopen')} />

      {/* ── Where the club stands · today ── */}
      <p className={cr.recordSectionTitle}>{SUMMARY_WORDS.standsHeading(summary.today)}</p>
      <div className={cr.report}>
        <MoneySummaryBand
          ariaLabel="Where the club stands today"
          tiles={[
            {
              key: 'cash', label: 'Cash on hand', figure: fmtSigned(p.cashOnHand), tone: p.cashOnHand < -0.005 ? 'danger' : 'plain',
              caption: SUMMARY_WORDS.cashCaption(summary.books.length, p.pending.moneyOut, p.pending.count),
            },
            {
              key: 'owed', label: 'Owed by the teams', figure: money(p.owedByTheTeams.amount),
              caption: SUMMARY_WORDS.owedCaption(p.owedByTheTeams.overdue.amount, p.owedByTheTeams.sent.amount),
            },
            {
              key: 'waiting', label: 'Waiting on you', figure: money(p.waitingOnYou.amount), tone: p.waitingOnYou.count > 0 ? 'warn' : 'plain',
              caption: SUMMARY_WORDS.waitingCaption(p.waitingOnYou.count, p.waitingOnYou.holdingPayout),
            },
          ]}
        />
      </div>

      {/* ── From 2025–26, still open (Ask 4) — only while something from a closed year is unpaid or waiting ── */}
      {read.stillOpen.count > 0 && <StillOpen stillOpen={read.stillOpen} base={base} isPhone={isPhone} />}

      {/* ── The year against the budget (read from Budget vs. Actual's report) ── */}
      {isPhone ? (
        <ClubRowList label={SUMMARY_WORDS.againstHeading(summary.year.name)}>
          <ClubRow as="link" href={`${base}/budget-vs-actual`} title={SUMMARY_WORDS.againstHeading(summary.year.name)}
            caption={SUMMARY_WORDS.phoneYear(a.expenses.actual, a.expenses.planned, a.revenue.actual, a.revenue.planned, a.headroom)} chevron />
        </ClubRowList>
      ) : (
        <ClubSection id="against" title={SUMMARY_WORDS.againstHeading(summary.year.name)}
          meta={read.year.current ? `To ${formatStoredDate(summary.today, { withYear: false })}` : summary.year.name}>
          <div className={repKit.tableFrame}>
            <table className={repKit.table}>
              <thead>
                <tr>
                  <th scope="col"><span className={repKit.srOnly}>Line</span></th>
                  <th scope="col" className={repKit.num}>Planned</th>
                  <th scope="col" className={repKit.num}>{SUMMARY_WORDS.actualHead(summary.year.lastDay < summary.today)}</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className={moneyKit.what}>Revenue</td><td className={repKit.num}>{money(a.revenue.planned)}</td><td className={repKit.num}>{money(a.revenue.actual)}</td></tr>
                <tr><td className={repKit.dim}>From the teams, on allocations</td><td className={repKit.num}>{money(a.fromTheTeams.planned)}</td><td className={repKit.num}>{money(a.fromTheTeams.allocations)}</td></tr>
                <tr><td className={repKit.dim}>From the teams, on request</td><td className={repKit.num} /><td className={repKit.num}>{money(a.fromTheTeams.onRequest)}</td></tr>
                <tr><td className={moneyKit.what}>Expenses</td><td className={repKit.num}>{money(a.expenses.planned)}</td><td className={repKit.num}>{money(a.expenses.actual)}</td></tr>
                <tr><td className={repKit.dim}>Paid to teams on request</td><td className={repKit.num}>{a.paidToTeamsOnRequestPlanned > 0.005 ? money(a.paidToTeamsOnRequestPlanned) : ''}</td><td className={repKit.num}>{money(a.paidToTeamsOnRequest)}</td></tr>
                {a.offPlan > 0.005 && <tr><td className={repKit.dim}>Off-plan</td><td className={repKit.num} /><td className={repKit.num}>{money(a.offPlan)}</td></tr>}
                <tr className={moneyKit.closeRow}>
                  <td>{netForYearWord(summary.year.name)}</td>
                  <td className={`${repKit.num}${a.net.planned < -0.005 ? ` ${cr.negative}` : ''}`}>{fmtSigned(a.net.planned)}</td>
                  <td className={`${repKit.num}${a.net.actual < -0.005 ? ` ${cr.negative}` : ''}`}>{fmtSigned(a.net.actual)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className={repKit.notes}>{words.headroom}</p>
          <Link href={`${base}/budget-vs-actual`} className={kit.footLink}>Budget vs. Actual <ChevronRight size={14} aria-hidden /></Link>
        </ClubSection>
      )}

      {/* ── The teams: each team's standing with the club, and its cash held by the team ── */}
      {showTeams && (
        <ClubSection id="teams" title="The teams" meta={`${summary.teams.length} ${summary.teams.length === 1 ? 'team' : 'teams'} · ${summary.year.name}`} list>
          {!isPhone ? (
            <TeamsTable summary={summary} hrefOf={teamHref} />
          ) : (
            <ClubRowList inset label="The teams">
              {summary.teams.map(t => (
                <ClubRow
                  key={t.teamId}
                  as="link"
                  href={teamHref(t.teamId)}
                  title={<>{t.teamName} {t.requestsWaiting.count > 0 && <WaitingCount n={t.requestsWaiting.count} />}</>}
                  caption={(
                    <>
                      {t.overdue.amount > 0.005 ? <span className={moneyLate}>{money(t.overdue.amount)} overdue</span>
                        : t.holdingPayout ? <span className={moneyLate}>Holding up a payout</span> : null}
                      {/* The dot stays with the words before it (a no-break space), so a wrapped line never starts "·". */}
                      {(t.overdue.amount > 0.005 || t.holdingPayout) && '\u00a0· '}
                      {money(t.outstanding)} owed
                      {t.cash.cash != null && (
                        <span className={cr.heldCaption}>
                          <Lock size={11} aria-hidden /> {HELD_BY_THE_TEAM_WORD} <span className={t.cash.cash < -0.005 ? cr.negative : undefined}>{fmtSigned(t.cash.cash)}</span>
                          {t.cash.season && !t.cash.season.live && <> · {teamCashClosedWord(t.cash.season.closedOn)}</>}
                        </span>
                      )}
                    </>
                  )}
                  chevron
                />
              ))}
            </ClubRowList>
          )}
          <p className={cr.heldBand}>
            <Lock size={12} aria-hidden /> {isPhone ? SUMMARY_WORDS.teamsCashBandShort(summary.teamsCash.total) : words.held}
          </p>
        </ClubSection>
      )}

      {/* ── The club's books ── */}
      <ClubSection
        id="books"
        title="The club’s books"
        meta={`${summary.books.length} ${summary.books.length === 1 ? 'ledger' : 'ledgers'}`}
        actions={<button type="button" className={`btn btn-outline${isPhone ? ` ${ck.iconOnlyPhone}` : ''}`} onClick={() => setAdding(true)} aria-label="Add ledger"><Plus size={14} aria-hidden /><span className={ck.btnWord}>Add ledger</span></button>}
        list
      >
        {!isPhone ? (
          <div className={repKit.deskOnly}>
            <BooksTable summary={summary} hrefOf={bookHref} />
          </div>
        ) : (
          <ClubRowList inset label="The club’s books">
            {summary.books.map(b => (
              <ClubRow key={b.id} as="link" href={bookHref(b.id)} title={b.name}
                caption={`${LEDGER_KIND_WORD[b.kind as LedgerKind] ?? 'Club'} · ${fmtSigned(b.balance)}`} chevron />
            ))}
          </ClubRowList>
        )}
      </ClubSection>

      {win === 'close' && read.endedOpen && (
        <CloseYearQuestion q={q} year={read.endedOpen} accountingBase={base}
          onClosed={text => { setWin(null); setNotice({ tone: 'good', text }); void load(); }} onClose={() => setWin(null)} />
      )}
      {win === 'reopen' && (
        <ReopenYearQuestion q={q} year={read.year}
          nextName={read.years.filter(y => y.key > read.year.key).sort((a, b) => a.key.localeCompare(b.key))[0]?.name ?? ''}
          onDone={text => { setWin(null); setNotice({ tone: 'good', text }); void load(); }} onClose={() => setWin(null)} />
      )}
      {adding && currentOrg && (
        <AddLedgerWindow
          q={q}
          tournaments={tournamentsWithoutBook.map(t => ({ id: t.id, name: t.name }))}
          onClose={() => setAdding(false)}
          onCreated={id => { setAdding(false); router.push(bookHref(id)); }}
          onFailed={text => setNotice({ tone: 'bad', text })}
        />
      )}
    </>
  );
}

const moneyLate = cr.lateCaption;

/** The teams at a desk: group bands, the year's figures, the requests, and the cash HELD BY THE TEAM. */
function TeamsTable({ summary, hrefOf }: { summary: BoardSummary; hrefOf: (id: string) => string }) {
  const router = useRouter();
  const groups = byGroup(summary.teams);
  const banded = groups.length > 1 || groups[0]?.group != null;
  const sum = (pick: (t: SummaryTeamRow) => number) => Math.round(summary.teams.reduce((s, t) => s + Math.round(pick(t) * 100), 0)) / 100;
  return (
    <div className={repKit.tableFrame}>
      <table className={repKit.table}>
        <thead>
          <tr>
            <th scope="col">Team</th>
            <th scope="col" className={repKit.num}>Allocated</th>
            <th scope="col" className={repKit.num}>Collected</th>
            <th scope="col" className={repKit.num}>Outstanding</th>
            <th scope="col" className={repKit.num}>Requests</th>
            <th scope="col" className={`${repKit.num} ${cr.heldHead}`}><Lock size={12} aria-hidden />Cash on hand · {HELD_BY_THE_TEAM_WORD.toLowerCase()}</th>
            <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
          </tr>
        </thead>
        <tbody>
          {groups.map(g => (
            <Fragment key={g.group ?? 'none'}>
              {banded && (
                <tr className={repKit.band}>
                  <td colSpan={7}>{g.group ?? 'No group'} · {g.teams.length} {g.teams.length === 1 ? 'team' : 'teams'}</td>
                </tr>
              )}
              {g.teams.map(t => {
                const href = hrefOf(t.teamId);
                return (
                  <tr key={t.teamId} className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; router.push(href); }}>
                    <td><Link href={href} className={repKit.nameLink} onClick={e => e.stopPropagation()}>{t.teamName}</Link></td>
                    <td className={repKit.num}>{money(t.allocated)}</td>
                    <td className={repKit.num}>{money(t.collected)}</td>
                    <td className={repKit.num}>
                      {money(t.outstanding)}
                      {t.overdue.amount > 0.005 && <span className={cr.lateCaption}>{money(t.overdue.amount)} overdue</span>}
                      {t.overdue.amount <= 0.005 && t.sent.amount > 0.005 && <span className={cr.sentCaption}>{money(t.sent.amount)} sent, waiting for you</span>}
                    </td>
                    <td className={repKit.num}>
                      {t.requestsWaiting.count > 0 && <WaitingCount n={t.requestsWaiting.count} />}
                      {t.holdingPayout && <span className={cr.lateCaption}>holding up a payout</span>}
                    </td>
                    <td className={repKit.num}>
                      {t.cash.cash == null ? '' : <span className={t.cash.cash < -0.005 ? cr.negative : undefined}>{fmtSigned(t.cash.cash)}</span>}
                      {t.cash.cash != null && t.cash.season && !t.cash.season.live && <span className={cr.heldCaption}>{teamCashClosedWord(t.cash.season.closedOn)}</span>}
                    </td>
                    <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
          {/* The closing row: the club's own totals — BLANK under the cash it doesn't own (Ask 4e). */}
          <tr className={moneyKit.closeRow}>
            <td>{summary.teams.length} {summary.teams.length === 1 ? 'team' : 'teams'}</td>
            <td className={repKit.num}>{money(sum(t => t.allocated))}</td>
            <td className={repKit.num}>{money(sum(t => t.collected))}</td>
            <td className={repKit.num}>{money(sum(t => t.outstanding))}</td>
            <td className={repKit.num}>{summary.position.waitingOnYou.count > 0 ? summary.position.waitingOnYou.count : ''}</td>
            <td className={repKit.num} />
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** The club's books at a desk: Ledger · Kind · Balance · the chevron; the closing row is Cash on hand. */
function BooksTable({ summary, hrefOf }: { summary: BoardSummary; hrefOf: (id: string) => string }) {
  const router = useRouter();
  return (
    <div className={repKit.tableFrame}>
      <table className={repKit.table}>
        <thead>
          <tr>
            <th scope="col">Ledger</th>
            <th scope="col">Kind</th>
            <th scope="col" className={repKit.num}>Balance</th>
            <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
          </tr>
        </thead>
        <tbody>
          {summary.books.map(b => {
            const href = hrefOf(b.id);
            const kind = b.kind as LedgerKind;
            return (
              <tr key={b.id} className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; router.push(href); }}>
                <td><Link href={href} className={repKit.nameLink} onClick={e => e.stopPropagation()}>{b.name}</Link></td>
                <td><RepChip tone={KIND_TONE[kind] ?? 'neutral'}>{LEDGER_KIND_WORD[kind] ?? 'Club'}</RepChip></td>
                <td className={repKit.num}>{fmtSigned(b.balance)}</td>
                <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
              </tr>
            );
          })}
          <tr className={moneyKit.closeRow}>
            <td colSpan={2}>Cash on hand</td>
            <td className={repKit.num}>{fmtSigned(summary.position.cashOnHand)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** A still-open row's state, in words and ink (overdue red; a waiting request the amber pill). */
function stillOpenState(r: StillOpenRow): { text: string; late: boolean } {
  if (r.kind === 'request') return { text: '', late: false };
  if (r.state === 'overdue') return { text: STILL_OPEN_WORDS.overdue(r.dueDate ?? ''), late: true };
  if (r.state === 'sent') return { text: STILL_OPEN_WORDS.sent(r.sentOn ?? r.dueDate ?? ''), late: false };
  return { text: STILL_OPEN_WORDS.upcoming(r.dueDate ?? ''), late: false };
}

/** Where a still-open row opens: the team's bill on its allocation, or the request. */
function stillOpenHref(r: StillOpenRow, base: string): string {
  return 'requestId' in r.door
    ? `${base}/payment-requests?request=${r.door.requestId}`
    : `${base}/allocations/${r.door.allocationId}?bill=${r.door.splitId}`;
}

/**
 * "FROM 2025–26, STILL OPEN" (Ask 4): the closed years' installments still owed and requests still waiting, until
 * each is settled — the close never hides a debt. They stay their own year's (they count on its plan, as billed);
 * Where the club stands already counts them in today's figures.
 */
function StillOpen({ stillOpen, base, isPhone }: {
  stillOpen: OverviewYearReads['stillOpen']; base: string; isPhone: boolean;
}) {
  const router = useRouter();
  const title = stillOpenFromWord(joinWithAnd(stillOpen.years.map(y => y.name)));
  const meta = `${stillOpen.count} · ${money(stillOpen.amount)}`;
  return (
    <ClubSection id="still-open" title={title} meta={meta} list>
      {!isPhone ? (
        <div className={repKit.tableFrame}>
          <table className={repKit.table}>
            <thead>
              <tr>
                <th scope="col">Team</th>
                <th scope="col">What</th>
                <th scope="col">State</th>
                <th scope="col" className={repKit.num}>Amount</th>
                <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
              </tr>
            </thead>
            <tbody>
              {stillOpen.rows.map(r => {
                const href = stillOpenHref(r, base);
                const st = stillOpenState(r);
                const key = 'requestId' in r.door ? r.door.requestId : `${r.door.splitId}|${r.what}`;
                return (
                  <tr key={key} className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; router.push(href); }}>
                    <td><Link href={href} className={repKit.nameLink} onClick={e => e.stopPropagation()}>{r.teamName}</Link></td>
                    <td>{r.kind === 'request' ? STILL_OPEN_WORDS.request(r.what) : r.what}</td>
                    <td>
                      {r.kind === 'request'
                        ? <>{<WaitingCount n={1} />}{r.holdingPayout && <span className={cr.lateCaption}>{STILL_OPEN_WORDS.holding}</span>}</>
                        : <span className={st.late ? cr.negative : undefined}>{st.text}</span>}
                    </td>
                    <td className={repKit.num}>{money(r.amount)}</td>
                    <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <ClubRowList inset label={title}>
          {stillOpen.rows.map(r => {
            const st = stillOpenState(r);
            const key = 'requestId' in r.door ? r.door.requestId : `${r.door.splitId}|${r.what}`;
            return (
              <ClubRow
                key={key}
                as="link"
                href={stillOpenHref(r, base)}
                title={<>{r.teamName} {r.kind === 'request' && <WaitingCount n={1} />}</>}
                caption={(
                  <>
                    {r.kind === 'request' ? STILL_OPEN_WORDS.request(r.what) : r.what}
                    {'\u00a0· '}
                    {r.kind === 'request'
                      ? (r.holdingPayout ? <span className={moneyLate}>{STILL_OPEN_WORDS.holding}</span> : null)
                      : <span className={st.late ? cr.negative : undefined}>{st.text}</span>}
                    {r.kind === 'request' && r.holdingPayout ? '\u00a0· ' : r.kind === 'request' ? '' : '\u00a0· '}
                    {money(r.amount)}
                  </>
                )}
                chevron
              />
            );
          })}
        </ClubRowList>
      )}
    </ClubSection>
  );
}
