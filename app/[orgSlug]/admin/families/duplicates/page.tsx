'use client';

/**
 * The duplicate review queue (P2 chunk E).
 *
 * Everything here is a PROPOSAL for a human — exact-email matches never appear
 * (they are already one person by construction). The empty state is the goal
 * state and reads as health, not absence. "Not the same person" is remembered
 * forever (tombstones, mig 253) so a rejected pair never resurfaces. A merge
 * joins the PARENT records only — no child row is touched — and the strictest
 * contact preference wins by construction (plan §5.3).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Users2 } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { usePageTitle } from '@/lib/usePageTitle';
import styles from '../families.module.css';

interface Side { personId: string; name: string; email: string; phone: string | null; childNames: string[]; addressCount: number; optedOut: boolean }
interface Pair { a: Side; b: Side; reasons: string[]; keep: 'a' | 'b' }

export default function DuplicatesPage() {
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  usePageTitle('Possible duplicates');
  const base = `/${currentOrg?.slug ?? ''}/admin`;
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';

  const canUse = !loading && !!currentOrg && !!userRole
    && hasCapability(userRole, userCapabilities, 'module_families')
    && hasModuleEntitlement(currentOrg, 'module_families');

  const [pairs, setPairs] = useState<Pair[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmMerge, setConfirmMerge] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Stale guard: a slow response fetched for a previous org must never paint
  // under the current one (this screen is guardian PII).
  const activeOrgQuery = useRef(orgQuery);
  const reload = useCallback(() => {
    fetch(`/api/admin/families/duplicates${orgQuery}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { if (activeOrgQuery.current === orgQuery) setPairs(d.pairs ?? []); })
      .catch(() => { if (activeOrgQuery.current === orgQuery) setError('Could not load the queue.'); });
  }, [orgQuery]);

  useEffect(() => {
    if (!canUse || !currentOrg) return;
    activeOrgQuery.current = orgQuery;
    setPairs(null); setError(null);
    reload();
  }, [canUse, currentOrg, orgQuery, reload]);

  if (loading || !userRole || !currentOrg) {
    return <div className="flex items-center justify-center h-64"><span className="hud-label">Loading...</span></div>;
  }
  if (!canUse) {
    return (
      <div className={styles.page}>
        <div className={styles.empty} style={{ marginTop: '3rem' }}>
          <h2 className={styles.emptyTitle}>This area needs the Families permission</h2>
          <p className={styles.emptyBody}>An owner can grant it from Organization Admin → Members → Manage member → Module access.</p>
        </div>
      </div>
    );
  }

  async function act(pair: Pair, action: 'merge' | 'not_same', keepId: string, mergeId: string) {
    const key = `${pair.a.personId}|${pair.b.personId}`;
    setBusy(key); setError(null);
    try {
      const res = await fetch(`/api/admin/families/duplicates${orgQuery}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, keepId, mergeId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'Action failed');
      } else {
        reload();
      }
    } catch { setError('Action failed'); }
    setBusy(null); setConfirmMerge(null);
  }

  const side = (s: Side, keep: boolean) => (
    <div className={`${styles.mergeSide} ${keep ? styles.mergeKeep : ''}`}>
      <div className={styles.mergeName}>
        <span>{s.name}</span>
        <span className={`${styles.pill} ${keep ? styles.pillGood : styles.pillWarn}`}>{keep ? 'Keep' : 'Merge in'}</span>
      </div>
      <div className={styles.mergeRow}><strong style={{ color: 'var(--white)' }}>{s.email}</strong></div>
      {s.phone && <div className={styles.mergeRow}>{s.phone}</div>}
      <div className={styles.mergeRow}>
        Children: {s.childNames.length ? s.childNames.join(', ') : 'none attached'}
        {s.childNames.length > 0 && ' — matched by name only'}
      </div>
      <div className={styles.mergeRow}>{s.addressCount} address{s.addressCount === 1 ? '' : 'es'} on file</div>
      <div className={styles.mergeRow}>Club email: {s.optedOut ? <strong style={{ color: 'var(--danger-light)' }}>opted out</strong> : 'on'}</div>
    </div>
  );

  return (
    <div className={styles.page}>
      <Link href={`${base}/families`} className={styles.backLink}><ArrowLeft size={13} /> Families</Link>
      <div className={styles.pageHeader}>
        <div className={styles.headerIcon}><Users2 size={20} /></div>
        <div>
          <h1 className={styles.pageTitle}>Possible duplicates</h1>
          <p className={styles.pageSub}>Pairs the system suspects are one person, waiting for a human decision. Nothing here merges on its own.</p>
        </div>
      </div>

      {error && <p className={styles.notice} style={{ color: 'var(--warning)' }}>{error}</p>}

      {pairs === null && <div className="flex items-center justify-center h-32"><span className="hud-label">Loading…</span></div>}

      {pairs !== null && pairs.length === 0 && (
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>Nothing to review</h2>
          <p className={styles.emptyBody}>
            New pairs appear here when two records share a surname and a phone number, or a surname and a
            same-named child. Exact email matches never appear — they are already one person. Pairs you
            marked <em>not the same person</em> are remembered and will not come back.
          </p>
        </div>
      )}

      {(pairs ?? []).map(pair => {
        const key = `${pair.a.personId}|${pair.b.personId}`;
        // Which side keeps is the SERVER's call (decided where the pair is
        // assembled); the reviewer is choosing whether, not which.
        const keep = pair.keep === 'a' ? pair.a : pair.b;
        const merge = pair.keep === 'a' ? pair.b : pair.a;
        const anyOptout = pair.a.optedOut || pair.b.optedOut;
        return (
          <div key={key} className={styles.pairCard}>
            <p className={styles.pairReasons}>Matched on {pair.reasons.join(' and ')}</p>
            <div className={styles.mergeGrid}>
              {side(keep, true)}
              {side(merge, false)}
            </div>
            <div className={styles.panel} style={{ marginTop: '0.9rem' }}>
              <h3 className={styles.panelHead}>After merging</h3>
              <div className={styles.line}><span>One parent — the children&rsquo;s rows stay exactly as they are</span><span className={styles.lineV} /></div>
              <div className={styles.line}><span>Old address kept as a former address</span><span className={styles.lineV}><span className={`${styles.pill} ${styles.pillGood}`}>Searchable</span></span></div>
              <div className={styles.line}>
                <span>Strictest contact preference wins</span>
                <span className={styles.lineV}>
                  {anyOptout
                    ? <span className={`${styles.pill} ${styles.pillBad}`}>Stays opted out</span>
                    : <span className={`${styles.pill} ${styles.pillGood}`}>No opt-out on either side</span>}
                </span>
              </div>
            </div>
            <div className={styles.actionbar} style={{ borderTop: 0, paddingTop: 0, marginTop: '0.9rem' }}>
              {confirmMerge === key ? (
                <>
                  <span className={styles.notice} style={{ margin: 0, alignSelf: 'center' }}>
                    Merge {merge.name} into {keep.name}? This cannot be split apart afterwards.
                  </span>
                  <button className="btn btn-lime btn-data" disabled={busy === key}
                    onClick={() => act(pair, 'merge', keep.personId, merge.personId)}>
                    {busy === key ? 'Merging…' : 'Yes, merge'}
                  </button>
                  <button className="btn btn-outline btn-data" onClick={() => setConfirmMerge(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <button className="btn btn-lime btn-data" onClick={() => setConfirmMerge(key)}>Merge</button>
                  <button className="btn btn-outline btn-data" disabled={busy === key}
                    onClick={() => act(pair, 'not_same', pair.a.personId, pair.b.personId)}>
                    Not the same person
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
