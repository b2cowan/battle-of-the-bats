import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getLedgerById, resolvePersonNamer } from './db';
import { fetchAll, fetchAllIn } from './supabase-paging';
import { bookInScope } from './club-team-route';
import { bookWindow, type BookLineFacts } from './club-money-figures';
import { howItCame, installmentLineWords, requestLineWords } from './club-money-words';
import {
  SOURCE_MODULE, isSourcedLine, isTransfer, ledgerOptionCounts, lineCategoryWord, lineType,
  type ExportableLine, type LedgerKind, type LineStatus, type LineType,
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

interface BookLine extends BookLineFacts {
  description: string;
  category: string | null;
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
  category: string | null;
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

function mapLine(r: Record<string, any>): BookLine {
  return {
    id: r.id, entryDate: r.entry_date, createdAt: r.created_at, amount: Number(r.amount),
    entryType: r.entry_type, status: r.status, description: r.description, category: r.category ?? null,
    sourceModule: r.source_module ?? null, sourceEntityId: r.source_entity_id ?? null,
    linkedEntryId: r.linked_entry_id ?? null, paymentMethod: r.payment_method ?? null,
    payeeId: r.payee_id ?? null, payeePayer: r.payee_payer ?? null, notes: r.notes ?? null,
    createdBy: r.created_by ?? null, voidReason: r.void_reason ?? null, voidedBy: r.voided_by ?? null,
    voidedAt: r.voided_at ?? null,
  };
}

/** The club's own categories, in words — across its non-team books, never the teams'. */
export async function clubCategories(orgId: string): Promise<string[]> {
  const { data: ledgers, error } = await supabaseAdmin
    .from('accounting_ledgers').select('id').eq('org_id', orgId).neq('entity_type', 'team');
  if (error) throw error;
  const rows = await fetchAllIn<{ category: string | null }>((ledgers ?? []).map((l: { id: string }) => l.id), (c, a, b) =>
    supabaseAdmin.from('accounting_entries').select('category').in('ledger_id', c).not('category', 'is', null).order('id').range(a, b));
  const words = new Set<string>();
  for (const r of rows) { const w = lineCategoryWord(r); if (w) words.add(w); }
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
  const instByEntry = new Map(instByLink.map(i => [i.accounting_entry_id as string, i]));
  const reqByEntry = new Map(reqByLink.map(r => [r.accounting_entry_id as string, r]));
  const instByIdMap = new Map(insts.map(i => [i.id as string, i]));
  const reqByIdMap = new Map([...reqByLink, ...reqById].map(r => [r.id as string, r]));

  return {
    teamName: new Map(teams.map(t => [t.id, t.name])),
    payeeName: new Map(payees.map(p => [p.id, p.name])),
    nameOf,
    countBySplit,
    partnerOf: (l: BookLine) => {
      const id = l.linkedEntryId ? partnerLedger.get(l.linkedEntryId) ?? null : null;
      return id ? ledgerById.get(id) ?? null : null;
    },
    /** The installment / request a line belongs to: by its source, else by either half's link (pre-3a). */
    installmentOf: (l: BookLine) =>
      (l.sourceModule === SOURCE_MODULE.installment && l.sourceEntityId ? instByIdMap.get(l.sourceEntityId) : undefined)
      ?? instByEntry.get(l.id) ?? (l.linkedEntryId ? instByEntry.get(l.linkedEntryId) : undefined) ?? null,
    requestOf: (l: BookLine) =>
      (l.sourceModule === SOURCE_MODULE.request && l.sourceEntityId ? reqByIdMap.get(l.sourceEntityId) : undefined)
      ?? reqByEntry.get(l.id) ?? (l.linkedEntryId ? reqByEntry.get(l.linkedEntryId) : undefined) ?? null,
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
  const moneyIn = l.entryType === 'income' || l.entryType === 'transfer_in';
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

  const fixed = book.kind === 'team' || l.status === 'void' || isSourcedLine(l, !!inst || !!req);
  const can: BookRowOut['can'] = fixed
    ? { edit: false, void: null }
    : isTransfer(l)
      ? { edit: false, void: partner?.entity_type !== 'team' ? 'both_halves' : null }
      : { edit: true, void: 'line' };

  return {
    id: l.id, date: l.entryDate, what, detail, category: lineCategoryWord(l), type,
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
      supabaseAdmin.from('accounting_entries').select('*').eq('ledger_id', ledgerId)
        .order('entry_date').order('created_at').order('id').range(a, b)).then(rows => rows.map(mapLine)),
    // The filter's list: the club's own words. Not for the export or for a team's (read-only) book.
    opts.all || kind === 'team' ? Promise.resolve([] as string[]) : clubCategories(orgId),
  ]);

  const win = bookWindow(all, { from: opts.from ?? null, to: opts.to ?? null });
  const typed = win.rows.map(r => ({ ...r, status: r.line.status, type: lineType(r.line), category: lineCategoryWord(r.line) }));
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
