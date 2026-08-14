#!/usr/bin/env node
/**
 * Measure help-content section length — the counting method behind the format
 * standard in `.claude/commands/docs.md` ("Content format standard").
 *
 * WHY THIS EXISTS: the first version of the standard said "a section longer than
 * ~6 paragraphs must become sub-topics", and the sweep that applied it counted
 * `<p>` tags. That yardstick is blind to lists: "How to run tryout day" is 1,481
 * words — longer than every topic that WAS converted — but it is three paragraphs
 * plus one 16-item list, so it scored a 3 and was left alone. A long bulleted list
 * is a wall too. This script measures what a reader actually faces.
 *
 * WHAT IT COUNTS, per section (and per sub-topic):
 *   words  — words of rendered body copy: the text inside `content:` on the
 *            section and inside each sub-topic's `content:`. JSX tags, component
 *            names and attributes are stripped; HTML entities count as one
 *            character, not a word. FAQ answers, `summary`, `keywords` and
 *            `searchText` are NOT body copy and are excluded.
 *   blocks — paragraphs + list items + definition rows + notes, combined. This is
 *            the number of separate things the reader has to get through.
 *
 * WHY WORDS ARE THE TRIGGER AND BLOCKS ARE NOT: counting every rendered block
 * (paragraphs AND list items) already fixes the original blind spot, because a
 * long list's words are counted. Making the block count a second hard threshold
 * makes it worse in the other direction — measured 2026-08-14, a >8-block rule
 * flags "Tournament workflow at a glance": 77 words in a 10-item list, which is
 * the most scannable section in the guide. So blocks are reported as a judgement
 * prompt (many blocks + few words = already structured; leave it), never as a
 * pass/fail line.
 *
 * A section that already carries `subtopics` is reported as CONVERTED and its
 * totals are informational: the standard is about undivided walls, and a
 * converted section is by definition divided. Sub-topic sizes are reported so an
 * oversized sub-topic can still be spotted.
 *
 * Usage:
 *   node scripts/measure-help-length.mjs               # every guide, worst first
 *   node scripts/measure-help-length.mjs --all         # include short sections
 *   node scripts/measure-help-length.mjs --module=coaches
 *   node scripts/measure-help-length.mjs --json
 *
 * Report-only by design — it never exits non-zero. Whether a given long section
 * should break into sub-topics is a judgement (see the standard's floor: 3–5
 * grouped sub-topics, never one paragraph each), and a gate that forced it would
 * push short topics into exactly the shape the standard warns against.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const CONTENT_DIR = join(process.cwd(), 'lib', 'help-content');

/** The standard's threshold — keep in sync with `.claude/commands/docs.md`. */
export const WORD_LIMIT = 350;
/** Not a limit: the point above which a section's block count is worth a human
 *  look, paired with enough words to make it plausible it reads as a wall. */
export const BLOCK_REVIEW = 12;
export const BLOCK_REVIEW_WORDS = 250;

const args = process.argv.slice(2);
const showAll = args.includes('--all');
const asJson = args.includes('--json');
const onlyModule = args.find((a) => a.startsWith('--module='))?.slice('--module='.length);

/** Strip JSX/markup down to the words a reader sees. */
function textOf(jsx) {
  return jsx
    // JSX expression containers that are pure punctuation/whitespace helpers
    .replace(/\{['"`]\s*['"`]\}/g, ' ')
    // tags, components and their attributes
    .replace(/<[^>]*>/g, ' ')
    // remaining expression containers (hrefs, props, conditionals)
    .replace(/\{[^{}]*\}/g, ' ')
    // entities are characters, not words
    .replace(/&[a-z]+;/gi, 'x')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCount(jsx) {
  const text = textOf(jsx);
  if (!text) return 0;
  return text.split(' ').filter((token) => /[a-z0-9]/i.test(token)).length;
}

function blockCount(jsx) {
  const matches = jsx.match(/<(p|li|HelpDef|HelpNote|HelpCallout)[\s>]/g);
  return matches ? matches.length : 0;
}

/**
 * Extract the region following `content:` at a given position.
 * Handles both `content: (\n …\n<indent>),` and single-line `content: <p>…</p>,`.
 */
function readContentRegion(lines, startIndex) {
  const line = lines[startIndex];
  const indent = line.match(/^(\s*)/)[1];
  if (/content:\s*\($/.test(line)) {
    const closer = `${indent})`;
    for (let i = startIndex + 1; i < lines.length; i += 1) {
      if (lines[i].startsWith(closer)) return { text: lines.slice(startIndex + 1, i).join('\n'), end: i };
    }
    return { text: lines.slice(startIndex + 1).join('\n'), end: lines.length - 1 };
  }
  return { text: line.replace(/^\s*content:\s*/, ''), end: startIndex };
}

function parseModule(name, source) {
  // Some modules are stored CRLF; a stray \r makes every `content: (` line fail
  // to match and silently reports the whole guide as zero words.
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  let current = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    const heading = line.match(/^\s{4,6}heading:\s*(['"`])(.*)\1,?\s*$/);
    if (heading) {
      current = {
        module: name,
        heading: heading[2],
        id: null,
        words: 0,
        blocks: 0,
        subtopics: [],
        line: i + 1,
      };
      sections.push(current);
      // `id:` sits above `heading:` in this codebase — look back a few lines.
      for (let back = i - 1; back >= Math.max(0, i - 4); back -= 1) {
        const id = lines[back].match(/^\s*id:\s*(['"`])(.*)\1,/);
        if (id) { current.id = id[2]; break; }
      }
      continue;
    }

    if (!current) continue;

    const subtopicTitle = line.match(/^\s*title:\s*(['"`])(.*)\1,?\s*$/);
    if (subtopicTitle) {
      current.subtopics.push({ title: subtopicTitle[2], words: 0, blocks: 0 });
      continue;
    }

    if (/^\s*content:/.test(line)) {
      const { text, end } = readContentRegion(lines, i);
      const words = wordCount(text);
      const blocks = blockCount(text);
      const target = current.subtopics.length > 0 ? current.subtopics[current.subtopics.length - 1] : null;
      if (target && target.words === 0 && target.blocks === 0) {
        target.words = words;
        target.blocks = blocks;
      }
      current.words += words;
      current.blocks += blocks;
      i = end;
    }
  }

  return sections;
}

function collect() {
  const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.tsx'));
  const out = [];
  for (const file of files) {
    const name = file.replace(/\.tsx$/, '');
    if (onlyModule && name !== onlyModule) continue;
    out.push(...parseModule(name, readFileSync(join(CONTENT_DIR, file), 'utf8')));
  }
  return out;
}

const sections = collect();
const unconverted = sections.filter((s) => s.subtopics.length === 0);
const over = unconverted.filter((s) => s.words > WORD_LIMIT);
const worthALook = unconverted.filter(
  (s) => s.words <= WORD_LIMIT && s.blocks > BLOCK_REVIEW && s.words > BLOCK_REVIEW_WORDS,
);
const converted = sections.filter((s) => s.subtopics.length > 0);

if (asJson) {
  console.log(JSON.stringify({ wordLimit: WORD_LIMIT, sections }, null, 2));
} else {
  const rows = (showAll ? unconverted : over).sort((a, b) => b.words - a.words);

  console.log(`\nHelp section length — standard: a section over ${WORD_LIMIT} words of body copy must break into sub-topics\n`);
  console.log('  words  blocks  guide            section');
  console.log('  -----  ------  ---------------  --------------------------------------------');
  for (const s of rows) {
    console.log(
      `${s.words > WORD_LIMIT ? '!' : ' '} ${String(s.words).padStart(5)}  ${String(s.blocks).padStart(6)}  ${s.module.padEnd(15)}  ${s.heading}`,
    );
  }

  if (worthALook.length) {
    console.log(`\n  Worth a look (under the word limit, but over ${BLOCK_REVIEW} blocks) — judgement, not a failure:`);
    for (const s of worthALook) {
      console.log(`    ${String(s.words).padStart(5)} words / ${String(s.blocks).padStart(2)} blocks  ${s.module} · ${s.heading}`);
    }
  }

  const oversizedSubtopics = converted.flatMap((s) =>
    s.subtopics.filter((t) => t.words > WORD_LIMIT).map((t) => ({ section: s.heading, module: s.module, ...t })),
  );

  console.log(
    `\n  ${sections.length} sections · ${converted.length} carry sub-topics · ${over.length} unconverted over the standard`,
  );
  if (oversizedSubtopics.length) {
    console.log(`\n  Sub-topics over ${WORD_LIMIT} words (inside already-converted sections):`);
    for (const t of oversizedSubtopics) {
      console.log(`    ${String(t.words).padStart(5)}  ${t.module} · ${t.section} → ${t.title}`);
    }
  }
  console.log('');
}
