'use client';
/**
 * THE REP-TEAMS SCREENS' SHARED PARTS (Club Tier Stage 2, session 3) — the Coaches Portal's section,
 * row list, chip, callout and save word, as components the club's screens render rather than classes
 * each page re-assembles (owner ruling: a shared component beats a shared class). The portal's own
 * `CoachPageSection` / `CoachRowList` / `SaveStatusPill` import the portal's 16,000-line stylesheet,
 * which the admin shell does not load, so their shapes are restated here BY VALUE
 * (`RepKit.module.css`) — the reason `AdminPageHeader` restates `CoachPageHeader`.
 *
 *   <ClubSection title="Coaches" meta="3 people" actions={…}>   — the card, heading INSIDE
 *   <ClubRowList inset>                                          — inside a section (it paints)
 *     <ClubRowBand>Boys · 6 teams</ClubRowBand>
 *     <ClubRow as="link" href title caption chevron />           — the whole row is the target
 *   <RepChip tone="good">Live</RepChip>                          — one chip, uppercase mono
 *   <Callout tone="bad" icon={…}>…</Callout>                     — a white card, a coloured edge
 *   <LoadFailed title onRetry /> · <PageLoading header />        — a screen's read failed / in flight
 *   useDeferredLoad(ready, load) · useLatestRead()               — the first read; only the newest writes
 *   <SavePill saving dirty error held onRetry />                 — pinned to the window, transient; only a failure stays
 *   <RecordDelete onClick>Delete this payee</RecordDelete>       — a record's Delete, at the end of its body
 *   <RecordAction icon={…} onClick>Archive this venue</RecordAction> — its rare door that undoes or moves (same place)
 */
import { useCallback, useEffect, useRef, useState, type MouseEventHandler, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, ChevronRight, Info, Trash2 } from 'lucide-react';
import { isLiveSeasonStatus } from '@/lib/season-live';
import { twoOpenPageNote, twoOpenTitle } from '@/lib/club-season-words';
import styles from './RepKit.module.css';
import ck from './ClubKit.module.css';

export { styles as repKit };

/** A section in the portal's shape: a card with its heading inside, a count beside it, actions right. */
export function ClubSection({
  id, title, meta, actions, list = false, children, className,
}: {
  id?: string;
  title?: ReactNode;
  /** FACTS only (a count) — never a control; controls go in `actions`. */
  meta?: ReactNode;
  actions?: ReactNode;
  /** The body is a row list: rows run edge to edge and the section paints their ground. */
  list?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section id={id} className={`${styles.section}${className ? ` ${className}` : ''}`} aria-labelledby={title ? headingId : undefined}>
      {title != null && (
        <div className={styles.sectionHead}>
          <h2 id={headingId} className={styles.sectionTitle}>{title}</h2>
          {meta != null && <span className={styles.sectionMeta}>{meta}</span>}
          {actions != null && <div className={styles.sectionActions}>{actions}</div>}
        </div>
      )}
      <div className={list ? styles.sectionBodyList : styles.sectionBody}>{children}</div>
    </section>
  );
}

/** The row list — framed on the page, or `inset` inside a section that already paints the ground. */
export function ClubRowList({
  inset = false, label, children, 'data-sandbox-tour': tourAnchor,
}: {
  inset?: boolean;
  label?: string;
  children: ReactNode;
  /** The demo tour anchors on a LIST, never on a row — written as the literal attribute at the call
   *  site (`data-sandbox-tour="…"`), which is what the tour-anchor guard's static scan reads. */
  'data-sandbox-tour'?: string;
}) {
  return (
    <ul
      className={inset ? styles.rowListInset : styles.rowList}
      data-row-list={inset ? 'inset' : 'frame'}
      aria-label={label}
      data-sandbox-tour={tourAnchor}
    >
      {children}
    </ul>
  );
}

/** ONE frame around several banded lists (the game-day board's four, Results' bands, Check-in's
 *  divisions): the frame paints the ground once, each list inside it is `inset` and opens on its band. */
export function ClubRowFrame({ children }: { children: ReactNode }) {
  return <div className={styles.rowFrame} data-row-list="frame">{children}</div>;
}

/** A label row inside the frame (a group, a month) — a heading to assistive tech, not a record.
 *  `count` is the band's one figure ("To finalize 2", "U11 Girls 2 of 6 in"), said once, beside it. */
export function ClubRowBand({ children, count }: { children: ReactNode; count?: ReactNode }) {
  return (
    <li className={styles.rowBand} role="presentation">
      <span role="heading" aria-level={3}>
        {children}
        {count != null && <span className={styles.rowBandCount}> {count}</span>}
      </span>
    </li>
  );
}

type RowBase = {
  title: ReactNode;
  caption?: ReactNode;
  /** The row's ONE lead mark (standard §3.10.7) — an icon in a column of its own before the title, at
   *  every width (How it finished's trophy, Tournament admin redesign Stage 4). The caller colours it. */
  mark?: ReactNode;
  /** The date column (the portal's `lead`): a column of its own at a desk; on a phone it moves onto
   *  the caption's line, ahead of the caption, joined by " ·". Formatted by the caller. */
  lead?: ReactNode;
  /** On a phone, the lead and caption read ABOVE the title (Results' "when" line over its two teams). */
  captionFirst?: boolean;
  trail?: ReactNode;
  /** The one door: a chevron, last, right — only where something opens. */
  chevron?: boolean;
  /** Worded actions BESIDE the row (a pending invitation's Resend / Cancel), never inside its link. */
  actions?: ReactNode;
  /**
   * The ONE worded action a list exists to do (Finalize, Check in) — in the row, beside its chevron, at
   * every width (A11 Option 1, owner 2026-09-29: the portal's form for a list whose rows fit a phone).
   * A sibling of the row's own control, never nested in it; the row's tap covers the rest of the row,
   * the chevron included, so the two targets touch and never overlap.
   */
  beside?: ReactNode;
  'aria-label'?: string;
};
export type ClubRowProps =
  /** `external`: a door OUT of the admin (a sealed event's public record) — a new tab, the caller's ↗ as its trail. */
  | (RowBase & { as: 'link'; href: string; external?: boolean })
  | (RowBase & { as: 'button'; onClick: MouseEventHandler<HTMLButtonElement>; 'aria-haspopup'?: 'dialog' })
  | (RowBase & { as?: 'static' });

export function ClubRow(props: ClubRowProps) {
  const { title, caption, mark, lead, captionFirst, trail, chevron, actions, beside } = props;
  const opens = props.as === 'link' || props.as === 'button';
  const cls = `${styles.row}${opens ? ` ${styles.rowDoor}` : ''}`;
  const chevronEl = <span className={styles.rowChevron}><ChevronRight size={16} aria-hidden /></span>;
  const inner = (
    <>
      {mark != null && <span className={styles.rowMark} aria-hidden>{mark}</span>}
      {lead != null && <span className={styles.rowLead}>{lead}</span>}
      <span className={styles.rowMain}>
        <span className={styles.rowTitle}>{title}</span>
        {caption != null && <span className={styles.rowCaption}>{caption}</span>}
      </span>
      {(trail != null || (chevron && !beside)) && (
        <span className={styles.rowTrail}>
          {trail}
          {chevron && !beside && chevronEl}
        </span>
      )}
    </>
  );
  const itemCls = `${styles.rowItem}${actions ? ` ${styles.rowItemWithActions}` : ''}${beside ? ` ${styles.rowItemBeside}` : ''}`;
  return (
    <li className={itemCls} data-row-list-row data-caption-first={captionFirst || undefined}>
      {props.as === 'link' ? (
        <Link
          href={props.href}
          className={cls}
          aria-label={props['aria-label']}
          {...(props.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {inner}
        </Link>
      ) : props.as === 'button' ? (
        <button type="button" className={cls} onClick={props.onClick} aria-haspopup={props['aria-haspopup']} aria-label={props['aria-label']}>
          {inner}
        </button>
      ) : (
        <div className={cls}>{inner}</div>
      )}
      {beside && <span className={styles.rowBeside}>{beside}</span>}
      {/* Beside a worded action the chevron still ends the row (the drawing's "a chevron ends every
          row"): drawn after the action, and covered by the row's own stretched tap, not a second control. */}
      {beside && chevron && chevronEl}
      {actions && <span className={styles.rowActions}>{actions}</span>}
    </li>
  );
}

/** The worded action beside a row's chevron (`ClubRow` `beside`): olive on white, never lime — the
 *  lime is one main action per screen (A12, owner 2026-09-29). 44px on a phone, the admin's 38px above. */
export function RowAction({
  children, onClick, disabled, quiet = false, icon, 'aria-label': ariaLabel,
}: {
  children: ReactNode;
  onClick: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  /** The undoing action (Undo) — the quiet ink, not the olive. */
  quiet?: boolean;
  icon?: ReactNode;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      className={`${styles.rowAction}${quiet ? ` ${styles.rowActionQuiet}` : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {icon}{children}
    </button>
  );
}

/**
 * A record's Delete — where the 2026-09-30 ruling puts it (it ends the record's body, alone, red, asking first) in
 * the coaches portal's look: `GuardedDelete`'s door, a trash icon and the words, red at body weight, underlined only
 * on hover (owner 2026-10-09: "I don't think this is our standard product format for delete buttons" — the admin's
 * records had each spelled their own bold, icon-less red words, which read as a link). ONE part for every admin
 * record (a tournament, a team, a club payee), so the three cannot drift apart again. The asking is the caller's: its
 * question opens on top, as every admin question does. 44px on a phone, the admin's control height above.
 */
export function RecordDelete({ children, onClick, disabled }: {
  children: ReactNode;
  onClick: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
}) {
  return (
    <button type="button" className={styles.recordDelete} onClick={onClick} disabled={disabled}>
      <Trash2 size={13} aria-hidden /> {children}
    </button>
  );
}

/**
 * A RECORD'S RARE DOOR THAT IS NOT A DELETE — Archive, Bring back, Merge (owner, 2026-10-09, at a venue's window walking
 * Club Tier §288: "does archive need to have a full pinned row above the footer?" → no). RecordDelete's shape and place —
 * icon and words at body weight, underlined only on hover, ending the body — in the text's own colour, because it can be
 * undone or moves the record rather than destroying it. It never takes a foot row of its own: a rare button alone in a
 * pinned row kept a whole bar of chrome on screen at every scroll for something pressed once in a record's life.
 */
export function RecordAction({ icon, children, onClick, disabled }: {
  icon: ReactNode;
  children: ReactNode;
  onClick: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
}) {
  return (
    <button type="button" className={styles.recordAction} onClick={onClick} disabled={disabled}>
      {icon} {children}
    </button>
  );
}

export type ChipTone = 'good' | 'warn' | 'bad' | 'info' | 'neutral';
const CHIP_TONE: Record<ChipTone, string> = {
  good: styles.chipGood, warn: styles.chipWarn, bad: styles.chipBad, info: styles.chipInfo, neutral: '',
};

/** One chip, uppercase mono (Ask 8 ruling 7). Colour never carries a verdict alone — it has words. */
export function RepChip({ tone = 'neutral', children }: { tone?: ChipTone; children: ReactNode }) {
  return <span className={`${styles.chip}${CHIP_TONE[tone] ? ` ${CHIP_TONE[tone]}` : ''}`}>{children}</span>;
}

/** A status callout: a white card with a coloured edge (the live-red edge for a thing only the club can fix).
 *  `flush` drops its own bottom margin, for a host that spaces its children with `gap` (a window body). */
export function Callout({
  tone = 'olive', icon, children, role, flush = false,
}: {
  /** `info`: the blue edge — a fact about whose something is ("held by the team", Club Stage 3a). */
  tone?: 'olive' | 'bad' | 'warn' | 'info'; icon?: ReactNode; children: ReactNode; role?: 'alert' | 'status' | 'note'; flush?: boolean;
}) {
  const toneClass = tone === 'bad' ? styles.calloutBad : tone === 'warn' ? styles.calloutWarn : tone === 'info' ? styles.calloutInfo : '';
  return (
    <div className={`${styles.callout}${toneClass ? ` ${toneClass}` : ''}`} role={role} style={flush ? { margin: 0 } : undefined}>
      {icon}
      <div className={styles.calloutBody}>{children}</div>
    </div>
  );
}

/** A screen's read failed: what did not load, that nothing changed, and Try again. Without
 *  `onRetry` it is a refusal (the team is not one you can open) — there is nothing to retry. */
export function LoadFailed({ title, sub, onRetry }: { title: ReactNode; sub?: ReactNode; onRetry?: () => void }) {
  return (
    <Callout tone="bad" role="alert" icon={<AlertTriangle size={16} aria-hidden />}>
      <b>{title}</b>
      {sub != null && <span className={styles.calloutSub}>{sub}</span>}
      {onRetry && (
        <>
          <span className={styles.calloutSub}>Nothing was changed. Check your connection and try again.</span>
          <div className={styles.calloutActions}>
            <button type="button" className="btn btn-outline" onClick={onRetry}>Try again</button>
          </div>
        </>
      )}
    </Callout>
  );
}

/** A screen's reads can overlap — a reload after a write, or the same page opened on another team —
 *  and only the newest may write its answer (/review). `begin()` starts a read and returns the check
 *  to make after every await: true while no later read has started. */
export function useLatestRead(): () => () => boolean {
  const gen = useRef(0);
  return useCallback(() => {
    const mine = ++gen.current;
    return () => mine === gen.current;
  }, []);
}

/** A team sub-page while the team holds more than one open season (a stray from before Stage 2):
 *  say so, name the season on show, and send the fix to the team page (/review). Nothing otherwise. */
export function TwoOpenNote({ teamName, seasons, showingName, teamHref }: {
  teamName: string; seasons: readonly { status: string }[]; showingName: string; teamHref: string;
}) {
  const open = seasons.filter(s => isLiveSeasonStatus(s.status)).length;
  if (open < 2) return null;
  return (
    <Callout tone="warn" role="note" icon={<AlertTriangle size={16} aria-hidden />}>
      <b>{twoOpenTitle(teamName, open)}</b>
      <span className={styles.calloutSub}>{twoOpenPageNote(showingName)}</span>
      <div className={styles.calloutActions}>
        <Link href={teamHref} className="btn btn-outline">Open the team page</Link>
      </div>
    </Callout>
  );
}

/** A screen's first read in flight: its header, and one quiet line. */
export function PageLoading({ header }: { header: ReactNode }) {
  return <div className={styles.page}>{header}<p className={ck.loading}>Loading…</p></div>;
}

/** Runs a screen's first read once the org has loaded — a frame later, so the read's first
 *  state write is not the effect's own (react-hooks/set-state-in-effect). */
export function useDeferredLoad(ready: boolean, load: () => unknown) {
  useEffect(() => {
    if (!ready) return;
    const frame = window.requestAnimationFrame(() => { void load(); });
    return () => window.cancelAnimationFrame(frame);
  }, [ready, load]);
}

/** The compact empty state: what is missing in one sentence, and the one action (lime). */
export function EmptyCard({ icon, title, children, action }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.empty}>
      {icon}
      <h2 className={styles.emptyTitle}>{title}</h2>
      {children != null && <p className={styles.emptyText}>{children}</p>}
      {action != null && <div className={styles.emptyActions}>{action}</div>}
    </div>
  );
}

const LINGER_MS = 2500;
/** A sentence notice the reader didn't cause (the standing rule's ~8s). */
const NEWS_LINGER_MS = 8000;
const FADE_MS = 300;
type SaveState = 'held' | 'error' | 'saving' | 'dirty' | 'saved';

/**
 * The autosave word — the portal's `SaveStatusPill`, restated for the admin shell: a TRANSIENT pill
 * pinned to the window's bottom-right corner (house rule 2026-09-24: an edit saves as you go; ruling
 * 2026-09-20: pinned, so it is seen wherever the page is scrolled, and transient, so it is never
 * furniture over the work). "Unsaved changes" → "Saving…" → "✓ Saved", which lingers ~2.5s and fades;
 * nothing shows at rest. Only a failure stays: "Couldn’t save · Retry", or the reason an edit is HELD
 * ("Give the team a name to save it.") — no Retry there, since retrying cannot help.
 *
 * It sat at Team details' foot, where the Stage 2 drawing put it, until 2026-09-29 (owner, §249 walk:
 * "our method of showing saving is the floating pill"): the foot scrolls away with the page, which is
 * the placement the 2026-09-20 ruling rejected — a failed save that scrolls off-screen is a defect.
 *
 * The live region is never unmounted (a reader only announces changes inside a region it already
 * knows) — the pill fades by opacity and its text clears once hidden. Retry lands focus on the pill
 * first, because the button it replaces leaves in the same render.
 */
export function SavePill({ saving, dirty, error, held, onRetry, inline = false }: {
  saving: boolean; dirty: boolean; error?: string | null;
  /** Why the edit is held right now (a required field emptied), or null. Shown while dirty. */
  held?: string | null;
  onRetry: () => void;
  /** INSIDE A WINDOW (KitDialog's `status`): the same floating pill, pinned by the window to its body's
   *  bottom-right corner rather than to the viewport, which a window covers (owner, 2026-10-01 — from
   *  2026-09-30 it was a frameless word in the window's head). */
  inline?: boolean;
}) {
  const state: SaveState = held && dirty ? 'held' : error ? 'error' : saving ? 'saving' : dirty ? 'dirty' : 'saved';
  const pillRef = useRef<HTMLDivElement>(null);
  const [prevState, setPrevState] = useState<SaveState>(state);
  const [linger, setLinger] = useState<'none' | 'shown' | 'fading'>('none');
  if (state !== prevState) {
    setPrevState(state);
    // Only a transition INTO saved is a save landing; mounting at rest says nothing.
    setLinger(state === 'saved' ? 'shown' : 'none');
  }
  useEffect(() => {
    if (linger === 'none') return;
    const t = window.setTimeout(() => setLinger(linger === 'shown' ? 'fading' : 'none'), linger === 'shown' ? LINGER_MS : FADE_MS);
    return () => window.clearTimeout(t);
  }, [linger]);

  // Anything but "saved" holds the pill on screen; "saved" lingers, fades, then leaves.
  const phase = state !== 'saved' ? 'shown' : linger === 'none' ? 'hidden' : linger;

  return (
    /* -1: never in the tab order; focusable as the landing spot when Retry's own button leaves. */
    <div ref={pillRef} tabIndex={-1} className={inline ? `${styles.savePill} ${styles.savePillInline}` : styles.savePill} data-state={state} data-phase={phase}>
      <span className={styles.saveStatus} aria-live="polite">
        {phase === 'hidden' ? null
          : state === 'held' ? held
            : state === 'error' ? (
              <>
                {error} ·{' '}
                <button
                  type="button"
                  className={styles.saveRetry}
                  disabled={saving}
                  onClick={() => { pillRef.current?.focus({ preventScroll: true }); onRetry(); }}
                >
                  Retry
                </button>
              </>
            )
              : state === 'saving' ? 'Saving…'
                : state === 'dirty' ? 'Unsaved changes'
                  : <><Check size={13} aria-hidden /> Saved</>}
      </span>
    </div>
  );
}

/**
 * A one-off confirmation — "Draft created from Riverdale Season Opener", "Champions link copied"
 * (Tournament admin redesign Stage 4). The save word's pill, look and fade, for a thing that just
 * HAPPENED rather than a save: the same transient rule (it lingers ~2.5s, fades, then `onDone` unmounts
 * it), never furniture over the work. Give it a `key` per notice so a second one restarts the linger.
 *
 * `news`: something the reader did NOT just do — the organizer sending a volunteer's score back (Stage 6,
 * A32) — lingers as long as a sentence notice (~8s, the standing rule), because nobody is looking for it.
 *
 * `action`: the notice's ONE action — Undo after a move (Tournament admin redesign Stage 3, A36: "Moved to 5:30 p.m. ·
 * Diamond 3 · Undo"). Shared by every admin screen that wears the kit, club screens included. A notice with an action
 * lingers as a sentence notice (~8s), holds while the pointer or the keyboard is on it (a timed control a person can
 * reach), and leaves the moment its action is taken. The pill still never blocks a tap beside it; only it takes one.
 */
export function NoticePill({ message, onDone, news = false, inline = false, action }: {
  message: string; onDone: () => void; news?: boolean;
  /** INSIDE A WINDOW (KitDialog's `status`): pinned by the window to its body's corner, as `SavePill inline` is. */
  inline?: boolean;
  action?: { label: string; onAction: () => void };
}) {
  const [phase, setPhase] = useState<'shown' | 'fading'>('shown');
  const [held, setHeld] = useState(false);
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; }, [onDone]);
  const hasAction = !!action;
  useEffect(() => {
    if (held) return;
    const linger = news || hasAction ? NEWS_LINGER_MS : LINGER_MS;
    const fade = window.setTimeout(() => setPhase('fading'), linger);
    const leave = window.setTimeout(() => done.current(), linger + FADE_MS);
    return () => { window.clearTimeout(fade); window.clearTimeout(leave); };
  }, [news, hasAction, held]);
  const hold = () => { setPhase('shown'); setHeld(true); };
  const release = () => setHeld(false);
  return (
    <div
      className={inline ? `${styles.savePill} ${styles.savePillInline}` : styles.savePill}
      data-state="saved" data-phase={phase} data-action={hasAction ? '' : undefined} role="status"
      onMouseEnter={hasAction ? hold : undefined}
      onMouseLeave={hasAction ? release : undefined}
      onFocus={hasAction ? hold : undefined}
      onBlur={hasAction ? e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) release(); } : undefined}
    >
      <span className={`${styles.saveStatus}${news ? ` ${styles.saveStatusNews}` : ''}`}>{news ? <Info size={13} aria-hidden /> : <Check size={13} aria-hidden />} {message}</span>
      {action && (
        <button type="button" className={styles.noticeAction} onClick={() => { action.onAction(); done.current(); }}>
          {action.label}
        </button>
      )}
    </div>
  );
}
