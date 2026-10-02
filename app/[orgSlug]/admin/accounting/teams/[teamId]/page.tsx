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
 */
import { use, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Lock } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import ExportMenu from '@/components/admin/ExportMenu';
import { Callout, LoadFailed, PageLoading, RepChip, repKit, useDeferredLoad, useLatestRead } from '@/components/admin/kit/club/RepKit';
import { FigureCards, day, money, moneyFetch, moneyKit } from '@/components/admin/kit/club/money/MoneyKit';
import { ledgerKit } from '@/components/coaches/kit';
import { howItCame } from '@/lib/club-money-words';
import { downloadCSVBlob, downloadXLSX, generateCSV, buildFilename } from '@/lib/export';
import { pluralize } from '@/lib/utils';
import type { AccountRow, TeamAccount } from '@/lib/club-money-figures';

interface AccountRead {
  asOf: string;
  team: { id: string; name: string };
  account: TeamAccount;
  seasons: { id: string; name: string; status: string }[];
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
        sub: [howItCame(r.paidMethod, r.paidReference), r.daysLate ? `${r.daysLate} ${r.daysLate === 1 ? 'day' : 'days'} late` : null, r.recordedBy]
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
  const hrefOf = (r: AccountRow) => r.kind === 'billed' || r.kind === 'received'
    ? (r.allocationId ? `${base}/allocations/${r.allocationId}?bill=${r.sourceId}` : null)
    : `${base}/payment-requests?request=${r.sourceId}`;
  const empty = account.seasons.length === 0;

  return (
    <div className={repKit.page}>
      {header}
      <Callout tone="info" role="note" icon={<Lock size={16} aria-hidden />}>
        <b>{team.name}’s money is kept by its coaches, in their portal, and is never added into the club’s figures.</b>
        <span className={repKit.calloutSub}>
          This page is the club’s side of the team: what the club billed, what it received, and what it paid the team on request. Nothing here can be added, edited, voided or transferred.
        </span>
      </Callout>

      <FigureCards three items={[
        { label: 'Outstanding', value: money(account.outstanding), sub: left > 0 ? pluralize(left, 'installment') + ' not yet received' : 'Nothing owed' },
        { label: 'Next due', value: f.nextDue ? money(f.nextDue.amount) : '—', sub: f.nextDue ? day(f.nextDue.dueDate) : f.overdue.count > 0 ? `${money(f.overdue.amount)} overdue` : 'Nothing coming due' },
        { label: 'Paid to the team', value: money(account.paidToTeam), sub: account.paidToTeamCount > 0 ? pluralize(account.paidToTeamCount, 'request') : 'No requests paid' },
      ]} />

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
                    hrefOf={hrefOf} onOpen={href => router.push(href)} />
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
    </div>
  );
}

function SeasonRows({ label, rows, teamName, hrefOf, onOpen }: {
  label: string; rows: AccountRow[]; teamName: string; hrefOf: (r: AccountRow) => string | null; onOpen: (href: string) => void;
}) {
  return (
    <>
      <tr className={repKit.band} data-band=""><td colSpan={7}>{label}</td></tr>
      {rows.map((r, i) => {
        const w = rowWords(r, teamName);
        const href = hrefOf(r);
        return (
          <tr key={`${r.kind}-${r.sourceId}-${r.installmentId ?? ''}-${i}`} className={href ? repKit.rowOpens : undefined}
            onClick={href ? () => { if (window.getSelection()?.toString()) return; onOpen(href); } : undefined}>
            <td className={repKit.dim} data-label="Date">{day(r.date)}</td>
            <td className={ledgerKit.whatCell}>
              {href
                ? <Link href={href} className={repKit.nameLink} onClick={e => e.stopPropagation()}>{w.name}</Link>
                : <span className={moneyKit.what}>{w.name}</span>}
              {w.sub && <span className={repKit.cellSub}>{w.sub}</span>}
            </td>
            <td className={repKit.num} data-label={r.billed ? 'Billed' : undefined}>{r.billed ? money(r.billed) : ''}</td>
            <td className={repKit.num} data-label={r.collected || r.receivedOnRequest ? 'Collected' : undefined}>{r.collected ? money(r.collected) : r.receivedOnRequest ? money(r.receivedOnRequest) : ''}</td>
            <td className={repKit.num} data-label={r.paidToTeam ? 'Paid to the team' : undefined}>{r.paidToTeam ? money(r.paidToTeam) : ''}</td>
            <td className={repKit.num} data-label="Outstanding">{money(r.outstanding)}</td>
            <td className={`${repKit.go} ${ledgerKit.goCell}`}>{href && <span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span>}</td>
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
