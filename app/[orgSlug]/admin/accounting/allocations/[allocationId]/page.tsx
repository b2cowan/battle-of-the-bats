'use client';
/**
 * Accounting › Allocations › AN ALLOCATION (Club Tier Stage 3a, specimen 3 — Asks 1 and 3). One level
 * down: a back arrow to Allocations, no tab row.
 *
 *   figures — Allocated · Collected · Outstanding · Overdue (the ONE definitions, from the server).
 *   toolbar — the schedule and the budget line as one quiet line, Send reminders and Export.
 *   teams   — one row per team, with its head coach, in bands: Needs you first (overdue, or a payment a
 *             coach says they've sent), then On track; a state chip only where there is something to
 *             say (an on-track row shows a quiet dash). The whole row opens the team's BILL (a room).
 *
 * `?bill={splitId}` opens a team's bill on arrival — the Ledger's source door, Coming due's rows and a
 * team's account all land here.
 */
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Mail } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { pluralize } from '@/lib/utils';
import { formatStoredDate } from '@/lib/timezone';
import { methodWord } from '@/lib/club-money-words';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import ExportMenu from '@/components/admin/ExportMenu';
import PageNotice, { useNotice } from '@/components/admin/kit/club/PageNotice';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import {
  ClubRow, ClubRowBand, ClubRowList, LoadFailed, PageLoading, RepChip, repKit, useDeferredLoad, useLatestRead,
} from '@/components/admin/kit/club/RepKit';
import { CoachListToolbar } from '@/components/coaches/kit';
import { FigureCards, day, installmentsWord, money, moneyFetch, moneyKit } from '@/components/admin/kit/club/money/MoneyKit';
import { BillRoom, RecordWindow, UndoWindow, type BillInstallment, type TeamBill } from '@/components/admin/kit/club/money/BillWindows';
import RemindersWindow from '@/components/admin/kit/club/money/RemindersWindow';
import { downloadCSVBlob, downloadXLSX, generateCSV, buildFilename } from '@/lib/export';
import type { ClubBillFigures } from '@/lib/club-money-figures';

interface AllocationRead {
  asOf: string;
  canMove: boolean;
  budgetLineName: string | null;
  allocation: { id: string; description: string; createdAt: string; totalAmount: number };
  allocated: number;
  figures: ClubBillFigures;
  teams: TeamBill[];
}

const BAND_WORD = { needs_you: 'needs you', on_track: 'on track' } as const;

/** The team's next installment the club doesn't have yet (overdue first, by due date). */
function nextOf(b: TeamBill): BillInstallment | null {
  return b.installments.filter(i => i.state !== 'received').sort((x, y) => x.dueDate.localeCompare(y.dueDate))[0] ?? null;
}

export default function AllocationPage({ params }: { params: Promise<{ orgSlug: string; allocationId: string }> }) {
  const { orgSlug, allocationId } = use(params);
  const { currentOrg, loading: orgLoading, user } = useOrg();
  const router = useRouter();
  const search = useSearchParams();
  const q = `orgSlug=${encodeURIComponent(orgSlug)}`;
  const accountingBase = `/${orgSlug}/admin/accounting`;
  const listHref = `${accountingBase}/allocations`;
  const senderName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? 'you';

  const [read, setRead] = useState<AllocationRead | null>(null);
  const [failed, setFailed] = useState<{ notFound: boolean } | null>(null);
  const [openSplit, setOpenSplit] = useState<string | null>(() => search.get('bill'));
  const [question, setQuestion] = useState<null | { kind: 'record'; mode: 'receive' | 'confirm'; installmentId: string } | { kind: 'undo' } | { kind: 'remind' } | { kind: 'remindAll' }>(null);
  const [notice, setNotice] = useNotice();

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const current = beginRead();
    const r = await moneyFetch<AllocationRead>(`/api/admin/accounting/allocations/${allocationId}?${q}`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed({ notFound: r?.status === 404 || r?.status === 403 }); return; }
    setFailed(null);
    setRead(r.data);
  }, [allocationId, q, beginRead]);
  useDeferredLoad(!orgLoading, load);
  usePageTitle(read?.allocation.description ?? 'Allocation');

  // The open bill is part of the address, so Back and a shared link land on it.
  useEffect(() => {
    const want = openSplit ? `?bill=${openSplit}` : '';
    if ((search.get('bill') ?? null) !== openSplit) router.replace(`${listHref}/${allocationId}${want}`, { scroll: false });
  }, [openSplit, search, router, listHref, allocationId]);

  const bands = useMemo(() => {
    const teams = read?.teams ?? [];
    return {
      needs_you: teams.filter(t => t.band === 'needs_you'),
      on_track: teams.filter(t => t.band === 'on_track'),
    };
  }, [read]);

  const header = (
    <AdminPageHeader
      backTo={{ href: listHref, label: 'Allocations' }}
      crumbs={[{ label: 'Accounting' }, { label: 'Allocations' }]}
      title={read?.allocation.description ?? 'Allocation'}
    />
  );
  if (failed) {
    return (
      <div className={repKit.page}>
        {header}
        {failed.notFound
          ? <LoadFailed title="This allocation isn’t one you can open." sub="It may have been removed, or its teams are in a team group you don’t manage." />
          : <LoadFailed title="We couldn’t load this allocation." onRetry={() => void load()} />}
      </div>
    );
  }
  if (!read) return <PageLoading header={header} />;

  const f = read.figures;
  const teamCount = read.teams.length;
  const shares = new Set(read.teams.map(t => t.allocated));
  const perTeam = shares.size === 1 ? read.teams[0]?.allocated ?? 0 : null;
  const instCount = Math.max(0, ...read.teams.map(t => t.installments.length));
  const dues = [...new Set(read.teams.flatMap(t => t.installments.map(i => i.dueDate)))].sort();
  const overdueTeams = read.teams.filter(t => t.figures.overdue.count > 0).map(t => t.teamName);
  const lede = [
    pluralize(teamCount, 'team'),
    `${installmentsWord(instCount)}${dues.length ? `: ${dues.map(d => day(d)).join(', ')}` : ''}`,
    read.budgetLineName ? `budget line ${read.budgetLineName}` : null,
  ].filter(Boolean).join(' · ');

  const bill = read.teams.find(t => t.splitId === openSplit) ?? null;
  const inBand = bill ? bands[bill.band] : [];
  const at = bill ? inBand.findIndex(t => t.splitId === bill.splitId) : -1;
  const stepTo = (t: TeamBill | undefined) => (t ? { name: t.teamName, onStep: () => setOpenSplit(t.splitId) } : null);
  const after = (text: string | null, keepOpen = false) => {
    if (text) setNotice({ tone: 'good', text });
    if (!keepOpen) setQuestion(null);
    void load();
  };
  const recordFor = question?.kind === 'record' && bill ? bill.installments.find(i => i.id === question.installmentId) ?? null : null;

  return (
    <div className={repKit.page}>
      {header}
      {notice && <PageNotice notice={notice} />}
      <FigureCards items={[
        { label: 'Allocated', value: money(read.allocated), sub: perTeam != null ? `${pluralize(teamCount, 'team')} × ${money(perTeam)}` : pluralize(teamCount, 'team') },
        { label: 'Collected', value: money(f.collected), sub: `${f.receivedCount} of ${pluralize(f.installmentCount, 'installment')}` },
        { label: 'Outstanding', value: money(f.outstanding), sub: pluralize(f.installmentCount - f.receivedCount, 'installment') },
        { label: 'Overdue', value: money(f.overdue.amount), sub: overdueTeams.length ? overdueTeams.join(', ') : 'Nothing late', tone: f.overdue.amount > 0 ? 'bad' : undefined },
      ]} />

      <CoachListToolbar
        lede={lede}
        actions={
          <>
            {read.canMove && (
              <button type="button" className={`btn btn-outline ${ck.iconOnlyPhone}`} onClick={() => setQuestion({ kind: 'remindAll' })} aria-label="Send reminders">
                <Mail size={14} aria-hidden /><span className={ck.btnWord}>Send reminders</span>
              </button>
            )}
            <AllocationExport read={read} orgSlug={orgSlug} />
          </>
        }
      />

      <div className={`${repKit.tableFrame} ${repKit.deskOnly}`}>
        <table className={repKit.table}>
          <thead>
            <tr>
              <th scope="col">Team</th>
              <th scope="col">Head coach</th>
              <th scope="col" className={repKit.num}>Collected</th>
              <th scope="col" className={repKit.num}>Outstanding</th>
              <th scope="col">Next</th>
              <th scope="col">State</th>
              <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
            </tr>
          </thead>
          <tbody>
            {(['needs_you', 'on_track'] as const).map(b => bands[b].length > 0 && (
              <BandRows key={b} label={`${b === 'needs_you' ? 'Needs you' : 'On track'} · ${bands[b].length}`} teams={bands[b]} onOpen={setOpenSplit} />
            ))}
            <tr className={moneyKit.closeRow}>
              <td colSpan={2}>{pluralize(teamCount, 'team')}</td>
              <td className={repKit.num}>{money(f.collected)}</td>
              <td className={repKit.num}>{money(f.outstanding)}</td>
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>
      </div>
      <div className={repKit.phoneOnly}>
        <ClubRowList label="Teams">
          {(['needs_you', 'on_track'] as const).map(b => bands[b].length > 0 && (
            <PhoneBand key={b} label={`${b === 'needs_you' ? 'Needs you' : 'On track'} · ${bands[b].length}`} teams={bands[b]} onOpen={setOpenSplit} />
          ))}
        </ClubRowList>
      </div>
      <p className={repKit.notes}>A team’s row opens its bill: the installments, and what can be done with each.</p>

      {bill && !question && (
        <BillRoom
          allocation={read.allocation}
          bill={bill}
          bandWord={BAND_WORD[bill.band]}
          position={`${at + 1} of ${inBand.length}`}
          steps={{ prev: stepTo(inBand[at - 1]), next: stepTo(inBand[at + 1]) }}
          canMove={read.canMove}
          accountingBase={accountingBase}
          onRecord={(i, mode) => setQuestion({ kind: 'record', mode, installmentId: i.id })}
          onUndo={() => setQuestion({ kind: 'undo' })}
          onRemind={() => setQuestion({ kind: 'remind' })}
          onClose={() => setOpenSplit(null)}
        />
      )}
      {bill && recordFor && question?.kind === 'record' && (
        <RecordWindow mode={question.mode} allocation={read.allocation} bill={bill} installment={recordFor} q={q}
          onClose={() => setQuestion(null)} onDone={after} />
      )}
      {bill && question?.kind === 'undo' && (
        <UndoWindow allocation={read.allocation} bill={bill} q={q} onClose={() => setQuestion(null)} onDone={after} />
      )}
      {currentOrg && (question?.kind === 'remind' || question?.kind === 'remindAll') && (
        <RemindersWindow
          q={q}
          orgName={currentOrg.name}
          senderName={senderName}
          team={question.kind === 'remind' && bill ? { id: bill.teamId, name: bill.teamName } : undefined}
          onClose={() => setQuestion(null)}
          onSent={text => after(text)}
        />
      )}
    </div>
  );
}

function stateChip(t: TeamBill) {
  if (t.band !== 'needs_you') return <span className={repKit.dim}>—</span>;
  if (t.figures.overdue.count > 0) {
    const days = t.installments.filter(i => i.state === 'overdue').reduce((m, i) => Math.max(m, i.daysLate), 0);
    return <RepChip tone="bad">{days} {days === 1 ? 'day' : 'days'} late</RepChip>;
  }
  return <RepChip tone="info">Sent · confirm</RepChip>;
}

function BandRows({ label, teams, onOpen }: { label: string; teams: TeamBill[]; onOpen: (splitId: string) => void }) {
  return (
    <>
      <tr className={repKit.band}><td colSpan={7}>{label}</td></tr>
      {teams.map(t => {
        const next = nextOf(t);
        return (
          <tr key={t.splitId} className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; onOpen(t.splitId); }}>
            <td>
              <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} aria-haspopup="dialog" onClick={e => { e.stopPropagation(); onOpen(t.splitId); }}>{t.teamName}</button>
            </td>
            <td className={t.headCoaches.length ? undefined : repKit.dim}>{t.headCoaches.length ? t.headCoaches.join(', ') : 'No head coach yet'}</td>
            <td className={repKit.num}>{money(t.figures.collected)}</td>
            <td className={repKit.num}>{money(t.figures.outstanding)}</td>
            <td>{next ? `${day(next.dueDate)} · ${money(next.amount)}` : <span className={repKit.dim}>Paid in full</span>}</td>
            <td>{stateChip(t)}</td>
            <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
          </tr>
        );
      })}
    </>
  );
}

function PhoneBand({ label, teams, onOpen }: { label: string; teams: TeamBill[]; onOpen: (splitId: string) => void }) {
  return (
    <>
      <ClubRowBand>{label}</ClubRowBand>
      {teams.map(t => {
        const next = nextOf(t);
        const chip = t.band === 'needs_you' ? stateChip(t) : null;
        return (
          <ClubRow key={t.splitId} as="button" aria-haspopup="dialog" onClick={() => onOpen(t.splitId)}
            title={<>{t.teamName} {chip}</>}
            caption={`${money(t.figures.collected)} of ${money(t.allocated)} in${next ? ` · next ${day(next.dueDate)}` : ''}`}
            chevron />
        );
      })}
    </>
  );
}

/** The allocation's export: a row per installment, with the team, and each payment's method and reference. */
function AllocationExport({ read, orgSlug }: { read: AllocationRead; orgSlug: string }) {
  const headers = ['Team', 'Installment', 'Amount', 'Due', 'State', 'Received on', 'How it came', 'Reference', 'Recorded by', 'Sent on (coach)'];
  const STATE = { received: 'Received', sent: 'Sent · waiting for the club', overdue: 'Overdue', upcoming: 'Not due yet' } as const;
  const body = () => read.teams.flatMap(t => t.installments.map(i => [
    t.teamName, `${i.installmentNumber} of ${t.installments.length}`, i.amount, i.dueDate, STATE[i.state],
    i.received?.on ?? '', methodWord(i.received?.method) ?? '', i.received?.reference ?? '',
    i.received?.recordedBy ?? '', i.sent?.on ?? '',
  ]));
  const name = (ext: 'xlsx' | 'csv') => buildFilename({ org: orgSlug, dataset: read.allocation.description, scope: formatStoredDate(read.asOf) }, ext);
  return (
    <ExportMenu
      formats={['xlsx', 'csv']}
      disabled={read.teams.length === 0}
      onExportXLSX={() => downloadXLSX(name('xlsx'), headers, body(), 'Allocation')}
      onExportCSV={() => downloadCSVBlob(name('csv'), generateCSV(headers, body()))}
    />
  );
}
