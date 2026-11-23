/**
 * A PLACE'S NAME, as the Sponsors tab and its "Shows on" pick list say it (Board Ready Stage 6, Part 1; round 1 tab 8):
 * "The club", "U9 division", "U11 Lions", "Spring Classic 2027". A place whose division, team or tournament has gone is
 * deleted with it (mig 525's triggers), so a missing name is only ever a moment's race — said as the kind.
 */
import type { SponsorPlace, SponsorPlaceKind } from '@/lib/club-sponsorships';
import type { PlaceTargets } from './api';

export function placeName(p: Pick<SponsorPlace, 'kind' | 'targetId'>, t: PlaceTargets): string {
  if (p.kind === 'club') return 'The club';
  if (p.kind === 'division') {
    const d = t.divisions.find(x => x.id === p.targetId);
    return d ? `${d.name} division` : 'A division';
  }
  if (p.kind === 'team') return t.teams.find(x => x.id === p.targetId)?.name ?? 'A team';
  return t.tournaments.find(x => x.id === p.targetId)?.name ?? 'A tournament';
}

/** The pick list's value for a place: `club`, or `division:{id}` and so on. */
export const placeKey = (p: { kind: SponsorPlaceKind; targetId: string | null }) => (p.kind === 'club' ? 'club' : `${p.kind}:${p.targetId}`);
export function placeFromKey(key: string): { kind: SponsorPlaceKind; targetId: string | null } {
  if (key === 'club') return { kind: 'club', targetId: null };
  const [kind, targetId] = key.split(':') as [SponsorPlaceKind, string];
  return { kind, targetId };
}

/**
 * The pick list: the club, then the live divisions, teams and tournaments (a finished season's stay only on a place that
 * has one). Each is a NAME and a SUB-LINE — the portal's two-line dropdown (`SublinedChoice`) draws the name bold with the
 * season (and division) quiet beneath it, where a native select had to run them together in one string.
 */
export function placeOptions(t: PlaceTargets, keep: readonly string[] = []) {
  const keepSet = new Set(keep);
  const ok = <T extends { id: string; live: boolean }>(kind: SponsorPlaceKind, list: T[]) => list.filter(x => x.live || keepSet.has(`${kind}:${x.id}`));
  return {
    divisions: ok('division', t.divisions).map(d => ({ key: `division:${d.id}`, name: `${d.name} division`, sub: d.seasonName })),
    teams: ok('team', t.teams).map(x => ({ key: `team:${x.id}`, name: x.name, sub: `${x.divisionName} · ${x.seasonName}` })),
    tournaments: ok('tournament', t.tournaments).map(x => ({ key: `tournament:${x.id}`, name: x.name, sub: '' })),
  };
}
