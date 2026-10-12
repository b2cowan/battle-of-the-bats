import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { readSource, stripComments } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ONE LOADING LINE, BOTH PORTALS (owner, 2026-10-12). The admin drew its loading state five ways — a
 * 32px spinning refresh icon centred on an empty page (Schedule, Results, Communications), a spinner
 * beside the words (Chat), centred small caps (the admin home, Tournaments, Families), and a dozen
 * hand-styled quiet lines — and nearly every one said the bare word "Loading…". Three tournament
 * redesign stages each rebuilt a screen and kept its old loading state. Every admin loading line now
 * draws `components/shared/LoadingState` (the portal's line, moved), naming what the screen shows.
 *
 * This file is what keeps it that way: a hand-typed loading sentence in the admin fails here, and so
 * does a label the layout sweep cannot wait out.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ROOT = path.resolve(import.meta.dirname, '../..');
const ADMIN_ROOTS = ['app/[orgSlug]/admin', 'components/admin'];

function tsxUnder(rel: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
    const child = `${rel}/${entry.name}`;
    if (entry.isDirectory()) out.push(...tsxUnder(child));
    else if (entry.name.endsWith('.tsx')) out.push(child);
  }
  return out;
}

/** Code with every comment blanked but the line count kept, so a hit maps back to its own line. */
function codeLines(source: string): string[] {
  const blanked = source.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  return stripComments(blanked).split('\n');
}

/**
 * The layout sweep's own test for "this screen is still loading" — `waitForNoLoading` in
 * scripts/layout-screens.mjs, restated (it lives inside a browser callback and cannot be imported).
 * A label it does not match releases the sweep on a half-drawn screen: "Loading Budget vs. Actual…"
 * fails it on the full stop, and so does anything past ~40 characters.
 */
const SWEEP_WAITS_OUT = /^\s*Loading\b[^.!?\n]{0,40}(…|\.\.\.)?\s*$/i;
const sweepCanWaitOut = (label: string) => SWEEP_WAITS_OUT.test(label) && label.endsWith('…');

/** A loading sentence typed into markup or a string: `>Loading…<`, `'Loading the schedule...'`. */
const HAND_TYPED = /(?:>|['"`])\s*Loading\b[^<>'"`{}\n]*(?:…|\.\.\.)\s*(?:<|['"`])/;
/** The same sentence as JSX text on a line of its own — `<p>`, then `Loading…`, then `</p>` (/review, 2026-10-12:
 *  the line-by-line test above needs a `>` or a quote beside the word, so a wrapped element slipped past it). */
const BARE_TEXT_LINE = /^\s*Loading\b[^<>'"`{}=;()]*(?:…|\.\.\.)\s*$/;
/** The one place a loading sentence belongs — the component's own `label`. */
const LABEL_ATTR = /\blabel=(?:"[^"]*"|\{'[^']*'\}|\{`[^`]*`\})/g;
/** Not a loading state: a select's placeholder row, a screen-reader-only announcement, or a line
 *  marked `loading-ok` (on it or the line above) with the reason — a figure's own placeholder. */
const NOT_A_LOADING_STATE = /<option\b|sr-only|loading-ok/;

describe('the admin draws the one loading line', () => {
  const files = ADMIN_ROOTS.flatMap(tsxUnder);

  it('finds the admin screens it guards', () => {
    assert.ok(files.length > 100, `only ${files.length} admin .tsx files found — the roots moved?`);
  });

  it('never types a loading sentence of its own', () => {
    const offenders: string[] = [];
    for (const rel of files) {
      const raw = readSource(rel).split('\n');
      const code = codeLines(raw.join('\n'));
      code.forEach((line, i) => {
        if (NOT_A_LOADING_STATE.test(raw[i]) || (i > 0 && raw[i - 1].includes('loading-ok'))) return;
        const bare = line.replace(LABEL_ATTR, '');
        if (HAND_TYPED.test(bare) || BARE_TEXT_LINE.test(bare)) offenders.push(`${rel}:${i + 1}  ${raw[i].trim().slice(0, 120)}`);
      });
    }
    assert.deepEqual(offenders, [], `draw <LoadingState label="Loading the …" /> (components/shared/LoadingState) instead:\n${offenders.join('\n')}`);
  });

  it('labels every loading line so the layout sweep can wait it out', () => {
    const bad: string[] = [];
    const LABELLED = /<(?:LoadingState|PageLoading)\b[^>]*?\blabel=(?:"([^"]*)"|\{`([^`]*)`\})/g;
    for (const rel of files) {
      for (const m of readSource(rel).matchAll(LABELLED)) {
        const label = m[1] ?? m[2].replace(/\$\{[^}]*\}/g, 'x');
        if (!sweepCanWaitOut(label)) bad.push(`${rel}: "${m[1] ?? m[2]}"`);
      }
    }
    assert.deepEqual(bad, [], `a label starts "Loading", ends "…", has no full stop, and stays short:\n${bad.join('\n')}`);
  });

  it('keeps the loading words held in word modules to the same rule', () => {
    const bad: string[] = [];
    const libDir = path.join(ROOT, 'lib');
    for (const name of readdirSync(libDir).filter(n => n.endsWith('.ts'))) {
      for (const m of readSource(`lib/${name}`).matchAll(/^\s*\w*[lL]oading\w*:\s*'(Loading[^']*)'/gm)) {
        if (!sweepCanWaitOut(m[1])) bad.push(`lib/${name}: "${m[1]}"`);
      }
    }
    assert.deepEqual(bad, [], bad.join('\n'));
  });
});

describe('a tournament screen waits for its tournament before saying there is none', () => {
  // Owner, 2026-10-12 (found reviewing the sweep): ten tournament screens said "Select a tournament…" — or showed
  // nothing — while the tournament context was still loading, on every open. A screen with a no-tournament message
  // must read the context's `loading` and draw its loading line in that wait (only while there is no tournament yet:
  // the flag also turns on for a refresh, and a refresh must never blank a screen that has one).
  const NO_TOURNAMENT_WORDS = /\bnoTournament\b|\bnoEvent\b|Select a tournament|No tournament selected/;
  it('reads the context\'s loading wherever it can say "no tournament"', () => {
    const blind: string[] = [];
    for (const rel of tsxUnder('app/[orgSlug]/admin/tournaments')) {
      const code = stripComments(readSource(rel));
      if (!NO_TOURNAMENT_WORDS.test(code) || !/useTournament\(\)/.test(code)) continue;
      if (!/const \{[^}]*\bloading\b[^}]*\} = useTournament\(\)/.test(code)) blind.push(rel);
    }
    assert.deepEqual(blind, [], `these screens can say "no tournament" while it is still loading:\n${blind.join('\n')}`);
  });
});

describe('the line itself', () => {
  it('keeps the class name the coach smokes wait on, and the portal sheet borrows it', () => {
    // The coach UAT smokes wait on `[class*="loadingState"]`; the portal's hand-written lines use the
    // coach sheet's own class, which must stay a borrow of this one, never a fifth copy.
    const css = stripComments(readSource('components/shared/LoadingState.module.css'));
    assert.match(css, /^\.loadingState \{/m);
    assert.match(css, /^\.loadingState::before \{/m);
    assert.match(css, /^\.loadingStateInline \{/m);
    const coach = stripComments(readSource('app/[orgSlug]/coaches/coaches.module.css'));
    assert.match(coach, /\.loadingState \{ composes: loadingState from '[^']*components\/shared\/LoadingState\.module\.css'; \}/);
    assert.match(coach, /\.loadingStateInline \{ composes: loadingStateInline from '[^']*components\/shared\/LoadingState\.module\.css'; \}/);
  });

  it('announces itself and is drawn by the club kit\'s page wait', () => {
    assert.match(readSource('components/shared/LoadingState.tsx'), /role="status"/);
    assert.match(stripComments(readSource('components/admin/kit/club/RepKit.tsx')),
      /export function PageLoading\(\{ header, label \}: \{ header: ReactNode; label: string \}\) \{\n\s*return <div className=\{styles\.page\}>\{header\}<LoadingState label=\{label\} \/><\/div>;/);
  });
});
