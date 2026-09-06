import { EXPORT_CATALOG, type ExportCatalogEntry } from '@/lib/export';

/**
 * WHAT YOU CAN EXPORT — generated from the registry, never typed out.
 *
 * ⚠⚠ THIS REPLACED A HAND-WRITTEN TABLE, and the reason is the whole point. The help guide carried
 * a twenty-five-row availability table maintained by hand, listing which pages export and on which
 * plan. It is the single most drift-prone thing in the help system: every new export, every plan
 * change and every renamed screen silently made it wronger, and nobody would find out from the
 * guide — they would find out from a customer.
 *
 * The registry behind this is now proven against the code on every build (`check:export-catalog`),
 * so this table cannot claim an export the product does not have, or miss one it does.
 *
 * ⚠ PLATFORM-ONLY SURFACES ARE FILTERED OUT. Half a dozen entries describe internal operator
 * exports — the feedback queue, the observability issues list. A customer reading their own help
 * guide should not be shown a door that is not theirs.
 *
 * ⚠ THE ROUND-TRIP COLUMN IS NOT DECORATION HERE EITHER. "Can I edit this and put it back?" is a
 * question customers actually ask, and the honest answer has three values, not two — the third
 * being the file whose columns happen to line up with an importer without being designed to.
 * Saying "no" there would be a lie by simplification.
 */

const MODULE_LABEL: Record<ExportCatalogEntry['module'], string> = {
  tournaments: 'Tournaments',
  house_league: 'House League',
  rep_teams: 'Rep Teams',
  coaches: 'Coaches',
  accounting: 'Accounting',
  org: 'Organization',
  platform_admin: 'Platform',
};

const PLAN_LABEL: Record<string, string> = {
  tournament: 'Tournament',
  tournament_plus: 'Tournament Plus',
  league: 'League',
  club: 'Club',
};

/** The order a customer thinks about the product in — not the order entries were added. */
const ORDER: ExportCatalogEntry['module'][] = [
  'tournaments', 'house_league', 'rep_teams', 'coaches', 'accounting', 'org',
];

export default function ExportAvailabilityTable() {
  const rows = ORDER.flatMap(module =>
    EXPORT_CATALOG
      .filter(e => e.module === module && !e.omittedReason && !e.plannedPhase)
      .map(e => ({ ...e, moduleLabel: MODULE_LABEL[module] })));

  const has = (e: ExportCatalogEntry, f: string) => (e.formats as readonly string[]).includes(f) ? '✓' : '—';

  return (
    <table>
      <thead>
        <tr>
          <th>Module</th>
          <th>Page</th>
          <th>Excel</th>
          <th>CSV</th>
          <th>Calendar</th>
          <th>PDF</th>
          <th>Plan required</th>
          <th>Can you edit it and put it back?</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(e => (
          <tr key={e.id}>
            <td><strong>{e.moduleLabel}</strong></td>
            <td>{e.page}</td>
            <td>{has(e, 'xlsx')}</td>
            <td>{has(e, 'csv')}</td>
            <td>{has(e, 'ics')}</td>
            <td>{has(e, 'pdf')}</td>
            <td>{e.minPlan ? PLAN_LABEL[e.minPlan] ?? e.minPlan : 'Any plan'}</td>
            <td>
              {e.roundTrip
                ? 'Yes — import it back'
                : e.roundTripCaveat
                  ? 'Not designed for it'
                  : 'No — one way'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
