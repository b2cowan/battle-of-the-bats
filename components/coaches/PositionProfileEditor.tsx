'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import HelpTooltip from '@/components/help/HelpTooltip';
import SheetFrame from '@/components/coaches/SheetFrame';
import { useBackStep } from '@/components/coaches/useBackStep';
import { useDismissable } from '@/lib/overlay-hooks';
import { useIsPhoneNav } from '@/lib/hooks/useIsPhoneNav';
import { useReorderSensors } from '@/lib/hooks/useReorderSensors';
import { positionStateOf, cyclePositionState, type PositionState } from '@/lib/lineup-profile';
import coach from '@/app/[orgSlug]/coaches/coaches.module.css';

// Best / Never position picker for the Lineup Intelligence player profile (P1; three states since
// the owner's 2026-09-12 ruling). Replaces the old Primary/Secondary dropdowns with one control:
//   • Tap a position chip to cycle it: (blank) → Best → Never → (blank).
//   • "Best" is RANKED — the order chips are added is the priority; reorder by the portal's grip
//     (hold to drag, tap for Move up / Move down — ruling D3, 2026-09-29; see `BestOrderList`).
//   • "Never" is a HARD block the lineup auto-fill will never assign.
//   • Blank means "fine anywhere they're not Never" — it is NOT a fourth rating. The old "Okay"
//     state sat between blank and Best, was defined in this legend with the same words as blank,
//     and only did anything in Competitive mode; a fill-in spot is now a low-ranked Best.
// The parent owns the value ({best, never}); this component is presentational + stateless.
//
// Warm-theme note: this component is 100% inline-styled, so no CSS override can reach it.
// Colours use the role-based `var(--home-X, <exact-dark-literal>)` / `rgba(var(--home-X-rgb,
// <dark-rgb>), a)` pattern — the --home-* tokens are undefined outside the warm coach gate, so
// dark falls back to the original literal (byte-identical) and warms on cream under the gate.

export type { PositionState };

export interface PositionProfileValue {
  best: string[];   // ordered = priority (rank 1 first)
  never: string[];
}

interface Props {
  positions: string[];                     // sport vocabulary (chips)
  value: PositionProfileValue;
  onChange: (next: PositionProfileValue) => void;
  labelFor?: (code: string) => string;     // optional display label per code
  disabled?: boolean;
  /** The editor sits in a full-screen sheet that covers the bottom nav (the depth chart's player
   *  sheet), so the reorder menu drops to the screen's foot rather than sitting on a nav that is
   *  not there — the drawer-layer ruling's `overNav`, passed to the menu AND its scrim. */
  menuCoversNav?: boolean;
}

const CHIP_STYLE: Record<PositionState, React.CSSProperties> = {
  best:    { background: 'rgba(var(--home-olive-rgb, 132,204,22),0.16)', borderColor: 'rgba(var(--home-olive-rgb, 132,204,22),0.55)', color: 'var(--home-olive, #bef264)' },
  never:   { background: 'rgba(var(--home-live-rgb, 248,113,113),0.14)', borderColor: 'rgba(var(--home-live-rgb, 248,113,113),0.5)', color: 'var(--home-live, #fca5a5)', textDecoration: 'line-through' },
  neutral: { background: 'rgba(var(--home-line-rgb, 255,255,255),0.04)', borderColor: 'rgba(var(--home-line-rgb, 255,255,255),0.14)', color: 'var(--home-dim, rgba(255,255,255,0.6))' },
};

const STATE_WORD: Record<Exclude<PositionState, 'neutral'>, string> = {
  best: 'Best', never: 'Never',
};

export default function PositionProfileEditor({ positions, value, onChange, labelFor, disabled, menuCoversNav }: Props) {
  const { best, never } = value;

  const stateOf = (code: string): PositionState => positionStateOf(value, code);

  const cycle = (code: string) => { if (!disabled) onChange(cyclePositionState(value, code)); };

  const reorderBest = (next: string[]) => { if (!disabled) onChange({ best: next, never }); };

  const label = (code: string) => (labelFor ? labelFor(code) : code);

  // Show a chip for every offered position, plus any value already set that isn't offered
  // (e.g. a legacy OF/DH or a custom entry) so nothing becomes an un-editable ghost. Extras
  // vanish once cycled back to blank, so the list self-cleans down to the offered positions.
  const extras = Array.from(new Set([...best, ...never].filter(c => !positions.includes(c))));
  const allChips = [...positions, ...extras];

  if (!allChips.length) {
    return <p style={{ fontSize: 13, color: 'var(--home-dim, rgba(255,255,255,0.5))', margin: 0 }}>No positions defined for this sport.</p>;
  }

  return (
    <div>
      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 10, fontSize: 12, color: 'var(--home-dim, rgba(255,255,255,0.55))' }}>
        <LegendDot state="best" text="Best — tap to rank; used first" />
        <LegendDot state="never" text="Never — a hard block, in every mode" />
        <LegendDot state="neutral" text="Blank — fine anywhere they’re not Never" />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          Tap a position to cycle
          <HelpTooltip
            title="How positions guide the lineup"
            size="md"
            content={
              <div style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--home-ink-soft, rgba(255,255,255,0.75))' }}>
                <p style={{ margin: '0 0 8px' }}>Where the game-day <strong>Auto-fill</strong> will play this player:</p>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <HelpStateRow state="best" label="Best" desc="go-to spots, in your rank order — used first" />
                  <HelpStateRow state="never" label="Never" desc="a hard block — never placed here, in any mode" />
                  <HelpStateRow state="neutral" label="Blank" desc="fine — anywhere they’re not Never" />
                </ul>
                <p style={{ margin: '9px 0 0', color: 'var(--home-dim, rgba(255,255,255,0.55))' }}>Auto-fill never places a player at a Never. Best ranks matter most in Competitive games; Balanced rotates anyone rated Best; Development rotates everyone. Bench time rotates evenly. You can edit the lineup before the game.</p>
              </div>
            }
          />
        </span>
      </div>

      {/* Chip grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {/* No rank number on a Best chip (owner, 2026-09-29): the priority-order list under the chips
            IS the order — a number here said it twice. */}
        {allChips.map(code => {
          const st = stateOf(code);
          return (
            <button
              key={code}
              type="button"
              onClick={() => cycle(code)}
              disabled={disabled}
              aria-label={`${label(code)}: ${st === 'neutral' ? 'blank — fine' : STATE_WORD[st]}. Tap to change.`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 999, border: '1px solid',
                fontSize: 13, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
                transition: 'all 0.12s ease', ...CHIP_STYLE[st],
              }}
            >
              {label(code)}
            </button>
          );
        })}
      </div>

      {/* Best priority reorder — only meaningful with 2+ */}
      {best.length >= 2 && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--home-dim, rgba(255,255,255,0.55))', margin: '0 0 6px' }}>
            Best positions — priority order
          </p>
          <BestOrderList best={best} label={label} disabled={disabled} onReorder={reorderBest} menuCoversNav={menuCoversNav} />
        </div>
      )}
    </div>
  );
}

/**
 * THE BEST-POSITIONS ORDER, ON THE PORTAL'S REORDER STANDARD (owner ruling D3, 2026-09-29 — "can we
 * update these to drag and move which has become our portal standard?"). The standard is the lineup
 * builder's D8 handle (2026-09-21), whole: a grip on every row — HOLD it to drag (a finger lifts
 * after a 250ms hold, a mouse after 6px, the keyboard with Space), TAP it for Move up / Move down.
 * The tap half is not optional garnish: it is the path for anyone who cannot drag, and every
 * reorder in the portal keeps one. The up/down arrow pairs this replaced were the portal's last.
 *
 * The rows are ONE outlined list with a hairline between positions — they were separate olive-tinted
 * cards with gaps, the pattern "Phone lists in one frame" retired. It keeps an outline because it is
 * a control inside a form, the way an input keeps its box.
 *
 * The menu is the lineup's row menu: a popover under the list on a computer (`.lineupAutoMenu` +
 * `.lineupRowSheet`), and wherever the bar shows (≤900) a record sheet on the portal's sheet frame, in
 * the MENU layer (Sheet Frame step 4, 2026-10-06) — a tap acts, nothing is lost. Inside the depth chart's
 * player window (`menuCoversNav`) there is no bar to sit on, so it sits over the window (`overWindow`),
 * still a menu: inside that window's own DOM. Its keys are this list's (the dismiss hook and the back
 * step); the dim's hand-back is the frame's (to the grip).
 */
function BestOrderList({ best, label, disabled, onReorder, menuCoversNav }: {
  best: string[];
  label: (code: string) => string;
  disabled?: boolean;
  onReorder: (next: string[]) => void;
  menuCoversNav?: boolean;
}) {
  const sensors = useReorderSensors();
  const isPhoneNav = useIsPhoneNav();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // The grip that opened it — the frame's dim hands focus back to it (a tap on iOS never focused it).
  const menuOpenerRef = useRef<HTMLElement | null>(null);
  const closeMenu = () => setMenuFor(null);
  useDismissable(menuFor !== null, menuRef, closeMenu);
  useBackStep(menuFor !== null, closeMenu);
  // The menu takes focus on its first live item (a keyboard or screen-reader user lands IN it).
  useEffect(() => {
    if (menuFor !== null) menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
  }, [menuFor]);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = best.indexOf(String(active.id));
    const to = best.indexOf(String(over.id));
    if (from >= 0 && to >= 0) onReorder(arrayMove(best, from, to));
  };
  const move = (code: string, dir: -1 | 1) => {
    const from = best.indexOf(code);
    const to = from + dir;
    if (from >= 0 && to >= 0 && to < best.length) onReorder(arrayMove(best, from, to));
  };
  const menuIdx = menuFor ? best.indexOf(menuFor) : -1;
  // One body for both forms of the menu — the computer's popover and the phone's sheet.
  const menuBody = (code: string) => (
    <>
      <p className={coach.lineupRowSheetHead}>
        <strong>{label(code)}</strong>
        <span>Best · {menuIdx + 1} of {best.length}</span>
      </p>
      <button type="button" className={coach.lineupRowSheetItem} disabled={menuIdx === 0} onClick={() => move(code, -1)}>
        <ChevronUp size={18} aria-hidden="true" /> Move up
      </button>
      <button type="button" className={coach.lineupRowSheetItem} disabled={menuIdx === best.length - 1} onClick={() => move(code, 1)}>
        <ChevronDown size={18} aria-hidden="true" /> Move down
      </button>
      <button type="button" className={coach.lineupRowSheetCancel} onClick={closeMenu}>Done</button>
    </>
  );

  return (
    <div style={{ position: 'relative' }}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={best} strategy={verticalListSortingStrategy}>
          <ol aria-label="Best positions, in priority order" style={{
            listStyle: 'none', margin: 0, padding: 0,
            border: '1px solid var(--home-line, rgba(255,255,255,0.12))', borderRadius: 8,
            background: 'var(--card-bg, transparent)',
          }}>
            {best.map((code, idx) => (
              <BestOrderRow key={code} code={code} rank={idx + 1} last={idx === best.length - 1}
                label={label(code)} disabled={disabled} onMenu={from => { menuOpenerRef.current = from; setMenuFor(code); }} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {menuFor !== null && menuIdx >= 0 && (
        <div ref={menuRef}>
          {isPhoneNav ? (
            <SheetFrame onClose={closeMenu} opener={menuOpenerRef} overWindow={menuCoversNav} role="dialog" aria-label={`Options for ${label(menuFor)}`}>
              {menuBody(menuFor)}
            </SheetFrame>
          ) : (
            <div className={`${coach.lineupAutoMenu} ${coach.lineupRowSheet}`} role="dialog" aria-label={`Options for ${label(menuFor)}`}>
              {menuBody(menuFor)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BestOrderRow({ code, rank, last, label, disabled, onMenu }: {
  code: string; rank: number; last: boolean; label: string; disabled?: boolean; onMenu: (from: HTMLElement) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: code, disabled });
  return (
    <li ref={setNodeRef} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      minHeight: 44, paddingRight: 12, paddingLeft: disabled ? 12 : 0,
      borderBottom: last ? 'none' : '1px solid var(--home-line, rgba(255,255,255,0.08))',
      background: 'var(--card-bg, transparent)', borderRadius: isDragging ? 8 : 0,
      position: 'relative', zIndex: isDragging ? 2 : undefined,
      boxShadow: isDragging ? '0 8px 22px rgba(0,0,0,0.18)' : undefined,
      transform: CSS.Transform.toString(transform), transition,
    }}>
      {/* The grip is the one control: hold to drag, tap for the menu (the D8 handle). A coach who
          cannot edit sees the order and no grip — a disabled handle is a control that looks live. */}
      {!disabled && (
        <button type="button" {...attributes} {...listeners} onClick={e => onMenu(e.currentTarget)}
          aria-label={`${label}, Best ${rank}. Hold to move, tap for options.`}
          style={{
            display: 'grid', placeItems: 'center', flex: 'none', width: 44, height: 44,
            margin: 0, padding: 0, border: 0, background: 'none', cursor: 'grab',
            color: 'var(--home-dim, rgba(255,255,255,0.45))',
            touchAction: 'none', WebkitTouchCallout: 'none', userSelect: 'none',
          }}>
          <GripVertical size={16} aria-hidden="true" />
        </button>
      )}
      <span style={{ fontSize: 'var(--type-support)', fontWeight: 700, color: 'var(--home-olive, #bef264)', minWidth: 16, fontVariantNumeric: 'tabular-nums' }}>{rank}</span>
      <span style={{ flex: 1, fontSize: 'var(--type-body)', fontWeight: 600, color: 'var(--home-ink, #ecfccb)' }}>{label}</span>
    </li>
  );
}

function HelpStateRow({ state, label, desc }: { state: PositionState; label: string; desc: string }) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span style={{
        flexShrink: 0, marginTop: 4, width: 10, height: 10, borderRadius: 3, border: '1px solid',
        background: CHIP_STYLE[state].background, borderColor: CHIP_STYLE[state].borderColor,
      }} />
      <span><strong style={{ color: 'var(--home-ink, rgba(255,255,255,0.92))' }}>{label}</strong> — {desc}</span>
    </li>
  );
}

function LegendDot({ state, text }: { state: PositionState; text: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        width: 10, height: 10, borderRadius: 3, border: '1px solid',
        background: CHIP_STYLE[state].background, borderColor: CHIP_STYLE[state].borderColor,
      }} />
      {text}
    </span>
  );
}
