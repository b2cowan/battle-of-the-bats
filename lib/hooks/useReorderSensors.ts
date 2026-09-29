'use client';
import { KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

/**
 * THE PORTAL'S REORDER STANDARD — the drag half (the lineup builder's D8, owner ruling 2026-09-21;
 * adopted for the Best-positions order by ruling D3, 2026-09-29). Two input worlds, two activation
 * rules:
 *   · a MOUSE lifts a row after 6px of travel, as it always has;
 *   · a FINGER lifts it after a HOLD (250ms without drifting more than 5px) — hold and swipe are
 *     told apart by TIME, not by direction, so a handle can live inside a list that scrolls, and a
 *     quick tap never meets the constraint: it falls through to the handle's own onClick (the
 *     Move up / Move down menu — the standard's other half, the path for anyone who cannot drag).
 *     A drag that did activate swallows the click that follows it (dnd-kit stops it in capture).
 *   · the KEYBOARD lifts with Space and moves with the arrows.
 *
 * ⚠ One hook so the lineup builder and every list that adopts the standard cannot drift apart —
 * the two copies of a 250ms hold that disagree by 50ms are two different gestures to a thumb.
 */
export function useReorderSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}
