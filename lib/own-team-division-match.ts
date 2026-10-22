import { sameKey } from './utils';

/**
 * Add our teams (Club Tier Stage 7b): "a division picks itself when its name matches the team's". The rep team's own division
 * word ("15U") is asked first; failing that, a division whose name stands as whole words inside the team's name ("15U" in
 * "15U AA", "U15 Girls" in "Lions U15 Girls AAA"). The longest such name wins; two of the same length, or none, pick nothing and
 * the field says "Choose a division". Never a guess beyond that: a wrong division is worse than an empty one.
 */
export function matchOwnTeamDivision(
  team: { name: string; division: string | null },
  divisions: ReadonlyArray<{ id: string; name: string }>,
): string | null {
  const own = sameKey(team.division);
  if (own) {
    const exact = divisions.filter(d => sameKey(d.name) === own);
    if (exact.length === 1) return exact[0].id;
  }
  const words = ` ${sameKey(team.name)} `;
  const inside = divisions
    .map(d => ({ id: d.id, key: sameKey(d.name) }))
    .filter(d => d.key && words.includes(` ${d.key} `));
  if (!inside.length) return null;
  const longest = Math.max(...inside.map(d => d.key.length));
  const best = inside.filter(d => d.key.length === longest);
  return best.length === 1 ? best[0].id : null;
}
