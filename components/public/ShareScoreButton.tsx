'use client';
/**
 * components/public/ShareScoreButton.tsx
 * A compact "Share" button that opens a small menu with two choices:
 *   • Share link  — shares the game URL so the recipient's chat unfurls the
 *     page's branded OG preview AND can tap through to the live page (the
 *     audience-growth loop).
 *   • Share image — generates the client-canvas PNG and hands it to the native
 *     share sheet (or downloads it) for image-first surfaces (stories/posters).
 *
 * The menu keeps the footprint small (a single button) while still surfacing
 * both options. Placement is configurable so it opens away from screen edges
 * (e.g. upward inside the bottom dock).
 */
import { useState, useRef, useEffect } from 'react';
import { Share2, Link2, Image as ImageIcon, Check } from 'lucide-react';
import { generateScoreCardBlob, shareScoreImage, shareLink, type ScoreCardData } from '@/lib/share-card';
import styles from './ShareScoreButton.module.css';

type Props = Omit<ScoreCardData, 'primary'> & {
  /** Path to the game page (origin is prepended). */
  gameHref: string;
  /** Class for the trigger button; falls back to a built-in compact style. */
  className?: string;
  /** Extra class on the positioning wrapper (margins/width). */
  wrapClassName?: string;
  menuAlign?: 'left' | 'right';
  menuPlacement?: 'up' | 'down';
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'score';
}

export default function ShareScoreButton({
  className,
  wrapClassName,
  gameHref,
  menuAlign = 'left',
  menuPlacement = 'down',
  ...data
}: Props) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<'idle' | 'busy' | 'shared' | 'copied'>('idle');
  const [img, setImg] = useState<'idle' | 'busy' | 'done'>('idle');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function handleShareLink() {
    if (link === 'busy') return;
    setLink('busy');
    const url = `${window.location.origin}${gameHref}`;
    const title = `${data.awayName} ${data.awayScore} – ${data.homeScore} ${data.homeName}`;
    const result = await shareLink(url, title, data.tournamentName);
    if (result === 'idle') { setLink('idle'); setOpen(false); return; }
    setLink(result);
    window.setTimeout(() => { setLink('idle'); setOpen(false); }, 1600);
  }

  async function handleShareImage() {
    if (img === 'busy') return;
    setImg('busy');
    try {
      const primary = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#1E3A8A';
      const blob = await generateScoreCardBlob({ ...data, primary });
      const filename = `${slugify(data.awayName)}-vs-${slugify(data.homeName)}.png`;
      const text = `${data.awayName} ${data.awayScore} – ${data.homeScore} ${data.homeName} · ${data.tournamentName}`;
      await shareScoreImage(blob, filename, text);
      setImg('done');
      window.setTimeout(() => { setImg('idle'); setOpen(false); }, 1600);
    } catch {
      setImg('idle');
      setOpen(false);
    }
  }

  const linkLabel = link === 'busy' ? 'Sharing…'
    : link === 'copied' ? 'Link copied'
    : link === 'shared' ? 'Shared'
    : 'Share link';

  const imgLabel = img === 'busy' ? 'Preparing…'
    : img === 'done' ? 'Image ready'
    : 'Share image';

  return (
    <div ref={wrapRef} className={`${styles.wrap} ${wrapClassName ?? ''}`}>
      <button
        type="button"
        className={className ?? styles.trigger}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Share this game"
      >
        <Share2 size={15} /> Share
      </button>

      {open && (
        <div
          role="menu"
          className={[
            styles.menu,
            menuAlign === 'right' ? styles.menuRight : styles.menuLeft,
            menuPlacement === 'up' ? styles.menuUp : styles.menuDown,
          ].join(' ')}
        >
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            onClick={handleShareLink}
            disabled={link === 'busy'}
          >
            {link === 'copied' || link === 'shared' ? <Check size={16} /> : <Link2 size={16} />}
            <span>
              {linkLabel}
              <span className={styles.menuSub}>Opens the live page</span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            onClick={handleShareImage}
            disabled={img === 'busy'}
          >
            {img === 'done' ? <Check size={16} /> : <ImageIcon size={16} />}
            <span>
              {imgLabel}
              <span className={styles.menuSub}>Save or post a picture</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
