'use client';
/**
 * components/public/ShareScoreButton.tsx
 * Primary action shares the game's LINK (so the recipient's chat unfurls the
 * page's branded OG preview AND can tap through to the live page — the
 * audience-growth loop). Secondary "Save image" generates the client-canvas PNG
 * for image-first surfaces (stories/posters) that don't unfurl links.
 */
import { useState } from 'react';
import { Share2, Check, Download } from 'lucide-react';
import { generateScoreCardBlob, shareScoreImage, shareLink, type ScoreCardData } from '@/lib/share-card';

type Props = Omit<ScoreCardData, 'primary'> & {
  /** Path to the game page (origin is prepended). */
  gameHref: string;
  className?: string;
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'score';
}

export default function ShareScoreButton({ className, gameHref, ...data }: Props) {
  const [link, setLink] = useState<'idle' | 'busy' | 'shared' | 'copied'>('idle');
  const [img, setImg] = useState<'idle' | 'busy' | 'done'>('idle');

  async function handleShareLink() {
    if (link === 'busy') return;
    setLink('busy');
    const url = `${window.location.origin}${gameHref}`;
    const title = `${data.awayName} ${data.awayScore} – ${data.homeScore} ${data.homeName}`;
    const result = await shareLink(url, title, data.tournamentName);
    setLink(result === 'idle' ? 'idle' : result);
    if (result !== 'idle') window.setTimeout(() => setLink('idle'), 2200);
  }

  async function handleSaveImage() {
    if (img === 'busy') return;
    setImg('busy');
    try {
      const primary = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#1E3A8A';
      const blob = await generateScoreCardBlob({ ...data, primary });
      const filename = `${slugify(data.awayName)}-vs-${slugify(data.homeName)}.png`;
      const text = `${data.awayName} ${data.awayScore} – ${data.homeScore} ${data.homeName} · ${data.tournamentName}`;
      await shareScoreImage(blob, filename, text);
      setImg('done');
      window.setTimeout(() => setImg('idle'), 2000);
    } catch {
      setImg('idle');
    }
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={handleShareLink}
        disabled={link === 'busy'}
        aria-label="Share a link to this game"
      >
        {link === 'copied' || link === 'shared' ? <Check size={15} /> : <Share2 size={15} />}
        {link === 'busy' ? 'Sharing…' : link === 'copied' ? 'Link copied' : link === 'shared' ? 'Shared' : 'Share'}
      </button>
      <button
        type="button"
        onClick={handleSaveImage}
        disabled={img === 'busy'}
        aria-label="Save the score as an image"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.3rem',
          background: 'transparent',
          border: 0,
          color: 'var(--white-50)',
          fontFamily: 'var(--font-data)',
          fontSize: '0.68rem',
          fontWeight: 700,
          letterSpacing: '0.02em',
          cursor: img === 'busy' ? 'default' : 'pointer',
          padding: '0.3rem 0.4rem',
        }}
      >
        <Download size={13} /> {img === 'busy' ? 'Saving…' : img === 'done' ? 'Saved' : 'Save image'}
      </button>
    </>
  );
}
