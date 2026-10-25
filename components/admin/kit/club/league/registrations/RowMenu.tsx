'use client';
/**
 * A ROW'S ⋯ (Club Tier Stage 9b-2, Part 3; copy §1.5): the one menu of everything else a registration can do. At a desk a
 * popover hanging off a quiet glyph; on a phone the portal's sheet, headed by the child ("Ava Kim" over "Division B ·
 * $150 owing") with the symbol alone at 44px. Only the items the row and the member's rights allow are drawn — absent
 * beats disabled — and each wears its one-line description.
 */
import { MoreHorizontal } from 'lucide-react';
import { CoachToolbarMenu, CoachToolbarMenuHeading, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import { REGS_WORDS } from '@/lib/house-league-money-words';
import type { RowActionKey } from '@/lib/house-league-registrations';
import css from './Registrations.module.css';

export interface MenuItem { key: RowActionKey; label: string; hint?: string }

export default function RowMenu({ name, sub, items, isPhone, onPick }: {
  name: string;
  /** The sheet's second line: "Division B · $150 owing". */
  sub: string;
  items: readonly MenuItem[];
  isPhone: boolean;
  onPick: (key: RowActionKey) => void;
}) {
  if (items.length === 0) return null;
  return (
    <CoachToolbarMenu
      variant="glyph"
      label={REGS_WORDS.moreFor(name)}
      icon={<MoreHorizontal size={18} aria-hidden />}
      drawerOnPhone
      drawerTitle={name}
      panelMinWidth={320}
      triggerClassName={css.moreTrigger}
    >
      {isPhone && sub && <CoachToolbarMenuHeading>{sub}</CoachToolbarMenuHeading>}
      {items.map(item => (
        <CoachToolbarMenuItem key={item.key} label={item.label} hint={item.hint} onSelect={() => onPick(item.key)} />
      ))}
    </CoachToolbarMenu>
  );
}
