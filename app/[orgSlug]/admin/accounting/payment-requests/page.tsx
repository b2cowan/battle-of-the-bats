'use client';
/**
 * Accounting › PAYMENT REQUESTS (Club Tier Stage 3a, specimen 4 — C07, C15, S3A-03, J4-014; Ask 2 option B).
 *
 *   toolbar — the Team filter (quiet at rest) and Export. No count line (the band rows say how many);
 *             no create (a request is filed by a coach).
 *   table   — Team · Request · Direction (the coach's own To club / From club) · Filed as · Amount ·
 *             State · chevron, in two bands: Waiting on you (with a total) · Decided. A waiting row's
 *             state is its age; a row holding up a team's payout says so in red under the request.
 *             Approved, Declined, Reversed — only Approved takes colour.
 *   phone   — one frame with the two bands; a request opens full-screen with Decline / Approve docked.
 *
 * `?request={id}` opens a request on arrival — the Ledger's source door and a team's account land here.
 */
import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { REQUEST_DIRECTION_WORD, methodWord, requestStatusWord } from '@/lib/club-money-words';
import ExportMenu from '@/components/admin/ExportMenu';
import PageNotice, { useNotice } from '@/components/admin/kit/club/PageNotice';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { ClubRow, ClubRowBand, ClubRowList, LoadFailed, RepChip, repKit, useDeferredLoad, useLatestRead } from '@/components/admin/kit/club/RepKit';
import { CoachListToolbar } from '@/components/coaches/kit';
import MultiSelectDropdown from '@/components/coaches/MultiSelectDropdown';
import { day, money, moneyFetch, moneyKit } from '@/components/admin/kit/club/money/MoneyKit';
import {
  ApproveWindow, DeclineWindow, RequestWindow, ReverseWindow, StateChip, decisionLine, filedAs, toClub, type RequestRow,
} from '@/components/admin/kit/club/money/RequestWindows';
import { downloadCSVBlob, downloadXLSX, generateCSV, buildFilename } from '@/lib/export';

interface RequestsRead {
  asOf: string;
  canMove?: boolean;
  waiting: { count: number; total: number; holdingPayout: number; requests: RequestRow[] };
  decided: { count: number; requests: RequestRow[] };
}

const waitedWords = (n: number | null) => (n == null ? '' : n === 0 ? 'Today' : `${n} ${n === 1 ? 'day' : 'days'}`);

function DirectionChip({ r }: { r: RequestRow }) {
  const out = toClub(r);
  return (
    <RepChip>
      {out ? <ArrowUpRight size={11} aria-hidden /> : <ArrowDownLeft size={11} aria-hidden />}
      {out ? REQUEST_DIRECTION_WORD.payment_to_org : REQUEST_DIRECTION_WORD.charge_to_org}
    </RepChip>
  );
}

function FiledChip({ r }: { r: RequestRow }) {
  const f = filedAs(r);
  if (!f.word) return <span className={repKit.dim}>—</span>;
  return <RepChip tone={f.word === 'New money' ? 'info' : 'neutral'}>{f.word}</RepChip>;
}

/** The request's second line: who / when / how while it waits; the decision once decided; red when it holds a payout. */
function SecondLine({ r }: { r: RequestRow }) {
  if (r.status === 'pending' && r.holdingPayout) return <span className={moneyKit.holding}>Holding up {r.teamName}’s end-of-season payout to families</span>;
  if (r.status === 'pending') {
    return <span className={repKit.cellSub}>{[r.askedBy, day(r.createdAt), methodWord(r.paymentMethod)].filter(Boolean).join(' · ')}</span>;
  }
  const line = decisionLine(r);
  return line ? <span className={repKit.cellSub}>{line}</span> : null;
}

export default function PaymentRequestsTab() {
  const { currentOrg, loading: orgLoading } = useOrg();
  const router = useRouter();
  const search = useSearchParams();
  const slug = currentOrg?.slug ?? '';
  const q = `orgSlug=${encodeURIComponent(slug)}`;
  const base = `/${slug}/admin/accounting/payment-requests`;

  const [read, setRead] = useState<RequestsRead | null>(null);
  const [canMove, setCanMove] = useState(false);
  const [failed, setFailed] = useState(false);
  const [teams, setTeams] = useState<Set<string>>(() => new Set());
  const [openId, setOpenId] = useState<string | null>(() => search.get('request'));
  const [ask, setAsk] = useState<'approve' | 'decline' | 'reverse' | null>(null);
  const [notice, setNotice] = useNotice();

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    if (!slug) return;
    const current = beginRead();
    const r = await moneyFetch<RequestsRead>(`/api/admin/accounting/payment-requests?${q}`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); return; }
    setFailed(false);
    setRead(r.data);
    setCanMove(!!r.data.canMove);
  }, [slug, q, beginRead]);
  useDeferredLoad(!orgLoading && !!slug, load);

  const all = useMemo(() => [...(read?.waiting.requests ?? []), ...(read?.decided.requests ?? [])], [read]);
  const teamOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of all) seen.set(r.teamId, r.teamName);
    return [...seen].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }, [all]);
  const pass = (r: RequestRow) => teams.size === 0 || teams.has(r.teamId);
  const waiting = (read?.waiting.requests ?? []).filter(pass);
  const decided = (read?.decided.requests ?? []).filter(pass);
  const waitingTotal = waiting.reduce((s, r) => s + r.amount, 0);
  const open = all.find(r => r.id === openId) ?? null;

  const openRequest = (id: string | null) => {
    setOpenId(id);
    setAsk(null);
    router.replace(id ? `${base}?request=${id}` : base, { scroll: false });
  };
  // A stale tap (`keepOpen`) keeps the question open with the server's sentence in it, and the request
  // re-reads underneath — closing it here would throw that sentence away (the "refused in words" rule).
  const after = (text: string | null, keepOpen = false) => {
    if (text) setNotice({ tone: 'good', text });
    if (!keepOpen) openRequest(null);
    void load();
  };

  if (failed) return <LoadFailed title="We couldn’t load the payment requests." onRetry={() => void load()} />;
  if (!read) return <p className={ck.loading}>Loading…</p>;

  const bands: { key: string; label: string; rows: RequestRow[] }[] = [
    { key: 'waiting', label: `Waiting on you · ${waiting.length}${waiting.length ? ` · ${money(waitingTotal)}` : ''}`, rows: waiting },
    { key: 'decided', label: `Decided · ${decided.length}`, rows: decided },
  ].filter(b => b.rows.length > 0);

  return (
    <>
      {notice && <PageNotice notice={notice} />}
      <CoachListToolbar actions={<RequestsExport rows={[...waiting, ...decided]} orgSlug={slug} />}>
        {teamOptions.length > 1 && (
          <MultiSelectDropdown restQuiet label="Team" options={teamOptions} selected={teams} onChange={setTeams} allLabel="Every team" />
        )}
      </CoachListToolbar>

      {bands.length === 0 ? (
        <p className={moneyKit.lead1}>No payment requests{teams.size ? ' for these teams' : ' yet'}. A coach files one from their team’s Money page, under Club.</p>
      ) : (
        <>
          <div className={`${repKit.tableFrame} ${repKit.deskOnly}`}>
            <table className={repKit.table}>
              <thead>
                <tr>
                  <th scope="col">Team</th>
                  <th scope="col">Request</th>
                  <th scope="col">Direction</th>
                  <th scope="col">Filed as</th>
                  <th scope="col" className={repKit.num}>Amount</th>
                  <th scope="col">State</th>
                  <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
                </tr>
              </thead>
              <tbody>
                {bands.map(b => (
                  <BandRows key={b.key} label={b.label} rows={b.rows} onOpen={openRequest} />
                ))}
              </tbody>
            </table>
          </div>
          <div className={repKit.phoneOnly}>
            <ClubRowList label="Payment requests">
              {bands.map(b => (
                <PhoneBand key={b.key} label={b.label} rows={b.rows} onOpen={openRequest} />
              ))}
            </ClubRowList>
          </div>
          <p className={`${repKit.notes} ${repKit.deskOnly}`}>A row opens the request, where Approve and Decline live and ask first.</p>
        </>
      )}

      {open && !ask && (
        <RequestWindow r={open} canMove={canMove} onAsk={setAsk} onClose={() => openRequest(null)} />
      )}
      {open && ask === 'approve' && <ApproveWindow r={open} q={q} onClose={() => setAsk(null)} onDone={after} />}
      {open && ask === 'decline' && <DeclineWindow r={open} q={q} onClose={() => setAsk(null)} onDone={after} />}
      {open && ask === 'reverse' && <ReverseWindow r={open} q={q} onClose={() => setAsk(null)} onDone={after} />}
    </>
  );
}

function BandRows({ label, rows, onOpen }: { label: string; rows: RequestRow[]; onOpen: (id: string) => void }) {
  return (
    <>
      <tr className={repKit.band}><td colSpan={7}>{label}</td></tr>
      {rows.map(r => (
        <tr key={r.id} className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; onOpen(r.id); }}>
          <td><button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} aria-haspopup="dialog" onClick={e => { e.stopPropagation(); onOpen(r.id); }}>{r.teamName}</button></td>
          <td>{r.description}<SecondLine r={r} /></td>
          <td><DirectionChip r={r} /></td>
          <td><FiledChip r={r} /></td>
          <td className={repKit.num}>{money(r.amount)}</td>
          <td>{r.status === 'pending' ? <span className={repKit.dim}>{waitedWords(r.waitingDays)}</span> : <StateChip r={r} />}</td>
          <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
        </tr>
      ))}
    </>
  );
}

function PhoneBand({ label, rows, onOpen }: { label: string; rows: RequestRow[]; onOpen: (id: string) => void }) {
  return (
    <>
      <ClubRowBand>{label}</ClubRowBand>
      {rows.map(r => {
        const out = toClub(r);
        const chip = r.status !== 'pending' ? <StateChip r={r} />
          : out ? <RepChip>{REQUEST_DIRECTION_WORD.payment_to_org}</RepChip>
          : <FiledChip r={r} />;
        const caption = r.status === 'pending'
          ? (r.holdingPayout
            ? `Holding up the payout to families · ${waitedWords(r.waitingDays)}`
            : `${out ? REQUEST_DIRECTION_WORD.payment_to_org : REQUEST_DIRECTION_WORD.charge_to_org} · ${r.description} · ${waitedWords(r.waitingDays)}`)
          : `${out ? REQUEST_DIRECTION_WORD.payment_to_org : REQUEST_DIRECTION_WORD.charge_to_org} · ${r.description}`;
        return (
          <ClubRow key={r.id} as="button" aria-haspopup="dialog" onClick={() => onOpen(r.id)}
            title={<>{r.teamName} · {money(r.amount)} {chip}</>} caption={caption} chevron />
        );
      })}
    </>
  );
}

function RequestsExport({ rows, orgSlug }: { rows: RequestRow[]; orgSlug: string }) {
  const headers = ['Team', 'Request', 'Direction', 'Filed as', 'Amount', 'State', 'Asked by', 'Asked on', 'Decided on', 'How', 'Reference', 'Reason'];
  const body = () => rows.map(r => {
    const f = filedAs(r);
    return [
      r.teamName, r.description, toClub(r) ? REQUEST_DIRECTION_WORD.payment_to_org : REQUEST_DIRECTION_WORD.charge_to_org,
      f.word ?? (f.legacy ? 'Filed before we asked' : ''), r.amount, requestStatusWord(r.status), r.askedBy ?? '', r.createdAt.slice(0, 10),
      r.status === 'reversed' ? (r.reversedAt ?? '').slice(0, 10) : (r.paidOn ?? r.reviewedAt ?? '').slice(0, 10),
      methodWord(r.paidMethod) ?? methodWord(r.paymentMethod) ?? '', r.paidReference ?? '', r.reversedReason ?? r.denialReason ?? '',
    ];
  });
  const name = (ext: 'xlsx' | 'csv') => buildFilename({ org: orgSlug, dataset: 'payment requests' }, ext);
  return (
    <ExportMenu
      formats={['xlsx', 'csv']}
      disabled={rows.length === 0}
      onExportXLSX={() => downloadXLSX(name('xlsx'), headers, body(), 'Requests')}
      onExportCSV={() => downloadCSVBlob(name('csv'), generateCSV(headers, body()))}
    />
  );
}
