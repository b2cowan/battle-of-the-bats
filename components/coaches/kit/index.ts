/**
 * THE COACH KIT — one home for the dashboard card, its parts, the list toolbar and the rail.
 * Plan: docs/projects/active/COACH_SHARED_STYLE_KIT_PLAN.md. Read `CoachKit.module.css`'s header
 * for why it exists and what it deliberately leaves alone.
 *
 *   import { CoachCard, CoachDoorCard, CoachEyebrow, CoachFigure, CoachChip, CoachBar,
 *            CoachListToolbar, CoachRail, kit } from '@/components/coaches/kit';
 *
 * `kit` is the stylesheet's classes for the parts that are a class, not a component — `kit.row3`,
 * `kit.row2`, `kit.sub`, `kit.flag*`, `kit.foot`, `kit.footLink`, `kit.toolbarView`,
 * `kit.toolbarActions`, `kit.railStatDanger`, `kit.railStatWarn` — worn on the caller's own markup.
 * A caller never composes one of these from its own stylesheet.
 */
export { default as CoachCard, CoachDoorCard, CoachEyebrow, CoachFigure } from './CoachCard';
export { default as CoachChip } from './CoachChip';
export { default as CoachBar, type CoachBarSegment, type CoachBarLegendItem } from './CoachBar';
export { default as CoachListToolbar } from './CoachListToolbar';
export { default as CoachRail, type CoachRailRowSpec, type CoachRailGroupSpec, type CoachRailDot } from './CoachRail';
export { default as kit } from './CoachKit.module.css';
