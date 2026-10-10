'use client';
/** The schedule's venue filter (a menu of venue · diamond rows with counts). Moved out of the schedule page, Stage 3 Part 0. */
import React from 'react';
import { Check, MapPin, X } from 'lucide-react';
import { useDismissable } from '@/lib/overlay-hooks';
import styles from '../schedule-admin.module.css';

export default function VenueFilterMenu({
  options,
  selectedKeys,
  onToggle,
  onClear,
}: {
  options: Array<{ key: string; label: string; sublabel?: string; count: number }>;
  selectedKeys: string[];
  onToggle: (key: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  useDismissable(open, rootRef, () => setOpen(false));

  const selectedCount = selectedKeys.length;
  const buttonText = selectedCount === 0
    ? 'All venues'
    : selectedCount === 1
      ? options.find(option => option.key === selectedKeys[0])?.label ?? '1 venue'
      : `${selectedCount} venues`;

  return (
    <div className={styles.venueFilterRoot} ref={rootRef}>
      <button
        type="button"
        className={`${styles.venueFilterButton} ${selectedCount > 0 ? styles.venueFilterButtonActive : ''}`}
        onClick={() => setOpen(value => !value)}
        disabled={options.length === 0}
        aria-haspopup="menu"
        aria-expanded={open}
        title={options.length === 0 ? 'No venues in this view' : 'Filter by venue'}
      >
        <MapPin size={13} />
        <span>{buttonText}</span>
      </button>
      {open && (
        <div className={styles.venueFilterPanel} role="menu">
          <div className={styles.venueFilterHeader}>
            <span>Venues</span>
            {selectedCount > 0 && (
              <button type="button" onClick={onClear}>
                <X size={12} /> Clear
              </button>
            )}
          </div>
          <div className={styles.venueFilterList}>
            <button
              type="button"
              className={`${styles.venueFilterOption} ${selectedCount === 0 ? styles.venueFilterOptionActive : ''}`}
              onClick={onClear}
              role="menuitemcheckbox"
              aria-checked={selectedCount === 0}
            >
              <span className={styles.venueFilterCheck}>{selectedCount === 0 ? <Check size={12} /> : null}</span>
              <span className={styles.venueFilterName}><span className={styles.venueFilterNamePrimary}>All venues</span></span>
              <span className={styles.venueFilterCount}>{options.reduce((total, option) => total + option.count, 0)}</span>
            </button>
            {options.map(option => {
              const isSelected = selectedKeys.includes(option.key);
              return (
                <button
                  key={option.key}
                  type="button"
                  className={`${styles.venueFilterOption} ${isSelected ? styles.venueFilterOptionActive : ''}`}
                  onClick={() => onToggle(option.key)}
                  role="menuitemcheckbox"
                  aria-checked={isSelected}
                >
                  <span className={styles.venueFilterCheck}>{isSelected ? <Check size={12} /> : null}</span>
                  <span className={styles.venueFilterName}>
                    <span className={styles.venueFilterNamePrimary}>{option.label}</span>
                    {option.sublabel && <span className={styles.venueFilterSublabel}>{option.sublabel}</span>}
                  </span>
                  <span className={styles.venueFilterCount}>{option.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
