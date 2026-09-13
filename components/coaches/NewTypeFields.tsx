'use client';
import Link from 'next/link';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * The "+ New test…" quick add — ONE implementation for the session screen's chip and the profile's
 * log form (mockup screen 3 keeps it as an UNCHANGED idiom). It creates a measured test from a
 * name and a unit only, which lands as "record only · method not recorded" — honest, and one door
 * away from being finished: the hint points at Metrics, where the aim, the method, the attempts
 * and the headline are defined. Lives in its own file since the library's manager retired into
 * the Metrics tab (Phase 1); the import graph stays acyclic (PlayerDevelopmentSection → here).
 */
export function NewTypeFields({ idPrefix, name, unit, onName, onUnit, onAdd, metricsHref, primaryAdd = false }: {
  idPrefix: string;
  name: string;
  unit: string;
  onName: (v: string) => void;
  onUnit: (v: string) => void;
  onAdd: () => void;
  /** The Metrics tab, where the rest of the definition is written. */
  metricsHref: string;
  /** CP-1 (one lime per surface): normally the surface's lime belongs to something else, so
   *  Add stays ghost. */
  primaryAdd?: boolean;
}) {
  return (
    <div>
      <div className={styles.newTypeRow} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className={styles.field} style={{ flex: '1 1 160px' }}>
          <label className={styles.label} htmlFor={`${idPrefix}-name`}>New test name</label>
          <input id={`${idPrefix}-name`} className={styles.input} type="text" value={name}
            onChange={e => onName(e.target.value)} maxLength={40} placeholder="e.g. 60-yd sprint" />
        </div>
        <div className={styles.field} style={{ flex: '0 1 120px' }}>
          <label className={styles.label} htmlFor={`${idPrefix}-unit`}>Unit</label>
          <input id={`${idPrefix}-unit`} className={styles.input} type="text" value={unit}
            onChange={e => onUnit(e.target.value)} maxLength={20} placeholder="seconds" />
        </div>
        <button type="button" className={`btn ${primaryAdd ? 'btn-lime' : 'btn-ghost'} ${styles.devSectionAction}`} style={{ fontSize: '0.8rem' }} onClick={onAdd}>
          Add test
        </button>
      </div>
      <p className={styles.devCardNote} style={{ marginTop: '0.35rem' }}>
        A test added here records only — set its aim, method and attempts in{' '}
        <Link href={metricsHref} className={styles.devTailLink}>Metrics</Link>.
      </p>
    </div>
  );
}
