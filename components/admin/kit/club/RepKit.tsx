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
 *   <SaveWord saving dirty error onRetry />                      — transient; only an error stays
 */
import { useCallback, useEffect, useRef, useState, type MouseEventHandler, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, ChevronRight } from 'lucide-react';
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
export function ClubRowList({ inset = false, label, children }: { inset?: boolean; label?: string; children: ReactNode }) {
  return (
    <ul className={inset ? styles.rowListInset : styles.rowList} data-row-list={inset ? 'inset' : 'frame'} aria-label={label}>
      {children}
    </ul>
  );
}

/** A label row inside the frame (a group, a month) — a heading to assistive tech, not a record. */
export function ClubRowBand({ children }: { children: ReactNode }) {
  return (
    <li className={styles.rowBand} role="presentation">
      <span role="heading" aria-level={3}>{children}</span>
    </li>
  );
}

type RowBase = {
  title: ReactNode;
  caption?: ReactNode;
  trail?: ReactNode;
  /** The one door: a chevron, last, right — only where something opens. */
  chevron?: boolean;
  /** Worded actions BESIDE the row (a pending invitation's Resend / Cancel), never inside its link. */
  actions?: ReactNode;
  'aria-label'?: string;
};
export type ClubRowProps =
  | (RowBase & { as: 'link'; href: string })
  | (RowBase & { as: 'button'; onClick: MouseEventHandler<HTMLButtonElement>; 'aria-haspopup'?: 'dialog' })
  | (RowBase & { as?: 'static' });

export function ClubRow(props: ClubRowProps) {
  const { title, caption, trail, chevron, actions } = props;
  const opens = props.as === 'link' || props.as === 'button';
  const cls = `${styles.row}${opens ? ` ${styles.rowDoor}` : ''}`;
  const inner = (
    <>
      <span className={styles.rowMain}>
        <span className={styles.rowTitle}>{title}</span>
        {caption != null && <span className={styles.rowCaption}>{caption}</span>}
      </span>
      {(trail != null || chevron) && (
        <span className={styles.rowTrail}>
          {trail}
          {chevron && <span className={styles.rowChevron}><ChevronRight size={16} aria-hidden /></span>}
        </span>
      )}
    </>
  );
  return (
    <li className={`${styles.rowItem}${actions ? ` ${styles.rowItemWithActions}` : ''}`} data-row-list-row>
      {props.as === 'link' ? (
        <Link href={props.href} className={cls} aria-label={props['aria-label']}>{inner}</Link>
      ) : props.as === 'button' ? (
        <button type="button" className={cls} onClick={props.onClick} aria-haspopup={props['aria-haspopup']} aria-label={props['aria-label']}>
          {inner}
        </button>
      ) : (
        <div className={cls}>{inner}</div>
      )}
      {actions && <span className={styles.rowActions}>{actions}</span>}
    </li>
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
}: { tone?: 'olive' | 'bad' | 'warn'; icon?: ReactNode; children: ReactNode; role?: 'alert' | 'status' | 'note'; flush?: boolean }) {
  const toneClass = tone === 'bad' ? styles.calloutBad : tone === 'warn' ? styles.calloutWarn : '';
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
const FADE_MS = 300;
type SaveState = 'error' | 'saving' | 'dirty' | 'saved';

/**
 * The autosave word at a section's foot (house rule 2026-09-24: an edit saves as you go; ruling
 * 2026-09-20: the word is TRANSIENT). "Unsaved changes" → "Saving…" → "✓ Saved", which lingers ~2.5s
 * and fades; nothing shows at rest; only "Couldn't save · Retry" stays. The live region is never
 * unmounted (a reader only announces changes inside a region it already knows) — its text clears
 * once the word has faded. The portal's `SaveStatusPill` is the same word pinned to the window's
 * foot; this one sits where the drawing puts it, under the fields it saves.
 */
export function SaveWord({ saving, dirty, error, onRetry }: {
  saving: boolean; dirty: boolean; error?: string | null; onRetry: () => void;
}) {
  const state: SaveState = error ? 'error' : saving ? 'saving' : dirty ? 'dirty' : 'saved';
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

  if (state === 'error') {
    return (
      <span className={`${styles.saveWord} ${styles.saveWordError}`} role="status" aria-live="polite">
        {error} ·{' '}
        <button type="button" className={styles.inlineLink} onClick={onRetry}>Retry</button>
      </span>
    );
  }
  const hidden = state === 'saved' && linger !== 'shown';
  const text = state === 'saving' ? 'Saving…' : state === 'dirty' ? 'Unsaved changes' : linger === 'none' ? '' : 'Saved';
  return (
    <span
      className={`${styles.saveWord}${state === 'saved' ? ` ${styles.saveWordSaved}` : ''}${hidden ? ` ${styles.saveWordHidden}` : ''}`}
      role="status"
      aria-live="polite"
    >
      {state === 'saved' && text && <Check size={13} aria-hidden />}
      {text}
    </span>
  );
}
