'use client';

import React, { useRef, useState } from 'react';
import { Check, ChevronDown, HelpCircle, Lock, MoreHorizontal, Search, X } from 'lucide-react';
import clsx from 'clsx';
import HelpButton from '@/components/help/HelpButton';
import type { HelpRequest } from '@/components/help/help-drawer-context';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { useAdminKit } from '@/components/admin/AdminKitProvider';
import { useAnchoredMenu, useDismissable } from '@/lib/overlay-hooks';
import { LOCKED_RESULTS } from '@/lib/tournament-status-words';
import styles from './TournamentAdminUI.module.css';

type Option<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
  title?: string;
  icon?: React.ReactNode;
};

/**
 * The page header ten tournament screens share.
 *
 * ⚠ ON THE KIT it is `AdminPageHeader`: the page's name as the title in sentence case (`kitTitle`),
 * and nothing above it — the pinned event header directly above names the event, so a page names only
 * itself (Tournament admin redesign G1, 2026-09-29, which took the event-name eyebrow off; it had been
 * the eyebrow since ADC slice 4a). On a phone the page's actions and "?" join the title's line. No icon tile and
 * no subtitle (F3): every subtitle these pages pass is either the tournament's name (now the eyebrow),
 * the tournament's year (the event header's dates carry it), or a description of the page (the rail
 * row and the body say it). `meta` — the one live fact, the Schedule's "Published" — becomes a state
 * chip beside the title. The eyebrow the legacy header passes ("Game Day", "Tournament Admin") names a
 * rail group, not a fact, and gives way to the tournament's name as drawn. The read-only banner stays
 * under the header. With the switch off the legacy header renders byte for byte.
 */
export function TournamentAdminHeader({
  icon,
  eyebrow,
  title,
  kitTitle,
  subtitle,
  meta,
  actions,
  help,
  locked = false,
  mobileActionsInline = false,
  className,
}: {
  icon?: React.ReactNode;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** The title in the kit's sentence case ("Public site"), when `title` is in today's title case. */
  kitTitle?: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  /** When set, renders a "?" Help button in the header actions that opens the
   *  in-context HelpDrawer to this page's mapped guide section(s). */
  help?: HelpRequest;
  /** When true, renders a read-only banner below the header. */
  locked?: boolean;
  mobileActionsInline?: boolean;
  className?: string;
}) {
  const kit = useAdminKit();
  // The "?" is named after the title on screen — the kit's sentence case when the switch is on.
  const shownTitle = kit ? (kitTitle ?? title) : title;
  // On the kit the "?" is the coaches portal's bare glyph at every width (owner, 2026-10-01), not the
  // grey ghost square; the legacy header keeps its worded "? Help".
  const helpButton = help && <HelpButton help={help} label={typeof shownTitle === 'string' ? shownTitle : undefined} iconOnly={kit} />;
  const lockedCopy = (
    <>
      <Lock size={13} aria-hidden />
      {/* The one "completed and locked" sentence (Stage 4): the way back is the record's Reopen. */}
      <span>{LOCKED_RESULTS}</span>
    </>
  );
  if (kit) {
    return (
      <>
        <AdminPageHeader
          inlineActions
          title={shownTitle}
          titleChips={meta}
          actions={(actions || help) ? <>{actions}{helpButton}</> : undefined}
        />
        {locked && <div className={styles.kitLockedBanner} role="status">{lockedCopy}</div>}
      </>
    );
  }
  return (
    <header className={clsx(styles.header, className)} data-mobile-actions={mobileActionsInline ? 'inline' : undefined}>
      <div className={styles.headerMain}>
        {icon && <div className={styles.headerIcon}>{icon}</div>}
        <div className={styles.headerCopy}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          {meta && <div className={styles.headerMeta}>{meta}</div>}
        </div>
      </div>
      {(actions || help) && (
        <div className={styles.headerActions}>
          {actions}
          {helpButton}
        </div>
      )}
      {locked && (
        <div className={styles.lockedBanner} role="status">
          {lockedCopy}
        </div>
      )}
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
  fullWidth = false,
  className,
}: {
  children: React.ReactNode;
  align?: 'start' | 'end';
  grow?: boolean;
  /** Forces this group onto its own row regardless of sibling content. */
  fullWidth?: boolean;
  className?: string;
}) {
  return (
    <div
      className={clsx(styles.toolbarGroup, className)}
      data-align={align}
      data-grow={grow || undefined}
      data-full-width={fullWidth || undefined}
    >
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
  keepLabel = false,
  children,
  className,
}: {
  label?: React.ReactNode;
  icon?: React.ReactNode;
  align?: 'start' | 'end';
  disabled?: boolean;
  /** Keep the text label visible on mobile (for primary actions, not toolbar tools). */
  keepLabel?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonLabel = typeof label === 'string' ? label : 'Toolbar menu';

  useDismissable(open, rootRef, () => setOpen(false));
  // Anchored to whichever toolbar button this happens to be, so placement is measured, not CSS.
  const panelStyle = useAnchoredMenu(open, rootRef, panelRef, {
    minWidth: 240,
    narrowMinWidth: 180,
    align,
  });

  return (
    <div ref={rootRef} className={clsx(styles.menuRoot, className)} data-keep-label={keepLabel || undefined}>
      <button
        type="button"
        className={clsx(styles.menuButton, open && styles.menuButtonOpen)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={buttonLabel}
        title={buttonLabel}
        onClick={() => setOpen(current => !current)}
      >
        {icon ?? <MoreHorizontal size={15} aria-hidden />}
        <span className={styles.menuButtonLabel}>{label}</span>
        <ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <div ref={panelRef} className={styles.menuPanel} style={panelStyle} data-align={align} role="menu" onClick={event => {
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
      data-locked={locked || undefined}
      onClick={onSelect}
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

  // CSS anchors this panel to the trigger's edge, so dismissal is all it needs.
  useDismissable(open, rootRef, () => setOpen(false));

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
