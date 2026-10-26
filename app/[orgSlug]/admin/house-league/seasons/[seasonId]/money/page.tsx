'use client';
/**
 * THE SEASON'S MONEY — its book (Club Tier Stage 9b-2 Part 4; owner Q15, Q16, Q17, Q18, 9b·10; drawing 9b-2 §4; words
 * HOUSE_LEAGUE_STAGE9B2_COPY.md §10).
 *
 *   the band — Owed · Received (net of refunds) · Still owing, the portal's one joined money band (MoneySummaryBand);
 *   the tabs — Every line (newest first: fees in, refunds out in red, voided lines struck through, and the history lines
 *     that move no money: a corrected price, a fee the club kept), Still owing (players, not lines: owing since · days,
 *     amber past the club's threshold), Refunds;
 *   the hint — where the fees file (Club plan: the Budget vs. Actual row) or that this page IS the book (League Plus).
 * Nobody types money here: it is written by Mark received, a refund on an ending, and Correct the price on Registrations.
 * Read by everyone who opens house league and by the club's Accounting (the treasurer, Q17) through the one gate's
 * `readMoney`; open after Complete (Q16). The figures are the server's (lib/league-money.ts `seasonMoney`), the same ones
 * the Overview's tiles show.
 */
import { useCallback, useState } from 'react';
import { useParams } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import ExportMenu from '@/components/admin/ExportMenu';
import MoneySummaryBand from '@/components/coaches/MoneySummaryBand';
import { EmptyCard, LoadFailed, PageLoading, repKit, useDeferredLoad } from '@/components/admin/kit/club/RepKit';
import { useHouseLeagueAccess } from '@/components/admin/kit/useHouseLeagueSeasons';
import s from '@/components/admin/kit/club/league/SeasonMoney.module.css';
import { formatLeagueMoney, type SeasonMoney } from '@/lib/league-money';
import { CARD_REFUND_WORDS, MONEY_PAGE_WORDS as W, REGS_WORDS, paymentMethodWord } from '@/lib/house-league-money-words';
import type { CardRefundState } from '@/lib/league-card-refunds';
import Link from 'next/link';
import PayoutsStatusLine from '@/components/admin/kit/club/PayoutsStatusLine';
import { formatStoredDate, orgDayKey } from '@/lib/timezone';
import { buildFilename, downloadCSVBlob, downloadXLSX, generateCSV } from '@/lib/export';

interface BookLine {
  id: string; regId: string; player: string | null; day: string; amount: number; method: string | null; receiptNo?: number | null;
  kind: 'fee' | 'refund' | 'voided' | 'processing'; refundWhy: string | null; priceKind: 'regular' | 'corrected' | null; note: string | null;
  /** 12c: a refund line that went to the card, and how it stands. */
  card?: { state: CardRefundState; bank: boolean; stripe: boolean } | null;
}
/** 12c: a card refund whose payment never went on a registration — in no book line, named under the Refunds list. */
interface NeverBooked { regId: string; player: string; amount: number; base: number; feeBack: number; day: string }
interface HistoryLine { kind: 'corrected' | 'kept'; regId: string; player: string | null; at: string; oldAmount: number | null; newAmount: number; reason: string }
interface OwingRow { regId: string; player: string; division: string | null; owing: number; acceptedDay: string | null; days: number | null; late: boolean }
interface MoneyRead {
  season: { id: string; name: string; status: string; owingAmberDays: number };
  free: boolean; filesToStatement: boolean; band: SeasonMoney;
  /** 12b: how much of Received came by card. */
  byCard?: number;
  lines: BookLine[]; history: HistoryLine[]; owing: OwingRow[]; today: string;
  neverBooked?: NeverBooked[];
}

type Tab = 'all' | 'owing' | 'refunds';
type Row = { key: string; day: string; player: string; what: string; how: string; amount: string; value: number | null; tone: 'in' | 'out' | 'voided' | 'history'; howWarn?: boolean };
const CM = CARD_REFUND_WORDS.money;
/** 12c words §3: the How of a refund line that went to the card. */
const cardHow = (c: NonNullable<BookLine['card']>) => (c.state === 'failed' ? CM.failed(c.bank)
  : c.state === 'anotherWay' ? CM.anotherWay : c.state === 'pending' ? CM.toTargetPending(c.bank) : CM.toTarget(c.bank));

export default function MoneyPage() {
  const { orgSlug, seasonId } = useParams<{ orgSlug: string; seasonId: string }>();
  const { currentOrg, user } = useOrg();
  const access = useHouseLeagueAccess();
  const canView = !!access?.readMoney;
  const [read, setRead] = useState<MoneyRead | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');

  const slug = currentOrg?.slug;
  const load = useCallback(async () => {
    if (!slug || !canView) return;
    try {
      const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/ledger?orgSlug=${encodeURIComponent(slug)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'load failed');
      setRead(data as MoneyRead);
      setFailed(false);
    } catch {
      // A failed read is said, never drawn as a calm $0 (the money kit's rule).
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [slug, seasonId, canView]);
  useDeferredLoad(!!currentOrg && canView, load);

  const header = (actions?: React.ReactNode) => (
    <AdminPageHeader
      eyebrow={read ? W.eyebrow(read.season.name) : 'House league'}
      title={W.title}
      backTo={read && access?.read ? { href: `/${orgSlug}/admin/house-league/seasons/${seasonId}`, label: read.season.name } : undefined}
      inlineActions
      actions={actions}
    />
  );

  if (!user) return null;
  if (access && !canView) return <div className={repKit.page}>{header()}<EmptyCard title={W.noAccess} /></div>;
  if (loading && !failed) return <PageLoading header={header()} label={W.loading} />;
  if (failed || !read) return <div className={repKit.page}>{header()}<LoadFailed title={W.failed} onRetry={() => { setLoading(true); void load(); }} /></div>;

  const { band } = read;
  const money = formatLeagueMoney;
  const day = (d: string) => formatStoredDate(d);
  const finished = read.season.status === 'completed' || read.season.status === 'archived';

  const lineRows: Row[] = [
    ...read.lines.map((l): Row => ({
      key: l.kind === 'processing' ? `cost:${l.id}` : l.id, day: l.day, player: l.player ?? '—',
      what: l.kind === 'voided' ? W.what.voided : l.kind === 'refund' ? W.what.refund(l.card?.stripe ? CM.madeInStripe : l.refundWhy)
        : l.kind === 'processing'
          ? ((l.note ?? '').startsWith('Processing fee refunded · ')
            ? W.what.processingBack((l.note ?? '').replace(/^Processing fee refunded · /, ''))
            : W.what.processing((l.note ?? '').replace(/^Payment processing · /, '')))
          : W.what.fee(l.priceKind),
      // 12b copy §5: a card payment's receipt after its method ("Online, card · receipt 1043").
      how: l.card ? cardHow(l.card)
        : l.receiptNo ? `${paymentMethodWord(l.method)} · ${REGS_WORDS.fee.receipt(l.receiptNo)}` : paymentMethodWord(l.method),
      amount: l.kind === 'refund' || l.kind === 'processing' ? money(-l.amount) : money(l.amount),
      // The export's number: a refund negative, a voided line counted nowhere (its What says so).
      value: l.kind === 'voided' ? null : l.kind === 'refund' || l.kind === 'processing' ? -l.amount : l.amount,
      // 12c: a refund the card sent back is amber text, no pill (a book line).
      howWarn: l.card?.state === 'failed',
      tone: l.kind === 'voided' ? 'voided' : l.kind === 'refund' || l.kind === 'processing' ? 'out' : 'in',
    })),
    ...read.history.map((h): Row => ({
      key: `${h.kind}-${h.regId}-${h.at}`, day: orgDayKey(h.at), player: h.player ?? '—',
      what: h.kind === 'corrected' ? W.what.corrected(money(h.oldAmount ?? 0), money(h.newAmount), h.reason) : W.what.kept(h.reason),
      how: '', amount: '—', value: null, tone: 'history',
    })),
  ].sort((a, b) => b.day.localeCompare(a.day));
  // A refund, never a card cost (a processing line is money out too, but not a refund — 12b /review).
  const refundRows = lineRows.filter(r => r.tone === 'out' && !r.key.startsWith('cost:'));
  const shown = tab === 'refunds' ? refundRows : lineRows;
  // On the Refunds tab every line is a refund, so the sign says nothing — show the plain amount (Every line keeps the minus).
  const amountOf = (r: Row) => (tab === 'refunds' && r.value != null ? money(Math.abs(r.value)) : r.amount);

  // The export is the tab you are on (copy §10), amounts as numbers so a treasurer can sum them.
  const headers = tab === 'owing'
    ? [W.col.player, W.col.division, W.col.since, W.col.owing]
    : [W.col.date, W.col.player, W.col.what, W.col.how, W.col.amount];
  const exportRows = (): (string | number | null)[][] => tab === 'owing'
    ? read.owing.map(o => [o.player, o.division ?? '', o.acceptedDay ? W.since(day(o.acceptedDay), o.days) : W.sinceUnknown, o.owing])
    : (tab === 'refunds' ? refundRows : lineRows).map(r => [r.day, r.player, r.what, r.how, r.value]);
  const file = (ext: 'xlsx' | 'csv') => buildFilename({ org: currentOrg?.slug, dataset: 'house-league-money', scope: read.season.name }, ext);
  const exportButton = !read.free && lineRows.length > 0 ? (
    <ExportMenu
      formats={['xlsx', 'csv']}
      onExportXLSX={() => downloadXLSX(file('xlsx'), headers, exportRows(), W.title)}
      onExportCSV={() => downloadCSVBlob(file('csv'), generateCSV(headers, exportRows()))}
    />
  ) : undefined;

  if (read.free) {
    return (
      <div className={repKit.page}>
        {header()}
        <EmptyCard title={W.empty.free.title}>{W.empty.free.body}</EmptyCard>
      </div>
    );
  }

  const toneClass = (t: Row['tone']) => (t === 'out' ? s.out : t === 'voided' ? s.voided : t === 'history' ? s.history : '');
  const counts: Record<Tab, number> = { all: lineRows.length, owing: read.owing.length, refunds: refundRows.length };
  const empty = W.empty[tab];

  return (
    <div className={repKit.page}>
      {header(exportButton)}
      {/* 12b: the owner's quiet "Let them pay online" while payouts aren't set up, and the treasurer's payouts status (A6, A1);
          nothing for anyone else, or while online payments aren't offered. */}
      {currentOrg && <PayoutsStatusLine orgSlug={currentOrg.slug} planId={currentOrg.planId} home="club" />}
      <MoneySummaryBand
        ariaLabel={W.band.aria(money(band.owed), money(band.received), money(band.owing))}
        tiles={[
          { key: 'owed', label: W.band.owed, figure: money(band.owed), caption: W.band.players(band.owedPlayers) },
          {
            key: 'received', label: W.band.received, figure: money(band.received),
            caption: [
              W.band.players(band.receivedPlayers),
              band.refunded > 0 ? W.band.afterRefunds(money(band.refunded)) : null,
              read.byCard ? W.band.byCard(money(read.byCard)) : null,
            ].filter(Boolean).join(' · '),
          },
          { key: 'owing', label: W.band.owing, figure: money(band.owing), tone: band.owing > 0 ? 'warn' : 'plain', caption: W.band.players(band.owingPlayers) },
        ]}
      />
      {finished && <p className={s.hint}>{W.finished}</p>}

      <div className={s.tabs} role="group" aria-label={W.title}>
        {(['all', 'owing', 'refunds'] as const).map(t => (
          <button key={t} type="button" className={s.tab} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {W.tabs[t]}<span className={s.count}>{counts[t]}</span>
          </button>
        ))}
      </div>

      {tab === 'owing' ? (
        read.owing.length === 0 ? <EmptyCard title={empty.title}>{empty.body}</EmptyCard> : (
          <>
            <div className={`${repKit.tableFrame} ${s.deskTable}`}>
              <table className={repKit.table}>
                <thead><tr><th>{W.col.player}</th><th>{W.col.division}</th><th>{W.col.since}</th><th className={repKit.num}>{W.col.owing}</th></tr></thead>
                <tbody>
                  {read.owing.map(o => (
                    <tr key={o.regId}>
                      <td>{o.player}</td>
                      <td>{o.division ?? '—'}</td>
                      <td>{o.acceptedDay ? W.since(day(o.acceptedDay), o.days) : W.sinceUnknown}</td>
                      <td className={`${repKit.num}${o.late ? ` ${s.late}` : ''}`}>{money(o.owing)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className={s.phoneList}>
              {read.owing.map(o => (
                <li key={o.regId} className={s.phoneRow}>
                  <span className={s.phoneMain}>
                    <span className={s.phoneName}>{o.player}</span>
                    <span className={s.sub}>{[o.division, o.acceptedDay ? W.since(day(o.acceptedDay), o.days) : W.sinceUnknown].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className={`${s.phoneAmount}${o.late ? ` ${s.late}` : ''}`}>{money(o.owing)}</span>
                </li>
              ))}
            </ul>
          </>
        )
      ) : shown.length === 0 ? <EmptyCard title={empty.title}>{empty.body}</EmptyCard> : (
        <>
          <div className={`${repKit.tableFrame} ${s.deskTable}`}>
            <table className={repKit.table}>
              <thead><tr><th>{W.col.date}</th><th>{W.col.player}</th><th>{W.col.what}</th><th>{W.col.how}</th><th className={repKit.num}>{W.col.amount}</th></tr></thead>
              <tbody>
                {shown.map(r => (
                  <tr key={r.key} className={r.tone === 'history' ? s.history : undefined}>
                    <td>{day(r.day)}</td>
                    <td>{r.player}</td>
                    <td>{r.what}</td>
                    <td className={r.howWarn ? s.late : undefined}>{r.how}</td>
                    <td className={`${repKit.num} ${toneClass(r.tone)}`}>{amountOf(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className={s.phoneList}>
            {shown.map(r => (
              <li key={r.key} className={s.phoneRow}>
                <span className={s.phoneMain}>
                  <span className={s.phoneName}>{r.player}</span>
                  <span className={s.sub}>{[day(r.day), r.what, r.how].filter(Boolean).join(' · ')}</span>
                </span>
                <span className={`${s.phoneAmount} ${toneClass(r.tone)}`}>{amountOf(r)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === 'refunds' && (read.neverBooked?.length ?? 0) > 0 && (
        <NeverBookedLine items={read.neverBooked!} href={id => `/${orgSlug}/admin/house-league/seasons/${seasonId}/registrations?reg=${id}&at=fee`} money={money} day={day} />
      )}

      <p className={s.hint}>{read.filesToStatement ? W.hintClub : W.hintLeague} {W.registrations}</p>
    </div>
  );
}

/** 12c words §3: one closing line under the Refunds list naming each card refund that never entered the book (at most three
 *  named, each opening that registration's record at its Fee section); a dashed row each on a phone. */
function NeverBookedLine({ items, href, money, day }: {
  items: readonly NeverBooked[]; href: (regId: string) => string; money: (n: number) => string; day: (d: string) => string;
}) {
  const named = items.slice(0, 3);
  const more = items.length - named.length;
  const fees = items.filter(i => i.feeBack > 0);
  const feeSentence = fees.length === 0 ? null : items.length === 1 ? CM.neverBookedFee(money(fees[0].feeBack)) : CM.neverBookedFeeMany;
  return (
    <>
      <p className={`${s.hint} ${s.deskTable}`}>
        {items.length === 1 ? CM.neverBookedOne : CM.neverBookedMany(items.length)}{' '}
        {named.map((i, n) => (
          <span key={i.regId}>
            {n > 0 && '; '}<Link href={href(i.regId)}>{i.player}</Link>{CM.neverBookedItem(money(i.amount), day(i.day))}
          </span>
        ))}
        {more > 0 ? <>{'; '}{CM.neverBookedMore(more)}</> : '.'}
        {feeSentence && <> {feeSentence}</>}
      </p>
      <div className={s.neverList}>
        <p className={s.neverHead}>{CM.phoneHead}</p>
        {items.map(i => (
          <Link key={i.regId} href={href(i.regId)} className={s.neverRow}>
            <span>{CM.phoneLine(i.player, money(i.amount), day(i.day))}</span>
            <span aria-hidden>›</span>
          </Link>
        ))}
      </div>
    </>
  );
}
