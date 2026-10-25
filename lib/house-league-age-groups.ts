import { checkBornYears, type BornYears, type Cutoff } from './born-years';

/**
 * ADD AGE GROUPS, THE WINDOW'S RULES (Club Tier Stage 9b-1, Part 2; Q19; words HOUSE_LEAGUE_STAGE9B1_COPY.md §3). Pure and
 * client-safe; tested in tests/unit/house-league-age-groups.test.ts.
 */

/** One row in the window, as typed. */
export type AgeGroupRow = { key: string; group: string; name: string; from: string; to: string; capacity: string; price: string };

const norm = (v: string) => v.trim().toLowerCase();

/**
 * The name a newly tapped group gets. The first U10 is "U10"; tapping it again when the season (or the window) already
 * has one names the new division with the next letter — "U10 B", then "U10 C" — so a family picking between two divisions
 * for one age can tell them apart (9b·13). A bare "U10" counts as A.
 */
export function nextGroupName(group: string, taken: readonly string[]): string {
  const g = group.trim();
  const used = new Set<string>();
  for (const name of taken) {
    const n = name.trim();
    if (norm(n) === norm(g)) used.add('A');
    const m = n.match(/^(.*)\s([A-Za-z])$/);
    if (m && norm(m[1]) === norm(g)) used.add(m[2].toUpperCase());
  }
  if (used.size === 0) return g;
  for (const letter of 'BCDEFGHIJKLMNOPQRSTUVWXYZ') if (!used.has(letter)) return `${g} ${letter}`;
  return g;
}

const isWhole = (v: string) => /^\d+$/.test(v.trim()) && parseInt(v, 10) >= 1;
const isMoney = (v: string) => {
  if (!v.trim()) return false;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
};

/** "U14", "U14 and U16", or (three or more) "3". */
function who(names: string[]): { label: string; many: boolean; counted: boolean } {
  if (names.length === 1) return { label: names[0], many: false, counted: false };
  if (names.length === 2) return { label: `${names[0]} and ${names[1]}`, many: true, counted: false };
  return { label: String(names.length), many: true, counted: true };
}

/**
 * The foot's sentence (copy §3.4): what the Add button will make, then the FIRST thing missing only — birth years, then
 * size, then price (a name left blank or used twice before all of them). `missing` null = ready to add.
 */
export function ageGroupsFoot(rows: readonly AgeGroupRow[], cutoff: Cutoff, thisYear: number, taken: readonly string[] = []):
  { missing: 'nothing' | 'name' | 'years' | 'size' | 'price' | null; desk: string; phone: string } {
  if (rows.length === 0) return { missing: 'nothing', desk: 'Tap the age groups you run.', phone: 'Tap the groups you run.' };
  const n = rows.length;
  const deskHead = n === 1 ? '1 new division' : `${n} new divisions`;
  const phoneHead = `${n} new`;
  const label = (r: AgeGroupRow) => r.name.trim() || r.group;

  const seen = new Set(taken.map(norm));
  let dupe: string | null = null;
  for (const r of rows) {
    if (!r.name.trim()) return { missing: 'name', desk: `${deskHead} · a division still needs a name`, phone: `${phoneHead} · a division needs a name` };
    if (seen.has(norm(r.name))) { dupe = r.name.trim(); break; }
    seen.add(norm(r.name));
  }
  if (dupe) {
    const line = `Two divisions are named ${dupe}. Rename one, for example ${dupe} A and ${dupe} B.`;
    return { missing: 'name', desk: `${deskHead} · ${line}`, phone: `${phoneHead} · ${line}` };
  }

  const years = rows.filter(r => !(r.from.trim() || r.to.trim()) || !checkBornYears(r.from, r.to, cutoff, thisYear).ok).map(label);
  if (years.length) {
    const w = who(years);
    return {
      missing: 'years',
      desk: `${deskHead} · ${w.label} still ${w.many ? 'need their' : 'needs its'} birth years`,
      phone: `${phoneHead} · ${w.label} still ${w.counted ? 'need birth years' : w.many ? 'need their birth years' : 'needs its birth years'}`,
    };
  }
  for (const [missing, test, word] of [['size', isWhole, 'a size'], ['price', isMoney, 'a price']] as const) {
    const left = rows.filter(r => !test(missing === 'size' ? r.capacity : r.price)).map(label);
    if (left.length) {
      const w = who(left);
      const tail = `${w.label} still ${w.many ? 'need' : 'needs'} ${word}`;
      return { missing, desk: `${deskHead} · ${tail}`, phone: `${phoneHead} · ${tail}` };
    }
  }
  return { missing: null, desk: deskHead, phone: phoneHead };
}

const span = (a: number, b: number) => (a === b ? String(a) : `${a}–${b}`);

/**
 * The amber warnings (copy §3.3), never blocking: a birth year between the lowest and highest covered that no division
 * takes (a gap), and two divisions whose years PARTLY overlap. Two with exactly the same years are the deliberate A and B
 * pair and say nothing. Only closed ranges count (an open side is "no limit", not a year).
 */
export function ageGroupsWarnings(
  rows: readonly AgeGroupRow[],
  existing: readonly { name: string; born: BornYears }[],
  cutoff: Cutoff,
  thisYear: number,
): string[] {
  const ranges: { name: string; from: number; to: number }[] = [];
  for (const e of existing) if (e.born.from != null && e.born.to != null) ranges.push({ name: e.name, from: e.born.from, to: e.born.to });
  for (const r of rows) {
    const c = checkBornYears(r.from, r.to, cutoff, thisYear);
    if (c.ok && c.years.from != null && c.years.to != null) ranges.push({ name: r.name.trim() || r.group, from: c.years.from, to: c.years.to });
  }
  if (ranges.length < 2) return [];
  const out: string[] = [];

  const lo = Math.min(...ranges.map(r => r.from)), hi = Math.max(...ranges.map(r => r.to));
  const holes: number[] = [];
  for (let y = lo; y <= hi; y++) if (!ranges.some(r => r.from <= y && y <= r.to)) holes.push(y);
  // Consecutive missing years read as one span.
  for (let i = 0; i < holes.length;) {
    let j = i;
    while (j + 1 < holes.length && holes[j + 1] === holes[j] + 1) j++;
    out.push(`No division takes children born in ${span(holes[i], holes[j])}. A child born then won’t fit any division.`);
    i = j + 1;
  }

  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const a = ranges[i], b = ranges[j];
      if (a.from === b.from && a.to === b.to) continue;
      const from = Math.max(a.from, b.from), to = Math.min(a.to, b.to);
      if (from <= to) out.push(`${a.name} and ${b.name} both take ${span(from, to)}. A child born then can choose either.`);
    }
  }
  return out;
}
