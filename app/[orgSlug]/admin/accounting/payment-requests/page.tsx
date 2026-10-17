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
 *   Stage 11d — a hand-back that asks for money back is a request here too ("Hand back 4 Sundays", its schedule and
 *             Sundays under it, From club, Money back): opening a WAITING one opens the one Answer window (Accept ·
 *             Decline…); an ACCEPTED one waits here as "Accepted Oct 14 · to pay" and is paid with Record paying (D6).
 *
 * `?request={id}` opens a request on arrival — the Ledger's source door and a notice land here. A request no longer here
 * (a coach withdrew it, or its ask closed) says so in the page's note, from the reader's own notification about it —
 * it used to open nothing and say nothing (Needs attention clears itself, A5 — owner 2026-10-16).
 * ⚖ The request's window and its questions are the ONE shared flow (`RequestFlow`, Club Accounting · Teams, Ask 5): a
 * team's account opens the same request over itself, so the two pages can never answer a request two ways.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { REQUEST_DIRECTION_WORD, methodWord, requestStatusWord } from '@/lib/club-money-words';
import ExportMenu from '@/components/admin/ExportMenu';
import PageNotice, { useNotice } from '@/components/admin/kit/club/PageNotice';
import { ClubRow, ClubRowBand, ClubRowList, LoadFailed, RepChip, repKit, useDeferredLoad, useLatestRead } from '@/components/admin/kit/club/RepKit';
import { CoachListToolbar } from '@/components/coaches/kit';
import MultiSelectDropdown from '@/components/coaches/MultiSelectDropdown';
import { day, money, moneyFetch, moneyKit } from '@/components/admin/kit/club/money/MoneyKit';
import { StateChip, decisionLine, filedAs, handBackLine, toClub, type RequestRow, type RequestsRead } from '@/components/admin/kit/club/money/RequestWindows';
import RequestFlow from '@/components/admin/kit/club/money/RequestFlow';
import { requestWaitsOnClub } from '@/lib/club-money-figures';
import { downloadCSVBlob, downloadXLSX, generateCSV, buildFilename } from '@/lib/export';
import LoadingState from '@/components/shared/LoadingState';
import { fetchDoorNote } from '@/lib/needs-attention-door';
import { possessive } from '@/lib/utils';

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
  // Waiting on the club — unanswered, or accepted and still to pay (Stage 11d) — and holding the season's payout: red, first.
  if (requestWaitsOnClub(r.status) && r.holdingPayout) return <span className={moneyKit.holding}>Holding up {possessive(r.teamName)} end-of-season payout to families</span>;
  // A hand-back names its schedule and its Sundays (Stage 11d, specimen 3).
  const hb = handBackLine(r);
  if (hb) return <span className={repKit.cellSub}>{hb}</span>;
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
    router.replace(id ? `${base}?request=${id}` : base, { scroll: false });
  };
  // A stale tap (`keepOpen`) keeps the question open with the server's sentence in it, and the request
  // re-reads underneath — closing it here would throw that sentence away (the "refused in words" rule).
  const after = (text: string | null, keepOpen = false) => {
    if (text) setNotice({ tone: 'good', text });
    if (!keepOpen) openRequest(null);
    void load();
  };

  // The link named a request that isn't here any more: say what happened to it (A5), once, and drop it from the address.
  const missingRef = useRef<string | null>(null);
  useEffect(() => {
    if (!read || !openId || missingRef.current === openId || all.some(r => r.id === openId)) return;
    const id = openId;
    missingRef.current = id;
    setOpenId(null);
    router.replace(base, { scroll: false });
    // Only an outcome the record states: a request this list doesn't show may simply be decided in another year.
    void fetchDoorNote({ requestId: id }).then(note => { if (note) setNotice({ tone: 'good', text: note }); });
  }, [read, openId, all, base, router, setNotice]);

  if (failed) return <LoadFailed title="We couldn’t load the payment requests." onRetry={() => void load()} />;
  if (!read) return <LoadingState label="Loading payment requests…" />;

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

      {/* The request and the questions before money moves — the one shared flow (a waiting hand-back opens the Answer
          window there, Stage 11d). Keyed by the request, so another request starts on its own window. */}
      {open && <RequestFlow key={open.id} request={open} q={q} canMove={canMove} onClose={() => openRequest(null)} onDone={after} />}
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
          <td>{r.status === 'pending' ? <span className={repKit.dim}>{waitedWords(r.waitingDays)}</span> : r.status === 'accepted' ? <span className={repKit.dim}>{decisionLine(r)}</span> : <StateChip r={r} />}</td>
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
        // A waiting card's one chip: the decision once decided; else how the coach filed it, else its
        // direction — never a bare dash in a title (/design 2026-10-01).
        const filed = filedAs(r).word;
        const chip = r.status !== 'pending' ? <StateChip r={r} />
          : !out && filed ? <FiledChip r={r} />
          : <RepChip>{out ? REQUEST_DIRECTION_WORD.payment_to_org : REQUEST_DIRECTION_WORD.charge_to_org}</RepChip>;
        // The payout it holds up reads red here too, as on a desk and in the drawing.
        const caption = r.status === 'pending'
          ? (r.holdingPayout
            ? <><span className={moneyKit.holdingInline}>Holding up the payout to families</span> · {waitedWords(r.waitingDays)}</>
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
