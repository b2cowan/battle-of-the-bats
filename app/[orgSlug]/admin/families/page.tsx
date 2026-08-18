'use client';

/**
 * The Families worklist — the area's landing (P2 chunk C).
 *
 * Built to the Phase 2 mockups (plan §5.3): a set of QUESTIONS with counts,
 * not an A–Z list. On thin data the loudest lens is "No family on file" —
 * children whose rows name nobody — and its rows are CHILDREN linking to the
 * surface where the fix already lives (one door per write). "Chased" is the
 * dues-reminder stamp, dues-only and honest about it; there is no "Last
 * contacted" column because nothing records what a family was sent.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Contact } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { usePageTitle } from '@/lib/usePageTitle';
// The ONE formatter for stored dates — a bare toLocaleDateString renders the
// READER's timezone and has printed wrong dates on three screens before.
import { formatStoredDate } from '@/lib/timezone';
import styles from './families.module.css';

interface ChildRow { source: string; sourceRowId: string; childName: string; where: string; year: number | null; current: boolean }
interface Family {
  personId: string; name: string; email: string; allEmails: string[]; phone: string | null;
  children: ChildRow[]; owingCents: number; chasedAt: string | null; leagueUnpaidCount: number;
  missingFormsCount: number; hasConsent: boolean; optedOut: boolean; notBack: boolean;
}
interface NoFamilyChild { source: string; childName: string; where: string; reason: string; fixHref: string }
interface Payload { families: Family[]; noFamilyChildren: NoFamilyChild[]; duplicatePairCount: number }

type Lens = 'all' | 'nofamily' | 'owes' | 'forms' | 'consent' | 'notback';

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// ONE definition per lens — the chip's count and the rows it shows must be the
// same predicate or the chip lies about its own list.
const LENS_PREDICATES: Record<Exclude<Lens, 'all' | 'nofamily'>, (f: Family) => boolean> = {
  owes: f => f.owingCents > 0 || f.leagueUnpaidCount > 0,
  forms: f => f.missingFormsCount > 0,
  consent: f => !f.hasConsent && f.children.some(c => c.current),
  notback: f => f.notBack,
};

export default function FamiliesWorklistPage() {
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  usePageTitle('Families');
  const base = `/${currentOrg?.slug ?? ''}/admin`;
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';

  const canUse = !loading && !!currentOrg && !!userRole
    && hasCapability(userRole, userCapabilities, 'module_families')
    && hasModuleEntitlement(currentOrg, 'module_families');

  const [data, setData] = useState<Payload | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [lens, setLens] = useState<Lens | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!canUse || !currentOrg) return;
    // Stale guard: this screen is guardian PII — a slow response from a
    // previous org must never paint under the next org's header (the same
    // isStale discipline the coach hubs learned the hard way).
    let stale = false;
    setData(null); setLens(null); setFetchError(false);
    fetch(`/api/admin/families${orgQuery}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: Payload) => {
        if (stale) return;
        setData(d);
        // The landing lens is the day's honest headline: data repair first.
        setLens(current => current ?? (d.noFamilyChildren.length > 0 ? 'nofamily' : d.families.some(LENS_PREDICATES.owes) ? 'owes' : 'all'));
      })
      .catch(() => { if (!stale) setFetchError(true); });
    return () => { stale = true; };
  }, [canUse, currentOrg, orgQuery]);

  if (loading || !userRole || !currentOrg) {
    return <div className="flex items-center justify-center h-64"><span className="hud-label">Loading...</span></div>;
  }

  if (!canUse) {
    // Reveals nothing: no counts, no names, no hint of any family's existence.
    return (
      <div className={styles.page}>
        <div className={styles.empty} style={{ marginTop: '3rem' }}>
          <h2 className={styles.emptyTitle}>This area needs the Families permission</h2>
          <p className={styles.emptyBody}>
            Families concentrates every household&rsquo;s contact details, consent and balances,
            so it is off for every role until deliberately granted. An owner can grant it from
            Organization Admin → Members → Manage member → Module access.
          </p>
        </div>
      </div>
    );
  }

  const families = data?.families ?? [];
  const noFamily = data?.noFamilyChildren ?? [];
  const q = query.trim().toLowerCase();
  const searched = q
    ? families.filter(f =>
        f.name.toLowerCase().includes(q)
        || f.allEmails.some(e => e.includes(q))
        || (f.phone ?? '').replace(/\D/g, '').includes(q.replace(/\D/g, '')) && q.replace(/\D/g, '').length >= 4
        || f.children.some(c => c.childName.toLowerCase().includes(q)))
    : null;

  const counts = {
    owes: families.filter(LENS_PREDICATES.owes).length,
    forms: families.filter(LENS_PREDICATES.forms).length,
    consent: families.filter(LENS_PREDICATES.consent).length,
    notback: families.filter(LENS_PREDICATES.notback).length,
  };

  const lensRows: Family[] =
    searched ??
    (lens && lens !== 'all' && lens !== 'nofamily'
      ? families.filter(LENS_PREDICATES[lens])
      : families);

  const chip = (key: Lens, label: string, count: number) => (
    <button
      key={key}
      className={`${styles.chip} ${lens === key && !q ? styles.chipOn : ''} ${count === 0 ? styles.chipZero : ''}`}
      onClick={() => { setQuery(''); setLens(key); }}
    >
      {label} · {count}
    </button>
  );

  const showNoFamilyTable = !q && lens === 'nofamily';

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerIcon}><Contact size={20} /></div>
        <div>
          <h1 className={styles.pageTitle}>Families</h1>
          <p className={styles.pageSub}>
            {families.length} families · {families.reduce((s, f) => s + f.children.length, 0)} children attached
            {noFamily.length > 0 && <> · <strong>{noFamily.length} children have no family on file</strong></>}
          </p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder="Search a parent, a child, an email (current or former), a phone number…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search families"
        />
        <div className={styles.chips}>
          {chip('nofamily', 'No family on file', noFamily.length)}
          {chip('owes', 'Owes money', counts.owes)}
          {chip('forms', 'Missing forms', counts.forms)}
          {chip('consent', 'No consent on file', counts.consent)}
          {chip('notback', 'Not back this season', counts.notback)}
          <Link
            href={`${base}/families/duplicates`}
            className={`${styles.chip} ${(data?.duplicatePairCount ?? 0) === 0 ? styles.chipZero : ''}`}
            style={{ textDecoration: 'none' }}
          >
            Possible duplicates · {data?.duplicatePairCount ?? 0}
          </Link>
          {chip('all', 'All', families.length)}
        </div>
      </div>

      {fetchError && (
        <div className={styles.empty}><p className={styles.emptyBody}>Could not load the family book. Reload to try again.</p></div>
      )}

      {!fetchError && !data && (
        <div className="flex items-center justify-center h-32"><span className="hud-label">Loading…</span></div>
      )}

      {data && showNoFamilyTable && (
        noFamily.length === 0 ? (
          <div className={styles.empty}>
            <h2 className={styles.emptyTitle}>Every child names a family</h2>
            <p className={styles.emptyBody}>New roster rows and registrations appear here when they name no guardian, or an address too malformed to ever email.</p>
          </div>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead><tr><th>Child</th><th>Where</th><th>Why</th><th className={styles.num}>Fix</th></tr></thead>
              <tbody>
                {noFamily.map((c, i) => (
                  <tr key={`${c.childName}-${i}`}>
                    <td><span className={styles.who}>{c.childName}</span></td>
                    <td>{c.where}</td>
                    <td>{c.reason === 'no_email' ? 'No guardian named' : 'Guardian address unusable'}</td>
                    <td className={styles.num}>
                      <Link href={c.fixHref} className={styles.pill + ' ' + styles.pillInfo} style={{ textDecoration: 'none' }}>
                        Open {c.source === 'rep_roster' ? 'roster' : 'registration'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.notice}>
              These rows are children, not families — there is no family to show yet. Guardian details are
              fixed where they already live: the roster or the registration. The moment an address is added,
              the family appears here on the next load.
            </p>
          </div>
        )
      )}

      {data && !showNoFamilyTable && (
        lensRows.length === 0 ? (
          <div className={styles.empty}>
            <h2 className={styles.emptyTitle}>{q ? 'No family matches that' : 'Nothing in this list'}</h2>
            <p className={styles.emptyBody}>
              {q
                ? 'Search covers parents, children, phone numbers, and every email address ever seen — including ones a parent no longer uses.'
                : 'Families appear in a lens when there is something to do about them. Empty is the healthy state.'}
            </p>
          </div>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead><tr><th>Family</th><th>Children</th><th className={styles.num}>Owing</th><th className={styles.num}>Chased</th></tr></thead>
              <tbody>
                {lensRows.map(f => (
                  <tr key={f.personId}>
                    <td>
                      <Link href={`${base}/families/${f.personId}`} className={styles.whoLink}>
                        <span className={styles.who}>{f.name}</span>
                      </Link>
                      <div className={styles.kids}>{f.email}{f.optedOut && <> · <span className={`${styles.pill} ${styles.pillBad}`}>Opted out</span></>}</div>
                    </td>
                    <td>
                      {f.children.filter(c => c.current).slice(0, 3).map(c => (
                        <div key={c.sourceRowId ?? c.childName + c.where} className={c === f.children[0] ? undefined : styles.kids}>
                          {c.childName} · {c.where}
                        </div>
                      ))}
                      {f.notBack && <span className={`${styles.pill} ${styles.pillMute}`}>Not back this season</span>}
                    </td>
                    <td className={styles.num}>
                      {f.owingCents > 0 ? dollars(f.owingCents) : '—'}
                      {f.leagueUnpaidCount > 0 && <div className={styles.kids}>{f.leagueUnpaidCount} registration{f.leagueUnpaidCount === 1 ? '' : 's'} unpaid</div>}
                    </td>
                    <td className={styles.num}>
                      {f.owingCents > 0
                        ? (f.chasedAt
                          ? <span className={`${styles.pill} ${styles.pillWarn}`}>Reminded {formatStoredDate(f.chasedAt, { withYear: false })}</span>
                          : <span className={`${styles.pill} ${styles.pillBad}`}>Never</span>)
                        : f.leagueUnpaidCount > 0
                          ? <span className={`${styles.pill} ${styles.pillMute}`}>Not tracked</span>
                          : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lens === 'consent' && !q && (
              <p className={styles.notice}>
                “No consent on file” is a fact about the club’s records, not the family’s behaviour — most
                consent today is captured only by rep tryouts and house-league waiver acceptance (recorded
                since Aug 2026). A family the club never asked shows here, truthfully.
              </p>
            )}
          </div>
        )
      )}
    </div>
  );
}
