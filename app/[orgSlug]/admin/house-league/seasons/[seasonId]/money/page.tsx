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
import { DISPUTE_WORDS, disputeWhyShort, reasonShort } from '@/lib/online-payment-words';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import EmailFamiliesWindow from '@/components/admin/kit/club/families/EmailFamiliesWindow';
import { useOrg } from '@/lib/org-context';
import { TabActions } from '@/components/admin/kit/club/PlaceFrame';
import { usePublishSeasonName } from '@/components/admin/kit/club/SeasonFrame';
import ExportMenu from '@/components/admin/ExportMenu';
import MoneySummaryBand from '@/components/coaches/MoneySummaryBand';
import { EmptyCard, LoadFailed, NoticePill, PageLoading, repKit, useDeferredLoad } from '@/components/admin/kit/club/RepKit';
import { NotYours } from '@/components/admin/kit/club/NotYours';
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
  kind: 'fee' | 'refund' | 'voided' | 'processing' | 'returned'; returnReason?: string | null;
  /** 12d-1 Part 3: a returned line a lost card dispute wrote (`returnReason` is then the cardholder's reason). */
  disputeLost?: boolean; refundWhy: string | null; priceKind: 'regular' | 'corrected' | null; note: string | null;
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
  /** 12d-1 Part 3: open card disputes on the season's payments, and what Stripe holds for them (words §1.5). */
  disputed?: { n: number; held: number };
  /** 12c Part 6: what of Received came by bank debit (the band's note). */
  byBank?: number;
  lines: BookLine[]; history: HistoryLine[]; owing: OwingRow[]; today: string;
  neverBooked?: NeverBooked[];
}

type Tab = 'all' | 'owing' | 'refunds';
const TABS: readonly Tab[] = ['all', 'owing', 'refunds'];
const isTab = (v: string | null): v is Tab => !!v && (TABS as readonly string[]).includes(v);
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
  // ⚖ Each tab keeps its own address (`?tab=owing`, Club Tier Stage 13e, drawing tab 2 note 1) — the same `?tab=` Registrations'
  // views use, never a second mechanism — so This morning's Still owing tile, Back from a child, and Registrations' "Open
  // Still owing" all land on Still owing. Every line has no parameter (the page's own address).
  const router = useRouter();
  const search = useSearchParams();
  const asked = search.get('tab');
  const tab: Tab = isTab(asked) ? asked : 'all';
  const base = `/${orgSlug}/admin/house-league/seasons/${seasonId}`;
  const setTab = (t: Tab) => router.replace(t === 'all' ? `${base}/money` : `${base}/money?tab=${t}`, { scroll: false });
  // 13e-2: "Email these families" opens the season's own Email families window with Still owing's children ticked.
  const [emailing, setEmailing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
  // The bar names the season from this read too: someone who reads Money without House league (a treasurer) has no
  // season list to name it from.
  usePublishSeasonName(seasonId, read?.season.name ?? null);

  // ⚖ The season's frame names the page (Club Tier Stage 13i, A4); Money keeps its own actions, at its row's right end.
  const header = (actions?: React.ReactNode) => <TabActions>{actions}</TabActions>;

  if (!user) return null;
  if (access && !canView) return <NotYours page="seasonMoney" />;
  if (loading && !failed) return <PageLoading header={header()} label={W.loading} />;
  if (failed || !read) return <div className={repKit.page}>{header()}<LoadFailed title={W.failed} onRetry={() => { setLoading(true); void load(); }} /></div>;

  const { band } = read;
  const money = formatLeagueMoney;
  const day = (d: string) => formatStoredDate(d);
  const finished = read.season.status === 'completed' || read.season.status === 'archived';

  const lineRows: Row[] = [
    ...read.lines.map((l): Row => ({
      key: l.kind === 'processing' ? `cost:${l.id}` : l.kind === 'returned' ? `returned:${l.id}` : l.id, day: l.day, player: l.player ?? '—',
      what: l.kind === 'voided' ? W.what.voided
        : l.kind === 'returned' && l.disputeLost ? DISPUTE_WORDS.moneyLine(l.receiptNo != null ? String(l.receiptNo) : '', disputeWhyShort(l.returnReason ?? null))
        : l.kind === 'returned' ? W.what.returned(l.receiptNo != null ? String(l.receiptNo) : '', reasonShort(l.returnReason ?? null))
        : l.kind === 'refund' ? W.what.refund(l.card?.stripe ? CM.madeInStripe : l.refundWhy)
        : l.kind === 'processing'
          ? ((l.note ?? '').startsWith('Processing fee refunded · ')
            ? W.what.processingBack((l.note ?? '').replace(/^Processing fee refunded · /, ''))
            : W.what.processing((l.note ?? '').replace(/^Payment processing · /, '')))
          : W.what.fee(l.priceKind),
      // 12b copy §5: a card payment's receipt after its method ("Online, card · receipt 1043").
      how: l.kind === 'returned' && l.disputeLost ? DISPUTE_WORDS.moneyHow
        : l.card ? cardHow(l.card)
        : l.receiptNo ? `${paymentMethodWord(l.method)} · ${REGS_WORDS.fee.receipt(l.receiptNo)}` : paymentMethodWord(l.method),
      amount: l.kind === 'refund' || l.kind === 'processing' || l.kind === 'returned' ? money(-l.amount) : money(l.amount),
      // The export's number: a refund negative, a voided line counted nowhere (its What says so).
      value: l.kind === 'voided' ? null : l.kind === 'refund' || l.kind === 'processing' || l.kind === 'returned' ? -l.amount : l.amount,
      // 12c: a refund the card sent back is amber text, no pill (a book line).
      howWarn: l.card?.state === 'failed',
      tone: l.kind === 'voided' ? 'voided' : l.kind === 'refund' || l.kind === 'processing' || l.kind === 'returned' ? 'out' : 'in',
    })),
    ...read.history.map((h): Row => ({
      key: `${h.kind}-${h.regId}-${h.at}`, day: orgDayKey(h.at), player: h.player ?? '—',
      what: h.kind === 'corrected' ? W.what.corrected(money(h.oldAmount ?? 0), money(h.newAmount), h.reason) : W.what.kept(h.reason),
      how: '', amount: '—', value: null, tone: 'history',
    })),
  ].sort((a, b) => b.day.localeCompare(a.day));
  // A refund, never a card cost (a processing line is money out too, but not a refund — 12b /review).
  const refundRows = lineRows.filter(r => r.tone === 'out' && !r.key.startsWith('cost:') && !r.key.startsWith('returned:'));
  const shown = tab === 'refunds' ? refundRows : lineRows;
  // On the Refunds tab every line is a refund, so the sign says nothing — show the plain amount (Every line keeps the minus).
  const amountOf = (r: Row) => (tab === 'refunds' && r.value != null ? money(Math.abs(r.value)) : r.amount);

  // Still owing's "since" words, one spelling for the desk row, the phone row and the export.
  const sinceOf = (o: (typeof read.owing)[number]) => (o.acceptedDay ? W.since(day(o.acceptedDay), o.days) : W.sinceUnknown);
  // The export is the tab you are on (copy §10), amounts as numbers so a treasurer can sum them.
  const headers = tab === 'owing'
    ? [W.col.player, W.col.division, W.col.since, W.col.owing]
    : [W.col.date, W.col.player, W.col.what, W.col.how, W.col.amount];
  const exportRows = (): (string | number | null)[][] => tab === 'owing'
    ? read.owing.map(o => [o.player, o.division ?? '', sinceOf(o), o.owing])
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

  // ⚖ 13e (drawing tab 2 note 1): a row opens the child only for someone who can open Registrations. The treasurer reads
  // this page (13d's door) but not Registrations, so their rows stay plain and both buttons are absent — never a door to a
  // refused page. Emailing families is the desk's (the Email families window's own gate).
  const opensRegistrations = !!access?.read;
  const emailsFamilies = opensRegistrations && !!access?.email;
  const regsHref = `${base}/registrations`;
  const childHref = (regId: string) => `${regsHref}?reg=${regId}&at=fee`;
  const toneClass = (t: Row['tone']) => (t === 'out' ? s.out : t === 'voided' ? s.voided : t === 'history' ? s.history : '');
  const counts: Record<Tab, number> = { all: lineRows.length, owing: read.owing.length, refunds: refundRows.length };
  const empty = W.empty[tab];
  // 12c words §3.4: the band's note — what of Received came by card or bank debit, and what Clearing counts.
  const byCard = read.byCard ?? 0;
  const byBank = read.byBank ?? 0;
  const bandNote = [
    byCard && byBank ? W.band.noteBoth(money(byCard), money(byBank)) : byCard ? W.band.noteCard(money(byCard)) : byBank ? W.band.noteBank(money(byBank)) : null,
    band.clearing > 0 ? W.band.noteClearing : null,
    read.disputed?.n ? DISPUTE_WORDS.band(read.disputed.n, money(read.disputed.held)) : null,
  ].filter(Boolean).join(' ');

  return (
    <div className={repKit.page}>
      {header(exportButton)}
      {/* 12b: the owner's quiet "Let them pay online" while payouts aren't set up, and the treasurer's payouts status (A6, A1);
          nothing for anyone else, or while online payments aren't offered. */}
      {currentOrg && <PayoutsStatusLine orgSlug={currentOrg.slug} planId={currentOrg.planId} home="club" />}
      <MoneySummaryBand
        ariaLabel={W.band.aria(money(band.owed), money(band.received), money(band.owing), band.clearing > 0 ? money(band.clearing) : null)}
        tiles={[
          { key: 'owed', label: W.band.owed, figure: money(band.owed), caption: W.band.players(band.owedPlayers) },
          {
            key: 'received', label: W.band.received, figure: money(band.received),
            caption: [
              // 13e-8: the part-paid are counted here and said, never taken out (Registrations' Received counts paid in full).
              band.partPlayers > 0 ? `${W.band.players(band.receivedPlayers)} · ${W.band.inPart(band.partPlayers)}` : W.band.players(band.receivedPlayers),
              band.refunded > 0 ? W.band.afterRefunds(money(band.refunded)) : null,
            ].filter(Boolean).join(' · '),
          },
          // 12c Part 6: a fourth figure only while a bank debit is on its way, plain like every total (words §3.4).
          ...(band.clearing > 0 ? [{ key: 'clearing', label: W.band.clearing, figure: money(band.clearing), caption: W.band.clearingCaption(band.clearingPlayers) }] : []),
          { key: 'owing', label: W.band.owing, figure: money(band.owing), tone: band.owing > 0 ? 'warn' : 'plain', caption: W.band.players(band.owingPlayers) },
        ]}
      />
      {bandNote && <p className={s.hint}>{bandNote}</p>}
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
            {/* 13e-3 / 13e-2: the whole list, where the work is — Registrations with Fee: Owing on, and the season's own
                Email families window with these children ticked (no second sender; nothing goes until its Send). */}
            {opensRegistrations && (
              <div className={s.owingActions}>
                <Link href={`${regsHref}?tab=active&fee=owing`} className="btn btn-outline">{W.toRegistrations}</Link>
                {emailsFamilies && (
                  <button type="button" className="btn btn-outline" aria-label={W.emailThese} onClick={() => setEmailing(true)}>
                    <span className={s.wordLong}>{W.emailThese}</span><span className={s.wordShort}>{W.emailTheseShort}</span>
                  </button>
                )}
              </div>
            )}
            <div className={`${repKit.tableFrame} ${s.deskTable}`}>
              <table className={repKit.table}>
                <thead><tr>
                  <th>{W.col.player}</th><th>{W.col.division}</th><th>{W.col.since}</th><th className={repKit.num}>{W.col.owing}</th>
                  {opensRegistrations && <th className={repKit.go}><span className={repKit.srOnly}>{W.col.open}</span></th>}
                </tr></thead>
                <tbody>
                  {read.owing.map(o => (
                    // The tint is the promise: the row opens from anywhere (§3.6), the name is its keyboard target.
                    <tr key={o.regId} className={opensRegistrations ? repKit.rowOpens : undefined}
                      onClick={opensRegistrations ? () => { if (window.getSelection()?.toString()) return; router.push(childHref(o.regId)); } : undefined}>
                      <td>
                        {opensRegistrations
                          ? <Link href={childHref(o.regId)} className={repKit.nameLink} aria-label={W.openChild(o.player)} onClick={e => e.stopPropagation()}>{o.player}</Link>
                          : o.player}
                      </td>
                      <td>{o.division ?? '—'}</td>
                      <td>{sinceOf(o)}</td>
                      <td className={`${repKit.num}${o.late ? ` ${s.late}` : ''}`}>{money(o.owing)}</td>
                      {opensRegistrations && <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className={s.phoneList}>
              {read.owing.map(o => {
                const inner = (
                  <>
                    <span className={s.phoneMain}>
                      <span className={s.phoneName}>{o.player}</span>
                      <span className={s.sub}>{[o.division, sinceOf(o)].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className={`${s.phoneAmount}${o.late ? ` ${s.late}` : ''}`}>{money(o.owing)}</span>
                  </>
                );
                return (
                  <li key={o.regId} className={opensRegistrations ? s.phoneRowItem : s.phoneRow}>
                    {opensRegistrations ? (
                      // One 56 px target per child, with a chevron (drawing tab 2, the 390 note 1).
                      <Link href={childHref(o.regId)} className={s.phoneRowLink} aria-label={W.openChild(o.player)}>
                        {inner}<ChevronRight size={16} aria-hidden className={s.phoneChevron} />
                      </Link>
                    ) : inner}
                  </li>
                );
              })}
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
        // 13e: the names open the child only for someone who can open Registrations (the treasurer reads them plain).
        <NeverBookedLine items={read.neverBooked!} href={opensRegistrations ? childHref : null} money={money} day={day} />
      )}

      <p className={s.hint}>{read.filesToStatement ? W.hintClub : W.hintLeague} {W.registrations}</p>

      {emailing && emailsFamilies && (
        // The club's one email window, opened from this season exactly as Registrations' bulk bar opens it: Who is fixed
        // to the ticked children's families (two siblings are one family), and its own guards decide everything at Send.
        <EmailFamiliesWindow
          q={`orgSlug=${encodeURIComponent(orgSlug)}`}
          season={{
            id: seasonId, name: read.season.name, ticked: read.owing.map(o => o.regId),
            registrationsHref: regsHref, teamsHref: `${base}/teams`,
          }}
          onClose={() => setEmailing(false)}
          onShowNoFamily={() => setEmailing(false)}
          onSent={said => { setEmailing(false); setNotice(said); }}
        />
      )}
      {notice && <NoticePill key={notice} message={notice} onDone={() => setNotice(null)} />}
    </div>
  );
}

/** 12c words §3: one closing line under the Refunds list naming each card refund that never entered the book (at most three
 *  named, each opening that registration's record at its Fee section); a dashed row each on a phone. */
function NeverBookedLine({ items, href, money, day }: {
  items: readonly NeverBooked[]; href: ((regId: string) => string) | null; money: (n: number) => string; day: (d: string) => string;
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
            {n > 0 && '; '}{href ? <Link href={href(i.regId)}>{i.player}</Link> : i.player}{CM.neverBookedItem(money(i.amount), day(i.day))}
          </span>
        ))}
        {more > 0 ? <>{'; '}{CM.neverBookedMore(more)}</> : '.'}
        {feeSentence && <> {feeSentence}</>}
      </p>
      <div className={s.neverList}>
        <p className={s.neverHead}>{CM.phoneHead}</p>
        {items.map(i => (href ? (
          <Link key={i.regId} href={href(i.regId)} className={s.neverRow}>
            <span>{CM.phoneLine(i.player, money(i.amount), day(i.day))}</span>
            <span aria-hidden>›</span>
          </Link>
        ) : (
          <div key={i.regId} className={s.neverRow}><span>{CM.phoneLine(i.player, money(i.amount), day(i.day))}</span></div>
        )))}
      </div>
    </>
  );
}
