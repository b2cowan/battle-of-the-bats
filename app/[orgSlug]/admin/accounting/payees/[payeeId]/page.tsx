'use client';
/**
 * Accounting › Ledger › Payees › A SHARED PAYEE'S REPORT (Club Tier Stage 3b, session 2 — hub specimen 5;
 * S3B-06, Ask 3; ruling D1 widened narrowly, owner 2026-10-02).
 *
 * What the club's teams RECORDED paying one payee the club shares with them — worded as each team's own
 * record, never as proof that money changed hands (BUSINESS_DECISIONS 2026-10-02 §2). One level down from
 * Payees: the back arrow, the trail, the Year pill and Export; the blue "held" callout; a row per team that
 * FOLDS to its payments (a right ↔ down chevron before the name; no row-end chevron — nothing opens a page,
 * because the records are the team's); the total row; "Nothing recorded (n)", the club's active teams in the
 * year with no row (Ask 3). On a phone, the desk's order, folding the same way.
 *
 * The definition is the server's (lib/club-payee-report.ts, the plan's words): both stamps on or after the
 * share — the payment's own and its bill's — and the payment's date in the year. A team's other payees and
 * other spending never show; nothing on the Payees list changes. Teams outside the reader's groups are left
 * out (B11).
 */
import { use, useCallback, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Lock } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { CoachListToolbar } from '@/components/coaches/kit';
import PageNotice, { useNotice } from '@/components/admin/kit/club/PageNotice';
import {
  Callout, ClubRowBand, ClubRowFrame, ClubRowList, LoadFailed, PageLoading, RepChip, repKit, useDeferredLoad, useLatestRead,
} from '@/components/admin/kit/club/RepKit';
import { day, money, moneyFetch, moneyKit } from '@/components/admin/kit/club/money/MoneyKit';
import YearPill from '@/components/admin/kit/club/money/YearPill';
import ClubMoneyExport, { useClubMoneyFile, type ClubMoneyFile } from '@/components/admin/kit/club/money/ClubMoneyExport';
import cr from '@/components/admin/kit/club/money/ClubReport.module.css';
import { PAYEE_REPORT_WORDS } from '@/lib/club-money-words';
import type { PayeeReport, PayeeReportTeam } from '@/lib/club-payee-report';
import { formatStoredDate, tournamentToday } from '@/lib/timezone';
import type { MoneyRowKind } from '@/lib/coach-money-exports';

type Report = PayeeReport;
type TeamRow = PayeeReportTeam;

/** "May 23 · Jun 13 · Jul 11 · Aug 8 · $180.00 each" when every payment is the same; else one line each. */
function paymentsLines(t: TeamRow): { key: string; text: string; amount: string }[] {
  const same = t.payments.every(p => Math.abs(p.amount - t.payments[0].amount) < 0.005);
  if (same && t.payments.length > 1) {
    return [{ key: 'all', text: t.payments.map(p => day(p.paidDate)).join(' · '), amount: `${money(t.payments[0].amount)} each` }];
  }
  return t.payments.map(p => ({
    key: p.id,
    text: `${day(p.paidDate)}${p.outOfPocket ? ` · ${PAYEE_REPORT_WORDS.outOfPocket}` : ''}`,
    amount: money(p.amount),
  }));
}

export default function SharedPayeeReportPage({ params }: { params: Promise<{ orgSlug: string; payeeId: string }> }) {
  const { orgSlug, payeeId } = use(params);
  const { currentOrg, loading: orgLoading } = useOrg();
  const isPhone = useIsPhone();
  const q = `orgSlug=${encodeURIComponent(orgSlug)}`;
  const payeesHref = `/${orgSlug}/admin/accounting/payees`;
  // The fiscal year read: the server's (today's until one is picked) — Stage 3c, no year worked out here.
  const [year, setYear] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [failed, setFailed] = useState<{ notShared: boolean } | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useNotice();
  usePageTitle(report?.payee.name ?? 'Payee');

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const current = beginRead();
    const r = await moneyFetch<{ report: Report }>(`/api/admin/accounting/payees/${payeeId}/report?${q}${year ? `&year=${year}` : ''}`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed({ notShared: r?.status === 404 }); return; }
    setFailed(null);
    setReport(r.data.report);
  }, [payeeId, q, year, beginRead]);
  useDeferredLoad(!orgLoading, load);

  // The years a reader can look at: the fiscal years holding records for this payee, and the one read (the server's
  // list — Stage 3c; session 2 shows a Year control only when there is more than one).
  const years = useMemo(() => {
    if (!report) return [];
    const list = [...report.years];
    if (!list.some(y => y.key === report.year.key)) list.push({ key: report.year.key, name: report.year.name });
    return list;
  }, [report]);
  const toggle = (id: string) => setOpen(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const buildExport = useCallback((): ClubMoneyFile => {
    if (!report) throw new Error('The report is still loading.');
    const rows: Record<string, string | number>[] = [];
    const kinds: (MoneyRowKind | undefined)[] = [];
    for (const t of report.teams) {
      rows.push({ team: t.teamName, payments: t.count, first: t.firstDay, latest: t.lastDay, recorded: t.total }); kinds.push('category');
      for (const p of t.payments) { rows.push({ team: `  — ${day(p.paidDate)}${p.outOfPocket ? ` · ${PAYEE_REPORT_WORDS.outOfPocket}` : ''}`, recorded: p.amount }); kinds.push('item'); }
    }
    rows.push({ team: PAYEE_REPORT_WORDS.recordedBand(report.teams.length, report.total), payments: report.count, recorded: report.total }); kinds.push('total');
    if (report.nothingRecorded.length > 0) {
      rows.push({ team: `${PAYEE_REPORT_WORDS.nothingBand(report.nothingRecorded.length)}: ${report.nothingRecorded.map(t => t.teamName).join(', ')}` }); kinds.push('plain');
    }
    const sharedOn = report.payee.sharedAt;
    return {
      dataset: `${report.payee.name} recorded by teams`,
      title: 'What the teams recorded',
      columns: [
        { label: 'Team', key: 'team', format: 'text' },
        { label: 'Payments', key: 'payments', format: 'number' },
        { label: 'First', key: 'first', format: 'date' },
        { label: 'Latest', key: 'latest', format: 'date' },
        { label: 'Recorded', key: 'recorded', format: 'currency' },
      ],
      rows,
      rowKinds: kinds,
      scopeLabel: String(report.year.name),
      teamName: currentOrg?.name ?? '',
      notes: [
        { id: 'payee-callout', tone: 'note', segments: [{ text: PAYEE_REPORT_WORDS.callout(report.payee.name, report.year.name, sharedOn) }] },
        { id: 'payee-foot', tone: 'note', segments: [{ text: PAYEE_REPORT_WORDS.foot(sharedOn) }] },
      ],
      masthead: {
        title: `${currentOrg?.name ?? ''} · ${report.payee.name}`,
        subtitle: `What the teams recorded paying it · ${report.year.name}`,
        meta: `As at ${formatStoredDate(tournamentToday(), { withYear: true, longMonth: true })}`,
      },
      emptyMessage: `No team recorded paying ${report.payee.name} in ${report.year.name}.`,
    };
  }, [report, currentOrg?.name]);
  const exportFailed = useCallback((text: string) => setNotice({ tone: 'bad', text }), [setNotice]);
  const runExport = useClubMoneyFile(q, orgSlug, buildExport, exportFailed);

  const header = (
    <AdminPageHeader
      backTo={{ href: payeesHref, label: 'Payees' }}
      crumbs={[{ label: 'Accounting' }, { label: 'Ledger' }, { label: 'Payees' }]}
      title={report?.payee.name ?? 'Payee'}
      titleChips={report ? <RepChip tone="info">Shared with teams</RepChip> : undefined}
    />
  );
  if (failed) {
    return (
      <div className={repKit.page}>
        {header}
        {failed.notShared
          ? <LoadFailed title="This payee isn’t shared with your teams." sub="Only a payee the club shares has a report of what the teams recorded paying it." />
          : <LoadFailed title="We couldn’t load the report." onRetry={() => void load()} />}
      </div>
    );
  }
  if (!report) return <PageLoading header={header} />;

  const sharedOn = report.payee.sharedAt;
  return (
    <div className={repKit.page}>
      {header}
      {notice && <PageNotice notice={notice} />}
      <CoachListToolbar actions={<ClubMoneyExport run={runExport} formats={['xlsx', 'csv']} disabled={report.teams.length === 0} />}>
        <YearPill year={report.year.key} years={years} onChange={y => { setYear(y); setOpen(new Set()); }} />
      </CoachListToolbar>
      <Callout tone="info" role="note" icon={<Lock size={16} aria-hidden />}>
        {isPhone ? PAYEE_REPORT_WORDS.calloutShort(sharedOn) : PAYEE_REPORT_WORDS.callout(report.payee.name, report.year.name, sharedOn)}
      </Callout>

      {!isPhone ? (
        <div className={repKit.tableFrame}>
          <table className={repKit.table}>
            <thead>
              <tr>
                <th scope="col">Team</th>
                <th scope="col" className={repKit.num}>Payments</th>
                <th scope="col">First · latest</th>
                <th scope="col" className={repKit.num}>Recorded</th>
              </tr>
            </thead>
            <tbody>
              {report.teams.map(t => {
                const isOpen = open.has(t.teamId);
                return (
                  <TeamRows key={t.teamId} t={t} isOpen={isOpen} onToggle={() => toggle(t.teamId)} />
                );
              })}
              {report.teams.length === 0 && (
                <tr><td colSpan={4} className={repKit.dim}>No team recorded paying {report.payee.name} in {report.year.name}.</td></tr>
              )}
              {report.teams.length > 0 && (
                <tr className={moneyKit.closeRow}>
                  <td>{report.teams.length} {report.teams.length === 1 ? 'team' : 'teams'} recorded</td>
                  <td className={repKit.num}>{report.count}</td>
                  <td />
                  <td className={repKit.num}>{money(report.total)}</td>
                </tr>
              )}
              {report.nothingRecorded.length > 0 && (
                <>
                  <tr className={repKit.band}><td colSpan={4}>{PAYEE_REPORT_WORDS.nothingBand(report.nothingRecorded.length)}</td></tr>
                  <tr><td colSpan={4} className={repKit.dim}>{report.nothingRecorded.map(t => t.teamName).join(' · ')}</td></tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <ClubRowFrame>
          <ClubRowList inset label="What the teams recorded">
            <ClubRowBand>{PAYEE_REPORT_WORDS.recordedBand(report.teams.length, report.total)}</ClubRowBand>
            {report.teams.map(t => {
              const isOpen = open.has(t.teamId);
              return (
                <li key={t.teamId} className={repKit.rowItem} data-row-list-row>
                  <button type="button" className={`${repKit.row} ${repKit.rowDoor}`} aria-expanded={isOpen} onClick={() => toggle(t.teamId)}>
                    {/* The fold chevron is the row's MARK (an icon kept at its start), not its LEAD: the kit moves a lead
                        under the title on a phone and adds " ·" after it (it is a date column) — /design, 2026-10-06. */}
                    <span className={repKit.rowMark} aria-hidden>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
                    <span className={repKit.rowMain}>
                      <span className={repKit.rowTitle}>{t.teamName}</span>
                      <span className={repKit.rowCaption}>
                        {PAYEE_REPORT_WORDS.rowSpan(t.count, t.firstDay, t.lastDay)} · {money(t.total)}
                        {isOpen && paymentsLines(t).map(l => <span key={l.key} className={cr.payLine}>{l.text} · {l.amount}</span>)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {report.nothingRecorded.length > 0 && (
              <>
                <ClubRowBand>{PAYEE_REPORT_WORDS.nothingBand(report.nothingRecorded.length)}</ClubRowBand>
                <li className={repKit.rowItem} data-row-list-row>
                  <div className={repKit.row}><span className={repKit.rowMain}><span className={repKit.rowCaption}>{report.nothingRecorded.map(t => t.teamName).join(' · ')}</span></span></div>
                </li>
              </>
            )}
          </ClubRowList>
        </ClubRowFrame>
      )}
      <p className={repKit.notes}>{PAYEE_REPORT_WORDS.foot(sharedOn)}</p>
    </div>
  );
}

/** One team: the row folds to its payments (a right ↔ down chevron before the name — the standard's
 *  "down expands in place"); nothing opens a page. */
function TeamRows({ t, isOpen, onToggle }: { t: TeamRow; isOpen: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; onToggle(); }}>
        <td>
          <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} aria-expanded={isOpen}
            onClick={e => { e.stopPropagation(); onToggle(); }}>
            {isOpen ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />} {t.teamName}
          </button>
        </td>
        <td className={repKit.num}>{t.count}</td>
        <td className={repKit.dim}>{day(t.firstDay)}{t.lastDay !== t.firstDay ? ` · ${day(t.lastDay)}` : ''}</td>
        <td className={repKit.num}>{money(t.total)}</td>
      </tr>
      {isOpen && paymentsLines(t).map(l => (
        <tr key={l.key}>
          <td className={`${repKit.dim} ${cr.subRowLead}`} colSpan={3}>{l.text}</td>
          <td className={`${repKit.num} ${repKit.dim}`}>{l.amount}</td>
        </tr>
      ))}
    </>
  );
}
