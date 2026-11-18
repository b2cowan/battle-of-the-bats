import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  journalKey, journalFileName, keyMismatch, parseJournal, selectRemaining, pairLabel, pairListHash,
  timingSummary, budgetFromP95, formatDuration,
} from '../../scripts/layout-run-journal.mjs';
import { pauseDecision } from '../../scripts/memory-guard.mjs';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * THE LAYOUT SWEEP KEEPS ITS PROGRESS, AND PAUSES BEFORE IT QUITS (Release process hardening, Stage 1A,
 * 2026-11-15; docs/projects/active/RELEASE_PROCESS_HARDENING_PLAN.md §5.1 items 4 and 5).
 *
 * The whole-product sweep had not finished for three releases: a low-memory stop threw away every finished screen.
 * These are the three decisions the fix turns on, as pure functions:
 *   - the JOURNAL KEY: a resume is honest only on the same commit, target, theme, sidebar, measuring code and pairs;
 *   - the RESUME SELECTION: what is left, in each unit's own order;
 *   - the PAUSE DECISION: resume above the floor plus a margin, wait while there is time, give up after.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */

const pairs = [
  { label: 'coach-roster @361', url: '/t/roster', ready: 'h1' },
  { label: 'coach-roster @1440', url: '/t/roster', ready: 'h1' },
];
const baseKey = { commit: 'abc', host: 'dev.example', theme: undefined, sidebar: undefined, probe: 'p1', pairs: pairListHash(pairs) };

describe('the journal key', () => {
  it('fills the defaults a person reads in the file name', () => {
    const key = journalKey(baseKey);
    assert.equal(key.theme, 'default');
    assert.equal(key.sidebar, 'full');
    assert.match(journalFileName(key), /^default-full-[0-9a-f]{12}\.jsonl$/);
  });

  it('is the same for the same pairs in any order, and changes when a pair\'s address or ready mark does', () => {
    assert.equal(pairListHash(pairs), pairListHash([...pairs].reverse()));
    assert.notEqual(pairListHash(pairs), pairListHash([pairs[0], { ...pairs[1], url: '/t/roster?x' }]));
    assert.notEqual(pairListHash(pairs), pairListHash([pairs[0], { ...pairs[1], ready: 'main' }]));
    assert.notEqual(pairListHash(pairs), pairListHash([pairs[0]]));
  });

  it('names every field that differs, and nothing when the run is the same', () => {
    const key = journalKey(baseKey);
    assert.deepEqual(keyMismatch(key, journalKey(baseKey)), []);
    const other = journalKey({ ...baseKey, commit: 'def', host: 'localhost:3000' });
    const why = keyMismatch(key, other);
    assert.equal(why.length, 2);
    assert.match(why[0], /^commit: journal has abc, this run is def$/);
    assert.match(why[1], /^target: /);
    assert.notEqual(journalFileName(key), journalFileName(other));
  });

  it('refuses a journal with no header at all', () => {
    assert.equal(keyMismatch(null, journalKey(baseKey)).length, 6);
  });
});

describe('reading a journal', () => {
  it('reads the header and the finished pairs, and drops a line torn by a kill', () => {
    const text = [
      JSON.stringify({ kind: 'header', key: journalKey(baseKey) }),
      JSON.stringify({ kind: 'pair', label: 'coach-roster @361', screen: 'coach-roster', width: '361', findings: [], ms: 900 }),
      '{"kind":"pair","label":"coach-roster @14',
    ].join('\n');
    const { header, done } = parseJournal(text);
    assert.equal(header.commit, 'abc');
    assert.deepEqual([...done.keys()], ['coach-roster @361']);
  });

  it('treats an empty or missing journal as nothing done', () => {
    assert.equal(parseJournal('').done.size, 0);
    assert.equal(parseJournal(undefined).header, null);
  });
});

describe('what a resumed run still measures', () => {
  const s = (id: string) => ({ id });
  const units = [
    { session: 'coach', w: { name: '361' }, list: [s('a'), s('b'), s('c')] },
    { session: 'coach', w: { name: '1440' }, list: [s('a'), s('b')] },
    { session: 'anon', w: { name: '361' }, list: [s('m')] },
  ];

  it('skips the journalled pairs and keeps each unit\'s own order', () => {
    const done = new Set([pairLabel('b', '361'), pairLabel('a', '1440'), pairLabel('b', '1440')]);
    const left = selectRemaining(units, done);
    assert.deepEqual(left.map((u) => `${u.session}@${u.w.name}:${u.list.map((x) => x.id).join('')}`), ['coach@361:ac', 'anon@361:m']);
  });

  it('matches a pair by screen AND width, never the screen alone', () => {
    const left = selectRemaining(units, new Set([pairLabel('a', '361')]));
    assert.deepEqual(left[1].list.map((x) => x.id), ['a', 'b']);
  });

  it('leaves nothing when everything is done, and everything when nothing is', () => {
    const all = new Set(units.flatMap((u) => u.list.map((x) => pairLabel(x.id, u.w.name))));
    assert.deepEqual(selectRemaining(units, all), []);
    assert.equal(selectRemaining(units, new Map()).reduce((n, u) => n + u.list.length, 0), 6);
  });
});

describe('the pause decision', () => {
  const at = { floor: 1536, marginMb: 512, maxWaitMs: 600_000 };

  it('resumes only above the floor plus the margin: back AT the floor would trip on the next page', () => {
    assert.equal(pauseDecision({ ...at, free: 2048, waitedMs: 0 }), 'resume');
    assert.equal(pauseDecision({ ...at, free: 2047, waitedMs: 0 }), 'wait');
    assert.equal(pauseDecision({ ...at, free: 1600, waitedMs: 30_000 }), 'wait');
  });

  it('gives up when the wait has run out, and not before', () => {
    assert.equal(pauseDecision({ ...at, free: 1000, waitedMs: 599_999 }), 'wait');
    assert.equal(pauseDecision({ ...at, free: 1000, waitedMs: 600_000 }), 'give-up');
  });

  it('still resumes at the last poll if memory came back', () => {
    assert.equal(pauseDecision({ ...at, free: 4000, waitedMs: 700_000 }), 'resume');
  });
});

describe('the run\'s cost', () => {
  it('reports nearest-rank p50/p95 and the ten slowest pairs', () => {
    const t = timingSummary(Array.from({ length: 20 }, (_, i) => ({ label: `s${i}`, ms: (i + 1) * 100 })));
    assert.equal(t.pairs, 20);
    assert.equal(t.p50, 1000);
    assert.equal(t.p95, 1900);
    assert.equal(t.slowest.length, 10);
    assert.equal(t.slowest[0].label, 's19');
    assert.deepEqual(timingSummary([]), { pairs: 0, p50: 0, p95: 0, slowest: [] });
  });

  it('sets a budget about three times the p95, never under 20 s', () => {
    assert.equal(budgetFromP95(4_000), 20_000);
    assert.equal(budgetFromP95(9_200), 28_000);
  });

  it('writes the wall-clock as a person reads it', () => {
    assert.equal(formatDuration(41_000), '41 s');
    assert.equal(formatDuration(750_000), '12 min 30 s');
    assert.equal(formatDuration(3_840_000), '1 h 04 min');
  });
});
