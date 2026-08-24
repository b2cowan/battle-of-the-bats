'use client';
import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Download, X } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasPlanFeature, type PlanFeature } from '@/lib/plan-features';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import styles from './CoachExportButton.module.css';

/**
 * The coach portal's ONE export control (house rule 2, owner ruling 2026-08-23).
 *
 * ⚠ IT LIVES IN THE TOOLBAR ABOVE WHAT IT EXPORTS, NEVER IN A PAGE HEADER, and that is a decision
 * with history. A single hub-wide Export menu was built for Money first and could not survive the
 * screens: Budget vs. Actual has two shapes and four readings, Budget Plan has two, Expenses has
 * three sub-tabs and a tag filter. A menu above the tab bar can see none of it, so it offered a
 * generic version and hoped — which is how Budget vs. Actual ended up with two buttons both
 * labelled "Export" producing different files (owner ruling 2026-08-13, mockup artifact 96675523).
 *
 * On 2026-08-23 that became the PORTAL rule rather than a Money one, and it is now a PLACEMENT
 * rule rather than a contents one: exports live with their data whether or not their contents vary
 * with the view. Schedule proved why the narrower test was not enough — its export takes the whole
 * season in every view, so "contents vary" said header while "one place to look" said toolbar. One
 * place to look wins; a coach should never have to remember which kind of export a screen has.
 *
 * IMPORT is the mirror image and stays in the page header: what you bring in does not depend on
 * anything you have arranged on screen.
 *
 * This component owns what must not be re-decided per screen — the trigger at the portal's 44px
 * tap floor, the icon-only phone label, the phone FILE rule, plan-gating, the Save-As dialog, and
 * the busy/error path. Callers own their own download work, because they already had it.
 *
 * `MoneyExportButton` is a thin wrapper over this: the Money hub's seven tabs keep their
 * money-shaped props and it maps them onto `choices` below.
 */

export type CoachExportChoice = {
  /** Stable key — also the busy marker while this one is running. */
  id: string;
  /** In the coach's words: "Excel", "Team roster (PDF)". */
  name: string;
  /** The technical half, quiet beside the name: ".xlsx". */
  ext: string;
  /**
   * ⚠ OPTIONAL, AND USUALLY ABSENT (owner ruling 2026-08-24: *"we really don't need to overexplain
   * everything… too much text on these screens"*). A row is a name and an extension — "Excel
   * .xlsx" needs no sentence explaining what Excel is for, and the DOCUMENT picker below now
   * carries what used to be explained per row.
   *
   * A hint is reserved for the case where the file is NOT what the row implies: the Months view's
   * PDF is deliberately the whole-season statement rather than the month grid, which is a SURPRISE
   * rather than an explanation. Keep it to a few words — it prints beside the name, not under it.
   */
  hint?: string;
  /**
   * ⚠ THE PHONE FILE RULE, PER CHOICE. "A phone is offered an export only where the file is
   * something a coach can read, show or send" — a spreadsheet lands in a downloads folder nobody
   * opens on a phone; a roster PDF is held up to a parent and an .ics syncs a season into the
   * phone in their hand. Default 'drop', so a new choice is desktop-only until someone decides
   * otherwise rather than arriving on a phone by omission.
   */
  phone?: 'keep' | 'drop';
  /**
   * Plan gate. The choice resolves to ABSENT, not locked, on a plan without the feature —
   * nothing to offer beats a choice that refuses. Leave unset where "who may see this" is a ROLE
   * question rather than a plan one (the coach's own team's contact sheet), and gate at the
   * caller instead by not passing the choice at all.
   */
  feature?: PlanFeature;
  /**
   * WHICH DOCUMENT this is a file type of.
   *
   * Two rows sharing a name are two FORMATS of one thing; two names are two different DOCUMENTS,
   * and the dialog grows a picker for them. It replaces the "Or a different document:" sentence
   * that used to stand in for this control — a line that was easy to scroll past, and that left
   * "Excel" appearing twice in one list meaning two different files, one of them carrying every
   * child's date of birth (owner ruling 2026-08-24).
   *
   * ⚠ Leave it UNSET when the screen produces one document — a dropdown with a single option is
   * worse than no dropdown, so the picker is absent and the dialog is just a labelled list. Set it
   * on every choice or none: a half-tagged list has no honest grouping.
   *
   * The picker is also what lets two documents carry DIFFERENT file types — the roster's wall copy
   * has three, its contacts sheet has two — which the one flat list could not express.
   */
  document?: string;
  /** Does the work. May throw; the message lands in the dialog and the coach can pick again. */
  run: () => Promise<void> | void;
};

export default function CoachExportButton({
  /** Titles the dialog — "Export Roster". The screen's own noun, not the word "data". */
  label,
  /** Most-wanted first. Anything plan-gated away is simply not here. */
  choices,
  /**
   * A different mark for the phone, where the surviving choice is not a file download —
   * Schedule's calendar sync. Omit and the download arrow stands at every width.
   */
  phoneIcon,
  /** Announced on the trigger, which is icon-only on a phone. Default "Export". */
  ariaLabel = 'Export',
  /** Nothing to export yet. Renders greyed rather than absent: the row keeps its shape. */
  disabled = false,
  className,
}: {
  label: string;
  choices: CoachExportChoice[];
  phoneIcon?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const { currentOrg } = useOrg();
  const available = choices.filter(
    c => !c.feature || (currentOrg ? hasPlanFeature(currentOrg.planId, c.feature) : false),
  );

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  /**
   * ⚠ CLOSE THE DIALOG WHENEVER THE URL MOVES — this is not tidiness, it prevents a portal-wide
   * lock-up (/review finding, 2026-08-13).
   *
   * Money tabs stay MOUNTED once visited (`display:none` while inactive), so a dialog left open on
   * a tab the coach navigates away from stays mounted too — invisible, but still registered in the
   * portal's shared overlay counter. That counter pins `body { overflow: hidden }` and hides the
   * bottom nav, and it lives at the coaches-LAYOUT level, so it survives the tab change. The result
   * would be a coach unable to scroll anywhere in the portal, with nothing on screen explaining
   * why. The backdrop swallows ordinary clicks, so the reachable route is the BROWSER'S BACK BUTTON
   * (or a phone's back gesture), which changes the query string without touching the dialog.
   *
   * Roster and Schedule change the query string underneath it too (`?view=depth`, the calendar
   * cursor), so the same watch keeps a dialog from outliving the view it was opened on. ⚠ They
   * also keep it mounted across a TEAM switch, which the query string cannot see — that is what
   * the pathname half below exists for, and it is not a footnote.
   */
  const closeDialog = useCallback(() => setOpen(false), []);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  /**
   * ⚠ PATHNAME IS WATCHED TOO, AND IT IS THE HALF THAT PROTECTS A CHILD'S CONTACT DETAILS
   * (/review, 2026-08-24 — High, confirmed). Money inherited a query-string-only watch because
   * every Money tab lives at ONE path and moves by `?section=`. Roster and Schedule do not: a
   * coach with two teams moves between `/teams/A/roster` and `/teams/B/roster`, where the query
   * string is identical — so the watch never fired, and this page **does not remount on a team
   * switch** (see the roster page's own sequence-token comment).
   *
   * The dialog covers the screen and names no team, so the coach could not have seen the switch
   * happen behind it. Left open across a back-navigation it would have run "Roster with contacts"
   * against the PREVIOUS team's players — still in state until the new fetch lands — into a file
   * already titled for the team they had just moved to. A cross-team document of children's
   * birthdates and guardian emails, produced by two ordinary taps.
   *
   * Closing on a path change is right on every surface: within Money a path change means leaving
   * the hub, where closing was always correct.
   */
  const navKey = `${pathname}?${searchParams.toString()}`;
  useEffect(() => { closeDialog(); }, [navKey, closeDialog]);

  if (available.length === 0) return null;

  /* The whole control goes when nothing it can produce survives a phone — an empty toolbar slot
     beats a button that downloads something unopenable. */
  const triggerPhone = available.some(c => c.phone === 'keep') ? 'keep' : 'drop';

  async function pick(choice: CoachExportChoice) {
    setBusy(choice.id);
    setError('');
    try {
      await choice.run();
      setOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'That export could not be built.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`${shared.btnSecondary} ${styles.trigger}${phoneIcon ? ` ${styles.hasPhoneIcon}` : ''}${className ? ` ${className}` : ''}`}
        data-phone={triggerPhone}
        disabled={disabled}
        onClick={() => { setError(''); setOpen(true); }}
        /* Icon-only on phones like every toolbar secondary — the words survive here, for a screen
           reader and for a tooltip, exactly as they do on all seven Money tabs. */
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        <span className={styles.iconWide} aria-hidden><Download size={14} /></span>
        {phoneIcon && <span className={styles.iconPhone} aria-hidden>{phoneIcon}</span>}
        <span className={shared.headerBtnLabel}>Export</span>
      </button>

      {open && (
        <ExportChoiceDialog
          label={label}
          choices={available}
          busy={busy}
          error={error}
          onPick={pick}
          onClose={closeDialog}
        />
      )}
    </>
  );
}

/**
 * Save As, essentially: the coach has said WHAT, this asks in which form. Each choice is a
 * full-width card rather than a radio — there is no Confirm step, so picking IS the action.
 *
 * ⚠ TWO QUESTIONS, TWO CONTROLS (owner ruling 2026-08-24). On Roster and Player Dues this dialog
 * is really asking *which document* and *which file type*, and until now it flattened both into
 * one list separated by a sentence. That cost three things: "Excel" appeared twice meaning two
 * different files — one of them carrying every child's date of birth and every parent's phone
 * number; a sentence was doing a control's job; and the privacy warning was attached to ONE row
 * rather than to the document, so the spreadsheet below it — the same data, easier to forward —
 * got the softer description of the two.
 *
 * A DOCUMENT select appears only when there is more than one document to pick, and it opens on
 * the first one, which callers order safest-first. So the everyday export stays a single tap and
 * the contacts sheet becomes a deliberate act, which is what it should be.
 *
 * ⚠ Nothing is drawn BESIDE each row. Two in-menu attempts were rejected on sight before this
 * shape was reached: format chips on every row, then a muted default label plus a "···". The
 * lesson, worth carrying anywhere: anything drawn beside every item in a list is drawn as many
 * times as the list is long.
 */
function ExportChoiceDialog({
  label,
  choices,
  busy,
  error,
  onPick,
  onClose,
}: {
  label: string;
  choices: CoachExportChoice[];
  busy: string | null;
  error: string;
  onPick: (choice: CoachExportChoice) => void;
  onClose: () => void;
}) {
  useOverlayOpen(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /**
   * The documents on offer, in the order the caller listed them — callers put the SAFE one first
   * and the dialog opens on it, so the everyday export stays one tap.
   *
   * ⚠ Derived from what SURVIVED the plan and role filters, not from what the caller wrote. A
   * coach without family-contact access is passed no contacts rows at all, so for them there is
   * one document and no picker — the same condition that used to drop the "Or a different
   * document:" line.
   */
  const documents = [...new Set(choices.map(c => c.document).filter((d): d is string => !!d))];
  /* ⚠ Named `docName`, not `document`: a state variable called `document` shadows the DOM global
     inside this whole component, which is a trap for the next person who reaches for it. */
  const [picked, setPicked] = useState(documents[0] ?? '');
  /* A selection that no longer exists falls back to the first rather than showing nothing —
     reachable if plan or role resolution narrows the list after the dialog opened. */
  const docName = documents.includes(picked) ? picked : (documents[0] ?? '');
  const shown = documents.length > 1
    /* ⚠ An UNTAGGED row falls into the FIRST document rather than disappearing. Every choice is
       supposed to name its document (see the type), but a half-tagged list should degrade to
       showing a row in the wrong group, never to losing an export with no error anywhere. */
    ? choices.filter(c => (c.document ?? documents[0]) === docName)
    : choices;
  /* ⚠ Caller responsibility, deliberately not machinery here: EVERY document needs at least one
     phone-surviving file type, or a coach who opens the picker on a phone lands on an empty list.
     The phone rule is CSS (the server and browser disagree about width on first paint), so this
     component cannot see which rows survived. Both surfaces that have two documents offer a PDF
     in each, which is what makes it true today. */
  const fieldId = useId();

  return (
    <div
      className={`${shared.modalOverlay} ${shared.centeredOnMobile}`}
      onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* A hand-rolled title+X row, NOT CoachModalHeader — that component is for SHEET modals and
          its own contract says a centered dialog keeps the simple row instead. */}
      <div className={`${shared.modal} ${styles.dialog}`} role="dialog" aria-modal="true" aria-label={`Export ${label}`}>
        <div className={shared.modalHeader}>
          <h2 className={shared.modalTitle}>Export {label}</h2>
          <button type="button" className={shared.modalCloseBtn} aria-label="Close without exporting" onClick={onClose}>
            <X size={18} aria-hidden />
          </button>
        </div>
        {documents.length > 1 && (
          <div className={`${shared.field} ${styles.field}`}>
            <label className={shared.label} htmlFor={fieldId}>Document</label>
            {/* The portal's own form select (`shared.select`), not the reporting family's filter
                pill: this is a one-value FORM field, which is a dropdown by standing ruling, and
                a native select is what every other field in the portal uses — free keyboard
                support and the platform's own picker on a phone. */}
            <select
              id={fieldId}
              className={shared.select}
              value={docName}
              disabled={busy !== null}
              onChange={e => setPicked(e.target.value)}
            >
              {documents.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}
        <div className={`${shared.field} ${styles.field}`}>
          <span className={shared.label}>File type</span>
          <div className={styles.list}>
            {shown.map(c => (
              <button
                key={c.id}
                type="button"
                className={styles.choice}
                /* The same phone rule, one level in: a spreadsheet is not offered on a phone even
                   on a screen that also makes a PDF. */
                data-phone={c.phone === 'keep' ? 'keep' : 'drop'}
                disabled={busy !== null}
                onClick={() => onPick(c)}
              >
                <span className={styles.name}>
                  {c.name}
                  <span className={styles.ext}>{c.ext}</span>
                  {/* Beside the name, not under it: a row is one line unless the file is not what
                      the row implies, and then it says so in a few words. */}
                  {(busy === c.id || c.hint) && (
                    <span className={styles.hint}>
                      {busy === c.id ? 'Preparing…' : c.hint}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
        {error && <p className={`${shared.errorText} ${styles.error}`} role="status">{error}</p>}
      </div>
    </div>
  );
}
