/**
 * An audit entry's old or new value, laid out for its window: one line at a time, each marked when it is part of what
 * changed (drawn in `docs/projects/active/PLATFORM_AUDIT_ENTRY_WINDOW_MOCKUP.html`). The window tells the reader what the
 * tint means in a sentence, so colour is never the only signal.
 *
 * A top-level key is "changed" when the other side lacks it or holds something different; a whole value that is not an
 * object is changed when it differs from the other side. Both sides empty is not a change.
 *
 * Pure so `tests/unit/platform-audit-diff.test.ts` can pin it.
 */
export type ValueLine = { text: string; changed: boolean };

function isPlain(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function valueLines(value: unknown, other: unknown): ValueLine[] {
  if (value === null || value === undefined) return [{ text: '-', changed: !same(value, other) }];

  if (isPlain(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) return [{ text: '{}', changed: !same(value, other) }];
    const lines: ValueLine[] = [{ text: '{', changed: false }];
    keys.forEach((key, i) => {
      const changed = !isPlain(other) || !Object.hasOwn(other, key) || !same(value[key], other[key]);
      const block = (JSON.stringify(value[key] ?? null, null, 2) ?? 'null').split('\n');
      block.forEach((line, j) => {
        const head = j === 0 ? `  ${JSON.stringify(key)}: ` : '  ';
        const tail = j === block.length - 1 && i < keys.length - 1 ? ',' : '';
        lines.push({ text: `${head}${line}${tail}`, changed });
      });
    });
    lines.push({ text: '}', changed: false });
    return lines;
  }

  const text = typeof value === 'string' ? value : (JSON.stringify(value, null, 2) ?? String(value));
  const changed = !same(value, other);
  return text.split('\n').map(line => ({ text: line, changed }));
}
