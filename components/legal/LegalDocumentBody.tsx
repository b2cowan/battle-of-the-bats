import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ReactNode } from 'react';
import { TO_BE_FILLED_HREF } from '@/lib/legal-draft-filter';
import { legalSections, linkSectionReferences, sectionAnchor, slugify } from '@/lib/legal-sections';

/**
 * The one place a legal document's markdown becomes a page (GST/HST Stage 6 step 6.2, Chunk 1g). A server component. Raw HTML in
 * the text is OFF (no `rehype-raw`): the words are markdown only, so nothing in a draft or a frozen version can inject markup.
 * Tables come from `remark-gfm`, and each cell carries its column's name (`data-label`) for the phone's card layout. Links in the
 * text open in the same tab. A still-blank fact (the filter marks it with a link to `TO_BE_FILLED_HREF`) renders as the "to be
 * filled" mark — a component, not raw HTML. Every heading carries an anchor, and every "§N" that names one of this document's own
 * sections links to it (`lib/legal-sections.ts`).
 */

/** A fact the owner has yet to supply, shown in the dev preview only. */
export function ToBeFilledMark({ children }: { children: ReactNode }) {
  return <mark data-to-be-filled="">{children}</mark>;
}

interface MdNode { type: string; value?: string; children?: MdNode[]; data?: { hProperties?: Record<string, unknown> } }

const textOf = (n: MdNode): string => (n.value ?? '') + (n.children ?? []).map(textOf).join('');

/** Gives every body cell of a table the text of its column's heading, so a phone can draw each row as a labelled card. */
function remarkCellLabels() {
  return (tree: MdNode) => {
    const walk = (n: MdNode) => {
      if (n.type === 'table' && n.children?.length) {
        const heads = (n.children[0].children ?? []).map(textOf);
        for (const row of n.children.slice(1)) {
          (row.children ?? []).forEach((cell, i) => {
            if (heads[i]) cell.data = { ...cell.data, hProperties: { ...cell.data?.hProperties, 'data-label': heads[i] } };
          });
        }
      }
      n.children?.forEach(walk);
    };
    walk(tree);
  };
}

const flatText = (node: ReactNode): string =>
  typeof node === 'string' || typeof node === 'number'
    ? String(node)
    : Array.isArray(node)
      ? node.map(flatText).join('')
      : node && typeof node === 'object' && 'props' in node
        ? flatText((node as { props: { children?: ReactNode } }).props.children)
        : '';

export default function LegalDocumentBody({ markdown, otherTitle }: { markdown: string; otherTitle?: string }) {
  const sections = legalSections(markdown);
  const source = linkSectionReferences(markdown, sections, otherTitle);
  const used = new Map<string, number>();
  const idFor = (text: string, level: number) => {
    const m = level === 2 ? /^(\d+)\.\s/.exec(text) : null;
    if (m) return sectionAnchor(Number(m[1]));
    const base = slugify(text);
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return n ? `${base}-${n + 1}` : base;
  };
  return (
    <Markdown
      remarkPlugins={[remarkGfm, remarkCellLabels]}
      components={{
        a({ href, children }) {
          if (href === TO_BE_FILLED_HREF) return <ToBeFilledMark>{children}</ToBeFilledMark>;
          return <a href={href}>{children}</a>;
        },
        h2: ({ children }) => <h2 id={idFor(flatText(children), 2)}>{children}</h2>,
        h3: ({ children }) => <h3 id={idFor(flatText(children), 3)}>{children}</h3>,
      }}
    >
      {source}
    </Markdown>
  );
}
