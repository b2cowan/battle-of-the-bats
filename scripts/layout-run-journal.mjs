/**
 * THE LAYOUT SWEEP'S RUN JOURNAL, AND THE ARITHMETIC OF ITS COST (Release process hardening, Stage 1A, 2026-11-15).
 *
 * Why this exists: a whole-product sweep on staging is under an hour when it is healthy, and it had not finished for
 * three releases because of HOW it failed — a low-memory stop on the PC threw away every finished screen, so the next
 * attempt started from zero. Each finished pair (one screen at one width) is now appended to a journal, and
 * `--resume` measures only what the journal does not hold.
 *
 * ⚠ A JOURNAL IS ONLY RESUMED BY THE RUN THAT WROTE IT. Its key is the commit, the target host, the theme, the sidebar
 * mode, the measuring code and the exact pair list (screen, width, address, ready mark). A journal from another commit,
 * host or list is refused, by name, rather than merged: findings from a different build or a different screen list
 * would be reported as this one's.
 *
 * ⚠ The functions here are PURE (no clock, no disk, no browser) so the decisions the sweep turns on are unit-tested
 * (`tests/unit/layout-run-journal.test.ts`). The sweep owns the disk and the browser.
 */
import { createHash } from 'node:crypto';

/** The fields a journal is keyed by, in the order a mismatch is reported. */
export const KEY_FIELDS = ['commit', 'host', 'theme', 'sidebar', 'probe', 'pairs'];

const sha = (s) => createHash('sha256').update(s).digest('hex');

/** A short, stable digest of any text (the measuring code's fingerprint, for one). */
export const digest = (s) => sha(String(s)).slice(0, 16);

/**
 * A stable digest of the pairs a run will visit. Order-independent (the same set selected with `--only=a,b` or
 * `--only=b,a` is the same run) but sensitive to anything that changes what a pair measures: its address and ready mark.
 * @param {{ label: string, url: string, ready: string }[]} pairs
 */
export function pairListHash(pairs) {
  const lines = pairs.map((p) => `${p.label}\t${p.url}\t${p.ready}`).sort();
  return sha(lines.join('\n')).slice(0, 16);
}

/** The journal's key: every field that must match for a resume to be honest. */
export function journalKey({ commit, host, theme, sidebar, probe, pairs }) {
  return { commit, host, theme: theme ?? 'default', sidebar: sidebar ?? 'full', probe, pairs };
}

/** A short id for the key, used in the journal's file name. */
export const keyId = (key) => sha(KEY_FIELDS.map((f) => `${f}=${key[f]}`).join('\n')).slice(0, 12);

/** The journal's file name for a key. Theme and sidebar are spelled out so a person can tell the files apart. */
export const journalFileName = (key) => `${key.theme}-${key.sidebar}-${keyId(key)}.jsonl`;

/**
 * Why a saved journal cannot be resumed by this run — one line per field that differs — or [] when it can.
 * @returns {string[]}
 */
export function keyMismatch(saved, wanted) {
  const names = { commit: 'commit', host: 'target', theme: 'theme', sidebar: 'sidebar', probe: 'measuring code', pairs: 'screen list' };
  return KEY_FIELDS.filter((f) => saved?.[f] !== wanted[f]).map((f) => `${names[f]}: journal has ${saved?.[f] ?? '(none)'}, this run is ${wanted[f]}`);
}

/**
 * Read a journal's text: its header (the first line) and the pairs it finished. A torn last line — the run was killed
 * mid-write — is dropped, never fatal: that pair is simply measured again.
 * @returns {{ header: object|null, done: Map<string, object> }}
 */
export function parseJournal(text) {
  const lines = String(text ?? '').split('\n').filter((l) => l.trim());
  let header = null;
  const done = new Map();
  for (const [i, line] of lines.entries()) {
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    if (i === 0 && row.kind === 'header') { header = row.key; continue; }
    if (row.kind === 'pair' && typeof row.label === 'string') done.set(row.label, row);
  }
  return { header, done };
}

/**
 * What a resumed run still has to measure. Each unit keeps its screens in their own order, minus the pairs the
 * journal holds; a unit with nothing left is dropped.
 * @template {{ list: { id: string }[], w: { name: string } }} U
 * @param {U[]} units
 * @param {Set<string>|Map<string, unknown>} done  pair labels already measured (`<screen> @<width>`)
 * @returns {U[]}
 */
export function selectRemaining(units, done) {
  return units
    .map((u) => ({ ...u, list: u.list.filter((s) => !done.has(pairLabel(s.id, u.w.name))) }))
    .filter((u) => u.list.length > 0);
}

/** The one spelling of a pair, shared by the progress log, the journal and the failure lists. */
export const pairLabel = (screenId, widthName) => `${screenId} @${widthName}`;

/**
 * The cost of a run, from each measured pair's time. p50/p95 are nearest-rank (no interpolation), so each is a time a
 * real pair took.
 * @param {{ label: string, ms: number }[]} pairs
 */
export function timingSummary(pairs) {
  const ms = pairs.map((p) => p.ms).sort((a, b) => a - b);
  const rank = (q) => (ms.length ? ms[Math.min(ms.length - 1, Math.ceil(q * ms.length) - 1)] : 0);
  return {
    pairs: ms.length,
    p50: rank(0.5),
    p95: rank(0.95),
    slowest: [...pairs].sort((a, b) => b.ms - a.ms).slice(0, 10),
  };
}

/**
 * The per-wait budget for a production build, from a healthy run's p95: about three times it, never under 20 s.
 * (The dev server keeps its own, generous budget: it compiles on first visit.)
 */
export const budgetFromP95 = (p95Ms) => Math.max(20_000, Math.round((p95Ms * 3) / 1000) * 1000);

/** "1 h 04 min", "12 min 30 s", "41 s" — the run's wall-clock as a person reads it. */
export function formatDuration(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, '0')} s`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}
