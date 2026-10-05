/**
 * What a multi-choice filter says it is set to — ONE rule for the desk pill and the phone sheet's row (Filter Counts
 * D2 + D3, owner 2026-10-05, hub https://claude.ai/artifact/EFWMUeiC3sLkn4CQaBqzrw).
 *
 * ⚖ A NARROWED FILTER NAMES ITS CHOICES. "2 selected" said a filter was narrowed, not how, so a coach opened the pill
 * to find out; names answer it in place. Up to three, in list order, then "N selected" — measured on the live Ledger,
 * three narrowed pills still fit one line at 1024px.
 *
 * ⚠ ONE FUNCTION, TWO PLACES. The pill and the sheet row each had their own rule ("2 selected" beside "Actual,
 * Overdue") and drifted apart within a day of the sheet shipping. Both call this.
 *
 * ⚠ A selection holding an option no longer offered (a tag that left the list) reads "N selected" — never the all
 * word, which would say the list is unfiltered when it is not.
 */
const MAX_NAMES = 3;

export function filterSummary(
  options: readonly { id: string; label: string }[],
  selected: ReadonlySet<string>,
  allLabel: string,
): string {
  if (selected.size === 0) return allLabel;
  const names = options.filter(o => selected.has(o.id)).map(o => o.label);
  return names.length === selected.size && names.length <= MAX_NAMES
    ? names.join(', ')
    : `${selected.size} selected`;
}
