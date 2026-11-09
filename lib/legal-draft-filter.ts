/**
 * The filter that turns a `/legal` draft into the text the dev preview shows (GST/HST Stage 6 step 6.2, ruling Q1). Pure,
 * so the unit tests run it on both REAL drafts; the file reader that feeds it is `lib/legal-draft-preview.ts`.
 *
 * The drafting conventions it depends on are written, word for word, in `docs/agents/legal/LEGAL_INDEX.md` § Documents
 * ("Drafts the dev preview reads") so `/legal` knows the shape it must keep. If a draft trips the safety net in
 * `tests/unit/legal-draft-preview.test.ts`, the fix is an edit to the DRAFT, not a wider filter.
 *
 *  1. Everything up to and including the first line that is exactly `---` goes (DRAFT title, header table, change log,
 *     "How to read" block). The page title comes from `lib/legal-words.ts`, never the draft's `#`.
 *  2. Every blockquote block (contiguous `>` lines) whose first line starts `> NOTE` or `> NOTES` goes.
 *  3. The subsection `### The words the product shows` goes, up to the next `## ` heading or `---` line (product copy).
 *  4. From the first `## Before this can be published` heading to the end of the file goes; a trailing `---` is trimmed.
 *  5. A `[text]` that is not a link (not followed by `(`) is a still-blank fact: it becomes a link to `#to-be-filled`
 *     whose text is the "to be filled" mark, which `LegalDocumentBody` renders as a component.
 */

import { legalToBeFilled } from './legal-words';

/** The href a still-blank fact's marker link carries; `LegalDocumentBody` turns that link into the mark component. */
export const TO_BE_FILLED_HREF = '#to-be-filled';

export function filterDraftForPreview(markdown: string): string {
  const all = markdown.replace(/\r\n?/g, '\n').split('\n');

  // 1. Drop everything through the first bare `---`.
  const rule = all.findIndex(l => l.trimEnd() === '---');
  let lines = rule < 0 ? all : all.slice(rule + 1);

  // 4. Drop "Before this can be published" to the end.
  const before = lines.findIndex(l => /^## Before this can be published\b/.test(l));
  if (before >= 0) lines = lines.slice(0, before);

  // 3. Drop "### The words the product shows" up to the next `## ` heading or `---` line.
  const kept: string[] = [];
  let inWords = false;
  for (const l of lines) {
    if (/^### The words the product shows\b/.test(l)) { inWords = true; continue; }
    if (inWords) {
      if (/^## /.test(l) || l.trimEnd() === '---') inWords = false;
      else continue;
    }
    kept.push(l);
  }

  // 2. Drop NOTE / NOTES blockquote blocks.
  const out: string[] = [];
  let dropping = false;
  for (let i = 0; i < kept.length; i++) {
    const l = kept[i];
    const isQuote = l.startsWith('>');
    if (isQuote) {
      const startsBlock = i === 0 || !kept[i - 1].startsWith('>');
      if (startsBlock) dropping = /^>\s*NOTES?\b/.test(l);
      if (dropping) continue;
    } else {
      dropping = false;
    }
    out.push(l);
  }

  // Trim a trailing `---` and blank edges.
  while (out.length && (out[out.length - 1].trim() === '' || out[out.length - 1].trim() === '---')) out.pop();
  while (out.length && out[0].trim() === '') out.shift();

  // 5. Still-blank facts. Not links (no `(` after), not task-list boxes, not already marked.
  return out
    .join('\n')
    .replace(/\[([^\[\]\n]+)\](?!\()/g, (whole, fact: string) => {
      if (/^[xX ]$/.test(fact) || /to be filled/.test(fact)) return whole;
      // The mark keeps its own square brackets as text, so they are escaped inside the link text.
      const mark = legalToBeFilled(fact.trim()).replace(/[[\]]/g, c => `\\${c}`);
      return `[${mark}](${TO_BE_FILLED_HREF})`;
    })
    .concat('\n');
}
