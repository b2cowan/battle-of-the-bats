'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './CoachTournamentRecord.module.css';

export type JumpItem = { id: string; label: string };

/**
 * A3 quick-jump sub-nav — one anchor per record-page zone, folded into the sticky chrome
 * as a compact 34px row directly under the A2 shell's section tab row (approved mockups
 * 2026-07-26, decision ◆B). Deliberately subordinate to the tabs one level up: smaller
 * mono type, no icons, and the active zone gets COLOUR ONLY (the 2px underline is the
 * section tab row's cue). Mobile-only (hidden ≥901px — desktop has the rail and a much
 * shorter page). Free-shell only: it offsets against the shell header's measured height
 * (--coach-mhead-h) and the Premium operator shell has no such header.
 *
 * Scroll tracking recolours text only — it never resizes sticky chrome (the scroll-linked
 * bar-height guardrail in the design log).
 */
export default function CoachRecordJumpNav({ items }: { items: JumpItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? '');
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let raf = 0;
    const compute = () => {
      raf = 0;
      // Reading line = just under the sticky stack (the nav's own bottom edge works
      // whether it's stuck or still in flow). Active = LAST zone that crossed it.
      const line = (navRef.current?.getBoundingClientRect().bottom ?? 0) + 48;
      let current = items[0]?.id ?? '';
      for (const { id } of items) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      setActive(current);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [items]);

  function jump(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // scroll-margin-top on the zones clears the sticky stack.
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  if (items.length === 0) return null;

  return (
    <nav className={styles.jumpNav} aria-label="On this page" ref={navRef}>
      <div className={styles.jumpNavInner}>
        {items.map(item => (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={e => jump(e, item.id)}
            className={`${styles.jumpLink}${active === item.id ? ` ${styles.jumpLinkActive}` : ''}`}
            aria-current={active === item.id ? 'true' : undefined}
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
