'use client';
/**
 * Accounting › OVERVIEW (Club Tier Stage 3a, specimen 1's "Overview tab" frame — Ask 2 option B).
 *
 *   the four figures  — Income · Expenses · Net position · Pending across every book for a period, AS
 *                       TODAY until 3b redraws this tab as the board summary (C04: they still add every
 *                       book together, the teams' included — 3b's arithmetic gate fixes that, not 3a).
 *   the club's books  — Club, Tournament and House league kinds (the badge knows four kinds, C14), each
 *                       with its ALL-TIME balance (one balance per book everywhere, C14); a book opens
 *                       the Ledger tab on it. Add ledger is the section's one create — a club book by
 *                       name, or a book for a tournament that has none yet (today's one-click "Open
 *                       ledger", folded in so it is not lost; not drawn — recorded at build).
 *   held by the teams — each team with what it owes the club and its next due (the club's own
 *                       records, Ask 5a; the team's cash is the coaches', D1). A team opens its account.
 *
 * ⚖ The tournament rail's Accounting door arrives with `?tournamentId=`: when that tournament has a book,
 * the page forwards to the Ledger tab on it (the old overview scrolled to its card).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Plus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { LEDGER_KIND_WORD } from '@/lib/club-ledger';
import { tournamentToday } from '@/lib/timezone';
import PageNotice, { useNotice } from '@/components/admin/kit/club/PageNotice';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import {
  ClubRow, ClubRowList, ClubSection, LoadFailed, RepChip, repKit, useDeferredLoad, useLatestRead, type ChipTone,
} from '@/components/admin/kit/club/RepKit';
import { CoachListToolbar } from '@/components/coaches/kit';
import { FigureCards, day, money, moneyFetch, moneyKit } from '@/components/admin/kit/club/money/MoneyKit';
import AddLedgerWindow from '@/components/admin/kit/club/money/AddLedgerWindow';
import type { LedgerSummary } from '@/lib/types';
import type { LedgerKind } from '@/lib/club-ledger';

type Summary = LedgerSummary;
interface TeamRow {
  teamId: string; teamName: string; isArchived: boolean; outstanding: number;
  nextDue: { dueDate: string; amount: number } | null;
  overdue: { count: number; amount: number }; sent: { count: number; amount: number }; requestsWaiting: number;
}

const KIND_TONE: Record<LedgerKind, ChipTone> = { org: 'good', tournament: 'neutral', league_season: 'neutral', team: 'info' };

function yearWindow(today: string) {
  const y = today.slice(0, 4);
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

export default function AccountingOverviewPage() {
  const { currentOrg, loading: orgLoading } = useOrg();
  const { tournaments } = useTournament();
  const router = useRouter();
  const search = useSearchParams();
  const slug = currentOrg?.slug ?? '';
  const q = `orgSlug=${encodeURIComponent(slug)}`;
  const base = `/${slug}/admin/accounting`;
  const runsRepTeams = !!currentOrg && hasModuleEntitlement(currentOrg, 'module_rep_teams');

  const [period, setPeriod] = useState(() => yearWindow(tournamentToday()));
  const [books, setBooks] = useState<Summary[] | null>(null);
  const [teams, setTeams] = useState<TeamRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useNotice();

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    if (!slug) return;
    const current = beginRead();
    setFailed(false);
    const [b, t] = await Promise.all([
      moneyFetch<{ ledgers?: Summary[] }>(`/api/admin/accounting/ledgers?${q}&from=${period.from}&to=${period.to}`),
      runsRepTeams ? moneyFetch<{ teams?: TeamRow[] }>(`/api/admin/accounting/teams?${q}`) : Promise.resolve(null),
    ]).catch(() => [null, null] as const);
    if (!current()) return;
    if (!b?.ok) { setFailed(true); return; }
    setBooks(b.data.ledgers ?? []);
    setTeams(t?.ok ? t.data.teams ?? [] : null);
  }, [slug, q, period.from, period.to, runsRepTeams, beginRead]);
  useDeferredLoad(!orgLoading && !!slug, load);

  // The tournament rail's door: straight to that tournament's book, when it has one.
  const forTournament = search.get('tournamentId');
  useEffect(() => {
    if (!forTournament || !books) return;
    const book = books.find(s => s.ledger.entityType === 'tournament' && s.ledger.entityId === forTournament);
    if (book) router.replace(`${base}/ledger?book=${book.ledger.id}`);
  }, [forTournament, books, router, base]);

  const clubBooks = useMemo(() => (books ?? []).filter(s => s.ledger.entityType !== 'team'), [books]);
  const totals = useMemo(() => {
    const all = books ?? [];
    return {
      income: all.reduce((s, l) => s + l.incomeOnly, 0),
      expenses: all.reduce((s, l) => s + l.expensesOnly, 0),
      net: all.reduce((s, l) => s + l.netPosted, 0),
      pendingIn: all.reduce((s, l) => s + l.pendingIncome, 0),
      pendingOut: all.reduce((s, l) => s + l.pendingExpenses, 0),
    };
  }, [books]);
  const bookIds = new Set(clubBooks.map(s => s.ledger.entityId).filter(Boolean));
  const tournamentsWithoutBook = tournaments.filter(t => t.status !== 'archived' && !bookIds.has(t.id));
  const shownTeams = (teams ?? []).filter(t => !t.isArchived || t.outstanding > 0)
    .sort((a, b) => a.teamName.localeCompare(b.teamName, undefined, { numeric: true }));

  if (failed) return <LoadFailed title="We couldn’t load the club’s books." onRetry={() => void load()} />;
  if (!books) return <p className={ck.loading}>Loading…</p>;

  const bookHref = (id: string) => `${base}/ledger?book=${id}`;
  const teamHref = (id: string) => `${base}/teams/${id}`;
  const pending = totals.pendingIn > 0 || totals.pendingOut > 0
    ? [totals.pendingIn > 0 ? `+${money(totals.pendingIn)}` : null, totals.pendingOut > 0 ? `−${money(totals.pendingOut)}` : null].filter(Boolean).join(' / ')
    : money(0);

  return (
    <>
      {notice && <PageNotice notice={notice} />}

      {/* The four figures, as today (C04 — 3b's). The period is today's From / To. */}
      {/* The period: From and To as ONE compact pair pinned right — the dates at their own width
          at a desk, two halves of one row on a phone (/design 2026-10-01: loose in the row, each date took
          the field's full width and the two stacked). */}
      <CoachListToolbar lede="Across every book, for the period">
        <div className={moneyKit.period}>
          <label className={moneyKit.periodField} htmlFor="acct-from">
            <span className={ck.label}>From</span>
            <input id="acct-from" type="date" className={`${ck.input} ${moneyKit.periodInput}`} value={period.from} max={period.to}
              onChange={e => e.target.value && setPeriod(p => ({ ...p, from: e.target.value }))} />
          </label>
          <label className={moneyKit.periodField} htmlFor="acct-to">
            <span className={ck.label}>To</span>
            <input id="acct-to" type="date" className={`${ck.input} ${moneyKit.periodInput}`} value={period.to} min={period.from}
              onChange={e => e.target.value && setPeriod(p => ({ ...p, to: e.target.value }))} />
          </label>
        </div>
      </CoachListToolbar>
      <FigureCards items={[
        { label: 'Income', value: money(totals.income) },
        { label: 'Expenses', value: money(totals.expenses) },
        { label: 'Net position', value: money(totals.net) },
        { label: 'Pending', value: pending },
      ]} />

      <ClubSection
        id="books"
        title="The club’s books"
        meta={`${clubBooks.length} ${clubBooks.length === 1 ? 'ledger' : 'ledgers'}`}
        actions={<button type="button" className="btn btn-outline" onClick={() => setAdding(true)}><Plus size={14} aria-hidden /> Add ledger</button>}
        list
      >
        <BooksTable rows={clubBooks} hrefOf={bookHref} />
        <div className={repKit.phoneOnly}>
          <ClubRowList inset label="The club’s books">
            {clubBooks.map(s => (
              <ClubRow key={s.ledger.id} as="link" href={bookHref(s.ledger.id)} title={s.ledger.name}
                caption={`${LEDGER_KIND_WORD[s.ledger.entityType as LedgerKind] ?? 'Club'} · ${money(s.balance)}`} chevron />
            ))}
          </ClubRowList>
        </div>
      </ClubSection>

      {runsRepTeams && teams && (
        <ClubSection id="teams" title="Held by the teams" meta={`${shownTeams.length} ${shownTeams.length === 1 ? 'team' : 'teams'}`} list>
          <p className={`${repKit.notes} ${repKit.sectionBody}`}>Each team’s money is its coaches’. What the club reads here is what the team owes the club.</p>
          {shownTeams.length === 0 ? (
            <p className={`${repKit.notes} ${repKit.sectionBody}`}>No team has been billed yet.</p>
          ) : (
            <>
              <TeamsTable rows={shownTeams} hrefOf={teamHref} />
              <div className={repKit.phoneOnly}>
                <ClubRowList inset label="Held by the teams">
                  {shownTeams.map(t => (
                    <ClubRow key={t.teamId} as="link" href={teamHref(t.teamId)}
                      title={<>{t.teamName} {t.overdue.count > 0 && <RepChip tone="bad">{money(t.overdue.amount)} overdue</RepChip>}</>}
                      caption={`${money(t.outstanding)} outstanding${t.nextDue ? ` · next ${day(t.nextDue.dueDate)}` : ''}`} chevron />
                  ))}
                </ClubRowList>
              </div>
            </>
          )}
        </ClubSection>
      )}
      <p className={repKit.notes}>
        A book opens the Ledger tab on that book{runsRepTeams ? '; a team opens its account with the club' : ''}.
      </p>

      {adding && currentOrg && (
        <AddLedgerWindow
          q={q}
          tournaments={tournamentsWithoutBook.map(t => ({ id: t.id, name: t.name }))}
          onClose={() => setAdding(false)}
          onCreated={id => { setAdding(false); router.push(bookHref(id)); }}
          onFailed={text => setNotice({ tone: 'bad', text })}
        />
      )}
    </>
  );
}

/** The club's books at a desk: Ledger · Kind · Balance · the chevron. The whole row opens the book. */
function BooksTable({ rows, hrefOf }: { rows: Summary[]; hrefOf: (id: string) => string }) {
  const router = useRouter();
  return (
    <div className={repKit.deskOnly}>
      <table className={repKit.table}>
        <thead>
          <tr>
            <th scope="col">Ledger</th>
            <th scope="col">Kind</th>
            <th scope="col" className={repKit.num}>Balance</th>
            <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(s => {
            const href = hrefOf(s.ledger.id);
            const kind = s.ledger.entityType as LedgerKind;
            return (
              <tr key={s.ledger.id} className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; router.push(href); }}>
                <td><Link href={href} className={repKit.nameLink} onClick={e => e.stopPropagation()}>{s.ledger.name}</Link></td>
                <td><RepChip tone={KIND_TONE[kind] ?? 'neutral'}>{LEDGER_KIND_WORD[kind] ?? 'Club'}</RepChip></td>
                <td className={repKit.num}>{money(s.balance)}</td>
                <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Held by the teams at a desk: Team · Kind · Outstanding · Next due · the chevron. */
function TeamsTable({ rows, hrefOf }: { rows: TeamRow[]; hrefOf: (id: string) => string }) {
  const router = useRouter();
  return (
    <div className={repKit.deskOnly}>
      <table className={repKit.table}>
        <thead>
          <tr>
            <th scope="col">Team</th>
            <th scope="col">Kind</th>
            <th scope="col" className={repKit.num}>Outstanding</th>
            <th scope="col">Next due</th>
            <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(t => {
            const href = hrefOf(t.teamId);
            return (
              <tr key={t.teamId} className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; router.push(href); }}>
                <td><Link href={href} className={repKit.nameLink} onClick={e => e.stopPropagation()}>{t.teamName}</Link></td>
                <td><RepChip tone="info">Team</RepChip></td>
                <td className={repKit.num}>{money(t.outstanding)}</td>
                <td>
                  {t.overdue.count > 0 ? <RepChip tone="bad">{money(t.overdue.amount)} overdue</RepChip>
                    : t.nextDue ? <span className={repKit.dim}>{day(t.nextDue.dueDate)} · {money(t.nextDue.amount)}</span>
                    : <span className={repKit.dim}>—</span>}
                </td>
                <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
