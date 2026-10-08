'use client';
/**
 * Accounting › ALLOCATIONS (Club Tier Stage 3a, specimen 2 — C06, S3A-05, C03, J4-019; Ask 2 option B).
 *
 *   one toolbar line — the View pill (By allocation · Coming due — the treasurer's two questions are two
 *                      views of one list), in Coming due the Due pill beside it, then Send reminders,
 *                      Export, and New allocation (lime). No count line: the band and closing rows say how many.
 *                      ⚖ Stage 3c (Ask 6): New allocation opens the line window's own form as a window here
 *                      (`AllocationWindow`), asking first what it bills from — a cost line with something left, or
 *                      an off-plan bill. The old page retired; its address forwards here with `?new=1` (proxy.ts).
 *   By allocation    — Allocation (its schedule as a caption) · Teams (in words) · Allocated · Collected ·
 *                      Outstanding · State · chevron, a closing row. Collected is plain ink (a figure is
 *                      never green because it is a figure). The state chip uses the ONE overdue definition.
 *   Coming due       — bands Overdue (with a total) · Sent, waiting for you to confirm · Due in the next
 *                      14 days (the Overview's window, so its count and this band agree), then a Later band
 *                      when the Due pill looks further ahead. Team (its head coach under it) · Installment
 *                      (a coach's sent note under it) · Due · Amount · chevron — no State column: the band
 *                      says the state, and only an overdue row's days-late chip, beside its date, adds to it
 *                      (S3W3 round 2, owner 2026-10-05, CD1–CD3). A row opens that team's bill.
 *   phone            — one frame, hairlined rows, the chip in the title, "collected of allocated" as the
 *                      caption (owner P1, 2026-09-29). Due goes behind the Ledgers' Filter button, on its own
 *                      line under View; View stays out of the sheet (CD1b).
 *
 * The Rep Teams board's Upcoming bills panel left that page: Coming due is its home now.
 */
import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Mail, Plus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { formatStoredDate, addCalendarDays } from '@/lib/timezone';
import ExportMenu from '@/components/admin/ExportMenu';
import PageNotice, { useNotice } from '@/components/admin/kit/club/PageNotice';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import {
  ClubRow, ClubRowBand, ClubRowList, EmptyCard, LoadFailed, repKit, useDeferredLoad, useLatestRead,
} from '@/components/admin/kit/club/RepKit';
import { CoachListToolbar } from '@/components/coaches/kit';
import FilterGroup from '@/components/coaches/FilterGroup';
import SingleSelectDropdown from '@/components/coaches/SingleSelectDropdown';
import { BillChip, LateChip, day, installmentsWord, money, moneyFetch, moneyKit } from '@/components/admin/kit/club/money/MoneyKit';
import RemindersWindow from '@/components/admin/kit/club/money/RemindersWindow';
import AllocationWindow from '@/components/admin/kit/club/money/AllocationWindow';
import { downloadCSVBlob, downloadXLSX, generateCSV, buildFilename } from '@/lib/export';
import {
  COMING_DUE_MONTH_DAYS, comingDueLater, comingDueWindowEnd,
  type ClubBillChip, type ClubBillFigures, type ComingDueWindow,
} from '@/lib/club-money-figures';

interface AllocationRow {
  id: string; description: string; createdAt: string; teamIds: string[]; teamNames: string[]; teamsWord: string;
  /** The fiscal year it counts in (Stage 3c — the server's one definition, never a stamp's first four characters). */
  year: { key: string; name: string; locked: boolean };
  allocated: number; figures: ClubBillFigures; chip: ClubBillChip; firstDue: string | null; lastDue: string | null;
  installmentsPerTeam: number;
}
interface DueTeam {
  teamId: string; teamName: string; splitId: string; installmentId: string; amount: number;
  sentOn: string | null; sentHow: string | null; sentBy: string | null; headCoach: string | null;
}
interface DueGroup {
  band: 'overdue' | 'sent' | 'due_soon' | 'later'; allocationId: string; allocationDescription: string;
  installmentNumber: number; installmentCount: number; dueDate: string; daysLate: number; teams: DueTeam[]; amount: number;
}
type DueBand = { count: number; amount: number; groups: DueGroup[] };
interface ComingDueRead {
  asOf: string; windowDays: number; activeTeams: number;
  bands: { overdue: DueBand; sent: DueBand; due_soon: DueBand };
  later: DueBand;
}

const VIEWS = [
  { id: 'allocation', label: 'By allocation' },
  { id: 'coming-due', label: 'Coming due' },
] as const;

/** "Three installments · Aug 15 to Oct 15" / "One installment · Oct 1" — the allocation's schedule. */
function scheduleCaption(a: AllocationRow): string {
  const count = installmentsWord(a.installmentsPerTeam, true);
  if (!a.firstDue) return count;
  return a.firstDue === a.lastDue || !a.lastDue ? `${count} · ${day(a.firstDue)}` : `${count} · ${day(a.firstDue)} to ${day(a.lastDue)}`;
}

/**
 * The Due pill's three windows, each with the dates it covers so the list teaches itself (the Ledger's Date
 * menu does the same). Rest of the season runs to the last installment any allocation has scheduled.
 */
function dueWindowOptions(due: ComingDueRead): { id: ComingDueWindow; label: string; detail?: string }[] {
  const last = due.later.groups[due.later.groups.length - 1]?.dueDate;
  const span = (w: ComingDueWindow) => `${day(due.asOf)} to ${day(comingDueWindowEnd(due.asOf, w)!)}`;
  return [
    { id: 'soon', label: `Next ${due.windowDays} days`, detail: span('soon') },
    { id: 'month', label: `Next ${COMING_DUE_MONTH_DAYS} days`, detail: span('month') },
    { id: 'season', label: 'Rest of the season', detail: last ? `to ${day(last)}` : undefined },
  ];
}

/** The Later band's name: "Later, through Oct 30" or "Later this season". Null on the 14-day window. */
function laterWord(window: ComingDueWindow, through: string | null): string | null {
  if (window === 'soon') return null;
  return through ? `Later, through ${day(through)}` : 'Later this season';
}

export default function AllocationsTab() {
  const { currentOrg, loading: orgLoading, user } = useOrg();
  const senderName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? 'you';
  const router = useRouter();
  const search = useSearchParams();
  const slug = currentOrg?.slug ?? '';
  const q = `orgSlug=${encodeURIComponent(slug)}`;
  const base = `/${slug}/admin/accounting/allocations`;
  const view: (typeof VIEWS)[number]['id'] = search.get('view') === 'coming-due' ? 'coming-due' : 'allocation';

  const [rows, setRows] = useState<AllocationRow[] | null>(null);
  /** The fiscal year today falls in (the totals line names it when every allocation counts in it). */
  const [thisYear, setThisYear] = useState<{ key: string; name: string } | null>(null);
  /** Whether this reader may make an allocation (the one money rule) — New allocation is absent otherwise. */
  const [canMove, setCanMove] = useState(false);
  const [due, setDue] = useState<ComingDueRead | null>(null);
  const [failed, setFailed] = useState(false);
  const [reminding, setReminding] = useState(false);
  /** New allocation's window — opened by the toolbar, or by the old page's forwarded address (`?new=1`). */
  const [creating, setCreating] = useState(() => search.get('new') === '1');
  // The Due window opens on the 14 days, the Overview's own count. Kept while you stay on the page (By allocation
  // and back finds it where you left it); a fresh visit starts on the 14 days again.
  const [dueWindow, setDueWindow] = useState<ComingDueWindow>('soon');
  const [notice, setNotice] = useNotice();

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    if (!slug) return;
    const current = beginRead();
    const [a, d] = await Promise.all([
      moneyFetch<{ allocations?: AllocationRow[]; year?: { key: string; name: string }; canMove?: boolean }>(`/api/admin/accounting/allocations?${q}`),
      moneyFetch<ComingDueRead>(`/api/admin/accounting/coming-due?${q}`),
    ]).catch(() => [null, null] as const);
    if (!current()) return;
    if (!a?.ok || !d?.ok) { setFailed(true); return; }
    setFailed(false);
    setRows(a.data.allocations ?? []);
    setThisYear(a.data.year ?? null);
    setCanMove(!!a.data.canMove);
    setDue(d.data);
  }, [slug, q, beginRead]);
  useDeferredLoad(!orgLoading && !!slug, load);

  const setView = (next: string) => router.replace(next === 'coming-due' ? `${base}?view=coming-due` : base);

  const totals = useMemo(() => {
    const list = rows ?? [];
    return {
      allocated: list.reduce((s, r) => s + r.allocated, 0),
      collected: list.reduce((s, r) => s + r.figures.collected, 0),
      outstanding: list.reduce((s, r) => s + r.figures.outstanding, 0),
      // Every allocation counts in the fiscal year today falls in (each row's `year`, the server's one definition).
      thisYearOnly: !!thisYear && list.every(r => r.year.key === thisYear.key),
    };
  }, [rows, thisYear]);

  if (failed) return <LoadFailed title="We couldn’t load the club’s allocations." onRetry={() => void load()} />;
  if (!rows || !due) return <p className={ck.loading}>Loading…</p>;

  const closingWord = totals.thisYearOnly && thisYear ? thisYear.name : 'Every allocation';
  const toolbar = (
    <CoachListToolbar
      actions={
        <>
          <button type="button" className={`btn btn-outline ${ck.iconOnlyPhone}`} onClick={() => setReminding(true)} aria-label="Send reminders">
            <Mail size={14} aria-hidden /><span className={ck.btnWord}>Send reminders</span>
          </button>
          <AllocationsExport view={view} rows={rows} due={due} dueWindow={dueWindow} orgSlug={slug} />
          {canMove && (
            <button type="button" className={`btn btn-lime ${ck.iconOnlyPhone}`} aria-label="New allocation" onClick={() => setCreating(true)}>
              <Plus size={15} aria-hidden /><span className={ck.btnWord}>New allocation</span>
            </button>
          )}
        </>
      }
    >
      <SingleSelectDropdown lead label="View" options={VIEWS} value={view} onChange={setView} />
      {/* ⚖ DUE BESIDE VIEW, ON THE ONE LINE (owner, 2026-10-05, CD1): a narrowing, so it joins the Ledgers' phone
          Filter group — a pill on a desk, the Filter button and its sheet at ≤640, where it takes its own line
          under View and the actions. View is the arrangement and stays out of the sheet (CD1b). Coming due only:
          an allocation spans months, so By allocation has no due window to narrow (CD1a). */}
      {view === 'coming-due' && (
        <div className={moneyKit.filterLine}>
          <FilterGroup>
            <SingleSelectDropdown
              restQuiet restValue="soon"
              label="Due"
              options={dueWindowOptions(due)}
              value={dueWindow}
              onChange={next => setDueWindow(next as ComingDueWindow)}
            />
          </FilterGroup>
        </div>
      )}
    </CoachListToolbar>
  );

  return (
    <>
      {notice && <PageNotice notice={notice} />}
      {toolbar}
      {view === 'allocation' ? (
        rows.length === 0 ? (
          <EmptyCard title="No allocations yet" action={canMove ? <button type="button" className="btn btn-lime" onClick={() => setCreating(true)}><Plus size={14} aria-hidden /> New allocation</button> : undefined}>
            An allocation bills the club’s teams for a shared cost — diamond fees, insurance, a uniform order — in one or more installments.
          </EmptyCard>
        ) : (
          <>
            <div className={`${repKit.tableFrame} ${repKit.deskOnly}`}>
              <table className={repKit.table}>
                <thead>
                  <tr>
                    <th scope="col">Allocation</th>
                    <th scope="col">Teams</th>
                    <th scope="col" className={repKit.num}>Allocated</th>
                    <th scope="col" className={repKit.num}>Collected</th>
                    <th scope="col" className={repKit.num}>Outstanding</th>
                    <th scope="col">State</th>
                    <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(a => {
                    const href = `${base}/${a.id}`;
                    return (
                      <tr key={a.id} className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; router.push(href); }}>
                        <td>
                          <Link href={href} className={repKit.nameLink} onClick={e => e.stopPropagation()}>{a.description}</Link>
                          <span className={repKit.cellSub}>{scheduleCaption(a)}</span>
                        </td>
                        <td>{a.teamsWord}</td>
                        <td className={repKit.num}>{money(a.allocated)}</td>
                        <td className={repKit.num}>{money(a.figures.collected)}</td>
                        <td className={repKit.num}>{money(a.figures.outstanding)}</td>
                        <td><BillChip chip={a.chip} overdueCount={a.figures.overdue.count} sentCount={a.figures.sent.count} nextDue={a.figures.nextDue?.dueDate ?? null} firstDue={a.figures.receivedCount === 0 ? a.firstDue : null} /></td>
                        <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
                      </tr>
                    );
                  })}
                  <tr className={moneyKit.closeRow}>
                    <td colSpan={2}>{closingWord}</td>
                    <td className={repKit.num}>{money(totals.allocated)}</td>
                    <td className={repKit.num}>{money(totals.collected)}</td>
                    <td className={repKit.num}>{money(totals.outstanding)}</td>
                    <td colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </div>
            <div className={repKit.phoneOnly}>
              <ClubRowList label="Allocations">
                {rows.map(a => (
                  <ClubRow key={a.id} as="link" href={`${base}/${a.id}`}
                    title={<>{a.description} <BillChip chip={a.chip} overdueCount={a.figures.overdue.count} sentCount={a.figures.sent.count} nextDue={a.figures.nextDue?.dueDate ?? null} firstDue={a.figures.receivedCount === 0 ? a.firstDue : null} /></>}
                    caption={a.figures.paidInFull ? `${a.teamsWord} · ${money(a.figures.collected)} in` : `${a.teamsWord} · ${money(a.figures.collected)} of ${money(a.allocated)} in`}
                    chevron />
                ))}
              </ClubRowList>
              <p className={repKit.notes}>{closingWord}: {money(totals.collected)} of {money(totals.allocated)} collected</p>
            </div>
            {/* ⚰ The note under the table ("A row opens its allocation from anywhere on it; the name is the link")
                is gone (CD4, owner 2026-10-05): every list in the product opens that way. */}
          </>
        )
      ) : (
        <ComingDue due={due} dueWindow={dueWindow} base={base} />
      )}

      {creating && canMove && (
        <AllocationWindow
          q={q}
          onCancel={() => { setCreating(false); if (search.get('new')) router.replace(base); }}
          onMade={text => { setCreating(false); if (search.get('new')) router.replace(base); setNotice({ tone: 'good', text }); void load(); }}
        />
      )}
      {reminding && currentOrg && (
        <RemindersWindow
          q={q}
          orgName={currentOrg.name}
          senderName={senderName}
          onClose={() => setReminding(false)}
          onSent={text => { setReminding(false); setNotice({ tone: 'good', text }); void load(); }}
        />
      )}
    </>
  );
}

/** The team's word for a group row shared by several teams ("All 9 teams", "3 teams"). */
function groupTeamsWord(g: DueGroup, activeTeams: number): string {
  if (g.teams.length === 1) return g.teams[0].teamName;
  if (g.teams.length === activeTeams) return `All ${g.teams.length} teams`;
  if (g.teams.length <= 3) return g.teams.map(t => t.teamName).join(', ');
  return `${g.teams.length} teams`;
}

/**
 * A Coming due row. `teamCaption` is the team's head coach, under the team (CD3); `note` is what a coach said
 * when they sent it, under the installment, because it is about the payment. `late` is the one chip left: how
 * many days late, which nothing else on the row says (CD2 — the band already says Sent or Due soon).
 * `phoneNote` is the same note for the phone's one-line caption, which has no head-coach line to lean on, so it
 * always names who sent it (/review 2026-10-05: "Sent Sep 29" alone lost the sender on a phone).
 */
type DueRow = {
  key: string; title: string; teamCaption: string | null; installment: string; note: string | null;
  phoneNote: string | null; due: string; amount: number; late: number | null; href: string;
};

const headCoachLine = (headCoach: string | null) => (headCoach ? `${headCoach}, head coach` : 'No head coach yet');

/** "Sent Sep 29 · E-Transfer 88213" when the head coach sent it (their name is already under the team);
 *  "Jordan Lee sent it Sep 29 · …" when someone else on the team did. `named` always names the sender. */
function sentNote(t: DueTeam, named = false): string {
  const when = t.sentOn ? day(t.sentOn) : 'recently';
  const how = t.sentHow ? ` · ${t.sentHow}` : '';
  return t.sentBy && (named || t.sentBy !== t.headCoach) ? `${t.sentBy} sent it ${when}${how}` : `Sent ${when}${how}`;
}

type DueBandKey = 'overdue' | 'sent' | 'due_soon' | 'later';

function dueRows(band: DueBandKey, b: DueBand, asOf: string, activeTeams: number, base: string): DueRow[] {
  const inst = (g: DueGroup) => `${g.allocationDescription}${g.installmentCount > 1 ? `, ${g.installmentNumber} of ${g.installmentCount}` : ''}`;
  // Overdue and sent are chased team by team; due-soon and later share a row when the teams share it.
  if (band === 'overdue' || band === 'sent') {
    return b.groups.flatMap(g => g.teams.map(t => ({
      key: `${band}-${t.installmentId}`,
      title: t.teamName,
      teamCaption: headCoachLine(t.headCoach),
      installment: inst(g),
      note: band === 'sent' ? sentNote(t) : null,
      phoneNote: band === 'sent' ? sentNote(t, true) : null,
      due: day(g.dueDate),
      amount: t.amount,
      late: band === 'overdue' ? g.daysLate : null,
      href: `${base}/${g.allocationId}?bill=${t.splitId}`,
    })));
  }
  return b.groups.map(g => ({
    key: `${band}-${g.allocationId}-${g.installmentNumber}-${g.dueDate}`,
    title: groupTeamsWord(g, activeTeams),
    // A row that is one team still names its head coach; a row shared by several has nobody to name.
    teamCaption: g.teams.length === 1 ? headCoachLine(g.teams[0].headCoach) : null,
    installment: inst(g),
    note: null,
    phoneNote: null,
    due: g.dueDate === addCalendarDays(asOf, 1) ? `${day(g.dueDate)} · tomorrow` : day(g.dueDate),
    amount: g.amount,
    late: null,
    href: g.teams.length === 1 ? `${base}/${g.allocationId}?bill=${g.teams[0].splitId}` : `${base}/${g.allocationId}`,
  }));
}

/**
 * The bands on screen, in order: Overdue, Sent, the 14 days — none of which moves with the Due window — then
 * the Later band the window adds (`comingDueLater`). One list for the table, the phone and the export.
 */
function comingDueBands(due: ComingDueRead, window: ComingDueWindow): { key: DueBandKey; label: string; word: string; b: DueBand }[] {
  const later = comingDueLater(due.later.groups, due.asOf, window);
  const lateName = laterWord(window, later.through);
  return [
    { key: 'overdue', word: 'Overdue', label: `Overdue · ${due.bands.overdue.count} · ${money(due.bands.overdue.amount)}`, b: due.bands.overdue },
    { key: 'sent', word: 'Sent, waiting for the club', label: `Sent · waiting for you to confirm · ${due.bands.sent.count}`, b: due.bands.sent },
    { key: 'due_soon', word: `Due in the next ${due.windowDays} days`, label: `Due in the next ${due.windowDays} days · ${due.bands.due_soon.count} · ${money(due.bands.due_soon.amount)}`, b: due.bands.due_soon },
    ...(lateName ? [{ key: 'later' as const, word: lateName, label: `${lateName} · ${later.count} · ${money(later.amount)}`, b: later }] : []),
  ];
}

/** What an empty Coming due says, in the window's own words. */
function nothingDueWords(due: ComingDueRead, window: ComingDueWindow): string {
  const reach = window === 'soon' ? `in the next ${due.windowDays} days`
    : window === 'month' ? `by ${day(comingDueWindowEnd(due.asOf, 'month')!)}` : 'this season';
  return `Nothing is overdue, waiting for you to confirm, or due ${reach}.`;
}

/** Coming due: overdue (with a total), sent and waiting on you, due in the next 14 days, and what the Due window adds. */
function ComingDue({ due, dueWindow, base }: { due: ComingDueRead; dueWindow: ComingDueWindow; base: string }) {
  const router = useRouter();
  const shown = comingDueBands(due, dueWindow).filter(x => x.b.groups.length > 0)
    .map(x => ({ ...x, rows: dueRows(x.key, x.b, due.asOf, due.activeTeams, base) }));

  return (
    <>
      {shown.length === 0 ? (
        <p className={moneyKit.lead1}>{nothingDueWords(due, dueWindow)}</p>
      ) : (
        <>
          <div className={`${repKit.tableFrame} ${repKit.deskOnly}`}>
            <table className={repKit.table}>
              <thead>
                <tr>
                  <th scope="col">Team</th>
                  <th scope="col">Installment</th>
                  <th scope="col">Due</th>
                  <th scope="col" className={repKit.num}>Amount</th>
                  <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ key, label, rows }) => (
                  <BandRows key={key} label={label} rows={rows} onOpen={href => router.push(href)} />
                ))}
              </tbody>
            </table>
          </div>
          <div className={repKit.phoneOnly}>
            <ClubRowList label="Coming due">
              {shown.map(({ key, label, rows }) => (
                <PhoneBand key={key} label={label} rows={rows} />
              ))}
            </ClubRowList>
          </div>
        </>
      )}
      {/* ⚰ "Later this season: … Show all" is gone (CD1, owner 2026-10-05): the Due pill is how this list looks
          further ahead, and its band says how far. */}
    </>
  );
}

function BandRows({ label, rows, onOpen }: { label: string; rows: DueRow[]; onOpen: (href: string) => void }) {
  return (
    <>
      <tr className={repKit.band}><td colSpan={5}>{label}</td></tr>
      {rows.map(r => (
        <tr key={r.key} className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; onOpen(r.href); }}>
          <td>
            <Link href={r.href} className={repKit.nameLink} onClick={e => e.stopPropagation()}>{r.title}</Link>
            {r.teamCaption && <span className={repKit.cellSub}>{r.teamCaption}</span>}
          </td>
          <td>{r.installment}{r.note && <span className={repKit.cellSub}>{r.note}</span>}</td>
          <td>{r.due}{r.late != null && <> <LateChip days={r.late} /></>}</td>
          <td className={repKit.num}>{money(r.amount)}</td>
          <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
        </tr>
      ))}
    </>
  );
}

function PhoneBand({ label, rows }: { label: string; rows: DueRow[] }) {
  return (
    <>
      <ClubRowBand>{label}</ClubRowBand>
      {rows.map(r => {
        const after = r.phoneNote ?? r.teamCaption;
        return (
          <ClubRow key={r.key} as="link" href={r.href} title={r.late != null ? <>{r.title} <LateChip days={r.late} /></> : r.title}
            caption={`${r.installment} · ${r.due} · ${money(r.amount)}${after ? ` · ${after}` : ''}`} chevron />
        );
      })}
    </>
  );
}

/**
 * The list as a file — By allocation's rows, or Coming due's — whichever view is on screen. Coming due's file
 * holds the bands the Due window shows, under the same band names, no more (CD1: the export writes what the
 * window shows; it used to add every later installment whatever the screen said).
 */
function AllocationsExport({ view, rows, due, dueWindow, orgSlug }: {
  view: string; rows: AllocationRow[]; due: ComingDueRead; dueWindow: ComingDueWindow; orgSlug: string;
}) {
  const build = (): { headers: string[]; body: (string | number)[][] } => {
    if (view === 'coming-due') {
      const headers = ['Band', 'Team', 'Allocation', 'Installment', 'Due', 'Amount', 'Days late', 'Sent on'];
      const band = (key: DueBandKey, word: string, b: DueBand) => b.groups.flatMap(g => g.teams.map(t => [
        word, t.teamName, g.allocationDescription, `${g.installmentNumber} of ${g.installmentCount}`, g.dueDate, t.amount,
        key === 'overdue' ? g.daysLate : '', t.sentOn ?? '',
      ]));
      return { headers, body: comingDueBands(due, dueWindow).flatMap(x => band(x.key, x.word, x.b)) };
    }
    return {
      headers: ['Allocation', 'Teams', 'Allocated', 'Collected', 'Outstanding', 'Overdue', 'First due', 'Last due', 'Created'],
      body: rows.map(a => [a.description, a.teamNames.join(', '), a.allocated, a.figures.collected, a.figures.outstanding,
        a.figures.overdue.amount, a.firstDue ?? '', a.lastDue ?? '', formatStoredDate(a.createdAt)]),
    };
  };
  const name = (ext: 'xlsx' | 'csv') => buildFilename({ org: orgSlug, dataset: view === 'coming-due' ? 'coming due' : 'allocations' }, ext);
  return (
    <ExportMenu
      formats={['xlsx', 'csv']}
      disabled={view === 'coming-due' ? false : rows.length === 0}
      onExportXLSX={() => { const { headers, body } = build(); return downloadXLSX(name('xlsx'), headers, body, 'Allocations'); }}
      onExportCSV={() => { const { headers, body } = build(); downloadCSVBlob(name('csv'), generateCSV(headers, body)); }}
    />
  );
}

