'use client';
/**
 * ⚖ A FAMILY'S CONTACT, ONE CLICK FROM THE ROSTER ROW (owner 2026-11-05; drawings
 * `COACH_ROSTER_FAMILY_CELL_DRAWINGS.html`, design review the same day).
 *
 * The Family column used to print name, email and phone in three lines, which made every row ~90px and the roster a
 * long scroll. The cell is now the guardian's NAME on one line; this window is where the details live. It is the
 * portal's own small window (`QuestionShell kind="question"`, 26rem, no ×: Escape, Back, a tap outside and Close are
 * its "no"), the same frame as the Ledger's read windows, and its body is the shared `RecordFacts` box.
 *
 * ⚠ IT READS ONLY WHAT THE ROW CARRIES. The guardian fields are already on every roster row (and are stripped by the
 * API for a coach without guardian-contact access, so such a coach never gets a button to open this) — no second
 * fetch, so the window can never disagree with the row that was clicked.
 *
 * ⚠ PHONE BEFORE EMAIL, as the player's own Family tab orders them ("who do I call?"). A value that is missing reads
 * "Not on file", so the coach sees the gap instead of a row that quietly isn't there.
 * ⚠ THE DOOR IS A `Link`, NEVER `router.push`: KitDialog's header — a window that navigates by push breaks Back.
 * ⚠ ONE WINDOW, MOUNTED BY THE PAGE, never inside a row: a roster row carries dnd-kit's `transform`, which would
 * re-anchor a `position: fixed` window, and a dialog inside a `<tr>` is not valid HTML.
 */
import Link from 'next/link';
import { Check, ChevronRight, Copy } from 'lucide-react';
import QuestionShell from '@/components/coaches/QuestionShell';
import { RecordFacts } from '@/components/coaches/kit';
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import { telHref, playerName, cleanNamePart } from '@/lib/coach-roster-name';
import { possessive } from '@/lib/utils';
import { playerTabHref } from '@/lib/coach-player-tabs';
import type { RepRosterPlayer } from '@/lib/types';
import styles from '../../../coaches.module.css';

/** The symbol alone (the portal's ruling for Copy in a small window), with a "Copied" the screen reader can hear. */
function CopyValue({ text, label }: { text: string; label: string }) {
  const { copied, copy } = useCopyToClipboard();
  /* ⚠ The "Copied" status is the button's SIBLING, never its child: a button's children are presentational and its
     aria-label overrides them, so a live region inside it is never announced (/review 2026-11-05). */
  return (
    <>
      <button type="button" className={styles.contactCopy} aria-label={label} onClick={() => void copy(text)}>
        {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
      </button>
      <span className={styles.srOnly} role="status">{copied ? 'Copied' : ''}</span>
    </>
  );
}

export default function FamilyContactWindow({ player, base, onClose }: {
  player: RepRosterPlayer;
  /** The team's portal base — `/{org}/coaches/teams/{team}`. */
  base: string;
  onClose: () => void;
}) {
  const guardianName = [player.guardianFirstName, player.guardianLastName].filter(Boolean).join(' ').trim();
  const child = playerName(player);
  const first = cleanNamePart(player.playerFirstName) || child || 'the player';
  const title = guardianName || 'Family contact';
  const href = playerTabHref(`${base}/roster/${player.id}`, 'family', { section: 'guardian' });
  const none = <span className={styles.contactNone}>Not on file</span>;
  return (
    <QuestionShell
      kind="question"
      open
      onClose={onClose}
      ariaLabel={`${title}, contact details`}
      title={title}
      subtitle={guardianName ? `Guardian of ${child}` : `For ${child}`}
      footer={<>
        <button type="button" className={styles.btnSecondary} onClick={onClose}>Close</button>
        <Link href={href} className={styles.btnSecondary} onClick={onClose}>
          Open {possessive(first)} Family tab <ChevronRight size={14} aria-hidden />
        </Link>
      </>}
    >
      <RecordFacts rows={[
        ['Phone', player.guardianPhone
          ? <span className={styles.contactValue}>
              <a href={telHref(player.guardianPhone)} className={styles.contactDoor}>{player.guardianPhone}</a>
              <CopyValue text={player.guardianPhone} label="Copy phone number" />
            </span>
          : none],
        ['Email', player.guardianEmail
          ? <span className={styles.contactValue}>
              <a href={`mailto:${player.guardianEmail}`} className={styles.contactDoor}>{player.guardianEmail}</a>
              <CopyValue text={player.guardianEmail} label="Copy email address" />
            </span>
          : none],
      ]} />
    </QuestionShell>
  );
}
