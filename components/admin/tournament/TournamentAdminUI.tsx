'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, HelpCircle, Lock, MoreHorizontal, Search, X } from 'lucide-react';
import clsx from 'clsx';
import styles from './TournamentAdminUI.module.css';

type Option<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
  title?: string;
  icon?: React.ReactNode;
};

export function TournamentAdminHeader({
  icon,
  eyebrow,
  title,
  subtitle,
  meta,
  actions,
  className,
}: {
  icon?: React.ReactNode;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={clsx(styles.header, className)}>
      <div className={styles.headerMain}>
        {icon && <div className={styles.headerIcon}>{icon}</div>}
        <div className={styles.headerCopy}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          {meta && <div className={styles.headerMeta}>{meta}</div>}
        </div>
      </div>
      {actions && <div className={styles.headerActions}>{actions}</div>}
    </header>
  );
}

export function TournamentAdminToolbar({
  children,
  ariaLabel = 'Page controls',
  sticky = false,
  className,
}: {
  children: React.ReactNode;
  ariaLabel?: string;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <div className={clsx(styles.toolbar, className)} data-sticky={sticky || undefined} role="toolbar" aria-label={ariaLabel}>
      {children}
    </div>
  );
}

export function ToolbarGroup({
  children,
  align = 'start',
  grow = false,
  className,
}: {
  children: React.ReactNode;
  align?: 'start' | 'end';
  grow?: boolean;
  className?: string;
}) {
  return (
    <div className={clsx(styles.toolbarGroup, className)} data-align={align} data-grow={grow || undefined}>
      {children}
    </div>
  );
}

export function ToolbarSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className,
}: {
  label: React.ReactNode;
  value: T;
  options: Array<Option<T>>;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={clsx(styles.field, className)}>
      <span className={styles.label}>{label}</span>
      <select
        className={styles.select}
        value={value}
        disabled={disabled}
        onChange={event => onChange(event.target.value as T)}
      >
        {options.map(option => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ToolbarSearch({
  value,
  onChange,
  placeholder = 'Search...',
  label = 'Search',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  return (
    <label className={clsx(styles.search, className)}>
      <span className="sr-only">{label}</span>
      <Search className={styles.searchIcon} aria-hidden />
      <input
        type="search"
        className={styles.searchInput}
        value={value}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
      />
    </label>
  );
}

export function ToolbarSegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: T;
  options: Array<Option<T>>;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div className={clsx(styles.segmented, className)} role="group" aria-label={ariaLabel}>
      {options.map(option => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={clsx(styles.segment, active && styles.segmentActive)}
            aria-pressed={active}
            disabled={option.disabled}
            title={option.title}
            onClick={() => onChange(option.value)}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ToolbarMenu({
  label = 'Tools',
  icon,
  align = 'end',
  disabled = false,
  children,
  className,
}: {
  label?: React.ReactNode;
  icon?: React.ReactNode;
  align?: 'start' | 'end';
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={clsx(styles.menuRoot, className)}>
      <button
        type="button"
        className={clsx(styles.menuButton, open && styles.menuButtonOpen)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
      >
        {icon ?? <MoreHorizontal size={15} aria-hidden />}
        <span>{label}</span>
        <ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <div className={styles.menuPanel} data-align={align} role="menu" onClick={event => {
          if ((event.target as HTMLElement).closest('button')) setOpen(false);
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

export function ToolbarMenuItem({
  icon,
  label,
  hint,
  locked = false,
  lockTitle,
  disabled = false,
  onSelect,
}: {
  icon?: React.ReactNode;
  label: React.ReactNode;
  hint?: React.ReactNode;
  locked?: boolean;
  /** Tooltip shown on hover when locked. Use to convey which plan unlocks it. */
  lockTitle?: string;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.menuItem}
      role="menuitem"
      disabled={disabled}
      onClick={locked ? undefined : onSelect}
      title={locked && lockTitle ? lockTitle : undefined}
    >
      {icon && <span className={styles.menuItemIcon}>{icon}</span>}
      <span className={styles.menuItemText}>
        <span className={styles.menuItemLabel}>{label}</span>
        {hint && <span className={styles.menuItemHint}>{hint}</span>}
      </span>
      {locked && <Lock className={styles.menuItemLock} size={14} aria-label="Locked" />}
    </button>
  );
}

export function ToolbarMenuSeparator() {
  return <div className={styles.menuSeparator} role="separator" />;
}

export function SelectionActionBar({
  selectedCount,
  label,
  onClear,
  children,
  className,
}: {
  selectedCount: number;
  label?: React.ReactNode;
  onClear?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  if (selectedCount <= 0) return null;

  return (
    <div className={clsx(styles.selectionBar, className)}>
      <div className={styles.selectionSummary}>
        <span className={styles.selectionCount}>{selectedCount}</span>
        <span>{label ?? `${selectedCount} selected`}</span>
      </div>
      <div className={styles.selectionActions}>
        {children}
        {onClear && (
          <button type="button" className="btn btn-ghost btn-xs" onClick={onClear}>
            <X size={13} aria-hidden />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

export function CompactUpsell({
  title,
  children,
  action,
  variant = 'info',
  className,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  variant?: 'info' | 'warning';
  className?: string;
}) {
  return (
    <div className={clsx(styles.compactUpsell, className)} data-variant={variant}>
      <div className={styles.compactUpsellBody}>
        <strong className={styles.compactUpsellTitle}>{title}</strong>
        <p className={styles.compactUpsellText}>{children}</p>
      </div>
      {action}
    </div>
  );
}

export function StatusLegendPopover({
  label = 'Legend',
  title = 'Status Legend',
  items,
  className,
}: {
  label?: React.ReactNode;
  title?: React.ReactNode;
  items: Array<{
    label: React.ReactNode;
    description: React.ReactNode;
    tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  }>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={clsx(styles.legendRoot, className)}>
      <button
        type="button"
        className={clsx(styles.legendButton, open && styles.legendButtonOpen)}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(current => !current)}
      >
        <HelpCircle size={14} aria-hidden />
        <span>{label}</span>
      </button>
      {open && (
        <div className={styles.legendPanel} role="dialog" aria-label={typeof title === 'string' ? title : 'Status legend'}>
          <h2 className={styles.legendTitle}>{title}</h2>
          <div className={styles.legendList}>
            {items.map((item, index) => (
              <div key={index} className={styles.legendItem}>
                <span className={styles.legendDot} data-tone={item.tone ?? 'neutral'} aria-hidden />
                <span className={styles.legendContent}>
                  <strong>{item.label}</strong>
                  <span className={styles.legendDescription}>{item.description}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ToolbarCheckItem({
  checked,
  label,
  hint,
  onSelect,
}: {
  checked: boolean;
  label: React.ReactNode;
  hint?: React.ReactNode;
  onSelect?: () => void;
}) {
  return (
    <ToolbarMenuItem
      icon={checked ? <Check size={14} aria-hidden /> : <span className={styles.checkSpacer} />}
      label={label}
      hint={hint}
      onSelect={onSelect}
    />
  );
}
