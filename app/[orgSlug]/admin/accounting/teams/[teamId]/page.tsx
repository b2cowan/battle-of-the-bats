'use client';
/**
 * Accounting › A TEAM'S ACCOUNT WITH THE CLUB (Club Tier Stage 3a, specimen 1 — Ask 5a, D1, C12).
 * One level down from the Overview's "Held by the teams" (and Rep Teams' "With the club" door): a back
 * arrow to the Overview, no tab row.
 *
 * READ-ONLY BY CONSTRUCTION — nothing here adds, edits, voids or transfers. The team's money is its
 * coaches' (D1); this is the club's side of the team, from the club's own records: what it billed,
 * what it received, what it paid the team on request. A statement: Billed · Collected · Paid to the
 * team · Outstanding (running — paying the team on request never changes it), banded by the team's
 * seasons, closing on "Outstanding on {today}". A line opens the allocation or the request it came
 * from. Export writes the statement.
 *
 * ⚖ Stage 3d (Asks 5 and 6): the page STAYS a page (a view of many records); only its doors change. A billed or
 * received line opens that team's bill in the allocation's window OVER this page, and × comes back here; a request
 * line still opens Payment requests with that request's window.
 *
 * ⚖ THE ONE FIGURE THE CLUB READS FROM THE TEAM'S OWN BOOKS (Club Tier Stage 3b, specimen 4 — D1, C15,
 * Ask 4e): the fourth card is the team's Cash on hand, read through the coaches' own function each time
 * the page opens (the figure their Money shows), never stored by the club, never added into a club figure —
 * the lock and the blue edge of "held by the team", its caption saying whose figure and for which season
 * (a team between seasons shows its closed season's closing figure and that season's close date). The
 * callout says which figure is read and that it is never added in. The statement under it is 3a's.
 */
import { use, useCallback, useState } from 'react';
import AllocationRecordWindow from '@/components/admin/kit/club/money/AllocationRecordWindow';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Lock } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import ExportMenu from '@/components/admin/ExportMenu';
import { Callout, LoadFailed, PageLoading, RepChip, repKit, useDeferredLoad, useLatestRead } from '@/components/admin/kit/club/RepKit';
import { day, daysLateWords, money, moneyFetch, moneyKit } from '@/components/admin/kit/club/money/MoneyKit';
import MoneySummaryBand from '@/components/coaches/MoneySummaryBand';
import { ledgerKit } from '@/components/coaches/kit';
import { howItCame, teamAccountCallout, teamCashCaption } from '@/lib/club-money-words';
import { fmt as fmtSigned } from '@/lib/coach-money-summary';
import { downloadCSVBlob, downloadXLSX, generateCSV, buildFilename } from '@/lib/export';
import { pluralize } from '@/lib/utils';
import type { AccountRow, TeamAccount, TeamCashHeld } from '@/lib/club-money-figures';

/** Where a statement line opens: the team's bill in the allocation's window (over this page), or a request's page. */
type RowDoor = { bill: { allocationId: string; splitId: string } } | { href: string };

interface AccountRead {
  asOf: string;
  team: { id: string; name: string };
  account: TeamAccount;
  seasons: { id: string; name: string; status: string }[];
  withTheClub: { requestsWaiting: number } | null;
  teamCash: TeamCashHeld | null;
}

const of = (r: AccountRow) => (r.installmentCount && r.installmentCount > 1 && r.installmentNumber ? `, ${r.installmentNumber} of ${r.installmentCount}` : '');

/** A statement row's name and its quiet line under it. */
function rowWords(r: AccountRow, teamName: string): { name: string; sub: string | null } {
  switch (r.kind) {
    case 'billed':
      return {
        name: `Billed · ${r.description}`,
        sub: r.installmentCount && r.installmentCount > 1 ? `${r.installmentCount} installments` : 'One installment',
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
  const { currentOrg, loading: orgLoading } = useOrg();
  const router = useRouter();
  const q = `orgSlug=${encodeURIComponent(orgSlug)}`;
  const base = `/${orgSlug}/admin/accounting`;

  const [read, setRead] = useState<AccountRead | null>(null);
  const [failed, setFailed] = useState<{ notFound: boolean } | null>(null);
  /** The team's bill open over the page (Stage 3d). */
  const [bill, setBill] = useState<{ allocationId: string; splitId: string } | null>(null);
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
  usePageTitle(read?.team.name ?? 'Team account');

  const header = (
    <AdminPageHeader
      backTo={{ href: base, label: 'Overview' }}
      crumbs={[{ label: 'Accounting' }, { label: 'Overview' }]}
      title={read?.team.name ?? 'Team'}
      titleChips={<RepChip tone="info">Team</RepChip>}
      actions={read ? <StatementExport read={read} orgSlug={orgSlug} /> : undefined}
    />
  );
  if (failed) {
    return (
      <div className={repKit.page}>
        {header}
        {failed.notFound
          ? <LoadFailed title={`This team isn’t in ${currentOrg?.name ?? 'your club'}.`} sub="It may have been removed, or it belongs to a team group you don’t manage." />
          : <LoadFailed title="We couldn’t load this team’s account." onRetry={() => void load()} />}
      </div>
    );
  }
  if (!read) return <PageLoading header={header} />;

  const { account, team } = read;
  const f = account.figures;
  const left = f.installmentCount - f.receivedCount;
  const seasonName = new Map(read.seasons.map(s => [s.id, s.name]));
  const doorOf = (r: AccountRow): RowDoor | null => r.kind === 'billed' || r.kind === 'received'
    ? (r.allocationId ? { bill: { allocationId: r.allocationId, splitId: r.sourceId } } : null)
    : { href: `${base}/payment-requests?request=${r.sourceId}` };
  const open = (door: RowDoor) => { if ('bill' in door) setBill(door.bill); else router.push(door.href); };
  const empty = account.seasons.length === 0;
  const waiting = read.withTheClub?.requestsWaiting ?? 0;
  const cash = read.teamCash;

  return (
    <div className={repKit.page}>
      {header}
      <Callout tone="info" role="note" icon={<Lock size={16} aria-hidden />}>
        {teamAccountCallout(team.name)}
      </Callout>

      {/* ⚖ ONE JOINED BAND (Stage 3d, owner 2026-10-08: "the new standard is that they are connected") — four separate
          cards until then. Cash on hand keeps the lock and the blue edge of a figure the club reads but doesn't own. */}
      <MoneySummaryBand
        ariaLabel={`${team.name}’s account with the club`}
        tiles={[
          { key: 'outstanding', label: 'Outstanding', figure: money(account.outstanding), caption: left > 0 ? pluralize(left, 'installment') + ' not yet received' : 'Nothing owed' },
          { key: 'next', label: 'Next due', figure: f.nextDue ? money(f.nextDue.amount) : '—', caption: f.nextDue ? day(f.nextDue.dueDate) : f.overdue.count > 0 ? `${money(f.overdue.amount)} overdue` : 'Nothing coming due' },
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

      {empty ? (
        <p className={repKit.notes}>The club hasn’t billed {team.name} or paid it on a request yet.</p>
      ) : (
        <>
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
          <p className={repKit.notes}>A line opens the allocation or the request it came from. The season band follows the team’s own seasons, so a finished season’s lines stay under its name.</p>
        </>
      )}
      {bill && (
        <AllocationRecordWindow q={q} orgSlug={orgSlug} allocationId={bill.allocationId} bill={bill.splitId}
          onChanged={() => void load()} onClose={() => setBill(null)} />
      )}
    </div>
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
            <td className={repKit.dim} data-label="Date">{day(r.date)}</td>
            <td className={ledgerKit.whatCell}>
              {/* The name is the row's keyboard door: a window's button for a bill, a link for a request. */}
              {door && 'bill' in door
                ? <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} aria-haspopup="dialog" onClick={e => { e.stopPropagation(); onOpen(door); }}>{w.name}</button>
                : door
                  ? <Link href={door.href} className={repKit.nameLink} onClick={e => e.stopPropagation()}>{w.name}</Link>
                  : <span className={moneyKit.what}>{w.name}</span>}
              {w.sub && <span className={repKit.cellSub}>{w.sub}</span>}
            </td>
            <td className={repKit.num} data-label={r.billed ? 'Billed' : undefined}>{r.billed ? money(r.billed) : ''}</td>
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
    return [seasonName.get(s.programYearId) ?? '', r.date, w.name, w.sub ?? '', r.billed || '', r.collected || r.receivedOnRequest || '', r.paidToTeam || '', r.outstanding];
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
