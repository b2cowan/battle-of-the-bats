'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAnyOverlayOpen } from '@/lib/coaches-overlay';
import { CheckSquare, Check, ChevronDown, ChevronUp } from 'lucide-react';
import TryoutDayCard from './TryoutDayCard';
import TryoutRubricCard from './TryoutRubricCard';
import TryoutEvaluatorsCard from './TryoutEvaluatorsCard';
import styles from './TryoutSetupChecklist.module.css';

/**
 * Stage 1 as the checklist it secretly is (owner-approved mockup, 2026-08-17): ONE "Get set up"
 * card with three rows — done-mark, REQUIRED/OPTIONAL tag, one-line status, one action — instead
 * of three stacked full-height cards. Each row expands in place to the full manager the old cards
 * held; done rows collapse to one-line receipts. Bodies stay MOUNTED while collapsed (hidden via
 * CSS) so each manager loads its data and can report status up regardless of row state.
 */

export interface SetupItemStatus { done: boolean; summary: string | null }
type ItemKey = 'dates' | 'scorecard' | 'helpers';

interface Props {
  /** Coach team API base, e.g. `/api/coaches/{orgSlug}/teams/{teamId}`. */
  apiBase: string;
  canWrite: boolean;
  sport?: string | null;
  onError?: (msg: string) => void;
  /** Fired when an item's status CHANGES after its first report (add/edit/delete) — the page
   *  refreshes the flow overview so the guide, tabs, and peek-ahead prompts stay honest. */
  onChanged?: () => void;
  /** Live blind state from the overview — passed through to the dates row's hint. */
  blind?: boolean;
}

const ROW_META: Record<ItemKey, { title: string; required: boolean; emptyStatus: string }> = {
  dates: {
    title: 'Tryout dates', required: true,
    emptyStatus: 'No sessions yet — they show on your schedule once added.',
  },
  scorecard: {
    title: 'Evaluation scorecard', required: true,
    emptyStatus: 'What you rate players on. Start from the ready-made starter and tweak it.',
  },
  helpers: {
    title: 'Helpers who score', required: false,
    emptyStatus: 'Share a scoring link with an assistant — no account needed.',
  },
};

/** Top-level on purpose: a component defined inside the parent's render would be a NEW type every
 *  render, remounting the manager beneath it (dropping fetched data and any open modal). */
function Row({ itemKey, status, isOpen, onToggle, children }: {
  itemKey: ItemKey;
  status: SetupItemStatus | undefined;
  isOpen: boolean;
  onToggle: (key: ItemKey) => void;
  children: ReactNode;
}) {
  const meta = ROW_META[itemKey];
  const done = status?.done ?? false;
  return (
    <div className={styles.row}>
      <div className={styles.rowBar}>
        <button
          type="button"
          className={styles.rowToggle}
          aria-expanded={isOpen}
          onClick={() => onToggle(itemKey)}
        >
          <span className={`${styles.tick} ${done ? styles.tickDone : ''}`} aria-hidden>
            {done && <Check size={13} strokeWidth={3} />}
          </span>
          <span className={styles.rowMain}>
            <span className={styles.rowTitle}>
              {meta.title}
              {!done && (
                <span className={meta.required ? styles.tagReq : styles.tagOpt}>
                  {meta.required ? 'Required' : 'Optional'}
                </span>
              )}
            </span>
            <span className={done && status?.summary ? styles.rowStatusFilled : styles.rowStatus}>
              {/* Quiet until the manager's first report — flashing "No sessions yet" over data
                  that's still loading is a lie for the second it lasts. */}
              {status ? (status.summary ?? meta.emptyStatus) : '…'}
            </span>
          </span>
          <span className={styles.chev} aria-hidden>{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
        </button>
      </div>
      <div className={isOpen ? styles.rowBody : styles.rowBodyHidden}>{children}</div>
    </div>
  );
}

export default function TryoutSetupChecklist({ apiBase, canWrite, sport, onError, onChanged, blind }: Props) {
  const [status, setStatus] = useState<Partial<Record<ItemKey, SetupItemStatus>>>({});
  const [open, setOpen] = useState<Record<ItemKey, boolean>>({ dates: false, scorecard: false, helpers: false });
  const autoOpened = useRef(false);

  // Reports merge into state (returning `prev` unchanged when nothing moved keeps re-renders and
  // the change-effect below quiet); the CHANGE detection lives in an effect so onChanged never
  // fires from inside an updater and refs are never read during render.
  const report = (key: ItemKey) => (s: SetupItemStatus) =>
    setStatus(prev => {
      const was = prev[key];
      if (was && was.done === s.done && was.summary === s.summary) return prev;
      return { ...prev, [key]: s };
    });

  const seenStatus = useRef<Partial<Record<ItemKey, SetupItemStatus>>>({});
  const onChangedRef = useRef(onChanged);
  useEffect(() => { onChangedRef.current = onChanged; }, [onChanged]);
  useEffect(() => {
    let changed = false;
    for (const key of Object.keys(status) as ItemKey[]) {
      const cur = status[key]!;
      const was = seenStatus.current[key];
      if (was && (was.done !== cur.done || was.summary !== cur.summary)) changed = true;
      seenStatus.current[key] = cur;
    }
    // A first report is a LOAD, not a change — only later movement refreshes the overview.
    if (changed) onChangedRef.current?.();
  }, [status]);

  // First load: open the first REQUIRED row that still needs doing — once, and never again after
  // the coach starts steering rows themself.
  useEffect(() => {
    if (autoOpened.current) return;
    const dates = status.dates, scorecard = status.scorecard;
    if (!dates || !scorecard) return;
    autoOpened.current = true;
    if (!dates.done) setOpen(o => ({ ...o, dates: true }));
    else if (!scorecard.done) setOpen(o => ({ ...o, scorecard: true }));
  }, [status]);

  const requiredKnown = !!status.dates && !!status.scorecard;
  const requiredDone = (status.dates?.done ? 1 : 0) + (status.scorecard?.done ? 1 : 0);

  // /review 2026-08-17, two guards on one function:
  //  · While ANY overlay is up, collapsing is refused — a manager's modal lives INSIDE its row
  //    body, so hiding the row would display:none an open modal while the shared scroll-lock
  //    stays engaged (the scrim blocks the mouse, but Shift+Tab can still reach this toggle).
  //  · A toggle is the coach steering: it retires the auto-open effect so a slow first fetch
  //    can never re-expand a row the coach just closed.
  const overlayUp = useAnyOverlayOpen();
  const toggle = (key: ItemKey) => {
    if (overlayUp) return;
    autoOpened.current = true;
    setOpen(o => ({ ...o, [key]: !o[key] }));
  };

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <h3 className={styles.title}><CheckSquare size={15} /> Get set up</h3>
        {requiredKnown && (
          <span className={styles.progress}><b>{requiredDone}</b> of 2 required done</span>
        )}
      </div>
      <Row itemKey="dates" status={status.dates} isOpen={open.dates} onToggle={toggle}>
        <TryoutDayCard
          apiBase={`${apiBase}/tryout-sessions`}
          canWrite={canWrite}
          sport={sport}
          onError={onError}
          onStatus={report('dates')}
          blind={blind}
        />
      </Row>
      <Row itemKey="scorecard" status={status.scorecard} isOpen={open.scorecard} onToggle={toggle}>
        <TryoutRubricCard
          apiBase={`${apiBase}/tryout-rubric`}
          canWrite={canWrite}
          onError={onError}
          onStatus={report('scorecard')}
        />
      </Row>
      <Row itemKey="helpers" status={status.helpers} isOpen={open.helpers} onToggle={toggle}>
        <TryoutEvaluatorsCard
          apiBase={`${apiBase}/tryout-evaluators`}
          canWrite={canWrite}
          onError={onError}
          onStatus={report('helpers')}
        />
      </Row>
    </div>
  );
}
