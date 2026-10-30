import { isRecordId } from './bookkeeping-expenses';

export const BOOKKEEPING_VIEWS = ['overview', 'expenses', 'ledger', 'reports'] as const;
export type BookkeepingSection = typeof BOOKKEEPING_VIEWS[number];
export type BookkeepingForm = 'add' | 'correct' | 'void';

/** Read only supported places; an address cannot expose the hidden Sources preview. */
export function bookkeepingPlace(params: URLSearchParams) {
  const requested = params.get('view');
  const view: BookkeepingSection = BOOKKEEPING_VIEWS.find(value => value === requested) ?? 'overview';
  const id = params.get('record');
  const record = isRecordId(id) ? id!.toLowerCase() : null;
  const requestedForm = params.get('form');
  const form: BookkeepingForm | null = requestedForm === 'add' ? 'add'
    : record && (requestedForm === 'correct' || requestedForm === 'void') ? requestedForm : null;
  return { view, record, form, attention: view === 'expenses' && params.get('attention') === '1' };
}

/** Preserve the list's filters when opening a record or changing its window level. */
export function bookkeepingAddress(params: URLSearchParams, changes: {
  view?: BookkeepingSection; record?: string | null; form?: BookkeepingForm | null; attention?: boolean;
}) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === false) next.delete(key);
    else next.set(key, value === true ? '1' : value);
  }
  const query = next.toString();
  return `/platform-admin/bookkeeping${query ? `?${query}` : ''}`;
}
