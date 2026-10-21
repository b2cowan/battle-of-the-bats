'use client';
/**
 * THE REGISTRATION CHIP (owner 2026-10-21) — beside the division picker: whether this division is taking teams, how full
 * it is, and the one switch. It replaces the "Registration open" row of the old At a glance card, which spent a full-width
 * row on one word and a count. The chip says the state in words (a dot beside it is colour as a helper, never the whole
 * answer); pressing it opens the portal's action menu with the consequence in one sentence and one button — Close
 * registration, or Reopen registration. Closing stops new teams registering for this division only.
 *
 * Where registration was closed by its organization's plan (R2), the menu holds the plan's sentence and the plan's lock
 * in the switch's place, as the row did. The menu is the Tools menu's own component, so it keeps that menu's keyboard
 * pattern, and on a phone it is the same sheet.
 */
import { ChevronDown } from 'lucide-react';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import { PlanLockedTool, PlanLockMenuFoot } from '@/components/admin/tournament/PlanLockLine';
import { REGISTRATION_CHIP_WORDS, TEAMS_WORDS } from '@/lib/registration-words';
import styles from '../teams-admin.module.css';

export default function RegistrationChip({ divisionName, accepted, capacity, closed, busy, onToggle, ended }: {
  divisionName: string;
  accepted: number;
  capacity: number | null;
  closed: boolean;
  busy: boolean;
  onToggle: () => void;
  /** Registration closed by its organization's plan (R2): why, and the plan's lock in the switch's place. */
  ended?: { sentence: string; lockWords: string; lockHref: string; plan: string };
}) {
  const isClosed = closed || Boolean(ended);
  const state = isClosed ? TEAMS_WORDS.registrationClosed : TEAMS_WORDS.registrationOpen;
  const spots = capacity == null ? TEAMS_WORDS.noLimit(accepted)
    : accepted >= capacity ? TEAMS_WORDS.spotsFull(accepted, capacity)
      : TEAMS_WORDS.spotsLeft(accepted, capacity);
  // The chip carries the count and the state; "· 4 left" is the old row's second clause, kept in the menu's name only.
  const shortSpots = capacity == null ? TEAMS_WORDS.noLimit(accepted)
    : accepted >= capacity ? TEAMS_WORDS.spotsFull(accepted, capacity)
      : TEAMS_WORDS.spotsOf(accepted, capacity);
  return (
    <div className={styles.regChipSlot}>
      <CoachToolbarMenu
        label={REGISTRATION_CHIP_WORDS.chipLabel(state, spots)}
        plainTrigger
        triggerClassName={`${styles.regChip}${isClosed ? ` ${styles.regChipClosed}` : ''}`}
        triggerContent={(
          <>
            <span className={styles.regChipDot} aria-hidden />
            <span className={styles.regChipState}>{state}</span>
            <span className={styles.regChipSpots}>{shortSpots}</span>
            <ChevronDown size={14} aria-hidden className={styles.regChipChevron} />
          </>
        )}
        align="start"
        panelMinWidth={300}
        drawerOnPhone
        title={REGISTRATION_CHIP_WORDS.menuTitle(divisionName)}
      >
        {ended ? (
          <>
            <p className={styles.regChipSentence} role="note">{ended.sentence}</p>
            <PlanLockedTool name={ended.lockWords} href={ended.lockHref} plan={ended.plan} />
            <PlanLockMenuFoot />
          </>
        ) : (
          <>
            <p className={styles.regChipSentence} role="note">
              {closed ? TEAMS_WORDS.closedSentence(divisionName) : TEAMS_WORDS.closeSentence(divisionName)}
            </p>
            <CoachToolbarMenuItem
              label={closed ? TEAMS_WORDS.reopenRegistration : TEAMS_WORDS.closeRegistration}
              disabled={busy}
              onSelect={onToggle}
            />
          </>
        )}
      </CoachToolbarMenu>
    </div>
  );
}
