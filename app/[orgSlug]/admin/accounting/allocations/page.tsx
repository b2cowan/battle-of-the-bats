'use client';
/**
 * Accounting › ALLOCATIONS (Club Tier Stage 3a, specimen 2 — C06, S3A-05, C03, J4-019; Ask 2 option B).
 *
 *   one toolbar line — the View pill (By allocation · Coming due — the treasurer's two questions are two
 *                      views of one list), then Send reminders, Export, and New allocation (lime; today's
 *                      form, unchanged). No count line: the band and closing rows say how many.
 *   By allocation    — Allocation (its schedule as a caption) · Teams (in words) · Allocated · Collected ·
 *                      Outstanding · State · chevron, a closing row. Collected is plain ink (a figure is
 *                      never green because it is a figure). The state chip uses the ONE overdue definition.
 *   Coming due       — bands Overdue (with a total) · Sent, waiting for you to confirm · Due in the next
 *                      14 days (the Overview's window, so its count and this band agree). A row opens that
 *                      team's bill on the allocation; what falls due later is one "Show all" away.
 *   phone            — one frame, hairlined rows, the chip in the title, "collected of allocated" as the
 *                      caption (owner P1, 2026-09-29).
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
  ClubRow, ClubRowBand, ClubRowList, EmptyCard, LoadFailed, RepChip, repKit, useDeferredLoad, useLatestRead,
} from '@/components/admin/kit/club/RepKit';
import { CoachListToolbar } from '@/components/coaches/kit';
import SingleSelectDropdown from '@/components/coaches/SingleSelectDropdown';
import { BillChip, day, installmentsWord, money, moneyFetch, moneyKit } from '@/components/admin/kit/club/money/MoneyKit';
import RemindersWindow from '@/components/admin/kit/club/money/RemindersWindow';
import { downloadCSVBlob, downloadXLSX, generateCSV, buildFilename } from '@/lib/export';
import type { ClubBillChip, ClubBillFigures } from '@/lib/club-money-figures';

interface AllocationRow {
  id: string; description: string; createdAt: string; teamIds: string[]; teamNames: string[]; teamsWord: string;
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

/** "Due tomorrow" / "Due Oct 1". */
function dueWords(dueDate: string, asOf: string): string {
  if (dueDate === asOf) return 'Due today';
  if (dueDate === addCalendarDays(asOf, 1)) return 'Due tomorrow';
  return `Due ${day(dueDate)}`;
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
  const [due, setDue] = useState<ComingDueRead | null>(null);
  const [failed, setFailed] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [showLater, setShowLater] = useState(false);
  const [notice, setNotice] = useNotice();

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    if (!slug) return;
    const current = beginRead();
    const [a, d] = await Promise.all([
      moneyFetch<{ allocations?: AllocationRow[] }>(`/api/admin/accounting/allocations?${q}`),
      moneyFetch<ComingDueRead>(`/api/admin/accounting/coming-due?${q}`),
    ]).catch(() => [null, null] as const);
    if (!current()) return;
    if (!a?.ok || !d?.ok) { setFailed(true); return; }
    setFailed(false);
    setRows(a.data.allocations ?? []);
    setDue(d.data);
  }, [slug, q, beginRead]);
  useDeferredLoad(!orgLoading && !!slug, load);

  const setView = (next: string) => router.replace(next === 'coming-due' ? `${base}?view=coming-due` : base);

  const year = due?.asOf.slice(0, 4) ?? '';
  const totals = useMemo(() => {
    const list = rows ?? [];
    return {
      allocated: list.reduce((s, r) => s + r.allocated, 0),
      collected: list.reduce((s, r) => s + r.figures.collected, 0),
      outstanding: list.reduce((s, r) => s + r.figures.outstanding, 0),
      thisYearOnly: list.every(r => r.createdAt.slice(0, 4) === year),
    };
  }, [rows, year]);

  if (failed) return <LoadFailed title="We couldn’t load the club’s allocations." onRetry={() => void load()} />;
  if (!rows || !due) return <p className={ck.loading}>Loading…</p>;

  const closingWord = totals.thisYearOnly ? 'This year' : 'Every allocation';
  const toolbar = (
    <CoachListToolbar
      actions={
        <>
          <button type="button" className={`btn btn-outline ${ck.iconOnlyPhone}`} onClick={() => setReminding(true)} aria-label="Send reminders">
            <Mail size={14} aria-hidden /><span className={ck.btnWord}>Send reminders</span>
          </button>
          <AllocationsExport view={view} rows={rows} due={due} orgSlug={slug} />
          <Link href={`${base}/new`} className={`btn btn-lime ${ck.iconOnlyPhone}`} aria-label="New allocation">
            <Plus size={15} aria-hidden /><span className={ck.btnWord}>New allocation</span>
          </Link>
        </>
      }
    >
      <SingleSelectDropdown lead label="View" options={VIEWS} value={view} onChange={setView} />
    </CoachListToolbar>
  );

  return (
    <>
      {notice && <PageNotice notice={notice} />}
      {toolbar}
      {view === 'allocation' ? (
        rows.length === 0 ? (
          <EmptyCard title="No allocations yet" action={<Link href={`${base}/new`} className="btn btn-lime"><Plus size={14} aria-hidden /> New allocation</Link>}>
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
            <p className={`${repKit.notes} ${repKit.deskOnly}`}>A row opens its allocation from anywhere on it; the name is the link.</p>
          </>
        )
      ) : (
        <ComingDue due={due} showLater={showLater} onShowLater={() => setShowLater(true)} base={base} />
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

type DueRow = { key: string; title: string; installment: string; caption: string | null; due: string; amount: number; chip: React.ReactNode; href: string };

function dueRows(band: 'overdue' | 'sent' | 'due_soon' | 'later', b: DueBand, asOf: string, activeTeams: number, base: string): DueRow[] {
  const inst = (g: DueGroup) => `${g.allocationDescription}${g.installmentCount > 1 ? `, ${g.installmentNumber} of ${g.installmentCount}` : ''}`;
  // Overdue and sent are chased team by team; due-soon and later share a row when the teams share it.
  if (band === 'overdue' || band === 'sent') {
    return b.groups.flatMap(g => g.teams.map(t => ({
      key: `${band}-${t.installmentId}`,
      title: t.teamName,
      installment: inst(g),
      caption: band === 'sent'
        ? `${t.sentBy ?? 'The coach'} says it went ${t.sentOn ? day(t.sentOn) : 'recently'}${t.sentHow ? ` · ${t.sentHow}` : ''}`
        : t.headCoach ? `${t.headCoach}, head coach` : 'No head coach yet',
      due: day(g.dueDate),
      amount: t.amount,
      chip: band === 'overdue'
        ? <RepChip tone="bad">{g.daysLate} {g.daysLate === 1 ? 'day' : 'days'} late</RepChip>
        : <RepChip tone="info">Sent · confirm</RepChip>,
      href: `${base}/${g.allocationId}?bill=${t.splitId}`,
    })));
  }
  return b.groups.map(g => ({
    key: `${band}-${g.allocationId}-${g.installmentNumber}-${g.dueDate}`,
    title: groupTeamsWord(g, activeTeams),
    installment: inst(g),
    caption: null,
    due: g.dueDate === addCalendarDays(asOf, 1) ? `${day(g.dueDate)} · tomorrow` : day(g.dueDate),
    amount: g.amount,
    chip: band === 'due_soon' ? <RepChip tone="warn">{dueWords(g.dueDate, asOf)}</RepChip> : <RepChip>{dueWords(g.dueDate, asOf)}</RepChip>,
    href: g.teams.length === 1 ? `${base}/${g.allocationId}?bill=${g.teams[0].splitId}` : `${base}/${g.allocationId}`,
  }));
}

/** Coming due: overdue (with a total), sent and waiting on you, due in the next 14 days; later on request. */
function ComingDue({ due, showLater, onShowLater, base }: { due: ComingDueRead; showLater: boolean; onShowLater: () => void; base: string }) {
  const router = useRouter();
  const bands: { key: 'overdue' | 'sent' | 'due_soon' | 'later'; label: string; b: DueBand }[] = [
    { key: 'overdue', label: `Overdue · ${due.bands.overdue.count} · ${money(due.bands.overdue.amount)}`, b: due.bands.overdue },
    { key: 'sent', label: `Sent · waiting for you to confirm · ${due.bands.sent.count}`, b: due.bands.sent },
    { key: 'due_soon', label: `Due in the next ${due.windowDays} days · ${due.bands.due_soon.count} · ${money(due.bands.due_soon.amount)}`, b: due.bands.due_soon },
    ...(showLater ? [{ key: 'later' as const, label: `Later · ${due.later.count} · ${money(due.later.amount)}`, b: due.later }] : []),
  ];
  const shown = bands.filter(x => x.b.groups.length > 0);
  const laterWords = due.later.groups.slice(0, 3).map(g => `${g.allocationDescription}${g.installmentCount > 1 ? ` ${g.installmentNumber} of ${g.installmentCount}` : ''}`);

  return (
    <>
      {shown.length === 0 ? (
        <p className={moneyKit.lead1}>Nothing is overdue, waiting for you to confirm, or due in the next {due.windowDays} days.</p>
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
                  <th scope="col">State</th>
                  <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ key, label, b }) => (
                  <BandRows key={key} label={label} rows={dueRows(key, b, due.asOf, due.activeTeams, base)} onOpen={href => router.push(href)} />
                ))}
              </tbody>
            </table>
          </div>
          <div className={repKit.phoneOnly}>
            <ClubRowList label="Coming due">
              {shown.map(({ key, label, b }) => (
                <PhoneBand key={key} label={label} rows={dueRows(key, b, due.asOf, due.activeTeams, base)} />
              ))}
            </ClubRowList>
          </div>
        </>
      )}
      {!showLater && due.later.count > 0 && (
        <p className={repKit.notes}>
          Later this season: {laterWords.join(', ')}{due.later.groups.length > 3 ? ` and ${due.later.groups.length - 3} more` : ''}.{' '}
          <button type="button" className={repKit.inlineLink} onClick={onShowLater}>Show all</button>
        </p>
      )}
    </>
  );
}

function BandRows({ label, rows, onOpen }: { label: string; rows: DueRow[]; onOpen: (href: string) => void }) {
  return (
    <>
      <tr className={repKit.band}><td colSpan={6}>{label}</td></tr>
      {rows.map(r => (
        <tr key={r.key} className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; onOpen(r.href); }}>
          <td><Link href={r.href} className={repKit.nameLink} onClick={e => e.stopPropagation()}>{r.title}</Link></td>
          <td>{r.installment}{r.caption && <span className={repKit.cellSub}>{r.caption}</span>}</td>
          <td>{r.due}</td>
          <td className={repKit.num}>{money(r.amount)}</td>
          <td>{r.chip}</td>
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
      {rows.map(r => (
        <ClubRow key={r.key} as="link" href={r.href} title={<>{r.title} {r.chip}</>}
          caption={`${r.installment} · ${r.due} · ${money(r.amount)}${r.caption ? ` · ${r.caption}` : ''}`} chevron />
      ))}
    </>
  );
}

/** The list as a file — By allocation's rows, or Coming due's — whichever view is on screen. */
function AllocationsExport({ view, rows, due, orgSlug }: { view: string; rows: AllocationRow[]; due: ComingDueRead; orgSlug: string }) {
  const build = (): { headers: string[]; body: (string | number)[][] } => {
    if (view === 'coming-due') {
      const headers = ['Band', 'Team', 'Allocation', 'Installment', 'Due', 'Amount', 'Days late', 'Sent on'];
      const band = (key: string, word: string, b: DueBand) => b.groups.flatMap(g => g.teams.map(t => [
        word, t.teamName, g.allocationDescription, `${g.installmentNumber} of ${g.installmentCount}`, g.dueDate, t.amount,
        key === 'overdue' ? g.daysLate : '', t.sentOn ?? '',
      ]));
      return {
        headers,
        body: [
          ...band('overdue', 'Overdue', due.bands.overdue),
          ...band('sent', 'Sent, waiting for the club', due.bands.sent),
          ...band('due_soon', `Due in the next ${due.windowDays} days`, due.bands.due_soon),
          ...band('later', 'Later', due.later),
        ],
      };
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

