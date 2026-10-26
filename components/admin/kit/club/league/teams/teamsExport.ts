/**
 * TEAMS & DRAFT'S FILE (Club Tier Stage 9c, Part 3; copy §1.5): the division's players with their team and coaches, one
 * row a player, in the house's Excel format. A Rating column only for the people who run the league — the registrar's
 * file has none (9c·2a; the board read gives them no rating to write). No contact details: a team list gets printed.
 */
import { buildFilename, downloadXLSX, serializeHeaders, serializeRows, type ExportColumnDef } from '@/lib/export';
import type { DivisionBoard } from './api';

const BASE_COLS: ExportColumnDef[] = [
  { label: 'Player',   key: 'player',   format: 'text' },
  { label: 'Age',      key: 'age',      format: 'text' },
  { label: 'Division', key: 'division', format: 'text' },
  { label: 'Team',     key: 'team',     format: 'text' },
  { label: 'Coach',    key: 'coach',    format: 'text' },
];
const RATING_COL: ExportColumnDef = { label: 'Rating', key: 'rating', format: 'text' };

export async function exportTeamsXlsx(
  board: DivisionBoard, ratings: ReadonlyMap<string, number>, withRatings: boolean, orgSlug: string | undefined,
) {
  if (board.players.length === 0) return;
  const cols = withRatings ? [...BASE_COLS, RATING_COL] : BASE_COLS;
  const team = (id: string | null) => board.teams.find(t => t.id === id);
  const rows = [...board.players]
    .sort((a, b) => (team(a.teamId)?.name ?? '~').localeCompare(team(b.teamId)?.name ?? '~') || a.lastName.localeCompare(b.lastName))
    .map(p => ({
      player: `${p.firstName} ${p.lastName}`,
      age: p.age == null ? '' : String(p.age),
      division: board.division.name,
      team: team(p.teamId)?.name ?? 'Not on a team',
      coach: team(p.teamId)?.coaches.map(c => c.name).join(', ') ?? '',
      ...(withRatings ? { rating: ratings.has(p.id) ? String(ratings.get(p.id)) : '' } : {}),
    }));
  await downloadXLSX(
    buildFilename({ org: orgSlug, dataset: 'teams', scope: board.division.name }, 'xlsx'),
    serializeHeaders(cols), serializeRows(rows, cols), 'Teams',
  );
}
