/**
 * Preview-only adapter for the proposed bookkeeping Stripe CSV v1 contract.
 * This module intentionally has no database, filesystem, network, or posting effects.
 */

export const BOOKKEEPING_SOURCE_CSV_REQUIRED_HEADERS = [
  'schema_version', 'provider', 'environment', 'platform_account_id', 'connected_account_id',
  'movement_id', 'movement_type', 'source_object_id', 'parent_movement_id', 'occurred_at_utc',
  'currency', 'gross_cents', 'tax_cents', 'fee_cents', 'net_cents', 'seller_kind',
  'tax_liability_kind', 'status', 'policy_version',
] as const;

export const BOOKKEEPING_SOURCE_CSV_OPTIONAL_HEADERS = [
  'invoice_id', 'payment_id', 'refund_id', 'payout_id', 'service_from', 'service_to', 'evidence_url',
] as const;

export type BookkeepingSourceMovementType =
  | 'subscription_sale'
  | 'application_fee'
  | 'processor_fee'
  | 'refund'
  | 'fee_refund'
  | 'payout_out';

export type BookkeepingSourceIdentity = {
  provider: string;
  environment: string;
  platform_account_id: string;
  connected_account_id: string;
  movement_id: string;
};

export type BookkeepingSourceMovement = BookkeepingSourceIdentity & {
  schema_version: 1;
  movement_type: BookkeepingSourceMovementType;
  source_object_id: string;
  parent_movement_id: string;
  occurred_at_utc: string;
  currency: string;
  gross_cents: number;
  tax_cents: number;
  fee_cents: number;
  net_cents: number;
  seller_kind: string;
  tax_liability_kind: string;
  status: string;
  policy_version: string;
  invoice_id: string;
  payment_id: string;
  refund_id: string;
  payout_id: string;
  service_from: string;
  service_to: string;
  evidence_url: string;
};

export type BookkeepingSourcePreviewRow = {
  line: number;
  movement: BookkeepingSourceMovement | null;
  identity_key: string | null;
  status: 'ready' | 'blocked' | 'duplicate';
  issues: string[];
};

export type BookkeepingSourcePreview = {
  accepted_contract: false;
  can_post: false;
  headers: string[];
  file_issues: string[];
  source_scopes: Array<Pick<BookkeepingSourceIdentity, 'provider' | 'environment' | 'platform_account_id' | 'connected_account_id'>>;
  rows: BookkeepingSourcePreviewRow[];
  counts: { rows: number; ready: number; blocked: number; duplicates: number };
  totals_by_currency: Record<string, { rows: number; gross_cents: number; tax_cents: number; fee_cents: number; net_cents: number }>;
};

const MOVEMENT_TYPES = new Set<BookkeepingSourceMovementType>([
  'subscription_sale', 'application_fee', 'processor_fee', 'refund', 'fee_refund', 'payout_out',
]);
const REQUIRED_HEADERS = new Set<string>(BOOKKEEPING_SOURCE_CSV_REQUIRED_HEADERS);
const INTEGER = /^-?\d+$/;

function parseCsv(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') {
      if (cell.length) throw new Error(`Unexpected quote on CSV line ${rows.length + 1}.`);
      quoted = true;
    } else if (char === ',') {
      row.push(cell); cell = '';
    } else if (char === '\n' || char === '\r') {
      row.push(cell); cell = '';
      if (row.some((value) => value.length) || rows.length) rows.push(row);
      row = [];
      if (char === '\r' && input[i + 1] === '\n') i += 1;
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error(`Unclosed quoted value on CSV line ${rows.length + 1}.`);
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function identityKey(identity: BookkeepingSourceIdentity): string {
  return [identity.provider, identity.environment, identity.platform_account_id,
    identity.connected_account_id, identity.movement_id].map((part) => encodeURIComponent(part.trim())).join('|');
}

function amount(value: string, column: string, issues: string[]): number {
  if (!INTEGER.test(value)) { issues.push(`${column} must be an integer number of cents.`); return 0; }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) { issues.push(`${column} is outside the safe integer range.`); return 0; }
  return parsed;
}

/** Build an inspectable preview. Existing identities may be supplied by a caller; nothing is persisted. */
export function previewBookkeepingSourceCsv(csv: string, alreadyImported: ReadonlySet<string> = new Set()): BookkeepingSourcePreview {
  const fileIssues: string[] = [];
  let matrix: string[][];
  try { matrix = parseCsv(csv); }
  catch (error) { matrix = []; fileIssues.push(error instanceof Error ? error.message : 'The CSV could not be read.'); }

  const header = matrix[0]?.map((value) => value.trim()) ?? [];
  const headerIndexes = new Map<string, number>();
  header.forEach((name, index) => {
    if (headerIndexes.has(name)) fileIssues.push(`Header “${name}” appears more than once.`);
    else headerIndexes.set(name, index);
  });
  for (const required of REQUIRED_HEADERS) {
    if (!headerIndexes.has(required)) fileIssues.push(`Required column “${required}” is missing.`);
  }

  const parsedRows = matrix.slice(1).filter((cells) => cells.some((cell) => cell.length));
  const resultRows: BookkeepingSourcePreviewRow[] = [];
  const seenInFile = new Set<string>();
  if (!fileIssues.some((issue) => issue.startsWith('Required column') || issue.startsWith('Header “'))) {
    parsedRows.forEach((cells, index) => {
      const line = index + 2;
      const get = (name: string) => cells[headerIndexes.get(name) ?? -1]?.trim() ?? '';
      const issues: string[] = [];
      if (cells.length !== header.length) issues.push(`Expected ${header.length} columns but found ${cells.length}.`);
      for (const name of BOOKKEEPING_SOURCE_CSV_REQUIRED_HEADERS) {
        if (!get(name)) issues.push(`${name} is required.`);
      }
      if (get('schema_version') !== '1') issues.push('Only proposed schema version 1 can be previewed.');
      if (get('provider') !== 'stripe') issues.push('Only the proposed Stripe provider is supported.');
      if (!['test', 'live'].includes(get('environment'))) issues.push('environment must be test or live.');
      if (!/^[A-Z]{3}$/.test(get('currency'))) issues.push('currency must be a three-letter uppercase code.');
      if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(get('occurred_at_utc')) || Number.isNaN(Date.parse(get('occurred_at_utc')))) {
        issues.push('occurred_at_utc must be a valid UTC timestamp ending in Z.');
      }
      const rawType = get('movement_type');
      if (!MOVEMENT_TYPES.has(rawType as BookkeepingSourceMovementType)) issues.push(`Unsupported movement_type “${rawType}”.`);
      const gross = amount(get('gross_cents'), 'gross_cents', issues);
      const tax = amount(get('tax_cents'), 'tax_cents', issues);
      const fee = amount(get('fee_cents'), 'fee_cents', issues);
      const net = amount(get('net_cents'), 'net_cents', issues);
      if (net !== gross - fee) issues.push('net_cents must equal gross_cents minus fee_cents.');
      if (['subscription_sale', 'application_fee'].includes(rawType) && gross < 0) {
        issues.push(`${rawType} gross_cents must not be negative; use a linked refund movement.`);
      }
      if (rawType === 'processor_fee' && (gross !== 0 || fee <= 0 || net >= 0)) {
        issues.push('processor_fee must have zero gross, a positive fee, and negative net.');
      }
      if (rawType === 'refund' && gross >= 0) issues.push('refund gross_cents must be negative.');
      if (rawType === 'fee_refund' && (gross !== 0 || fee >= 0 || net <= 0)) {
        issues.push('fee_refund must have zero gross, a negative fee, and positive net.');
      }
      if (rawType === 'payout_out' && (gross >= 0 || net >= 0)) {
        issues.push('payout_out must have negative gross and negative net.');
      }
      if (['processor_fee', 'refund', 'fee_refund'].includes(rawType) && !get('parent_movement_id')) {
        issues.push(`${rawType} requires parent_movement_id.`);
      }
      if (get('status') !== 'posted') issues.push('Only posted source rows can be reviewed as ready.');

      const movement = {
        schema_version: 1 as const,
        provider: get('provider'), environment: get('environment'),
        platform_account_id: get('platform_account_id'), connected_account_id: get('connected_account_id'),
        movement_id: get('movement_id'), movement_type: rawType as BookkeepingSourceMovementType,
        source_object_id: get('source_object_id'), parent_movement_id: get('parent_movement_id'),
        occurred_at_utc: get('occurred_at_utc'), currency: get('currency'),
        gross_cents: gross, tax_cents: tax, fee_cents: fee, net_cents: net,
        seller_kind: get('seller_kind'), tax_liability_kind: get('tax_liability_kind'),
        status: get('status'), policy_version: get('policy_version'),
        invoice_id: get('invoice_id'), payment_id: get('payment_id'), refund_id: get('refund_id'),
        payout_id: get('payout_id'), service_from: get('service_from'), service_to: get('service_to'),
        evidence_url: get('evidence_url'),
      };
      const key = identityKey(movement);
      if (seenInFile.has(key)) {
        resultRows.push({ line, movement, identity_key: key, status: 'duplicate', issues: ['This movement identity appears more than once in the file.'] });
      } else if (alreadyImported.has(key)) {
        seenInFile.add(key);
        resultRows.push({ line, movement, identity_key: key, status: 'duplicate', issues: ['This movement identity was supplied as already imported.'] });
      } else {
        seenInFile.add(key);
        resultRows.push({ line, movement, identity_key: key, status: issues.length ? 'blocked' : 'ready', issues });
      }
    });
  }

  const totals: BookkeepingSourcePreview['totals_by_currency'] = {};
  const scopeMap = new Map<string, BookkeepingSourcePreview['source_scopes'][number]>();
  for (const row of resultRows) {
    if (row.movement) {
      const scope = {
        provider: row.movement.provider,
        environment: row.movement.environment,
        platform_account_id: row.movement.platform_account_id,
        connected_account_id: row.movement.connected_account_id,
      };
      const scopeKey = [scope.provider, scope.environment, scope.platform_account_id, scope.connected_account_id]
        .map((part) => encodeURIComponent(part.trim())).join('|');
      scopeMap.set(scopeKey, scope);
    }
    if (row.status !== 'ready' || !row.movement) continue;
    const currency = row.movement.currency;
    const total = totals[currency] ??= { rows: 0, gross_cents: 0, tax_cents: 0, fee_cents: 0, net_cents: 0 };
    total.rows += 1;
    total.gross_cents += row.movement.gross_cents;
    total.tax_cents += row.movement.tax_cents;
    total.fee_cents += row.movement.fee_cents;
    total.net_cents += row.movement.net_cents;
  }
  return {
    accepted_contract: false, can_post: false, headers: header, file_issues: fileIssues,
    source_scopes: [...scopeMap.values()], rows: resultRows,
    counts: {
      rows: parsedRows.length,
      ready: resultRows.filter((row) => row.status === 'ready').length,
      blocked: resultRows.filter((row) => row.status === 'blocked').length,
      duplicates: resultRows.filter((row) => row.status === 'duplicate').length,
    },
    totals_by_currency: totals,
  };
}

/** Stable key helper for callers that load prior identities into a preview. */
export function bookkeepingSourceIdentityKey(identity: BookkeepingSourceIdentity): string {
  return identityKey(identity);
}
