'use client';
/**
 * Accounting › LEDGER (Club Tier Stage 3a, specimen 1 — Ask 6: the club's book reads EXACTLY like the
 * coach's Ledger; Ask 2 option B: the tab IS the book, the Book pill switches books).
 *
 *   top deck — what stays put whatever the filters say (owner 2026-09-02): the Book pill first (the
 *              club's books with their balances, Add ledger at its foot; opens on the General ledger),
 *              then Export, Tools and Add entry — lime, the one lime. ⚖ TOOLS (Ledger Parity D6, owner
 *              2026-10-02): a rare tool goes behind Tools, never a toolbar button — "This book" →
 *              Transfer, "The club's lists" → Payees; the coach's Ledger ends the same way. On a phone:
 *              the Book pill, Export, Tools (the ⋯ icon, a sheet) and Add entry as 44px icons.
 *   strip    — Type · Status · Category · Date, quiet at rest (Status opens on Posted + Pending; Date on
 *              This month — the club's difference from the coach's Around today), and the book's
 *              Balance at the strip's right edge. A narrowed Type or Category, or a Status without
 *              Posted, takes the Balance away (a balance over some of the entries belongs to nothing).
 *   the book — oldest first between a Starting and an Ending balance line (K-04), each naming its full
 *              date ("Starting balance · Jul 3, 2026" — D2; a row prints the day, D1); Date · What ·
 *              Category · Money out · Money in · Balance · chevron in K-01 compact rows; the What cell
 *              is the name, then the detail in quiet ink on the same line; no Source column; a pending
 *              line carries its chip and the balance before it, faint; the empty side of the pair blank;
 *              voids off the book until Status asks, then the void-row recipe. A card per entry on a
 *              phone — the shared kit's ONE card (K-25, D4). Every row opens its line's window; the
 *              name is its keyboard door at BODY weight (owner 2026-10-02 — the coach's look; D3).
 *
 * A team's book is NOT a Ledger book any more: the club reads a team through its account (Ask 5a), so
 * the Book pill lists the club's own books only, and a team book's old address forwards to the team.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, MoreHorizontal, Plus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { useTournament } from '@/lib/tournament-context';
import { tournamentToday, addCalendarDays } from '@/lib/timezone';
import { resolveDateRangePreset, type DateRangeSelection } from '@/lib/coach-date-range';
import { LINE_TYPE_WORD, type LineType } from '@/lib/club-ledger';
import { downloadCSVBlob, downloadXLSX, generateCSV, buildFilename } from '@/lib/export';
import ExportMenu from '@/components/admin/ExportMenu';
import PageNotice, { useNotice } from '@/components/admin/kit/club/PageNotice';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { LoadFailed, RepChip, repKit, useDeferredLoad, useLatestRead } from '@/components/admin/kit/club/RepKit';
import { CoachListToolbar, kit, ledgerKit } from '@/components/coaches/kit';
import { CoachToolbarMenu, CoachToolbarMenuHeading, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import { ledgerBalanceLabel, ledgerRowDate } from '@/lib/ledger-format';
import { clubSharesPayees } from '@/lib/team-payee-scope';
import MultiSelectDropdown from '@/components/coaches/MultiSelectDropdown';
import SingleSelectDropdown from '@/components/coaches/SingleSelectDropdown';
import DateRangeDropdown from '@/components/coaches/DateRangeDropdown';
import FilterGroup from '@/components/coaches/FilterGroup';
import pill from '@/components/shared/FilterPill.module.css';
import { day, money, moneyFetch, moneyKit } from '@/components/admin/kit/club/money/MoneyKit';
import { AddEntryWindow, LineWindow, TransferWindow, type BookRef } from '@/components/admin/kit/club/money/LedgerWindows';
import AddLedgerWindow from '@/components/admin/kit/club/money/AddLedgerWindow';
import type { BookRead, BookRowOut, LineStatus } from '@/lib/club-ledger-read';
import type { LedgerSummary } from '@/lib/types';

const PAGE = 500;
const STATUS_REST: ReadonlySet<string> = new Set(['posted', 'pending']);
const STATUS_ORDER: LineStatus[] = ['posted', 'pending', 'void'];
/** "All" on Status — every line, voided ones included (Filter Counts D5, 2026-10-05). */
const STATUS_ALL: ReadonlySet<string> = new Set(STATUS_ORDER);
const STATUS_WORD: Record<LineStatus, string> = { posted: 'Posted', pending: 'Pending', void: 'Void' };
/** Tournament fees keep a place in the Type list for Stage 7 (C18) — the option does not render until then. */
const TYPE_ORDER: LineType[] = ['expense', 'income', 'team_allocations', 'team_support', 'transfer', 'house_league_fees'];
/** The club's book is not one season deep: its "Whole season" preset reads "All time". */
const DATE_LABELS = { season: 'All time' } as const;

type Read = BookRead & { canMove: boolean };

function seasonBoundsFor(today: string) {
  return { from: '2000-01-01', to: addCalendarDays(today, 366) };
}

export default function LedgerTab() {
  const { currentOrg, loading: orgLoading } = useOrg();
  const router = useRouter();
  const search = useSearchParams();
  const isPhone = useIsPhone();
  const slug = currentOrg?.slug ?? '';
  const shares = !!currentOrg && clubSharesPayees(currentOrg);
  const q = `orgSlug=${encodeURIComponent(slug)}`;
  const base = `/${slug}/admin/accounting`;
  const payeesHref = `${base}/payees`;
  const today = useMemo(() => tournamentToday(), []);
  const bounds = useMemo(() => seasonBoundsFor(today), [today]);

  const [books, setBooks] = useState<LedgerSummary[] | null>(null);
  const [booksFailed, setBooksFailed] = useState(false);
  const [types, setTypes] = useState<Set<string>>(() => new Set());
  /* ⚖ "ALL" MEANS ALL (Filter Counts D5, owner 2026-10-05). The pill's own rule is "empty = All"; this used to map
     an empty pick back to Posted + Pending, so ticking All left the voided lines hidden and All never ticked. The
     pick is kept as picked; the statuses the book reads are derived from it. */
  const [pickedStatuses, setPickedStatuses] = useState<Set<string>>(() => new Set(STATUS_REST));
  const statuses = pickedStatuses.size ? pickedStatuses : STATUS_ALL;
  const [cats, setCats] = useState<Set<string>>(() => new Set());
  const [range, setRange] = useState<{ selection: DateRangeSelection; from: string; to: string }>(() => {
    const r = resolveDateRangePreset('thisMonth', today, bounds);
    return { selection: 'thisMonth', from: r.from, to: r.to };
  });
  const [read, setRead] = useState<Read | null>(null);
  const [more, setMore] = useState<BookRowOut[]>([]);
  const [readFailed, setReadFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState<BookRowOut | null>(null);
  const [win, setWin] = useState<'add' | 'transfer' | 'ledger' | null>(null);
  const { tournaments } = useTournament();
  const [notice, setNotice] = useNotice();

  // The club's books (never a team's), for the Book pill; the General ledger by default.
  const loadBooks = useCallback(async () => {
    if (!slug) return;
    const r = await moneyFetch<{ ledgers?: LedgerSummary[] }>(`/api/admin/accounting/ledgers?${q}`).catch(() => null);
    if (!r?.ok) { setBooksFailed(true); return; }
    setBooksFailed(false);
    setBooks(r.data.ledgers ?? []);
  }, [slug, q]);
  useDeferredLoad(!orgLoading && !!slug, loadBooks);

  const wanted = search.get('book');
  const clubBooks = useMemo(() => (books ?? []).filter(b => b.ledger.entityType !== 'team'), [books]);
  const teamBook = (books ?? []).find(b => b.ledger.id === wanted && b.ledger.entityType === 'team') ?? null;
  const book = clubBooks.find(b => b.ledger.id === wanted)
    ?? clubBooks.find(b => b.ledger.entityType === 'org' && !b.ledger.entityId)
    ?? clubBooks[0] ?? null;
  const bookId = book?.ledger.id ?? null;

  // A team's book is read through the team's account now (Ask 5a): its old address forwards there.
  useEffect(() => {
    if (teamBook?.ledger.entityId) router.replace(`${base}/teams/${teamBook.ledger.entityId}`);
  }, [teamBook, router, base]);

  const window_ = range.selection === 'season' ? { from: null, to: null } : { from: range.from, to: range.to };
  // One page of the book under the strip's filters (the first read and every Show more).
  const bookUrl = useCallback((offset: number) => {
    const params = new URLSearchParams({ orgSlug: slug, offset: String(offset), limit: String(PAGE) });
    if (window_.from) params.set('from', window_.from);
    if (window_.to) params.set('to', window_.to);
    params.set('status', [...statuses].join(','));
    if (types.size) params.set('type', [...types].join(','));
    if (cats.size) params.set('category', [...cats].join(','));
    return `/api/admin/accounting/ledgers/${bookId}/book?${params}`;
  }, [bookId, slug, window_.from, window_.to, statuses, types, cats]);

  const beginRead = useLatestRead();
  const loadBook = useCallback(async () => {
    if (!bookId || !slug) return;
    const current = beginRead();
    const r = await moneyFetch<Read>(bookUrl(0)).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setReadFailed(true); return; }
    setReadFailed(false);
    setRead(r.data);
    setMore([]);
  }, [bookId, slug, bookUrl, beginRead]);
  useDeferredLoad(!!bookId, loadBook);

  async function showMore() {
    if (!read || !bookId || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await moneyFetch<Read>(bookUrl(read.rows.length + more.length));
      if (r.ok) setMore(m => [...m, ...r.data.rows]);
    } finally {
      setLoadingMore(false);
    }
  }

  const changed = useCallback((text: string | null) => {
    if (text) setNotice({ tone: 'good', text });
    void loadBook();
    void loadBooks();
  }, [loadBook, loadBooks, setNotice]);

  if (booksFailed) return <LoadFailed title="We couldn’t load the club’s books." onRetry={() => void loadBooks()} />;
  if (!books || teamBook) return <p className={ck.loading}>Loading…</p>;
  if (!book) return <p className={ck.loading}>This club has no book yet.</p>;

  const ref: BookRef = { id: book.ledger.id, name: book.ledger.name, kind: book.ledger.entityType };
  const allRefs: BookRef[] = clubBooks.map(b => ({ id: b.ledger.id, name: b.ledger.name, kind: b.ledger.entityType }));
  const canMove = read?.canMove ?? false;
  const rows = read ? [...read.rows, ...more] : [];
  /* ⚖ THE BALANCE SHOWS ONLY WHILE EVERY ENTRY THAT MOVES IT IS ON SCREEN (owner, §255, 2026-10-02) —
     the coach's rule, `balanceIsMeaningful`: every narrowing counts. Type and Category hide entries
     that move it, so either takes the column (and the Starting / Ending lines and the strip's figure)
     away; Status takes it only once Posted is off, because a pending or void line never moves the
     balance. The date window never does: the Starting balance carries everything before it. */
  const showBalance = types.size === 0 && cats.size === 0 && statuses.has('posted');
  const counts = read?.counts;
  /* The window's census decides which Types are OFFERED; the number beside each choice is what ticking it would
     list (Filter Counts D1 + D5): at the row's end, never in the name. */
  const optionCounts = read?.optionCounts;
  const typeOptions = TYPE_ORDER
    .filter(t => t !== 'house_league_fees' || (counts?.type?.house_league_fees ?? 0) > 0)
    .map(t => ({ id: t, label: LINE_TYPE_WORD[t], count: optionCounts?.type?.[t] ?? 0 }));
  const pickBook = (id: string) => { setOpen(null); router.replace(`${base}/ledger?book=${id}`); };

  const bookFoot = canMove ? (
    <button type="button" className={`${pill.multiSelectOption} ${pill.multiSelectPick}`} onClick={() => setWin('ledger')}>
      <Plus size={14} aria-hidden /> Add ledger
    </button>
  ) : undefined;

  return (
    <>
      {notice && <PageNotice notice={notice} />}
      <CoachListToolbar>
        <div className={moneyKit.deck}>
          <SingleSelectDropdown
            lead
            shrink
            label="Book"
            options={clubBooks.map(b => ({ id: b.ledger.id, label: b.ledger.name, detail: money(b.balance) }))}
            value={book.ledger.id}
            onChange={pickBook}
            foot={bookFoot}
          />
          <div className={kit.toolbarActions}>
            <BookExport q={q} book={ref} window_={window_} rangeWords={rangeWords(range)} total={(counts?.status.posted ?? 0) + (counts?.status.pending ?? 0) + (counts?.status.void ?? 0)} orgSlug={slug} />
            {/* ⚖ TOOLS (Ledger Parity D6, owner 2026-10-02): the rare tools behind one menu, grouped — the
                coach's Ledger has the same door. A sheet on a phone, its trigger the bare ⋯. */}
            <CoachToolbarMenu label="Tools" icon={<MoreHorizontal size={15} aria-hidden />} collapseOnPhone bareOnPhone drawerOnPhone drawerTitle="Tools">
              {canMove && (
                <>
                  <CoachToolbarMenuHeading>This book</CoachToolbarMenuHeading>
                  <CoachToolbarMenuItem label="Transfer"
                    hint="Move money to another of the club’s books" onSelect={() => setWin('transfer')} />
                </>
              )}
              <CoachToolbarMenuHeading>The club’s lists</CoachToolbarMenuHeading>
              <CoachToolbarMenuItem label="Payees"
                hint={shares ? 'Rename, merge, or share with teams' : 'Rename a payee or merge two spellings'}
                onSelect={() => router.push(payeesHref)} />
            </CoachToolbarMenu>
            {canMove && (
              <button type="button" className={`btn btn-lime${isPhone ? ` ${ck.iconOnlyPhone}` : ''}`} onClick={() => setWin('add')} aria-label="Add entry">
                <Plus size={15} aria-hidden /><span className={ck.btnWord}>Add entry</span>
              </button>
            )}
          </div>
        </div>
        <div className={moneyKit.strip}>
          {/* ⚖ ON A PHONE THE FILTERS GO BEHIND ONE FILTER BUTTON, as on the coach's Ledger (Ledger Phone Filter D5,
              owner 2026-10-02), and Balance comes up beside it. A desk keeps the pills. */}
          <FilterGroup>
            <MultiSelectDropdown restQuiet label="Type" options={typeOptions} selected={types} onChange={setTypes} allLabel="Every type" />
            <MultiSelectDropdown
              restQuiet restSelection={STATUS_REST}
              label="Status"
              options={STATUS_ORDER.map(s => ({ id: s, label: STATUS_WORD[s], count: optionCounts?.status?.[s] ?? 0 }))}
              selected={pickedStatuses}
              onChange={setPickedStatuses}
            />
            {(read?.categories.length ?? 0) > 0 && (
              <MultiSelectDropdown restQuiet label="Category" options={(read?.categories ?? []).map(c => ({ id: c, label: c }))}
                selected={cats} onChange={setCats} allLabel="Every category" />
            )}
            <DateRangeDropdown
              restQuiet restSelectionId="thisMonth"
              selection={range.selection}
              from={range.from} to={range.to}
              todayKey={today}
              seasonBounds={bounds}
              labels={DATE_LABELS}
              onChange={next => {
                if (next.selection === 'custom') setRange(next);
                else { const r = resolveDateRangePreset(next.selection, today, bounds); setRange({ selection: next.selection, from: r.from, to: r.to }); }
              }}
            />
          </FilterGroup>
          {showBalance && read && (
            <span className={moneyKit.balance}>Balance <b>{money(read.balance)}</b></span>
          )}
        </div>
      </CoachListToolbar>

      {readFailed ? (
        <LoadFailed title={`We couldn’t load ${book.ledger.name}.`} onRetry={() => void loadBook()} />
      ) : !read ? (
        <p className={ck.loading}>Loading…</p>
      ) : (
        <Book read={read} rows={rows} showBalance={showBalance} onOpen={setOpen} onMore={showMore} loadingMore={loadingMore} />
      )}

      {open && read && (
        <LineWindow
          row={open} book={ref} q={q} categories={read.categories} accountingBase={base} payeesHref={payeesHref}
          canMove={canMove} onChanged={changed} onClose={() => setOpen(null)}
        />
      )}
      {win === 'add' && read && (
        <AddEntryWindow book={ref} q={q} categories={read.categories} payeesHref={payeesHref}
          onClose={() => setWin(null)} onAdded={text => { setWin(null); changed(text); }} />
      )}
      {win === 'ledger' && (
        <AddLedgerWindow
          q={q}
          tournaments={tournaments.filter(t => t.status !== 'archived' && !(books ?? []).some(b => b.ledger.entityId === t.id)).map(t => ({ id: t.id, name: t.name }))}
          onClose={() => setWin(null)}
          onCreated={id => { setWin(null); void loadBooks(); pickBook(id); }}
        />
      )}
      {win === 'transfer' && (
        <TransferWindow book={ref} books={allRefs} q={q}
          onClose={() => setWin(null)} onDone={text => { setWin(null); changed(text); }} />
      )}
    </>
  );
}

function rangeWords(range: { selection: DateRangeSelection; from: string; to: string }): string {
  if (range.selection === 'season') return 'All time';
  return range.from === range.to ? day(range.from) : `${day(range.from)} to ${day(range.to)}`;
}

/** The book: oldest first between the Starting and Ending balance lines; a card per entry on a phone. */
function Book({ read, rows, showBalance, onOpen, onMore, loadingMore }: {
  read: Read; rows: BookRowOut[]; showBalance: boolean; onOpen: (r: BookRowOut) => void;
  onMore: () => void; loadingMore: boolean;
}) {
  const from = read.window.from;
  const to = read.window.to;
  const startLabel = ledgerBalanceLabel('Starting balance', from);
  const endLabel = ledgerBalanceLabel('Ending balance', to);
  const cols = showBalance ? 7 : 6;
  if (rows.length === 0 && read.total === 0) {
    return (
      <>
        <div className={`${repKit.tableFrame}`}>
          <table className={`${repKit.table} ${moneyKit.register}`}>
            <tbody>
              {showBalance && <BalanceRow label={startLabel} figure={read.startingBalance} cols={cols} />}
              <tr className={moneyKit.moreRow}><td colSpan={cols}>Nothing on this book in this window.</td></tr>
              {showBalance && <BalanceRow label={endLabel} figure={read.endingBalance} cols={cols} end />}
            </tbody>
          </table>
        </div>
      </>
    );
  }
  return (
    <>
      {showBalance && <div className={ledgerKit.phoneBal}><span>{startLabel}</span><span>{money(read.startingBalance)}</span></div>}
      <div className={`${repKit.tableFrame} ${ledgerKit.cardsFrame}`}>
        <table className={`${repKit.table} ${moneyKit.register}`}>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">What</th>
              <th scope="col">Category</th>
              <th scope="col" className={repKit.num}>Money out</th>
              <th scope="col" className={repKit.num}>Money in</th>
              {showBalance && <th scope="col" className={repKit.num}>Balance</th>}
              <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
            </tr>
          </thead>
          <tbody>
            {showBalance && <BalanceRow label={startLabel} figure={read.startingBalance} cols={cols} />}
            {rows.map(r => <LineRow key={r.id} row={r} showBalance={showBalance} onOpen={onOpen} />)}
            {read.total > rows.length && (
              <tr className={`${moneyKit.moreRow} ${ledgerKit.deskRow}`}>
                <td colSpan={cols}>
                  Showing {rows.length} of {read.total} lines ·{' '}
                  <button type="button" className={repKit.inlineLink} onClick={onMore} disabled={loadingMore}>
                    {loadingMore ? 'Loading…' : 'Show more'}
                  </button>
                </td>
              </tr>
            )}
            {showBalance && <BalanceRow label={endLabel} figure={read.endingBalance} cols={cols} end />}
          </tbody>
        </table>
      </div>
      {read.total > rows.length && (
        <p className={`${repKit.notes} ${repKit.phoneOnly}`}>
          Showing {rows.length} of {read.total} lines ·{' '}
          <button type="button" className={repKit.inlineLink} onClick={onMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Show more'}</button>
        </p>
      )}
      {showBalance && <div className={`${ledgerKit.phoneBal} ${ledgerKit.phoneBalEnd}`}><span>{endLabel}</span><span>{money(read.endingBalance)}</span></div>}
      {/* ⚰ The note under the table ("Oldest at the top, as a bank statement reads…") is gone (D2): the
          dated balance lines say what it explained. */}
    </>
  );
}

function BalanceRow({ label, figure, cols, end = false }: { label: string; figure: number; cols: number; end?: boolean }) {
  return (
    <tr className={`${moneyKit.balRow} ${ledgerKit.deskRow}${end ? ` ${moneyKit.balEnd}` : ''}`}>
      <td colSpan={cols - 2} className={moneyKit.balLabel}>{label}</td>
      <td className={moneyKit.amt}>{money(figure)}</td>
      <td />
    </tr>
  );
}

/**
 * One line. The whole row opens its window; the name is the keyboard's door (standard §3.6) at BODY
 * weight — the shared kit's `ledgerKit.name`, the coach's look (owner 2026-10-02). A phone card sets it
 * bold again as the card's title.
 */
function LineRow({ row, showBalance, onOpen }: { row: BookRowOut; showBalance: boolean; onOpen: (r: BookRowOut) => void }) {
  const isVoid = row.status === 'void';
  const detail = isVoid
    ? [row.voided?.reason ? `“${row.voided.reason}”` : null, row.voided?.by].filter(Boolean).join(' · ')
    : row.detail;
  return (
    <tr
      className={`${repKit.rowOpens}${isVoid ? ` ${moneyKit.voidRow}` : ''}`}
      onClick={() => { if (window.getSelection()?.toString()) return; onOpen(row); }}
    >
      <td className={moneyKit.date} data-label="Date">{ledgerRowDate(row.date)}</td>
      <td className={ledgerKit.whatCell}>
        <button type="button" className={`${ledgerKit.name} ${moneyKit.lineName}`} onClick={e => { e.stopPropagation(); onOpen(row); }} aria-haspopup="dialog">
          {row.what}
        </button>
        {row.status === 'pending' && <span className={moneyKit.inlineChip}><RepChip>Pending</RepChip></span>}
        {isVoid && <span className={moneyKit.inlineChip}><RepChip>Void</RepChip></span>}
        {detail && <span className={ledgerKit.detail}><span className={ledgerKit.detailSep}> · </span>{detail}</span>}
      </td>
      <td className={moneyKit.cat} data-label="Category">{row.category ?? ''}</td>
      <td className={moneyKit.amt} data-label={row.moneyOut != null ? 'Money out' : undefined}>{money(row.moneyOut)}</td>
      <td className={`${moneyKit.amt}${row.moneyIn != null ? ` ${moneyKit.amtIn}` : ''}`} data-label={row.moneyIn != null ? 'Money in' : undefined}>{money(row.moneyIn)}</td>
      {showBalance && (
        <td className={`${moneyKit.amt}${row.status === 'pending' ? ` ${moneyKit.unmoved}` : ''}`} data-label={row.balance != null ? 'Balance' : undefined}
          title={row.status === 'pending' ? 'Not cleared yet — the balance is the one before it' : undefined}>
          {money(row.balance)}
        </td>
      )}
      <td className={`${repKit.go} ${ledgerKit.goCell}`}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
    </tr>
  );
}

type ExportRead = {
  columns: { key: string; label: string }[];
  rows: Record<string, string | number | null>[];
  totals: { moneyIn: number; moneyOut: number; net: number };
};

/** The rows, then the three totals the export carries (VOID and PENDING left out of them). */
function sheet(d: ExportRead): { headers: string[]; body: (string | number | null)[][] } {
  const headers = d.columns.map(c => c.label);
  const body = d.rows.map(row => d.columns.map(c => row[c.key] ?? ''));
  const total = (label: string, n: number) => d.columns.map(c => (c.key === 'what' ? label : c.key === 'amount' ? n : ''));
  return { headers, body: [...body, [], total('Total money in', d.totals.moneyIn), total('Total money out', -d.totals.moneyOut), total('Net', d.totals.net)] };
}

/**
 * The book's Export: the WHOLE period, signed (money out negative), every status, a void marked VOID
 * and left out of the totals — said on the menu before it runs (C14: today's wrote the loaded page).
 */
function BookExport({ q, book, window_, rangeWords: words, total, orgSlug }: {
  q: string; book: BookRef; window_: { from: string | null; to: string | null }; rangeWords: string; total: number;
  orgSlug: string;
}) {
  async function fetchRows() {
    const params = new URLSearchParams(q);
    params.set('export', '1');
    if (window_.from) params.set('from', window_.from);
    if (window_.to) params.set('to', window_.to);
    const r = await moneyFetch<ExportRead>(
      `/api/admin/accounting/ledgers/${book.id}/book?${params}`);
    if (!r.ok) throw new Error('export');
    return r.data;
  }
  const filename = (ext: 'xlsx' | 'csv') => buildFilename({ org: orgSlug, dataset: book.name, scope: words }, ext);
  return (
    <ExportMenu
      formats={['xlsx', 'csv']}
      label="Export"
      disabled={total === 0}
      holds={{
        title: `Export ${book.name} · ${words}`,
        lines: [
          `Every entry in the period, not just what is on screen · ${total} ${total === 1 ? 'entry' : 'entries'}`,
          'One Amount column, signed: money out is negative. A void line is kept, marked VOID, and left out of the totals.',
        ],
      }}
      onExportXLSX={async () => {
        const { headers, body } = sheet(await fetchRows());
        await downloadXLSX(filename('xlsx'), headers, body, 'Ledger');
      }}
      onExportCSV={async () => {
        const { headers, body } = sheet(await fetchRows());
        downloadCSVBlob(filename('csv'), generateCSV(headers, body));
      }}
    />
  );
}

