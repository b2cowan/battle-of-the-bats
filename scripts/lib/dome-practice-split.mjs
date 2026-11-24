/**
 * Who practises when, for the demo's dome schedule (the owner's split, 2026-11-24): Select teams get half the
 * practices a Rep team gets, the age groups share evenly inside each level, and no team is booked twice on a Sunday.
 *
 * A pure function so the split can be checked on its own. Each slot, in the order of the day (earliest time, then
 * field), goes to the team furthest behind its entitlement: practices so far ÷ its level's weight, then time on a
 * full-field-equivalent basis (so a team that has had the half fields gets a full field next), then a rotation that
 * moves week to week so no age group is always first in line.
 *
 * @param {{ days: string[], times: string[], fields: string[], halfFields?: string[],
 *           teams: { level: string, group?: string }[], levelWeights: Record<string, number> }} o
 * @returns {{ day: string, t: string, f: string, teamIdx: number | null }[]}
 */
export function splitDomeSlots({ days, times, fields, halfFields = [], teams, levelWeights }) {
  const half = new Set(halfFields);
  const weightOf = (f) => (half.has(f) ? 0.5 : 1);
  const entitlement = teams.map(t => {
    const w = levelWeights[t.level];
    if (!(w > 0)) throw new Error(`no practice weight for level "${t.level}"`);
    return w;
  });
  const groupNames = [...new Set(teams.map(t => t.group ?? ''))];
  const groupOf = teams.map(t => groupNames.indexOf(t.group ?? ''));
  const lg = teams.map(t => `${t.level}|${t.group ?? ''}`); // a level's age group: the unit that should come out even
  const groupCount = new Map(lg.map(k => [k, 0]));
  const before = (a, b) => { for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k] < b[k]; return false; };
  const count = teams.map(() => 0);
  const time = teams.map(() => 0);
  const out = [];
  days.forEach((day, w) => {
    const used = new Set();
    for (const t of times) {
      for (const f of fields) {
        let best = null;
        for (let i = 0; i < teams.length; i++) {
          if (used.has(i)) continue;
          // Ties: the age group (within its level) that has had the fewest practices, so the leftovers fall on different
          // age groups; then the group whose turn it is this week; then the team.
          const key = [count[i] / entitlement[i], time[i] / entitlement[i], groupCount.get(lg[i]),
            ((groupOf[i] + w) % groupNames.length) * teams.length + ((i + w * 7) % teams.length)];
          if (!best || before(key, best.key)) best = { i, key };
        }
        if (best) { used.add(best.i); count[best.i]++; time[best.i] += weightOf(f); groupCount.set(lg[best.i], groupCount.get(lg[best.i]) + 1); }
        out.push({ day, t, f, teamIdx: best ? best.i : null });
      }
    }
  });
  return out;
}
