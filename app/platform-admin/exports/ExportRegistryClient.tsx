'use client';
import { useMemo, useState } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import type { ExportCatalogEntry } from '@/lib/export';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import kit from '../console.module.css';
import styles from './exports.module.css';

/** The module names a person uses, in the order the product is usually talked about. */
const MODULES: { id: ExportCatalogEntry['module']; label: string }[] = [
  { id: 'tournaments',    label: 'Tournaments' },
  { id: 'house_league',   label: 'House league' },
  { id: 'rep_teams',      label: 'Rep teams' },
  { id: 'coaches',        label: 'Coaches' },
  { id: 'accounting',     label: 'Accounting' },
  { id: 'families',       label: 'Families' },
  { id: 'org',            label: 'Org' },
  { id: 'platform_admin', label: 'Platform' },
];

const AUDIENCE_LABEL: Record<string, string> = {
  org_admin: 'Org admin',
  coach: 'Coach',
  treasurer: 'Treasurer',
  platform_admin: 'Platform',
  public: 'Public',
};

/** Plans in the words the pricing page uses — never a raw key, which is what a reader would then
 *  have to translate before they could answer anybody. */
const PLAN_LABEL: Record<string, string> = {
  tournament: 'Tournament',
  tournament_plus: 'Tournament Plus',
  league: 'League',
  club: 'Club',
};

export default function ExportRegistryClient({ entries }: { entries: readonly ExportCatalogEntry[] }) {
  const [query, setQuery] = useState('');
  const [module, setModule] = useState<ExportCatalogEntry['module'] | 'all'>('all');
  /* One toggle rather than a third filter row: "show me only the ones we can read back" is the
     question this page answers that nothing else can. */
  const [tripsOnly, setTripsOnly] = useState(false);

  const counts = useMemo(() => ({
    total: entries.length,
    live: entries.filter(e => !e.omittedReason && !e.plannedPhase).length,
    none: entries.filter(e => e.omittedReason || e.plannedPhase).length,
    trips: entries.filter(e => e.roundTrip).length,
    gated: entries.filter(e => e.minPlan).length,
  }), [entries]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter(e => {
      if (module !== 'all' && e.module !== module) return false;
      if (tripsOnly && !e.roundTrip) return false;
      if (!q) return true;
      return [e.label, e.page, e.file, e.helpSummary, e.module, ...e.formats]
        .join(' ').toLowerCase().includes(q);
    });
  }, [entries, query, module, tripsOnly]);

  /* Grouped for reading, in the module order above — a flat list of thirty-odd rows is a wall,
     and the module is how anybody looking for one of these thinks about where it lives. */
  const grouped = useMemo(() => MODULES
    .map(m => ({ ...m, rows: shown.filter(e => e.module === m.id) }))
    .filter(g => g.rows.length > 0), [shown]);

  return (
    <div className={kit.page}>
      <AdminPageHeader title="Export registry" />

      <p className={kit.caption}>
        Every way data leaves FieldLogicHQ — what it is, who can take it, which plan it needs, and
        whether the product can read it back. Generated from the code and proven against it on
        every build.
      </p>

      <section className={kit.band} aria-label="Export registry totals">
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>Export surfaces</span>
          <strong className={kit.bandValue}>{counts.total}</strong>
        </div>
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>Live today</span>
          <strong className={kit.bandValue}>{counts.live}</strong>
        </div>
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>Deliberately none</span>
          <strong className={kit.bandValue}>{counts.none}</strong>
        </div>
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>Round trips</span>
          <strong className={kit.bandValue}>{counts.trips}</strong>
        </div>
        <div className={`${kit.bandCell} ${counts.gated > 0 ? kit.bandWarn : ''}`}>
          <span className={kit.bandLabel}>Plan-gated</span>
          <strong className={kit.bandValue}>{counts.gated}</strong>
        </div>
      </section>

      <div className={kit.card}>
        <div className={kit.toolbar}>
          <input
            type="search"
            className={`${kit.search} ${styles.searchField}`}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search a surface, module or format…"
            aria-label="Search exports"
          />
          <select
            className={kit.select}
            aria-label="Module"
            value={module}
            onChange={e => setModule(e.target.value as ExportCatalogEntry['module'] | 'all')}
          >
            <option value="all">All modules</option>
            {MODULES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <label className={kit.check}>
            <input type="checkbox" checked={tripsOnly} onChange={e => setTripsOnly(e.target.checked)} />
            Round trips
          </label>
        </div>

        {shown.length === 0 ? (
          <p className={kit.empty}>No export matches that. Try a different word, or clear the filters.</p>
        ) : (
          <div className={kit.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Surface</th><th>Who</th><th>Formats</th><th>Plan</th>
                  <th>Round trip</th><th>State</th>
                </tr>
              </thead>
              <tbody className={kit.comfortable}>
                {grouped.map(group => (
                  <ExportGroup key={group.id} label={group.label} rows={group.rows} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className={styles.legend}>
        <span><RefreshCw size={11} aria-hidden className={styles.tripInk} /> the product reads this file back</span>
        <span><AlertTriangle size={11} aria-hidden className={styles.warnInk} /> some columns match an importer by luck, not by design</span>
        <span>— one-way</span>
      </p>

      <p className={kit.caption}>
        Showing {shown.length} of {entries.length}. A screen cannot gain an export without gaining a
        row here — the build refuses it.
      </p>
    </div>
  );
}

function ExportGroup({ label, rows }: { label: string; rows: ExportCatalogEntry[] }) {
  return (
    <>
      <tr className={styles.modRow}><td colSpan={6}>{label}</td></tr>
      {rows.map(e => <ExportRow key={e.id} entry={e} />)}
    </>
  );
}

function ExportRow({ entry: e }: { entry: ExportCatalogEntry }) {
  const absent = e.omittedReason ?? e.plannedPhase;
  return (
    <>
    <tr>
      <td>
        <span className={styles.surface}>{e.label}</span>
        <span className={kit.sub}>{e.page}</span>
      </td>
      <td>{e.audiences.map(a => AUDIENCE_LABEL[a] ?? a).join(' · ')}</td>
      <td>
        <span className={styles.fmts}>
          {e.formats.map(f => (
            <span key={f} className={`${kit.chip} ${f === 'pdf' ? kit.chipWarn : ''}`}>
              {f.toUpperCase()}
            </span>
          ))}
        </span>
      </td>
      <td className={`${kit.nowrap} ${e.minPlan ? styles.planGated : kit.muted}`}>
        {e.minPlan ? PLAN_LABEL[e.minPlan] ?? e.minPlan : 'No plan gate'}
      </td>
      <td>
        {/* Three states, and the middle one is the reason this column is worth a page. A file that
            LOOKS re-importable is more dangerous than one that plainly is not. */}
        {e.roundTrip ? (
          <span className={`${kit.chip} ${kit.chipInfo}`}>
            <RefreshCw size={11} aria-hidden /> Yes
          </span>
        ) : e.roundTripCaveat ? (
          <span className={`${kit.chip} ${kit.chipWarn}`} title={e.roundTripCaveat}>
            <AlertTriangle size={11} aria-hidden /> By coincidence
          </span>
        ) : (
          <span className={kit.muted}>—</span>
        )}
      </td>
      <td>
        {absent
          ? <>
              <span className={`${kit.chip} ${kit.chipQuiet}`}>Deliberately none</span>
              <span className={styles.reason}>{absent}</span>
            </>
          : <span className={`${kit.chip} ${kit.chipOk}`}>Live</span>}
      </td>
    </tr>
    {/* ⚠ THE CAVEAT IS WRITTEN OUT, NOT LEFT IN A TOOLTIP. It is the whole reason the "by
        coincidence" state exists — a file that LOOKS re-importable is more dangerous than one
        that plainly is not — and a `title` attribute is unreachable on a phone and to anyone
        who never hovers. It stays on the row too, for a pointer. */}
    {e.roundTripCaveat && (
      <tr className={styles.caveatRow}>
        <td colSpan={6}>
          <AlertTriangle size={11} aria-hidden /> {e.roundTripCaveat}
        </td>
      </tr>
    )}
    </>
  );
}
