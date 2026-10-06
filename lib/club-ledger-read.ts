import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getClubOwnedLedgers, getLedgerById, resolvePersonNamer } from './db';
import { fetchAll, fetchAllIn } from './supabase-paging';
import { bookInScope } from './club-team-route';
import { bookWindow, isMoneyIn, type BookLineFacts } from './club-money-figures';
import { howItCame, installmentLineWords, requestLineWords } from './club-money-words';
import {
  NOT_FILED_ID, SOURCE_MODULE, fileLine, findLoopRecord, isSourcedLine, isTransfer, ledgerCategory, ledgerOptionCounts,
  lineType, type ExportableLine, type Filing, type FilingFacts, type LedgerKind, type LineStatus, type LineType,
} from './club-ledger';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ONE CLUB BOOK, READ WHOLE (Club Tier Stage 3a, C14 and Ask 6 — the Ledger tab's read).
 *
 *   · every row walked for the balances (no 1,000-row cap — C14), oldest first;
 *   · a date window, with a Starting balance (everything before it) so the running balance is true
 *     from the first row, and an Ending balance;
 *   · the Balance ALL-TIME — one scope, so the Overview and the Ledger never print two balances;
 *   · Status (posted · pending · void) and Type, each choice counted as what ticking it would list
 *     (`ledgerOptionCounts`), beside the window's census the export reads;
 *   · Type and Category filters (the club's own categories, never the teams');
 *   · each line on the PAGE worded from its source where it has one, who recorded it, and what may be
 *     done with it on the ledger (the line window's door).
 *
 * The balances need every line; the words need only the page. So the walk is whole, the narrowing
 * reads only each line's own columns, and the lookups behind the words (sources, partners, payees,
 * names) run for the page alone, together.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export type { LineStatus };

interface BookLine extends BookLineFacts, FilingFacts {
  description: string;
  sourceModule: string | null;
  sourceEntityId: string | null;
  linkedEntryId: string | null;
  paymentMethod: string | null;
  payeeId: string | null;
  payeePayer: string | null;
  notes: string | null;
  createdBy: string | null;
  voidReason: string | null;
  voidedBy: string | null;
  voidedAt: string | null;
}

export interface BookRowOut {
  id: string;
  date: string;
  what: string;
  detail: string | null;
  /** The category the line is FILED under (Club Tier Stage 3b, C14 — `filedCategory`): its budget word's
   *  category, the loop's own ("From the teams", "Team support"), "Not filed", or none (a transfer). */
  category: string | null;
  /** The whole word, for the line window's "Filed under" (Ask 4a): a typed line's word, or the word a loop
   *  line files itself under (`byItsSource`, read-only). Null on a transfer and on a line not filed yet. */
  filedUnder: Filing | null;
  /** The free-text category a line typed before 3b carries — kept, shown as history, never a filing. */
  legacyCategory: string | null;
  type: LineType;
  moneyOut: number | null;
  moneyIn: number | null;
  /** Posted balance after the line; a pending line shows the balance before it; a void line none. */
  balance: number | null;
  status: LineStatus;
  /** Where the line came from, for its window's one door. */
  source:
    | { kind: 'allocation'; allocationId: string | null; splitId: string | null; installmentId: string | null; teamId: string | null }
    | { kind: 'request'; requestId: string | null; teamId: string | null }
    | { kind: 'league_fee'; registrationId: string | null }
    | { kind: 'transfer'; partnerLedgerId: string | null; partnerLedgerName: string | null }
    | { kind: 'hand' };
  /** What the ledger lets you do with it: edit + void a hand line, void both halves of a club
   *  transfer, nothing for a line from a source or on a team's book. */
  can: { edit: boolean; void: 'line' | 'both_halves' | null };
  recordedBy: string | null;
  recordedAt: string;
  voided: null | { reason: string | null; by: string | null; at: string | null };
  description: string;
  notes: string | null;
  paymentMethod: string | null;
  payeeId: string | null;
  payeeName: string | null;
}

export interface BookRead {
  ledger: { id: string; name: string; kind: LedgerKind; entityId: string | null };
  balance: number;
  startingBalance: number;
  endingBalance: number;
  window: { from: string | null; to: string | null };
  /** The WINDOW's census, before any filter: the export menu's "every entry in the period" and which Types are
   *  offered at all. Never the numbers beside the choices — those are `optionCounts`. */
  counts: { status: Record<LineStatus, number>; type: Partial<Record<LineType, number>> };
  /** What ticking each Status / Type choice would list, given the other filters (`ledgerOptionCounts`). */
  optionCounts: { status: Partial<Record<LineStatus, number>>; type: Partial<Record<LineType, number>> };
  categories: string[];
  total: number;
  offset: number;
  limit: number;
  rows: BookRowOut[];
}

/** The columns a line's FILING reads — its word, its source, and a transfer's other half's book kind. */
const FILING_SELECT = 'entry_type, category, source_module, budget_category_id, budget_item_id, budget_categories ( name ), budget_items ( name ), partner:linked_entry_id ( accounting_ledgers ( entity_type ) )';

function filingFacts(r: Record<string, any>): FilingFacts {
  return {
    entryType: r.entry_type, category: r.category ?? null, sourceModule: r.source_module ?? null,
    budgetCategoryId: r.budget_category_id ?? null, budgetCategoryName: r.budget_categories?.name ?? null,
    budgetItemId: r.budget_item_id ?? null, budgetItemName: r.budget_items?.name ?? null,
    partnerKind: r.partner?.accounting_ledgers?.entity_type ?? null,
  };
}

function mapLine(r: Record<string, any>): BookLine {
  return {
    ...filingFacts(r),
    id: r.id, entryDate: r.entry_date, createdAt: r.created_at, amount: Number(r.amount),
    status: r.status, description: r.description,
    sourceEntityId: r.source_entity_id ?? null,
    linkedEntryId: r.linked_entry_id ?? null, paymentMethod: r.payment_method ?? null,
    payeeId: r.payee_id ?? null, payeePayer: r.payee_payer ?? null, notes: r.notes ?? null,
    createdBy: r.created_by ?? null, voidReason: r.void_reason ?? null, voidedBy: r.voided_by ?? null,
    voidedAt: r.voided_at ?? null,
  };
}

/**
 * The Category filter's list (Club Tier Stage 3b, C14): the categories the club's lines are FILED under —
 * the budget's categories (the club's own and the product's), the loop's own, and "Not filed" — across
 * its non-team books, never a team's words. Every row, not the first 1,000.
 */
export async function clubCategories(orgId: string): Promise<string[]> {
  const ledgers = await getClubOwnedLedgers(orgId);
  const kindOf = new Map(ledgers.map(l => [l.id, l.entityType as LedgerKind] as const));
  const rows = await fetchAllIn<Record<string, any>>(ledgers.map(l => l.id), (c, a, b) =>
    supabaseAdmin.from('accounting_entries').select(`ledger_id, ${FILING_SELECT}`)
      .in('ledger_id', c).order('id').range(a, b));
  const words = new Set<string>();
  for (const r of rows) {
    // The same rule the column reads (`ledgerCategory`), so every category a row shows can be filtered on.
    const w = ledgerCategory(filingFacts(r), kindOf.get(r.ledger_id)!);
    if (w) words.add(w);
  }
  return [...words].sort((x, y) => x.localeCompare(y));
}

const INST_SELECT = 'id, split_id, installment_number, accounting_entry_id, paid_method, paid_reference, rep_allocation_splits ( id, team_id, allocation_id, rep_cost_allocations ( description ) )';
const REQ_SELECT = 'id, team_id, description, accounting_entry_id';

/** Everything the page's words need, read together for the page's lines only. */
async function lookupsFor(orgId: string, page: readonly BookLine[]) {
  const linkIds = [...new Set(page.flatMap(l => [l.id, l.linkedEntryId]).filter((v): v is string => !!v))];
  const partnerIds = [...new Set(page.map(l => l.linkedEntryId).filter((v): v is string => !!v))];
  const sourced = (module: string) => page.filter(l => l.sourceModule === module && l.sourceEntityId).map(l => l.sourceEntityId!);

  const [partners, instByLink, reqByLink, instById, reqById, payees, teams, nameOf] = await Promise.all([
    fetchAllIn<{ id: string; ledger_id: string }>(partnerIds, (c, a, b) =>
      supabaseAdmin.from('accounting_entries').select('id, ledger_id').in('id', c).order('id').range(a, b)),
    fetchAllIn<Record<string, any>>(linkIds, (c, a, b) =>
      supabaseAdmin.from('rep_allocation_installments').select(INST_SELECT).eq('org_id', orgId).in('accounting_entry_id', c).order('id').range(a, b)),
    fetchAllIn<Record<string, any>>(linkIds, (c, a, b) =>
      supabaseAdmin.from('rep_team_payment_requests').select(REQ_SELECT).eq('org_id', orgId).in('accounting_entry_id', c).order('id').range(a, b)),
    fetchAllIn<Record<string, any>>(sourced(SOURCE_MODULE.installment), (c, a, b) =>
      supabaseAdmin.from('rep_allocation_installments').select(INST_SELECT).eq('org_id', orgId).in('id', c).order('id').range(a, b)),
    fetchAllIn<Record<string, any>>(sourced(SOURCE_MODULE.request), (c, a, b) =>
      supabaseAdmin.from('rep_team_payment_requests').select(REQ_SELECT).eq('org_id', orgId).in('id', c).order('id').range(a, b)),
    fetchAllIn<{ id: string; name: string }>(page.map(l => l.payeeId).filter((v): v is string => !!v), (c, a, b) =>
      supabaseAdmin.from('org_payees').select('id, name').eq('org_id', orgId).in('id', c).order('id').range(a, b)),
    fetchAll<{ id: string; name: string }>((a, b) =>
      supabaseAdmin.from('rep_teams').select('id, name').eq('org_id', orgId).order('id').range(a, b)),
    resolvePersonNamer(orgId, page.flatMap(l => [l.createdBy, l.voidedBy])),
  ]);

  const insts = [...instByLink, ...instById];
  const splitIds = [...new Set(insts.map(i => i.split_id as string))];
  const [ledgers, splitInstallments] = await Promise.all([
    fetchAllIn<{ id: string; name: string; entity_type: string; entity_id: string | null }>([...new Set(partners.map(p => p.ledger_id))], (c, a, b) =>
      supabaseAdmin.from('accounting_ledgers').select('id, name, entity_type, entity_id').eq('org_id', orgId).in('id', c).order('id').range(a, b)),
    fetchAllIn<{ split_id: string }>(splitIds, (c, a, b) =>
      supabaseAdmin.from('rep_allocation_installments').select('split_id').in('split_id', c).order('id').range(a, b)),
  ]);

  const countBySplit = new Map<string, number>();
  for (const r of splitInstallments) countBySplit.set(r.split_id, (countBySplit.get(r.split_id) ?? 0) + 1);
  const partnerLedger = new Map(partners.map(p => [p.id, p.ledger_id]));
  const ledgerById = new Map(ledgers.map(l => [l.id, l]));
  const instByEntry = new Map(instByLink.map(i => [i.accounting_entry_id as string, i] as const));
  const reqByEntry = new Map(reqByLink.map(r => [r.accounting_entry_id as string, r] as const));
  const instByIdMap = new Map(insts.map(i => [i.id as string, i] as const));
  const reqByIdMap = new Map([...reqByLink, ...reqById].map(r => [r.id as string, r] as const));

  return {
    teamName: new Map(teams.map(t => [t.id, t.name])),
    payeeName: new Map(payees.map(p => [p.id, p.name])),
    nameOf,
    countBySplit,
    partnerOf: (l: BookLine) => {
      const id = l.linkedEntryId ? partnerLedger.get(l.linkedEntryId) ?? null : null;
      return id ? ledgerById.get(id) ?? null : null;
    },
    /** The installment / request a line belongs to (`findLoopRecord`: by its source, else either half's link — pre-3a). */
    installmentOf: (l: BookLine) => findLoopRecord(l, SOURCE_MODULE.installment, instByIdMap, instByEntry) ?? null,
    requestOf: (l: BookLine) => findLoopRecord(l, SOURCE_MODULE.request, reqByIdMap, reqByEntry) ?? null,
  };
}

type Lookups = Awaited<ReturnType<typeof lookupsFor>>;

/** One line, worded, with what may be done with it. */
function shapeLine(
  l: BookLine,
  balance: number | null,
  book: { kind: LedgerKind; entityId: string | null; orgName: string },
  x: Lookups,
): BookRowOut {
  const type = lineType(l);
  const partner = x.partnerOf(l);
  const partnerTeam = partner?.entity_type === 'team' && partner.entity_id ? x.teamName.get(partner.entity_id) ?? null : null;
  const ownTeam = book.kind === 'team' && book.entityId ? x.teamName.get(book.entityId) ?? null : null;
  const inst = x.installmentOf(l);
  const req = x.requestOf(l);
  const moneyIn = isMoneyIn(l);
  const payeeName = l.payeeId ? x.payeeName.get(l.payeeId) ?? null : l.payeePayer;

  let what = l.description;
  let detail: string | null = null;
  let source: BookRowOut['source'] = { kind: 'hand' };
  if (type === 'team_allocations') {
    const split = inst?.rep_allocation_splits;
    const team = (split?.team_id ? x.teamName.get(split.team_id) : null) ?? partnerTeam ?? ownTeam;
    if (inst && team) {
      const words = installmentLineWords({
        teamName: team, orgName: book.orgName, allocation: split?.rep_cost_allocations?.description ?? 'Club allocation',
        number: inst.installment_number, of: x.countBySplit.get(inst.split_id) ?? 1,
      });
      what = book.kind === 'team' ? words.team : words.club;
    } else if (team && book.kind !== 'team') {
      what = `Allocation received · ${team}`;
    }
    detail = howItCame(inst?.paid_method ?? null, inst?.paid_reference ?? null) ?? l.paymentMethod;
    source = { kind: 'allocation', allocationId: split?.allocation_id ?? null, splitId: inst?.split_id ?? null, installmentId: inst?.id ?? null, teamId: split?.team_id ?? null };
  } else if (type === 'team_support') {
    const team = (req?.team_id ? x.teamName.get(req.team_id) : null) ?? partnerTeam;
    if (team && book.kind !== 'team') {
      what = requestLineWords({
        teamName: team, orgName: book.orgName, description: req?.description ?? l.description,
        requestType: moneyIn ? 'payment_to_org' : 'charge_to_org',
      }).club;
    }
    detail = [l.paymentMethod, 'request'].filter(Boolean).join(' · ');
    source = { kind: 'request', requestId: req?.id ?? null, teamId: req?.team_id ?? null };
  } else if (type === 'house_league_fees') {
    source = { kind: 'league_fee', registrationId: l.sourceEntityId };
  } else if (type === 'transfer') {
    const other = partner?.name ?? 'another book';
    what = moneyIn ? `From ${other}` : `To ${other}`;
    detail = [l.description, 'transfer'].filter(Boolean).join(' · ');
    source = { kind: 'transfer', partnerLedgerId: partner?.id ?? null, partnerLedgerName: partner?.name ?? null };
  } else {
    detail = [payeeName, l.paymentMethod].filter(Boolean).join(' · ') || null;
  }

  /* ⚖ WHAT THE LINE IS FILED UNDER (Ask 4a) — the one rule, `fileLine`: its own word, or for a loop line the
     word it files itself under by its source, read-only. A team's book is the coaches' (D1): nothing on it
     is the club's to file. "Not filed" is a null here (the window offers the picker). */
  const split = inst?.rep_allocation_splits;
  const filing = book.kind === 'team' ? null
    : fileLine(l, () => split?.allocation_id ? { id: split.allocation_id, description: split.rep_cost_allocations?.description ?? 'Club allocation' } : null);
  const filedUnder = filing && filing.categoryId !== NOT_FILED_ID ? filing : null;

  const fixed = book.kind === 'team' || l.status === 'void' || isSourcedLine(l, !!inst || !!req);
  const can: BookRowOut['can'] = fixed
    ? { edit: false, void: null }
    : isTransfer(l)
      ? { edit: false, void: partner?.entity_type !== 'team' ? 'both_halves' : null }
      : { edit: true, void: 'line' };

  return {
    id: l.id, date: l.entryDate, what, detail, category: ledgerCategory(l, book.kind), filedUnder,
    legacyCategory: filing?.categoryId === NOT_FILED_ID && !isTransfer(l) ? l.category : null,
    type,
    moneyOut: moneyIn ? null : l.amount, moneyIn: moneyIn ? l.amount : null,
    balance, status: l.status, source, can,
    recordedBy: x.nameOf(l.createdBy), recordedAt: l.createdAt,
    voided: l.status === 'void' ? { reason: l.voidReason, by: x.nameOf(l.voidedBy), at: l.voidedAt } : null,
    description: l.description, notes: l.notes, paymentMethod: l.paymentMethod, payeeId: l.payeeId, payeeName,
  };
}

export async function readBook(
  orgId: string,
  orgName: string,
  ledgerId: string,
  opts: {
    from?: string | null; to?: string | null;
    status?: LineStatus[] | null; types?: LineType[] | null; categories?: string[] | null;
    offset?: number; limit?: number;
    /** Every narrowed row, unpaged — the export's read (never "the loaded page", C14). */
    all?: boolean;
    /** The reader's teams (`teamIdsInScope`): a team book outside them reads as not found (B11). */
    scope?: Set<string> | null;
  } = {},
): Promise<BookRead | null> {
  const ledger = await getLedgerById(ledgerId, orgId);
  if (!ledger || !bookInScope(ledger, opts.scope ?? null)) return null;
  const kind = ledger.entityType as LedgerKind;

  const [all, categories] = await Promise.all([
    fetchAll<Record<string, any>>((a, b) =>
      supabaseAdmin.from('accounting_entries').select(`*, ${FILING_SELECT}`).eq('ledger_id', ledgerId)
        .order('entry_date').order('created_at').order('id').range(a, b)).then(rows => rows.map(mapLine)),
    // The filter's list: the club's own words. Not for the export or for a team's (read-only) book.
    opts.all || kind === 'team' ? Promise.resolve([] as string[]) : clubCategories(orgId),
  ]);

  const win = bookWindow(all, { from: opts.from ?? null, to: opts.to ?? null });
  const typed = win.rows.map(r => ({ ...r, status: r.line.status, type: lineType(r.line), category: ledgerCategory(r.line, kind) }));
  const typeCounts: Partial<Record<LineType, number>> = {};
  for (const r of typed) typeCounts[r.type] = (typeCounts[r.type] ?? 0) + 1;

  /* An absent status is the book's resting pair — a contract for any caller that does not say. The Ledger page
     always says (its "All" sends all three, Filter Counts D5), so this default is not the page's "All". */
  const status = new Set<LineStatus>(opts.status?.length ? opts.status : ['posted', 'pending']);
  const types = opts.types?.length ? new Set(opts.types) : null;
  const cats = opts.categories?.length ? new Set(opts.categories) : null;
  const narrowed = typed.filter(r => status.has(r.status)
    && (!types || types.has(r.type))
    && (!cats || (r.category !== null && cats.has(r.category))));

  const limit = opts.all ? narrowed.length : Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const offset = opts.all ? 0 : Math.max(opts.offset ?? 0, 0);
  const page = narrowed.slice(offset, offset + limit);
  const lookups = await lookupsFor(orgId, page.map(r => r.line));
  const book = { kind, entityId: ledger.entityId, orgName };

  return {
    ledger: { id: ledger.id, name: ledger.name, kind, entityId: ledger.entityId },
    balance: win.balance,
    startingBalance: win.startingBalance,
    endingBalance: win.endingBalance,
    window: { from: opts.from ?? null, to: opts.to ?? null },
    counts: { status: win.counts, type: typeCounts },
    optionCounts: ledgerOptionCounts(typed, { status, types, categories: cats }),
    categories,
    total: narrowed.length,
    offset,
    limit,
    rows: page.map(r => shapeLine(r.line, r.balance, book, lookups)),
  };
}

/** Every line in the window, for the export (all statuses, all types): the whole period, not a page. */
export async function readBookForExport(
  orgId: string, orgName: string, ledgerId: string,
  window: { from?: string | null; to?: string | null; scope?: Set<string> | null },
): Promise<{ book: BookRead; lines: ExportableLine[] } | null> {
  const book = await readBook(orgId, orgName, ledgerId, { ...window, status: ['posted', 'pending', 'void'], all: true });
  if (!book) return null;
  const lines: ExportableLine[] = book.rows.map(r => ({
    date: r.date, what: r.what, detail: r.detail, category: r.category, type: r.type,
    moneyIn: r.moneyIn, moneyOut: r.moneyOut, status: r.status, recordedBy: r.recordedBy, voidReason: r.voided?.reason ?? null,
  }));
  return { book, lines };
}
