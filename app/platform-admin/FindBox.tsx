'use client';
/**
 * Find — the box in the middle of the support console's strip (Support console Stage 2, owner rulings A2 + A3 + A10,
 * 2026-10-25; drawings Ub7fXLh29SC34Zp4oqKUx1 "Find", the eight panel states).
 *
 * Press / anywhere (outside a field), or click the box. Two characters or more ask the server (`POST
 * /api/platform-admin/find`, the words in the BODY — never the address, threat T6). Up to 8 a group, best match first:
 * Clubs, People (each person's clubs beneath, one row each) and, for the roles that search them, Stripe numbers.
 * ↑ ↓ move, Enter opens, Esc closes and returns focus where it was. A result only ever opens a record the role can read.
 *
 * What the panel decides, and what it does not: the server decides which groups a role searches (a group the role may
 * not read is ABSENT from the answer — no heading, no count); the panel draws what came back and, when a group was
 * trimmed, says in its foot what was searched, so an empty answer is never read as "nothing exists".
 *
 * Below 900 the box is its glyph in the strip; tapping it turns the strip into the box, with a back arrow, and the panel
 * takes the full width. Between 900 and 1,200 the box narrows to 280.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, ChevronRight, CreditCard, Search, User } from 'lucide-react';
import { readConsoleRecent, handListSearch, type RecentRecord } from '@/lib/console-recent';
import { consoleAgo, consoleDay } from '@/lib/console-dates';
import { FIND_FAILED, FIND_MIN_CHARS, type FindAnswer } from '@/lib/platform-find';
import styles from './find.module.css';

type Item = { key: string; href: string; onOpen?: () => void };

const CLUB_HREF = (id: string, money = false) => `/platform-admin/orgs/${id}?${money ? 'tab=money&' : ''}via=find`;
const PERSON_HREF = (id: string) => `/platform-admin/customer-users/${id}?via=find`;

function signedIn(iso: string | null): string {
  return iso ? `last signed in ${consoleDay(iso)}` : 'never signed in';
}

export default function FindBox({ searchesStripe }: { searchesStripe: boolean }) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const glyphRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [words, setWords] = useState('');
  const [answer, setAnswer] = useState<FindAnswer | null>(null);
  const [answered, setAnswered] = useState('');
  const [failed, setFailed] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<RecentRecord[]>([]);

  const trimmed = words.trim();
  const asking = trimmed.length >= FIND_MIN_CHARS;

  const openPanel = useCallback(() => {
    if (!open) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setRecent(readConsoleRecent());
      setActive(0);
    }
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const closePanel = useCallback((restore = true) => {
    setOpen(false);
    if (restore) {
      const back = returnFocus.current;
      // Back where the person was; the glyph on a narrow window, which is what opened it there.
      requestAnimationFrame(() => (back && document.contains(back) ? back : glyphRef.current)?.focus());
    }
  }, []);

  // `/` opens Find from anywhere, unless the person is typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      openPanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openPanel]);

  // Ask the server, a beat after the last keystroke. The words go in the body; an older answer never overwrites a newer.
  useEffect(() => {
    if (!open || !asking) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/platform-admin/find', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: trimmed }),
          cache: 'no-store',
          signal: controller.signal,
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setFailed(typeof body?.error === 'string' ? body.error : FIND_FAILED);
          return;
        }
        setFailed(null);
        setAnswer(body as FindAnswer);
        setAnswered(trimmed);
        setActive(0);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setFailed(FIND_FAILED);
      }
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, asking, trimmed]);

  const go = useCallback((item: Item) => {
    item.onOpen?.();
    setOpen(false);
    setWords('');
    setAnswer(null);
    router.push(item.href);
  }, [router]);

  // Every row a person can move to, in the order it is drawn.
  const showAnswer = asking && answer && answered === trimmed && !failed;
  const items: Item[] = useMemo(() => {
    if (!open) return [];
    if (!asking) return recent.map(r => ({ key: `r-${r.kind}-${r.id}`, href: r.kind === 'club' ? CLUB_HREF(r.id) : PERSON_HREF(r.id) }));
    if (!showAnswer || !answer) return [];
    const out: Item[] = [];
    for (const c of answer.clubs?.rows ?? []) out.push({ key: `c-${c.id}`, href: CLUB_HREF(c.id) });
    if (answer.clubs && answer.clubs.total > answer.clubs.rows.length) {
      out.push({ key: 'more-clubs', href: '/platform-admin/orgs', onOpen: () => handListSearch('clubs', trimmed) });
    }
    for (const p of answer.people?.rows ?? []) {
      out.push({ key: `p-${p.id}`, href: PERSON_HREF(p.id) });
      for (const club of p.clubs) out.push({ key: `p-${p.id}-${club.id}`, href: CLUB_HREF(club.id) });
    }
    if (answer.people && answer.people.total > answer.people.rows.length) {
      out.push({ key: 'more-people', href: '/platform-admin/customer-users', onOpen: () => handListSearch('people', trimmed) });
    }
    for (const s of answer.stripe?.rows ?? []) out.push({ key: `s-${s.orgId}`, href: CLUB_HREF(s.orgId, true) });
    return out;
  }, [open, asking, recent, showAnswer, answer, trimmed]);

  const onInputKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); closePanel(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, Math.max(items.length - 1, 0))); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter') {
      const item = items[active];
      if (item) { e.preventDefault(); go(item); }
    }
  };

  const optionId = (key: string) => `${listId}-${key}`;
  const activeKey = items[active]?.key;
  const isActive = (key: string) => key === activeKey;
  const itemIndex = (key: string) => items.findIndex(i => i.key === key);
  const row = (key: string) => ({
    id: optionId(key),
    role: 'option' as const,
    'aria-selected': isActive(key),
    className: `${styles.row}${isActive(key) ? ` ${styles.rowOn}` : ''}`,
    onMouseEnter: () => { const i = itemIndex(key); if (i >= 0) setActive(i); },
    onMouseDown: (e: ReactMouseEvent) => e.preventDefault(),
    onClick: () => { const item = items.find(i => i.key === key); if (item) go(item); },
  });

  const placeholder = searchesStripe ? 'Find a club, person or Stripe number' : 'Find a club or person';

  const hasAnyRow = !!answer && ((answer.clubs?.rows.length ?? 0) + (answer.people?.rows.length ?? 0) + (answer.stripe?.rows.length ?? 0)) > 0;
  const trimmedGroups = !!answer && !answer.searched.includes('stripe');
  const onlyStripe = !!answer && (answer.stripe?.rows.length ?? 0) > 0
    && (answer.clubs?.rows.length ?? 0) === 0 && (answer.people?.rows.length ?? 0) === 0;

  const keyFoot = (
    <div className={styles.foot}>
      <kbd>↑</kbd> <kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> to close · Card digits are not searched
    </div>
  );

  let body: ReactNode = null;
  if (open && !asking) {
    body = (
      <>
        {recent.length > 0 && (
          <>
            <div className={styles.head} role="presentation">Recent</div>
            {recent.map(r => {
              const key = `r-${r.kind}-${r.id}`;
              return (
                <div key={key} {...row(key)}>
                  <span className={styles.tile} aria-hidden>{r.kind === 'club' ? <Building2 size={15} /> : <User size={15} />}</span>
                  <span className={styles.text}>
                    <span className={styles.title}>{r.title}</span>
                    <span className={styles.sub}>{r.kind === 'club' ? 'Club' : 'Person'} · opened {consoleAgo(r.at)}</span>
                  </span>
                  <ChevronRight size={14} className={styles.chev} aria-hidden />
                </div>
              );
            })}
          </>
        )}
        <div className={styles.head} role="presentation">You can type</div>
        <div className={styles.hints} role="presentation">
          <span>An email, or part of a name</span>
          <span>A club&apos;s name, web name or owner&apos;s email</span>
          {searchesStripe && (
            <>
              <span>A Stripe customer or subscription number, <code className={styles.code}>cus_…</code> or <code className={styles.code}>sub_…</code></span>
              <span>A family&apos;s payment number, <code className={styles.code}>pi_…</code> or <code className={styles.code}>ch_…</code></span>
            </>
          )}
        </div>
        <div className={styles.foot}>Card digits are not searched. Ask for the email on the receipt instead.</div>
      </>
    );
  } else if (open && failed) {
    body = <div className={styles.msg} role="presentation"><strong>{failed}</strong></div>;
  } else if (open && showAnswer && answer) {
    if (!hasAnyRow && answer.chargeNotKept) {
      body = (
        <div className={styles.msg} role="presentation">
          <strong>No family payment has this number.</strong>
          <span>
            Charges on a club&apos;s own subscription are kept in Stripe only, so Find cannot match them yet. Search the customer
            number (<code className={styles.code}>cus_…</code>) or the email on the receipt.
          </span>
        </div>
      );
    } else if (!hasAnyRow) {
      body = (
        <>
          <div className={styles.msg} role="presentation">
            <strong>Nothing matches “{answered}”.</strong>
            <span>
              Find looks at emails, names, clubs, web names{answer.searched.includes('stripe') ? ', owners and Stripe numbers' : ' and owners'}.
              {' '}Check the spelling, or try part of the email.
            </span>
          </div>
          {trimmedGroups && <div className={styles.foot}>Searching clubs and people. Your role does not search Stripe numbers.</div>}
        </>
      );
    } else {
      body = (
        <>
          {answer.clubs && answer.clubs.rows.length > 0 && (
            <>
              <div className={styles.head} role="presentation">
                Clubs · {answer.clubs.total > answer.clubs.rows.length ? `${answer.clubs.rows.length} of ${answer.clubs.total}` : answer.clubs.total}
              </div>
              {answer.clubs.rows.map(c => (
                <div key={c.id} {...row(`c-${c.id}`)}>
                  <span className={styles.tile} aria-hidden><Building2 size={15} /></span>
                  <span className={styles.text}>
                    <span className={styles.title}>{c.name}</span>
                    <span className={styles.sub}>
                      {c.planLabel} · {c.statusLabel} · <code className={styles.code}>{c.slug}</code>
                      {c.ownerEmail ? ` · owner ${c.ownerEmail}` : ''}
                    </span>
                  </span>
                  <ChevronRight size={14} className={styles.chev} aria-hidden />
                </div>
              ))}
              {answer.clubs.total > answer.clubs.rows.length && (
                <div {...row('more-clubs')} className={`${styles.more}${isActive('more-clubs') ? ` ${styles.rowOn}` : ''}`}>
                  <span>{answer.clubs.total - answer.clubs.rows.length} more not listed</span>
                  <span className={styles.moreDoor}>All {answer.clubs.total} in Clubs &amp; portals ›</span>
                </div>
              )}
            </>
          )}
          {answer.people && answer.people.rows.length > 0 && (
            <>
              <div className={styles.head} role="presentation">
                People · {answer.people.total > answer.people.rows.length ? `${answer.people.rows.length} of ${answer.people.total}` : answer.people.total}
              </div>
              {answer.people.rows.map(p => (
                <div key={p.id} role="presentation">
                  <div {...row(`p-${p.id}`)}>
                    <span className={styles.tile} aria-hidden><User size={15} /></span>
                    <span className={styles.text}>
                      <span className={styles.title}>
                        {p.name ?? p.email}
                        {p.banned && <span className={styles.banned}>Banned</span>}
                      </span>
                      <span className={styles.sub}>
                        {p.name ? p.email : `${p.clubs.length} club${p.clubs.length === 1 ? '' : 's'}`} · {signedIn(p.lastSignInAt)}
                      </span>
                    </span>
                    <ChevronRight size={14} className={styles.chev} aria-hidden />
                  </div>
                  {p.clubs.map(club => (
                    <div key={club.id} {...row(`p-${p.id}-${club.id}`)} className={`${styles.kid}${isActive(`p-${p.id}-${club.id}`) ? ` ${styles.rowOn}` : ''}`}>
                      <span className={styles.kidText}><strong>{club.name}</strong> · {club.role}</span>
                      <ChevronRight size={14} className={styles.chev} aria-hidden />
                    </div>
                  ))}
                </div>
              ))}
              {answer.people.total > answer.people.rows.length && (
                <div {...row('more-people')} className={`${styles.more}${isActive('more-people') ? ` ${styles.rowOn}` : ''}`}>
                  <span>{answer.people.total - answer.people.rows.length} more not listed</span>
                  <span className={styles.moreDoor}>All {answer.people.total} in People ›</span>
                </div>
              )}
            </>
          )}
          {answer.stripe && answer.stripe.rows.length > 0 && (
            <>
              <div className={styles.head} role="presentation">Stripe · {answer.stripe.total}</div>
              {answer.stripe.rows.map(s => (
                <div key={s.orgId} {...row(`s-${s.orgId}`)}>
                  <span className={styles.tile} aria-hidden><CreditCard size={15} /></span>
                  <span className={styles.text}>
                    <span className={styles.title}>{s.orgName}</span>
                    <span className={styles.sub}>
                      {s.kind === 'customer' ? 'Stripe customer' : s.kind === 'subscription' ? 'Stripe subscription' : 'Family payment'}
                      {' '}<code className={styles.code}>{s.number}</code> · {s.planLabel}
                    </span>
                  </span>
                  <ChevronRight size={14} className={styles.chev} aria-hidden />
                </div>
              ))}
            </>
          )}
          {trimmedGroups
            ? <div className={styles.foot}>Searching clubs and people. Your role does not search Stripe numbers.</div>
            : onlyStripe
              ? <div className={styles.foot}>Enter opens the club. Its Money tab holds the Stripe numbers.</div>
              : keyFoot}
        </>
      );
    }
  }

  return (
    <div className={`${styles.slot}${open ? ` ${styles.slotOpen}` : ''}`}>
      <button
        type="button"
        ref={glyphRef}
        className={styles.glyph}
        onClick={openPanel}
        aria-label={placeholder}
        aria-expanded={open}
      >
        <Search size={20} aria-hidden />
      </button>
      <div className={styles.boxWrap}>
        {open && (
          <button type="button" className={styles.back} onClick={() => closePanel()} aria-label="Close Find">
            <ArrowLeft size={20} aria-hidden />
          </button>
        )}
        <div className={`${styles.box}${open ? ` ${styles.boxOn}` : ''}`} onClick={openPanel}>
          <Search size={15} className={styles.boxIcon} aria-hidden />
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            inputMode="search"
            value={words}
            onChange={e => { setWords(e.target.value); setFailed(null); setActive(0); }}
            onFocus={() => { if (!open) openPanel(); }}
            onKeyDown={onInputKey}
            placeholder={placeholder}
            maxLength={120}
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-label={placeholder}
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeKey ? optionId(activeKey) : undefined}
          />
          {!open && <kbd className={styles.slash} aria-hidden>/</kbd>}
        </div>
        {open && body && (
          <div className={styles.panel} id={listId} role="listbox" aria-label="Find results">
            {body}
          </div>
        )}
      </div>
      {open && <div className={styles.scrim} onMouseDown={() => closePanel(false)} aria-hidden />}
    </div>
  );
}
