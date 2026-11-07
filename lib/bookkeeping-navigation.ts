import { isRecordId } from './bookkeeping-expenses';

export const BOOKKEEPING_VIEWS = ['overview', 'expenses', 'ledger', 'reports'] as const;
export type BookkeepingSection = typeof BOOKKEEPING_VIEWS[number];
export type BookkeepingForm = 'add' | 'correct' | 'void';

/**
 * Reports' views (ladder row 3, Q12; thin first cut ruled 2026-11-07). The first key is the default and the fallback
 * for any address that names an unknown view. Adding a view is one key + label here and one entry in the page's
 * registry beside its component. The View pill exists only while two or more views are available
 * (`reportViewControl`), so with Spending alone Reports shows no choice.
 */
export const REPORT_VIEWS = ['spending'] as const;
export type ReportView = typeof REPORT_VIEWS[number];
export const REPORT_VIEW_LABELS: Record<ReportView, string> = { spending: 'Spending' };

/** The view in force and the pill's options; `options` is null — no pill — below two available views. */
export function reportViewControl(requested: ReportView, views: readonly { key: ReportView; available: boolean }[]) {
  const available = views.filter(view => view.available);
  const current = available.find(view => view.key === requested)?.key ?? available[0]?.key ?? REPORT_VIEWS[0];
  const options = available.length >= 2 ? available.map(view => ({ id: view.key, label: REPORT_VIEW_LABELS[view.key] })) : null;
  return { current, options };
}

export function bookkeepingTransferPlace(params: URLSearchParams) {
  const id = params.get('movement');
  const movement = isRecordId(id) ? id!.toLowerCase() : null;
  const requested = params.get('transfer');
  const form: BookkeepingForm | null = requested === 'add' ? 'add'
    : movement && (requested === 'correct' || requested === 'void') ? requested : null;
  return { movement, form };
}

/** Read only supported places; an address cannot expose the hidden Sources preview. */
export function bookkeepingPlace(params: URLSearchParams) {
  const requested = params.get('view');
  const view: BookkeepingSection = BOOKKEEPING_VIEWS.find(value => value === requested) ?? 'overview';
  const id = params.get('record');
  const record = isRecordId(id) ? id!.toLowerCase() : null;
  const requestedForm = params.get('form');
  const form: BookkeepingForm | null = requestedForm === 'add' ? 'add'
    : record && (requestedForm === 'correct' || requestedForm === 'void') ? requestedForm : null;
  const requestedReport = params.get('report');
  const report: ReportView = REPORT_VIEWS.find(value => value === requestedReport) ?? REPORT_VIEWS[0];
  return { view, record, form, attention: view === 'expenses' && params.get('attention') === '1', report };
}

/** Preserve the list's filters when opening a record or changing its window level. */
export function bookkeepingAddress(params: URLSearchParams, changes: {
  view?: BookkeepingSection; record?: string | null; form?: BookkeepingForm | null; attention?: boolean;
  movement?: string | null; transfer?: BookkeepingForm | null;
  /** The default view (Spending) is written as no `report` at all, so today's Reports address stays the canonical one. */
  report?: ReportView | null;
}) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === false || (key === 'report' && value === REPORT_VIEWS[0])) next.delete(key);
    else next.set(key, value === true ? '1' : value);
  }
  const query = next.toString();
  return `/platform-admin/bookkeeping${query ? `?${query}` : ''}`;
}
