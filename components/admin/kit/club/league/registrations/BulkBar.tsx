'use client';
/**
 * THE BULK BAR (Club Tier Stage 9b-2, Part 3; copy §2; drawing m1 and m2). It appears when a row is ticked and shows only
 * the actions the tab can use: at a desk a bar under the toolbar — "2 selected · Mark received · Move division · Email ·
 * Clear"; on a phone it DOCKS at the foot in place of the phone bar, "2 selected · Clear", the tab's one action in words
 * and everything else behind a ⋯ (a symbol alone, 44px). Decline and Withdraw are never here: each asks what happened to
 * that family's money, and the ⋯ says so in one quiet line.
 */
import { MoreHorizontal } from 'lucide-react';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import { BULK_WORDS } from '@/lib/house-league-money-words';
import type { BulkKey } from '@/lib/house-league-registrations';
import css from './Registrations.module.css';

export default function BulkBar({ count, actions, isPhone, showHelp, onAct, onClear }: {
  count: number;
  actions: readonly BulkKey[];
  isPhone: boolean;
  /** The member can decline or withdraw one at a time: say why those are not here. */
  showHelp: boolean;
  onAct: (key: BulkKey) => void;
  onClear: () => void;
}) {
  if (!isPhone) {
    return (
      <div className={css.bulkInline} role="toolbar" aria-label={BULK_WORDS.barAria}>
        <b className={css.bulkCount}>{BULK_WORDS.count(count)}</b>
        {actions.map(key => (
          <button key={key} type="button" className="btn btn-outline" onClick={() => onAct(key)}>{BULK_WORDS[key]}</button>
        ))}
        <span className={css.bulkSpacer} aria-hidden />
        <button type="button" className={css.bulkClear} onClick={onClear}>{BULK_WORDS.clear}</button>
      </div>
    );
  }
  const [lead, ...rest] = actions;
  return (
    <div className={css.bulkDock} role="toolbar" aria-label={BULK_WORDS.barAria}>
      <span className={css.bulkDockCount}>
        <b>{BULK_WORDS.count(count)}</b>
        <button type="button" className={css.bulkClear} onClick={onClear}>{BULK_WORDS.clear}</button>
      </span>
      {lead && <button type="button" className="btn btn-outline" onClick={() => onAct(lead)}>{BULK_WORDS[lead]}</button>}
      {rest.length > 0 && (
        <CoachToolbarMenu
          variant="glyph"
          label={BULK_WORDS.moreAria}
          icon={<MoreHorizontal size={18} aria-hidden />}
          drawerOnPhone
          drawerTitle={BULK_WORDS.count(count)}
        >
          {rest.map(key => <CoachToolbarMenuItem key={key} label={BULK_WORDS[key]} onSelect={() => onAct(key)} />)}
          {showHelp && <p className={css.bulkHelp}>{BULK_WORDS.help}</p>}
        </CoachToolbarMenu>
      )}
    </div>
  );
}
