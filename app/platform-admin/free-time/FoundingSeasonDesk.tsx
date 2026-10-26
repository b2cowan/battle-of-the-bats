'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import ExportMenu from '@/components/admin/ExportMenu';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
} from '@/lib/export';
import { fmtAbsoluteDate, fmtSince } from '@/lib/format-date';
import { daysLeft, formatShortDay, lastDayOfInstant } from '@/lib/free-time';
import { pluralize } from '@/lib/utils';
// One definition of how a saved card reads, shared with the account's own billing page — the two
// surfaces that show a customer's card must never describe it differently.
import { formatCardOnFile } from '@/lib/billing-format';
import type { FoundingAccountRow } from '@/lib/founding-season-desk';
import kit from '../console.module.css';
import styles from './founding-season.module.css';

// ── Export ────────────────────────────────────────────────────────────────────
// Mirrors the columns on screen, in the same order, and respects the filters —
// what the operator exported must be what they were looking at.
const DESK_EXPORT_COLS: ExportColumnDef[] = [
  { label: 'Account',          key: 'name',                 format: 'text' },
  { label: 'Slug',             key: 'slug',                 format: 'text' },
  { label: 'Kind',             key: 'kindLabel',            format: 'text' },
  { label: 'Plan',             key: 'planLabel',            format: 'text' },
  { label: 'Free through',     key: 'freeThroughLabel',     format: 'text' },
  { label: 'Card on file',     key: 'cardLabel',            format: 'text' },
  { label: 'Card saved',       key: 'cardSavedLabel',       format: 'text' },
  { label: 'Next season plan', key: 'nextSeasonLabel',      format: 'text' },
  { label: 'Chosen',           key: 'nextSeasonChosenLabel', format: 'text' },
  { label: 'Owner last seen',  key: 'ownerLastSeenLabel',   format: 'text' },
  { label: 'Used it for',      key: 'usageLabel',           format: 'text' },
  { label: 'Billing contact',  key: 'billingContact',       format: 'text' },
];

type Totals = {
  accounts: number; organizations: number; coachesPortals: number; noCard: number; noChoice: number;
};

type Props = {
  rows: FoundingAccountRow[];
  totals: Totals;
  freeSeasonEndsLabel: string;
  nextYearLabel: string;
  freeSeasonEndsIso: string;
  cardWindowOpen: boolean;
  /** A Founding account that also has staff free time running, by org id: "Club free through Apr 30, 2027". */
  staffFreeTime?: Record<string, string>;
};

const KIND_LABEL: Record<FoundingAccountRow['kind'], string> = {
  organization: 'Organization',
  coaches_portal: 'Coaches Portal',
};

function cardLabelFor(row: FoundingAccountRow): string | null {
  if (!row.cardOnFileAt) return null;
  return formatCardOnFile({ brand: row.cardBrand, last4: row.cardLast4 });
}

function nextSeasonLabelFor(row: FoundingAccountRow): string | null {
  if (!row.nextSeasonPlanLabel) return null;
  return row.nextSeasonBillingCycle
    ? `${row.nextSeasonPlanLabel} · ${row.nextSeasonBillingCycle}`
    : row.nextSeasonPlanLabel;
}

/**
 * The Founding Season view of the Free time list (Support console Stage 4; it was the Founding season desk, and keeps
 * that desk's whole job: its band, its summer note, and its card, 2028-choice and owner-last-seen columns). Read only.
 * The end reads as the LAST free day ("Sep 30, 2027", owner ruling Q8), never the instant after it.
 */
export default function FoundingSeasonDesk({
  rows, totals, freeSeasonEndsLabel, nextYearLabel, freeSeasonEndsIso, cardWindowOpen, staffFreeTime,
}: Props) {
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [noCardOnly, setNoCardOnly] = useState(false);
  const [noChoiceOnly, setNoChoiceOnly] = useState(false);

  const filtered = useMemo(() => rows.filter(row => {
    if (noCardOnly && row.cardOnFileAt) return false;
    if (noChoiceOnly && row.nextSeasonPlanId) return false;
    if (kindFilter && row.kind !== kindFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const haystack = `${row.name} ${row.slug} ${row.billingContact ?? ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  }), [rows, search, kindFilter, noCardOnly, noChoiceOnly]);

  const anyFilter = Boolean(search || kindFilter || noCardOnly || noChoiceOnly);
  const foundingDaysLeft = daysLeft(lastDayOfInstant(freeSeasonEndsIso));

  function buildExportRows() {
    return filtered.map(row => ({
      name: row.name,
      slug: row.slug,
      kindLabel: KIND_LABEL[row.kind],
      planLabel: row.planLabel,
      freeThroughLabel: `${formatShortDay(lastDayOfInstant(row.freeThrough))}${row.isLegacyExpiry ? ' (legacy)' : ''}`,
      cardLabel: cardLabelFor(row) ?? 'None',
      cardSavedLabel: row.cardOnFileAt ? fmtAbsoluteDate(row.cardOnFileAt) : '',
      nextSeasonLabel: nextSeasonLabelFor(row) ?? 'None',
      nextSeasonChosenLabel: row.nextSeasonChosenAt ? fmtAbsoluteDate(row.nextSeasonChosenAt) : '',
      ownerLastSeenLabel: row.ownerLastSeenAt ? fmtAbsoluteDate(row.ownerLastSeenAt) : 'Never',
      usageLabel: row.usageLabel,
      billingContact: row.billingContact ?? '',
    }));
  }

  function handleExportXLSX() {
    const headers = serializeHeaders(DESK_EXPORT_COLS);
    const data = serializeRows(buildExportRows(), DESK_EXPORT_COLS);
    downloadXLSX(buildFilename({ dataset: 'founding-season' }, 'xlsx'), headers, data, 'Founding Season');
  }

  function handleExportCSV() {
    const headers = serializeHeaders(DESK_EXPORT_COLS);
    const data = serializeRows(buildExportRows(), DESK_EXPORT_COLS);
    downloadCSVBlob(buildFilename({ dataset: 'founding-season' }, 'csv'), generateCSV(headers, data));
  }

  return (
    <div className={kit.page}>
      <section className={kit.band} aria-label="Founding season snapshot">
        <div className={`${kit.bandCell} ${kit.bandGood}`}>
          <span className={kit.bandLabel}>Founding accounts</span>
          <strong className={kit.bandValue}>{totals.accounts}</strong>
          <span className={kit.bandNote}>
            {pluralize(totals.organizations, 'org')} · {pluralize(totals.coachesPortals, 'portal')}
          </span>
        </div>
        <div className={`${kit.bandCell} ${totals.noCard > 0 ? kit.bandWarn : ''}`}>
          <span className={kit.bandLabel}>No card yet</span>
          <strong className={kit.bandValue}>{totals.noCard}</strong>
          <span className={kit.bandNote}>
            {totals.accounts > 0 ? `${Math.round((totals.noCard / totals.accounts) * 100)}%` : '—'}
          </span>
        </div>
        <div className={`${kit.bandCell} ${totals.noChoice > 0 ? kit.bandWarn : ''}`}>
          <span className={kit.bandLabel}>No {nextYearLabel} choice yet</span>
          <strong className={kit.bandValue}>{totals.noChoice}</strong>
          <span className={kit.bandNote}>
            {totals.accounts > 0 ? `${Math.round((totals.noChoice / totals.accounts) * 100)}%` : '—'}
          </span>
        </div>
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>Free through</span>
          <strong className={`${kit.bandValue} ${kit.bandValueSm}`}>{freeSeasonEndsLabel}</strong>
          {/* Clock-dependent, so it is read on the CLIENT — a server render would bake in the day
              the page was built. Same rule the console's other freshness figures follow. */}
          {/* Counted to the LAST free day, as the club record's Free time row counts it (Support console Stage 4). */}
          <span className={kit.bandNote}>{foundingDaysLeft >= 0 ? `${foundingDaysLeft} day${foundingDaysLeft === 1 ? '' : 's'} left` : 'ended'}</span>
        </div>
      </section>

      {!cardWindowOpen && (
        <div className={kit.callout}>
          <span>
            <strong>The summer ask has not opened yet.</strong>{' '}
            {`Founding accounts are not asked for a card or a ${nextYearLabel} plan until the card window opens. Until then this desk is a record of who is on the free season and what they are doing with it — the "no card yet" and "no choice yet" columns will fill in over the summer.`}
          </span>
        </div>
      )}

      <div className={kit.card}>
        <div className={kit.toolbar}>
          <span className={kit.count}>
            {anyFilter
              ? `${filtered.length} of ${totals.accounts} accounts`
              : `${pluralize(totals.accounts, 'account')} · free through ${freeSeasonEndsLabel}`}
          </span>
          <span className={kit.toolbarEnd}>
            <ExportMenu
              formats={['xlsx', 'csv']}
              onExportXLSX={handleExportXLSX}
              onExportCSV={handleExportCSV}
              disabled={filtered.length === 0}
            />
          </span>
        </div>
        <div className={kit.toolbar}>
          <input
            type="search"
            className={`${kit.search} ${styles.toolSearch}`}
            placeholder="Search account or billing contact…"
            aria-label="Search accounts"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className={kit.select}
            aria-label="Account kind"
            value={kindFilter}
            onChange={e => setKindFilter(e.target.value)}
          >
            <option value="">All kinds</option>
            <option value="organization">Organizations</option>
            <option value="coaches_portal">Coaches Portals</option>
          </select>
          <label className={kit.check}>
            <input
              type="checkbox"
              checked={noCardOnly}
              onChange={e => setNoCardOnly(e.target.checked)}
            />
            {' '}
            No card yet
          </label>
          <label className={kit.check}>
            <input
              type="checkbox"
              checked={noChoiceOnly}
              onChange={e => setNoChoiceOnly(e.target.checked)}
            />
            {' '}
            No {nextYearLabel} choice
          </label>
          {anyFilter && (
            <button
              type="button"
              className={kit.door}
              onClick={() => { setSearch(''); setKindFilter(''); setNoCardOnly(false); setNoChoiceOnly(false); }}
            >
              Clear filters
            </button>
          )}
        </div>

      {filtered.length === 0 ? (
        <div className={kit.empty}>
          <strong>{rows.length === 0 ? 'No founding accounts.' : 'Nothing matches these filters.'}</strong>{' '}
          {rows.length === 0
            ? 'No account currently holds a Founding Season comp. Accounts appear here as they sign up during the offer window.'
            : 'Clear the filters to see every founding account.'}
        </div>
      ) : (
        <div className={`${kit.tableWrap} table-cards`}>
          <table className={`${kit.comfortable} ${styles.table}`}>
            <thead>
              <tr>
                <th>Account</th>
                <th>Kind</th>
                <th>Free on</th>
                <th>Free through</th>
                <th>Card on file</th>
                <th>{nextYearLabel} choice</th>
                <th>Owner last seen</th>
                <th>Used it for</th>
                <th>Billing contact</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const card = cardLabelFor(row);
                return (
                  <tr key={row.orgId}>
                    {/* The lead cell is the card's title on a phone and takes no label. */}
                    <td className="table-cards-title">
                      <Link href={`/platform-admin/orgs/${row.orgId}?tab=access`} className={kit.nameLink}>
                        {row.name}
                      </Link>
                      <span className={`${kit.sub} ${kit.code}`}>{row.slug}</span>
                    </td>
                    <td data-label="Kind">
                      <span className={`${kit.chip} ${row.kind === 'coaches_portal' ? kit.chipInfo : kit.chipQuiet}`}>
                        {KIND_LABEL[row.kind]}
                      </span>
                    </td>
                    <td data-label="Free on">
                      <span className={kit.muted}>{row.planLabel}</span>
                      {/* A club marked Founding but on the free plan holds the mark without Tournament Plus: a row to heal at
                          the Founding turn-off decision, shown, never acted on here. */}
                      {row.kind === 'organization' && row.planId === 'tournament' && (
                        <span className={`${kit.sub} ${styles.flagLine}`}>Marked Founding, on the free plan</span>
                      )}
                      {staffFreeTime?.[row.orgId] && <span className={kit.sub}>{staffFreeTime[row.orgId]}</span>}
                    </td>
                    <td data-label="Free through">
                      {formatShortDay(lastDayOfInstant(row.freeThrough))}
                      {/* ⚠ A row migration 279 never reached still carries the pre-2026-09-07
                          instant. Recognition tolerates it — the account IS in the cohort — but
                          this desk is the only surface anyone would ever notice it on. */}
                      {row.isLegacyExpiry && (
                        <span
                          className={`${kit.chip} ${kit.chipWarn} ${styles.legacy}`}
                          title="This comp still sits on the pre-2026-09-07 instant — the backfill has not reached this row. The account is still recognised as founding."
                        >
                          Legacy
                        </span>
                      )}
                    </td>
                    <td data-label="Card on file">
                      {card
                        ? <><span className={styles.yes}>{card}</span><span className={kit.sub}>{fmtAbsoluteDate(row.cardOnFileAt)}</span></>
                        : <span className={kit.muted}>—</span>}
                    </td>
                    <td data-label={`${nextYearLabel} choice`}>
                      {row.nextSeasonPlanId
                        ? <><span>{row.nextSeasonPlanLabel}</span><span className={kit.sub}>{row.nextSeasonBillingCycle} · {fmtAbsoluteDate(row.nextSeasonChosenAt)}</span></>
                        : <span className={kit.muted}>—</span>}
                    </td>
                    {/* NOT a page-view metric — the product keeps none. This is the most recent
                        sign-in across the account's owners, named for what it is. */}
                    <td data-label="Owner last seen" className={kit.muted}>{fmtSince(row.ownerLastSeenAt, 'Never')}</td>
                    <td data-label="Used it for" className={`${kit.muted} ${styles.wrap}`}>{row.usageLabel}</td>
                    <td data-label="Billing contact" className={`${kit.muted} ${styles.wrap}`}>{row.billingContact ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>

      <p className={kit.caption}>
        Card on file is recorded in the app when Stripe confirms it — this list never calls Stripe.
        {noCardOnly && ' These are the same accounts the "no card yet" reminder audience reaches, minus anyone who has opted out.'}
      </p>
    </div>
  );
}
