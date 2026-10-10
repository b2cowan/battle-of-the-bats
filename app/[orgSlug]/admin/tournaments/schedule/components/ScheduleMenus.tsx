'use client';
import React from 'react';
import { ChevronDown, CloudRain, EyeOff, Lock, Sparkles, Trophy, Wrench } from 'lucide-react';
import { useDismissable } from '@/lib/overlay-hooks';
import { useAdminKit, useKitStyle } from '@/components/admin/AdminKitProvider';
import { KIT_INK, KIT_SURFACE } from '@/components/admin/kit/kit-inline';
import styles from '../schedule-admin.module.css';

// ── Schedule Tools dropdown ────────────────────────────────────────────────────
/**
 * The hand-set styles the schedule's three dropdowns share — Unpublish, the phone Tools menu and the
 * desktop Tools menu (Admin Design Continuity slice 4c): one kit patch each, on 4a's menu recipe
 * (`TournamentAdminUI.module.css`, "Menus"). With the switch off every value is exactly today's. The
 * hover handlers write a colour to the DOM, which no stylesheet can reach, so they carry a kit branch.
 */
function useScheduleMenuStyles() {
  const kit = useAdminKit();
  const kx = useKitStyle();
  return React.useMemo(() => ({
    menuItem: kx({
      display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%',
      padding: '0.55rem 0.85rem', background: 'none', border: 'none',
      cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-data)',
      color: 'var(--fl-text)',
    }, {
      fontFamily: 'var(--font-sans, system-ui, sans-serif)', fontWeight: 650, color: 'var(--text-primary)',
    }),
    sectionLabel: kx({
      padding: '0.5rem 0.85rem 0.2rem', fontSize: '0.6rem', fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--data-gray)',
      fontFamily: 'var(--font-data)',
    }, KIT_INK.secondary),
    divider: kx({ height: '1px', background: 'rgba(var(--blueprint-blue-rgb),0.15)', margin: '0.35rem 0.75rem' }, { background: 'var(--home-line)' }),
    hint: kx({ fontSize: '0.65rem', color: 'var(--data-gray)', marginTop: '1px' }, KIT_INK.tertiary),
    lockIcon: kx({ flexShrink: 0, color: 'var(--blueprint-blue)' }, KIT_INK.warning),
    /** A row's icon: the accent when the tool is on the plan, quiet when it is locked. */
    toolIcon: (can: boolean) => kx(
      { color: can ? 'var(--logic-lime)' : 'var(--data-gray)' },
      can ? KIT_INK.accent : KIT_INK.tertiary,
    ),
    hoverOn: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = kit ? 'var(--home-olive-soft)' : 'rgba(var(--blueprint-blue-rgb),0.08)'; },
    hoverOff: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = 'none'; },
  }), [kit, kx]);
}

export function UnpublishControl({
  publishedCount,
  currentLabel,
  onUnpublishOne,
  onUnpublishAll,
  className,
}: {
  publishedCount: number;
  currentLabel: string;
  onUnpublishOne: () => void;
  onUnpublishAll: () => void;
  className?: string;
}) {
  const kx = useKitStyle();
  const { menuItem, hint, hoverOn, hoverOff } = useScheduleMenuStyles();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  useDismissable(open, rootRef, () => setOpen(false));

  // Only one division live → plain single-action button, no dropdown needed.
  if (publishedCount <= 1) {
    return (
      <button
        type="button"
        className={`btn btn-ghost btn-data ${className ?? ''}`}
        onClick={onUnpublishOne}
        title="Remove this division from the public schedule"
        aria-label="Unpublish division"
      >
        <EyeOff size={10} />
        <span className={styles.mobileButtonLabel}>Unpublish</span>
      </button>
    );
  }

  const optionIcon = kx({ flexShrink: 0, color: 'var(--data-gray)' }, KIT_INK.accent);

  return (
    <div ref={rootRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        className={`btn btn-ghost btn-data ${className ?? ''}`}
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Unpublish options"
      >
        <EyeOff size={10} />
        <span className={styles.mobileButtonLabel}>Unpublish</span>
        <ChevronDown size={10} style={{ opacity: 0.6 }} />
      </button>
      {open && (
        <div
          role="menu"
          style={kx({
            position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 100,
            background: 'var(--surface)', border: '1px solid rgba(var(--blueprint-blue-rgb), 0.3)',
            borderRadius: '2px', minWidth: '230px', boxShadow: 'var(--shadow)',
          }, KIT_SURFACE.menu)}
        >
          <button
            role="menuitem"
            style={menuItem}
            onClick={() => { setOpen(false); onUnpublishOne(); }}
            onMouseEnter={hoverOn}
            onMouseLeave={hoverOff}
          >
            <EyeOff size={13} style={optionIcon} />
            <span style={{ flex: 1 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em' }}>This division</div>
              <div style={hint}>{currentLabel}</div>
            </span>
          </button>
          <div style={kx({ height: '1px', background: 'rgba(var(--blueprint-blue-rgb),0.15)', margin: '0 0.75rem' }, { background: 'var(--home-line)' })} />
          <button
            role="menuitem"
            style={menuItem}
            onClick={() => { setOpen(false); onUnpublishAll(); }}
            onMouseEnter={hoverOn}
            onMouseLeave={hoverOff}
          >
            <EyeOff size={13} style={optionIcon} />
            <span style={{ flex: 1 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em' }}>All published ({publishedCount})</div>
              <div style={hint}>Remove every division from the public page</div>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

export function MobileToolsMenu({
  className,
  showAutoGenerate,
  canAutoGenerate,
  onAutoGenerate,
  showAutoBracket,
  canAutoBracket,
  onAutoBracket,
  canRainDelay,
  onRainDelay,
  rainDelayAvailable,
}: {
  className?: string;
  /** False when the format has no round robin (bracket-only): the item is absent, not locked. */
  showAutoGenerate: boolean;
  canAutoGenerate: boolean;
  onAutoGenerate: () => void;
  /** False when the format has no playoffs (Exhibition): the item is absent, not locked. */
  showAutoBracket: boolean;
  canAutoBracket: boolean;
  onAutoBracket: () => void;
  canRainDelay: boolean;
  onRainDelay: () => void;
  rainDelayAvailable: boolean;
}) {
  const kx = useKitStyle();
  const { menuItem, sectionLabel, divider: dividerStyle, hint: hintStyle, lockIcon: lockIconStyle, toolIcon, hoverOn, hoverOff } = useScheduleMenuStyles();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  useDismissable(open, rootRef, () => setOpen(false));

  const divider = <div style={dividerStyle} />;

  function act(fn: () => void | Promise<void>) {
    setOpen(false);
    void fn();
  }

  function row(opts: {
    icon: React.ReactNode;
    label: string;
    sub?: string;
    onClick?: () => void;
    locked?: boolean;
    lockTitle?: string;
    disabled?: boolean;
  }) {
    const { icon, label, sub, onClick, locked, lockTitle, disabled } = opts;
    const dim = disabled && !locked;
    return (
      <button
        role="menuitem"
        style={{ ...menuItem, opacity: dim ? 0.4 : 1, cursor: dim ? 'not-allowed' : 'pointer' }}
        title={locked ? lockTitle : undefined}
        onClick={() => { if (dim) return; onClick?.(); }}
        onMouseEnter={hoverOn}
        onMouseLeave={hoverOff}
      >
        <span style={{ flexShrink: 0, display: 'inline-flex' }}>{icon}</span>
        <span style={{ flex: 1 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em' }}>{label}</div>
          {sub && <div style={hintStyle}>{sub}</div>}
        </span>
        {locked && <Lock size={11} style={lockIconStyle} />}
      </button>
    );
  }

  return (
    <div ref={rootRef} style={{ position: 'relative', flexShrink: 0 }} className={className}>
      <button
        type="button"
        className="btn btn-ghost btn-data"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Schedule tools"
        title="Schedule tools"
      >
        {/* Wrench icon only — drops the "Tools" word to save row space on mobile
            (this menu only renders on mobile). Chevron keeps the menu affordance. */}
        <Wrench size={12} />
        <ChevronDown size={10} style={{ opacity: 0.6 }} />
      </button>
      {open && (
        <div
          role="menu"
          style={kx({
            position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 100,
            background: 'var(--surface)', border: '1px solid rgba(var(--blueprint-blue-rgb), 0.3)',
            borderRadius: '2px', minWidth: '240px', maxWidth: 'calc(100vw - 1.5rem)',
            boxShadow: 'var(--shadow)',
            paddingBottom: '0.35rem', maxHeight: '70vh', overflowY: 'auto',
          }, KIT_SURFACE.menu)}
        >
          {/* Publish/Unpublish is a sibling button beside this menu (not inside) —
              see .scheduleMobilePublish in the toolbar. */}

          <div style={sectionLabel}>Generate</div>
          {showAutoGenerate && row({
            icon: <Sparkles size={13} style={toolIcon(canAutoGenerate)} />,
            label: 'Round-Robin Generator',
            sub: 'Auto-build games from your teams',
            locked: !canAutoGenerate,
            lockTitle: 'Included with Tournament Plus and up',
            onClick: () => act(onAutoGenerate),
          })}
          {showAutoBracket && row({
            icon: <Trophy size={13} style={toolIcon(canAutoBracket)} />,
            label: 'Auto-Generate Bracket',
            sub: 'Build a full bracket from a format',
            locked: !canAutoBracket,
            lockTitle: 'Included with Tournament Plus and up',
            onClick: () => act(onAutoBracket),
          })}

          {rainDelayAvailable && (
            <>
              {divider}
              <div style={sectionLabel}>Adjust</div>
              {row({
                icon: <CloudRain size={13} style={toolIcon(canRainDelay)} />,
                label: 'Rain delay',
                sub: "Move or cancel a day's games at once",
                locked: !canRainDelay,
                lockTitle: 'Included with Tournament Plus and up',
                onClick: () => act(onRainDelay),
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function ScheduleToolsMenu({
  disabled,
  showAutoGenerate,
  canAutoGenerate,
  onAutoGenerate,
  showAutoBracket,
  canAutoBracket,
  onAutoBracket,
  canRainDelay,
  onRainDelay,
  rainDelayAvailable,
  className,
}: {
  disabled: boolean;
  /** False when the format has no round robin (bracket-only): the item is absent, not locked. */
  showAutoGenerate: boolean;
  canAutoGenerate: boolean;
  onAutoGenerate: () => void;
  /** False when the format has no playoffs (Exhibition): the item is absent, not locked. */
  showAutoBracket: boolean;
  canAutoBracket: boolean;
  onAutoBracket: () => void;
  canRainDelay: boolean;
  onRainDelay: () => void;
  rainDelayAvailable: boolean;
  className?: string;
}) {
  const kx = useKitStyle();
  const { menuItem, sectionLabel, divider: dividerStyle, hint: hintStyle, lockIcon: lockIconStyle, toolIcon, hoverOn, hoverOff } = useScheduleMenuStyles();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  useDismissable(open, rootRef, () => setOpen(false));

  const divider = <div style={dividerStyle} />;

  function row(opts: {
    icon: React.ReactNode; label: string; sub: string;
    onClick: () => void; locked?: boolean; lockTitle?: string;
  }) {
    const { icon, label, sub, onClick, locked, lockTitle } = opts;
    return (
      <button
        role="menuitem"
        style={menuItem}
        title={locked ? lockTitle : undefined}
        onClick={() => { setOpen(false); onClick(); }}
        onMouseEnter={hoverOn}
        onMouseLeave={hoverOff}
      >
        <span style={{ flexShrink: 0, display: 'inline-flex' }}>{icon}</span>
        <span style={{ flex: 1 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em' }}>{label}</div>
          <div style={hintStyle}>{sub}</div>
        </span>
        {locked && <Lock size={11} style={lockIconStyle} />}
      </button>
    );
  }

  return (
    <div ref={rootRef} style={{ position: 'relative', flexShrink: 0 }} className={className}>
      <button
        type="button"
        className="btn btn-ghost btn-data"
        onClick={() => setOpen(v => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Schedule tools"
      >
        <Wrench size={12} />
        <span>Tools</span>
        <ChevronDown size={10} style={{ opacity: 0.6 }} />
      </button>
      {open && (
        <div
          role="menu"
          style={kx({
            position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 100,
            background: 'var(--surface)', border: '1px solid rgba(var(--blueprint-blue-rgb), 0.3)',
            borderRadius: '2px', minWidth: '270px', boxShadow: 'var(--shadow)', paddingBottom: '0.35rem',
          }, KIT_SURFACE.menu)}
        >
          <div style={sectionLabel}>Build</div>
          {showAutoGenerate && row({
            icon: <Sparkles size={13} style={toolIcon(canAutoGenerate)} />,
            label: 'Round-Robin Generator',
            sub: 'Auto-build games from your teams',
            locked: !canAutoGenerate,
            lockTitle: 'Included with Tournament Plus and up',
            onClick: onAutoGenerate,
          })}
          {showAutoBracket && row({
            icon: <Trophy size={13} style={toolIcon(canAutoBracket)} />,
            label: 'Auto-Generate Bracket',
            sub: 'Build a full bracket from a format',
            locked: !canAutoBracket,
            lockTitle: 'Included with Tournament Plus and up',
            onClick: onAutoBracket,
          })}
          {rainDelayAvailable && (
            <>
              {divider}
              <div style={sectionLabel}>Adjust</div>
              {row({
                icon: <CloudRain size={13} style={toolIcon(canRainDelay)} />,
                label: 'Rain delay',
                sub: "Move or cancel a day's games at once",
                locked: !canRainDelay,
                lockTitle: 'Included with Tournament Plus and up',
                onClick: onRainDelay,
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
